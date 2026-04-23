---
name: Keep ARCHITECTURE.md updated
description: Update ARCHITECTURE.md when structural changes are made (new objects, scripts, rooms, patterns, or invariants).
type: feedback
originSessionId: ea7bf55b-43b2-4736-8b01-70a80594d6b6
---
`ARCHITECTURE.md` at the repo root is the authoritative living document for the BonsaiGame design — it's detailed and Drew wants it kept current, not left to go stale.

**Why:** Drew wants the architecture doc to reflect the code, not a snapshot from day one. Future-him (and future Claude instances) rely on it to get productive fast.

**How to apply:** When making structural changes — adding a new object/script/room, adding or changing a key invariant (e.g. anything that touches the `mesh_dirty` pattern, save/load format, the `obj_interactable`/`obj_ui_panel` hierarchies, z-up convention, species data model) — update `ARCHITECTURE.md` in the same branch. The "Known rough edges" section is also worth updating when a listed edge gets fixed or a new one is discovered.
