---
name: agentic-gaming-infra
description: The autonomous-dev platform for Bonsai Greenhouse lives in the private repo N3rdage/agentic-gaming (F:\agentic-gaming) - Bicep + PowerShell + orchestrator container + private backlog issues. Includes current state and in-flight items as of 2026-11-08.
metadata:
  node_type: memory
  type: project
  originSessionId: fc24c824-ee71-4b2e-8314-e7d554c2af0e
  modified: 2026-11-08T08:21:37.685Z
---

Bonsai Greenhouse is rewritten in place as a TypeScript web game (Vite + Phaser + Three.js, PWA), developed autonomously by a Fable controlling agent orchestrating Opus/Haiku subagents. GameMaker prototype archived at `archive/gamemaker/`.

Infra and private backlog live in **N3rdage/agentic-gaming** (local clone `F:\agentic-gaming`): Bicep (`infra/`), PowerShell operator scripts (`scripts/`), orchestrator image (`orchestrator/`), ADR-001/002 + runbook (`docs/`). Backlog = GitHub Issues there; pinned orchestrator log is issue #5. `main` on agentic-gaming requires a PR (Drew merges). Game repo `main` ruleset: PR + 1 approval + required checks (CI, Gitleaks, CodeQL); Repository admin bypass for Drew.

**How it works (ADR-002, live since 2026-11-08):** two GitHub Apps. `bonsai-game-agent` (App 5654223) authors branches/PRs; `bonsai-game-reviewer` (App 5664771, Installation 179776202, needs Contents *write* or its approvals do not count) approves via a fresh-context reviewer subagent using the `gh-reviewer` command. The orchestrator merges only its own PRs, loops over slices within a run, never merges Drew's or Dependabot's. Drew's veto: `needs-drew` label, changes-requested review, or "hold" comment. Prompts are read from `main` of agentic-gaming at run time (`orchestrator/prompts/orchestrator.md`, `reviewer.md`), so steering is a push; entrypoint/Dockerfile changes need `Build-Image.ps1` then `Deploy-Infra.ps1 -Stage 2 -ImageTag <tag>`.

**Azure:** job `caj-agenticgaming-orchestrator` in `rg-agentic-gaming`, cron every 6 h UTC (05:00/11:00/17:00/23:00 Melbourne), 4 h cap, MAX_TURNS 1500. Static Web App `swa-bonsai-greenhouse`, Standard tier (10 previews), production at **https://bonsai.silly.ninja** (CNAME at Gandi) and the default `zealous-field-0dc915500.3.azurestaticapps.net`. Throttle in practice = Max plan 5-hour usage limit (a looping run burned it in ~1 h on 2026-11-08).

**State as of 2026-11-08 19:25 Melbourne:** deployed image `bonsai-orchestrator:20261108-1910` (early-exit notice on the log issue when a run dies; agentic-gaming PR #30 merged). Nothing infra-side pending. Game slices R3a-R3d-1 merged autonomously (bonsaiGame #90, #93, #94, #96, #97); a run started 18:59 was continuing R3. Backlog issue #28 records the future invite-only auth requirement (Drew prefers public local play, sign-in only for cloud sync). Get-RunLogs.ps1's -Execution filter leaks other runs' lines (minor bug, unfixed); live tail: `az containerapp job logs show ... --execution <name> --container orchestrator`. Drew's machine (16 GB) runs low on memory with three Claude tabs open; background pollers get reaped, cloud builds are unaffected.

**Why:** Drew wants autonomy, hygiene, privacy of plans/personal info, the game repo public, the blog contiguous, and himself out of the merge loop.

**How to apply:** Infra changes go to agentic-gaming as PRs, game changes to bonsaiGame as PRs. Read `docs/runbook.md` before touching Azure. See [[azure-subscription-check]], [[feedback-melbourne-time]], [[feedback-self-contained-steps]].
