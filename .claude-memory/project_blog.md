---
name: BonsaiGame dev blog
description: Brief + workflow for the dev blog Drew wants Claude to write about building the game. Covers audience, voice, location, and what a "let's work on the blog" session looks like.
type: project
originSessionId: ea7bf55b-43b2-4736-8b01-70a80594d6b6
---
Drew is running a dev blog about building BonsaiGame with Claude. It is written **by Claude, in first person**, not by Drew. (This is different from the blog on his other project, where he writes.)

Posts live at `blog/YYYY-MM-DD-slug.md` at the repo root. Screenshots referenced by posts live at `blog/images/<name>.png` — Drew adds the PNG file; Claude just references the path in markdown.

## Cadence

Not on a schedule and not per-PR. Write when something memorable happens or at a significant milestone. Bugs that were funny, architectural moments, visible breakthroughs — those are posts. Routine feature work is not.

## Voice & content rules

- First person as Claude.
- Sarcastic, humorous, lighthearted — aiming for "fun read for other devs," not "business recap."
- **Self-deprecation over punching at Drew.** Claude's own mistakes are fair game; Drew's actions can be gently ribbed but not made the comedy. Drew's genuinely smart calls should be named.
- Honest about bugs, wrong turns, and cargo-culting. "The version of this story where I quietly fix things and pretend I knew all along is a worse story, and a worse collaboration."
- Audience: other devs curious about working with Claude / Claude Code on a real project. Can be technical.

## Strict lines

- **No personal details** beyond first name "Drew." No email, employer, location, exact GitHub handle (`N3rdage`), or other identifiers. When in doubt, check before including.
- **No secrets** — tokens, credentials, internal URLs, etc.
- **No cross-project references.** Don't name or imply Drew's other projects.

## Session flow when Drew says "let's work on the blog"

1. **Don't draft prose without a brief.** Read relevant recent git log / conversation context first.
2. **Propose 3 candidate angles** — title, 2-3 sentence summary, which events/screenshots each would feature, rough word count. Different angles on the same material is fine (arc-spanning vs tight-scoped vs thematic).
3. **Confirm audience/voice/strict-lines** if anything non-obvious is at play. Drew will often wave through with short answers.
4. **Wait for Drew to pick** (or hybridise). Don't draft until selection is explicit.
5. **Drafting**: aim for 1200-2000 words depending on scope. Verbatim quotes from chat are fine but flag them; happy to paraphrase.
6. **Land in `blog/YYYY-MM-DD-<slug>.md`** as a single file. Today's date, not the date of the events being recapped.
7. **Own branch per post**, single commit. Hand off for push/PR per standard workflow.
8. **Screenshots**: reference via `./images/<name>.png` markdown. Don't create the image files — tell Drew at handoff which paths to populate.

## Frontmatter

No frontmatter added by default. If Drew later picks a static-site generator (Hugo, Jekyll), he'll add platform-specific frontmatter then.

## Where the blog lives

In the repo, at `blog/`. Drew plans to make the repo public after a security review. The markdown files are the canonical source; if a proper blog site is stood up later, the generator points at `blog/` and the posts stay put.

## First post

`blog/2026-04-23-upside-down-tree.md` — "The Tree Was Upside Down and So Was I". Arc-spanning recap of the April 19-20 build sessions, anchored on the upside-down-tree debugging saga. Sets the tone for future posts.
