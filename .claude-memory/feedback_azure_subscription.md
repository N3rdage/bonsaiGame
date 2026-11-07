---
name: azure-subscription-check
description: "Before any Azure action, confirm the active subscription is \"Sponge Box Consulting - Business Sub\" (Drew calls it \"Bikini Bottom\"); other subs visible on the account are off-limits."
metadata:
  node_type: memory
  type: feedback
  originSessionId: fc24c824-ee71-4b2e-8314-e7d554c2af0e
  modified: 2026-11-07T08:15:55.642Z
---

Before doing anything in Azure, check `az account show` and confirm the active subscription is **"Sponge Box Consulting - Business Sub"** (Drew's nickname: "Bikini Bottom"). Drew's login also sees Juno sponsor/partnership subs and "Sample Register", which must never be touched for this project.

**Why:** Drew's account spans several client/partner subscriptions; a deploy to the wrong one is a billing and trust problem.

**How to apply:** Run `az account show --query name -o tsv` first in any session that touches Azure. The agentic-gaming scripts enforce this in `scripts/_common.ps1` (`Assert-AzLogin` throws on any other sub). If it's wrong: `az account set --subscription "Sponge Box Consulting - Business Sub"`. Related: [[agentic-gaming-infra]].
