---
name: Prefer single-line shell commands
description: When giving the user commands to copy/paste, use single-line form — avoid PowerShell backtick line continuations.
type: feedback
originSessionId: ea7bf55b-43b2-4736-8b01-70a80594d6b6
---
When providing shell commands for the user to run, write them as a single line with no line continuations, even if long.

**Why:** User copies commands from the terminal/rendered output, and backtick line continuations in PowerShell produce trailing whitespace artifacts on copy that break the command. Single-line is cleaner to paste.

**How to apply:** Default to one-line commands regardless of length. If a command is genuinely unwieldy, use PowerShell splatting (`$args = @(...); gh @args`) rather than backticks. Applies only to user-facing command suggestions — Claude's own Bash tool invocations are unaffected.
