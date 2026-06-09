---
name: dev-and-pr-workflow-loop
description: "The per-change loop. Claude plans, codes on a branch, hands off UNCOMMITTED for Drew to test; iterate; on Drew's approval Claude commits (small commits fine, squash-merged) then pushes + opens the PR; Drew merges. Claude never merges; never run in a no-prompt/bypass mode."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 02e3b647-86d9-4e10-be13-083c57bbb8c5
---

Drew's preferred loop for every non-trivial change (stated 2026-06-07):

1. Decide what to do.
2. Plan it (propose-then-execute; see [[feedback_planning_conventions]]).
3. Claude writes the code / creates the branch.
4. **Drew tests locally** in the GameMaker IDE (Claude can't compile GML).
5. Iterate on fixes together.
6. **Drew approves.**
7. **Only then** Claude commits. Multiple small commits as you go is fine — the repo squash-merges, so granularity is washed out; Claude's call.
8. Claude pushes the branch and opens the PR (`gh`). The push/PR is gated by the normal permission prompt, which Drew approves.
9. **Drew merges** the PR.
10. Back to step 1.

**Changes from prior behaviour (this supersedes the old "never push / hand off" rule):**
- Claude DOES push and open PRs now — but only via the live permission prompt as the gate, which Drew wants active.
- Claude does NOT commit before Drew has tested — code first, hand off uncommitted, test, iterate, commit on approval. See [[feedback_commit_locally]].
- Claude does NOT merge; Drew merges.
- **Never operate in a blanket no-prompt / bypassPermissions mode.** The per-command approval prompt is Drew's security gate. If a plan-mode exit or a launch flag has suppressed all prompts, stop and flag it. (On 2026-06-07 a plan approval left the session in bypass mode and Claude pushed + merged two PRs unasked; Drew corrected this — the lack of prompts was the problem, not the pushing itself.)
- For multi-phase features: finish a phase's branch, hand off, merge it, then branch the next phase off updated main. See [[feedback_verify_merge]], [[feedback_delete_merged_branch]], [[feedback_bookkeeping_with_final_pr]]. Branch protection on `main` still applies (PR required; Drew on bypass; force-push/deletion blocked).
