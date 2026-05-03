# Architecture

This document describes how the code is organized, the key design decisions, and the common flows through the system. It's intended for anyone (including future you) who wants to add features, fix bugs, or understand why something is the way it is.

## High-level shape

The game is a **GameMaker** project, so it's organized into the standard GM asset categories: scripts (plain code), objects (behavior with events), sprites, and rooms. The project splits into two worlds that share data:

- **A 2D top-down world** where the player walks around rooms, interacts with objects, and opens UI panels. This is where the game's *activities* happen — taking cuttings, planting, interacting with trees.
- **A 3D viewer** that renders a single tree procedurally when the player clicks "Inspect 3D" on a tree. The viewer is an isolated room that takes over the screen while active.

Both worlds read from and write to the same underlying simulation: a list of `BonsaiTree` structs stored in `global.all_trees`. There is no separation between "display data" and "simulation data" — the tree struct IS the source of truth, and both the 2D sprite and the 3D mesh are derived from it.

## The tree is the star

The `BonsaiTree` struct (`scr_bonsai_struct`) is the most important data structure in the game. Almost every feature ultimately reads from or writes to a tree.

A tree struct carries:
- **Identity:** id, species key, origin (seed or cutting), player-chosen name
- **Lifecycle:** age, vitality, vigor, water level, last watered/fed days, location (which room it lives in)
- **Morphology:** trunk (height, girth, taper, movement points), an array of branches (each with angle, length, girth, bend, wired flag), foliage density
- **Training history:** arrays of every wire, clip, prune, and repot operation performed, with day-stamps
- **Cached 3D mesh** plus a dirty flag

The morphology fields are the recipe for the 3D mesh. Training operations mutate morphology and mark the mesh dirty. Growth ticks mutate morphology and mark the mesh dirty. The viewer rebuilds the mesh lazily when it's dirty. This keeps everything consistent without explicit synchronization code.

## Folder structure

```
scripts/
  scr_species_data       — Species definitions as static data
  scr_styles_data        — Bonsai style definitions and per-style scoring functions
  scr_inventory          — Player inventory (struct of key:count pairs)
  scr_bonsai_struct      — The BonsaiTree constructor
  scr_growth             — Daily tick simulation, water, time skip, display revenue
  scr_training           — Wire, clip, prune, trunk bend operations
  scr_scoring            — Aesthetic scoring of a tree; called on demand, never persisted
  scr_save_load          — JSON save/load of whole game state
  scr_math_3d            — Vector helpers, 3D vertex format, screen projection
  scr_bonsai_mesh        — Builds vertex buffers from tree morphology, including visible copper-wire coils on wired branches
  scr_ui                 — Button and bar drawing helpers
  scr_viewer             — Enter/exit the 3D viewer room

objects/
  obj_game_controller    — Persistent; initializes everything, drives time, handles save/load keys, draws money/day HUD
  obj_player_2d          — Persistent top-down player with movement and interaction
  obj_wall               — Static collision box for the player
  obj_door               — Interactable that transitions to another room

  obj_interactable       — Parent class for anything the player can press E on
  obj_workbench          — Makes a pot from clay
  obj_planting_table     — Opens the planting UI
  obj_source_plant       — Gives cuttings of a specific species
  obj_tree_sprite        — A tree as it appears in the 2D world (inspectable)
  obj_pedestal           — Display slot for a single tree (per-instance pedestal_key)

  obj_ui_panel              — Parent class for modal UI panels
  obj_ui_tree_inspector     — Shows a tree's stats, score, and action buttons
  obj_ui_tree_rename        — Modal text-input dialog for naming a tree
  obj_ui_tree_style_picker  — Modal style picker for setting a tree's target_style
  obj_ui_tree_sell_confirm  — Modal confirming sale of a tree for score-based coins
  obj_ui_pedestal           — Modal for placing/inspecting/removing a tree on a pedestal
  obj_ui_plant_cutting      — Picks a cutting and pot to create a new tree
  obj_ui_inventory          — Read-only inventory readout (I to toggle)

  obj_viewer_3d          — The 3D viewer itself, lives in rm_viewer_3d
  obj_hud                — Draws the "[E] Interact" prompt

rooms/
  rm_shed                — Starting room. Workbench, planting table, doors, tree sprites
  rm_garden_back         — Outdoor garden with source plants
  rm_viewer_3d           — Empty room dedicated to hosting obj_viewer_3d
  rm_greenhouse          — Placeholder, empty, reserved for future
```

## Key patterns

### Parent/child objects for polymorphism

GameMaker doesn't have classes in the traditional sense, but it does have object parenting — child objects inherit events from their parent. We use this for two hierarchies:

