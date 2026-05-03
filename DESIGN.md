# Design notes

A working design doc for room scale, layout, and visual conventions.
Prototype-stage — none of this is locked in. Update as decisions land.

## Visual style

Everything in the world is drawn with primitives (rectangles, circles,
ellipses) in `Draw_0.gml`, not with sprite art. The placeholder sprites
stay assigned for collision boxes, origins, and `sprite_height`, but the
Draw events override what gets rendered. See `obj_player_2d/Draw_0.gml`
for the canonical pattern: drop shadow → body → smaller details.

Common ingredients:

- **Drop shadows.** Squashed black ellipses at ~25% alpha just below the
  object's footprint. Sells "this is sitting on the floor" cheaply.
- **Outline pass.** A second `draw_*` call with `outline = true` in a
  darker shade of the fill colour. Gives shapes weight without needing
  a real bevel.
- **Muted palette.** Wood browns (`120,85,55` mid; `70,45,25` dark),
  stone greys (`160,155,150`), leafy greens (`70-130, 100-130, 60-75`),
  brass accents for handles. The player's shirt is `80,110,160` blue.

Real pixel art is TODO #13 (Art pass) and only happens once systems are
locked. Until then: primitives, consistently styled.

## Tile grid

32 pixels = one tile. Walls, doors, and the table-shaped objects are all
32×32 sprites. Source plants and tree sprites are 48×48 (centered) so
they sit a half-tile larger than the standard grid — they're meant to
read as "things in the room," not "wall fixtures."

## Rooms

Both rooms are currently **1366×768** (≈42×24 tiles), matching the
default window size. There's no camera follow, so the whole room is
always on screen — every object should fit comfortably with margins.

### `rm_shed` — current layout problems

- All wall instances cluster along the bottom edge (`y=736`), making
  the shed read as "a strip of floor with a bottom wall." The other
  three sides are implicit/missing.
- Workbench, planting table, and the new pedestals cluster near the
  centre-top. The room feels half-empty.
- The door to the garden is at `(576, 704)` — bottom-right.

### `rm_shed` — suggested layout A: enclosed workshop

```
   1234567890123456789012345678901234567890 12
1  ########################################
2  #                                      #
3  #  [WB]   [PT]                         #
4  #                                      #
5  #                          (P1)  (P2)  #
6  #                                      #
7  #                                      #
8  #                                      #
9  #                                      #
10 #             @                        #
11 #                                      #
12 #                                      #
13 ########################  D  ###########
```

Legend: `#` wall (32×32), `[WB]` workbench, `[PT]` planting table,
`(P1)/(P2)` pedestals, `D` door to garden, `@` player spawn.

Adds top + side wall runs. Workshop tools on the left, display
pedestals on the right — the existing dichotomy made structural.

### `rm_shed` — suggested layout B: room with a window alcove

```
   1234567890123456789012345678901234567890 12
1  ########################################
2  #                  [   alcove    ]     #
3  #                  [             ]     #
4  #  [WB]   [PT]     [  (P1) (P2)  ]     #
5  #                  [             ]     #
6  #                  ###############     #
7  #                                      #
8  #              @                       #
9  #                                      #
10 ########################  D  ###########
```

Pedestals tucked into a recessed alcove top-centre — feels more
"display nook" than "shelves on a wall." More wall instances; a
bit more work in the room editor.

I'd default to **A** for simplicity. B is nicer once the visual style
sells the alcove (probably needs an indoor floor texture, future TODO #13).

### `rm_garden_back` — current layout

Source plants live in the garden; door back to shed. Existing layout
reads OK because plants are scattered organically and there's no need
for walls. Suggested tweak: a soft grass-green floor tint via a
`Draw GUI` rect on `obj_game_controller` that switches per-room — out
of scope for this PR, just noting.

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

## What's next

- **TODO #7 (House interiors)**: pedestals migrate to a lounge / display
  room. The shed becomes a workshop only. Floor texture per room becomes
  worth the effort once there are >2 rooms.
- **TODO #13 (Art pass)**: replace primitives with hand-drawn or
  generated pixel art under a coherent style guide. Until then, keep
  iterating on the primitive look — the constraint is good for the
  prototype's identity.
