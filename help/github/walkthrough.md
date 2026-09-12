# GitHub Integration — Walkthrough

1. Create a private **empty** GitHub repository.
2. Create a fine-grained token limited to that repository with Contents read/write,
   or a classic token with appropriate repository access.
3. Ask the AI to save it with `novel_github_token_set`. The token is stored locally
   in plain text, not encrypted.
4. Run `/PNW-github-connect <https-url>`. Do not use this on a remote with history
   you need to preserve: a rejected initial push can trigger a force push.
5. Run `/PNW-github` and verify branch, remote and changed-file count.
6. For later work, pull before editing and push afterward. Pull conflicts require
   manual resolution. Push includes every changed/untracked file and may rewrite the
   generated project README.
7. After a network operation, inspect or reset `origin` to the clean HTTPS URL if
   you do not want the token retained in local Git configuration.

`/PNW-github-clone` only clones and prints how to load the result. Save credentials
again on the new machine. GitHub actions are not authorized during autonomous runs.