- **`obj_interactable` hierarchy.** Everything the player can press E on inherits from this. The parent's Create event sets default `prompt` and `on_interact`; children call `event_inherited()` and override those fields. The player finds the nearest `obj_interactable` instance and calls its `on_interact` function when E is pressed. This is how workbenches, doors, source plants, and tree sprites all share the same interaction plumbing.

- **`obj_ui_panel` hierarchy.** Modal UI panels inherit common behavior: auto-centering, input blocking, Escape-to-close, a shared draw chrome (background, title bar). Children override `draw_content` to render their specific contents. The player's step event checks `instance_exists(obj_ui_panel)` and suspends input while any panel is open.

### Interactables register themselves automatically

The player doesn't need a list of interactables. It calls `instance_nearest(x, y, obj_interactable)` every step. Because every interactable inherits from that parent, they're all found by that one call. Adding a new kind of interactable (a well, a shelf, a fridge) requires no changes to the player.

### UI buttons as single-expression calls

The `ui_button(x, y, w, h, label, enabled?)` function both draws a button AND returns true on the frame it was clicked. Panel code becomes:

```gml
if (ui_button(x, y, 100, 36, "Water")) {
    water_tree(tree);
}
```

This makes panels dramatically less verbose than the typical "draw in one place, check clicks in another" pattern. It works because `mouse_check_button_pressed` is true only on the exact frame of the click, so it's safe to check during a draw event.

### Data-driven species

`scr_species_data` defines species as a struct of structs:

```gml
global.species = {
    juniper: { display_name: "...", growth_rate: 1.0, ... },
    maple:   { display_name: "...", ... },
    ...
};
```

Trees store only the species *key* (e.g. `"juniper"`), and look up properties at need. Adding a new species means adding a struct entry and, eventually, an appropriate source plant in a room — no code changes elsewhere. Future: load this from JSON for modding.

### Deferred mesh rebuilds

`BonsaiTree.mesh_dirty` is set to true by any operation that changes morphology. The viewer calls `tree.get_mesh()` each frame, which checks the flag and rebuilds only when needed. Most frames, it returns the cached buffer for free. A training click during the viewer triggers a rebuild on the next frame.

### Tree location is a free-form string, not an enum

`BonsaiTree.location` started as a room name (`"shed"`, `"inventory"`) and the room-respawn loop in `obj_game_controller`'s Room Start filters by exact match: a tree gets a world sprite spawned only if its location equals the current room's tag. As features grew, this string took on extra encodings without changing the filter:

- `"sold"` — set by the sell modal as a soft-delete (the struct stays in `global.all_trees` for future sale-history features). The exact-match filter naturally skips these.
- `"displayed:<pedestal_key>"` — set when the player places a tree on a pedestal. The pedestal modal does the lookup by walking `global.all_trees` for matching strings; the exact-match world-sprite filter again skips these (no duplicate sprite).
- The display-revenue tick in `scr_growth` uses `string_pos("displayed:", ...) == 1` to find paying trees.

The pattern works because every reader knows the convention: location strings either name a room or carry a typed prefix. New verbs ("withered", "in_storage") would extend the same way.

### Scoring is derived, never persisted

`score_tree(_tree)` in `scr_scoring` returns a `{ total, breakdown }` struct on demand. Six MVP criteria (taper, proportion, branch count, angular spread, vertical spread, foliage) are weighted 1.0 each; an optional 7th style-conformance criterion (weight 1.5) calls into the chosen `global.styles[key].score(_tree)` if the style declares one. Each criterion's value is multiplied by the vitality fraction so a sickly tree caps the score. Save files don't store the score — recomputing from morphology means the score always reflects what the tree currently is, with no migration concerns when scoring rules change.

### Pedestals identify by stable key, not instance id

GameMaker instance IDs aren't stable across save/load or room reloads, so a displayed tree can't reference its pedestal by instance. Each `obj_pedestal` instance gets a `pedestal_key` set in the room editor's instance creation code (e.g. `pedestal_key = "shed_main";`). Trees on display set `tree.location = "displayed:" + pedestal_key`. On Room Start the pedestals are recreated as room instances; each one looks up its tree on demand via `get_displayed_tree()` (a O(n) scan over `global.all_trees`). No pedestal serialization, no instance id reasoning.

### Persistent player + Room Start positioning

The player is marked persistent, so a single instance survives all room transitions. Doors set `global.pending_player_x/y` before calling `room_goto`. The player's Room Start event applies those pending coordinates to itself and clears the globals. This is subtle but clean: each door knows where to drop the player in the destination room, and the player doesn't need per-room spawn logic.

### Global pause for the 3D viewer

When the viewer opens, `global.game_paused = true`. The game controller's step event exits early on pause, so tree growth doesn't happen while you're inspecting a tree. This gives inspection a contemplative, out-of-time feel — which matches the theme.

## Key flows

### Starting the game

