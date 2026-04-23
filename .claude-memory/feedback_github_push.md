---
name: Do not push branches or open PRs — hand off to Drew
description: Claude commits locally; Drew pushes and opens PRs. After a branch is commit-ready, stop and tell Drew "push the changes and create a PR." Wait for explicit merge confirmation before treating work as landed.
type: feedback
---
When work is ready to leave the local machine, do **not** run `git push` or try to create a pull request. Instead, tell Drew: *"push the changes and create a PR"* and stop. Wait for Drew to confirm the PR has been merged into `main` before treating the change as landed or moving on to follow-up branches.

**Why:** Drew wants control over what hits the remote and when the PR is opened. Unilateral pushes bypass that review step. Branch protection on `main` (see current settings) enforces this at the GitHub layer too — force-push is blocked, direct commits require PR.

**How to apply:**
- Local work (branch creation, commits, building, testing) is fine to do autonomously.
- After the final commit on a feature branch, do not push — output the hand-off phrase.
- Do not poll, retry, or assume merge status. Wait for Drew to say it's merged.
- Only after Drew confirms merge should you `git fetch` to verify (see `feedback_verify_merge`), then `git checkout main`, `git pull`, and `git branch -d <branch>` (see `feedback_delete_merged_branch`).
- If there are multiple branches ready to hand off, list them all — Drew pushes each separately.
