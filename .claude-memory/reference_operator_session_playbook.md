---
name: operator-session-playbook
description: "How an operator session runs (as of 2026-11-14 afternoon, two projects): orient order, how Drew's answers reach the orchestrator, what this session can and cannot do (Azure job writes need Cloud Shell), the blog pipeline, project labels, and the conventions the backlog uses."
metadata:
  node_type: memory
  type: reference
  originSessionId: 013Biacmq4QrTqsQTVsKuSWu
  modified: 2026-11-14T04:10:00.000Z
---

Operator sessions (Claude Code on claude.ai, Drew on his phone) steer the autonomous orchestrator; they never merge and never build game slices themselves. Learned over 8 to 14 November 2026.

**Orient, in this order:** `.claude-memory/MEMORY.md` here; in agentic-gaming `docs/runbook.md`, `docs/ADR-002-autonomous-merge.md`, `docs/ADR-003-multi-project.md`, `orchestrator/prompts/orchestrator.md` and the project sections under `orchestrator/prompts/projects/`; then, per project, the last two or three comments on its orchestrator log issue (bonsai: agentic-gaming #5; the Library's is created by its first run), open PRs by `bonsai-game-agent[bot]` on the project repo (bonsaiGame, the-library), and open issues labelled `decision` or `blocked`, which since ADR-003 carry a `project:<name>` label (`project:bonsai`, `project:library`). Report in Melbourne time. A session that must push to the-library needs that repo attached to the claude.ai environment and the claude.ai GitHub App installed on it (done 2026-11-14).

**How Drew's words reach the agent.** Every issue the operator files carries the project label, or no run will see it. Answers to a `decision` issue go as a comment on that issue ("Drew's answer (relayed by the operator session, time): B, ..."); the next run records it, removes the label and acts. New work is a backlog issue with acceptance criteria, labelled `game` plus `ready`, and `parallel` or `after #n` in the body; priority is board position then age, and the App cannot see the board, so ordering is set by a steering comment on #5 ("Steering from Drew (relayed...)"), which every run reads at orientation. A run that has already oriented will not see a later comment; the 11:00/17:00/23:00/05:00 Melbourne runs read at start. Ideas not to be built yet are filed unlabelled (`ready` absent) with a note saying when to label them.

**What this session can do:** read everything on GitHub (MCP tools), file issues and comments, open PRs on the three repos (agentic-gaming for infra and prompts, bonsaiGame for memory, the-library for its own repo-side changes; `add_repo` attached the-library on 2026-11-14 and pushes worked once the claude.ai App was on it), read Azure as `bonsai-operator@andrewoharesilly.onmicrosoft.com` after a device-code login Drew approves (execution list, job config, Log Analytics, live tail), and re-run a GitHub workflow. **What it cannot:** the auto-mode permission classifier denies Azure job writes (`az containerapp job update` / `start`) from this session even though the operator role allows them, and denies attaching new repositories; Drew runs those lines himself in Azure Cloud Shell (Bash, any browser) or PowerShell on the laptop (`./scripts/Start-OrchestratorRun.ps1 -FitBeforeNextRun` for a gap run between cron slots; the three raw `az` lines are in the runbook's routine-operations table). Image rebuilds and `Deploy-Infra.ps1` are laptop-only (owner login). Never store an Azure credential; `az logout` at the end of each use.

**Blog pipeline.** Posts syndicate to silly.ninja only when bonsaiGame's `notify-drew-blog` workflow dispatches drew-blog with a valid `DREW_BLOG_DISPATCH_TOKEN` (a fine-grained PAT, Contents read/write on drew-blog; it expired once, 7 to 10 Nov, and curl exit 22 in that workflow's log is the symptom) or when drew-blog's daily cron runs (GitHub disables it after 60 idle days). Since 13 Nov the orchestrator treats the blog as the filler lane and reads `blog/BACKLOG.md` every run.

**Conventions worth knowing when writing issues for the agent:** one PR per issue, about 500 lines; the agent splits big issues itself and marks children `parallel`/`after`; it asks Drew through `decision` issues with A/B/C and a recommendation; it will not invent features outside `TODO.md`, `DESIGN.md` or Drew's issues; phone screenshots (S22 Ultra landscape, 824x384 CSS px) in PR bodies are how Drew reviews visuals.

See [[agentic-gaming-infra]], [[cloud-session-azure]], [[feedback-melbourne-time]], [[feedback-self-contained-steps]], [[bonsaigame-dev-blog]].
