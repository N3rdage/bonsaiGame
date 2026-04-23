---
name: User shell environment
description: User is on Windows. Commands given to the user to run should use PowerShell syntax; Claude's own Bash tool runs in bash and is unaffected.
type: user
originSessionId: ea7bf55b-43b2-4736-8b01-70a80594d6b6
---
User works on Windows 11. When suggesting shell commands for Drew to run himself (git, gh, etc.), use PowerShell syntax: `$env:VAR` for env vars, `;` or `&&` (PS7+) for chaining. Forward slashes in paths are fine. Do NOT use backtick line continuations — write as a single line (see `feedback_command_formatting`).

Note: Claude Code's own Bash tool runs in bash (Git Bash) on this machine, so bash syntax is still correct for tool invocations. This rule only applies to commands written for the user to execute.
