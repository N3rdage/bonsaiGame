# TODO

Priority-ordered. Security items always at top; then ascending size.

## Active

| # | Category | Name | Description | Size |
|---|---|---|---|---|
| 1 | Post-flip | Configure branch protection | Settings → Branches → Add ruleset: require PR, no approvals, Drew on bypass list, block force-pushes + deletions. | S |
| 2 | Post-flip | Enable Code security features | Secret scanning, push protection (verify auto-on), private vulnerability reporting, CodeQL default config, Dependabot alerts + security updates. | S |
| 3 | Post-flip | Features settings | Issues on, Discussions off, Wiki off, Projects off. | XS |
| 4 | Game | Wire removal UI | Wires stay applied indefinitely; add an action to remove them (see `feedback_save_compatibility` for save-format impact). | M |
| 5 | Game | Seeds | Seed collection + planting (maple / pine only propagate from seed). | L |
| 6 | Game | Greenhouse room + building system | Grid-based wall/shelf placement. | L |
| 7 | Game | Visible wire on wired branches in 3D viewer | Currently wires bend branches invisibly. | M |
| 8 | Game | Proper trunk-bending math | Current lateral shift is wobbly; needs Frenet / parallel-transport frames. | L |
| 9 | Game | Foliage texture with alpha | Currently cross-billboard solid quads — looks cubic. | M |
| 10 | Game | Tune branch-hotspot positions in 3D viewer | Mesh builder offsets branches to trunk surface; hotspot math uses simplified version. | S |

## Shipped

| # | Category | Name | Description | Size | Actual |
|---|---|---|---|---|---|
| — | Infra | Flatten repo structure | Move GameMaker project out of nested `BonsaiGame/` subfolder. | S | 1 PR (#2) |
| — | Infra | Add CLAUDE.md | Guidance for Claude Code sessions. | S | 1 PR (#2, bundled) |
| — | Infra | Move memory into repo | `.claude-memory/` junction-linked; versioned with code. | S | 1 PR (#3) |
| — | Blog | First post | "The Tree Was Upside Down and So Was I". | M | 2 PRs (#4, #6) |
| — | Infra | Rewrite git history to unify author identity | Scrub old work email from history. | S | 1 PR (manual, no PR number) |
| — | Infra | Going-public plan | Audit + decision doc. | S | 1 PR (#7) |
