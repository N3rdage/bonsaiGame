---
name: Save-file compatibility
description: Changes to BonsaiTree or scr_save_load must keep existing save1.json files loadable. Flag any breaking change explicitly.
type: feedback
originSessionId: ea7bf55b-43b2-4736-8b01-70a80594d6b6
---
The game serializes full game state to JSON (`%LOCALAPPDATA%\BonsaiGame\save1.json`). Once the game has real play state, losing a save to a schema change is worse than delaying a feature.

**Why:** This is the BonsaiGame analogue of migration safety — Drew and any future players have saved trees, training history, and inventory state that must survive code changes. A silent load failure that blanks a save is unacceptable.

**How to apply:**
- When adding a field to `BonsaiTree` (or any nested struct like `trunk`, a branch, a training history entry), give it a sensible default in the constructor AND make sure `load_game` tolerates its absence on old saves (use `variable_struct_exists` / `??` defaults, not blind assignment).
- When removing or renaming a field, state this explicitly in the plan as a breaking change. Consider a one-shot migration path in `load_game` that reads the old field name and writes the new one.
- When touching `scr_save_load`, mention in the handoff: "save format changed / unchanged — old saves still load / need re-creation".
- Mesh cache is already invalidated on load — keep that invariant. Anything else derived (not stored) should be rebuilt on demand, not serialized.

Flag any change in the plan phase if it risks breaking existing saves.
