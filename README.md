# The Froyo Shop 🍦

An interactive froyo builder inspired by [Sasha Balandina's Donut Lab](https://sashabalandina.com/donut-lab).

Pick a flavor and a cup, then press & drag on the froyo to add toppings and pour syrups. Hit **Share ✦** and a little gummy-bear spoon dives in before your creation joins the Froyo Gallery for everyone to see.

## Features

- **6 flavors** — vanilla, chocolate, strawberry, Dole pineapple whip, matcha, and a chocolate-vanilla swirl
- **8 cups** — solids, tapered stripes, and polka dots
- **11 toppings** placed individually at your cursor — sprinkles (rainbow, chocolate, and stars), gummy bears & worms, marshmallows (alternating pink & white), chocolate chips, strawberries, boba, graham dust, coconut flakes
- **6 syrups** drawn by dragging — marshmallow, chocolate, caramel, strawberry, pistachio
- **Soft ASMR sounds** — synthesized live with the Web Audio API, no audio files
- **Froyo Gallery** — shared gallery of everyone's submitted bowls

## Run it

```bash
node server.mjs
```

Then open [http://localhost:4180](http://localhost:4180). No dependencies — the server is plain Node, the app is a single HTML file, and the gallery persists to `gallery.json`.
