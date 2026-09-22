# GitHub resources

Use the `github-setup` skill for the credential-helper and preview workflow.
The tools are `novel_github_preview`, `novel_github_connect`,
`novel_github_push`, `novel_github_push_commit`, `novel_github_pull`, and
`novel_github_credentials_cleanup`. The legacy token setter no longer stores tokens.

Publication selection excludes `private/` folders (including evaluation keys and
frozen inputs) and `manuscript-*.manifest.json` records, even when explicitly
requested. Reader packets and manuscript Markdown/DOCX are eligible only when
otherwise allowed; new exports remain ignored by default. This selection rule
does not certify unpublished local history: do not push a history containing
private material. The separate outgoing-history audit finding remains unresolved.
