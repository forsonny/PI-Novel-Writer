---
name: github-setup
description: Connect your novel project to GitHub for backup and version control
---

# GitHub Setup for Your Novel

This skill walks you through connecting your novel project to a GitHub repository for automatic backup, version history, and cross-device access.

## What You Need

- A GitHub account (free at github.com)
- Git installed on your machine (`git --version` to check)
- Your novel project already initialized with `/PNW-init`

---

## Step 1: Create a Personal Access Token (PAT)

A PAT is a password GitHub uses to allow tools to push on your behalf.

1. Go to **github.com/settings/tokens** (or Settings > Developer settings > Personal access tokens > Tokens classic)
2. Click **Generate new token (classic)**
3. Give it a name like "pi-novel-writer"
4. Set expiration (90 days or no expiration)
5. Under **Scopes**, check **`repo`** (full repository access)
6. Click **Generate token**
7. **Copy the token immediately** — GitHub will not show it again

Once you have the token, tell me: "My token is ghp_..." and I will call `novel_github_token_set` to save it securely to `.pi/github.json` (which is gitignored — it will never be committed).

**Tips:**
- Store the token somewhere safe (password manager)
- The token starts with `ghp_` or `github_pat_`
- If you lose it, just generate a new one and call `novel_github_token_set` again

---

## Step 2: Create a GitHub Repository

1. Go to **github.com/new**
2. Name it something like `my-novel` or your book title
3. Set to **Private** (recommended for unpublished work)
4. **Do NOT** add a README, .gitignore, or license (leave the repo empty)
5. Click **Create repository**
6. Copy the **HTTPS URL** — it looks like: `https://github.com/yourusername/my-novel.git`

**Tips:**
- Private repos are free on GitHub
- An empty repo avoids merge conflicts on first push
- If you accidentally added a README, the connect step handles it with a force push

---

## Step 3: Connect Your Project

Once you have the token saved and the repo URL ready, run:

```
/PNW-github-connect https://github.com/yourusername/my-novel.git
```

This will:
1. Initialize a local git repository in your project folder
2. Stage and commit all existing files as "Initial commit"
3. Push everything to GitHub
4. Save the remote URL to `.pi/github.json`

You should see: `Connected to https://github.com/yourusername/my-novel.git on branch "main".`

**Tips:**
- Run `/PNW-github` after connecting to verify the status
- If the push is rejected (rare), the tool retries automatically with force push
- Your token is injected at runtime and never stored in git history

---

## Step 4: Verify Connection

Run `/PNW-github` to see your GitHub status dashboard:

- **Branch** — which branch you are on (default: `main`)
- **Remote** — the repository URL (token stripped for display)
- **Last Commit** — the most recent commit hash and message
- **Uncommitted Changes** — how many files have been modified since last push

If you see "No git repository found", re-run `/PNW-github-connect`.

---

## Step 5: Daily Workflow

**After writing a scene or making changes:**

```
/PNW-github-push
```

The AI will analyze what changed and write a descriptive commit message, then push automatically. You can also provide your own message:

```
/PNW-github-push "finish chapter 3 battle scene"
```

**To sync changes from another machine:**

```
/PNW-github-pull
```

**To clone your novel onto a new machine:**

```
/PNW-github-clone https://github.com/yourusername/my-novel.git
```

The AI will offer to load the cloned project automatically.

**Tips:**
- Push at the end of every writing session — treat it like saving
- Commit messages are generated automatically but you can always override them
- Use `/PNW-github` anytime to check what is uncommitted
- Your `.pi/github.json` (token file) is gitignored and will never be pushed

---

## Command Reference

| Command | Description |
|---------|-------------|
| `/PNW-github` | Show GitHub status dashboard |
| `/PNW-github-connect <url>` | Connect project to GitHub repo |
| `/PNW-github-push [message]` | Commit and push all changes |
| `/PNW-github-pull` | Pull latest changes from remote |
| `/PNW-github-clone <url> [dir]` | Clone a repository |

## Tool Reference (AI-callable)

| Tool | Description |
|------|-------------|
| `novel_github_token_set` | Save your GitHub PAT securely |
| `novel_github_status` | Get git status as JSON |
| `novel_github_connect` | Programmatic connect + initial push |
| `novel_github_push` | Stage, commit, and push with a message |
| `novel_github_pull` | Pull from remote branch |
