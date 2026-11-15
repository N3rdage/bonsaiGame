# Design notes

Room scale, layout and visual conventions, from the GameMaker prototype
(`archive/gamemaker/`), whose sprites and drawing the web build ports.

## Visual style

The prototype draws its world in `Draw_0.gml` events; see
`obj_player_2d/Draw_0.gml` for the canonical pattern: drop shadow → body →
smaller details.

Common ingredients:

- **Drop shadows.** Squashed black ellipses at ~25% alpha just below the
  object's footprint. Sells "this is sitting on the floor" cheaply.
- **Outline pass.** A second `draw_*` call with `outline = true` in a
  darker shade of the fill colour. Gives shapes weight without needing
  a real bevel.
- **Muted palette.** Wood browns (`120,85,55` mid; `70,45,25` dark),
  stone greys (`160,155,150`), leafy greens (`70-130, 100-130, 60-75`),
  brass accents for handles. The player's shirt is `80,110,160` blue.

## Tile grid

32 pixels = one tile. Walls, doors, and the table-shaped objects are all
32×32 sprites. Source plants and tree sprites are 48×48 (centered) so
they sit a half-tile larger than the standard grid — they're meant to
read as "things in the room," not "wall fixtures."

## Property layout

The property is site plan B3 ([the plan](docs/site-plan/plan-b3-hallway-kitchen.png)), and
[`docs/site-plan/README.md`](docs/site-plan/README.md) is its canon: the room table and the
sixteen-row door and gate table. The house row is the lounge (with its open-plan kitchen),
the hallway and the study, with the shed behind the lounge, the closed garage to the west,
the front garden and the road to the north, and the back garden's passage, notch and lawn,
with the freestanding greenhouse in the lawn, to the east and south. Every door leads to
its partner in the opposite wall, and the doors make a loop: in at the front door, west
through the lounge and the shed to the back garden or east through the study's glazed
doors, then up the passage and through the side gate to the front garden.

## Scale reference

| Thing               | Pixel size       | Notes                                |
|---------------------|------------------|--------------------------------------|
| Tile                | 32×32            | All grid alignment is on this        |
| Player              | ~22 tall         | Body circle r=10 + head r=7          |
| Wall                | 32×32            | Tiled, top-left origin               |
| Door                | 32×32            | Top-left origin                      |
| Workbench           | 32×32            | Centred origin                       |
| Planting table      | 32×32            | Centred origin                       |
| Pedestal            | 32×32 sprite     | Visual ~26 tall + label below        |
| Source plant        | 48×48            | Centred origin; reads taller (~36)   |
| Tree sprite (world) | 48×48            | Centred; pot + foliage dome          |

Anything new in the same family (more furniture, more natural elements)
should fit one of these footprints unless there's a reason to break it.
