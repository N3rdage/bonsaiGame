---
name: Scoring feature in flight (TODO #1)
description: Where we are in the 4-PR aesthetic-scoring + display/sell-loop split — what's merged, what's next
type: project
originSessionId: ec517805-3cda-4230-a592-34238fcc6903
---
In-flight work on TODO #1 ("Aesthetic scoring + display/sell loop"). Agreed plan splits it into 4 PRs:

1. **Scoring math + inspector readout** — `scr_scoring.gml` with `score_tree()`, "Score: NN / 100" line + Show/Hide details toggle on the inspector. **Merged 2026-05-02 as PR #34** (commits `72e5f60` + `dd55355`). Polish commit also bumped starter foliage to 0.5, panel_h to 620, and breakdown line spacing to 22.
2. **Style conformance** — *next up*. Extend `scr_styles_data` with per-style target ranges (taper, lean, branch direction bias, etc.) and plug into `score_tree` as another weighted criterion alongside the six MVP ones.
3. **Sell mechanic** — Sell button on inspector → confirm → score→money formula → remove tree from `global.all_trees`.
4. **Display mechanic** — display slots in rooms, passive money trickle from displayed trees. Bookkeeping (TODO/ARCH/CLAUDE updates) rides this final PR.

**Why:** This sequence keeps each PR small enough to verify in-editor and answers the "does scoring give signal?" question before building economy on top of it. Style criteria comes second because the style picker UI already exists and currently does nothing — wiring it into score gives existing UI meaning.
