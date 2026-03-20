# GitHub Integration — Help Reference

Quick reference for all GitHub integration commands and tools in pi-novel-writer.

---

## Commands

### `/PNW-github`
Show the GitHub status dashboard for the current project.

**Displays:**
- Current branch name
- Remote repository URL (token never shown)
- Last commit hash and message
- Count of uncommitted files

**Requirements:** Project loaded, GitHub connected via `/PNW-github-connect`.

---

### `/PNW-github-connect <url>`
Initialize git, set the remote origin, and push the initial commit.

**Usage:**
```
/PNW-github-connect https://github.com/username/my-novel.git
```

**What it does:**
1. Runs `git init` in the project root
2. Sets a local git identity fallback (`pi-novel@localhost`) if no global config exists
3. Stages all files and creates an "Initial commit"
4. Adds the remote origin with your PAT injected for authentication
5. Pushes to the remote branch (force-pushes if the repo has a diverged README)
6. Saves config to `.pi/github.json`

**Requirements:** Token must be saved first via `novel_github_token_set`. Project must be loaded.

**Error states:**
- `"No token set"` — call `novel_github_token_set` before connecting
- `"Only HTTPS URLs are supported"` — use the HTTPS clone URL, not SSH
- `"Push failed"` — check that the repo exists and the PAT has `repo` scope

---

### `/PNW-github-push [message]`
Commit all changes and push to the remote repository.

**Usage:**
```
/PNW-github-push
/PNW-github-push "finish chapter 4 climax scene"
```

**Without a message:** The AI inspects `git status --short`, generates a concise commit message in imperative mood (max 72 chars), then calls `novel_github_push` automatically.

**With a message:** The AI calls `novel_github_push` with your exact message, no generation step.

**Requirements:** Project loaded, GitHub connected.

**Error states:**
- `"Nothing to commit"` — working tree is clean, nothing to push
- `"git push failed"` — check network, PAT expiry, or repo permissions

---

### `/PNW-github-pull`
Pull the latest changes from the remote branch.

**Usage:**
```
/PNW-github-pull
```

**What it does:** Runs `git pull origin <branch>`. Reports what changed or confirms already up to date.

**Requirements:** Project loaded, GitHub connected.

**Error states:**
- `"Not connected to GitHub"` — run `/PNW-github-connect` first
- `"Pull failed"` — may indicate merge conflicts; resolve manually in the project folder

---

### `/PNW-github-clone <url> [dirname]`
Clone a GitHub repository into a new local directory.

**Usage:**
```
/PNW-github-clone https://github.com/username/my-novel.git
/PNW-github-clone https://github.com/username/my-novel.git my-novel-backup
```

**What it does:**
1. Clones the repository (injects token if one is saved)
2. Offers to load the cloned project as your active project via `/PNW-load`

**Without `dirname`:** uses the repository name as the folder name.

---

## AI-Callable Tools

These tools are called by the AI during command handling or on direct request.

### `novel_github_token_set`
Save a GitHub Personal Access Token to `.pi/github.json`.

**Parameters:** `token` (string) — fine-grained tokens (`github_pat_`) or classic tokens (`ghp_`) both accepted. Fine-grained tokens are recommended for better security.

**Security:** Token is saved locally and gitignored. It is never echoed back or displayed.

---

### `novel_github_status`
Return git repository status as a JSON object.

**Returns:**
```json
{
  "branch": "main",
  "remote": "https://github.com/username/my-novel.git",
  "lastCommit": "a1b2c3d Add chapter 5 opening scene",
  "uncommittedCount": 2,
  "uncommittedFiles": ["M manuscript/chapters/05/scene-01.md", "M .pi/progress.json"]
}
```

---

### `novel_github_connect`
Programmatic connect — same logic as `/PNW-github-connect`.

**Parameters:** `url` (string), `branch` (string, optional, default `"main"`)

---

### `novel_github_push`
Stage all, commit, and push with a given message.

**Parameters:** `message` (string) — commit message

Called automatically by the AI after `/PNW-github-push` analyzes changed files.

---

### `novel_github_pull`
Pull from the remote branch.

**Parameters:** none

---

## Config File: `.pi/github.json`

Stores your GitHub connection settings. Created on first `novel_github_token_set` call.

```json
{
  "token": "ghp_...",
  "remote": "https://github.com/username/my-novel.git",
  "branch": "main"
}
```

**This file is gitignored** — it will never be committed to your repository. The token is injected into git URLs at runtime only and is never stored in git history.

---

## Common Issues

| Problem | Cause | Fix |
|---|---|---|
| `No token set` | `novel_github_token_set` not called | Call `novel_github_token_set` with your PAT |
| `Push rejected` | Diverged history (README in repo) | The connect command retries with force push automatically |
| `Author identity unknown` | No global git config, fresh machine | git identity is set automatically after `git init` |
| Token expired | GitHub PAT has an expiry date | Generate a new PAT at github.com/settings/tokens, call `novel_github_token_set` again |
| `git not found` | Git not installed | Install Git from git-scm.com |
| `git pull: merge conflict` | Remote and local diverged | Resolve conflicts manually in the project folder, then push |
