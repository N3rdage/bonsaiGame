---
name: reference-pil-pixel-preview
description: Iterate on procedural GML pixel art by mirroring it in a throwaway PIL script and rendering a PNG
metadata: 
  node_type: memory
  type: reference
  originSessionId: 3309c839-d00f-45f0-8cf0-9b9d84cb074a
---

Claude can't run GameMaker, so to iterate on **procedurally-drawn** visuals
(fence corners, mesh-adjacent 2D draws, HUD bars) without a slow in-editor
round-trip: reimplement the exact draw logic in a standalone Python + PIL/numpy
script, render a scaled-up (NEAREST) PNG to the scratchpad, and Read it back.

Practicalities:
- `python -m pip install --quiet pillow numpy` (this machine's Python 3.14 lacked
  them; the `art/` pipeline expects them). `art/pixel.py` / `make_assets.py` /
  `make_decor.py` already reimplement the sprite generators — import them to draw
  true neighbour tiles around the thing under test.
- To be faithful, model GameMaker's exclusive `draw_rectangle` (fill `[x0,x1)`),
  not an inclusive pixel-set — see [[reference-draw-rectangle-exclusive]]. A
  render that looks right under inclusive fill can still be wrong in-game.
- Render several variants side-by-side to compare treatments, and reproduce a
  reported bug (e.g. "sprite still drawing under the corner") to confirm the
  diagnosis before fixing.

This is how the garden fence-corner mitre (TODO #11) was designed and the
draw_rectangle off-by-one was pinned down.
