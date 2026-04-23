---
name: Delete merged branches
description: After Drew confirms a PR is merged (and you've verified on origin), switch to main, pull, and delete the local feature branch.
type: feedback
---
After a PR is merged and the merge is verified on origin (see `feedback_verify_merge`), clean up the local branch in one step:

```
git checkout main && git pull && git branch -d <branch>
```

**Why:** Drew wants a clean local branch list — no stale merged branches hanging around. Over a dozen PRs in a session, unpruned branches pile up fast.

**How to apply:**
- Run the three-command chain as a single step after merge verification.
- Use `-d` (lowercase) — not `-D`. If git refuses to delete because the branch isn't in main's history, that's a *real* signal something's off (e.g., the merge didn't happen, or the wrong branch is being deleted); stop and investigate rather than force-deleting.
- The remote branch is GitHub's to manage. Drew has repo-level auto-delete-head-branches enabled, so the remote side cleans itself. Don't try to delete remote branches yourself.
- If `filter-repo` or similar has left orphaned local branches from re-materialising refs, don't auto-prune them — flag to Drew and let him decide (see the post-rewrite cleanup pattern from the history-rewrite session).
