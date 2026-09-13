// novel-core.ts — Phase 1: Foundation
// Owns all project state, scene CRUD, search, validation, progress foundations
// This extension MUST be loaded first (listed first in package.json pi.extensions)

import path from "node:path";
import { newId, proseHash, expectVersion } from "./llgf/version.ts";
import { projectPath, positiveInteger, sceneMetadata } from "./utils/safety.ts";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { withFileMutationQueue } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { Box, Text, Container, Spacer, truncateToWidth } from "@earendil-works/pi-tui";
import {
  readText, writeText, resolvePath, pathsEqual,
  normalizeKey, toSafeFilename, validateFilename, getEditor
} from "./utils/platform.ts";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProjectConfig {
  title: string;
  author: string;
  genre: string;
  subgenre: string[];
  format: "novel" | "novella" | "short-story" | "flash-fiction";
  pov: string;
  tense: string;
  targetWordCount: number;
  dailyWordGoal: number;
  comparableTitles: string[];
  structuralFramework: string;
  workflow: "structured" | "discovery";
  settings: {
    autoSummary: boolean;
    summaryModel: string;
    draftModel: string;
    editModel: string;
    voiceProfilePath: string;
    editor: string;
    subscriptionMode: boolean;
    contextBudget: {
      system: number;
      bible: number;
      summaries: number;
      recentProse: number;
      currentScene: number;
      voiceProfile: number;
    };
  };
}

export interface SceneMetadata {
  id?: string;
  chapter: number;
  scene: number;
  order?: number;
  title: string;
  pov: string;
  location: string;
  timeline: string;
  status: "outline" | "draft" | "revised" | "polished" | "final";
  characters_present: string[];
  plot_threads: string[];
  tags: string[];
  summary: string;
  filePath: string;
}

export interface NovelProject {
  config: ProjectConfig;
  rootPath: string;
  scenes: Map<string, SceneMetadata>;
}

// ─── Shared State ─────────────────────────────────────────────────────────────
// jiti may instantiate novel-core.ts more than once (once as a loaded extension,
// again for each import { getProject } from "./novel-core.ts"). Each instance
// gets its own closure, so a plain module-level variable won't be shared.
// Solution: always write to globalThis AND a module-local variable.
// - Internal code uses the module-local `project` (zero overhead, no change).
// - The exported getProject() reads globalThis, so other modules see the value
//   set by whichever instance ran session_start.

const STATE_KEY = "__pi_novel_project__";

let project: NovelProject | null = null;

export function getProject(): NovelProject | null {
  return (globalThis as any)[STATE_KEY] ?? null;
}

export function setProject(p: NovelProject): void {
  project = p;
  (globalThis as any)[STATE_KEY] = p;
}

