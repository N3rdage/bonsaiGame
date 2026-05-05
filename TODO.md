# TODO

Priority-ordered toward "playable." Security items always at top.

**Sizes are reference only.** Anything bigger than **M** needs splitting before or during planning; anything bigger than **S** is a candidate for splitting.

## Active

| # | Category | Name | Description | Size |
|---|---|---|---|---|
| 1 | UX | Tutorial / onboarding | Guide a new player through the first ~10 minutes: take a cutting, plant, water, skip a week, train, inspect 3D. Mentor character / scripted notebook / guided objectives — design TBD. | M |
| 2 | UX | Title screen + settings + save slots | Game currently launches straight into the shed with one fixed save. Add title screen, save-slot picker, settings (volume, fullscreen, etc.). Split candidates: title + settings, multi-save support. | M |
| 3 | Mechanics | Seasons + deeper care sim | Seasons (spring/summer/autumn/winter) affect growth and water decay; some operations become season-gated (e.g. no repotting in winter). Includes the repotting mechanic itself plus pot size / soil affecting vigor. Split candidates: season clock + visuals, repotting, pot/soil effects, season-gated operations. | XL |
| 4 | Mechanics | Seeds | Seed collection + planting (maple / pine only propagate from seed). Tree starts as a 2cm sprout. | L |
| 5 | Content | More species playable | Beyond juniper-from-cuttings: maple and pine via seeds (post-#4), plus per-species care quirks (e.g. pine candling) and mesh tweaks (leaf shape, bark colour). | L |
| 6 | Content | House interiors | Indoor rooms (lounge, study, hallway) for displaying finished trees. Pedestals currently live in the shed as a stopgap; they migrate here when interiors land. | L |
| 7 | Content | Greenhouse room + building system | Grid-based wall/shelf placement so the player can lay out their greenhouse interior. Split candidates: empty greenhouse room, item placement system, item catalogue. | L |
| 8 | Polish | Audio pass | Currently silent. SFX (water, snip, footsteps, UI clicks) + ambient music per room. Split candidates: SFX layer, music layer, mixer/settings hook. | L |
| 9 | Polish | Foliage texture with alpha | Currently cross-billboard solid quads — looks cubic. Replace with a leaf texture with alpha cutoff. | M |
| 10 | Polish | Proper trunk-bending math | Current lateral shift is wobbly; needs Frenet / parallel-transport frames so wired trunks curve naturally instead of leaning. **Hitchhiker:** unlocks real style-conformance scoring for informal_upright, slanting, and cascade — currently stubbed to 1.0 in `scr_styles_data` because no morphology field captures trunk lean/curve or downward-growing branches. | L |
| 11 | Polish | Proper branch-curvature math | `branch.bend` currently rotates the whole branch direction (`angle + bend`) but the branch itself stays a straight line. Wired branches need to curve along their length so wiring is visually legible. Same fix family as #10 (trunk uses `movement[]`, branches use a single `bend` scalar — separate code paths). | L |
| 12 | Polish | Art pass | Replace placeholder sprites and 3D textures with cohesive art. Last item — only when systems are stable. Likely split per-asset-type or per-room. | XL |

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
| — | Mechanics | Wire removal UI | Click a wired hotspot in 3D viewer's wire mode → confirmation modal → spring-back vs permanent based on age. Filter sub-row to show/hide wired or unwired hotspots. New `ui_toggle` helper in `scr_ui`. Bonus: stable-foliage-seed fix to stop the whole tree jittering on every mesh rebuild. | M | 3 PRs (#14, #15, #16) |
| — | Polish | Visible wire on wired branches in 3D viewer | Copper helix wraps wired branches; thickness/pitch scale with branch girth and bend severity. Trunk-side anchor wrap added for realism. New helpers `add_wire_coil`, `add_wire_anchor`, `build_oriented_ring` in `scr_bonsai_mesh`. | M | 2 PRs (#19, this) |
| — | UX | Inventory + tree-naming UI | New `obj_ui_inventory` (read-only readout, `I` to toggle, three category sections) and `obj_ui_tree_rename` (modal text-input dialog using `keyboard_string`, 20-char limit, spawned from a Rename button on the tree inspector). | M | 2 PRs (this PR + previous) |
| — | Mechanics | Tree styles & training goals | New `scr_styles_data` defining six traditional bonsai styles (formal upright, informal upright, slanting, cascade, broom, windswept). New `target_style` field on `BonsaiTree` (save/load roundtrip, backward-compatible). New `obj_ui_tree_style_picker` modal spawned from a Set Style button on the tree inspector; current style now shown in the inspector's stat rows. | L | 2 PRs |
| — | Mechanics | Aesthetic scoring + display/sell loop | New `scr_scoring` with `score_tree()` returning 0–100 from six MVP criteria (taper, proportion, branch count, angular spread, vertical spread, foliage) modulated by vitality, plus an optional 7th style-conformance criterion (weight 1.5) per `scr_styles_data` style. Score readout on the tree inspector with a Show/Hide details breakdown. Sell button → confirm modal → `round(score * 2)` coins; soft-delete via `tree.location = "sold"`. Display pedestals (`obj_pedestal` + `obj_ui_pedestal`) keyed by per-instance `pedestal_key`; trees on display use `tree.location = "displayed:" + key`; each pays `round(score * 0.1)` coins/day via the `advance_day_all_trees` tick. Money visible top-right via a new game-controller Draw GUI event and in the inspector footer. | XL | 4 PRs (#34, #35, #36, #37 + this) |
| — | Mechanics | Shop & money sink | Closes the economy loop. PR1: real consumption — `apply_wire`/`wire_trunk` decrement `inventory.wire`; new `Fertilize` button on the inspector consumes 1 fertilizer and grants the tree a 7-day 1.5x growth window via a new `fertilized_until_day` field on `BonsaiTree` (save/load roundtripped, backward-compat). PR2: scaffolding — new `obj_shop_kiosk` (in shed) opens `obj_ui_shop` listing item / price / owned / Buy per row. New `scr_shop` with `init_shop_catalogue` and `shop_buy(key, qty, unit_price)`. PR3: catalogue + balancing — final prices (clay $4, pot $12, wire $8, fertilizer $10, fancy pot $80), new `pot_tier` field on `BonsaiTree` for fancy pots (×1.25 display revenue), Use-fancy-pot toggle in the planting panel. | L | 3 PRs (#40, #41, this) |
