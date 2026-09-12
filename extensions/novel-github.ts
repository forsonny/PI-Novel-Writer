// novel-github.ts — GitHub Integration
// Backup, restore, and share novel projects via GitHub (PAT/HTTPS)

import path from "node:path";
import fs from "node:fs";
import { Type } from "typebox";
import { createLocalBashOperations } from "@earendil-works/pi-coding-agent";
import { Box, Text, Container, Spacer, truncateToWidth } from "@earendil-works/pi-tui";
import { getProject } from "./novel-core.ts";

// ─── Types ───────────────────────────────────────────────────────────────────

interface GithubConfig {
  token: string;
  remote: string;
  branch: string;
}

const GITHUB_CONFIG_PATH = ".pi/github.json";

// ─── Config helpers ──────────────────────────────────────────────────────────

function loadGithubConfig(rootPath: string): GithubConfig | null {
  const configPath = path.join(rootPath, GITHUB_CONFIG_PATH);
  if (!fs.existsSync(configPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8")) as GithubConfig;
  } catch {
    return null;
  }
}

function saveGithubConfig(rootPath: string, config: GithubConfig): void {
  const configPath = path.join(rootPath, GITHUB_CONFIG_PATH);
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
}

// ─── Security helpers ────────────────────────────────────────────────────────

function sanitizeUrl(url: string): string {
  // Strip embedded tokens: https://ghp_TOKEN@github.com/... -> https://github.com/...
  return url.replace(/https:\/\/[^@]+@/, "https://");
}

function ensureGitignoreEntry(rootPath: string, entry: string): void {
  const gitignorePath = path.join(rootPath, ".gitignore");
  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, "utf8");
    if (content.includes(entry)) return;
    fs.writeFileSync(gitignorePath, content + (content.endsWith("\n") ? "" : "\n") + entry + "\n", "utf8");
  } else {
    fs.writeFileSync(gitignorePath, entry + "\n", "utf8");
  }
}

// ─── README helpers ──────────────────────────────────────────────────────────

function countProjectWords(project: any): number {
  let total = 0;
  if (!project?.scenes) return total;
  for (const [_key, scene] of project.scenes) {
    if (scene.filePath && fs.existsSync(scene.filePath)) {
      try {
        const raw = fs.readFileSync(scene.filePath, "utf8");
        const fmEnd = raw.indexOf("---\n", 4);
        const body = fmEnd !== -1 ? raw.slice(fmEnd + 4) : raw;
        total += body.trim().split(/\s+/).filter(Boolean).length;
      } catch {}
    }
  }
  return total;
}

