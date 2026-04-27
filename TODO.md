# TODO

Priority-ordered toward "playable." Security items always at top.

**Sizes are reference only.** Anything bigger than **M** needs splitting before or during planning; anything bigger than **S** is a candidate for splitting.

## Active

| # | Category | Name | Description | Size |
|---|---|---|---|---|
| 1 | Mechanics | Wire removal UI | Wires stay applied indefinitely; add an action to remove them. Sim already supports "set permanently after 56d" vs spring-back; just needs the UI hook. (See `feedback_save_compatibility` for save-format impact.) | M |
| 2 | Polish | Visible wire on wired branches in 3D viewer | Render coiled wire mesh on wired branches, scaling with branch girth. Mesh-only change — sim doesn't move. Pairs with #1. | M |
| 3 | UX | Inventory + tree-naming UI | Player can see their inventory (clay, pots, fertilizer, wire, cuttings/seeds) and rename trees. `BonsaiTree.name` field already exists with no UI to set it. | M |
| 4 | Mechanics | Tree styles & training goals | Player picks a target style per tree (formal upright, slanting, cascade, broom, etc.). Drives aesthetic-scoring criteria in #5 and gives the player direction. Split candidates: style data model, per-tree style-assignment UI, style-specific scoring rubric. | L |
| 5 | Mechanics | Aesthetic scoring + display/sell loop | Score tree quality from morphology (taper, branch placement, foliage balance, style conformance). Display trees indoors for passive payoff, or sell at the shop for a one-shot reward. The "why" for the entire sim. Needs splitting into: scoring math, display mechanic, sell mechanic. | XL |
| 6 | Mechanics | Shop & money sink | Shop selling seeds, pots, fertilizer, wire, rare species, tools. Closes the economy loop with #5. Split candidates: shop UI, shop content/balancing. | L |
| 7 | UX | Tutorial / onboarding | Guide a new player through the first ~10 minutes: take a cutting, plant, water, skip a week, train, inspect 3D. Mentor character / scripted notebook / guided objectives — design TBD. | M |
| 8 | UX | Title screen + settings + save slots | Game currently launches straight into the shed with one fixed save. Add title screen, save-slot picker, settings (volume, fullscreen, etc.). Split candidates: title + settings, multi-save support. | M |
| 9 | Mechanics | Seasons + deeper care sim | Seasons (spring/summer/autumn/winter) affect growth and water decay; some operations become season-gated (e.g. no repotting in winter). Includes the repotting mechanic itself plus pot size / soil affecting vigor. Split candidates: season clock + visuals, repotting, pot/soil effects, season-gated operations. | XL |
| 10 | Mechanics | Seeds | Seed collection + planting (maple / pine only propagate from seed). Tree starts as a 2cm sprout. | L |
| 11 | Content | More species playable | Beyond juniper-from-cuttings: maple and pine via seeds (post-#10), plus per-species care quirks (e.g. pine candling) and mesh tweaks (leaf shape, bark colour). | L |
| 12 | Content | House interiors | Indoor rooms (lounge, study, hallway) for displaying finished trees. Display areas / shelves connect to the display loop in #5. | L |
| 13 | Content | Greenhouse room + building system | Grid-based wall/shelf placement so the player can lay out their greenhouse interior. Split candidates: empty greenhouse room, item placement system, item catalogue. | L |
| 14 | Polish | Audio pass | Currently silent. SFX (water, snip, footsteps, UI clicks) + ambient music per room. Split candidates: SFX layer, music layer, mixer/settings hook. | L |
| 15 | Polish | Foliage texture with alpha | Currently cross-billboard solid quads — looks cubic. Replace with a leaf texture with alpha cutoff. | M |
| 16 | Polish | Proper trunk-bending math | Current lateral shift is wobbly; needs Frenet / parallel-transport frames so wired trunks curve naturally instead of leaning. | L |
| 17 | Polish | Proper branch-curvature math | `branch.bend` currently rotates the whole branch direction (`angle + bend`) but the branch itself stays a straight line. Wired branches need to curve along their length so wiring is visually legible. Same fix family as #16 (trunk uses `movement[]`, branches use a single `bend` scalar — separate code paths). | L |
| 18 | Polish | Art pass | Replace placeholder sprites and 3D textures with cohesive art. Last item — only when systems are stable. Likely split per-asset-type or per-room. | XL |

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
| — | Game | Tune branch-hotspot positions in 3D viewer | Extracted shared `branch_point(tree, branch, t)` helper; mesh builder and hotspots now share one formula. | S | 1 PR |
