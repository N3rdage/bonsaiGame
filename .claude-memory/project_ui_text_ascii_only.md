---
name: project_ui_text_ascii_only
description: "BonsaiGame UI text renders in GameMaker's built-in font, which only covers ASCII — non-ASCII glyphs (em-dash, curly quotes) render as blank gaps. Use plain ASCII in any displayed string."
metadata: 
  node_type: memory
  type: project
  originSessionId: 9a843464-9fc6-4d58-be60-7740d10aa0eb
---

The game defines **no font asset** and never calls `draw_set_font`, so every drawn string uses GameMaker's built-in fallback font. That font only covers basic ASCII — non-ASCII glyphs like the em-dash (`—`, U+2014), en-dash, or curly quotes render as an invisible blank gap, not the character.

**Why:** This has caught us out twice. Most recently the tree-inspector status callouts ("Dormant — …", "Repot: cooldown — …", "Low vigor — …") showed a gap where the dash should be; fixed in PR #63 by swapping `—` for `" - "`. A screenshot is what exposed it both times — it's invisible when you only read the source, because the em-dash looks fine in the editor.

**How to apply:** Use plain ASCII in anything that gets *drawn* — `draw_text` / `draw_text_ext` strings, and `ui_button` / `ui_toggle` / panel labels. Prefer `" - "` over `"—"` (matches the existing tutorial-text convention), straight quotes over curly. Comments and `show_debug_message(...)` are exempt — the console and source files render Unicode fine; only the in-game font is the constraint. If in-game non-ASCII text ever becomes genuinely necessary, the real fix is adding a font asset with an extended glyph range rather than avoiding the character.
