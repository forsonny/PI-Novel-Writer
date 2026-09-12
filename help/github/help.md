# GitHub Integration — Help Reference

Commands: `/PNW-github`, `/PNW-github-connect <https-url>`,
`/PNW-github-push [message]`, `/PNW-github-pull`, and
`/PNW-github-clone <url> [directory]`.

Only HTTPS remotes are supported. A token must first be stored through
`novel_github_token_set`. The token is plain text in `.pi/github.json`; that file
is added to `.gitignore`, but this is not encrypted credential storage.

Connect initializes Git, creates an initial commit, sets `origin`, and pushes. If
Git reports a rejected/non-fast-forward push, connect retries with `--force`.
That can replace remote history. Use an empty repository unless you intentionally
accept that risk.

Push stages **all** changes, refreshes the novel project's generated README,
commits, and pushes. With no message, the command uses a small path-based heuristic;
it does not ask an AI to inspect the content. Pull is a plain `git pull` and does
not resolve conflicts. Clone creates a folder and prints the `/PNW-load` command;
it does not load automatically.

Autonomous writing blocks GitHub-changing tools. Publication, release management,
branch merging, conflict resolution, history restoration, and selective-file
commits are not implemented.
