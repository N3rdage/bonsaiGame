# Blog post backlog

Candidates for future blog posts — not commitments. Pick from this list when something memorable lands and one of these angles fits, or when the blog feels overdue. Add new entries as moments accumulate; remove entries once they ship (or once they go stale and clearly aren't going to).

Current published posts: see `blog/` (or the "Posts so far" list in the project memory).

## General candidates

- **The smallest fix in the project so far** — the hotspot-alignment fix (PR #12). Eight lines of code; extracted the `branch_point` helper; made the entire wire UX legible months later. Theme: invisible plumbing as the load-bearing kind.
- **Bonsai wire was correct and looked wrong** — pitch tuning saga (PR #19 + amend). Built the helix to real-bonsai math, looked like a compressed spring, backed off from 1.5× to 3× wire-diameter pitch. Realism in the model vs realism in perception; the renderer carries half the burden.
- **Three PRs for one feature** — splitting wire-removal across PRs #14 (core + the foliage hotfix), #16 (safety + UI), #17 (bookkeeping). The "small PR" discipline isn't about diff size — it's about keeping a feedback window open for surprise work to land.
- **The roadmap you didn't write before** — PR #13, the playability re-order moment. Mid-session pivot from feature work to planning. From "what next?" to "here's the path." How writing the list down changed what got prioritised.
- **How memory works** — the `.claude-memory/` system. How feedback rules accrete across sessions, how project memory differs from feedback memory, what doesn't get saved and why. Audience: people curious about AI-assisted dev mechanics specifically.
- **The partner who sleeps** — meta on async collaboration. Drew goes to bed; Claude doesn't. Sessions resume cold. The shape of feedback loops vs. real-time human pair programming.

## Math sub-series

A recurring sub-series on the geometry powering the visible game. Posts are tagged `[Math]` in the title, with `-math-` in the slug, for filtering. Pitched at high-school / early-uni readers — assume rough familiarity with `cos`/`sin` and don't be scared of an angle, but otherwise don't presume background.

**Convention:** keep at least the next 2–3 posts outlined here so each post can end with a teaser pointing at the next, and so we're always building toward a destination rather than picking ad hoc. When a post ships, drop it from this list and add a new candidate at the end to keep the buffer.

In sequence:

1. **[Math] Where does branch 3 actually start?** — the trunk-surface offset, the `branch_point(tree, branch, t)` helper. Same `cos`/`sin` as the just-shipped post, doing slightly more work: a branch's attachment angle plus the trunk's radius at the branch's height. Bridges from "circle in the abstract" to "circle as the cross-section of a real game object."
2. **[Math] The 3D viewer is mostly arithmetic** — series-checkpoint post. Walking tour of every kind of maths the viewer uses (trig, vectors, dot/cross products, projection matrices, parametric curves) with a one-paragraph teaser for each, anchored in screenshots from the actual game. Less worked example, more "here's the map." Sets up the deeper dives that follow.
3. **[Math] Wrapping wire round a branch** — local frames perpendicular to a branch direction; helix parametrisation; oriented rings via a cross-product basis. The maths from the wire-coil PR (#19). Linear algebra starts to earn its keep.
4. **[Math] Why the wired branch still looks straight** — `branch.bend` rotates the direction vector but the branch geometry stays a straight line. Sets up the Frenet-frame / parallel-transport TODO (currently #12, #13 in TODO.md). Calculus-curious readers welcome.
5. **[Math] The trunk movement array** — how trunk bending works today (lateral-shift accumulation at heights), why it looks wobbly, what proper parallel-transport would do instead.
6. **[Math] Z-up in a y-down world (deeper cut)** — projection matrix sign flips, lookat conventions, why GameMaker's 3D tutorials get this subtly wrong for non-toy scenes. Partial overlap with the upside-down-tree post; this version goes further into the linear algebra.
