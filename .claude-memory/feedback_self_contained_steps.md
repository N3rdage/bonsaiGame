---
name: feedback-self-contained-steps
description: "Written procedures must be self-contained; never say \"repeat steps 1-3 with these differences\"."
metadata:
  node_type: memory
  type: feedback
  originSessionId: fc24c824-ee71-4b2e-8314-e7d554c2af0e
  modified: 2026-11-08T06:03:56.170Z
---

When adding a procedure to docs or instructions, either interleave the new steps with the existing numbered steps or duplicate the steps in full. Never write "follow steps 1 through 3 but change these inputs".

**Why:** Drew found the "repeat section 1 with these differences" form of the reviewer-App setup confusing to follow while clicking through GitHub (2026-11-08).

**How to apply:** A reader should be able to follow any section top to bottom without flipping back. Repetition is fine; cross-references for *steps* are not. Cross-references for *background* (why, trade-offs) are still fine. Applies to runbooks, setup docs, PR bodies and chat instructions.
