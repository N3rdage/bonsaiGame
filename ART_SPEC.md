# ART_SPEC.md

The art-asset spec for the world makeover's **Phase 4 (art pass)**. It defines
every sprite slot — size, origin, frames, naming — plus a shared palette, so PNGs
generated in Claude desktop drop straight into GameMaker and get wired in cleanly.

**Workflow:** Claude writes this spec → Drew generates PNGs in Claude desktop to
match it → Drew imports them as sprites in the GM IDE (sizes/origins below) →
Claude wires each into its object's Draw, keeping the current procedural drawing
as a fallback so nothing ever renders blank. Assets land in small groups (see
"Wiring order").

Until real art exists, the game keeps its current procedural look — this is
additive, not a rewrite.

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

### Floors (new — currently flat background colour)
Tileable 32×32 tiles; I'll tile them across the room behind everything.

| Sprite            | Size  | Origin | Frames | Notes |
|-------------------|-------|--------|--------|-------|
| `spr_floor_shed`  | 32×32 | TL     | 1–3    | Wood planks, seamless on all edges. 2–3 frames = subtle plank variation, scattered randomly. Base ~104,76,52. |
| `spr_floor_garden`| 32×32 | TL     | 1–3    | Grass, seamless. Base ~48,80,44 with a few lighter blades; keep busy-ness low so plants read on top. |

### Structure (replace placeholders / new)
| Sprite        | Size  | Origin | Frames | Notes |
|---------------|-------|--------|--------|-------|
| `spr_wall`    | 32×32 | TL     | 1      | Replaces placeholder. Shed wall panel — seamless horizontally & vertically (it tiles into a border). Wood planks, darker than floor. |
| `spr_fence`   | 32×32 | TL     | 1      | New. Garden boundary — a low wooden fence segment, seamless horizontally. Transparent above the rail so grass shows. |
| `spr_door`    | 32×32 | TL     | 1      | Replaces placeholder. Reads as a door set in a wall; bottom-aligned within the tile. |

### Props (new — all four currently share `spr_interactable` + procedural draw)
Baseline is a clean 32×32 drop-in (origin **centre 16,16**, matching current
placement). If you'd rather a taller silhouette, see the note under the table.

| Sprite               | Size  | Origin | Frames | Notes |
|----------------------|-------|--------|--------|-------|
| `spr_workbench`      | 32×32 | centre | 1      | Wooden bench with a clay slab + mallet. Reads as "make pots here". |
| `spr_planting_table` | 32×32 | centre | 1      | Lighter sanded table; soil mound one side, empty pot the other. |
| `spr_shop_kiosk`     | 32×32 | centre | 1      | Small market stall / counter with a brass bell or coin motif. |
| `spr_pedestal`       | 32×32 | centre | 1      | Stone/wood display stand, narrow column + base. Should pair with the 3D pot look (terracotta/celadon families). |

> **Optional taller props:** if a 32×32 footprint feels cramped, author these at
> **32×48** with origin **base (16, 47)** and tell me — I'll switch the draw to
> bottom-anchored so they stand on the floor with the same tile footprint. Pick
> one approach per prop; don't mix within a prop.

### Character
| Sprite       | Size  | Origin | Frames | Notes |
|--------------|-------|--------|--------|-------|
| `spr_player` | 32×32 | centre | 4 or 16 | Replaces placeholder. Minimum: 4 frames = idle facing **down, up, left, right** (in that frame order). Nicer: 16 = 4 walk frames × those 4 directions (rows: down, up, left, right). Shirt ~80,110,160, skin ~200,150,110. The Draw reads `facing`. |

### Plants (replace placeholder)
| Sprite             | Size  | Origin | Frames | Notes |
|--------------------|-------|--------|--------|-------|
| `spr_source_plant` | 48×48 | centre (24,24) | 3 | Wild bushes the player takes cuttings from. **3 frames = juniper, maple, pine** (frame index can be set per instance from `species_key`). Distinct silhouettes/greens; juniper bluish-green, maple rounder/brighter, pine spiky. |

### Trees & 3D (data-driven — mostly NOT static sprites)
The world tree sprite and the 3D mesh are **generated from each tree's
morphology**, so don't author a static tree. In scope here:

| Sprite         | Size    | Origin | Notes |
|----------------|---------|--------|-------|
| `spr_foliage`  | 128×128 | centre | 3D leaf-cluster texture (alpha-tested). Replaces the placeholder white blobs — a small clump of leaves on transparent; vertex colour tints it per species/season, so author it **near-white/neutral green** with alpha shape, not strongly coloured. |
| `spr_tree_small` | 48×48 | centre (24,24) | Currently unused by the procedural world tree. Leave as-is / low priority. |

Optional later: a bark texture for the 3D trunk (currently vertex-coloured).

---

## Import workflow (GM IDE)

For each PNG: **Right-click Sprites → Create → Sprite → Import** the PNG (or
Import Strip for multi-frame), then:
1. Confirm **Size** matches the table.
2. Set **Origin** to the value in the table (Middle Centre for "centre",
   Top Left for "TL"; "base" = X centre, Y = height−1).
3. Name the sprite exactly as in the table.
4. For multi-frame sprites, frame order matters (see Notes).

You don't need to assign sprites to objects — leave that to the wiring step.

---

## Wiring plan (Claude)

I replace each object's procedural `Draw` with the sprite, keeping the procedural
code as a **fallback** (drawn when the real sprite is absent / still the
placeholder), so the game always renders. Floors get tiled across the room behind
everything. Each group is a small PR under the usual loop:

1. **Floors + structure** — `spr_floor_*`, `spr_wall`, `spr_fence`, `spr_door`.
2. **Props** — workbench, planting table, shop, pedestal.
3. **Character** — player (hook up `facing` → frame/row; add walk animation if 16-frame).
4. **Plants** — source plants (frame per species), `spr_foliage` for the 3D view.

## Out of scope (for now)
- Static tree sprites (procedural/data-driven — see above).
- Pot visuals: already done in code (terracotta/celadon with depth + feet).
- Audio (Suno) — separate pass, TODO #7.
