# ART_SPEC.md

The GameMaker prototype's sprite spec. It defines every sprite slot — size,
origin, frames, naming — plus a shared palette. The prototype's sprites follow
it, and the web build packs those sprites into its sheets (`art/README.md`).

**Workflow:** PNGs made to this spec are imported as sprites in the GM IDE
(sizes/origins below), assigned to their objects there, and drawn by name in
each object's Draw event.

---

## Core constraints

- **Internal resolution is 960×540**, scaled up (×2 = 1080p, often more) with
  **nearest-neighbour** filtering (`interpolate_pixels = false`). So:
  - **Author at 1:1** (a 32px tile is 32 real pixels), as crisp pixel art.
  - **Design to be seen at 2–4× magnification** — chunky, readable shapes; no
    sub-pixel detail, fine gradients, or 1px noise (it vanishes or shimmers).
  - **No anti-aliasing / soft edges.** Hard pixel edges, transparent background.
- **Tile grid = 32px.** Walls, floors, doors, and standard props align to it.
- **Format:** PNG, RGBA, transparent background, **exact pixel dimensions** in the
  tables below. One PNG per frame (or a strip — GM import handles both).
- **Cohesion:** stick to the palette below. A limited, shared palette is what
  makes procedural-and-sprite, shed-and-garden read as one game.

---

## Palette

Cozy, slightly desaturated, warm. RGB values; keep most art within these families.

| Family        | Role                        | RGB |
|---------------|-----------------------------|-----|
| Wood mid      | furniture, fences           | 120, 85, 55 |
| Wood dark     | outlines, shadow sides      | 70, 45, 25 |
| Wood light    | highlights, sanded tops     | 160, 110, 70 |
| Shed floor    | interior plank base         | 104, 76, 52 |
| Stone grey    | pedestals, tools            | 160, 155, 150 |
| Stone dark    | stone outline               | 90, 88, 85 |
| Grass         | garden floor base           | 48, 80, 44 |
| Grass light   | garden floor speckle        | 70, 110, 60 |
| Foliage mid   | leaves / bushes             | 75, 120, 65 |
| Foliage light | leaf highlight              | 95, 140, 75 |
| Foliage dark  | leaf outline                | 45, 75, 40 |
| Terracotta    | standard pot                | 150, 90, 55 |
| Celadon       | fancy pot glaze             | 60, 110, 105 |
| Soil          | potting soil, beds          | 48, 34, 24 |
| Player shirt  | character accent            | 80, 110, 160 |
| Skin          | character                   | 200, 150, 110 |
| Brass         | handles, accents            | 170, 140, 70 |

Per-room mood: **shed** = warm browns, lamplit-cozy, wood + brass. **garden** =
cooler greens, daylight, wood fence + soil beds.

---

## Asset slots

Origin = the sprite's anchor at its placed (x, y). "TL" = top-left (0,0),
"centre" = (w/2, h/2), "base" = bottom-centre.

### Floors
Tileable 32×32 tiles, tiled across the room behind everything.

| Sprite            | Size  | Origin | Frames | Notes |
|-------------------|-------|--------|--------|-------|
| `spr_floor_shed`  | 32×32 | TL     | 1–3    | Wood planks, seamless on all edges. 2–3 frames = subtle plank variation, scattered randomly. Base ~104,76,52. |
| `spr_floor_garden`| 32×32 | TL     | 1–3    | Grass, seamless. Base ~48,80,44 with a few lighter blades; keep busy-ness low so plants read on top. |

### Structure
| Sprite        | Size  | Origin | Frames | Notes |
|---------------|-------|--------|--------|-------|
| `spr_wall`    | 32×32 | TL     | 1      | Shed wall panel — seamless horizontally & vertically (it tiles into a border). Wood planks, darker than floor. |
| `spr_fence`   | 32×32 | TL     | 1      | Garden boundary — a low wooden fence segment, seamless horizontally. Transparent above the rail so grass shows. |
| `spr_door`    | 32×32 | TL     | 1      | Reads as a door set in a wall; bottom-aligned within the tile. |

