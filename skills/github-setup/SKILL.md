---
name: github-setup
description: Connect a novel project to GitHub with explicit credential and history warnings
---

# GitHub Setup for Your Novel

Use this only in supervised work. Autonomous writing does not authorize remote
changes.

1. Confirm Git is installed and the novel is loaded.
2. Ask the author to create a private, empty GitHub repository. Explain that the
   connect command can force-push after a rejected initial push and may replace
   existing remote history.
3. Ask the author to create a repository-limited fine-grained token where possible.
4. With approval, store it through `novel_github_token_set`. State clearly that the
   token is plain text in a gitignored local file, not encrypted.
5. Run `/PNW-github-connect <https-url>` only after the author confirms the remote
   is empty or its history may be replaced.
6. Verify with `/PNW-github`.
7. Warn that push stages all changes, pull does not resolve conflicts, clone does
   not load automatically, and the authenticated remote may remain in local Git
   configuration. Offer to restore the clean HTTPS remote after network work.

Do not claim secure credential storage, automatic backup, automatic conflict
resolution, selective commits, publication, or guaranteed recovery.
