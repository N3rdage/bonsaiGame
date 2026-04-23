---
name: TODO tracking conventions
description: All TODOs go in TODO.md at the repo root. Code TODOs mirror there. "Sync TODOs" reconciles memory + code + TODO.md.
type: feedback
originSessionId: ea7bf55b-43b2-4736-8b01-70a80594d6b6
---
All TODO items go in `TODO.md` at the repo root — this is the master list. (It may not exist yet in BonsaiGame — create it the first time a TODO is added.)

When Drew asks to add a TODO, add it to `TODO.md`. If it has a specific code location, also add a `// TODO` comment in the GML for local context.

When Drew says "sync TODO items" (or similar), scan:
1. Memory for any TODO-type entries
2. Code for `// TODO` comments (grep across `scripts/` and `objects/`)
3. `TODO.md` for the current list

Reconcile all three — add anything missing to `TODO.md`, flag any stale entries that look completed (especially against the "Known rough edges" list in `ARCHITECTURE.md`, which overlaps).

**Why:** TODOs otherwise end up scattered across memory, code comments, and architecture docs. A single `TODO.md` is visible to both Drew and Claude, versioned in git, and has no size limits.

**How to apply:** New TODOs always go to `TODO.md` first. Keep code-level `// TODO` comments for local context but treat `TODO.md` as the source of truth when enumerating outstanding work.

**Format (inherited from BookTracker, adapt if Drew wants different):** Single priority-ordered table, not categorical bullet lists. Columns: `# / Category / Name / Description / Size`. Shipped items move to a separate bottom table with an added `Actual` column so estimate-vs-actual is legible. When shipping, cut-and-paste to the Shipped table and fill in `Actual`.
