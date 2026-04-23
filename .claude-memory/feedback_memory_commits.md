---
name: Memory changes get their own commits
description: .claude-memory/ is in the repo via a Windows junction. Don't stage memory files in feature commits — flag them for a separate commit.
type: feedback
originSessionId: ea7bf55b-43b2-4736-8b01-70a80594d6b6
---
Claude's per-project memory lives in the repo at `.claude-memory/`. A Windows directory junction at `~/.claude/projects/<hash>/memory` points here so the auto-memory system works transparently.

When committing feature work, do NOT stage `.claude-memory/` files alongside code. Stage feature files explicitly (`git add <paths>`) rather than `git add -A` or `git add .`.

If memory files have been added or modified during the session, mention it at handoff: *"Memory files were also updated — want to do a separate commit for those?"*

**Why:** Memory files are workflow metadata, not feature code. Mixing them into feature PRs adds noise to diffs and makes review harder. Drew wants to be able to see and curate memory changes as their own commits.

**How to apply:**
- Use explicit paths with `git add`, not `-A` / `.`.
- After a feature commit, `git status` — if `.claude-memory/` shows changes, call them out.
- A memory-only commit should have a subject line like `chore(memory): add feedback about X` so history is greppable.
- Memory commits can be bundled with other memory commits but shouldn't ride along with feature changes.
