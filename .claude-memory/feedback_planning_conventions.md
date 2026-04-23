---
name: Feature planning conventions
description: Plan before implementing. Suggest PR breakdowns for medium+ features. Flag complex changes (5+ files).
type: feedback
originSessionId: ea7bf55b-43b2-4736-8b01-70a80594d6b6
---
Always plan before implementing, even for small changes. If Drew doesn't use the `plan:` prefix, plan anyway — narrate the plan in the first message, then ship. For truly trivial items (typo, single-line fix), note it may not have needed the plan phase but still briefly state what you're about to do.

**PR breakdown:** Suggest a PR breakdown for medium+ complexity features. Small changes can be a single PR. Prefer one concern per PR; bundle multiple concerns only when separating them would be more complex, or total impact is small (≤3 files).

**Complexity callout:** If a change is complex or touches 5+ files, explicitly flag it as a complex task in the plan.

**Plan shape:**
- What changes, broken into logical sections
- New/modified files
- Open questions with suggested defaults
- PR breakdown (for medium+ features)
- Save-file compatibility impact if the change touches `BonsaiTree` fields or `scr_save_load` (see `feedback_save_compatibility`)

**Why:** Planning catches issues early and aligns scope before code is written. Drew reads diffs; unplanned sprawl wastes both our time.

**How to apply:** Every non-trivial feature request gets a plan proposal first. Flag complexity, suggest PR splits for medium+ work.
