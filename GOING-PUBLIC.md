# Going Public — Plan & Decisions

This doc captures the audit, decisions, and pre-flip work for making this repo public. Delete it after the flip is done (or keep it as a record — see the final question).

## TL;DR

The repo is in good shape. Security audit is clean (zero leaks across full history). Only two content edits genuinely need to land before flipping (`files.zip` delete, two memory-file edits). A handful of nice-to-haves — README reframing, a CI workflow, issue templates — are optional and documented as decision points below.

Recommended path: one bundled PR for the required edits + a meta-forward README rewrite, then flip, then a follow-up PR for CI and any templates.

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

### 2. Open decision — `feedback_todo_tracking.md` BookTracker reference

Line 22 reads: *"Format (inherited from BookTracker, adapt if Drew wants different)"*.

BookTracker is the product name of your other public repo (the-library). It's not a secret, but the phrasing reads as an internal reference.

- **(A) Leave as-is.** It's accurate, and the other repo is public anyway. Future-Claude reading this memory gets useful context.
- **(B) Soften.** Change to `"Format (inherited from a prior project, adapt if Drew wants different)"`. Keeps the "this convention came from somewhere" nuance without naming the project.
- **(C) Remove the parenthetical.** Just `"Single priority-ordered table, not categorical bullet lists…"`. Loses the origin note entirely.

**Suggested default: A.** It's honest, and you've already linked the-library repo publicly.

### 3. Open decision — README framing

The current README is **product-forward**: here's the game, here are the controls, here's how to play. Given your answers in Step 1 (this is an experiment / methodology showcase, sibling to the-library with a different collaboration style), there's a case for **meta-forward** framing: lead with the unusual thing (AI-paired game dev in GameMaker, how it went, what's here to learn from) and let the gameplay details follow.

- **(A) Keep product-forward.** Minimal change. README already works. The meta framing lives in the blog post.
- **(B) Meta-forward rewrite.** Open with what this repo is as an experiment, why GameMaker was an unusual choice, what the blog is for, who the audience is. Gameplay section moves below. The `files.zip` delete and memory edits ride along in the same PR.
- **(C) Hybrid.** Add a short "About this repo" header block above the current content (1 paragraph explaining the experiment angle) and otherwise leave the existing content untouched.

**Suggested default: C.** Matches your stated purpose without a full rewrite. Cheap, preserves the gameplay-forward content you already have.

### 4. Open decision — CI workflow for secret scanning

No `.github/workflows/` directory yet. Once public, any PR (internal or external) could accidentally introduce a leak.

- **(A) Add gitleaks-on-PR now.** Small yaml file, ~20 lines. Runs on every PR and push to main. Matches the "security-scan as a gate" line in the feedback_planning_conventions memory.
- **(B) Defer.** Scan manually before each merge, add CI later if it becomes noisy.

**Suggested default: A.** Low cost, real safety net, and it's the kind of thing that's easier to add now than retrofit.

### 5. Open decision — Issue / PR templates

You chose stance (b) — suggestions-welcome-via-issues, no external PRs.

- **(A) Add `.github/ISSUE_TEMPLATE/` (bug + feature + question)** and `.github/pull_request_template.md`. Sets expectations cleanly for visitors.
- **(B) Just issue templates, no PR template** (since you're not accepting PRs anyway).
- **(C) Neither.** GitHub's defaults are fine; your contribution policy lives in the README.

**Suggested default: C** for the first PR, with a note to revisit if you see a lot of low-quality issues.

### 6. Open decision — Branch protection for solo dev

You're solo for now. Two viable configurations:

- **(A) Minimal.** Block force-push and deletions on main. No PR requirement. You can push direct commits if you want.
- **(B) PR-required with self-bypass.** Require PR, no approvals required, you on the bypass list. Matches your current working rhythm (branch → PR → merge → delete branch). Force-push blocked, deletions blocked.
- **(C) Strict.** Require PR, require 1 approval, no bypass. *Blocks you from merging your own PRs.* Only makes sense when a collaborator joins.

**Suggested default: B.** Keeps your existing rhythm, protects main from accidental history rewrites, and matches the workflow you've been running this whole project.

### 7. Open decision — `GOING-PUBLIC.md` itself, post-flip

- **(A) Delete after the flip** as a temporary planning doc.
- **(B) Keep as a record** of what was decided and why. Useful for future-you and anyone curious about the going-public process.

**Suggested default: B.** It documents decisions cheaply. Rename to `docs/going-public-retro.md` or leave at root — your call.

## Pre-flip checklist

Assuming the suggested defaults (swap to your picks where you differ):

- [ ] Delete `files.zip`
- [ ] Edit `.claude-memory/user_drew.md` — drop `.NET/Azure/Blazor` specifics
- [ ] Edit `.claude-memory/project_blog.md` — drop `N3rdage` parenthetical
- [ ] (Decision 2) Leave `feedback_todo_tracking.md` BookTracker reference
- [ ] (Decision 3) Add "About this repo" header to README
- [ ] (Decision 4) Add `.github/workflows/gitleaks.yml`
- [ ] (Decision 5) No templates for now
- [ ] Create `TODO.md` at repo root with going-public follow-ups
- [ ] Re-run gitleaks as final sanity check

## Post-flip actions

- [ ] Configure Settings → General → Danger Zone → Change visibility → Public (you click)
- [ ] Configure branch protection per decision 6
- [ ] Configure Actions → General → Fork PR workflows → "Require approval for all outside collaborators" (you chose stance b, no PRs expected)
- [ ] Enable Code security items that only appear post-flip:
  - Secret scanning (verify auto-enabled)
  - Push protection (verify auto-enabled)
  - Private vulnerability reporting (opt in)
  - CodeQL code scanning (opt in with default config)
- [ ] Enable Dependabot alerts + security updates
- [ ] Features: Issues on, Discussions off, Wiki off, Projects off
- [ ] Pull request merge options: match existing history — merge commits enabled (your PRs have been merge-committed, not squashed); auto-delete head branches on
- [ ] Update / create `TODO.md` with any deferred items (e.g., CI if you picked B on decision 4)
- [ ] (Decision 7) Keep or delete this doc

## What I need from you

Pick A/B/C on decisions 2–7 above (or "defaults"), and I'll land the pre-flip PR.