1. GameMaker loads `rm_shed` (configured as the first room in the room order)
2. `obj_game_controller` is placed in the room. Its Create event fires:
   - Initializes globals (`game_day`, `money`, `all_trees`, etc.)
   - Calls `init_species()`, `init_inventory()`, `init_vertex_format()`
   - Creates a "Starter" juniper as a fully-populated `BonsaiTree` and pushes it onto `global.all_trees`
3. `obj_player_2d` is placed in the room; becomes the persistent player instance
4. `obj_game_controller`'s Room Start event fires, sees the room is `rm_shed`, and creates an `obj_tree_sprite` instance for every tree whose `location` is `"shed"`

### Taking a cutting

1. Player walks up to an `obj_source_plant` in the garden, presses E
2. The plant's `on_interact` checks its species, verifies cuttings are allowed for that species, and calls `inventory_add("cutting_" + species_key, 1)`
3. After 3 cuttings, the plant sets `regrow_day` to current day + 14 and refuses further interaction until then

### Planting a cutting

1. Player presses E on `obj_planting_table`
2. The table spawns an `obj_ui_plant_cutting` panel, setting its `spawn_room` and `spawn_x/y` to the target location
3. Panel lists every species with a cutting count > 0 and shows a "Select" button per species
4. Player selects a species; panel's `selected_species` is set
5. Player clicks "Plant Cutting." Panel's `do_plant` function:
   - Removes 1 pot and 1 cutting from inventory
   - Creates a new `BonsaiTree` via `new BonsaiTree(species_key, "cutting")`
   - The constructor applies cutting-specific initial morphology (8cm trunk, two small branches)
   - Sets the tree's `location = "shed"`
   - Pushes onto `global.all_trees`
   - Instantiates an `obj_tree_sprite` at `spawn_x, spawn_y` with `tree_index = len(all_trees) - 1`
   - Destroys itself

### Growing and training a tree

1. Player presses E on an `obj_tree_sprite`. The sprite's `on_interact` spawns an `obj_ui_tree_inspector` with `tree = global.all_trees[tree_index]`
2. Player clicks Water → `water_tree(tree)` bumps water level to 100
3. Player clicks Skip 7d → `skip_tree_time(tree, 7)` removes fertilizer from inventory and runs `tree_daily_tick(tree, true)` 7 times. The `true` flag means "isolated skip" — water doesn't decay during the skip because the player wasn't there to water the tree
4. Each tick: vitality responds to water, morphology grows slightly, a 10% × growth_multiplier chance to spawn a new branch, mesh marked dirty
5. Player clicks Clip → `clip_branch(tree, selected_branch, 1)` reduces branch length by 1cm, reduces foliage density, pushes an entry onto `clips_history`
6. Player clicks Inspect 3D → panel destroys itself, `enter_3d_viewer(tree)` saves return state and calls `room_goto(rm_viewer_3d)`

### Selling a tree

1. Player opens an inspector, clicks Sell. Inspector destroys itself and spawns `obj_ui_tree_sell_confirm` with `tree` set
2. The modal computes `tree_score = score_tree(tree)` and `coins = round(tree_score.total * 2)` once on open, so the displayed price matches the actual transaction
3. On confirm: `global.money += coins`, `tree.location = "sold"`, the matching `obj_tree_sprite` is destroyed by walking `obj_tree_sprite` and comparing struct identity against `global.all_trees[tree_index]`. The struct itself stays in `global.all_trees` (and in the next save file) for a future sale-history feature
4. The exact-match room-respawn filter naturally skips `"sold"` trees on future room loads

### Displaying a tree on a pedestal

1. Player presses E on an `obj_pedestal`. It spawns `obj_ui_pedestal` with `pedestal = self`
2. The modal calls `pedestal.get_displayed_tree()` to branch on state:
   - **Empty:** lists trees with `location == "shed"`. Player clicks a row to select, clicks Place. The tree's `location` is set to `"displayed:" + pedestal.pedestal_key` and the tree's world sprite is destroyed (struct-identity walk through `obj_tree_sprite`)
   - **Occupied:** shows the tree's name and a row of two buttons. Inspect destroys this modal and opens the tree inspector for the displayed tree. Remove sets `tree.location = "shed"` and spawns a fresh `obj_tree_sprite` next to the pedestal so the tree is reachable again immediately
3. Each game day, the display-revenue tick in `scr_growth.advance_day_all_trees` walks `global.all_trees`, finds entries with location starting `"displayed:"`, and adds `round(score_tree(tree).total * 0.1)` coins per displayed tree. A score-50 tree pays 5 coins/day; matching the sell payout (100 coins) takes 20 game days

### The 3D viewer

