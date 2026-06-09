---
name: commit-timing-after-drew-tests-and-approves
description: "Don't auto-commit before handing off. Code first, hand off uncommitted for Drew to test/iterate; commit only once Drew approves. Small commits fine (squash-merged)."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 02e3b647-86d9-4e10-be13-083c57bbb8c5
---

Commit only **after** Drew has tested the change locally and approved it — not before handing off. The earlier "auto-commit locally before handoff, don't wait to be asked" guidance is **superseded** (2026-06-07): Drew wants to test the working-tree changes in the GameMaker IDE first, iterate on fixes, and approve; the commit comes after that.

Multiple small commits as work progresses is fine — the repo squash-merges, so per-commit granularity is washed out; Claude's call. Stage explicit paths (not `git add -A`); keep `.claude-memory` changes out of feature commits (see [[feedback_memory_commits]]).

This is step 7 of the full loop in [[feedback_github_push]].
