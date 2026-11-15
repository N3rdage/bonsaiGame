# Inked: the style spec and its generator

Inked is the game's art direction. This directory is the sprite generator every room is drawn with; `viewer.mjs` is a complete sheet generator and the reference for how a sheet uses it: one `createPage` per sheet on its own seed, drawn with the kit, finished with `finish` or `finishCutOut` and written with `writePng`.

## The look

Hand-drawn ink over watercolour washes on paper. Authored at 4 art px per logical px (a 16 px tile is 64 art px), supersampled 3x, box-filtered down, and shown with smooth (bilinear) scaling, never nearest-neighbour. Every form is laid in three passes: an opaque paper silhouette, a low-saturation wash at 65 percent laid slightly off register, then ink: each edge its own wobbling line 1.5 to 4 art px wide that swells, thins, overshoots its corners and sometimes runs dry, hatching on the shadow sides. Then wear by material. No gradients. Inked sets how things are drawn, not how big they are; sizes follow the scale rule. The logical canvas is 480 x 270 px and one 16 px tile is 50 cm of floor (32 px per metre). The rooms are a three-quarter top-down view, so heights draw foreshortened to two thirds, about 21.33 px per metre. A piece of furniture draws as its front face (real height x 21.33 px/m) plus its footprint's depth for the top face, rounded to 4 px: a 1.5 x 0.6 x 0.9 m workbench is 48 x 40, a 1.2 x 0.4 x 2.0 m bookcase 40 x 56, a 0.4 m pedestal 16 x 32. The avatar and a front-on door round to the half-tile grid instead (the 1.7 m avatar 16 x 32, a 0.8 x 2.0 m door 24 x 40; a side-on door is an 8 x 40 frame on the wall cap). The back wall's face, 2.4 m high, is a 48 px band and a 0.25 m wall cap an 8 px band. Trees on pedestals are the one exception, drawn at three times true size so a 25 cm tree reads on a phone; the 3D viewer shows a tree at its true size.

## Files

| File         | What it is                                                                                                  |
| ------------ | ----------------------------------------------------------------------------------------------------------- |
| `index.mjs`  | the entry: `createPage`, `finish`, `finishCutOut` (a sprite with its surrounding paper cut to crisp alpha), and the palette and styles re-exported. Import from here. |
| `style.mjs`  | the palette, the washes by material, which washes wear, and the knobs: `STYLE`                              |
| `kit.mjs`    | the drawing vocabulary: `shape`, `box`, `blob`, `line`, `hatchIn`, `groundShadow`, `cornerShade`, and wear   |
| `stroke.mjs` | the rasteriser: polygon fill, pen strokes (pressure, dry brush, spatter), hatching, the downsample           |
| `wash.mjs`   | washes that pool into a darker rim, bleed past the outline and granulate                                     |
| `paper.mjs`  | the hash and value noise, and the one paper grain every sheet shares                                         |
| `canvas.mjs` | `writePng`, which writes a finished canvas to a PNG with `pngjs`                                             |
| `viewer.mjs` | the 3D viewer's `src/viewer/foliage.png` (cut out) and `bark.png`, `npm run art:viewer`; ink drawn heavier because the viewer shows them five or six times smaller |

## The knobs

One options object, `STYLE` in `style.mjs`, holds every knob; its values are the game's look. Lengths are logical px unless marked art px.

