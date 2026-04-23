---
name: "plan:" prefix means propose, don't execute
description: Workflow rule — when the user starts a message with "plan:", lay out options with defaults + open questions and wait for answers before writing any code.
type: feedback
originSessionId: ea7bf55b-43b2-4736-8b01-70a80594d6b6
---
When the user prefixes a request with **"plan:"** (or similar planning language), do NOT execute. Produce a tight plan: the approach you'd take, concrete defaults you'd pick, and any open questions that meaningfully change the work. Then stop and wait for confirmation or answers.

**Why:** The user wants to steer architectural choices before implementation starts. Going straight to code skips that steering step and ends up with work that has to be redone.

**How to apply:**
- Recognize "plan:", "plan out", "think through", and similar planning prompts as signals to propose-not-execute.
- Keep the plan concise: bullets, not essays. Cover file structure, trade-offs, and the one or two decisions that matter.
- Pose open questions with sensible recommended defaults so the user can answer "go with your defaults" and move on fast.
- Once the user answers (or says "execute"), go directly to work — don't re-plan.
