# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Bonsai Greenhouse is a cozy bonsai-growing sim, being rewritten as an installable **TypeScript web game** (Vite, Phaser for 2D rooms, Three.js for the 3D viewer, PWA). The GameMaker prototype it grew from is preserved, whole and frozen, in `archive/gamemaker/`. The rewrite is in progress; see `TODO.md` for which slices have landed.

Read in this order for anything non-trivial:

- `ARCHITECTURE.md` is the authoritative description of the web project's shape and the invariants carried over from the prototype.
- `docs/ADR-001-typescript-rewrite.md` records why the rewrite happened and the rules of the port.
- `DESIGN.md` and `README.md` describe the game as designed: mechanics, controls, feel. `SIMPLIFICATIONS.md` lists behaviour deliberately not simulated; check it before adding realism.
- `archive/gamemaker/ARCHITECTURE.md` and `archive/gamemaker/CLAUDE.md` explain how the prototype worked. The GML is the behavioural reference when porting.

## Development is autonomous

A controlling agent builds this game on a schedule, with Drew reviewing PRs and answering questions asynchronously. The infrastructure, orchestrator prompt and the **backlog (GitHub Issues)** live in the private `N3rdage/agentic-gaming` repo. Rules that apply to every session, human-driven or not:

- `main` changes only through pull requests. The orchestrator merges its own PRs once an independent reviewer agent, acting as a second GitHub App, has approved the latest commit and every required check is green (`docs/ADR-002-autonomous-merge.md` in the private repo). It never merges anyone else's PR. Human-driven sessions never merge; Drew does. One PR per backlog issue, small enough to review on a phone. PR body: Summary, Changes, How it was verified, Backlog link, Decisions needed.
- The `needs-drew` label, a changes-requested review from Drew, or `hold` in a comment from Drew means that PR waits for him, however green it is.
- Questions for Drew go to a `decision` issue in the backlog repo with A/B/C options and a recommendation, not into PR descriptions.
- Milestones, major blockers and design decisions each get a blog post (see below) in their own PR.

## Build / run / test

Node 22 (`.nvmrc`). All gates run locally and in CI (`.github/workflows/ci.yml`); a PR is not reviewable until they are green.

```
npm ci
npm run dev            # Vite dev server
npm run check          # lint + format:check + typecheck + unit tests + build
npm run build && npm run test:e2e   # Playwright against the production build
```

- `npm run lint` is ESLint with typescript-eslint's strict type-checked configs. Fix the code, not the rule, unless the rule is wrong for the whole project, in which case change it in its own PR with the reasoning.
- `npm run test` is Vitest. Unit tests sit beside the code as `*.test.ts`. The simulation under `src/sim/` is pure TypeScript with no Phaser import, so it is fully unit-testable; keep it that way.
- `npm run test:e2e` is Playwright. Browser tests read game state through `window.__bonsai`, a small read-only test hook published by scenes (typed in `src/vite-env.d.ts`). Extend it additively when a test needs to see something; never scrape pixels.
- The build must stay installable: the PWA manifest and service worker are configured in `vite.config.ts`. The e2e suite checks both.
- Deploys: `.github/workflows/deploy-swa.yml` pushes `main` to Azure Static Web Apps and gives every PR a preview URL. It skips cleanly without the deploy token.

## Layout

- `src/main.ts` boots Phaser. `src/scenes/` holds Phaser scenes (world, UI). `src/sim/` is the simulation: pure, deterministic, no rendering or browser imports; `src/sim/types.ts` is its data model and `src/sim/__fixtures__/` holds real prototype saves for the importer tests. `src/platform/` is the thin browser-facing layer (storage adapters). `src/viewer/` (when it lands) is the Three.js tree viewer.
- `e2e/` Playwright specs. `public/` static assets including `staticwebapp.config.json`, which Vite copies into `dist/`.
- `archive/gamemaker/` the prototype. Read it, do not edit it.
- `art/` source pixel art, the Python scripts that generate placeholder sprites, and `sheets.mjs` (`npm run art:sheets`), which packs the prototype's sprite frames into the sheets under `public/assets/`.
- `blog/` the dev blog. `docs/` decision records.

## Blog (`blog/`)

Posts in `blog/` follow the shared syndication contract; the single source of truth is https://github.com/N3rdage/drew-blog/blob/main/docs/BLOG_POST_CONTRACT.md (link it, don't copy it). Posts syndicate to silly.ninja under `/bonsai/{slug}/`; the aggregator's sync validates and decorates but never repairs, so a non-compliant post fails the sync loudly. Rules that bite:

- **Filenames and slugs are frozen identifiers after publish.** Never rename a post file; `slug` in frontmatter must equal the filename remainder after `YYYY-MM-DD-NN-`, verbatim.
- **Full frontmatter is required** on every date-prefixed post: `title`, `description`, `date` (must match filename date), `author` (`Claude`), `reviewed_by` (`Drew`), `slug`, `tags`. `description` is 1-2 plain-text sentences for listings.
- **No H1 in the body.** Body headings start at `##`. A `[Math]`-style sub-series lives as a `math` tag, not a title prefix.
- **Sibling links and images stay relative** (`./YYYY-MM-DD-NN-slug.md`, `./images/...`).
- Non-date-prefixed files are ignored by the sync by design.
- `.github/workflows/notify-drew-blog.yml` pings drew-blog on pushes to `blog/**`; it no-ops until the `DREW_BLOG_DISPATCH_TOKEN` secret exists.
- Posts are first person, Claude's voice, honest about what went wrong. Never include personal information about Drew beyond the first name.

## Porting rules

- **Port behaviour, not structure.** Read the GML for what the game does and the numbers it uses, then express it idiomatically in TypeScript. Do not translate GameMaker objects and events one for one.
- **Numbers are canon.** Growth rates, season multipliers, scoring weights, costs and cooldowns come from the prototype unless a backlog issue says otherwise. Unit tests should pin them.
- **The prototype's invariants still hold** (single source of truth tree model, real units in cm and mm with scaling only in rendering, scoring derived never persisted, species and styles as data, seasons as a pure function of the day, season multipliers gating all growth paths, consumables really consumed). `ARCHITECTURE.md` lists them with their TypeScript homes.
- **Saves must import.** Prototype saves (`saveN.json`) get a one-way importer. New save shapes carry a version and a migration.
- **Dependencies are deliberate.** Every new package is a line in the PR body explaining why. Prefer boring, well-maintained libraries.

## Known rough edges (don't treat as bugs to fix incidentally)

- Only junipers can be grown from cuttings; seeds aren't implemented.
- Fancy pots give 1.25x display revenue; their only look is the 2D tree sprite's celadon pot with feet and sheen (and the 3D viewer's pot colours).
