# GitHub Integration — Walkthrough

A step-by-step guide for first-time setup through daily use.

---

## Part 1: First-Time Setup

### Before You Begin

Make sure you have:
- [ ] A GitHub account (github.com/signup — free)
- [ ] Git installed (`git --version` in a terminal to check)
- [ ] A novel project initialized in pi-novel-writer (`/PNW-init`)

---

### Step 1 — Create a GitHub Repository

1. Go to **github.com/new**
2. Fill in the form:
   - **Repository name:** e.g. `my-novel` or your book title (no spaces)
   - **Visibility:** Private (recommended for unpublished work)
   - **Initialize this repository:** leave all checkboxes **unchecked**
3. Click **Create repository**
4. On the next screen, copy the **HTTPS URL** shown under "Quick setup":
   ```
   https://github.com/yourusername/my-novel.git
   ```
   Keep this — you will need it in Step 3.

> Why empty? Starting with an empty repo avoids a merge conflict on first push. If you accidentally added a README, the connect command handles it automatically with a force push.

---

### Step 2 — Create a Personal Access Token

GitHub requires a token to let pi-novel-writer push on your behalf. GitHub recommends **fine-grained tokens** for better security — they limit access to specific repositories rather than your entire account.

**Option A: Fine-grained token (recommended)**

1. Go to **github.com/settings/tokens** (Settings > Developer settings > Personal access tokens > Fine-grained tokens)
2. Click **Generate new token**
3. Fill in:
   - **Token name:** `pi-novel-writer`
   - **Expiration:** 90 days or No expiration
   - **Repository access:** select **Only select repositories**, then choose your novel repo
   - **Permissions > Repository permissions:**
     - Contents: **Read and write**
     - Metadata: **Read-only** (auto-selected)
4. Click **Generate token**
5. **Copy the token immediately** — it starts with `github_pat_`

**Option B: Classic token (simpler, broader access)**

1. Go to Settings > Developer settings > Personal access tokens > **Tokens (classic)**
2. Click **Generate new token (classic)**
3. Fill in: Note = `pi-novel-writer`, Expiration = your choice, Scopes = check **`repo`**
4. Click **Generate token** — token starts with `ghp_`

> Both token types work with pi-novel-writer. If you lose your token, generate a new one and call `novel_github_token_set` again.

---

### Step 3 — Save the Token

In pi-novel-writer, tell the AI:

> "My GitHub token is ghp_..."

The AI will call `novel_github_token_set` to save it to `.pi/github.json`. This file is gitignored — it will never be committed or pushed.

You can also ask the AI directly: "Call novel_github_token_set with token ghp_..."

**Verification:** The AI confirms "Token saved" without echoing the token back.

---

### Step 4 — Connect Your Project

Run:
```
/PNW-github-connect https://github.com/yourusername/my-novel.git
```

Replace the URL with the one you copied in Step 1.

**What happens:**
1. Git initializes in your project folder
2. A local git identity is set if you don't have one configured globally
3. All project files are staged and committed as "Initial commit"
4. The remote origin is set with your token injected
5. The commit is pushed to GitHub
6. Config is saved to `.pi/github.json`

**Expected output:** `Connected to https://github.com/yourusername/my-novel.git on branch "main".`

---

### Step 5 — Verify

Run:
```
/PNW-github
```

You should see the status dashboard showing:
- **Branch:** main
- **Remote:** https://github.com/yourusername/my-novel.git
- **Last Commit:** (hash) Initial commit
- **Uncommitted Changes:** 0 file(s)

Go to your GitHub repository page and refresh — you should see all your project files.

Setup is complete.

---

## Part 2: Daily Workflow

### Pushing After a Writing Session

At the end of each session, run:
```
/PNW-github-push
```

The AI will:
1. Check what files changed (`git status --short`)
2. Write a descriptive commit message based on the changes
3. Commit and push automatically

**Example AI-generated messages:**
- `Add chapter 3 confrontation scene`
- `Update character bible with antagonist backstory`
- `Revise chapter 1 opening paragraphs`

If you prefer to write your own message:
```
/PNW-github-push "finish act two, all 8 scenes drafted"
```

---

### Checking What Changed

Before pushing, check your status:
```
/PNW-github
```

The **Uncommitted Changes** count tells you how many files have been modified since the last commit.

For a detailed file list, ask the AI: "What files have changed since my last commit?" — the AI can call `novel_github_status` to get the full list.

---

### Pulling on Another Machine

If you write on multiple computers, pull before starting a session:

**On the new machine, first-time setup:**
1. Clone the repository:
   ```
   /PNW-github-clone https://github.com/yourusername/my-novel.git
   ```
2. The AI will offer to load the cloned project — say yes
3. Save your token on the new machine via `novel_github_token_set`

**On subsequent sessions (after the first clone):**
```
/PNW-github-pull
```

This pulls the latest changes from GitHub before you start writing.

---

### Recommended Session Routine

```
Start of session:   /PNW-github-pull     (sync any changes)
... write scenes ...
End of session:     /PNW-github-push     (back everything up)
```

---

## Part 3: Recovery Scenarios

### Recovering on a New Machine

If your hard drive fails or you switch computers:

1. Install Git and Node.js on the new machine
2. Clone your novel:
   ```
   /PNW-github-clone https://github.com/yourusername/my-novel.git
   ```
3. When asked to load, say yes
4. Save your GitHub token again:
   - Generate a new PAT at github.com/settings/tokens if needed
   - Tell the AI: "My token is ghp_..."
5. Continue writing — run `/PNW-github-pull` to confirm you are up to date

---

### Sharing a Project with a Co-Author

1. On GitHub, go to your repository > Settings > Collaborators
2. Add your co-author's GitHub username
3. They clone the repository:
   ```
   /PNW-github-clone https://github.com/yourusername/my-novel.git
   ```
4. They save their own PAT via `novel_github_token_set`
5. Both authors push/pull using the same repository

> Note: If both authors edit the same file simultaneously, a merge conflict may occur on pull. Resolve it manually in the project folder using standard git merge conflict resolution.

---

### Viewing Version History

Your commit history is a full version history of your novel. To browse it:

1. Go to your repository on GitHub
2. Click **Commits** (above the file list)
3. Click any commit to see exactly what changed in that session

To restore a previous version of a specific file:
1. Find the commit on GitHub
2. Click the file > click the "..." menu > **View file**
3. Copy the content you need

---

### Renewing an Expired Token

When your PAT expires, push and pull operations will fail with an authentication error.

1. Go to github.com/settings/tokens
2. Click your existing token > **Regenerate** (or create a new one)
3. Copy the new token
4. Tell the AI: "My new GitHub token is ghp_..."
5. The AI calls `novel_github_token_set` to update `.pi/github.json`
6. Continue pushing and pulling as normal

---

## Quick Reference Card

```
FIRST TIME SETUP
  1. Create empty GitHub repo at github.com/new
  2. Create PAT at github.com/settings/tokens (fine-grained recommended)
  3. Tell AI: "My token is github_pat_..."  -> novel_github_token_set
  4. /PNW-github-connect <repo-url>
  5. /PNW-github                      -> verify connection

DAILY USE
  Start of session:  /PNW-github-pull
  End of session:    /PNW-github-push

NEW MACHINE
  /PNW-github-clone <repo-url>
  novel_github_token_set (save PAT)
  /PNW-github-pull

TOKEN EXPIRED
  Regenerate at github.com/settings/tokens
  Tell AI: "My new token is ghp_..."
```
