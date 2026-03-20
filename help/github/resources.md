# GitHub Integration — Resources

Reference material, links, and technical details for the GitHub integration.

---

## GitHub Account Setup

### Create a Free Account
- **Sign up:** github.com/signup
- Free accounts include unlimited private repositories

### Personal Access Tokens (PATs)
- **Create a token:** github.com/settings/tokens
- GitHub recommends **fine-grained tokens** for better security (more restrictive permissions)
- Navigate: Settings > Developer settings > Personal access tokens > **Fine-grained tokens** (recommended)
- **Fine-grained token settings:**
  - Repository access: select your novel repository only
  - Permissions > Repository permissions > Contents: **Read and write**
  - Permissions > Repository permissions > Metadata: **Read-only** (required)
  - Token prefix: `github_pat_`
- **Classic tokens** (fallback — simpler but broader access):
  - Navigate: Settings > Developer settings > Personal access tokens > Tokens (classic)
  - Required scope: `repo`
  - Token prefix: `ghp_`
- **Recommended expiry:** 90 days or no expiration (your choice)
- Both token types are accepted by pi-novel-writer

### Creating a New Repository
- **New repo:** github.com/new
- Set visibility to **Private** for unpublished work
- Leave README, .gitignore, and license **unchecked** (start empty to avoid merge conflicts)

---

## Git Installation

Git must be installed on your machine for this integration to work.

| Platform | Install method |
|---|---|
| Windows | git-scm.com/download/win or `winget install Git.Git` |
| macOS | `brew install git` or Xcode Command Line Tools |
| Linux (Debian/Ubuntu) | `sudo apt install git` |
| Linux (Fedora) | `sudo dnf install git` |

**Verify installation:**
```bash
git --version
```

---

## Config File Reference

### `.pi/github.json`

Location: `<project-root>/.pi/github.json`

```json
{
  "token": "ghp_xxxxxxxxxxxxxxxxxxxx",
  "remote": "https://github.com/username/repository.git",
  "branch": "main"
}
```

| Field | Type | Description |
|---|---|---|
| `token` | string | GitHub Personal Access Token |
| `remote` | string | HTTPS repository URL (no token embedded) |
| `branch` | string | Branch name to push/pull from |

**Security:** This file is listed in `.gitignore` and will never be committed.

### `.gitignore` entries added by `/PNW-init`

When you run `/PNW-init`, the generated `.gitignore` includes:

```
node_modules/
.pi/edit-suggestions.json
.pi/progress.json
.pi/github.json
exports/
```

The `.pi/github.json` entry ensures the token config is always excluded from commits, even if git was initialized manually before `/PNW-init` was run.

---

## Authentication Architecture

This integration uses **HTTPS with token injection** — the recommended approach for automation with GitHub.

**How it works:**

1. Token stored in `.pi/github.json` (local, gitignored)
2. Before each `git push` or `git pull`, the token is injected into the remote URL at runtime:
   ```
   https://github.com/username/repo.git
   becomes
   https://ghp_TOKEN@github.com/username/repo.git
   ```
3. After the operation, the clean URL (without token) remains in `.git/config`
4. Token is never written to git history, never displayed in the terminal

**Why not SSH?**
SSH key management requires additional setup steps. HTTPS + PAT works immediately on all platforms without key generation or SSH agent configuration.

---

## git Identity on Fresh Machines

When you run `/PNW-github-connect` or `novel_github_connect` on a machine with no global git config, the integration automatically sets a local fallback identity in the project repository:

```
user.email = pi-novel@localhost
user.name  = PI Novel Writer
```

This applies only to the project's local `.git/config` and does not override any existing global `~/.gitconfig` settings. If you prefer your own identity in commits, set it globally:

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

---

## Supported URL Format

Only **HTTPS URLs** are supported. These look like:

```
https://github.com/username/repository.git
```

SSH URLs (`git@github.com:username/repository.git`) are not supported. If you have an SSH URL, convert it to HTTPS format by replacing `git@github.com:` with `https://github.com/` and adding `.git` if missing.

---

## Branch Behavior

- Default branch: `main`
- Branch is set during `/PNW-github-connect` and saved to `.pi/github.json`
- All subsequent push/pull operations use the saved branch
- To change branch after connecting, edit `.pi/github.json` directly and update `"branch"`

---

## Related Files in This Project

| File | Purpose |
|---|---|
| `extensions/novel-github.ts` | Extension source — all tools and commands |
| `skills/github-setup/SKILL.md` | Guided setup walkthrough skill |
| `help/github/help.md` | Command and tool reference |
| `help/github/resources.md` | This file |
| `help/github/walkthrough.md` | Step-by-step first-use walkthrough |
| `.pi/github.json` | Runtime config (gitignored, created on first use) |
