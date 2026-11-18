# Generated assets — import & wiring reference

The sprite spec is the GameMaker prototype's and lives in the archive,
[`archive/gamemaker/ART_SPEC.md`](../archive/gamemaker/ART_SPEC.md);
`sheets.mjs` packs the sprite sizes it describes into the web build's sheets.

12 PNGs covering every in-scope slot in that spec. All authored at 1:1,
RGBA, transparent background, hard pixel edges (no anti-aliasing), palette
locked to the spec table. Multi-frame sprites are **horizontal strips** — use
GM's *Import Strip* and set the frame width below.

| File | Px size | Frame W | Frames | GM Origin | Frame order |
|------|---------|---------|--------|-----------|-------------|
| `spr_floor_shed.png` | 96×32 | 32 | 3 | Top Left | plank variations (random-scatter when tiling) |
| `spr_floor_garden.png` | 96×32 | 32 | 3 | Top Left | grass variations |
| `spr_wall.png` | 32×32 | — | 1 | Top Left | — |
| `spr_fence.png` | 32×32 | — | 1 | Top Left | — |
| `spr_door.png` | 32×32 | — | 1 | Top Left | — |
| `spr_workbench.png` | 32×32 | — | 1 | Middle Centre | — |
| `spr_planting_table.png` | 32×32 | — | 1 | Middle Centre | — |
| `spr_shop_kiosk.png` | 32×32 | — | 1 | Middle Centre | — |
| `spr_pedestal.png` | 32×32 | — | 1 | Middle Centre | — |
| `spr_player.png` | 512×32 | 32 | 16 | Middle Centre | see below |
| `spr_source_plant.png` | 144×48 | 48 | 3 | Middle Centre (24,24) | 0 juniper, 1 maple, 2 pine |
| `spr_foliage.png` | 128×128 | — | 1 | Middle Centre | pale/neutral — tint via vertex colour |

## `spr_player` frame layout (16 frames)

Frames run `down, up, left, right`, each direction a 4-frame walk cycle in the
order `[contact, step-A, contact, step-B]`:

```
index = facing_row * 4 + walk_index
facing_row:  down=0  up=1  left=2  right=3
walk_index:  0..3   (0 = idle/standing pose)
```

So in the object's Draw: `image_index = facing * 4 + (walking ? anim : 0)`.

**4-frame minimum option:** if you'd rather wire the 4-direction idle only,
use frames **0, 4, 8, 12** (the `contact` pose of each direction).

## Choices made vs the spec

- **Props are the 32×32 centre baseline** (the clean drop-in), so each Draw
  only swaps in the sprite.
- **`spr_foliage` is intentionally pale** (~225,232,220 neutral green) with hard
  alpha holes, so the per-species/season vertex colour tints it correctly.
- **`spr_tree_small` not generated** — out of scope (procedural/data-driven tree).
- All tileables verified seamless (see `_preview.png`, the 3×3 tiled rows).

## Web build

The web build does not read the PNGs above: it reads the prototype's own
frames, which GameMaker keeps as one PNG per frame under
`archive/gamemaker/sprites/<name>/<frame-uuid>.png`, ordered by the `frames`
array of `<name>.yy`. `sheets.mjs` (Node, `pngjs`; run it with
`npm run art:sheets`, no Python needed) packs each sprite's frames in that
order into one horizontal strip, `public/assets/<name>.png`, which Vite copies
into the build and `BootScene` loads as a spritesheet (keys and frame sizes in
`src/world/assets.ts`). The output is committed; rerun the script after an
archive sprite changes.

| File | Px size | Frames | Made from |
|------|---------|--------|-----------|
| `spr_door.png` | 32×32 | 1 | `spr_door` |
| `spr_pedestal.png` | 32×32 | 1 | `spr_pedestal` |

The greenhouse's tiles and the placeable floor shelf are new content with no
prototype sprites, so they are drawn in code by `interiors.mjs` (Node,
`pngjs`; `npm run art:interiors`). It uses a seeded generator, never
`Math.random`, so a rerun reproduces the committed bytes. Hard pixel edges, a
small palette near `pixel.py`'s wood tones. `interiors.mjs` only writes the
sheets, in a fixed order; the drawing lives under `interiors/`: `png.mjs`
(tile size, seeded generator, `setPixel`, `fill`, `write`), `palette.mjs`
(every shared colour, by family) and `greenhouse.mjs`, which exports its
sheets as `{ name, width, height, draw(png) }` and describes them at its top.

The shed's sheets (its floor, workbench, planting table, kiosk and
`make_decor.py`'s decor: shelf, tools, watering can, pot stack, sack) and
the garden's (its grass, wall, fences and source plants) are not packed:
the web build draws the shed, the gardens and the house rooms in Inked (see
below). The prototype's 56 px `spr_window` is not packed either; each Inked
room draws its own window. `spr_foliage` is the 3D viewer's
(`src/viewer/foliage.png`), and the room's trees are drawn in code as the
prototype's `obj_tree_sprite` did, so `spr_tree_small` is not used.

## Regenerating / tweaking

