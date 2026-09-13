# GitHub

Connect with `/PNW-github-connect <https://github.com/owner/repo>` and authenticate
through your Git credential helper outside chat. Connecting does not publish.

`/PNW-github` previews changed paths. `/PNW-github-push [message]` asks for
confirmation before publishing the exact preview. `/PNW-github-pull` performs a
fast-forward-only pull from a clean working tree. Never paste tokens into chat.

Old credentials can be inspected with `novel_github_credentials_cleanup` and
removed only after explicit approval. A rejected push never triggers force-push.
