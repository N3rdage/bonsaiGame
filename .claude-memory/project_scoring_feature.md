---
name: Scoring feature in flight (TODO #1)
description: Where we are in the 4-PR aesthetic-scoring + display/sell-loop split — what's merged, what's next
type: project
originSessionId: ec517805-3cda-4230-a592-34238fcc6903
---
In-flight work on TODO #1 ("Aesthetic scoring + display/sell loop"). Agreed plan splits it into 4 PRs:

1. **Scoring math + inspector readout** — `scr_scoring.gml` with `score_tree()`, "Score: NN / 100" line + Show/Hide details toggle on the inspector. **Merged 2026-05-02 as PR #34** (commits `72e5f60` + `dd55355`). Polish commit also bumped starter foliage to 0.5, panel_h to 620, and breakdown line spacing to 22.
2. **Style conformance** — **Merged 2026-05-02 as PR #35** (commits `a0d706c` + `e0e296e` + `589a5f5`). Each style declares an optional `score(_tree) -> 0..1` function in `scr_styles_data`; `score_tree` adds it as a weighted criterion (weight 1.5). Three styles with real scoring (formal_upright, broom, windswept); three styles omit the function entirely (informal_upright, slanting, cascade) until trunk-curve data exists — see hitchhiker note on TODO #12.
3. **Sell mechanic** — **Merged 2026-05-02 as PR #36** (commits `b3161bd` + `980d7b1`). New `obj_ui_tree_sell_confirm` modal spawned from a Sell button on inspector row 2; price = `round(score * 2)` coins, banked into `global.money`. Soft-delete via `tree.location = "sold"` — tree struct stays in `global.all_trees` for future Sale History. Matching `obj_tree_sprite` is destroyed by struct-identity walk (avoids any `tree_index` reindex concern). Field `tree_score` instead of `score` to dodge the GM built-in.
4. **Display mechanic** — *next up*. Display slots in rooms, passive money trickle from displayed trees. **Includes** a money display in the UI (deferred from PR 3 — currently `global.money` is invisible to the player). Bookkeeping (TODO/ARCH/CLAUDE updates) rides this final PR.

**Why:** This sequence keeps each PR small enough to verify in-editor and answers the "does scoring give signal?" question before building economy on top of it. Style criteria comes second because the style picker UI already exists and currently does nothing — wiring it into score gives existing UI meaning.
