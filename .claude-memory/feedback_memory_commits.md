---
name: Memory changes get their own commits
description: .claude-memory/ is in the repo. Don't stage memory files in feature commits — flag them for a separate commit. main is protected, so memory commits go through a chore PR, not a direct push.
type: feedback
originSessionId: ea7bf55b-43b2-4736-8b01-70a80594d6b6
---
Claude's per-project memory lives in the repo at `.claude-memory/` (real files, version-controlled). The auto-memory path `~/.claude/projects/<hash>/memory` is a **Windows junction pointing at the repo `.claude-memory/`**, so harness writes land directly in the repo and there's a single store — edit a memory file once (through either path) and both views update. (The junction broke during the F: drive migration, leaving two diverged real copies; restored 2026-06-09 after reconciling them. If memory ever appears to "split" again — the same file differing between the two paths — the junction has broken again: recreate it with `New-Item -ItemType Junction -Path <user-memory> -Target F:\BonsaiGame\.claude-memory` after merging the live copy's newer files into the repo.)

When committing feature work, do NOT stage `.claude-memory/` files alongside code. Stage feature files explicitly (`git add <paths>`) rather than `git add -A` or `git add .`.

If memory files have been added or modified during the session, mention it at handoff: *"Memory files were also updated — want to do a separate commit for those?"*

**Why:** Memory files are workflow metadata, not feature code. Mixing them into feature PRs adds noise to diffs and makes review harder. Drew wants to be able to see and curate memory changes as their own commits.

**How to apply:**
- Use explicit paths with `git add`, not `-A` / `.`.
- After a feature commit, `git status` — if `.claude-memory/` shows changes, call them out.
- A memory-only commit should have a subject line like `chore(memory): add feedback about X` so history is greppable.
- Memory commits can be bundled with other memory commits but shouldn't ride along with feature changes.
- **`main` is protected — no direct push.** A memory-only commit goes on its own `chore/...` branch and through a PR, same as feature work. If you've already committed to local `main`, move it: `git branch chore/<name>`, `git reset --hard origin/main`, then push the branch and open the PR.
