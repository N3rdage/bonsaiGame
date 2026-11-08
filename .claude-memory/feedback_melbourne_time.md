---
name: feedback-melbourne-time
description: "Report times to Drew in Melbourne local time (AEST/AEDT), not UTC."
metadata:
  node_type: memory
  type: feedback
  originSessionId: fc24c824-ee71-4b2e-8314-e7d554c2af0e
  modified: 2026-11-07T19:22:18.390Z
---

Drew wants all times reported in Melbourne time (Australia/Melbourne: AEDT UTC+11 in summer, AEST UTC+10 in winter), not UTC.

**Why:** Drew is in Melbourne and the orchestrator cron, Azure logs and GitHub timestamps are all UTC, so raw UTC made him do the conversion every time.

**How to apply:** Convert UTC timestamps (job executions, cron slots, issue comments) to Melbourne time before reporting. If the UTC value matters for a config (e.g. the Container Apps cron is UTC), state the Melbourne time and note the UTC value once in a code block or table. The orchestrator's six-hourly runs are 00/06/12/18 UTC = 11:00/17:00/23:00/05:00 AEDT (10:00/16:00/22:00/04:00 AEST). See [[project-agentic-gaming-infra]].
