# GameMaker prototype (archived)

This folder is the original Bonsai Greenhouse prototype, built in GameMaker between April and November 2026. It is kept whole, exactly as it last ran, as the archaeological record of where the game came from and as the behavioural reference for the TypeScript rewrite at the repo root.

It is not maintained. Open `BonsaiGame.yyp` in GameMaker 2024.14 or later if you want to run it.

What to read:

- `ARCHITECTURE.md` describes how the GameMaker code was organised and the invariants it kept. Most of those invariants carry over to the rewrite in spirit; see the root `ARCHITECTURE.md` for the current shape.
- `CLAUDE.md` is the AI-collaboration guide that applied to this code. It is kept so sessions working in this folder during the port get the right context.
- `scripts/` holds the simulation logic (tree model, growth, seasons, scoring, species, styles, save format). This is the half that ports as pure TypeScript.
- `objects/` and `rooms/` hold the 2D world, UI panels and the 3D viewer. This is the half that is being re-expressed in Phaser and Three.js.

The decision to rewrite, and why, is in `docs/ADR-001-typescript-rewrite.md` at the repo root. The dev blog in `blog/` tells the story in order.
