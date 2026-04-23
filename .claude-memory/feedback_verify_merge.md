---
name: Verify merge on remote before post-merge work
description: When Drew says a PR is merged, first step is `git fetch` + check origin/main SHA — not a pull/delete. The user's message is a claim; the remote is ground truth.
type: feedback
---
When Drew reports a merge (*"merged"*, *"it's in"*, *"landed"*), verify the actual state on the remote before proceeding with post-merge housekeeping or follow-up work.

**Why:** The user's message is a claim. The remote is ground truth. There's an incident template in The Library project where a user said "have merged it" but had forgotten to click the actual merge button in GitHub — cheap to catch at the fetch step, expensive if you start building the next branch on top of a phantom merge. Rule generalises to any state-changing handoff where you didn't see the action happen yourself (deploy complete, CI passed, migration applied).

**How to apply:**
- First step after Drew's "merged" message is `git fetch origin` + `git log --oneline --graph origin/main -<N>`. Confirm the expected merge commit is at the tip.
- If the remote shows the merge isn't there, say so plainly and wait — don't assume it's sync lag and plough ahead.
- Only after verification proceed to `git checkout main && git pull && git branch -d <branch>` (see `feedback_delete_merged_branch`).
- For history-rewrite / force-push cases, also check `git ls-remote origin refs/heads/<branch>` — remote-branch existence can be the telltale signal something didn't complete.
