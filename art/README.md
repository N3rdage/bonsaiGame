# Generated assets — import & wiring reference

12 PNGs covering every in-scope slot in `ART_SPEC.md`. All authored at 1:1,
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

- **Props are the 32×32 centre baseline** (the clean drop-in), not the optional
  32×48 tall variant — so no Draw changes needed beyond swapping the sprite.
- **`spr_foliage` is intentionally pale** (~225,232,220 neutral green) with hard
  alpha holes, so the per-species/season vertex colour tints it correctly.
- **`spr_tree_small` not generated** — out of scope (procedural/data-driven tree).
- All tileables verified seamless (see `_preview.png`, the 3×3 tiled rows).

## Regenerating / tweaking

`pixel.py` is the hard-edged drawing toolkit (+ the palette dict). `make_assets.py`
has one function per slot. Edit a colour in `PAL` or a shape function and rerun:

```bash
python3 make_assets.py    # writes the 12 PNGs into ./out
python3 preview.py        # rebuilds _preview.png
```
