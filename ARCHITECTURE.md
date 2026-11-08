# Architecture

How the web project is organised, the decisions behind it, and the invariants carried over from the GameMaker prototype. For why the rewrite happened, see `docs/ADR-001-typescript-rewrite.md`. For the prototype's own architecture, see `archive/gamemaker/ARCHITECTURE.md`. For deliberately-unsimulated behaviour, see `SIMPLIFICATIONS.md`.

This document describes the project as it stands after slice R4a-1 (simulation done; the 3D viewer done in R3; the world shell: the shed as a placeholder room, player movement, the HUD badge and the viewer opened from the room) and the shape the port is heading toward: the rest of the Phaser rooms and UI (R4). Sections marked *planned* describe modules that do not exist yet.

## High-level shape

A single-page web game. Vite bundles TypeScript into a static site; Phaser renders the 2D world and UI to a canvas; Three.js renders the 3D tree viewer (pot, trunk, branch, foliage and wire meshes, hotspots, training actions and the pause-while-open lifecycle). The simulation is a set of pure TypeScript modules with no rendering dependency, so it runs identically in the browser, in unit tests, and in any future headless tool.

```
index.html
  src/main.ts            Phaser.Game config, PWA service-worker registration
  src/scenes/            Phaser scenes: boot, world (the shed, R4a-1), more rooms and UI (planned)
  src/world/             pure room data, player movement, input and HUD text for the world scene (R4a-1)
  src/sim/               pure simulation (done, R2): tree, geometry, growth, seasons, scoring, species, styles, training, save
  src/viewer/            Three.js tree viewer: scaffold, pot, trunk/branch/foliage/wire meshes done (R3a-c); hotspots and modes done (R3d-1); toolbar done (R3d-2a); actions done (R3d-2b); lifecycle done (R3d-2c)
  e2e/                   Playwright browser tests
  public/                static assets, PWA icons, staticwebapp.config.json
```

Logical resolution is 480x270, scaled to fit the window with pixel-art rendering. This replaces the prototype's room-sized viewports.

## Module rules

- **`src/sim/` imports nothing from Phaser, Three or the DOM.** It takes plain data in and returns plain data out. This is what makes the game testable without a browser and is the main thing the rewrite buys.
- **Scenes own rendering and input, never game rules.** A scene calls into `src/sim/` and draws the result. If a rule needs a number, the number lives in `src/sim/`.
- **Test hook.** Scenes publish a minimal read-only snapshot to `window.__bonsai` (type `BonsaiTestHook` in `src/vite-env.d.ts`). Browser tests assert on it instead of inspecting canvas pixels. It is additive: add fields, never repurpose them.

## Porting map