function generateReadme(project: any): string {
  const c = project?.config ?? {};
  const scenes = project?.scenes ? [...project.scenes.values()] : [];
  const chapters = new Set(scenes.map((s: any) => s.chapter)).size;
  const wordCount = countProjectWords(project);
  const targetWords: number = c.targetWordCount || 0;
  const pct = targetWords > 0 ? Math.round((wordCount / targetWords) * 100) : 0;

  const statusCounts: Record<string, number> = {};
  for (const s of scenes) {
    statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
  }

  const lines: string[] = [];
  lines.push(`# ${c.title || "Untitled Novel"}`);
  lines.push("");

  if (c.author) {
    lines.push(`*by ${c.author}*`);
    lines.push("");
  }

  const meta: string[] = [];
  if (c.genre) meta.push(`**Genre:** ${c.genre}`);
  if (c.format) meta.push(`**Format:** ${c.format}`);
  if (c.pov) meta.push(`**POV:** ${c.pov}`);
  if (c.tense) meta.push(`**Tense:** ${c.tense}`);
  if (meta.length) {
    lines.push(meta.join("  |  "));
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("## Progress");
  lines.push("");
  lines.push("| | |");
  lines.push("|---|---|");
  if (chapters > 0) lines.push(`| Chapters | ${chapters} |`);
  lines.push(`| Scenes | ${scenes.length} |`);
  lines.push(`| Words | ~${wordCount.toLocaleString()} |`);
  if (targetWords > 0) {
    lines.push(`| Target | ${targetWords.toLocaleString()} words |`);
    lines.push(`| Completion | ${pct}% |`);
  }

  if (Object.keys(statusCounts).length > 0) {
    lines.push("");
    const statusLine = Object.entries(statusCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([s, n]) => `${n} ${s}`)
      .join("  ·  ");
    lines.push(`*${statusLine}*`);
  }

  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("*Managed with [pi-novel-writer](https://github.com/mariozechner/pi)*");
  lines.push("");

  return lines.join("\n");
}

// Returns true if README was created or updated, false if already current
function ensureReadme(rootPath: string, project: any): boolean {
  const readmePath = path.join(rootPath, "README.md");
  const newContent = generateReadme(project);
  if (fs.existsSync(readmePath)) {
    const existing = fs.readFileSync(readmePath, "utf8");
    if (existing === newContent) return false;
  }
  fs.writeFileSync(readmePath, newContent, "utf8");
  return true;
}

// Generate a simple commit message from the git status --short output
function autoCommitMessage(statusOutput: string): string {
  const lines = statusOutput.split("\n").filter(Boolean);
  const paths = lines.map(l => l.replace(/^\S+\s+/, "").trim());

  const hasScenes = paths.some(p => /chapters?|scenes?|scene-\d+/.test(p));
  const hasBible = paths.some(p => /bible|characters?|locations?|factions?/.test(p));
  const hasConfig = paths.some(p => /project\.json/.test(p));

  const parts: string[] = [];
  if (hasScenes) parts.push("update manuscript");
  if (hasBible) parts.push("update story bible");
  if (hasConfig && parts.length === 0) parts.push("update project settings");
  if (parts.length === 0) parts.push(`update ${lines.length} file${lines.length !== 1 ? "s" : ""}`);

  return parts.join(", ");
}

// ─── Git execution helper ────────────────────────────────────────────────────

async function gitExec(_pi: any, cwd: string, command: string): Promise<{ code: number; stdout: string; stderr: string }> {
  // Use the same resolved shell as Pi's working bash tool. Bare "bash" can select
  // Windows' WSL launcher instead of Git Bash and fail to enter a Windows cwd.
  let output = "";
  const result = await createLocalBashOperations().exec(command, cwd, {
    onData: data => { output += data.toString(); }
  });
  const code = result.exitCode ?? 1;
  return { code, stdout: code === 0 ? output : "", stderr: code === 0 ? "" : output };
}

// ─── Extension ───────────────────────────────────────────────────────────────

export default function novelGithubExtension(pi: any) {

  // ─── Message Renderer ────────────────────────────────────────────────────
  pi.registerMessageRenderer("novel-github-status", (message: any, _options: any, theme: any) => {
    const details = message.details;
    if (!details) return new Text("  No GitHub status data.", 2, 0);

    const maxW = Math.max(30, (process.stdout.columns || 80) - 4);
    const T = (str: string) => truncateToWidth(str, maxW);
    const container = new Container();

    const headerColor = details.error ? "error" : "accent";
    const headerBox = new Box(1, 0, (t: string) => theme.bold(theme.fg(headerColor, t)));
    headerBox.addChild(new Text(" GITHUB STATUS ", 0, 0));
    container.addChild(headerBox);
    container.addChild(new Spacer(1));

    if (details.error) {
      container.addChild(new Text(T(`  ${details.error}`), 2, 0, (t: string) => theme.fg("error", t)));
    } else {
      const branchLabel = "  BRANCH ";
      const branchDashes = "─".repeat(Math.max(0, maxW - branchLabel.length));
      container.addChild(new Text(branchLabel + branchDashes, 0, 0, (_t: string) => theme.fg("accent", branchLabel) + theme.fg("dim", branchDashes)));
      container.addChild(new Text(T(`  ${details.branch || "(unknown)"}`), 2, 0));
      container.addChild(new Spacer(1));

      const remoteLabel = "  REMOTE ";
      const remoteDashes = "─".repeat(Math.max(0, maxW - remoteLabel.length));
      container.addChild(new Text(remoteLabel + remoteDashes, 0, 0, (_t: string) => theme.fg("accent", remoteLabel) + theme.fg("dim", remoteDashes)));
      container.addChild(new Text(T(`  ${sanitizeUrl(details.remote || "(not connected)")}`), 2, 0));
      container.addChild(new Spacer(1));

      const commitLabel = "  LAST COMMIT ";
      const commitDashes = "─".repeat(Math.max(0, maxW - commitLabel.length));
      container.addChild(new Text(commitLabel + commitDashes, 0, 0, (_t: string) => theme.fg("accent", commitLabel) + theme.fg("dim", commitDashes)));
      container.addChild(new Text(T(`  ${details.lastCommit || "(no commits yet)"}`), 2, 0));
      container.addChild(new Spacer(1));

      const countColor = details.uncommittedCount > 0 ? "warning" : "success";
      const statusLabel = "  UNCOMMITTED CHANGES ";
      const statusDashes = "─".repeat(Math.max(0, maxW - statusLabel.length));
      container.addChild(new Text(statusLabel + statusDashes, 0, 0, (_t: string) => theme.fg("accent", statusLabel) + theme.fg("dim", statusDashes)));
      container.addChild(new Text(T(`  ${details.uncommittedCount} file(s)`), 2, 0, (t: string) => theme.fg(countColor, t)));
    }

    container.addChild(new Spacer(1));
    const outerBox = new Box(1, 1);
    outerBox.addChild(container);
    return outerBox;
  });

  // ─── Tool: novel_github_token_set ────────────────────────────────────────
  pi.registerTool({
    name: "novel_github_token_set",
    label: "Set GitHub Token",
    description: "Store a GitHub Personal Access Token (PAT) to .pi/github.json. The token is never displayed after saving.",
    parameters: Type.Object({
      token: Type.String({ description: "GitHub PAT starting with ghp_ or github_pat_" })
    }),
    execute: async (_id: string, params: any) => {
      const project = getProject();
      if (!project) return { content: [{ type: "text", text: "No project loaded. Run /PNW-init first." }] };

      const { token } = params;
      if (!token.startsWith("ghp_") && !token.startsWith("github_pat_")) {
        return { content: [{ type: "text", text: "Invalid token format. Expected prefix: ghp_ or github_pat_" }] };
      }

      const existing = loadGithubConfig(project.rootPath) ?? { token: "", remote: "", branch: "main" };
      existing.token = token;
      saveGithubConfig(project.rootPath, existing);
      ensureGitignoreEntry(project.rootPath, ".pi/github.json");

      return { content: [{ type: "text", text: "Token saved to .pi/github.json (gitignored). Token not echoed." }] };
    }
  });

  // ─── Tool: novel_github_status ───────────────────────────────────────────
  pi.registerTool({
    name: "novel_github_status",
    label: "GitHub Status",
    description: "Return git repository status as JSON: branch name, remote URL (sanitized), last commit, count of uncommitted files.",
    parameters: Type.Object({}),
    execute: async () => {
      const project = getProject();
      if (!project) return { content: [{ type: "text", text: "No project loaded." }] };

      const rootRes = await gitExec(pi, project.rootPath, "git rev-parse --show-toplevel");
      if (rootRes.code !== 0) throw new Error(rootRes.stderr.trim() || "No readable Git repository found.");
      const branchRes = await gitExec(pi, project.rootPath, "git rev-parse --abbrev-ref HEAD 2>/dev/null");
      const remoteRes = await gitExec(pi, project.rootPath, "git remote get-url origin 2>/dev/null");
      const logRes = await gitExec(pi, project.rootPath, "git log -1 --format='%h %s' 2>/dev/null");
      const statusRes = await gitExec(pi, project.rootPath, "git status --short 2>/dev/null");
      if (statusRes.code !== 0) throw new Error(statusRes.stderr.trim() || "Git status failed; repository cleanliness is unknown.");

      const uncommittedLines = statusRes.stdout.trim().split("\n").filter(Boolean);

      const result = {
        repositoryRoot: rootRes.stdout.trim(),
        branch: branchRes.code === 0 ? branchRes.stdout.trim() : null,
        remote: remoteRes.code === 0 ? sanitizeUrl(remoteRes.stdout.trim()) : null,
        lastCommit: logRes.code === 0 ? logRes.stdout.trim() : null,
        uncommittedCount: uncommittedLines.length,
        uncommittedFiles: uncommittedLines.slice(0, 20)
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  });

  // ─── Tool: novel_github_connect ──────────────────────────────────────────
  pi.registerTool({
    name: "novel_github_connect",
    label: "Connect to GitHub",
    description: "Initialize git repo (if needed), set remote origin, and push initial commit. Requires token to be set first via novel_github_token_set.",
    parameters: Type.Object({
      url: Type.String({ description: "HTTPS GitHub repo URL, e.g. https://github.com/owner/repo.git" }),
      branch: Type.Optional(Type.String({ description: "Branch name. Defaults to main." }))
    }),
    execute: async (_id: string, params: any) => {
      const project = getProject();
      if (!project) return { content: [{ type: "text", text: "No project loaded." }] };

      const config = loadGithubConfig(project.rootPath);
      if (!config?.token) {
        return { content: [{ type: "text", text: "No token found. Call novel_github_token_set first." }] };
      }

      const branch = params.branch || "main";
      const authenticatedUrl = params.url.replace("https://", `https://${config.token}@`);

      // Init if not already a git repo
      const initRes = await gitExec(pi, project.rootPath, "git init");
      if (initRes.code !== 0) {
        return { content: [{ type: "text", text: `git init failed: ${initRes.stderr}` }] };
      }

      // Set local git identity fallback after init (does not override existing global config)
      await gitExec(pi, project.rootPath, `git config user.email "pi-novel@localhost" 2>/dev/null || true`);
      await gitExec(pi, project.rootPath, `git config user.name "PI Novel Writer" 2>/dev/null || true`);

      // Checkout branch
      await gitExec(pi, project.rootPath, `git checkout -b "${branch}" 2>/dev/null || git checkout "${branch}" 2>/dev/null || true`);

      // Stage all and commit
      ensureReadme(project.rootPath, project);
      await gitExec(pi, project.rootPath, "git add -A");
      const commitRes = await gitExec(pi, project.rootPath, `git commit -m "Initial commit" --allow-empty`);
      if (commitRes.code !== 0) {
        return { content: [{ type: "text", text: `git commit failed: ${commitRes.stderr}` }] };
      }

      // Set or update remote
      const remoteCheckRes = await gitExec(pi, project.rootPath, "git remote get-url origin 2>/dev/null");
      if (remoteCheckRes.code === 0) {
        await gitExec(pi, project.rootPath, `git remote set-url origin "${authenticatedUrl}"`);
      } else {
        const addRes = await gitExec(pi, project.rootPath, `git remote add origin "${authenticatedUrl}"`);
        if (addRes.code !== 0) {
          return { content: [{ type: "text", text: `git remote add failed: ${sanitizeUrl(addRes.stderr)}` }] };
        }
      }

      // Push (with force-push fallback for diverged history e.g. repo created with README)
      let pushRes = await gitExec(pi, project.rootPath, `git push -u origin "${branch}"`);
      if (pushRes.code !== 0 && (pushRes.stderr.includes("rejected") || pushRes.stderr.includes("non-fast-forward"))) {
        pushRes = await gitExec(pi, project.rootPath, `git push -u origin "${branch}" --force`);
      }
      if (pushRes.code !== 0) {
        return { content: [{ type: "text", text: `git push failed: ${sanitizeUrl(pushRes.stderr)}` }] };
      }

      // Save clean config (no token in stored remote)
      saveGithubConfig(project.rootPath, { token: config.token, remote: params.url, branch });
      ensureGitignoreEntry(project.rootPath, ".pi/github.json");

      return { content: [{ type: "text", text: `Connected to ${sanitizeUrl(params.url)} on branch "${branch}". Initial push complete.` }] };
    }
  });

  // ─── Tool: novel_github_push ─────────────────────────────────────────────
  pi.registerTool({
    name: "novel_github_push",
    label: "Push to GitHub",
    description: "Stage all changes, commit with the provided message, and push to remote. Called by AI after /PNW-github-push analyzes changed files.",
    parameters: Type.Object({
      message: Type.String({ description: "Commit message (imperative mood, max 72 chars)" })
    }),
    execute: async (_id: string, params: any) => {
      const project = getProject();
      if (!project) return { content: [{ type: "text", text: "No project loaded." }] };

      const config = loadGithubConfig(project.rootPath);
      if (!config?.token || !config?.remote) {
        return { content: [{ type: "text", text: "Not connected to GitHub. Run /PNW-github-connect first." }] };
      }

      const authenticatedUrl = config.remote.replace("https://", `https://${config.token}@`);

      // Shell-escape the commit message: wrap in single quotes, escape internal single quotes
      const escapedMsg = params.message.replace(/'/g, "'\\''");

      ensureReadme(project.rootPath, project);
      await gitExec(pi, project.rootPath, "git add -A");
      const commitRes = await gitExec(pi, project.rootPath, `git commit -m '${escapedMsg}'`);
      if (commitRes.code !== 0) {
        if (commitRes.stdout.includes("nothing to commit") || commitRes.stderr.includes("nothing to commit")) {
          return { content: [{ type: "text", text: "Nothing to commit. Working tree is clean." }] };
        }
        return { content: [{ type: "text", text: `git commit failed: ${commitRes.stderr}` }] };
      }

      // Update remote URL with token before push
      await gitExec(pi, project.rootPath, `git remote set-url origin "${authenticatedUrl}"`);

      const pushRes = await gitExec(pi, project.rootPath, `git push origin "${config.branch}"`);
      if (pushRes.code !== 0) {
        return { content: [{ type: "text", text: `git push failed: ${sanitizeUrl(pushRes.stderr)}` }] };
      }

      const hashRes = await gitExec(pi, project.rootPath, "git log -1 --format='%h'");
      const hash = hashRes.code === 0 ? hashRes.stdout.trim() : "?";

      return { content: [{ type: "text", text: `Pushed commit ${hash}: "${params.message}"` }] };
    }
  });

  // ─── Tool: novel_github_pull ─────────────────────────────────────────────
  pi.registerTool({
    name: "novel_github_pull",
    label: "Pull from GitHub",
    description: "Pull latest changes from remote branch.",
    parameters: Type.Object({}),
    execute: async () => {
      const project = getProject();
      if (!project) return { content: [{ type: "text", text: "No project loaded." }] };

      const config = loadGithubConfig(project.rootPath);
      if (!config?.token || !config?.remote) {
        return { content: [{ type: "text", text: "Not connected to GitHub. Run /PNW-github-connect first." }] };
      }

      const authenticatedUrl = config.remote.replace("https://", `https://${config.token}@`);

      // Update remote URL with token before pulling
      await gitExec(pi, project.rootPath, `git remote set-url origin "${authenticatedUrl}"`);

      const pullRes = await gitExec(pi, project.rootPath, `git pull origin "${config.branch}"`);

      const output = sanitizeUrl((pullRes.stdout + pullRes.stderr).trim());
      if (pullRes.code !== 0) {
        return { content: [{ type: "text", text: `git pull failed:\n${output}` }] };
      }
      return { content: [{ type: "text", text: output || "Already up to date." }] };
    }
  });

  // ─── Command: /PNW-github ────────────────────────────────────────────────
  pi.registerCommand("PNW-github", {
    description: "Show GitHub integration status: branch, remote, last commit, uncommitted file count",
    handler: async (_args: string, _ctx: any) => {
      const project = getProject();
      if (!project) {
        pi.sendMessage({ customType: "markdown", content: "No project loaded. Run /PNW-init first.", display: true });
        return;
      }

      const config = loadGithubConfig(project.rootPath);
      if (!config) {
        pi.sendMessage({ customType: "markdown", content: "GitHub not configured. Run the `github-setup` skill to get started.", display: true });
        return;
      }

      const branchRes = await gitExec(pi, project.rootPath, "git rev-parse --abbrev-ref HEAD 2>/dev/null");
      const logRes = await gitExec(pi, project.rootPath, "git log -1 --format='%h %s' 2>/dev/null");
      const statusRes = await gitExec(pi, project.rootPath, "git status --short 2>/dev/null");

      if (branchRes.code !== 0) {
        pi.sendMessage({
          customType: "novel-github-status",
          content: "GitHub Status",
          display: true,
          details: { error: "No git repository found. Run /PNW-github-connect to initialize." }
        });
        return;
      }

      const uncommittedLines = statusRes.stdout.trim().split("\n").filter(Boolean);

      pi.sendMessage({
        customType: "novel-github-status",
        content: "GitHub Status",
        display: true,
        details: {
          branch: branchRes.stdout.trim(),
          remote: config.remote,
          lastCommit: logRes.code === 0 ? logRes.stdout.trim() : null,
          uncommittedCount: uncommittedLines.length
        }
      });
    }
  });

  // ─── Command: /PNW-github-connect ────────────────────────────────────────
  pi.registerCommand("PNW-github-connect", {
    description: "Initialize git, add remote origin, push initial commit. Usage: /PNW-github-connect <https-repo-url>",
    handler: async (args: string, _ctx: any) => {
      const url = args.trim();
      if (!url) {
        pi.sendMessage({
          customType: "markdown",
          content: [
            "Connect your project to a GitHub repository.",
            "",
            "**Usage:** `/PNW-github-connect <https://github.com/owner/repo.git>`",
            "",
            "**Before running this command:**",
            "1. Create an empty repo at github.com/new (leave README unchecked)",
            "2. Save your GitHub token — tell me: *\"My GitHub token is ghp_...\"*",
            "",
            "**Then run:**",
            "```",
            "/PNW-github-connect https://github.com/yourusername/your-repo.git",
            "```",
            "",
            "Need help? Run the `github-setup` skill for a full walkthrough."
          ].join("\n"),
          display: true
        });
        return;
      }
      if (!url.startsWith("https://")) {
        pi.sendMessage({ customType: "markdown", content: "Only HTTPS URLs are supported (e.g. https://github.com/owner/repo.git).", display: true });
        return;
      }

      const project = getProject();
      if (!project) {
        pi.sendMessage({ customType: "markdown", content: "No project loaded. Run /PNW-init first.", display: true });
        return;
      }

      const config = loadGithubConfig(project.rootPath);
      if (!config?.token) {
        pi.sendMessage({ customType: "markdown", content: "No token set. Call `novel_github_token_set` with your GitHub PAT first.", display: true });
        return;
      }

      const branch = config.branch || "main";
      const authenticatedUrl = url.replace("https://", `https://${config.token}@`);

      pi.sendMessage({ customType: "markdown", content: `Connecting to ${sanitizeUrl(url)}...`, display: true });

      await gitExec(pi, project.rootPath, "git init");

      // Set local git identity fallback after init (does not override existing global config)
      await gitExec(pi, project.rootPath, `git config user.email "pi-novel@localhost" 2>/dev/null || true`);
      await gitExec(pi, project.rootPath, `git config user.name "PI Novel Writer" 2>/dev/null || true`);

      await gitExec(pi, project.rootPath, `git checkout -b "${branch}" 2>/dev/null || git checkout "${branch}" 2>/dev/null || true`);
      ensureReadme(project.rootPath, project);
      await gitExec(pi, project.rootPath, "git add -A");
      const connectCommitRes = await gitExec(pi, project.rootPath, `git commit -m "Initial commit" --allow-empty`);
      if (connectCommitRes.code !== 0) {
        pi.sendMessage({ customType: "markdown", content: `Commit failed: ${connectCommitRes.stderr}`, display: true });
        return;
      }

      const remoteCheckRes = await gitExec(pi, project.rootPath, "git remote get-url origin 2>/dev/null");
      if (remoteCheckRes.code === 0) {
        await gitExec(pi, project.rootPath, `git remote set-url origin "${authenticatedUrl}"`);
      } else {
        await gitExec(pi, project.rootPath, `git remote add origin "${authenticatedUrl}"`);
      }

      let pushRes = await gitExec(pi, project.rootPath, `git push -u origin "${branch}"`);
      if (pushRes.code !== 0 && (pushRes.stderr.includes("rejected") || pushRes.stderr.includes("non-fast-forward"))) {
        pushRes = await gitExec(pi, project.rootPath, `git push -u origin "${branch}" --force`);
      }

      if (pushRes.code !== 0) {
        pi.sendMessage({ customType: "markdown", content: `Push failed: ${sanitizeUrl(pushRes.stderr)}`, display: true });
        return;
      }

      saveGithubConfig(project.rootPath, { token: config.token, remote: url, branch });
      ensureGitignoreEntry(project.rootPath, ".pi/github.json");

      pi.sendMessage({ customType: "markdown", content: `Connected to ${sanitizeUrl(url)} on branch "${branch}". Run /PNW-github to verify.`, display: true });
    }
  });

  // ─── Command: /PNW-github-push ───────────────────────────────────────────
  pi.registerCommand("PNW-github-push", {
    description: "Push changes to GitHub. Omit message for auto-generated commit. Usage: /PNW-github-push [message]",
    handler: async (args: string, _ctx: any) => {
      const project = getProject();
      if (!project) {
        pi.sendMessage({ customType: "markdown", content: "No project loaded. Run /PNW-init first.", display: true });
        return;
      }

      const config = loadGithubConfig(project.rootPath);
      if (!config?.token || !config?.remote) {
        pi.sendMessage({ customType: "markdown", content: "Not connected to GitHub. Run `/PNW-github-connect <url>` first.", display: true });
        return;
      }

      // Update README before staging so any progress changes are captured
      ensureReadme(project.rootPath, project);

      // Check for changes after README update
      const statusRes = await gitExec(pi, project.rootPath, "git status --short 2>/dev/null");
      const changedFiles = statusRes.stdout.trim();

      if (!changedFiles) {
        pi.sendMessage({
          customType: "markdown",
          content: "Nothing to push — your working tree is clean. All changes are already on GitHub.",
          display: true
        });
        return;
      }

      // Use provided message or auto-generate one from the changed file list
      const commitMessage = args.trim() || autoCommitMessage(changedFiles);

      const authenticatedUrl = config.remote.replace("https://", `https://${config.token}@`);
      const escapedMsg = commitMessage.replace(/'/g, "'\\''");

      await gitExec(pi, project.rootPath, "git add -A");
      const commitRes = await gitExec(pi, project.rootPath, `git commit -m '${escapedMsg}'`);
      if (commitRes.code !== 0) {
        if (commitRes.stdout.includes("nothing to commit") || commitRes.stderr.includes("nothing to commit")) {
          pi.sendMessage({ customType: "markdown", content: "Nothing to push — working tree is clean.", display: true });
          return;
        }
        pi.sendMessage({ customType: "markdown", content: `Commit failed: ${commitRes.stderr}`, display: true });
        return;
      }

      await gitExec(pi, project.rootPath, `git remote set-url origin "${authenticatedUrl}"`);
      const pushRes = await gitExec(pi, project.rootPath, `git push origin "${config.branch}"`);
      if (pushRes.code !== 0) {
        pi.sendMessage({ customType: "markdown", content: `Push failed: ${sanitizeUrl(pushRes.stderr)}`, display: true });
        return;
      }

      const hashRes = await gitExec(pi, project.rootPath, "git log -1 --format='%h'");
      const hash = hashRes.code === 0 ? hashRes.stdout.trim() : "?";
      pi.sendMessage({
        customType: "markdown",
        content: `Pushed commit \`${hash}\`: "${commitMessage}"`,
        display: true
      });
    }
  });

  // ─── Command: /PNW-github-pull ───────────────────────────────────────────
  pi.registerCommand("PNW-github-pull", {
    description: "Pull latest changes from GitHub remote",
    handler: async (_args: string, _ctx: any) => {
      const project = getProject();
      if (!project) {
        pi.sendMessage({ customType: "markdown", content: "No project loaded. Run /PNW-init first.", display: true });
        return;
      }

      const config = loadGithubConfig(project.rootPath);
      if (!config?.token || !config?.remote) {
        pi.sendMessage({ customType: "markdown", content: "Not connected to GitHub. Run /PNW-github-connect first.", display: true });
        return;
      }

      const authenticatedUrl = config.remote.replace("https://", `https://${config.token}@`);
      await gitExec(pi, project.rootPath, `git remote set-url origin "${authenticatedUrl}"`);

      const pullRes = await gitExec(pi, project.rootPath, `git pull origin "${config.branch}"`);
      const output = sanitizeUrl((pullRes.stdout + pullRes.stderr).trim());

      if (pullRes.code !== 0) {
        pi.sendMessage({ customType: "markdown", content: `Pull failed:\n\n\`\`\`\n${output}\n\`\`\``, display: true });
        return;
      }

      pi.sendMessage({ customType: "markdown", content: output || "Already up to date.", display: true });
    }
  });

  // ─── Command: /PNW-github-clone ──────────────────────────────────────────
  pi.registerCommand("PNW-github-clone", {
    description: "Clone a GitHub repository. Usage: /PNW-github-clone <url> [dirname]",
    handler: async (args: string, ctx: any) => {
      const parts = args.trim().split(/\s+/);
      const url = parts[0];
      if (!url) {
        pi.sendMessage({ customType: "markdown", content: "Usage: `/PNW-github-clone <https://github.com/owner/repo.git> [dirname]`", display: true });
        return;
      }

      // Determine target directory name
      const defaultDir = url.replace(/\.git$/, "").split("/").pop() || "cloned-project";
      const targetDir = parts[1] || defaultDir;

      // Use current working directory from context, fall back to process.cwd()
      const cwd = ctx?.cwd || process.cwd();
      const targetPath = path.join(cwd, targetDir);

      // Inject token if config is available
      const project = getProject();
      const config = project ? loadGithubConfig(project.rootPath) : null;
      const cloneUrl = config?.token ? url.replace("https://", `https://${config.token}@`) : url;

      pi.sendMessage({ customType: "markdown", content: `Cloning ${sanitizeUrl(url)} into ${targetDir}...`, display: true });

      const cloneRes = await gitExec(pi, cwd, `git clone "${cloneUrl}" "${targetDir}"`);

      if (cloneRes.code !== 0) {
        pi.sendMessage({ customType: "markdown", content: `Clone failed:\n\n\`\`\`\n${sanitizeUrl(cloneRes.stderr)}\n\`\`\``, display: true });
        return;
      }

      const sanitizedPath = sanitizeUrl(targetPath);
      pi.sendMessage({
        customType: "markdown",
        content: [
          `Cloned successfully to \`${sanitizedPath}\``,
          "",
          "To load this as your active project, run:",
          `\`/PNW-load ${sanitizedPath}\``
        ].join("\n"),
        display: true
      });
    }
  });

}
