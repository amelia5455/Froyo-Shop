// Froyo Gallery API for the Vercel deployment.
// Stores entries in Upstash Redis (Vercel Marketplace) via its REST API.
// Locally, server.mjs serves the same /api/gallery routes from gallery.json.

const LIST_KEY = 'froyo:gallery';
const MAX_ENTRIES = 200;

const restUrl = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const restToken = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(commands) {
  const res = await fetch(`${restUrl()}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${restToken()}`, 'content-type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`redis ${res.status}`);
  return res.json();
}

// crude guard; the client also sanitizes before rendering
const looksSafe = (markup) =>
  !/<(?!\/?(g|use|path)\b)/i.test(markup) && !/\bon[a-z]+\s*=/i.test(markup) &&
  !/href\s*=\s*["'](?!#)/i.test(markup);

export default async function handler(req, res) {
  if (!restUrl() || !restToken()) {
    res.status(503).json({ error: 'gallery storage not configured' });
    return;
  }

  if (req.method === 'GET') {
    const [{ result }] = await redis([['LRANGE', LIST_KEY, '0', String(MAX_ENTRIES - 1)]]);
    const entries = (result || []).map((s) => { try { return JSON.parse(s); } catch { return null; } })
      .filter(Boolean)
      .reverse(); // stored newest-first; the client expects oldest-first
    res.status(200).json(entries);
    return;
  }

  if (req.method === 'POST') {
    try {
      const e = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const decor = String(e.decor || '').slice(0, 200_000);
      if (!looksSafe(decor)) throw new Error('rejected');
      const entry = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        ts: Date.now(),
        flavor: String(e.flavor || 'vanilla').slice(0, 20),
        cup: String(e.cup || 'dot-blue').slice(0, 20),
        decor,
      };
      await redis([
        ['LPUSH', LIST_KEY, JSON.stringify(entry)],
        ['LTRIM', LIST_KEY, '0', String(MAX_ENTRIES - 1)],
      ]);
      res.status(200).json(entry);
    } catch {
      res.status(400).json({ error: 'bad request' });
    }
    return;
  }

  res.status(405).end();
}