1. `obj_viewer_3d` instantiates in `rm_viewer_3d`. Its Create event grabs `global.viewer_target`, sets initial camera angles, calls `tree.get_mesh()` to pre-warm the mesh
2. Each frame:
   - Step event: process mouse drag for camera orbit, scroll wheel for zoom, keyboard shortcuts
   - Draw Begin event: build lookat and projection matrices, set the camera, enable z-buffer
   - Draw event: draw the pedestal, draw the tree mesh via `vertex_submit`
   - Draw End event: disable z-buffer, restore identity world matrix
   - Draw GUI event: draw the toolbar, tree info, and (if in clip/prune/wire mode) branch hotspot circles
3. Hotspots: for each branch, compute a world-space midpoint via the shared `branch_point(tree, branch, t)` helper, project to screen space with `project_3d_to_screen`, render a circle with the branch id. On click, call the current mode's operation (`clip_branch`, `prune_branch`, `apply_wire`, or `remove_wire`). Wire mode splits its hotspots by `branch.wired`: blue circles apply, amber circles remove (via a confirmation modal). The operation marks the mesh dirty; next frame's `get_mesh` rebuilds it
4. Exit: call `exit_3d_viewer()`, which calls `room_goto(global.viewer_return_room)` with the saved player return coordinates

### Saving and loading

`save_game` serializes `global.all_trees` as plain data (structs are JSON-compatible since GM's `json_stringify` handles them). Game day, money, and inventory are also saved.

`load_game` does the reverse. Tree structs are rehydrated: a new `BonsaiTree` is constructed, then every saved field is copied onto it. Methods aren't saved (they live on the constructor's static table and are attached fresh on construction). The mesh cache is explicitly invalidated on load so the viewer will rebuild on next inspection.

## Design decisions worth knowing

### Why z-up in 3D?

GameMaker's 3D tutorials often use y-up (inherited from its 2D convention). I chose z-up because it's more intuitive for trees: "trees grow upward in z," branches live "in the xy plane at various heights." The price is one sign flip: `matrix_build_lookat(..., 0, 0, -1)` because GM's screen-y grows downward. Also, the projection's aspect ratio is negated to match handedness.

### Why real-world units in the simulation?

Trunk height is in centimetres, girth in millimetres. This makes species properties intuitive ("juniper maxes out at 45cm") and training mechanics legible ("clip 1cm off"). The cost is a display-scale multiplier in the mesh builder (`BONSAI_DISPLAY_SCALE = 4`) because a literal 25cm-tall thing rendered in the viewer's metre-scaled world is too small to see comfortably.

### Why procedural 3D rather than pre-made models?

A trained bonsai has to *reflect* the training. If the player clips a branch, prunes a branch, or wires a branch into a new angle, the visual has to change. Pre-made models can't do this without a combinatorial explosion. The only alternative would be pre-rendered 2D sprites, which are a valid fallback if procedural 3D ever proves too costly. (It hasn't so far; the tree is ugly but the pipeline works.)

### Why is the mesh built every time from scratch, not incrementally updated?

A full tree mesh is on the order of a few thousand vertices. Rebuilding it from scratch takes sub-millisecond time even in GML. Incremental updates add complexity for negligible speed benefit. Simpler wins.

### Why aren't tree sprites persistent?

Because `obj_tree_sprite` is tied to a room, and trees are tied to a `location` field on the struct. The Room Start event on the game controller respawns sprites for any trees in the current room. This means moving a tree between rooms (planned: "put this tree in the greenhouse") is just changing its `location` — no sprite bookkeeping needed.

## Known rough edges

- **Trunk bending** is a crude lateral shift rather than proper parallel-transport frame rotation. Trees with wired trunks look wobbly rather than curved. Needs rewriting with Frenet frames or similar.
- **Foliage is untextured cross-billboards.** They work but look cubic. Needs a leaf texture with alpha.
- **Pacing is tuned aggressively toward active play.** Branch spawn rate is 10% per day weighted by vitality. Real bonsai is slower. This is a game, not a simulator.
- **Only junipers are playable.** Maple and pine can't be grown from cuttings (realistic) and seeds aren't implemented yet.
- **Only two rooms** exist. The house interiors and greenhouse are placeholder or absent.
- **No shop yet.** Money has both an income side (display trickle, sell payout) and a HUD readout, but nothing to spend it on. The shop is the next major economy item (TODO #1).
- **Pedestals live in the shed as a stopgap.** They're conceptually indoor furniture; they'll migrate to a proper lounge / display room when interiors land (TODO #7).
- **Three styles can't be scored.** `informal_upright`, `slanting`, and `cascade` need trunk-curve / lean / downward-growth data that doesn't exist on `BonsaiTree` yet. Their `score` field is omitted; `score_tree` skips the criterion entirely for those styles. Real scoring lands alongside TODO #11 (proper trunk-bending math).
- **No win condition or progression beyond the score → money loop.** You grow trees, display or sell them, and stop when you get bored.
