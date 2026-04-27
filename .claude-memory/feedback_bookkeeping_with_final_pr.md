---
name: Bundle TODO/doc bookkeeping with the final feature PR
description: For multi-PR features, ride TODO.md / ARCHITECTURE.md / CLAUDE.md updates in the last feature PR rather than a follow-up bookkeeping PR.
type: feedback
originSessionId: ad38ef77-b7f6-457d-929a-e7dad9b117f1
---
When a feature ships across multiple PRs, include the doc bookkeeping
(move TODO entry to Shipped, renumber active items, drop resolved
rough-edges from ARCHITECTURE/CLAUDE, mention new helpers/flows) in the
*final* feature PR — same commit or an additional commit on the same
branch. Don't open a separate "ship + bookkeeping" PR after the feature
PR has merged.

**Why:** Drew called this out after the wire-removal sequence shipped
across PRs #14, #15, #16 and a follow-up #17 just for the TODO/ARCH
update. The follow-up was tightly coupled to the feature merging; an
extra round-trip for review/merge added friction with no benefit.

**How to apply:** When committing what I expect to be the last PR for
a feature:
- Move the TODO entry to the Shipped table with the actual PR list
- Renumber remaining active items so priorities stay sequential
- Drop any rough-edges in ARCHITECTURE.md / CLAUDE.md that the feature
  resolves
- Add references to new helpers / new flows in ARCHITECTURE.md if they
  changed (e.g. `branch_point`, the wired/unwired hotspot split)
- These can be a separate commit on the same branch — keeps the diff
  reviewable — but should ride together in the same PR.

Doesn't apply to *intermediate* PRs in a multi-PR feature; only the
last one. If midway through a feature it turns out to need more PRs,
that's fine — the bookkeeping just moves to whichever turns out to be
the actual last one.
