# Inked: the style spec and its generator

Inked is the game's chosen art direction (backlog #127 proposed it, #137 chose and tuned it). This directory is the seed of the sprite generator every room will be drawn with. The proposal's shed (`art/proposal/inked.mjs`, rendered by `npm run art:proposal` into `docs/proposals/art-direction/`) is the first thing drawn with it and the reference for how a sheet uses it.

## The look

Hand-drawn ink over watercolour washes on paper. Authored at 4 art px per logical px (a 16 px tile is 64 art px), supersampled 3x, box-filtered down, and shown with smooth (bilinear) scaling, never nearest-neighbour. Every form is laid in three passes: an opaque paper silhouette, a low-saturation wash at 65 percent laid slightly off register, then ink: each edge its own wobbling line 1.5 to 4 art px wide that swells, thins, overshoots its corners and sometimes runs dry, hatching on the shadow sides. Then wear by material. No gradients. The scale rule (`art/proposal/scale.mjs`, explained in the proposal README) is unchanged: Inked changes how things are drawn, not how big they are.

## Files

| File         | What it is                                                                                                  |
| ------------ | ----------------------------------------------------------------------------------------------------------- |
| `index.mjs`  | the entry: `createPage`, `finish`, and the palette and styles re-exported. Import from here.                |
| `style.mjs`  | the palette, the washes by material, which washes wear, and the knobs: `STYLE` and `PROPOSAL_STYLE`          |
| `kit.mjs`    | the drawing vocabulary: `shape`, `box`, `blob`, `line`, `hatchIn`, `groundShadow`, `cornerShade`, and wear   |
| `stroke.mjs` | the rasteriser: polygon fill, pen strokes (pressure, dry brush, spatter), hatching, the downsample           |
| `wash.mjs`   | washes that pool into a darker rim, bleed past the outline and granulate                                     |
| `paper.mjs`  | the hash and value noise, and the one paper grain every sheet shares                                         |

## The knobs

One options object, `STYLE` in `style.mjs`, holds every knob; its values are the chosen look. Lengths are logical px unless marked art px. `PROPOSAL_STYLE` sets every grunge knob off and reproduces the #127 render byte for byte.

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

Paper `[242, 234, 218]`, ink `[50, 42, 38]`, surround `[62, 54, 50]`, and one wash per material in `WASHES` (wall, floor, wood, top, cap, stone, metal, terracotta, foliage, soil, shirt, trousers, skin, hair, brass, glass, lamp, cream, rug, outside, shadow), each laid at `WASH_ALPHA` 0.65. `WEAR_BY_WASH` says which washes wear as wood (`wood`, `top`), pot (`terracotta`) or cloth (`rug`, `cream`). The proposal's `inked-palette.png` shows every colour as it lands on paper. A new material is a new entry in `WASHES` (and in `WEAR_BY_WASH` if it wears), never an inline colour.

## What a room generator must call, and must not reinvent

- **Call** `createPage(width, height, { seed, origin })` from `index.mjs` for each sheet, draw only with the returned kit `k`, and turn the page into pixels with `finish(page)`. Leave `style` at its default.
- **Draw forms** with `k.shape` / `k.box` (polygon or rectangle, a wash by material name, optional `hatching`: `true`, a sub-polygon, or `'shadow'` for heavy shadow), round things with `k.blob`, loose ink with `k.line`, shadow sides with `k.hatchIn`, ground shadows with `k.groundShadow`, and floor corners with `k.cornerShade`. Pass `wear: false` only where a form is not the material its wash suggests (a paper sign washed `cream`, a border painted on a rug).
- **Do not reinvent** a line, fill, wash, hatch, grain, noise or random generator, write pixels directly, use `Math.random`, scale nearest-neighbour, or pick colours outside `style.mjs`. If a room needs a primitive the kit lacks, add it to the kit with a knob in `STYLE` so every room gets it.

## Keeping the wobble varied across six rooms and two gardens

Generated wobble repeats exactly when the seed does, and a repeat reads as a pattern.

- **One seed per sheet.** Every sheet passes its own `seed` to `createPage`; no two sheets share one. Keep the seeds in one table in the room's generator, written out, so they are stable when sheets are added or reordered (never derive them from an array index).
- **Two generators per page.** The seed drives the drawing (wobble, overshoot, register) and, through `seed ^ 0x5eed`, the page's grunge generator (pressure, dry brush, spatter, cross hatching, corner shading, wear). Changing a grunge knob therefore never changes the lines underneath.
- **No repeated tile without a variant.** A tile that repeats (floorboards, a fence run, grass, wall planks) is drawn as at least three variants, each on its own seed, and the room scatters them as the floors do today, so no two neighbours are the same drawing.
- **One grain.** The paper grain is not seeded: it is one fixed texture that tiles every 256 art px (four tiles) and is sampled at the sheet's world position. Pass the sheet's top-left in world logical px as `origin`, so neighbouring sheets continue the same paper instead of restarting it.
- **Deterministic.** Everything is seeded or hashed, so a rerun reproduces the committed PNGs byte for byte; check with `git status` after regenerating.
