---
name: Scoring feature in flight (TODO #1)
description: Where we are in the 4-PR aesthetic-scoring + display/sell-loop split — what's merged, what's next, the open tweak
type: project
originSessionId: ec517805-3cda-4230-a592-34238fcc6903
---
In-flight work on TODO #1 ("Aesthetic scoring + display/sell loop"). Agreed plan splits it into 4 PRs:

1. **Scoring math + inspector readout** — `scr_scoring.gml` with `score_tree()`, "Score: NN / 100" line + Show/Hide details toggle on the inspector. Branch `scoring-mvp`, committed locally 2026-05-02. Drew pushing + merging while away.
2. **Style conformance** — extend `scr_styles_data` with per-style target ranges (taper, lean, branch direction bias, etc.) and plug into `score_tree` as another weighted criterion alongside the six MVP ones.
3. **Sell mechanic** — Sell button on inspector → confirm → score→money formula → remove tree from `global.all_trees`.
4. **Display mechanic** — display slots in rooms, passive money trickle from displayed trees. Bookkeeping (TODO/ARCH/CLAUDE updates) rides this final PR.

**Why:** This sequence keeps each PR small enough to verify in-editor and answers the "does scoring give signal?" question before building economy on top of it. Style criteria comes second because the style picker UI already exists and currently does nothing — wiring it into score gives existing UI meaning.

**How to apply:** When Drew says "let's continue" (or similar resume), first verify the PR 1 merge per `feedback_verify_merge` (`git fetch` + check origin SHA, then pull + delete `scoring-mvp` branch). Then start PR 2 unless Drew redirects.

**Open tweak surfaced during PR 1:** the starter tree is constructed with `origin = "seed"` so its `foliage_density` stays at 0.1 even though it's a fully-formed 25cm tree with 4 branches, which drags its score. Either bump foliage in `obj_game_controller` Create or widen the foliage band in `score_tree`. Ask Drew before doing this — it's a balance call, not an obvious bug.