| Knob              | Default                                                    | Effect                                                                                       |
| ----------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `jitter`          | 0.8                                                        | sideways wobble of a line, art px                                                            |
| `overshoot`       | 1.8                                                        | how far a line runs past its corner, art px                                                  |
| `weightVariation` | 0.35                                                       | pen pressure along a line: two slow seeded swells, as a fraction of the width                |
| `dryBrush`        | `{ strength: 0.85, minLength: 12, every: 24 }`             | lines of at least `minLength` break dry about once per `every`; `strength` is the bristle loss at a break's centre |
| `spatter`         | `{ chance: 0.12, minWidth: 2.4, dots: 3, radius: 2.2 }`     | a line at least `minWidth` art px wide flicks up to `dots` dots within about `radius`, with that chance |
| `washPool`        | 0.25                                                       | extra opacity at a wash's edge, the darker pooled rim                                        |
| `washPoolWidth`   | 0.9                                                        | how far in from the edge the rim reaches                                                     |
| `washBleed`       | 0.8                                                        | how far a wash creeps past its outline at most, shaped by noise                              |
| `washGranulation` | 0.12                                                       | how unevenly pigment settles inside a wash                                                   |
| `grain`           | 0.09                                                       | how deeply the paper grain darkens the finished page                                         |
| `shadowAlpha`     | 0.45                                                       | opacity of a ground shadow's wash                                                            |
| `crossHatch`      | `{ angle: -0.75, spacing: 1.7 }`                           | the crossing hatch pass in heavy shadow (`null` for none)                                    |
| `cornerShade`     | 7                                                          | size of the shaded triangle `cornerShade` lays in a room corner (0 for none)                 |
| `wear`            | 1                                                          | how much wood knots and splits, pots chip and ring, cloth frays and stains (0 for none)      |

Tune a knob in `STYLE`, not in a room: every sheet must share one look.

## The palette

Paper `[242, 234, 218]`, ink `[50, 42, 38]`, surround `[62, 54, 50]`, and one wash per material in `WASHES` (wall, floor, wood, top, cap, stone, metal, terracotta, foliage, soil, shirt, trousers, skin, hair, brass, glass, lamp, cream, rug, outside, shadow, and the 3D viewer's near-neutral bark and leaf), each laid at `WASH_ALPHA` 0.65. `WEAR_BY_WASH` says which washes wear as wood (`wood`, `top`), pot (`terracotta`) or cloth (`rug`, `cream`). `palette` in `style.mjs` lists every colour as it lands on paper. A new material is a new entry in `WASHES` (and in `WEAR_BY_WASH` if it wears), never an inline colour.

## What a room generator must call, and must not reinvent

- **Call** `createPage(width, height, { seed, origin })` from `index.mjs` for each sheet, draw only with the returned kit `k`, and turn the page into pixels with `finish(page)`. Leave `style` at its default.
- **Draw forms** with `k.shape` / `k.box` (polygon or rectangle, a wash by material name, optional `hatching`: `true`, a sub-polygon, or `'shadow'` for heavy shadow), round things with `k.blob`, loose ink with `k.line`, shadow sides with `k.hatchIn`, ground shadows with `k.groundShadow`, and floor corners with `k.cornerShade`. Pass `wear: false` only where a form is not the material its wash suggests (a paper sign washed `cream`, a border painted on a rug).
- **Do not reinvent** a line, fill, wash, hatch, grain, noise or random generator, write pixels directly, use `Math.random`, scale nearest-neighbour, or pick colours outside `style.mjs`. If a room needs a primitive the kit lacks, add it to the kit with a knob in `STYLE` so every room gets it.

## Keeping the wobble varied across six rooms and two gardens

Generated wobble repeats exactly when the seed does, and a repeat reads as a pattern.

- **One seed per sheet.** Every sheet passes its own `seed` to `createPage`; no two sheets share one. Keep the seeds in one table in the room's generator, written out, so they are stable when sheets are added or reordered (never derive them from an array index).
- **Two generators per page.** The seed drives the drawing (wobble, overshoot, register) and, through `seed ^ 0x5eed`, the page's grunge generator (pressure, dry brush, spatter, cross hatching, corner shading, wear). Changing a grunge knob therefore never changes the lines underneath.
- **No repeated tile without a variant.** A tile that repeats (floorboards, a fence run, grass, wall planks) is drawn as at least three variants, each on its own seed, and the room scatters them as the floors do, so no two neighbours are the same drawing.
- **One grain.** The paper grain is not seeded: it is one fixed texture that tiles every 256 art px (four tiles) and is sampled at the sheet's world position. Pass the sheet's top-left in world logical px as `origin`, so neighbouring sheets continue the same paper instead of restarting it.
- **Deterministic.** Everything is seeded or hashed, so a rerun reproduces the committed PNGs byte for byte; check with `git status` after regenerating.
