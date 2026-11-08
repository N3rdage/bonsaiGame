---
name: git-bash-pathconv
description: "Git Bash (and the `!` prefix in Claude Code on Windows) rewrites /-leading arguments into Windows paths; az --scope /subscriptions/... fails with MissingSubscription unless MSYS_NO_PATHCONV=1."
metadata:
  node_type: memory
  type: reference
  originSessionId: fc24c824-ee71-4b2e-8314-e7d554c2af0e
  modified: 2026-11-08T09:34:52.127Z
---

On Drew's Windows machine the Claude Code `!` prefix and the Bash tool run Git Bash (MSYS). MSYS converts any argument that looks like a POSIX path (`/subscriptions/...`, `/foo/bar`) into a Windows path before the program sees it. For `az` this shows as `(MissingSubscription) The request did not have a subscription` on commands like `az role assignment create --scope /subscriptions/<id>`.

Fix: prefix the command with `MSYS_NO_PATHCONV=1`, or give Drew the command for PowerShell instead. Seen 2026-11-08 while granting roles to the N3rdage@outlook.com.au guest account. See [[user-shell]] and [[agentic-gaming-infra]].
