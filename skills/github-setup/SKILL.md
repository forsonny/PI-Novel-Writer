---
name: github-setup
description: "Configure credential-free GitHub remotes and preview manuscript publication"
---
# GitHub setup

Use the author's Git credential helper for HTTPS authentication. Never request a
personal access token in chat or store credentials in project JSON or remote URLs.

`/PNW-github-connect <https://github.com/owner/repo>` configures the remote only.
It does not publish, stage files, overwrite README, or switch existing branches.
The repository must be rooted at the novel, not at an unrelated parent folder.

For old projects, `novel_github_credentials_cleanup` previews legacy token and
remote cleanup. Apply with `preview: false` only after explicit authorization.
This does not revoke tokens or erase prior history, backups, or conversations.

Use `novel_github_preview` to inspect eligible changed files. Private `.pnw` and
`.pi` state, credentials, and revision archives are excluded. Inspect the content
as well: path exclusion alone is not a comprehensive secret or rights audit.

`novel_github_push` without `expectedHash` is read-only. To publish, supply the
approved paths and the exact preview hash. Stale previews and unrelated staged
files are rejected. A failed network push preserves the local commit. Use
`novel_github_push_commit` with the reviewed `expectedHead` to retry that commit.

`/PNW-github-push [message]` displays the preview and asks for UI confirmation.
`/PNW-github-pull` requires a clean working tree and permits fast-forward only.
Divergence is an issue to inspect, never permission to force-push.

Autonomous writing does not authorize publication. Keep GitHub operations outside
the writing run unless separately authorized by the author.
