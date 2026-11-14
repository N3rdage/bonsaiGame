---
name: no-identifiers-in-public-repo
description: "This repo is public: never write account names, tenant or subscription names, cloud resource names, App ids, hostnames of private systems or Drew's location into memory files, docs, PR text, commit messages or blog posts here."
metadata:
  node_type: memory
  type: feedback
---

Nothing that identifies Drew's accounts or infrastructure goes into this repository: no sign-in names or email addresses, no tenant, subscription or resource-group names, no resource or App ids, no private hostnames, and nothing about where Drew is beyond what the blog rules already allow (first name only). That covers `.claude-memory/`, docs, PR titles and bodies, commit messages, code comments and blog posts.

**Why:** memory files written here during the platform's setup named all of those, and a security audit on 2026-11-14 found them in a public repo. They had to be moved to the private repo and scrubbed from history.

**How to apply:** when a note needs such a detail, write the note in the private `N3rdage/agentic-gaming` repo (`docs/operator-memory/`) and, if useful, leave a pointer here that names no identifier. In public text say "the operator account", "the platform's subscription", "Drew's local time". See [[private-operator-notes]].
