import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PORT = process.env.PORT || 4180;
const GALLERY = path.join(ROOT, 'gallery.json');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

// Storage: Upstash Redis when provisioned (Vercel), gallery.json locally
const LIST_KEY = 'froyo:gallery';
const MAX_ENTRIES = 200;
const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const useRedis = Boolean(redisUrl && redisToken);

async function redis(commands) {
  const res = await fetch(`${redisUrl}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${redisToken}`, 'content-type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`redis ${res.status}`);
  return res.json();
}

async function readGallery() {
  if (useRedis) {
    const [{ result }] = await redis([['LRANGE', LIST_KEY, '0', String(MAX_ENTRIES - 1)]]);
    return (result || [])
      .map((s) => { try { return JSON.parse(s); } catch { return null; } })
      .filter(Boolean)
      .reverse(); // stored newest-first; clients expect oldest-first
  }
  try { return JSON.parse(fs.readFileSync(GALLERY, 'utf8')); } catch { return []; }
}

async function addEntry(entry) {
  if (useRedis) {
    await redis([
      ['LPUSH', LIST_KEY, JSON.stringify(entry)],
      ['LTRIM', LIST_KEY, '0', String(MAX_ENTRIES - 1)],
    ]);
    return;
  }
  const list = await readGallery();
  list.push(entry);
  fs.writeFileSync(GALLERY, JSON.stringify(list));
}

// crude server-side guard; the client also sanitizes before rendering
const looksSafe = (markup) =>
  !/<(?!\/?(g|use|path)\b)/i.test(markup) && !/\bon[a-z]+\s*=/i.test(markup) &&
  !/href\s*=\s*["'](?!#)/i.test(markup);

http.createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];

  if (url === '/api/gallery') {
    if (req.method === 'GET') {
      readGallery()
        .then((list) => {
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify(list));
        })
        .catch(() => { res.statusCode = 500; res.end('{"error":"storage unavailable"}'); });
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', c => { body += c; if (body.length > 500_000) req.destroy(); });
      req.on('end', () => {
        (async () => {
          const e = JSON.parse(body);
          const decor = String(e.decor || '').slice(0, 200_000);
          if (!looksSafe(decor)) throw new Error('rejected');
          const entry = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
            ts: Date.now(),
            flavor: String(e.flavor || 'vanilla').slice(0, 20),
            cup: String(e.cup || 'dot-blue').slice(0, 20),
            decor,
          };
          await addEntry(entry);
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify(entry));
        })().catch(() => {
          res.statusCode = 400;
          res.end('{"error":"bad request"}');
        });
      });
      return;
    }
    res.statusCode = 405; res.end(); return;
  }

  let p = decodeURIComponent(url);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.statusCode = 404; res.end('not found'); return;
  }
  res.setHeader('content-type', MIME[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
}).listen(PORT, () => console.log(`froyo shop on http://localhost:${PORT}`));
