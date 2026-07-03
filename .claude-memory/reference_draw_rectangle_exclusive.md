---
name: reference-draw-rectangle-exclusive
description: GameMaker draw_rectangle far edge is exclusive; matters for pixel-precise procedural drawing
metadata: 
  node_type: memory
  type: reference
  originSessionId: 3309c839-d00f-45f0-8cf0-9b9d84cb074a
---

In this project's GML, `draw_rectangle(x0, y0, x1, y1, false)` fills the region
`[x0, x1) x [y0, y1)` — the far edge (x1/y1) is **exclusive**. So the filled
size is `(x1-x0) x (y1-y0)`, not +1. Confirmed by the codebase convention
(`scr_ui` draws a button of width `_w` as `draw_rectangle(_x, _y, _x+_w, ...)`).

Consequences for pixel-precise procedural art (e.g. the garden fence corners in
`obj_game_controller` Draw End):
- A rail covering pixel rows y..y+2 (3px) needs `y1 = y+3`. Using `y+2` yields a
  2px bar; a 1px edge line needs `draw_rectangle(x0, y, x1, y+1)` (NOT y..y — that
  is zero height and draws nothing).
- To butt against the neighbouring 32px tile at pixel 32, a leg must reach
  `x1 = 32` (covers through pixel 31). Reaching only 31 leaves a 1px gap — this
  manifested as corners connecting on their low (0) edges but not their high
  edges. See [[reference-pil-pixel-preview]] for how it was diagnosed.
