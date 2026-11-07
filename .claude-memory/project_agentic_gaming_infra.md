---
name: agentic-gaming-infra
description: The autonomous-dev platform for Bonsai Greenhouse lives in the private repo N3rdage/agentic-gaming (cloned at F:\agentic-gaming) - Bicep + PowerShell + orchestrator container + private backlog issues.
metadata:
  type: project
---

Decided 2026-11-07: Bonsai Greenhouse is being rewritten in place as a TypeScript web game (Vite + Phaser + Three.js, PWA) and developed autonomously by a Fable controlling agent orchestrating Opus/Haiku subagents. The GameMaker project is to be moved to `archive/gamemaker/` as a relic.

Infra and private backlog live in **N3rdage/agentic-gaming** (private; local clone `F:\agentic-gaming`): Bicep (`infra/`), PowerShell operator scripts (`scripts/`), orchestrator image (`orchestrator/`), ADR + runbook (`docs/`). Backlog = GitHub Issues on that repo (labels: ready / in-progress / in-review / blocked / decision / milestone / orchestrator-log); the public game repo should have Issues disabled. Agent identity = GitHub App `bonsai-agent[bot]`. Game hosting = Azure Static Web App `swa-bonsai-greenhouse` with PR previews. Orchestrator = scheduled Azure Container Apps Job running Claude Code headless.

**Why:** Drew wants autonomy, hygiene, and privacy of plans/personal info while keeping the game repo public and the blog contiguous.

**How to apply:** Infra changes go to agentic-gaming, game changes to bonsaiGame. Read `docs/runbook.md` there before touching Azure. See [[azure-subscription-check]].
