# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Bonsai Greenhouse — a cozy bonsai-growing sim written in **GameMaker** (IDE 2024.14+, LTS 2024.11+ / Monthly 2025+). GML code, not a cross-platform engine. Prototype-stage, art is placeholder.

**The authoritative architecture reference is `ARCHITECTURE.md`** — read it first for anything non-trivial. `README.md` covers gameplay, controls, and mechanics. This file just captures what's unique to working on the code.

## Build / run / test

- **No CLI build, no test suite, no linter.** The project is opened and run from the GameMaker IDE (`BonsaiGame.yyp` at the repo root). Don't try to invoke a build from the shell.
- **Saves** land at `%LOCALAPPDATA%\BonsaiGame\save1.json`. F5 saves, F9 loads, F1 is a debug hotkey (skip 7 days on tree 0).
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
- **Mesh rebuilds are triggered by `mesh_dirty`.** Any operation that mutates tree morphology (growth, wire, clip, prune, repot) must set `tree.mesh_dirty = true` (or call `mark_dirty()` / use `add_branch` which does it). The viewer rebuilds lazily via `get_mesh()`.
- **`obj_interactable` and `obj_ui_panel` are parent objects.** New interactables/panels inherit from them and call `event_inherited()` in Create. The player finds interactables via `instance_nearest(x, y, obj_interactable)` — no registration needed.
- **UI buttons combine draw + click detection in one call.** `ui_button(...)` returns `true` on the click frame. Call it from a Draw event; don't try to split drawing and input for panels.
- **The player is persistent across rooms.** Doors set `global.pending_player_x/y` before `room_goto`; the player applies them in its Room Start event. Tree sprites (`obj_tree_sprite`) are NOT persistent — the game controller respawns them on Room Start based on each tree's `location` field. Moving a tree = changing `location`.
- **The 3D viewer pauses the simulation.** `global.game_paused = true` while in `rm_viewer_3d`; the controller's Step exits early on pause. Don't rely on ticks happening during inspection.
- **3D is z-up, not y-up.** `matrix_build_lookat(..., 0, 0, -1)` and a negated aspect ratio account for GM's y-down screen convention. Don't "fix" these sign flips.
- **Simulation uses real units.** Trunk height in cm, girth in mm. The mesh builder applies `BONSAI_DISPLAY_SCALE = 4` — scale up only in rendering, not in game logic.
- **Species are data, not code.** `scr_species_data` defines `global.species` as a struct keyed by species name (`"juniper"`, `"maple"`, `"pine"`). Trees store the key only; look up properties via `tree.get_species()`.

## Save/load caveat

Methods aren't serialized (they're on the constructor's static table). `load_game` reconstructs each `BonsaiTree` via `new BonsaiTree(...)` then copies saved fields onto it. If you add fields to `BonsaiTree`, extend both the save path AND the load path in `scr_save_load`, and invalidate the mesh cache on load.

## Known rough edges (don't treat as bugs to fix incidentally)

- Branch hotspot positions in the 3D viewer are slightly offset from visual branch positions.
- Trunk bending is a lateral shift, not a proper curve — trees with wired trunks look wobbly.
- Wire has no visual representation and no removal UI.
- Only junipers can be grown from cuttings; seeds aren't implemented.

See `ARCHITECTURE.md` § "Known rough edges" for the full list and rationale.
