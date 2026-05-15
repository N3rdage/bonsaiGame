# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Bonsai Greenhouse — a cozy bonsai-growing sim written in **GameMaker** (IDE 2024.14+, LTS 2024.11+ / Monthly 2025+). GML code, not a cross-platform engine. Prototype-stage, art is placeholder.

**The authoritative architecture reference is `ARCHITECTURE.md`** — read it first for anything non-trivial. `README.md` covers gameplay, controls, and mechanics. `SIMPLIFICATIONS.md` catalogues deliberately-unsimulated behaviour (candidates for a future "sim depth" mode) — consult before adding realism that might already be a known omission. This file just captures what's unique to working on the code.

## Build / run / test

- **No CLI build, no test suite, no linter.** The project is opened and run from the GameMaker IDE (`BonsaiGame.yyp` at the repo root). Don't try to invoke a build from the shell.
- **Saves** land at `%LOCALAPPDATA%\BonsaiGame\saveN.json` (slots 1–3). F5 quicksaves to the active slot (defaults to 1), F9 quickloads it (falls back to opening the slot picker if the active slot is empty). The title screen has a slot picker for picking which slot New Game / Load Game uses. Per-machine settings sit in `settings.json` next to the saves. Debug hotkeys: F1 skips 7 days on tree 0 only (no world advance), F2 advances the whole world 7 days (ticks every tree, fires display revenue).
- **Changes to code should be verified in-editor by the user.** You cannot run or type-check GML from here — flag when a change needs a runtime check.

## Layout

The GameMaker project sits at the repo root (`BonsaiGame.yyp`). Everything is sharded into per-asset folders:

- `scripts/<name>/<name>.gml` — plain code
- `objects/<name>/<event>.gml` — one file per GM event (`Create_0.gml`, `Step_0.gml`, `Draw_0.gml`, `Other_4.gml` = Room Start, etc.)
- `rooms/<name>/<name>.yy` — room layouts (JSON, mostly auto-generated)
- `sprites/<name>/` — sprite assets

When editing object behavior, edit the right event file — don't merge events together.

## Non-obvious architectural invariants

These are the things that are easy to break if you don't know them. `ARCHITECTURE.md` has the full rationale.

