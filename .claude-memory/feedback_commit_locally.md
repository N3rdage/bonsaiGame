---
name: Auto-commit locally
description: Always stage and commit changes locally with a descriptive message before handing off — don't wait to be asked.
type: feedback
originSessionId: ea7bf55b-43b2-4736-8b01-70a80594d6b6
---
Always stage and commit changes locally (with a descriptive commit message) before telling Drew the branch is ready. Do this by default — don't wait for him to ask.

**Why:** Drew prefers the branch to be commit-ready when he picks it up for review/push.

**How to apply:** After finishing work on a branch, stage the relevant files (explicit paths, not `git add -A`) and commit with a conventional-commit-style message before reporting completion.
