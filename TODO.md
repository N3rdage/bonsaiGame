# TODO

Priority-ordered. Security items always at top; then ascending size.

## Active

| # | Category | Name | Description | Size |
|---|---|---|---|---|
| 1 | Game | Tune branch-hotspot positions in 3D viewer | Mesh builder offsets branches to trunk surface; hotspot math uses simplified version. | S |
| 2 | Game | Wire removal UI | Wires stay applied indefinitely; add an action to remove them (see `feedback_save_compatibility` for save-format impact). | M |
| 3 | Game | Visible wire on wired branches in 3D viewer | Currently wires bend branches invisibly. | M |
| 4 | Game | Foliage texture with alpha | Currently cross-billboard solid quads — looks cubic. | M |
| 5 | Game | Proper trunk-bending math | Current lateral shift is wobbly; needs Frenet / parallel-transport frames. | L |
| 6 | Game | Seeds | Seed collection + planting (maple / pine only propagate from seed). | L |
| 7 | Game | Greenhouse room + building system | Grid-based wall/shelf placement. | L |

## Shipped

| # | Category | Name | Description | Size | Actual |
|---|---|---|---|---|---|
| — | Infra | Flatten repo structure | Move GameMaker project out of nested `BonsaiGame/` subfolder. | S | 1 PR (#2) |
| — | Infra | Add CLAUDE.md | Guidance for Claude Code sessions. | S | 1 PR (#2, bundled) |
| — | Infra | Move memory into repo | `.claude-memory/` junction-linked; versioned with code. | S | 1 PR (#3) |
| — | Blog | First post | "The Tree Was Upside Down and So Was I". | M | 2 PRs (#4, #6) |
| — | Infra | Rewrite git history to unify author identity | Scrub old work email from history. | S | 1 PR (manual, no PR number) |
| — | Infra | Going-public plan | Audit + decision doc. | S | 1 PR (#7) |
| — | Infra | Pre-flip hygiene | files.zip delete, README About header, memory softening, gitleaks CI, issue + PR templates, TODO.md. | M | 1 PR (#8) |
| — | Post-flip | Configure branch protection | Ruleset on `main`: require PR, Drew on bypass, block force-push + deletions. | S | UI click (no PR) |
| — | Post-flip | Enable Code security features | Secret scanning, push protection, private vulnerability reporting, CodeQL, Dependabot alerts + security updates. | S | UI click (no PR) |
| — | Post-flip | Features settings | Issues on, Wiki/Projects/Discussions off. | XS | UI click (no PR) |
| — | Post-flip | Repo flipped to public | Settings → Danger Zone → Change visibility. | XS | UI click (no PR) |