function _setProject(p: NovelProject): void {
  project = p;
  (globalThis as any)[STATE_KEY] = p;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parseFrontmatter(content: string): { meta: Record<string, any>; body: string } {
  const match = content.match(FRONTMATTER_RE);
  if (!match) return { meta: {}, body: content };
  const rawYaml = match[1];
  const body = content.slice(match[0].length);
  // Simple YAML parser for our known fields
  const meta: Record<string, any> = Object.create(null);
  let currentKey = "";
  let inArray = false;
  for (const line of rawYaml.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const kvMatch = trimmed.match(/^(\w[\w_]*)\s*:\s*(.*)$/);
    if (kvMatch) {
      currentKey = kvMatch[1];
      const val = kvMatch[2].trim();
      if (val === "") {
        meta[currentKey] = [];
        inArray = false;
      } else if (/^["[{]|^(true|false|null)$/.test(val)) {
        try {
          meta[currentKey] = JSON.parse(val);
        } catch {
        // Inline array
          meta[currentKey] = val.startsWith("[")
            ? val.slice(1, -1).split(",").map(s => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean)
            : val.replace(/^["']|["']$/g, "");
        }
        inArray = false;
      } else if (val.startsWith('"') || val.startsWith("'")) {
        meta[currentKey] = val.replace(/^["']|["']$/g, "");
        inArray = false;
      } else {
        meta[currentKey] = isNaN(Number(val)) ? val : Number(val);
        inArray = false;
      }
    } else if (trimmed.startsWith("- ")) {
      if (!Array.isArray(meta[currentKey])) meta[currentKey] = [];
      const item = trimmed.slice(2).trim();
      try { meta[currentKey].push(JSON.parse(item)); }
      catch { meta[currentKey].push(item.replace(/^["']|["']$/g, "")); }
      inArray = true;
    }
  }
  return { meta, body };
}

export function buildFrontmatter(meta: Record<string, any>): string {
  const lines: string[] = ["---"];
  for (const [key, val] of Object.entries(meta)) {
    if (Array.isArray(val)) {
      lines.push(val.length ? `${key}:` : `${key}: []`);
      for (const item of val) {
        lines.push(`  - ${JSON.stringify(item)}`);
      }
    } else if (typeof val === "string") {
      lines.push(`${key}: ${JSON.stringify(val)}`);
    } else {
      lines.push(`${key}: ${JSON.stringify(val)}`);
    }
  }
  lines.push("---", "");
  return lines.join("\n");
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function sceneKey(chapter: number, scene: number): string {
  return `${String(chapter).padStart(2, "0")}-${String(scene).padStart(2, "0")}`;
}

export function orderedScenes(p: NovelProject): SceneMetadata[] {
  return [...p.scenes.values()].sort((a, b) =>
    a.chapter - b.chapter || (a.order ?? a.scene) - (b.order ?? b.scene) || a.scene - b.scene);
}

// Same scope as Pi's footer: all saved usage in this session, including compaction.
// Recompute rather than incrementing on agent_end, which would count retries twice.
export function sessionUsageCost(ctx: any): number | undefined {
  if (!ctx.sessionManager?.getEntries) return undefined;
  return ctx.sessionManager.getEntries().reduce((total: number, entry: any) => {
    const usage = entry.type === "message" && ["assistant", "toolResult"].includes(entry.message.role)
      ? entry.message.usage
      : ["compaction", "branch_summary"].includes(entry.type) ? entry.usage : undefined;
    return total + (usage?.cost?.total ?? 0);
  }, 0);
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

export function scanScenes(rootPath: string, format: string): Map<string, SceneMetadata> {
  const scenes = new Map<string, SceneMetadata>();
  const ids = new Set<string>();
  function insert(key: string, entry: SceneMetadata) {
    if (scenes.has(key)) throw new Error(`Duplicate scene address ${key}`);
    if (entry.id && ids.has(entry.id)) throw new Error(`Duplicate stable scene ID ${entry.id}`);
    if (entry.id) ids.add(entry.id);
    scenes.set(key, entry);
  }
  const msDir = projectPath(rootPath, "manuscript");
  if (!fs.existsSync(msDir)) return scenes;

  if (format === "flash-fiction") {
    const storyPath = projectPath(rootPath, path.join(msDir, "story.md"));
    if (fs.existsSync(storyPath)) {
      const content = readText(storyPath);
      const { meta } = parseFrontmatter(content);
      insert("01-01", sceneMetadata(meta, { chapter: 1, scene: 1, filePath: storyPath }));
    }
    return scenes;
  }

  if (format === "short-story") {
    const scenesDir = projectPath(rootPath, path.join(msDir, "scenes"));
    if (!fs.existsSync(scenesDir)) return scenes;
    for (const file of fs.readdirSync(scenesDir).sort()) {
      if (!file.endsWith(".md")) continue;
      const filePath = projectPath(rootPath, path.join(scenesDir, file));
      const content = readText(filePath);
      const { meta } = parseFrontmatter(content);
      const scNum = positiveInteger(meta.scene ?? (parseInt(file.replace(/\D/g, ""), 10) || 1), "Scene");
      const key = sceneKey(1, scNum);
      if (scenes.has(key)) throw new Error(`Duplicate scene address ${key}`);
      insert(key, sceneMetadata(meta, { chapter: 1, scene: scNum, filePath }));
    }
    return scenes;
  }

  // novel / novella
  const chapDir = projectPath(rootPath, path.join(msDir, "chapters"));
  if (!fs.existsSync(chapDir)) return scenes;
  for (const chDir of fs.readdirSync(chapDir).sort()) {
    const chPath = projectPath(rootPath, path.join(chapDir, chDir));
    if (!fs.statSync(chPath).isDirectory()) continue;
    const chNum = parseInt(chDir.split("-")[0], 10);
    if (isNaN(chNum)) continue;
    for (const file of fs.readdirSync(chPath).sort()) {
      if (!file.endsWith(".md")) continue;
      const filePath = projectPath(rootPath, path.join(chPath, file));
      const content = readText(filePath);
      const { meta } = parseFrontmatter(content);
      const scNum = positiveInteger(meta.scene ?? (parseInt(file.replace(/\D/g, ""), 10) || 1), "Scene");
      const key = sceneKey(chNum, scNum);
      if (scenes.has(key)) throw new Error(`Duplicate scene address ${key}`);
      insert(key, sceneMetadata(meta, { chapter: chNum, scene: scNum, filePath }));
    }
  }
  return scenes;
}

function loadProject(rootPath: string): NovelProject {
  rootPath = fs.realpathSync(rootPath);
  const configPath = path.join(rootPath, "project.json");
  const config: ProjectConfig = JSON.parse(readText(configPath));
  const scenes = scanScenes(rootPath, config.format);
  return { config, rootPath, scenes };
}

/** Read a fresh, path-validated project view without changing the loaded project. */
export function readProjectSnapshot(rootPath: string): NovelProject {
  return loadProject(rootPath);
}

export function refreshProject(): NovelProject | null {
  const p = getProject();
  if (p) {
    const fresh = loadProject(p.rootPath);
    Object.assign(p, fresh);
    setProject(p);
  }
  return p;
}

// Preserve earlier prose before an unattended revision, including repeated passes.
export function saveScene(filePath: string, content: string): void {
  const p = getProject();
  if (!p) throw new Error("No project loaded.");
  filePath = projectPath(p.rootPath, filePath);
  const original = readText(filePath);
  if (original === content) return;
  const backupDir = projectPath(p.rootPath, "notes/revisions");
  ensureDir(backupDir);
  const digest = createHash("sha256").update(original).digest("hex");
  const backup = path.join(backupDir, `${digest}.md`);
  if (!fs.existsSync(backup)) fs.copyFileSync(filePath, backup);
  writeText(filePath, content);
}

export async function replacePassage(chapter: number, scene: number, original: string, replacement: string, expectedSourceHash?: string, expectedProjectRoot?: string) {
  const current = refreshProject();
  if (expectedProjectRoot && current?.rootPath !== expectedProjectRoot) throw new Error("The loaded project changed before editing.");
  const entry = current?.scenes.get(sceneKey(chapter, scene));
  if (!entry) throw new Error(`Scene ${chapter}.${scene} not found.`);
  return withFileMutationQueue(entry.filePath, async () => {
    if (getProject()?.rootPath !== current!.rootPath) throw new Error("The loaded project changed before editing.");
    const raw = readText(entry.filePath);
    const { body } = parseFrontmatter(raw);
    expectVersion(body, expectedSourceHash);
    if (!original || body.split(original).length !== 2) {
      throw new Error("The original passage must match exactly once in the scene prose. Read it again before editing.");
    }
    saveScene(entry.filePath, raw.slice(0, raw.length - body.length) + body.replace(original, () => replacement));
  });
}

// ─── Default project.json ─────────────────────────────────────────────────────

function defaultProjectConfig(title: string): ProjectConfig {
  return {
    title,
    author: "",
    genre: "",
    subgenre: [],
    format: "novel",
    pov: "third-limited",
    tense: "past",
    targetWordCount: 90000,
    dailyWordGoal: 2000,
    comparableTitles: [],
    structuralFramework: "three-act",
    workflow: "structured",
    settings: {
      autoSummary: false,
      summaryModel: "",
      draftModel: "",
      editModel: "",
      voiceProfilePath: "bible/voice-profile.md",
      editor: "auto",
      subscriptionMode: false,
      contextBudget: { system: 2000, bible: 4000, summaries: 4000, recentProse: 6000, currentScene: 3000, voiceProfile: 500 }
    }
  };
}

// ─── Extension Entry Point ────────────────────────────────────────────────────

export default function novelCoreExtension(pi: any) {
  pi.on("before_agent_start", (event: any) => {
    refreshProject();
    // Retire only the exact shipped pre-0.2.2 rule, without rewriting author files.
    const oldRule = "Do NOT manually read/write summary files — always use `summary_generate`, `novel_summary_refresh`, and `/PNW-summarize`.";
    if (getProject() && event.systemPrompt?.includes(oldRule)) {
      return { systemPrompt: event.systemPrompt.replaceAll(oldRule,
        "Read existing summaries with `summary_read` or ordinary read-only file access. Store changes with `summary_generate`; freshness is not factual validation.") };
    }
  });
  pi.on("tool_call", () => { refreshProject(); });

  // ─── Message Renderers ────────────────────────────────────────────────────
  pi.registerMessageRenderer("novel-status", (message: any, _options: any, theme: any) => {
    const details = message.details;
    if (!details) return new Text("Invalid dashboard data.", 0, 0);

    const maxW = Math.max(30, (process.stdout.columns || 60) - 4);
    const T = (str: string) => truncateToWidth(str, maxW);

    const container = new Container();

    // Top Header
    const headerBox = new Box(1, 0, (t: string) => theme.bold(theme.fg("accent", t)));
    headerBox.addChild(new Text(T(` NOVEL DASHBOARD: ${String(details.projectTitle).toUpperCase()} `), 0, 0));
    container.addChild(headerBox);

    // Meta
    container.addChild(new Text(T(`  ${details.genre || "Genre not set"} | POV: ${details.pov} | Tense: ${details.tense}  `), 0, 0, (t: string) => theme.fg("dim", t)));
    container.addChild(new Spacer(1));

    // Stats
    const statsLabel = "  MANUSCRIPT PROGRESS  ";
    const statsDashes = "─".repeat(Math.max(0, maxW - statsLabel.length));
    container.addChild(new Text(statsLabel + statsDashes, 0, 0, (_t: string) => theme.fg("accent", statsLabel) + theme.fg("dim", statsDashes)));
    container.addChild(new Text(T(`  ${details.totalWords} / ${details.targetWordCount} words (${details.pct}%)  `), 2, 0));
    container.addChild(new Text(T(`  Chapters: ${details.chapters} | Scenes: ${details.scenes}  `), 2, 0, (t: string) => theme.fg("dim", t)));
    container.addChild(new Spacer(1));

    // Chapters
    if (details.chapterStats && details.chapterStats.length > 0) {
      const chLabel = "  CHAPTER BREAKDOWN  ";
      const chDashes = "─".repeat(Math.max(0, maxW - chLabel.length));
      container.addChild(new Text(chLabel + chDashes, 0, 0, (_t: string) => theme.fg("accent", chLabel) + theme.fg("dim", chDashes)));
      for (const ch of details.chapterStats) {
         const dominant = ch.dominant;
         const color = dominant === "FINAL" ? "success" : 
                       dominant === "POLISHED" ? "success" :
                       dominant === "DRAFT" ? "accent" :
                       dominant === "WARNING" ? "warning" : "dim";
         
         const padCh = String(ch.ch).padStart(2);
         const padWords = String(ch.words).padStart(6);
         const line = `Ch ${padCh}: ${ch.scenes} scenes, ${padWords} words`;
         container.addChild(new Text(T(`  ${theme.fg(color, "[ " + dominant.padEnd(7) + "]")} ` + line), 2, 0));
      }
    }

    // Alerts
    if (details.alerts && details.alerts.length > 0) {
      container.addChild(new Spacer(1));
      container.addChild(new Text(T(`  ALERTS  `), 0, 0, (t: string) => theme.bg("error", theme.fg("text", t))));
      for (const alert of details.alerts) {
         const badge = alert.level === "error" ? theme.fg("error", "[ ERROR ]") : theme.fg("warning", "[ WARN  ]");
         container.addChild(new Text(T(`  ${badge} ${alert.message}  `), 2, 0));
      }
    }

    if (details.apiCost !== undefined) {
      container.addChild(new Spacer(1));
      container.addChild(new Text(T(`  Session usage estimate: $${details.apiCost.toFixed(3)} (not billing)  `), 2, 0, (t: string) => theme.fg("dim", t)));
    }

    const outerBox = new Box(1, 1);
    outerBox.addChild(container);
    return outerBox;
  });

  // ─── Session Start: Load existing project ─────────────────────────────────
  pi.on("session_start", async (_event: any, ctx: any) => {
    project = null;
    (globalThis as any)[STATE_KEY] = null;
    const projectJsonPath = path.join(ctx.cwd, "project.json");
    if (fs.existsSync(projectJsonPath)) {
      try {
        _setProject(loadProject(ctx.cwd));
        pi.setSessionName(project!.config.title);
        pi.events.emit("novel:project-loaded", { project });
      } catch (err: any) {
        pi.sendMessage({
          customType: "markdown",
          content: `Warning: Found project.json in ${ctx.cwd} but failed to load it.\n\nError: ${err?.message || String(err)}\n\nRun \`/PNW-load ${ctx.cwd}\` to retry, or \`/PNW-init\` to create a new project.`,
          display: true
        });
      }
    }
  });

  // ─── /PNW-load Command ────────────────────────────────────────────────────
  pi.registerCommand("PNW-load", {
    description: "Load an existing novel project from a path (e.g. /PNW-load C:/projects/my-novel)",
    handler: async (args: string, ctx: any) => {
      const targetPath = path.resolve(ctx.cwd, args.trim().replace(/^"(.*)"$/, "$1") || ".");
      const projectJsonPath = path.join(targetPath, "project.json");
      if (!fs.existsSync(projectJsonPath)) {
        pi.sendMessage({ customType: "markdown", content: `No project.json found in: ${targetPath}\n\nRun \`/PNW-init\` to create a new project there.`, display: true });
        return;
      }
      try {
        _setProject(loadProject(targetPath));
        pi.setSessionName(project!.config.title);
        pi.events.emit("novel:project-loaded", { project });
        pi.sendMessage({ customType: "markdown", content: `Loaded project: **${project!.config.title}**\nPath: ${targetPath}`, display: true });
      } catch (err: any) {
        pi.sendMessage({ customType: "markdown", content: `Failed to load project from: ${targetPath}\n\nError: ${err?.message || String(err)}`, display: true });
      }
    }
  });

  // ─── /PNW-init Command ────────────────────────────────────────────────────
  pi.registerCommand("PNW-init", {
    description: "Initialize a new novel project in the current directory",
    handler: async (args: string, ctx: any) => {
      const root = ctx.cwd;
      const isQuick = args?.includes("--quick");
      const title = "Untitled Novel";
      if (fs.existsSync(path.join(root, "project.json")) || fs.existsSync(path.join(root, "manuscript"))) {
        pi.sendMessage({ customType: "markdown", content: "Existing novel work found. Use /PNW-load instead; initialization will not overwrite it.", display: true });
        return;
      }
      ensureDir(path.join(root, ".pi"));

      // Create project.json
      const config = defaultProjectConfig(title);
      writeText(path.join(root, "project.json"), JSON.stringify(config, null, 2));

      // Create .gitattributes
      if (!fs.existsSync(path.join(root, ".gitattributes"))) writeText(path.join(root, ".gitattributes"), "* text=auto eol=lf\n*.json text eol=lf\n*.md   text eol=lf\n*.yaml text eol=lf\n");

      // Create .gitignore
      const ignorePath = path.join(root, ".gitignore");
      const ignored = fs.existsSync(ignorePath) ? readText(ignorePath) : "";
      writeText(ignorePath, ignored + "\nnode_modules/\n.pi/edit-suggestions.json\n.pi/progress.json\n.pi/github.json\nexports/\n");

      if (isQuick) {
        // Minimal: just project.json + first scene
        const sceneDir = path.join(root, "manuscript", "chapters", "01");
        ensureDir(sceneDir);
        const sceneMeta = { chapter: 1, scene: 1, title: "Opening Scene", pov: "", location: "", timeline: "", status: "outline", characters_present: [], plot_threads: [], tags: [], summary: "" };
        writeText(path.join(sceneDir, "scene-01.md"), buildFrontmatter(sceneMeta) + "\n");
      } else {
        // Full directory structure
        const dirs = [
          ".pi",
          "outline", "outline/chapters",
          "manuscript/chapters",
          "bible", "bible/characters", "bible/world", "bible/locations", "bible/items", "bible/factions",
          "timeline", "continuity", "summaries/chapters", "summaries/scenes",
          "feedback", "notes/deleted-scenes", "notes/deleted-bible", "exports"
        ];
        for (const d of dirs) ensureDir(path.join(root, d));

        // .gitkeep files
        const gitkeeps = [
          "outline/chapters", "manuscript/chapters", "bible/characters", "bible/world",
          "bible/locations", "bible/items", "bible/factions", "summaries/chapters",
          "summaries/scenes", "feedback", "notes/deleted-scenes", "notes/deleted-bible", "exports"
        ];
        for (const d of gitkeeps) {
          const keepPath = path.join(root, d, ".gitkeep");
          if (!fs.existsSync(keepPath)) writeText(keepPath, "");
        }

        // Create placeholder files
        writeText(path.join(root, "premise.md"), "# Premise\n\n*Develop your premise using the `premise` skill.*\n");
        writeText(path.join(root, "outline", "beat-sheet.md"), "# Beat Sheet\n\n*Create your beat sheet using the `outline-novel` skill.*\n");
        writeText(path.join(root, "bible", "voice-profile.md"), "# Voice Profile\n\n*Generate your voice profile using the `voice-match` skill.*\n");
        writeText(path.join(root, "timeline", "timeline.json"), JSON.stringify({ events: [] }, null, 2));
        writeText(path.join(root, "continuity", "facts.json"), JSON.stringify({ last_synced: "", characters: {}, world_rules: [] }, null, 2));
        writeText(path.join(root, "continuity", "character-states.json"), JSON.stringify({}, null, 2));
        writeText(path.join(root, "continuity", "report.json"), JSON.stringify({ last_run: "", issues: [] }, null, 2));

        // Copy SYSTEM.md to .pi/
        const pkgDir = fileURLToPath(new URL("../", import.meta.url));
        const systemSrc = path.join(pkgDir, "system", "SYSTEM.md");
        if (fs.existsSync(systemSrc) && !fs.existsSync(path.join(root, ".pi", "APPEND_SYSTEM.md"))) {
          writeText(path.join(root, ".pi", "APPEND_SYSTEM.md"), readText(systemSrc));
        }

        // Generate AGENTS.md from template
        const templateSrc = path.join(pkgDir, "system", "AGENTS.md.template");
        if (fs.existsSync(templateSrc) && !fs.existsSync(path.join(root, ".pi", "AGENTS.md"))) {
          let agentsContent = readText(templateSrc);
          agentsContent = agentsContent
            .replace(/\{\{title\}\}/g, config.title)
            .replace(/\{\{genre\}\}/g, config.genre || "Not set")
            .replace(/\{\{format\}\}/g, config.format)
            .replace(/\{\{workflow\}\}/g, config.workflow)
            .replace(/\{\{pov\}\}/g, config.pov)
            .replace(/\{\{tense\}\}/g, config.tense)
            .replace(/\{\{targetWordCount\}\}/g, String(config.targetWordCount))
            .replace(/\{\{structuralFramework\}\}/g, config.structuralFramework);
          writeText(path.join(root, ".pi", "AGENTS.md"), agentsContent);
        }

        // Create first chapter + scene
        const ch1Dir = path.join(root, "manuscript", "chapters", "01");
        ensureDir(ch1Dir);
        const sceneMeta = { chapter: 1, scene: 1, title: "Opening Scene", pov: "", location: "", timeline: "", status: "outline", characters_present: [], plot_threads: [], tags: [], summary: "" };
        writeText(path.join(ch1Dir, "scene-01.md"), buildFrontmatter(sceneMeta) + "\n");
      }

      // Load the new project
      _setProject(loadProject(root));
      pi.setSessionName(project!.config.title);
      pi.events.emit("novel:project-loaded", { project });

      pi.sendMessage({
        customType: "markdown",
        content: `Novel project "${config.title}" initialized. Run the getting-started skill to configure your project.`,
        display: true
      });
    }
  });

  // ─── /PNW-status Command ──────────────────────────────────────────────────
  pi.registerCommand("PNW-status", {
    description: "Show project dashboard with word count, chapter status, and alerts",
    handler: async (_args: string, ctx: any) => {
      refreshProject();
      if (!project) {
        pi.sendMessage({ customType: "markdown", content: "No project loaded. Run /PNW-init first.", display: true });
        return;
      }
      const c = project.config;
      let totalWords = 0;
      const chapterStats = new Map<number, { scenes: number[]; words: number; statuses: string[] }>();

      for (const [_key, scene] of project.scenes) {
        const content = readText(scene.filePath);
        const { body } = parseFrontmatter(content);
        const words = countWords(body);
        totalWords += words;
        const stat = chapterStats.get(scene.chapter) || { scenes: [], words: 0, statuses: [] };
        stat.scenes.push(scene.scene);
        stat.words += words;
        stat.statuses.push(scene.status);
        chapterStats.set(scene.chapter, stat);
      }

      const pct = c.targetWordCount > 0 ? ((totalWords / c.targetWordCount) * 100).toFixed(1) : "0.0";

      const chapterStatsArr = [...chapterStats.entries()].sort((a, b) => a[0] - b[0]).map(([ch, stat]) => {
        const dominantStatus = stat.statuses.sort()[Math.floor(stat.statuses.length / 2)];
        return { ch, words: stat.words, scenes: stat.scenes.length, dominant: dominantStatus ? dominantStatus.toUpperCase() : "UNKNOWN" };
      });

      const missingGaps: string[] = [];
      const chNums = [...chapterStats.keys()].sort((a,b) => a - b);
      if (chNums.length > 0) {
          const minCh = chNums[0];
          const maxCh = chNums[chNums.length - 1];
          for (let i = minCh; i <= maxCh; i++) {
              if (!chapterStats.has(i)) missingGaps.push(`Chapter ${i} missing`);
          }
      }
      for (const [ch, stat] of chapterStats) {
          if (stat.scenes.length > 0) {
              const scNums = [...stat.scenes].sort((a,b) => a - b);
              const minSc = scNums[0];
              const maxSc = scNums[scNums.length - 1];
              for (let i = minSc; i <= maxSc; i++) {
                  if (!scNums.includes(i)) missingGaps.push(`Chapter ${ch} Scene ${i} missing`);
              }
          }
      }

      const apiCost = sessionUsageCost(ctx);

      pi.sendMessage({
        customType: "novel-status",
        content: `Dashboard for ${c.title}`,
        display: true,
        details: {
           projectTitle: c.title,
           genre: c.genre, pov: c.pov, tense: c.tense,
           totalWords, targetWordCount: c.targetWordCount, pct,
           chapters: chapterStats.size, scenes: project.scenes.size,
           chapterStats: chapterStatsArr,
           alerts: missingGaps.map(message => ({ level: "warning", message })),
           apiCost
        }
      });
    }
  });



  // ─── Tool: novel_project_info ─────────────────────────────────────────────
  pi.registerTool({
    name: "novel_project_info",
    label: "Project Info",
    description: "Read project.json and return project metadata including format, workflow, word count target, and settings",
    parameters: Type.Object({}),
    execute: async () => {
      refreshProject();
      if (!project) return { content: [{ type: "text", text: "No project loaded. Run /PNW-init first." }] };
      return { content: [{ type: "text", text: JSON.stringify(project.config, null, 2) }] };
    }
  });

  // ─── Tool: novel_scene_create ─────────────────────────────────────────────
  pi.registerTool({
    name: "novel_scene_create",
    label: "Create Scene",
    description: "Create a new scene file with YAML frontmatter and auto-numbering",
    parameters: Type.Object({
      chapter: Type.Number({ description: "Chapter number" }),
      title: Type.Optional(Type.String({ description: "Scene title" })),
      pov: Type.Optional(Type.String({ description: "POV character name" })),
      location: Type.Optional(Type.String({ description: "Scene location" })),
      timeline: Type.Optional(Type.String({ description: "Timeline position (e.g. 'Day 3, Morning')" })),
      characters_present: Type.Optional(Type.Array(Type.String(), { description: "Characters in this scene" })),
    }),
    execute: async (_id: string, params: any) => {
      if (!project) return { content: [{ type: "text", text: "No project loaded. Run /PNW-init first." }] };
      const { chapter, title, pov, location, timeline, characters_present } = params;
      if (!Number.isInteger(chapter) || chapter < 1) throw new Error("Chapter must be a positive integer.");
      const format = project.config.format;
      if (["short-story", "flash-fiction"].includes(format) && chapter !== 1) throw new Error("This format uses chapter 1 only.");
      if (format === "flash-fiction" && project.scenes.size) throw new Error("Flash fiction already has its single scene.");

      // Find next scene number for this chapter
      let maxScene = 0;
      for (const [_k, s] of project.scenes) {
        if (s.chapter === chapter && s.scene > maxScene) maxScene = s.scene;
      }
      const sceneNum = maxScene + 1;

      // Build path
      const chDirName = String(chapter).padStart(2, "0");
      const chDir = format === "flash-fiction" ? path.join(project.rootPath, "manuscript")
        : format === "short-story" ? path.join(project.rootPath, "manuscript", "scenes")
        : path.join(project.rootPath, "manuscript", "chapters", chDirName);
      ensureDir(chDir);

      const meta: Record<string, any> = {
        id: newId(), chapter, scene: sceneNum,
        title: title || `Scene ${sceneNum}`,
        pov: pov || "", location: location || "", timeline: timeline || "",
        status: "outline",
        characters_present: characters_present || [], plot_threads: [], tags: [], summary: ""
      };

      const fileName = format === "flash-fiction" ? "story.md" : `scene-${String(sceneNum).padStart(2, "0")}.md`;
      const filePath = path.join(chDir, fileName);
      if (fs.existsSync(filePath)) throw new Error("A scene already exists at that path. Reload the project before creating another.");
      writeText(filePath, buildFrontmatter(meta) + "\n");

      // Update in-memory state
      const key = sceneKey(chapter, sceneNum);
      project.scenes.set(key, { ...meta, filePath } as SceneMetadata);

      return { content: [{ type: "text", text: `Created scene: Chapter ${chapter}, Scene ${sceneNum} — "${meta.title}"\nFile: ${filePath}` }] };
    }
  });

  // ─── Tool: novel_scene_read ───────────────────────────────────────────────
  pi.registerTool({
    name: "novel_scene_read",
    label: "Read Scene",
    description: "Read a scene file with parsed frontmatter, word count, and prose content. Supports offset/limit for large scenes.",
    parameters: Type.Object({
      chapter: Type.Number({ description: "Chapter number" }),
      scene: Type.Number({ description: "Scene number" }),
      offset: Type.Optional(Type.Number({ description: "Line offset to start reading from" })),
      limit: Type.Optional(Type.Number({ description: "Max lines to return" })),
    }),
    execute: async (_id: string, params: any) => {
      if (!project) return { content: [{ type: "text", text: "No project loaded. Run /PNW-init first." }] };
      const key = sceneKey(params.chapter, params.scene);
      const scene = project.scenes.get(key);
      if (!scene) return { content: [{ type: "text", text: `Scene ${params.chapter}.${params.scene} not found.` }] };

      const content = readText(scene.filePath);
      const { meta, body } = parseFrontmatter(content);
      const words = countWords(body);
      let lines = body.split("\n");
      const totalLines = lines.length;

      if (params.offset) lines = lines.slice(params.offset);
      if (params.limit) lines = lines.slice(0, params.limit);

      const result = {
        ...meta,
        sourceHash: proseHash(body),
        wordCount: words,
        totalLines,
        content: lines.join("\n"),
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  });

  // ─── Tool: novel_scene_status ─────────────────────────────────────────────
  pi.registerTool({
    name: "novel_scene_status",
    label: "Update Scene Status",
    description: "Update a scene's status (outline → draft → revised → polished → final). After advancing status to 'draft' or higher, run summary_generate manually to create or refresh the scene summary.",
    parameters: Type.Object({
      chapter: Type.Number({ description: "Chapter number" }),
      scene: Type.Number({ description: "Scene number" }),
      status: Type.String({ description: "New status: outline, draft, revised, polished, or final" }),
    }),
    execute: async (_id: string, params: any) => {
      if (!project) return { content: [{ type: "text", text: "No project loaded." }] };
      const key = sceneKey(params.chapter, params.scene);
      const scene = project.scenes.get(key);
      if (!scene) return { content: [{ type: "text", text: `Scene ${params.chapter}.${params.scene} not found.` }] };

      const validStatuses = ["outline", "draft", "revised", "polished", "final"];
      if (!validStatuses.includes(params.status)) {
        return { content: [{ type: "text", text: `Invalid status "${params.status}". Valid: ${validStatuses.join(", ")}` }] };
      }

      // Update frontmatter on disk
      const content = readText(scene.filePath);
      const { meta, body } = parseFrontmatter(content);
      meta.status = params.status;
      writeText(scene.filePath, buildFrontmatter(meta) + body);

      // Update in-memory
      scene.status = params.status;

      // Emit event so other extensions can hook into it
      pi.events.emit("novel:scene-status-updated", { chapter: params.chapter, scene: params.scene, status: params.status, content: body });

      const reminder = params.status !== "outline" ? "\nRun summary_generate to update the scene summary." : "";
      return { content: [{ type: "text", text: `Scene ${params.chapter}.${params.scene} status updated to "${params.status}".${reminder}` }] };
    }
  });

  // ─── Tool: novel_scene_delete ─────────────────────────────────────────────
  pi.registerTool({
    name: "novel_scene_delete",
    label: "Delete Scene",
    description: "Archive a scene to notes/deleted-scenes/ (non-destructive delete)",
    parameters: Type.Object({
      chapter: Type.Number({ description: "Chapter number" }),
      scene: Type.Number({ description: "Scene number" }),
    }),
    execute: async (_id: string, params: any) => {
      if (!project) return { content: [{ type: "text", text: "No project loaded." }] };
      const key = sceneKey(params.chapter, params.scene);
      const scene = project.scenes.get(key);
      if (!scene) return { content: [{ type: "text", text: `Scene ${params.chapter}.${params.scene} not found.` }] };

      const archiveDir = path.join(project.rootPath, "notes", "deleted-scenes");
      ensureDir(archiveDir);
      const archiveName = `ch${String(params.chapter).padStart(2, "0")}-scene${String(params.scene).padStart(2, "0")}-${Date.now()}.md`;
      fs.renameSync(scene.filePath, path.join(archiveDir, archiveName));
      project.scenes.delete(key);

      return { content: [{ type: "text", text: `Scene ${params.chapter}.${params.scene} archived to notes/deleted-scenes/${archiveName}` }] };
    }
  });

  // ─── Tool: novel_scene_move ───────────────────────────────────────────────
  pi.registerTool({
    name: "novel_scene_move",
    label: "Move Scene",
    description: "Move a scene to a different chapter with automatic renumbering",
    parameters: Type.Object({
      chapter: Type.Number({ description: "Source chapter number" }),
      scene: Type.Number({ description: "Source scene number" }),
      targetChapter: Type.Number({ description: "Destination chapter number" }),
    }),
    execute: async (_id: string, params: any) => {
      if (!project) return { content: [{ type: "text", text: "No project loaded." }] };
      const key = sceneKey(params.chapter, params.scene);
      const scene = project.scenes.get(key);
      if (!scene) return { content: [{ type: "text", text: `Scene not found.` }] };

      // Find next available scene number in target chapter
      let maxScene = 0;
      for (const [_k, s] of project.scenes) {
        if (s.chapter === params.targetChapter && s.scene > maxScene) maxScene = s.scene;
      }
      const newSceneNum = maxScene + 1;

      // Create target directory
      const targetDir = path.join(project.rootPath, "manuscript", "chapters", String(params.targetChapter).padStart(2, "0"));
      ensureDir(targetDir);

      // Update frontmatter
      const content = readText(scene.filePath);
      const { meta, body } = parseFrontmatter(content);
      meta.chapter = params.targetChapter;
      meta.scene = newSceneNum;
      delete meta.order; // Moving appends to the target chapter, not the old split position.

      const newFileName = `scene-${String(newSceneNum).padStart(2, "0")}.md`;
      const newPath = path.join(targetDir, newFileName);
      writeText(newPath, buildFrontmatter(meta) + body);
      fs.unlinkSync(scene.filePath);

      // Update in-memory
      project.scenes.delete(key);
      const newKey = sceneKey(params.targetChapter, newSceneNum);
      project.scenes.set(newKey, { ...scene, order: undefined, chapter: params.targetChapter, scene: newSceneNum, filePath: newPath });

      return { content: [{ type: "text", text: `Moved to Chapter ${params.targetChapter}, Scene ${newSceneNum}` }] };
    }
  });

  // ─── Tool: novel_chapter_list ─────────────────────────────────────────────
  pi.registerTool({
    name: "novel_chapter_list",
    label: "List Chapters",
    description: "List all chapters with aggregate stats: scene count, word count, status breakdown",
    parameters: Type.Object({}),
    execute: async () => {
      if (!project) return { content: [{ type: "text", text: "No project loaded." }] };
      const stats = new Map<number, { scenes: number; words: number; statuses: string[] }>();

      for (const [_k, scene] of project.scenes) {
        const content = readText(scene.filePath);
        const { body } = parseFrontmatter(content);
        const words = countWords(body);
        const s = stats.get(scene.chapter) || { scenes: 0, words: 0, statuses: [] };
        s.scenes++;
        s.words += words;
        s.statuses.push(scene.status);
        stats.set(scene.chapter, s);
      }

      const lines = ["Chapter | Scenes | Words | Status"];
      for (const [ch, s] of [...stats.entries()].sort((a, b) => a[0] - b[0])) {
        const dominantStatus = s.statuses.sort()[Math.floor(s.statuses.length / 2)];
        const dominant = dominantStatus ? dominantStatus : "unknown";
        lines.push(`${String(ch).padStart(3)}     | ${String(s.scenes).padStart(6)} | ${String(s.words).padStart(5)} | ${dominant}`);
      }

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  });

  // ─── Tool: novel_search ───────────────────────────────────────────────────
  pi.registerTool({
    name: "novel_search",
    label: "Search Manuscript",
    description: "Search across all manuscript files with chapter/scene/line/context results. Supports regex and plain text.",
    parameters: Type.Object({
      query: Type.String({ description: "Search query (text or regex)" }),
      regex: Type.Optional(Type.Boolean({ description: "Treat query as regex" })),
      chapterMin: Type.Optional(Type.Number({ description: "Filter: minimum chapter number" })),
      chapterMax: Type.Optional(Type.Number({ description: "Filter: maximum chapter number" })),
      status: Type.Optional(Type.String({ description: "Filter: scene status" })),
      pov: Type.Optional(Type.String({ description: "Filter: POV character" })),
    }),
    execute: async (_id: string, params: any) => {
      if (!project) return { content: [{ type: "text", text: "No project loaded." }] };
      const results: string[] = [];
      const pattern = params.regex ? new RegExp(params.query, "gi") : null;

      for (const scene of orderedScenes(project)) {
        if (params.chapterMin && scene.chapter < params.chapterMin) continue;
        if (params.chapterMax && scene.chapter > params.chapterMax) continue;
        if (params.status && scene.status !== params.status) continue;
        if (params.pov && normalizeKey(scene.pov) !== normalizeKey(params.pov)) continue;

        const content = readText(scene.filePath);
        const { body } = parseFrontmatter(content);
        const lines = body.split("\n");

        for (let i = 0; i < lines.length; i++) {
          const match = pattern ? pattern.test(lines[i]) : lines[i].toLowerCase().includes(params.query.toLowerCase());
          if (match) {
            results.push(`Ch${scene.chapter} Sc${scene.scene} L${i + 1}: ${lines[i].trim()}`);
            if (results.length >= 50) break;
          }
          if (pattern) pattern.lastIndex = 0; // reset regex state
        }
        if (results.length >= 50) break;
      }

      if (results.length === 0) return { content: [{ type: "text", text: "No results found." }] };
      return { content: [{ type: "text", text: `Found ${results.length} matches:\n\n${results.join("\n")}` }] };
    }
  });

  // ─── Tool: novel_validate ─────────────────────────────────────────────────
  pi.registerTool({
    name: "novel_validate",
    label: "Validate Scenes",
    description: "Scan all scene files for frontmatter issues. Report and optionally fix problems.",
    parameters: Type.Object({
      fix: Type.Optional(Type.Boolean({ description: "Automatically fix issues where possible" })),
    }),
    execute: async (_id: string, params: any) => {
      if (!project) return { content: [{ type: "text", text: "No project loaded." }] };
      const issues: string[] = [];

      for (const [key, scene] of project.scenes) {
        const content = readText(scene.filePath);
        const { meta } = parseFrontmatter(content);
        if (!meta.chapter) issues.push(`${key}: missing 'chapter' field`);
        if (!meta.scene) issues.push(`${key}: missing 'scene' field`);
        if (!meta.status) issues.push(`${key}: missing 'status' field`);
        if (meta.chapter && meta.chapter !== scene.chapter) {
          issues.push(`${key}: frontmatter chapter (${meta.chapter}) doesn't match path (${scene.chapter})`);
        }
      }

      if (issues.length === 0) return { content: [{ type: "text", text: "✓ All scenes valid. No issues found." }] };
      return { content: [{ type: "text", text: `Found ${issues.length} issues:\n\n${issues.join("\n")}` }] };
    }
  });

  // ─── Tool: novel_scene_list ───────────────────────────────────────────────
  pi.registerTool({
    name: "novel_scene_list",
    label: "List Scenes",
    description: "List all scenes with metadata: chapter, scene number, title, status, POV, word count (computed on-the-fly)",
    parameters: Type.Object({
      chapter: Type.Optional(Type.Number({ description: "Filter by chapter number" })),
    }),
    execute: async (_id: string, params: any) => {
      if (!project) return { content: [{ type: "text", text: "No project loaded." }] };
      const rows: string[] = ["Ch | Sc | Title | Status | POV | Words"];

      for (const scene of orderedScenes(project)) {
        if (params.chapter && scene.chapter !== params.chapter) continue;
        const content = readText(scene.filePath);
        const { body } = parseFrontmatter(content);
        const words = countWords(body);
        rows.push(`${String(scene.chapter).padStart(2)} | ${String(scene.scene).padStart(2)} | ${scene.title || "--"} | ${scene.status} | ${scene.pov || "--"} | ${words}`);
      }

      return { content: [{ type: "text", text: rows.join("\n") }] };
    }
  });

  // ─── Tool: novel_scene_write ──────────────────────────────────────────────
  pi.registerTool({
    name: "novel_scene_write",
    label: "Write Scene",
    description: "Write or update scene prose content, preserving YAML frontmatter",
    parameters: Type.Object({
      chapter: Type.Number({ description: "Chapter number" }),
      scene: Type.Number({ description: "Scene number" }),
      content: Type.String({ description: "New prose content for the scene body (frontmatter is preserved)" }),
      expectedSourceHash: Type.Optional(Type.String({ pattern: "^[0-9a-f]{64}$" })),
    }),
    execute: async (_id: string, params: any) => {
      if (!project) return { content: [{ type: "text", text: "No project loaded." }] };
      const key = sceneKey(params.chapter, params.scene);
      const scene = project.scenes.get(key);
      if (!scene) return { content: [{ type: "text", text: `Scene ${params.chapter}.${params.scene} not found.` }] };

      await withFileMutationQueue(scene.filePath, async () => {
        const existing = readText(scene.filePath);
        const { body } = parseFrontmatter(existing);
        expectVersion(body, params.expectedSourceHash);
        saveScene(scene.filePath, existing.slice(0, existing.length - body.length) + params.content);
      });

      return { content: [{ type: "text", text: `Scene ${params.chapter}.${params.scene} updated. Words: ${countWords(params.content)}` }] };
    }
  });

  // ─── Tool: novel_scene_split ────────────────────────────────────────────
  pi.registerTool({
    name: "novel_scene_split",
    label: "Split Scene",
    description: "Split a scene at a body-line boundary, preserving the original version. The continuation reads immediately after its first half; existing scene IDs and references remain stable.",
    parameters: Type.Object({
      chapter: Type.Number({ description: "Chapter number" }),
      scene: Type.Number({ description: "Scene number" }),
      splitAtLine: Type.Number({ description: "Line number to split at (content after this line goes to the new scene)" }),
    }),
    execute: async (_id: string, params: any) => {
      if (!project) return { content: [{ type: "text", text: "No project loaded." }] };
      const key = sceneKey(params.chapter, params.scene);
      const scene = project.scenes.get(key);
      if (!scene) return { content: [{ type: "text", text: `Scene not found.` }] };

      const activeProject = project;
      return withFileMutationQueue(scene.filePath, async () => {
      const content = readText(scene.filePath);
      const { meta, body } = parseFrontmatter(content);
      const lines = body.split("\n");
      if (!Number.isInteger(params.splitAtLine) || params.splitAtLine < 1 || params.splitAtLine >= lines.length) {
        return { content: [{ type: "text", text: `Invalid split line. Scene has ${lines.length} lines.` }] };
      }

      const firstHalf = lines.slice(0, params.splitAtLine).join("\n");
      const secondHalf = lines.slice(params.splitAtLine).join("\n");

      // IDs stay stable, so summaries, plans and knowledge references to OTHER
      // scenes need no renumbering. Only reading order changes.
      let maxScene = 0;
      for (const [_k, s] of activeProject.scenes) {
        if (s.chapter === params.chapter && s.scene > maxScene) maxScene = s.scene;
      }
      const newNum = maxScene + 1;
      const siblings = orderedScenes(activeProject).filter(s => s.chapter === params.chapter);
      const next = siblings[siblings.findIndex(s => s.scene === params.scene) + 1];
      const position = meta.order ?? params.scene;
      const order = next ? (position + (next.order ?? next.scene)) / 2 : position + 1;
      const newMeta = { ...meta, id: newId(), derived_from: meta.id ? [meta.id] : [], scene: newNum, order, title: `${meta.title || "Scene"} (continued)`, summary: "" };
      const chDir = path.dirname(scene.filePath);
      const newPath = path.join(chDir, `scene-${String(newNum).padStart(2, "0")}.md`);
      // Save the continuation before cutting the original; a failed write must
      // not lose the second half or overwrite an existing scene.
      fs.writeFileSync(newPath, buildFrontmatter(newMeta) + secondHalf, { encoding: "utf8", flag: "wx" });
      meta.summary = "";
      saveScene(scene.filePath, buildFrontmatter(meta) + firstHalf);

      const newKey = sceneKey(params.chapter, newNum);
      activeProject.scenes.set(newKey, { ...scene, id: newMeta.id, scene: newNum, order, title: newMeta.title, filePath: newPath } as SceneMetadata);

      return { content: [{ type: "text", text: `Split at line ${params.splitAtLine}. New scene: Ch${params.chapter} Sc${newNum}, immediately after Sc${params.scene} in reading order. Other scene IDs are unchanged. Refresh both summaries and their affected scene cards/continuity.` }] };
      });
    }
  });

  // ─── Tool: novel_scene_merge ────────────────────────────────────────────
  pi.registerTool({
    name: "novel_scene_merge",
    label: "Merge Scenes",
    description: "Merge two adjacent scenes. First scene's frontmatter is preserved; characters_present are unioned; second scene's prose is appended after a scene break. Originals archived.",
    parameters: Type.Object({
      chapter: Type.Number({ description: "Chapter number" }),
      scene1: Type.Number({ description: "First scene number (this scene's frontmatter is kept)" }),
      scene2: Type.Number({ description: "Second scene number (this scene is merged into the first)" }),
    }),
    execute: async (_id: string, params: any) => {
      if (!project) return { content: [{ type: "text", text: "No project loaded." }] };
      const key1 = sceneKey(params.chapter, params.scene1);
      const key2 = sceneKey(params.chapter, params.scene2);
      const s1 = project.scenes.get(key1);
      const s2 = project.scenes.get(key2);
      if (!s1 || !s2) return { content: [{ type: "text", text: "One or both scenes not found." }] };

      if (key1 === key2) throw new Error("Cannot merge a scene with itself.");
      const siblings = orderedScenes(project).filter(s => s.chapter === params.chapter);
      if (siblings.findIndex(s => s.scene === params.scene2) !== siblings.findIndex(s => s.scene === params.scene1) + 1) throw new Error("Merge requires adjacent scenes in reading order.");
      const content1 = readText(s1.filePath);
      const content2 = readText(s2.filePath);
      const { meta: meta1, body: body1 } = parseFrontmatter(content1);
      const { meta: meta2, body: body2 } = parseFrontmatter(content2);

      // Union characters_present
      const chars = new Set([...(meta1.characters_present || []), ...(meta2.characters_present || [])]);
      meta1.characters_present = [...chars];
      meta1.merged_from = [...(meta1.merged_from || []), ...(meta2.id ? [meta2.id] : [])];

      // Archive originals
      const archiveDir = path.join(project.rootPath, "notes", "deleted-scenes");
      ensureDir(archiveDir);
      const ts = Date.now();
      fs.copyFileSync(s1.filePath, path.join(archiveDir, `pre-merge-${ts}-sc${params.scene1}.md`));
      fs.copyFileSync(s2.filePath, path.join(archiveDir, `pre-merge-${ts}-sc${params.scene2}.md`));

      // Merge: first body + scene break + second body
      const merged = body1.trimEnd() + "\n\n***\n\n" + body2.trimStart();
      writeText(s1.filePath, buildFrontmatter(meta1) + merged);

      // Remove second scene
      fs.unlinkSync(s2.filePath);
      project.scenes.delete(key2);

      return { content: [{ type: "text", text: `Merged scenes ${params.scene1} + ${params.scene2}. Originals archived.` }] };
    }
  });

  // ─── Tool: novel_find_replace ───────────────────────────────────────────
  pi.registerTool({
    name: "novel_find_replace",
    label: "Find & Replace",
    description: "Find and replace across the entire project (manuscript, bible, outlines, summaries). Supports preview mode.",
    parameters: Type.Object({
      find: Type.String({ minLength: 1, description: "Text to find" }),
      replace: Type.String({ description: "Replacement text" }),
      preview: Type.Optional(Type.Boolean({ description: "Preview only — don't apply changes (default: true)" })),
    }),
    execute: async (_id: string, params: any) => {
      if (!project) return { content: [{ type: "text", text: "No project loaded." }] };
      const activeProject = project;
      const previewMode = params.preview !== false;
      const results: string[] = [];
      let totalReplacements = 0;

      const scanDirs = ["manuscript", "bible", "outline", "summaries"];
      for (const dir of scanDirs) {
        const dirPath = path.join(activeProject.rootPath, dir);
        if (!fs.existsSync(dirPath)) continue;
        const files = getAllMdFiles(dirPath);
        for (const filePath of files) {
          await withFileMutationQueue(filePath, async () => {
          const content = readText(filePath);
          const count = (content.match(new RegExp(escapeRegex(params.find), "g")) || []).length;
          if (count > 0) {
            const rel = path.relative(activeProject.rootPath, filePath);
            results.push(`${rel}: ${count} occurrence(s)`);
            totalReplacements += count;
            if (!previewMode) {
              const updated = content.split(params.find).join(params.replace);
              if (dir === "manuscript") saveScene(filePath, updated);
              else writeText(filePath, updated);
            }
          }
          });
        }
      }

      if (totalReplacements === 0) return { content: [{ type: "text", text: "No matches found." }] };
      const action = previewMode ? "Would replace" : "Replaced";
      return { content: [{ type: "text", text: `${action} ${totalReplacements} occurrences across ${results.length} files:\n\n${results.join("\n")}` }] };
    }
  });

  // ─── Tool: novel_rename_entity ──────────────────────────────────────────
  pi.registerTool({
    name: "novel_rename_entity",
    label: "Rename Entity",
    description: "Rename a character/location/item everywhere using word-boundary matching. Handles case variations and updates aliases.",
    parameters: Type.Object({
      oldName: Type.String({ description: "Current entity name" }),
      newName: Type.String({ description: "New entity name" }),
      preview: Type.Optional(Type.Boolean({ description: "Preview only (default: true)" })),
    }),
    execute: async (_id: string, params: any) => {
      if (!project) return { content: [{ type: "text", text: "No project loaded." }] };
      const activeProject = project;
      const previewMode = params.preview !== false;
      const pattern = new RegExp(`\\b${escapeRegex(params.oldName)}\\b`, "g");
      const results: string[] = [];
      let total = 0;

      const scanDirs = ["manuscript", "bible", "outline", "summaries", "continuity", "timeline"];
      for (const dir of scanDirs) {
        const dirPath = path.join(activeProject.rootPath, dir);
        if (!fs.existsSync(dirPath)) continue;
        const files = getAllFiles(dirPath);
        for (const filePath of files) {
          await withFileMutationQueue(filePath, async () => {
          const content = readText(filePath);
          const matches = content.match(pattern);
          if (matches && matches.length > 0) {
            const rel = path.relative(activeProject.rootPath, filePath);
            results.push(`${rel}: ${matches.length} occurrence(s)`);
            total += matches.length;
            if (!previewMode) {
              const updated = content.replace(pattern, () => params.newName);
              if (dir === "manuscript") saveScene(filePath, updated);
              else writeText(filePath, updated);
            }
          }
          });
        }
      }

      if (total === 0) return { content: [{ type: "text", text: `No occurrences of "${params.oldName}" found.` }] };
      const action = previewMode ? "Would rename" : "Renamed";
      return { content: [{ type: "text", text: `${action} ${total} occurrences across ${results.length} files:\n\n${results.join("\n")}` }] };
    }
  });

  // ─── Tool: novel_reindex ────────────────────────────────────────────────
  pi.registerTool({
    name: "novel_reindex",
    label: "Reindex Scenes",
    description: "Rewrite all scene frontmatter to match file paths. Use to recover from manual file moves.",
    parameters: Type.Object({}),
    execute: async () => {
      if (!project) return { content: [{ type: "text", text: "No project loaded." }] };
      let fixed = 0;

      // Re-scan from disk
      const freshScenes = scanScenes(project.rootPath, project.config.format);
      for (const [key, scene] of freshScenes) {
        const content = readText(scene.filePath);
        const { meta, body } = parseFrontmatter(content);
        let needsUpdate = false;
        if (meta.chapter !== scene.chapter) { meta.chapter = scene.chapter; needsUpdate = true; }
        if (meta.scene !== scene.scene) { meta.scene = scene.scene; needsUpdate = true; }
        if (needsUpdate) {
          writeText(scene.filePath, buildFrontmatter(meta) + body);
          fixed++;
        }
      }

      project.scenes = freshScenes;
      return { content: [{ type: "text", text: fixed > 0 ? `Reindexed ${fixed} scene(s).` : "All scenes already correctly indexed." }] };
    }
  });

  // ─── Tool: cost_estimate ────────────────────────────────────────────────
  pi.registerTool({
    name: "cost_estimate",
    label: "Cost Estimate",
    description: "Estimate the selected prose's token footprint (not billing or cumulative context). Scene scope requires chapter and scene; chapter scope requires chapter.",
    parameters: Type.Object({
      operation: Type.String({ description: "Operation type: summary, analysis, bulk-edit, or custom" }),
      scope: Type.Optional(Type.String({ description: "Scope: scene, chapter, or all" })),
      chapter: Type.Optional(Type.Integer({ minimum: 1 })),
      scene: Type.Optional(Type.Integer({ minimum: 1 })),
    }),
    execute: async (_id: string, params: any) => {
      if (!project) return { content: [{ type: "text", text: "No project loaded." }] };

      const scope = params.scope || "all";
      if (!["scene", "chapter", "all"].includes(scope)) throw new Error("Scope must be scene, chapter, or all.");
      if (scope !== "all" && !params.chapter) throw new Error("Supply a chapter number for this scope.");
      if (scope === "scene" && !params.scene) throw new Error("Supply a scene number for scene scope.");
      const selected = orderedScenes(project).filter(s =>
        scope === "all" || (s.chapter === params.chapter && (scope === "chapter" || s.scene === params.scene)));
      if (!selected.length) throw new Error("No scenes found for the selected scope.");
      let totalWords = 0;
      for (const scene of selected) {
        const content = readText(scene.filePath);
        const { body } = parseFrontmatter(content);
        totalWords += countWords(body);
      }

      const tokensPerWord = 1.3;
      const totalTokens = Math.round(totalWords * tokensPerWord);
      const sceneCount = selected.length;

      const estimates: Record<string, string> = {
        summary: `~${totalTokens} input + ~${sceneCount * 150} output tokens (${sceneCount} scenes)`,
        analysis: `~${totalTokens} input + ~${Math.round(sceneCount * 500)} output tokens`,
        "bulk-edit": `~${totalTokens} input + ~${totalTokens} output tokens (full rewrite)`,
        custom: `Selected prose: ${totalWords} words, ~${totalTokens} tokens, ${sceneCount} scenes`,
      };

      const est = estimates[params.operation] || estimates.custom;
      return { content: [{ type: "text", text: `Token estimate for "${params.operation}" (${scope}):\n${est}\nExcludes prompts, repeated history and other context; not a billing estimate.` }] };
    }
  });

} // end extension

// ─── File scanning helpers ────────────────────────────────────────────────────

function getAllMdFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...getAllMdFiles(full));
    else if (entry.name.endsWith(".md")) results.push(full);
  }
  return results;
}

function getAllFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...getAllFiles(full));
    else if (entry.name.endsWith(".md") || entry.name.endsWith(".json")) results.push(full);
  }
  return results;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
