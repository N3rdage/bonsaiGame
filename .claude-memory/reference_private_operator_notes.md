---
name: private-operator-notes
description: "The operator and infrastructure notes (the autonomous-development platform, Azure access from a cloud session, the operator playbook, the time zone to report in) live in the private agentic-gaming repo, not here."
metadata:
  node_type: memory
  type: reference
---

This repo is public. Everything an operator session needs about the autonomous-development platform is kept in the private repo `N3rdage/agentic-gaming`, under `docs/operator-memory/` (start with its `README.md`), alongside `docs/runbook.md` and the ADRs:

- which cloud subscription the platform may touch and how to check it;
- the platform's state: jobs, images, schedules, what is in flight;
- how a cloud session reaches Azure, and as which account;
- the operator playbook: orient order, how Drew's answers and steering reach the orchestrator, what a session can and cannot do;
- which time zone to report times in.

**Why:** a security audit on 2026-11-14 found those notes here, naming accounts and resources in a public repository. They were moved, and removed from this repo's history.

**How to apply:** an operator session reads this repo's memory index, then the private notes. Update them there, in PRs on that repo. See [[no-identifiers-in-public-repo]].
