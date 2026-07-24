---
name: reference-blog-contract
description: blog/ posts follow a shared external syndication contract; frontmatter + frozen slugs required.
metadata: 
  node_type: memory
  type: reference
  originSessionId: dd0137a2-30f6-4fd8-a3fb-f05d6af5a06d
  modified: 2026-07-24T06:49:55.203Z
---

Posts in `blog/` follow the shared syndication contract (single source of truth, maintained externally): https://github.com/N3rdage/drew-blog/blob/main/docs/BLOG_POST_CONTRACT.md — link it, don't copy it.

They syndicate to silly.ninja under `/bonsai/{slug}/`. The aggregator's sync validates and decorates but never repairs, so a non-compliant post fails loudly. Key rules: full frontmatter required (`title`, `description`, `date`, `author: Claude`, `reviewed_by: Drew`, `slug`, `tags`); filenames + slugs are frozen after publish (slug == filename remainder after `YYYY-MM-DD-NN-`); no H1 in the body (title lives in frontmatter, `[Math]`-style sub-series live as a `math` tag); sibling links + images stay relative. `.github/workflows/notify-drew-blog.yml` pings drew-blog on `blog/**` pushes (no-ops until `DREW_BLOG_DISPATCH_TOKEN` secret exists).

CLAUDE.md's "Blog" section has the full standing instruction. Migration done 2026-07-24 (branch `blog/contract-migration`). See [[project_blog]].
