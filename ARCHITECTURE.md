# Architecture

How the web project is organised, the decisions behind it, and the invariants carried over from the GameMaker prototype. For why the rewrite happened, see `docs/ADR-001-typescript-rewrite.md`. For the prototype's own architecture, see `archive/gamemaker/ARCHITECTURE.md`. For deliberately-unsimulated behaviour, see `SIMPLIFICATIONS.md`.

This document describes the skeleton as it stands after slice R1 and the shape the port is heading toward. Sections marked *planned* describe modules that do not exist yet.

## High-level shape

A single-page web game. Vite bundles TypeScript into a static site; Phaser renders the 2D world and UI to a canvas; Three.js (*planned*) renders the 3D tree viewer. The simulation is a set of pure TypeScript modules with no rendering dependency, so it runs identically in the browser, in unit tests, and in any future headless tool.

```
index.html
  src/main.ts            Phaser.Game config, PWA service-worker registration
  src/scenes/            Phaser scenes: boot, world rooms (planned), UI (planned)
  src/sim/               pure simulation: seasons (done), tree, growth, scoring, species, styles, save (planned)
  src/viewer/            Three.js tree viewer (planned)
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
| `scr_growth` `pot_palette`, `scr_bonsai_mesh` mesh builder, `obj_viewer_3d` | `src/viewer/` (Three.js) | Planned (R3) |
| `obj_player`, `obj_interactable`, rooms, `scr_weather` | `src/scenes/world/` | Planned (R4) |
| `obj_ui_*`, `scr_ui`, `scr_title_hero` | `src/scenes/ui/` | Planned (R4) |

### How the simulation is shaped

- `src/sim/types.ts` is the whole data model: plain interfaces, JSON-serialisable, no methods. `BonsaiTree.revision` replaces the prototype's `mesh_dirty` flag; every morphology mutation goes through `markDirty` or `addBranch`, and renderers rebuild when the number changes.
- `GameState` carries what the prototype kept in globals (day, money, inventory, trees, next id, tutorial step). Simulation functions take it explicitly and mutate it in place; that is what makes them testable.
- Randomness is injected: `treeDailyTick(tree, state, isolated, rng)` and `advanceDayAllTrees(state, days, rng)` default to `Math.random`, tests pass a constant.
- Saves are versioned. `save.ts` writes version 2 (camelCase) and reads both version 2 and the prototype's version 1 through `importPrototypeSave`, which tolerates the trailing NUL byte the prototype wrote, GameMaker's float-typed integers, and the fields older saves lack. Two real prototype saves live in `src/sim/__fixtures__/` as importer tests. Storage is behind a three-method `SaveStorage` interface with an in-memory implementation for tests and a `localStorage` one under `src/platform/`.

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
- **Saves carry a version** and old shapes migrate forward. Prototype saves import one way. (`src/sim/save.ts`)

## Build, test, deploy

- **Gates** (`npm run check`, mirrored in `.github/workflows/ci.yml`): ESLint strict type-checked, Prettier, `tsc --noEmit`, Vitest with coverage, Vite build, then Playwright against the built output in desktop and mobile profiles.
- **PWA.** `vite-plugin-pwa` generates the manifest and a Workbox service worker that precaches the build. The precache size cap is raised because Phaser alone exceeds the default.
- **Hosting.** Azure Static Web Apps. `public/staticwebapp.config.json` sets SPA fallback, security headers and cache policy. `.github/workflows/deploy-swa.yml` deploys `main` to production and each PR to a preview environment, and removes the preview on close. The deploy token lives in a repository secret; without it the workflow verifies the build and skips.
- **Security.** Gitleaks on every push and PR; CodeQL via the repository's default setup; Dependabot for npm and Actions, grouped weekly.

## Known rough edges

- The web build is a placeholder scene until R3 and R4 land; the simulation exists but nothing drives it yet.
- Prototype rough edges (cuttings for junipers only, fancy pots stat-only) carry over until the relevant backlog items are built.
