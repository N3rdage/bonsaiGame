---
name: fresh-blog-material-ready-look-and-feel-pass
description: 2026-06-08 look-and-feel material — 3 of 4 posts shipped (PR #75); only the Fonts post remains undrafted. Delete once it ships.
metadata: 
  node_type: memory
  type: project
  originSessionId: 02e3b647-86d9-4e10-be13-083c57bbb8c5
---

The 2026-06-08 "look-and-feel" pass (real sprite art across both rooms, a `fnt_main` font, full 960×540 resolution independence, the cozy shed, decor) left **ready blog material**. Three of the four candidate posts shipped in PR #75 (art, scaling, and the `[Math]` coordinate-systems post). **One remains undrafted:**

- **The font saga** — "Why is my text shouting?" — beats are in `blog/_material-2026-06-08-look-and-feel.md` §2: the default font huge at the new resolution; a small font that did *nothing* (draw-font state doesn't carry across GameMaker's passes → set it in every text event; the panel parent covers all modals in one line); then `draw_text_transformed` *mangling* the bitmap font. Two failure modes, one feature. Matching `blog/BACKLOG.md` entry is still listed.

**When Drew next says "let's blog":** the Fonts post is the warm lead. Follow [[project_blog]] (propose 3 angles before drafting). It wants the garbled-font-labels screenshot (the `draw_text_transformed` mangling) — source screenshots live in `F:\.debug\` at 3840×1080; crop/downscale (PowerShell `System.Drawing` works; PIL/ImageMagick aren't available locally) into `blog/images/`. Don't feed raw full-size shots into context — they blow it.

Delete this memory once the Fonts post ships.
