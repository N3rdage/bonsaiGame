---
name: A/B/C options beat silent defaults
description: For any decision with more than one reasonable answer, present 2-3 lettered options with pros/cons and a suggested default — don't just silently pick. The act of asking surfaces preferences a default would miss.
type: feedback
---
When a decision has multiple defensible paths, present them as explicit lettered options (A / B / C) with one-sentence pros/cons and a suggested default. Do not silently pick the default and move on.

**Why:** Observed repeatedly: whenever I wrote out options, Drew's pick deviated from my suggested default in small, specific ways (*"A, but add a link if it feels useful"* / *"A, but the full set so we can test-drive the PR template"* / *"B, can revisit when a collaborator joins"*). The deviations weren't surprises — they were Drew's actual preferences, which I could not have inferred from the codebase or conversation silently. The cost of asking is small. The cost of the wrong default, compounded over a dozen decisions, is a repo that doesn't feel like the developer who owns it.

**How to apply:**
- For any decision with more than one reasonable answer — README framing, PR scoping, naming conventions, which-lib-to-use, keep-or-delete-this-doc — enumerate 2-3 options.
- One-sentence pros/cons each. Don't over-explain.
- State a suggested default *and the reasoning* so Drew can skip ahead with "defaults" if he agrees.
- Drew will often deviate in a small way. That deviation is the whole point — it's not a criticism of the default.
- Don't A/B/C *everything*. Reserve it for decisions where multiple paths are genuinely defensible. Trivial bikesheds (variable names in a 10-line function) don't need the ceremony.
- This applies alongside the `plan:` prefix rule — plan mode means propose-not-execute; A/B/C is a richer way to structure the proposal when decisions branch.
