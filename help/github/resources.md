# GitHub Integration — Resources

`.pi/github.json` stores `token`, clean `remote`, and `branch`. It is gitignored,
not encrypted. The current implementation injects the token into `origin` before
network operations and does not reliably restore the clean URL afterward. Treat
`.git/config` as sensitive until you replace the remote with the clean HTTPS URL.

The status tool reports repository root, branch, sanitized remote, last commit,
and up to twenty changed-path status lines. Push stages all files. Connect may
force-push after a rejected/non-fast-forward initial push. Pull delegates conflict
handling to Git.

Supported: HTTPS PAT authentication, one saved branch, clone/connect/status/push/
pull. Not supported: SSH, credential-manager integration, encrypted token storage,
selective commits, conflict resolution, branch management, publication, or remote
history recovery.
