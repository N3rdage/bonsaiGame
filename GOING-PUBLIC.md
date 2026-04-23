# Going Public — Plan & Decisions

This doc captures the audit, decisions, and pre-flip work for making this repo public. Delete it after the flip is done (or keep it as a record — see the final question).

## TL;DR

The repo is in good shape. Security audit is clean (zero leaks across full history). Pre-flip hygiene landed as a single PR: content edits, a hybrid README header, a gitleaks CI workflow, issue + PR templates, and a `TODO.md`. All decisions below are recorded as a permanent record of what was picked and why.

> **Status:** flipped public on 2026-04-23. Pre-flip hygiene shipped in PR #8; Settings configured; all checklist items below are ticked.

## What's already clean

### Security audit (Step 2)

- **Gitleaks** across the full 8-commit history: 0 leaks, report was `[]`.
- **Targeted pattern sweep** for `sk-*`, `ghp_*`, `AKIA*`, `BEGIN PRIVATE KEY`, `Bearer <token>`: all clean.
- No email addresses, no host-specific paths (`C:\Users\…`), no hardcoded credentials or API keys anywhere in tracked files.
- GameMaker options files are all defaults: empty author, default YoYo Games company string, zero gameid/steam_app_id.

### Stranger's-eyes scrub (Step 3)

Nothing structural. The file tree is coherent, the commit history is readable (post-rewrite, single canonical identity), and the file-by-file review surfaced only the items below.

## Decisions

### 1. Required edits (confirmed — no further decision needed)

These land in the pre-flip PR:

| File | Change |
|---|---|
| `files.zip` | Delete (cruft — zipped copy of early `LICENSE` + `README.md`) |
| `.claude-memory/user_drew.md` | Replace `"the tech stack here is different from his other projects — don't assume .NET/Azure/Blazor context"` with `"the tech stack here is different from his other projects"` |
| `.claude-memory/project_blog.md` | Remove the parenthetical `(` ``N3rdage`` `)` from the rule; rule becomes `"no email, employer, location, exact GitHub handle, or other identifiers"` |

### 2. Decision — `feedback_todo_tracking.md` BookTracker reference

Line 22 reads: *"Format (inherited from BookTracker, adapt if Drew wants different)"*.

BookTracker is the product name of your other public repo (the-library). It's not a secret, but the phrasing reads as an internal reference.

- **(A) Leave as-is.** It's accurate, and the other repo is public anyway. Future-Claude reading this memory gets useful context.
- **(B) Soften.** Change to `"Format (inherited from a prior project, adapt if Drew wants different)"`. Keeps the "this convention came from somewhere" nuance without naming the project.
- **(C) Remove the parenthetical.** Just `"Single priority-ordered table, not categorical bullet lists…"`. Loses the origin note entirely.

**Suggested default: A.** It's honest, and you've already linked the-library repo publicly.

**Picked: A** — left as-is, with a markdown link to the-library added for usefulness.

### 3. Decision — README framing

The current README is **product-forward**: here's the game, here are the controls, here's how to play. Given your answers in Step 1 (this is an experiment / methodology showcase, sibling to the-library with a different collaboration style), there's a case for **meta-forward** framing: lead with the unusual thing (AI-paired game dev in GameMaker, how it went, what's here to learn from) and let the gameplay details follow.

- **(A) Keep product-forward.** Minimal change. README already works. The meta framing lives in the blog post.
- **(B) Meta-forward rewrite.** Open with what this repo is as an experiment, why GameMaker was an unusual choice, what the blog is for, who the audience is. Gameplay section moves below. The `files.zip` delete and memory edits ride along in the same PR.
- **(C) Hybrid.** Add a short "About this repo" header block above the current content (1 paragraph explaining the experiment angle) and otherwise leave the existing content untouched.

**Suggested default: C.** Matches your stated purpose without a full rewrite. Cheap, preserves the gameplay-forward content you already have.

**Picked: C** — "About this repo" section added above the gameplay content, with links to the-library and the blog.

### 4. Decision — CI workflow for secret scanning

No `.github/workflows/` directory yet. Once public, any PR (internal or external) could accidentally introduce a leak.

- **(A) Add gitleaks-on-PR now.** Small yaml file, ~20 lines. Runs on every PR and push to main. Matches the "security-scan as a gate" line in the feedback_planning_conventions memory.
- **(B) Defer.** Scan manually before each merge, add CI later if it becomes noisy.

**Suggested default: A.** Low cost, real safety net, and it's the kind of thing that's easier to add now than retrofit.

**Picked: A** — `.github/workflows/gitleaks.yml` added; runs on PR + push to main.

### 5. Decision — Issue / PR templates

