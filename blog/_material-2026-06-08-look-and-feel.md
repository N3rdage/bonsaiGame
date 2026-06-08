# Blog material — the look-and-feel pass (2026-06-08)

Raw material / notes for several posts from the day the prototype stopped looking
like a prototype: it got real sprite art, a font, resolution independence, and a
shed that feels like a shed. Captured while fresh — draft from these later. Blog
voice: first person, honest about the mistakes, technical-but-accessible.

Four candidate posts below (three "general", one for the `[Math]` sub-series).
They overlap; could also be braided into fewer, longer pieces.

Available screenshots (local, in `.debug/` — would need cropping + saving into
`blog/images/` for any post): the warehouse-vs-cozy shed before/after, the garbled
pedestal labels (font-scaling bug), the 1.5× props, the 3D fancy pot, the garden
fence, the windowed-doesn't-fit shots.

---

## 1. Art — "I wrote the spec; a different Claude drew the pictures"

**Thesis.** The whole game was drawn with primitives — rectangles, circles and
ellipses in `Draw` events. Getting real art wasn't about me learning to draw; it
was about writing a precise enough *spec* that the drawing could be handed off,
and a wiring layer that could swap procedural for sprite without the game ever
rendering blank.

**Hook.** For most of this project the "art" was a style guide that said: drop
shadow, body, a couple of details, muted palette. A workbench was three brown
rectangles and two circles. It had a charm, but it was placeholder charm.

**Beats / the story:**
- I wrote `ART_SPEC.md` — every sprite slot with pixel size, origin, frame count,
  a shared palette table, and the authoring constraints (1:1, nearest-neighbour,
  transparent, hard edges, no AA). The spec *is* the contract.
- The art came back from a different Claude (desktop app) as spec-exact PNGs
  **plus a regeneration toolkit** (`pixel.py` + a `PAL` palette dict as the single
  source of colour truth). Two drops: the main sprites, then a decor drop.
- The bridge principle: **procedural fallback.** Keep the old `Draw` code so a
  missing/odd asset never renders blank; light each sprite up as it lands.
- **The import gotchas** (caught by reading the `.yy` files, not by eye):
  multi-frame strips came in as a *single* frame — the 16-frame player walk sheet,
  the 3-frame floors, the 3-species bush — all flattened to frame 0. And the four
  props imported with **Top-Left** origins instead of **Middle-Centre**, which
  would have shifted them half a tile. Verified frame counts + origins from the
  project files before wiring; both needed re-importing.
- Wiring decisions worth a paragraph each: floors **tiled in code** (a multi-frame
  sprite on a GameMaker *background layer* animates → the whole floor would
  *flicker*); the player's 16 frames keyed off `facing * 4 + walk_index`; the
  source bush picking a frame per species.
- **Iteration with the human in the loop** (the honest part): props looked
  dwarfed → drawn at 1.5× → which is a non-integer scale, so the pixels go
  slightly uneven (a real tradeoff: crisp-but-32px vs matches-the-plants-but-1.5×).
  Player too small *and* zippy → 1.5× + drop move-speed 3.5→2.5 + slow the walk
  cadence. Each was a one-number tweak across a screenshot.
- The toolkit lives in `art/` now, so the assets are regenerable and the palette
  stays one dict.

**Why it's interesting:** the "two Claudes" division of labour (one specs + wires,
one draws), and that the leverage was *the spec + the fallback layer*, not the
pixels. Asset specs are underrated.

---

## 2. Fonts — "Why is my text shouting?"

**Thesis.** A debugging detective story about a feature that did nothing, twice,
for two completely different reasons — and what GameMaker's draw-state model
actually guarantees (less than you think).

**Hook.** After the resolution change, every label in the game was suddenly huge —
the default engine font, blown up. So I made a small font. It made *no difference
at all.*

**Beats:**
- New resolution → the default GameMaker font renders ~24px-equivalent on screen.
  Too loud, especially next to the now-cozy world.
- Created `fnt_main` (Bookman Old Style, size 9, anti-alias off). Wired
  `draw_set_font(fnt_main)` once at boot (controller + title). Ran it. **Nothing.**
- The wiring *looked* right. The trap: `draw_set_font` set in one event does **not
  reliably carry** to other instances' draws or across the Draw → Draw-GUI passes.
  "Set once globally" is a lie the docs let you believe.
- **Fix:** set the font at the top of *every* text-drawing event. The neat part:
  all ~15 modal panels route their text through one parent (`obj_ui_panel`'s Draw),
  so a single line there covers every dialog; plus the HUD, world labels, viewer
  toolbar, title.
- **The second mistake, same feature:** pedestal labels were a touch big, so I
  shrank just the world labels with `draw_text_transformed(..., 0.8, 0.8, 0)`. It
  *mangled* them — "From Cutting" came back as garbled pixels. Bitmap fonts don't
  survive sub-pixel scaling (especially with AA off). Reverted to native; the lever
  for "smaller" is the font's *size*, not a draw-time transform.

**Why it's interesting:** two failure modes (state not propagating; bitmap text
not scaling) that both present as "my change did nothing / looks wrong," and the
general lesson — know exactly what your engine's global draw state guarantees, and
never scale pixel text.