### Props
Baseline is a clean 32×32 drop-in (origin **centre 16,16**, matching the
objects' placement).

| Sprite               | Size  | Origin | Frames | Notes |
|----------------------|-------|--------|--------|-------|
| `spr_workbench`      | 32×32 | centre | 1      | Wooden bench with a clay slab + mallet. Reads as "make pots here". |
| `spr_planting_table` | 32×32 | centre | 1      | Lighter sanded table; soil mound one side, empty pot the other. |
| `spr_shop_kiosk`     | 32×32 | centre | 1      | Small market stall / counter with a brass bell or coin motif. |
| `spr_pedestal`       | 32×32 | centre | 1      | Stone/wood display stand, narrow column + base. Should pair with the 3D pot look (terracotta/celadon families). |

### Character
| Sprite       | Size  | Origin | Frames | Notes |
|--------------|-------|--------|--------|-------|
| `spr_player` | 32×32 | centre | 4 or 16 | Minimum: 4 frames = idle facing **down, up, left, right** (in that frame order). Nicer: 16 = 4 walk frames × those 4 directions (rows: down, up, left, right). Shirt ~80,110,160, skin ~200,150,110. The Draw reads `facing`. |

### Plants
| Sprite             | Size  | Origin | Frames | Notes |
|--------------------|-------|--------|--------|-------|
| `spr_source_plant` | 48×48 | centre (24,24) | 3 | Wild bushes the player takes cuttings from. **3 frames = juniper, maple, pine** (frame index can be set per instance from `species_key`). Distinct silhouettes/greens; juniper bluish-green, maple rounder/brighter, pine spiky. |

### Trees & 3D (data-driven — mostly NOT static sprites)
The world tree sprite and the 3D mesh are **generated from each tree's
morphology**, so don't author a static tree. In scope here:

| Sprite         | Size    | Origin | Notes |
|----------------|---------|--------|-------|
| `spr_foliage`  | 128×128 | centre | 3D leaf-cluster texture (alpha-tested): a small clump of leaves on transparent; vertex colour tints it per species/season, so author it **near-white/neutral green** with alpha shape, not strongly coloured. |
| `spr_tree_small` | 48×48 | centre (24,24) | Unused: the world tree is drawn procedurally. |

---

## Import workflow (GM IDE)

For each PNG: **Right-click Sprites → Create → Sprite → Import** the PNG (or
Import Strip for multi-frame), then:
1. Confirm **Size** matches the table.
2. Set **Origin** to the value in the table (Middle Centre for "centre",
   Top Left for "TL"; "base" = X centre, Y = height−1).
3. Name the sprite exactly as in the table.
4. For multi-frame sprites, frame order matters (see Notes).

Each object has its sprite assigned in the IDE (it gives the collision box,
origin and `sprite_height`), and its `Draw` event draws that sprite by name
with `draw_sprite_ext` over a drop shadow.

## Out of scope
- Static tree sprites (procedural/data-driven — see above).
- Pot visuals: drawn in code (terracotta/celadon with depth + feet).
- Audio.

---

# Decor pass

Decor that makes the cozy shed feel lived-in (shelves, garden tools, stray
pots, a window) and the garden's vertical fence. **Same constraints + palette
as above** (1:1, RGBA, transparent, hard pixel edges, no AA, palette table).

**Unlike the props above, these are drawn UNSCALED (1×).** The 32×32 props are
drawn at 1.5× in-game (~48px on screen); to keep the decor crisp, it is authored
at the **on-screen size directly** (the sizes below already match that ~48px
scale) and drawn 1:1. So design at the listed pixel
dimensions, chunky, readable at 2–4× window scaling.

**View/style:** match the existing props — slightly oblique top-down (you see the
top *and* a bit of the front face, like the workbench's tabletop + legs). Warm,
lamplit-cozy shed mood.

**Origin = `base-centre`** for everything except the fence: X = width/2,
Y = height−1 (bottom-centre), so each piece anchors at its floor/wall contact
point (the drop shadow is drawn in code). The fence is top-left + tileable.

### Shed decor

| Sprite | Size | Origin | Frames | Notes |
|--------|------|--------|--------|-------|
| `spr_shelf` | 56×44 | base-centre | 1 | Wall shelf/rack against the wall: wooden frame, 2 shelves holding a few small terracotta pots + a tin/jar. Front-facing oblique; sits against the top wall. |
| `spr_tools` | 36×52 | base-centre | 1 | A rake + spade + broom leaning together against the wall. Tall, narrow; wood handles, metal/brush heads, brass accents ok. |
| `spr_watering_can` | 32×30 | base-centre | 1 | Galvanised/brass watering can on the floor — body, handle, spout + rose. |
| `spr_pot_stack` | 40×40 | base-centre | 1 | Casual clutter: 2–3 empty terracotta pots, one short stack + one tipped on its side. Terracotta family. |
| `spr_sack` | 32×34 | base-centre | 1 | Slumped burlap/hessian sack of soil, open top with a little spilled soil at the base. |
| `spr_window` | 56×24 | base-centre | 1 | A window set into the wall — wooden frame + sill + pale daylight glass. Reads as letting light into the shed; sits on the top wall. |

### Garden

| Sprite | Size | Origin | Frames | Notes |
|--------|------|--------|--------|-------|
| `spr_fence_v` | 32×32 | Top Left | 1 | **Vertical** fence segment — rails running up–down with a post, **seamless top & bottom** so a left/right run reads as one continuous fence (`spr_fence`'s horizontal ends would break a side run). Same palette/weight as `spr_fence`; transparent left & right of the rails so grass shows through. |

### Where they are drawn
- Floor clutter (`spr_watering_can`, `spr_pot_stack`, `spr_sack`) + leaning `spr_tools`: in the shed's empty wall/floor corners, each with a small shadow.
- `spr_shelf` + `spr_window`: on the top wall.
- `spr_fence_v`: `obj_wall` draws it on the garden's left/right edges (vertical runs), and `spr_fence` on the top/bottom (horizontal runs).