`pixel.py` is the hard-edged drawing toolkit (+ the palette dict). `make_assets.py`
has one function per slot. Edit a colour in `PAL` or a shape function and rerun:

```bash
python3 make_assets.py    # writes the 12 PNGs into ./out
python3 preview.py        # rebuilds _preview.png
```

## Inked generator

Inked is the game's art direction, and `inked/` is its generator; `inked/README.md` is the style spec every room generator follows (the scale rule, knobs, palette, what to call and how to keep the wobble varied). A sheet generator imports `createPage`, `finish` and `finishCutOut` from `inked/index.mjs` and `writePng` from `inked/canvas.mjs`; `inked/viewer.mjs` (`npm run art:viewer`) is one, drawing the 3D viewer's foliage and bark textures. The web build's `spr_player.png` is Inked too, drawn by `inked/player.mjs` (`npm run art:player`) rather than packed from the prototype's frames: 16 frames of 16 x 32 logical px (64 x 128 sheet px) in the frame order above. So is every sheet the shed draws, by `inked/shed.mjs` (`npm run art:shed`): `spr_floor_shed` (3 variants of a 16 x 16 floorboard tile), the back wall's face `spr_shed_wall` (3 variants, 16 x 48), the 8 px caps `spr_shed_cap` (south, 16 x 8) and `spr_shed_cap_v` (sides, 8 x 16, 3 variants each), `spr_shed_window` (32 x 24), the lounge door front-on `spr_shed_door` (24 x 40), the garden door's opening in the south cap `spr_shed_door_s` (24 x 16), `spr_workbench` (48 x 40), `spr_planting_table` (32 x 40), `spr_shop_kiosk` (24 x 56), the decor `spr_shelf` (24 x 20), `spr_tools` (12 x 32), `spr_watering_can` (16 x 12), `spr_pot_stack` (12 x 20) and `spr_sack` (16 x 20), and the rug `spr_shed_rug` (120 x 70), all in logical px at 4 sheet px each. So is every sheet the back garden draws, by `inked/garden.mjs` (`npm run art:garden`), the lawn, fences and gate shared with the front garden: `spr_floor_garden` (3 variants of a 16 x 16 lawn tile), the fence's face front-on `spr_fence` and a north-south fence in three-quarter view `spr_fence_v` (3 variants each, 16 x 16), the ring's corners `spr_fence_corner` (16 x 16, frames NW, NE, SW, SE), and, cut out, the side gate `spr_gate` (16 x 16) and the source plants `spr_source_plant` (24 x 32, frames juniper, maple, pine); and the buildings seen from it, 3 variants each: the faces `spr_shed_face`, `spr_house_face` and `spr_greenhouse_face` (16 x 48), the roofs `spr_shed_roof`, `spr_house_roof` and `spr_greenhouse_roof` (16 x 16), the caps `spr_house_cap_v` and `spr_greenhouse_cap_v` (8 x 16) and `spr_greenhouse_cap` (16 x 8), and, cut out, the kitchen window `spr_house_window` (40 x 24) and one glazed leaf `spr_door_glazed` (24 x 40). The front garden draws the house's face, roof and window for the garage and the house too, and its own sheets come from `inked/frontGarden.mjs` (`npm run art:front-garden`): the road `spr_road` (3 variants of a 32 x 96 slice), the low front fence `spr_fence_low` (cut out), the drive's block paving `spr_drive`, the path's flags `spr_path` and the beds `spr_bed` (3 variants each, 16 x 16), and, cut out, the front door `spr_front_door` (24 x 40) and the garage's roller door `spr_roller_door` (77 x 40). So is every sheet each house room draws, by `inked/lounge.mjs` (`npm run art:lounge`), `inked/hallway.mjs` (`npm run art:hallway`) and `inked/study.mjs` (`npm run art:study`), which share `inked/house.mjs`: the floors `spr_floor_lounge`, `spr_floor_kitchen`, `spr_floor_hallway` and `spr_floor_study` (3 variants each, 16 x 16), the faces `spr_wall_lounge`, `spr_wall_hallway` and `spr_wall_study` (3 variants each, 16 x 48), each room's caps `spr_<room>_cap` (16 x 8) and `spr_<room>_cap_v` (8 x 16, 3 variants each), and, cut out, the windows `spr_lounge_window` and `spr_study_window` (32 x 24), `spr_fireplace` (32 x 44), `spr_side_table` (16 x 24), `spr_counter` (96 x 40), `spr_counter_v` (20 x 60), `spr_runner` (60 x 24), `spr_hall_table` (16 x 28), `spr_desk` (32 x 32) and `spr_bookshelf` (48 x 28). So are the house's own doors, by `inked/doors.mjs` (`npm run art:doors`), all cut out: the study's glazed double door front-on `spr_door_glass` (48 x 40, two leaves of `spr_door_glazed`'s look) and the side-on doors between rooms, `spr_door_side_w` for a west wall and its mirror `spr_door_side_e` for an east one (8 x 40, a frame on the wall's cap with the leaf ajar into the room). Its header lists every door sheet in the game and the generator that draws each.
