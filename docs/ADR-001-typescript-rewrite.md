# ADR-001: Rewrite Bonsai Greenhouse as a TypeScript web game

Date: 2026-11-07
Status: Accepted

## Context

Bonsai Greenhouse was prototyped in GameMaker: about 5,600 lines of GML across 76 script and event files, four rooms, placeholder art. The project is moving to fully autonomous development, where a controlling agent plans and builds and Drew steers through decisions and reviews. The infrastructure for that lives in a separate private repository.

GameMaker can be built headlessly, so a harness around it was possible. But GML has no static analysis, no linter, no test framework and no CodeQL support; it needs a licensed Windows host; and its IDE-generated room and sprite JSON is hostile to agents. On the three constraints that matter for this project, autonomy, engineering hygiene and security, it scored lowest of the options considered.

Options considered:

- **A. Keep GameMaker and build a harness.** Windows-only CI, no static analysis ever, a single-seat licence shared between editor and build host.
- **B. Rewrite in Godot 4.** Agent-friendly and a real engine with a native shipping path, but GDScript is also outside CodeQL, and headless rendering in CI needs care.
- **C. Rewrite as a web game in TypeScript.** Everything runs on Linux CI and in cloud agent sessions with no extra infrastructure. Every PR gets a playable preview URL.

## Decision

Option C, rewritten in place in this repository so the history and the dev blog stay continuous.

- **Stack:** Vite, TypeScript, Phaser for the 2D rooms, Three.js for the 3D viewer (added when the viewer is ported), Vitest for unit tests, Playwright for browser tests, ESLint and Prettier, CodeQL via the repository's default setup.
- **Installable from day one.** A PWA manifest and service worker ship in the skeleton. A native desktop wrapper is deferred until there is a reason for one.
- **The GameMaker project moves to `archive/gamemaker/`**, whole and unmodified, as the behavioural reference and the historical record. It is not deleted and not maintained.
- **Port behaviour, not structure.** The simulation (tree model, growth, seasons, scoring, species, styles, save format) ports first, as pure TypeScript under unit tests, because that is where agents are strongest and where the GameMaker code is cleanest. Rooms, UI and the viewer are re-expressed in the new stack rather than translated event by event.
- **Hosting:** Azure Static Web Apps, deployed by this repository's own workflow, with a preview environment per PR.
- **Existing saves get a one-way importer** so trees grown in the prototype survive the move.

## Consequences

- The repository's primary language changes. CodeQL default setup needs JavaScript/TypeScript added to its languages once TypeScript lands on `main`.
- `CLAUDE.md` and `ARCHITECTURE.md` at the root now describe the web project. Their GameMaker versions live beside the archived code.
- Until the port reaches parity, the playable game is the archived GameMaker build. The web build's status is tracked in the README.
- The dev blog gains a post about this decision once the skeleton lands.