- **`BonsaiTree` struct is the single source of truth.** Both the 2D sprite and the 3D mesh derive from it. Never store display state separately from morphology.
- **Mesh rebuilds are triggered by `mesh_dirty`.** Any operation that mutates tree morphology (growth, wire, clip, prune, repot) must set `tree.mesh_dirty = true` (or call `mark_dirty()` / use `add_branch` which does it). The viewer rebuilds lazily via `get_mesh()`, which returns a struct `{ bark, foliage }` of two frozen vertex buffers. Each draw site does two `vertex_submit` calls — bark untextured (vertex-coloured), foliage submitted with `spr_foliage` + `gpu_set_alphatestenable(true)` + `gpu_set_alphatestref(128)` + `cull_noculling`, then GPU state restored. Cache invalidation must free both buffers. Vertex colour still tints the foliage texture, so per-species `leaf_color` keeps working.
- **Trunk shape lives in `trunk_frames(_tree)`.** The trunk's curve is derived from `trunk.movement` bend events via parallel-transport: starting tangent `(0,0,1)`, each event rotates the whole frame (T/N/B) by `BONSAI_TRUNK_BEND_PER_EVENT` (20°) around `world_up × bend_dir` (Rodrigues, fixed axis so cumulative bends compose past horizontal). `trunk_frames` returns N+1 sampled `{pos, tangent, normal, binormal}` frames; `trunk_frame_at(_tree, _t)` interpolates. Both the mesh (`build_trunk`, `branch_point`, `add_wire_anchor`), the trunk hotspot UI, and the trunk-shape style scorers (informal_upright, slanting, cascade) read from this helper. Don't write a parallel curve derivation — call `trunk_frames` so visuals and scoring agree.
- **Branch shape lives in `branch_frame_at(_tree, _branch, _t)`.** Branches carry two bend scalars — `branch.bend` (horizontal sweep around world +z) and `branch.bend_v` (vertical sweep around the horizontal axis perpendicular to the initial branch direction). Rotation order is V-then-H, so `bend_v=0` collapses exactly to the horizontal-only path: closed-form circular-arc integral for position, direct rotation formulas for the frame. `bend_v != 0` falls back to a 12-step numerical integration for position; the frame stays closed-form (rotate initial T₀/N₀/B₀ by R_v then R_h). `branch_point` is the position-only hot path; `branch_frame_at` adds tangent/normal/binormal for callers that need the full basis (currently `add_wire_coil`). Same "what you see is what you score" principle as trunks; no scoring criterion currently reads either bend.
- **`obj_interactable` and `obj_ui_panel` are parent objects.** New interactables/panels inherit from them and call `event_inherited()` in Create. The player finds interactables via `instance_nearest(x, y, obj_interactable)` — no registration needed.
- **UI buttons combine draw + click detection in one call.** `ui_button(...)` returns `true` on the click frame. Call it from a Draw event; don't try to split drawing and input for panels.
- **The player is persistent across rooms.** Doors set `global.pending_player_x/y` before `room_goto`; the player applies them in its Room Start event. Tree sprites (`obj_tree_sprite`) are NOT persistent — the game controller respawns them on Room Start based on each tree's `location` field. Moving a tree = changing `location`.
- **`BonsaiTree.location` is a tagged-union string, not an enum.** Plain values name a room (`"shed"`, `"inventory"`); typed prefixes encode state — `"sold"` (soft-deleted, struct stays for sale-history), `"displayed:<pedestal_key>"` (on a display pedestal). The room respawn loop filters by exact match, so prefixed locations naturally don't get a duplicate world sprite. Add new states by inventing a new prefix and updating the relevant readers (currently: room respawn, sell flow, pedestal lookup, display revenue tick in `scr_growth`).
- **Pedestals require a `pedestal_key` set in the room editor.** `obj_pedestal` defaults `pedestal_key = ""` and refuses to interact if it's empty. Each instance's creation code sets a stable string (e.g. `pedestal_key = "shed_main";`) — that's what `tree.location = "displayed:" + pedestal_key` references. Don't rely on GM instance ids; they don't survive save/reload.
- **Scoring is derived, never persisted.** `score_tree(_tree)` in `scr_scoring` recomputes on demand from morphology + style + vitality. Don't add a `score` field to `BonsaiTree`. (Also: `score` is a built-in GM real-typed variable — don't shadow it on instance fields, it'll throw on `undefined` assignment.)
- **The 3D viewer pauses the simulation.** `global.game_paused = true` while in `rm_viewer_3d`; the controller's Step exits early on pause. Don't rely on ticks happening during inspection.
- **3D is z-up, not y-up.** `matrix_build_lookat(..., 0, 0, -1)` and a negated aspect ratio account for GM's y-down screen convention. Don't "fix" these sign flips.
- **Simulation uses real units.** Trunk height in cm, girth in mm. The mesh builder applies `BONSAI_DISPLAY_SCALE = 4` — scale up only in rendering, not in game logic.
- **Species are data, not code.** `scr_species_data` defines `global.species` as a struct keyed by species name (`"juniper"`, `"maple"`, `"pine"`). Trees store the key only; look up properties via `tree.get_species()`.
- **Foliage colour goes through `species_seasonal_color(_species, current_season())`.** Each species carries a `seasonal: { spring, summer, autumn, winter }` table; the mesh builder reads through the helper, not the legacy `species.leaf_color` field. A season value of `undefined` means "deciduous winter-bare" — the mesh builder skips the foliage cluster for that branch entirely. `current_season()` (in `scr_seasons`) is a pure function of `global.game_day` (BONSAI_DAYS_PER_SEASON = 28, year starts in spring on day 1) and is safe to call before any game state exists (falls back to spring). Mesh invalidation on season rollover is implicit: `advance_day_all_trees` ticks every tree, which sets `mesh_dirty`. New code paths that advance `global.game_day` without ticking every tree must mark affected trees dirty themselves.
- **Growth and water decay go through season multipliers.** `tree_daily_tick` multiplies its growth scalar by `season_growth_multiplier(_species, current_season())` (returns 0 = dormant when the season isn't in `species.seasons_active`) and its water decay by `season_water_multiplier(current_season())`. If you add a parallel growth path (a different "tick" code, an event that adds height/girth outside the daily tick), it must consult the same helpers or it'll silently bypass dormancy. `fertilize_tree` refuses (without consuming fertilizer) when `season_growth_multiplier(...) <= 0`; future season-gated operations should use the same predicate.
- **The shop catalogue is data on `global.shop_catalogue`.** `init_shop_catalogue` (in `scr_shop`) populates it from the game controller's Create event. Adding/repricing items means editing that struct, not the panel UI. Money debits go through `shop_buy(key, qty, unit_price)` — no other code path should mutate `global.money` downward.
- **Wire and fertilizer are real consumables.** `apply_wire` / `wire_trunk` decrement `inventory.wire`; `fertilize_tree` and `skip_tree_time` decrement `inventory.fertilizer`. New training/care actions that "use" a supply must follow the same pattern — gate on `inventory_has(...)` (or use `inventory_remove(...)`'s false return) and bail cleanly if empty.
- **Pots are tiered.** `BonsaiTree.pot_tier` is `0` (standard) or `1` (fancy). Standard pots come from `inventory.pot`; fancy from `inventory.fancy_pot`. The display-revenue tick in `scr_growth` multiplies daily payout by 1.25 for fancy. Don't conflate the two inventory keys. Post-planting, pot tier may only change via `repot_tree(_tree, _new_tier)` — that's the single mutation site; it's also where the season+cooldown gate (`repot_check`) lives, and it's the canonical pattern for future season-gated actions.
- **Fertilizer is timed, not consumed-on-tick.** A `Fertilize` button consumes 1 fertilizer and sets `tree.fertilized_until_day = global.game_day + 7`. The growth tick checks `global.game_day < fertilized_until_day` for the 1.5x multiplier — the fertilizer item is gone but the *effect* lives on the tree until the day rolls past.
- **The title screen runs before any game state exists.** `obj_title` is in `rm_title` (the first room) and bootstraps only the static globals it needs to render the hero tree (species, styles, vertex format) plus settings. `obj_game_controller` doesn't instantiate until the player picks a slot and `room_goto(rm_shed)` fires. The handoff goes through two globals: `global.pending_load_slot` (0 = fresh start with a starter juniper, > 0 = call `load_game(slot)` instead) and `global.active_slot` (which slot in-game F5/F9 read/write).
- **Settings live separately from save slots.** `global.settings` persists to `settings.json` via `scr_settings`; saves persist to `saveN.json` via `scr_save_load`. Don't mix them — settings are per-machine player preferences, save slots are per-game state. The save file's `version` field is for save-data shape only.
- **Tutorial state is one global step, advanced from gameplay call sites.** `global.tutorial_step` (`scr_tutorial`) drives both the corner panel (`obj_game_controller` Draw GUI) and the notebook (`obj_ui_notebook`, J). New steps go before `TUT_LAST` and *between* existing steps — never after `TUT_DONE`, which is `-1`. Hooks call `tutorial_advance_if(_from)` (no-op unless on the matching step) so call sites are idempotent. New games init via `tutorial_init_for_new_game()` from the controller's Create event; saves init via `tutorial_init_for_load(_save)` which defaults missing fields to `TUT_DONE` so old saves don't snap back into onboarding. If you add a step, also add it to `tutorial_all_steps()` (notebook pagination) plus `tutorial_step_label/body/flavour`.

## Save/load caveat

Methods aren't serialized (they're on the constructor's static table). `load_game` reconstructs each `BonsaiTree` via `new BonsaiTree(...)` then copies saved fields onto it. If you add fields to `BonsaiTree`, extend both the save path AND the load path in `scr_save_load`, and invalidate the mesh cache on load.

For new fields on **branch** structs (or any other nested arrays of structs), the field-copy loop just overwrites `_t.branches` with the saved array — so freshly-constructed branch defaults don't apply. Add a small migration loop in `load_game` that walks the loaded branches and sets the new field if missing (see `bend_v` migration as the template).

## Known rough edges (don't treat as bugs to fix incidentally)

- Only junipers can be grown from cuttings; seeds aren't implemented.
- Fancy pots are stat-only (1.25x display revenue) — no visual differentiation in the world sprite or 3D viewer yet.

See `ARCHITECTURE.md` § "Known rough edges" for the full list and rationale.