---

## 3. Scaling — "Making it fit a screen it's never seen"

**Thesis.** The game had no resolution layer at all. Adding one is less about
"support 4K" and more about deciding what a *logical pixel* is, then defending that
decision against the desktop, the taskbar, and your own assets' sizes.

**Hook.** On a big monitor the game was a tiny window in a corner: a 1366×768 room
painted 1:1 to a 1366×768 window, with the player a thumbnail in acres of floor.

**Beats:**
- Pick a **logical resolution** (960×540) and render everything to it, scaled up to
  the window. `display_set_gui_size(960,540)` made the *entire UI* resolution-
  independent for free — because the UI already read the mouse in GUI space
  (`device_mouse_x_to_gui`). A whole class of bug avoided by a past decision.
- The window-doesn't-fit bug (good, concrete): 2× = a 1080px-tall window, but on a
  1080p display the taskbar + title bar push the bottom off-screen; 3× is absurd.
  Fix: **clamp the window to the usable desktop**, shrinking uniformly to keep
  16:9 — `fit = min(1, availW/w, availH/h)`, with fractional reserves (`×0.98`,
  `×0.90`) so it holds across DPI.
- **Crispness:** nearest-neighbour (interpolation off). Fullscreen letterboxes to an
  exact 2× = perfectly crisp; a clamped windowed size is non-integer = slightly
  uneven. The tradeoff is unavoidable and worth naming.
- The thing that broke: the **3D viewer** projected its clickable hotspots using
  *window* dimensions, which used to equal the GUI but now don't — so the hotspots
  drifted off the branches until I pointed the projection at GUI space.
- **Scale as a feel decision, not just a number:** at 960×540 the shed read like a
  *warehouse*. The fix wasn't resolution, it was *level design* — inset the walls
  to a small interior, drop the surround to shadow, lay a rug, scale the actors to
  1.5×. "Cozy" is a layout, not a setting. (Strong before/after screenshot pair.)

**Why it's interesting:** logical vs physical pixels; the work-area gotcha nobody
warns you about; and the pivot from "make it fit" (math) to "make it feel right"
(design) in the same afternoon.

---

## 4. [Math] — "The screen is a stack of coordinate systems"

*Fits the `[Math]` sub-series (slug `-math-`). Connects back to the upside-down-tree
post and forward to the planned "Z-up in a y-down world (deeper cut)" entry.*

**Thesis.** A single rendered frame is a little pipeline of coordinate transforms.
Most "why is it in the wrong place / wrong size" bugs are one transform applied in
the wrong space. Here's the whole stack, anchored in this week's actual bugs.

**Beats / sections:**
- **Three spaces.** World/room coords (the 960×540 the game *thinks* in), GUI coords
  (also 960×540, but deliberately decoupled from the window), and window/physical
  pixels (1920×1080 and up). The view/camera matrix maps world→view; the GUI is its
  own fixed layer; the OS scales the result to the monitor.
- **Why a separate GUI space wins.** Pin UI to 960×540 and it never cares what the
  window is; map a click back with `device_mouse_x_to_gui`. One definition, every
  resolution.
- **The fit equation.** Window = N×(960,540); to keep it on-screen, scale by
  `min(1, availW/w, availH/h)` — the standard "contain" fit — which preserves the
  16:9 ratio because it's a single uniform factor. Letterboxing is the same idea
  from the other side.
- **Projection.** The 3D viewer turns a world point into a pixel: multiply by the
  view-projection matrix, divide by w (the perspective divide), map NDC `[-1,1]` to
  screen — and crucially map it to *GUI* extents, not window extents. Plus the z-up,
  negated-aspect lookat that the earlier post is all about (teaser to the deeper z-up
  math post).
- **Depth from position.** Top-down sorting is just `depth = -y`: things lower on
  screen draw in front. And the engine's draw *passes* (Begin / Draw / End / GUI)
  are layers you can exploit — the floor drawn in an early pass sits behind
  everything; a wall-mounted window drawn in Draw-End sits in front of the wall.
- **A tiny hash that earns its keep.** Tiling a 3-variant floor: pick each tile's
  variant with `(tx*7 + ty*13) mod 3`. It must be a *deterministic function of the
  tile's position* — use `random()` per frame and the whole floor shimmers. Two
  coprime-ish multipliers scatter the pattern so it doesn't stripe. A nice small
  "why this works."

**Why it's interesting:** ties the art + font + scaling work together under one
idea — *everything on screen is a coordinate transform* — and each section is a
real bug from this week, not a toy.

---

## Loose threads / smaller nuggets (could be asides or their own short posts)
- **Procedural fallback as a deployment pattern** — code that works before the
  asset exists and lights up when it arrives (the `asset_get_index` guard idea,
  even though we ended up referencing assets directly once imported).
- **Reading the `.yy` to trust the import** — catching the 1-frame strips and wrong
  origins from the project files, not the running game.
- **The recurring `rm_title.yy` diff** — the IDE re-normalising a trailing newline
  every run; committing it once to make it stop. Tiny, relatable.