You chose stance (b) — suggestions-welcome-via-issues, no external PRs.

- **(A) Add `.github/ISSUE_TEMPLATE/` (bug + feature + question)** and `.github/pull_request_template.md`. Sets expectations cleanly for visitors.
- **(B) Just issue templates, no PR template** (since you're not accepting PRs anyway).
- **(C) Neither.** GitHub's defaults are fine; your contribution policy lives in the README.

**Suggested default: C** for the first PR, with a note to revisit if you see a lot of low-quality issues.

**Picked: A** — both issue templates and PR template added, partly to test-drive the PR template with internal PRs before it ever sees an external one.

### 6. Decision — Branch protection for solo dev

You're solo for now. Two viable configurations:

- **(A) Minimal.** Block force-push and deletions on main. No PR requirement. You can push direct commits if you want.
- **(B) PR-required with self-bypass.** Require PR, no approvals required, you on the bypass list. Matches your current working rhythm (branch → PR → merge → delete branch). Force-push blocked, deletions blocked.
- **(C) Strict.** Require PR, require 1 approval, no bypass. *Blocks you from merging your own PRs.* Only makes sense when a collaborator joins.

**Suggested default: B.** Keeps your existing rhythm, protects main from accidental history rewrites, and matches the workflow you've been running this whole project.

**Picked: B** — to be configured in Settings post-flip. Option C remains available if a collaborator joins.

### 7. Decision — `GOING-PUBLIC.md` itself, post-flip

- **(A) Delete after the flip** as a temporary planning doc.
- **(B) Keep as a record** of what was decided and why. Useful for future-you and anyone curious about the going-public process.

**Suggested default: B.** It documents decisions cheaply. Rename to `docs/going-public-retro.md` or leave at root — your call.

**Picked: B** — kept at repo root as a permanent record. The repo is intended as an open history that might help future-Drew or others.

## Pre-flip checklist

All landed in this PR except the final scan, which runs before the PR is opened:

- [x] Delete `files.zip`
- [x] Edit `.claude-memory/user_drew.md` — drop `.NET/Azure/Blazor` specifics
- [x] Edit `.claude-memory/project_blog.md` — drop `N3rdage` parenthetical
- [x] Leave `feedback_todo_tracking.md` BookTracker reference; add link to the-library
- [x] Add "About this repo" header to README
- [x] Add `.github/workflows/gitleaks.yml`
- [x] Add issue templates + PR template
- [x] Create `TODO.md` at repo root with going-public follow-ups
- [x] Re-run gitleaks as final sanity check

## Post-flip actions

All done — the repo is live and public as of 2026-04-23.

- [x] Configure Settings → General → Danger Zone → Change visibility → Public
- [x] Configure branch protection per decision 6
- [x] Configure Actions → General → Fork PR workflows → "Require approval for all outside collaborators"
- [x] Enable Code security items that only appear post-flip:
  - Secret scanning (auto-enabled)
  - Push protection (auto-enabled)
  - Private vulnerability reporting (opted in)
  - CodeQL code scanning (opted in with default config)
- [x] Enable Dependabot alerts + security updates
- [x] Features: Issues on, Discussions off, Wiki off, Projects off
- [x] Pull request merge options: merge commits enabled; auto-delete head branches on
- [x] Update `TODO.md` — Post-flip rows moved to Shipped
- [x] (Decision 7) Keep this doc — it's the record

## GitHub Settings walkthrough (for the flip itself)

You'll click these. In order:

**Branch protection** (Settings → Rules → Rulesets → New ruleset):
- Target: `main`
- Bypass list: include Drew
- Require a pull request before merging (no approvals required)
- Block force pushes
- Block deletions
- (Optional) Require status checks to pass — add the `Gitleaks` workflow once the CI has run at least once so it appears in the selector

**Actions** (Settings → Actions → General):
- Fork pull request workflows → "Require approval for all outside collaborators" (since PRs from externals aren't expected)
- Workflow permissions → "Read repository contents and packages permissions" (not Read+Write)

**Code security** — post-flip, verify these appear and enable:
- Secret scanning (auto-on)
- Push protection (auto-on)
- Private vulnerability reporting — opt in
- CodeQL — opt in with default config
- Dependabot alerts + security updates — opt in

**Features** (Settings → General):
- Issues: on
- Discussions: off (revisit later if useful)
- Wiki: off
- Projects: off

**Pull request merge options** (Settings → General):
- Allow merge commits (matches existing history)
- Automatically delete head branches: on
- Always suggest updating PR branches: on

**The flip itself:** Settings → General → Danger Zone → Change visibility → Public. GitHub asks you to type the repo name to confirm.