| Prototype (GML) | Web project | Status |
|---|---|---|
| `scr_seasons` | `src/sim/seasons.ts` | Done (R1) |
| `scr_math_3d` (vector helpers) | `src/sim/vec3.ts` | Done (R2) |
| `scr_bonsai_mesh` curve helpers (`trunk_frames`, `branch_point`, ...) | `src/sim/geometry.ts` | Done (R2) |
| `scr_bonsai_struct` | `src/sim/types.ts`, `src/sim/tree.ts` | Done (R2) |
| `scr_species_data`, `scr_styles_data` | `src/sim/species.ts`, `src/sim/styles.ts` | Done (R2) |
| `scr_scoring` | `src/sim/scoring.ts` | Done (R2) |
| `scr_growth` (daily tick, water, fertilise, repot, skip) | `src/sim/growth.ts` | Done (R2) |
| `scr_growth` (`advance_day_all_trees`, display revenue) | `src/sim/world.ts` | Done (R2) |
| `scr_training` | `src/sim/training.ts` | Done (R2) |
| `scr_inventory`, `scr_shop`, `scr_tutorial` | `src/sim/inventory.ts`, `src/sim/shop.ts`, `src/sim/tutorial.ts` | Done (R2) |
| `obj_game_controller` new-game bootstrap | `src/sim/state.ts` | Done (R2) |
| `scr_save_load` | `src/sim/save.ts` (v2 format + prototype importer), `src/platform/localStorageSaveStorage.ts` | Done (R2) |
| `scr_settings` | settings in `localStorage` | Planned (R4) |
| `scr_growth` `pot_palette`, `obj_viewer_3d` camera + pot | `src/viewer/potPalette.ts`, `potGeometry.ts`, `camera.ts`, `TreeViewer.ts` | Done (R3a) |
| `scr_bonsai_mesh` trunk and branch bark (`build_trunk`, `build_branch`, rings, `stitch_rings`) | `src/viewer/treeMesh.ts`, `meshArrays.ts` | Done (R3b) |
| `scr_bonsai_mesh` foliage (`add_foliage_cluster`, `_add_quad_xz`/`_yz`, the `build_branch` gate), `spr_foliage` | `src/viewer/foliageMesh.ts`, `seededRandom.ts`, `foliage.png` | Done (R3c-1) |
| `scr_bonsai_mesh` wire (`add_wire_coil`, `add_wire_anchor`, `build_oriented_ring`) | `src/viewer/treeMesh.ts` | Done (R3c-2) |
| `obj_viewer_3d` hotspots, modes, projection (Create_0 mode state, Step_0 strip and V/W/C/P, Draw_64 hotspots and direction helpers), `project_3d_to_screen` | `src/viewer/hotspots.ts`, `projection.ts`, `TreeViewer.ts` | Done (R3d-1) |
| `obj_viewer_3d` toolbar, wire sub-row, help text, wire-age caption (Draw_64), `ui_button`, `ui_toggle` | `src/viewer/toolbar.ts`, `ViewerToolbar.ts` | Done (R3d-2a) |
| `obj_viewer_3d` training actions and wire-removal modal (Draw_64 hotspot clicks, `_draw_wire_removal_modal`, Step_0 modal input) | `src/viewer/TreeViewer.ts`, `hotspots.ts`, `modal.ts`, `ViewerModal.ts` | Done (R3d-2b) |
| `obj_viewer_3d` lifecycle (`global.game_paused`, the controller Step's early exit, Exit and Escape) | `src/sim/types.ts`, `world.ts`, `save.ts`, `src/viewer/TreeViewer.ts` | Done (R3d-2c) |
| `obj_player_2d` movement, `rm_shed` layout, controller HUD badge (Draw_64) | `src/world/player.ts`, `input.ts`, `shedRoom.ts`, `hud.ts`, `src/scenes/WorldScene.ts` | Done (R4a-1) |
| `obj_interactable`, other rooms, `scr_weather` | `src/world/`, `src/scenes/` | Planned (R4) |
| `obj_ui_*`, `scr_ui`, `scr_title_hero` | `src/scenes/ui/` | Planned (R4) |

### How the simulation is shaped

- `src/sim/types.ts` is the whole data model: plain interfaces, JSON-serialisable, no methods. `BonsaiTree.revision` replaces the prototype's `mesh_dirty` flag; every morphology mutation goes through `markDirty` or `addBranch`, and renderers rebuild when the number changes.
- `GameState` carries what the prototype kept in globals (day, money, inventory, trees, next id, tutorial step). Simulation functions take it explicitly and mutate it in place; that is what makes them testable.
- Randomness is injected: `treeDailyTick(tree, state, isolated, rng)` and `advanceDayAllTrees(state, days, rng)` default to `Math.random`, tests pass a constant.
- The prototype's numbers are canon unless a backlog decision says otherwise. Departures so far: the wire safe-bend limit in `training.ts` reads branch girth in centimetres (`60 - (girth / 10) * 20`), where the GML applied the same constants to millimetres and so made every bend unsafe (backlog #27, option B). Pruning also renumbers wire and clip history ids, which the prototype left pointing at the wrong branch.
- Saves are versioned. `save.ts` writes version 2 (camelCase) and reads both version 2 and the prototype's version 1 through `importPrototypeSave`, which tolerates the trailing NUL byte the prototype wrote, GameMaker's float-typed integers, and the fields older saves lack. Two real prototype saves live in `src/sim/__fixtures__/` as importer tests. Storage is behind a three-method `SaveStorage` interface with an in-memory implementation for tests and a `localStorage` one under `src/platform/`.

### How the scenes are shaped

- `BootScene` (`boot`) is the entry: it creates a new game (`createNewGameState`), reads the viewer's `?tree=` and `?season=` test parameters and the hook's fixed fields, and starts `WorldScene` (`world`) with them. The world creates the `TreeViewer`, owns it until shutdown and publishes the test hook.
- **Halved coordinates.** Prototype rooms are 960x540 and the logical canvas is 480x270, so every prototype position and distance halves (`fromPrototype` in `src/world/shedRoom.ts`, pinned in its tests). The player starts at (240, 135); the clamp is 4 px from the edges; speed is 1.25 px per step.
- The room, movement and HUD are pure modules in `src/world/`: `shedRoom.ts` (room size, props at their halved `rm_shed` positions, edge walls 2 px thick, thinner than the clamp margin, so the clamp holds the player in at the edges as in Step_0 and wall collision is for interior walls), `player.ts` (`stepPlayer`: input clamped to -1..1, normalised above length 1, per-axis wall collision, clamp, facing with the 0.5 thresholds, the 0.14 walk-animation counter), `input.ts` (keys to input, the touch joystick, the fixed 60 Hz `fixedSteps` accumulator, at most 5 steps a frame) and `hud.ts` (the badge text, e.g. `Spring 1/28  |  Day 0  |  $100`; the raw day is shown, as in the prototype).
- Placeholder art: the floor (the room's background colour), walls and labelled props are Phaser rectangles and monospace text; the player is a 16x24 rectangle with its origin at its feet, depth-sorted by y against the props' bottom edges.
- Input: arrows and WASD through Phaser's keyboard plugin, without key capture. On touch (or a mouse), pressing anywhere on the canvas except a button sets a joystick origin; the drag gives the input, with a 4 px dead zone, saturating at 24 px.
- The viewer opens from the room with V (a keydown event) or the `View tree (V)` button, on the first tree in `state.trees` (or the `?tree=` fixture) in `seasonForDay(state.day)` (or `?season=`). While it is open the world ignores its keys and pointers, does not step and hides the HUD; the viewer's Escape and Exit close it and the world resumes.
- Hook fields the world adds: `scene` (`world`), `room` (`shed`), `player` (`x`, `y`, `facing`), `hud` (the badge text) and `frames` (fixed steps run so far). It republishes after every frame that stepped and on viewer render and close.

### How the viewer is shaped

- A separate WebGL canvas (`#viewer`) sits fixed over the Phaser canvas and is shown only while the viewer is open.
- The camera is plain yaw/pitch/distance data in the pure `camera.ts`; the world is z-up, as in the prototype.
- Handedness: the prototype's look-at was left-handed, so the viewer mirrors the world's y axis (`toViewerSpace` in `camera.ts`, a y-flipped mesh group in `TreeViewer.ts`). Screen-right at yaw 45 is world (-1,-1,0), as in the prototype. Hotspot projection goes through the same helper.
- Rendering is on demand (one frame per open, resize or input change), never a loop, without MSAA, so a still view is a deterministic screenshot.
- Pure array builders (`potGeometry.ts`) feed Three.js `BufferGeometry`, so mesh shape is unit-tested in Node. `threeCamera.ts` uses only Three's math classes and is unit-tested too; only `TreeViewer.ts` needs WebGL.
- The tree mesh comes from the pure `treeMesh.ts`, which reads shape only from `trunkFrames`, `branchPoint` and the `*FrameAt` lookups. `TreeViewer.ts` keeps it as one `Mesh` in the mirrored group beside the pot and rebuilds it before a render only when `tree.revision` has changed since the last build.
- Wire is part of the bark mesh, as in the prototype: right after a wired branch's bark, `treeMesh.ts` appends a copper helix around the branch and a 1.5-turn anchor wrap around the trunk at its base, ending on the branch's side. Every sample takes its frame from `branchFrameAt` or `trunkFrameAt`, so the coil follows the bent branch and the anchor a leaning trunk, and each tube ring is an oriented ring perpendicular to the helix tangent. Gauge and pitch scale with branch girth and bend.
- Foliage comes from the pure `foliageMesh.ts`: a seeded cluster of crossed, textured quads at each branch tip above 30% of trunk height, tinted by the species' seasonal colour through the vertex colour. The seed is `tree.id * 1000 + branch.id` (mulberry32 in `seededRandom.ts`), so rebuilds never reroll the leaves. `TreeViewer.ts` draws it as a second `Mesh` with its own material (sprite map, alpha test 0.5, no culling).
- The season is an input, never derived: `open(tree, season, state)` and `setSeason(season)`. The viewer reads the game state's day only for wire-age captions, never for the season. Foliage rebuilds before a render when `tree.revision` or the season differs from what it was built with; bark rebuilds on `revision` only.
- Colour space: the renderer outputs `LinearSRGBColorSpace` so palette bytes pass through untouched, and the foliage sprite (`foliage.png`, the prototype's `spr_foliage` copied byte for byte) loads with `NoColorSpace`, nearest filtering and no mipmaps for the same reason. The map is bound when it finishes loading; `foliageReady` on the test hook says when.
- Interaction state is plain data in the pure `hotspots.ts`: mode (`view`, `wire`, `clip`, `prune`, keys V/W/C/P), wire action, bend direction and the wired/unwired filters, reset on every `open`. `hotspotWorldPoints(tree, ui)` gives the hotspots for that state in world space (branch ones at 70% along each branch, trunk ones at 20-80% of the trunk in wire + bend) with the prototype's filters, labels and colours. Nothing in it mutates the tree.
- Hotspots are a DOM overlay (`#viewer-hotspots`, one `button.hotspot` each), not drawn in WebGL: tests read their positions from the hook and the DOM, they get hover and focus for free, and `e2e/screenshot.css` hides them so baselines stay the WebGL frame. `TreeViewer.ts` lays them out again after every rendered frame, so they follow the camera. Each button's hit circle is the prototype's 16 px radius. The overlay sits above the canvas, so a press on a hotspot never starts a camera drag.
- Clicking a hotspot acts through `src/sim/training.ts`: clip mode calls `clipBranch(tree, state, id, 1)`, prune mode `pruneBranch`, wire + bend `applyWire` with the targets from `branchBendTarget` (one 15 degree step on `bend` for left/right or `bendV` for up/down, its sign from `branchBendSign` with the hotspots' own projection), and a trunk hotspot `wireTrunk` at `t * trunk height` toward `trunkBendWorldAngle(bendDir, yaw)`. Wire + remove opens the confirmation (`#viewer-modal`: the pure `modal.ts` holds the prototype's sizes, colours and strings, `ViewerModal.ts` draws it); its Remove calls `removeWire`. While it is open its dim takes every pointer event, the toolbar and hotspots are inert, Escape closes the modal (not the viewer) and other keys do nothing. Hotspot clicks are ignored while a frame is pending, so a second click before the buttons are rebuilt cannot hit a branch a prune just renumbered. Apart from `state.paused` (below), the viewer never writes the tree or state itself: the sim functions do, consuming wire from the inventory and refusing when there is none (the help line then reads `(out)`); a successful action bumps `tree.revision`, so the next frame rebuilds the mesh and the toolbar.
- The toolbar is DOM too: `#viewer-toolbar` (tree info, View/Wire/Clip/Prune and Exit buttons, and in wire mode the action, bend-direction and show sub-row) and `#viewer-help` (the bottom help lines, with the wire stock in wire mode). The pure `toolbar.ts` builds a plain-data model from the tree, interaction state, wire stock and day, holds the prototype's sizes, colours and strings, and gives the wire-age caption under wired hotspots; `ViewerToolbar.ts` draws it after every frame (skipping an unchanged model) and reports clicks to `TreeViewer`'s setters and `close()`. `open(tree, season, state)` takes the `GameState` so it can read the wire stock and day and pass it to the training functions. Mode and camera keys ignore Ctrl, Meta and Alt chords; Escape closes the viewer unless the confirmation is open.
- The viewer pauses the simulation, as the prototype did with `global.game_paused`: `open` sets `state.paused = true` (only once WebGL is available) and `close` (Escape, the Exit button, or the owner) sets it back to false on the state it was opened with. `advanceDayAllTrees` is a no-op while paused. The flag is transient: `serializeState` never writes it and every load starts unpaused. `paused` on the test hook mirrors it.
- `projection.ts` maps a world point to CSS px with Three's math classes only (unit-tested in Node). It goes through `toViewerSpace`, as the handedness rule demands, and drops points behind the camera or outside the near/far range.
- The top strip (60 px, 110 px in wire mode, the prototype's toolbar and wire sub-row) never starts a drag; on a phone the DOM toolbar wraps taller and takes the press itself. Wheel zoom works anywhere.
- The direction helpers `trunkBendWorldAngle` (screen direction to a world bend angle at the current yaw) and `branchBendSign` (which bend sign moves a branch tip the chosen way on screen, found by projecting a perturbed copy) are pure and take the projector as an argument; the wire actions use them.
- Screenshot tests open fixture trees (`viewerFixtures.ts`, grown through `src/sim` actions) with a `?tree=<cutting|bent|cascade|maple|wired|fancy>` URL parameter, and choose the viewer's season with `?season=<spring|summer|autumn|winter>` (default: the game's season), both read by the boot scene; the tests open the viewer with V in the world. The parameters stay until R4's interactables give a real way to pick a tree.
- Screenshot baselines live in `e2e/__screenshots__/` and are regenerated on Linux with `npx playwright test --update-snapshots=all`.

## Invariants carried over

These were the hard-won rules of the prototype. Each names where it will live in the web project.

- **The tree model is the single source of truth.** 2D sprite and 3D mesh both derive from it. No display state stored separately from morphology. (`src/sim/tree.ts`)
- **Real units.** Trunk height in cm, girth in mm. Scaling for display happens in the viewer only. (`src/sim/`, `src/viewer/`)
- **Scoring is derived, never persisted.** Recompute on demand from morphology, style and vitality. (`src/sim/scoring.ts`)
- **Species and styles are data.** Keyed records, looked up by key; trees store the key. (`src/sim/species.ts`, `src/sim/styles.ts`)
- **Seasons are a pure function of the game day.** 28-day seasons, year starts in spring on day 1, nothing persisted. A new game starts on day 0 as the prototype did; `seasonForDay` treats it as day 1. (`src/sim/seasons.ts`)
- **All growth goes through the season multipliers.** `seasonGrowthMultiplier` returns 0 for dormancy; any path that adds height or girth must consult it. Fertilising refuses when it is 0. (`src/sim/seasons.ts`, `src/sim/growth.ts`)
- **Trunk and branch shape come from one curve helper each**, shared by the mesh builder, hotspot UI and style scorers, so what you see is what you score. (`src/sim/geometry.ts`)
- **Mesh rebuilds are triggered by a revision counter** bumped by every morphology mutation. (`tree.revision`, read by `src/viewer/`)
- **Consumables are really consumed.** Wire, fertiliser and pots are decremented by the action that uses them, gated on availability. (`src/sim/inventory.ts`)
- **Fertiliser is timed.** The item is consumed; the effect lives on the tree until a day threshold. (`src/sim/growth.ts`)
- **Location is a tagged string**, not an enum: a room name, `inventory`, `sold`, or `displayed:<pedestal-key>`. (`src/sim/tree.ts`)
- **Tutorial state is one step counter** advanced idempotently from gameplay call sites. (`src/sim/tutorial.ts`)
- **The 3D viewer pauses the simulation.** `state.paused` (the prototype's `global.game_paused`) is true while the viewer is open; the day advance does nothing while it is. Transient, never saved. (`src/sim/world.ts`, `src/viewer/TreeViewer.ts`)
- **Saves carry a version** and old shapes migrate forward. Prototype saves import one way. (`src/sim/save.ts`)

## Build, test, deploy

- **Gates** (`npm run check`, mirrored in `.github/workflows/ci.yml`): ESLint strict type-checked, Prettier, `tsc --noEmit`, Vitest with coverage, Vite build, then Playwright against the built output in desktop and mobile profiles.
- **PWA.** `vite-plugin-pwa` generates the manifest and a Workbox service worker that precaches the build. The precache size cap is raised because Phaser alone exceeds the default.
- **Hosting.** Azure Static Web Apps. `public/staticwebapp.config.json` sets SPA fallback, security headers and cache policy. `.github/workflows/deploy-swa.yml` deploys `main` to production and each PR to a preview environment, and removes the preview on close. The deploy token lives in a repository secret; without it the workflow verifies the build and skips.
- **Security.** Gitleaks on every push and PR; CodeQL via the repository's default setup; Dependabot for npm and Actions, grouped weekly.

## Known rough edges

- The world is a placeholder shed: rectangles for art and no interactables yet (R4b). It boots a real new game, you can walk around, and V opens the fully interactive 3D viewer on the starter tree (or a `?tree=` fixture), but nothing else drives the simulation yet.
- Prototype rough edges (cuttings for junipers only, fancy pots stat-only) carry over until the relevant backlog items are built.
