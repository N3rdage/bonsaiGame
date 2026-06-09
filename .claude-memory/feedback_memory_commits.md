---
name: Memory changes get their own commits
description: .claude-memory/ is in the repo. Don't stage memory files in feature commits — flag them for a separate commit. main is protected, so memory commits go through a chore PR, not a direct push.
type: feedback
originSessionId: ea7bf55b-43b2-4736-8b01-70a80594d6b6
---
Claude's per-project memory lives in the repo at `.claude-memory/`. On Drew's current machine the auto-memory path `~/.claude/projects/<hash>/memory` is a **separate copy**, NOT a junction to the repo (verified 2026-06-09: empty `LinkType`, and the two MEMORY.md files had diverged). So the two stores can drift: when you change a memory file, edit BOTH the live `~/.claude/.../memory/<file>` (what loads into context each session) AND the repo `.claude-memory/<file>` (the version-controlled copy), or they fall out of sync. (An older note claimed a junction; that's no longer true here.)

When committing feature work, do NOT stage `.claude-memory/` files alongside code. Stage feature files explicitly (`git add <paths>`) rather than `git add -A` or `git add .`.

If memory files have been added or modified during the session, mention it at handoff: *"Memory files were also updated — want to do a separate commit for those?"*

**Why:** Memory files are workflow metadata, not feature code. Mixing them into feature PRs adds noise to diffs and makes review harder. Drew wants to be able to see and curate memory changes as their own commits.

**How to apply:**
- Use explicit paths with `git add`, not `-A` / `.`.
- After a feature commit, `git status` — if `.claude-memory/` shows changes, call them out.
- A memory-only commit should have a subject line like `chore(memory): add feedback about X` so history is greppable.
- Memory commits can be bundled with other memory commits but shouldn't ride along with feature changes.
- **`main` is protected — no direct push.** A memory-only commit goes on its own `chore/...` branch and through a PR, same as feature work. If you've already committed to local `main`, move it: `git branch chore/<name>`, `git reset --hard origin/main`, then push the branch and open the PR.
