// novel-progress.ts — Phase 6
// Progress tracking, dashboard, sprint mode, and help command

import path from "node:path";
import fs from "node:fs";
import { Type } from "typebox";
import { withFileMutationQueue } from "@earendil-works/pi-coding-agent";
import { Box, Text, Container, Spacer, truncateToWidth } from "@earendil-works/pi-tui";
import { readText, writeText } from "./utils/platform.ts";
import { getProject, sessionUsageCost, countWords, parseFrontmatter } from "./novel-core.ts";
import { proseHash as generateHash } from "./llgf/version.ts";
import { manuscriptCoverage } from "./llgf/manuscript.ts";
import { findAllBibleEntries } from "./novel-bible.ts";

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function getTotalWords(project: any) {
  let total = 0;
  for (const [_key, scene] of project.scenes) {
    if (fs.existsSync(scene.filePath)) {
      const content = readText(scene.filePath);
      const { body } = parseFrontmatter(content);
      total += countWords(body);
    }
  }
  return total;
}

function loadProgress(project: any) {
  const progressPath = path.join(project.rootPath, ".pi", "progress.json");
  const goals = { daily: project.config.dailyWordGoal ?? 2000, total: project.config.targetWordCount ?? 90000 };
  if (fs.existsSync(progressPath)) {
    try {
      return { ...JSON.parse(readText(progressPath)), goals };
    } catch {}
  }
  return {
    history: {}, // date YYYY-MM-DD -> word count 
    goals
  };
}

function saveProgress(project: any, progress: any) {
  const progressPath = path.join(project.rootPath, ".pi", "progress.json");
  ensureDir(path.dirname(progressPath));
  writeText(progressPath, JSON.stringify(progress, null, 2));
}

let sprintInterval: NodeJS.Timeout | null = null;
let sprintRemainingSeconds = 0;
let sprintStartWords = 0;

interface WorkflowStageResult {
  stageId: number;
  stageLabel: string;
  stats: {
    managedCoverage?: ReturnType<typeof manuscriptCoverage>;
    scenesByStatus: Record<string, number>;
    totalScenes: number;
    bibleEntryCount: number;
    outlineChapterCount: number;
    draftedChapterCount: number;
    pendingSuggestions: number;
    estimatedWordCount: number;
    targetWordCount: number;
  };
  nextSteps: Array<{
    action: string;
    command: string;
  }>;
}

const STAGE_LABELS: Record<number, string> = {
  1: "No project loaded",
  2: "Project ready - start planning",
  3: "Bible started - create your outline",
  4: "Outlined - begin drafting",
  5: "Drafting - summaries need updating",
  6: "Drafting in progress",
  7: "Listed scenes drafted - check coverage before editing",
  8: "Editing in progress",
  9: "Scenes marked polished/final - review status is separate",
};

async function detectWorkflowStage(
  project: any | null,
  rootPath: string | null
): Promise<WorkflowStageResult> {

  // --- Helpers ---

  function getAllMdFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    const results: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        results.push(...getAllMdFiles(path.join(dir, entry.name)));
      } else if (entry.name.endsWith(".md") && entry.name !== ".gitkeep") {
        results.push(path.join(dir, entry.name));
      }
    }
    return results;
  }

  function countOutlineChapters(root: string): number {
    const dir = path.join(root, "outline", "chapters");
    if (!fs.existsSync(dir)) return 0;
    return fs.readdirSync(dir).filter((f) => f.endsWith(".md")).length;
  }

  function getPendingSuggestions(root: string): number {
    const p = path.join(root, ".pi", "edit-suggestions.json");
    if (!fs.existsSync(p)) return 0;
    try {
      const data = JSON.parse(fs.readFileSync(p, "utf8"));
      return Array.isArray(data.pending) ? data.pending.length : 0;
    } catch {
      return 0;
    }
  }

  function getEstimatedWordCount(scenes: Map<string, any>, _root: string): number {
    let total = 0;
    for (const meta of scenes.values()) {
      if (meta.status === "outline") continue;
      total += countWords(parseFrontmatter(readText(meta.filePath)).body);
    }
    return total;
  }

  // --- Stats computation ---

  const bibleEntryCount = rootPath
    ? findAllBibleEntries(rootPath).length
    : 0;

  const outlineChapterCount = rootPath ? countOutlineChapters(rootPath) : 0;

  const pendingSuggestions = rootPath ? getPendingSuggestions(rootPath) : 0;

  const scenes: Map<string, any> = project?.scenes ?? new Map();

  const scenesByStatus: Record<string, number> = {};
  for (const meta of scenes.values()) {
    scenesByStatus[meta.status] = (scenesByStatus[meta.status] ?? 0) + 1;
  }
  const totalScenes = scenes.size;

  const estimatedWordCount =
    project && rootPath ? getEstimatedWordCount(scenes, rootPath) : 0;

  const targetWordCount: number = project?.config?.targetWordCount ?? 90000;

  const draftedStatusSet = new Set(["draft", "revised", "polished", "final"]);
  const draftedChapterCount = new Set(
    [...scenes.values()]
      .filter((m) => draftedStatusSet.has(m.status))
      .map((m) => m.chapter)
  ).size;

  const stats = {
    ...(project ? { managedCoverage: manuscriptCoverage(project) } : {}),
    scenesByStatus,
    totalScenes,
    bibleEntryCount,
    outlineChapterCount,
    draftedChapterCount,
    pendingSuggestions,
    estimatedWordCount,
    targetWordCount,
  };

  // --- Stage detection (priority order) ---

  const NEXT_STEPS: Record<number, Array<{ action: string; command: string }>> = {
    1: [
      { action: "Initialize a new project in the current directory", command: "/PNW-init" },
      { action: "Load an existing project", command: "/PNW-load <path>" },
    ],
    2: [
      { action: "Develop your premise and concept", command: "Run the premise skill" },
      { action: "Build your world", command: "Run the world-building skill" },
      { action: "Interview your protagonist", command: "Run the character-interview skill" },
    ],
    3: [
      { action: "Create a full novel outline", command: "Run the outline-novel skill" },
      { action: "Outline a single chapter", command: "Run the outline-chapter skill" },
    ],
    4: [
      { action: "Draft your first scene", command: "Run the draft-scene skill" },
      { action: "Review your outline before drafting", command: "/PNW-outline" },
    ],
    5: [
      { action: "Generate summaries for drafted scenes", command: "Ask me to summarize the drafted scenes" },
      { action: "Continue drafting while summaries are pending", command: "Run the draft-scene skill" },
    ],
    6: [
      { action: "Continue drafting the next scene", command: "Run the draft-scene skill" },
      { action: "Check your progress", command: "/PNW-progress" },
      { action: "Review what you've written so far", command: "/PNW-status" },
    ],
    7: [
      { action: "Start developmental editing", command: "Run the dev-edit skill" },
      { action: "Check voice consistency", command: "Run the voice-match skill" },
      { action: "Review continuity", command: "Run the continuity-check skill" },
    ],
    8: [
      { action: "Review pending edit suggestions", command: "/PNW-suggestions" },
      { action: "Run line editing", command: "Run the line-edit skill" },
    ],
    9: [
      { action: "Run copy editing", command: "Run the copy-edit skill" },
      { action: "Run continuity check", command: "Run the continuity-check skill" },
      { action: "Compile and export your manuscript", command: "/PNW-compile" },
    ],
  };

  function makeResult(stageId: number): WorkflowStageResult {
    return {
      stageId,
      stageLabel: STAGE_LABELS[stageId],
      stats,
      nextSteps: NEXT_STEPS[stageId],
    };
  }

  // Stage 1: no project
  if (!project || !rootPath) return makeResult(1);

  // Stage 2: project loaded but no bible entries
  if (bibleEntryCount === 0) return makeResult(2);

  // Stage 3: bible started but no outline chapters
  if (outlineChapterCount === 0) return makeResult(3);

  // Stage 4: outlined but no drafted scenes
  const hasDraftedScenes = [...scenes.values()].some((m) =>
    draftedStatusSet.has(m.status)
  );
  if (!hasDraftedScenes) return makeResult(4);

  // Stage 5: drafted scenes exist but any is missing its summary file
  const missingSummary = [...scenes.entries()].some(([key, meta]) => {
    if (!draftedStatusSet.has(meta.status)) return false;
    const summaryPath = path.join(rootPath, "summaries", "scenes", `${key}.md`);
    return !fs.existsSync(summaryPath) || parseFrontmatter(readText(summaryPath)).meta.hash !== generateHash(parseFrontmatter(readText(meta.filePath)).body);
  });
  if (missingSummary) return makeResult(5);

  // Stage 6: summaries exist for all drafted scenes but outline-status scenes remain,
  //          OR outline has more chapters than have been drafted yet
  const hasOutlineScenes = [...scenes.values()].some((m) => m.status === "outline");
  const hasUnstartedOutlineChapters = outlineChapterCount > draftedChapterCount;

  if (hasOutlineScenes || hasUnstartedOutlineChapters) return makeResult(6);

  // Stage 8: editing in progress (check before stage 7 and 9)
  if (pendingSuggestions > 0) return makeResult(8);

  // Stage 9: all scenes polished or final
  const exportReadyStatuses = new Set(["polished", "final"]);
  const allExportReady =
    totalScenes > 0 &&
    [...scenes.values()].every((m) => exportReadyStatuses.has(m.status));
  if (allExportReady) return makeResult(9);

  // Stage 7: first draft complete, begin editing
  return makeResult(7);
}

export default function novelProgressExtension(pi: any) {
  pi.on("session_shutdown", () => {
    if (sprintInterval) clearInterval(sprintInterval);
    sprintInterval = null;
  });

  // ─── Message Renderers ───────────────────────────────────────────────────
  pi.registerMessageRenderer("novel-progress", (message: any, _options: any, theme: any) => {
    const details = message.details;
    if (!details) return new Text("Invalid progress data", 0, 0);

    const maxW = Math.max(30, (process.stdout.columns || 60) - 4);
    const container = new Container();
    const safeTitle = truncateToWidth(String(details.projectTitle).toUpperCase(), 50);

    // Top Header
    const headerBox = new Box(1, 0, (t: string) => theme.bold(theme.fg("accent", t)));
    headerBox.addChild(new Text(` 📈 PROGRESS DASHBOARD: ${safeTitle} `, 0, 0));
    container.addChild(headerBox);
    container.addChild(new Spacer(1));

    // Sparklines 
    const history = details.history || {};
    const sparkChars = [" ", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
    const dates = [];
    for (let i = 6; i >= 0; i--) {
       const d = new Date();
       d.setDate(d.getDate() - i);
       dates.push(d.toISOString().split("T")[0]);
    }
    const vals = dates.map(d => history[d] || 0);
    const maxVal = Math.max(...vals, 1);
    const sparkline = vals.map(v => {
        const idx = Math.min(Math.floor((v / maxVal) * 8), 7);
        const char = sparkChars[idx];
        return v === 0 ? theme.fg("dim", char) : theme.fg("success", char);
    }).join("");

    const l7Label = "  LAST 7 DAYS ";
    const l7Dashes = "─".repeat(Math.max(0, maxW - l7Label.length));
    container.addChild(new Text(l7Label + l7Dashes, 0, 0, (_t: string) => theme.fg("accent", l7Label) + theme.fg("dim", l7Dashes)));
    container.addChild(new Text(`  ${sparkline}  Max: ${maxVal} words `, 2, 0));
    container.addChild(new Spacer(1));

    const dgLabel = "  DAILY GOAL ";
    const dgDashes = "─".repeat(Math.max(0, maxW - dgLabel.length));
    container.addChild(new Text(dgLabel + dgDashes, 0, 0, (_t: string) => theme.fg("accent", dgLabel) + theme.fg("dim", dgDashes)));
    // Sub-cell progress bar
    const barLen = 30;
    const dFillFrac = details.dailyGoal > 0 ? (details.writtenToday / details.dailyGoal) * barLen : 0;
    const dFillInt = Math.floor(dFillFrac);
    const dRemainFrac = dFillFrac - dFillInt;
    const subChars = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉"];
    const subChar = subChars[Math.floor(dRemainFrac * 8)] || "";
    
    let dBarStr = "";
    if (dFillInt >= barLen) {
        dBarStr = "█".repeat(barLen);
    } else {
        dBarStr = "█".repeat(dFillInt) + subChar + "░".repeat(Math.max(0, barLen - dFillInt - (subChar ? 1 : 0)));
    }
    
    container.addChild(new Text(`  ${String(details.writtenToday).padStart(5)} / ${details.dailyGoal} words  `, 2, 0));
    container.addChild(new Text(`  [${theme.fg("success", dBarStr.slice(0, barLen))}] ${details.dPct}% `, 2, 0));
    container.addChild(new Spacer(1));

    const tnLabel = "  TOTAL NOVEL ";
    const tnDashes = "─".repeat(Math.max(0, maxW - tnLabel.length));
    container.addChild(new Text(tnLabel + tnDashes, 0, 0, (_t: string) => theme.fg("accent", tnLabel) + theme.fg("dim", tnDashes)));
    const tFillFrac = details.totalGoal > 0 ? (details.words / details.totalGoal) * barLen : 0;
    const tFillInt = Math.floor(tFillFrac);
    const tRemainFrac = tFillFrac - tFillInt;
    const tSubChar = subChars[Math.floor(tRemainFrac * 8)] || "";
    
    let tBarStr = "";
    if (tFillInt >= barLen) {
        tBarStr = "█".repeat(barLen);
    } else {
        tBarStr = "█".repeat(tFillInt) + tSubChar + "░".repeat(Math.max(0, barLen - tFillInt - (tSubChar ? 1 : 0)));
    }
    
    container.addChild(new Text(`  ${String(details.words).padStart(5)} / ${details.totalGoal} words `, 2, 0));
    container.addChild(new Text(`  [${theme.fg("success", tBarStr.slice(0, barLen))}] ${details.tPct}% `, 2, 0));
    
    container.addChild(new Spacer(1));
    container.addChild(new Text(details.apiCost === undefined
      ? "  Session usage estimate unavailable"
      : `  Session usage estimate: $${details.apiCost.toFixed(3)} (not billing)`, 2, 0, (t: string) => theme.fg("dim", t)));

    const outerBox = new Box(1, 1);
    outerBox.addChild(container);
    return outerBox;
  });

  pi.registerMessageRenderer("novel-help", (message: any) => new Text(message.content, 1, 1));

  pi.registerMessageRenderer("novel-next", (message: any, _options: any, theme: any) => {
    const result = message.details as WorkflowStageResult | undefined;
    if (!result) return new Text("  No workflow data available.", 2, 0);

    const maxW = Math.max(30, (process.stdout.columns || 60) - 4);
    const container = new Container();

    // HEADER
    const headerBox = new Box(1, 0, (t: string) => theme.bold(theme.fg("accent", t)));
    headerBox.addChild(new Text(" WHAT'S NEXT ", 0, 0));
    container.addChild(headerBox);
    container.addChild(new Spacer(1));

    // WHERE YOU ARE section
    const whereLabel = "  WHERE YOU ARE ";
    const whereDashes = "─".repeat(Math.max(0, maxW - whereLabel.length));
    container.addChild(new Text(whereLabel + whereDashes, 0, 0, (_t: string) => theme.fg("accent", whereLabel) + theme.fg("dim", whereDashes)));

    const stageText = truncateToWidth(`  ${result.stageLabel}`, maxW);
    container.addChild(new Text(stageText, 2, 0, (t: string) => theme.bold(t)));
    container.addChild(new Spacer(1));

    const {
      totalScenes, estimatedWordCount, targetWordCount,
      bibleEntryCount, outlineChapterCount, draftedChapterCount,
      scenesByStatus, pendingSuggestions,
    } = result.stats;

    const fmt = (n: number) => n.toLocaleString("en-US");
    const pct = targetWordCount > 0
      ? ((estimatedWordCount / targetWordCount) * 100).toFixed(1)
      : "0.0";

    const LABEL_W = 12;
    function row(label: string, value: string): void {
      const padded = `  ${label.padEnd(LABEL_W)}${value}`;
      container.addChild(new Text(truncateToWidth(padded, maxW), 2, 0, (t: string) => {
        const labelPart = t.slice(0, 2 + LABEL_W);
        const valuePart = t.slice(2 + LABEL_W);
        return theme.fg("dim", labelPart) + valuePart;
      }));
    }

    // Word count
    const wordValue = targetWordCount > 0
      ? `${fmt(estimatedWordCount)} / ${fmt(targetWordCount)}  (${pct}%)`
      : `~${fmt(estimatedWordCount)}`;
    row("Words:", wordValue);

    // Chapter progress (only meaningful when outline exists)
    if (outlineChapterCount > 0) {
      row("Chapters:", `${draftedChapterCount} of ${outlineChapterCount} outlined`);
    }

    // Scene breakdown by status
    if (scenesByStatus && Object.keys(scenesByStatus).length > 0) {
      const breakdown = Object.entries(scenesByStatus)
        .map(([status, count]) => `${count} ${status}`)
        .join("  ");
      row("Scenes:", `${totalScenes} total  (${breakdown})`);
    } else {
      row("Scenes:", String(totalScenes));
    }

    // Bible entries
    row("Bible:", `${bibleEntryCount} entries`);

    // Pending suggestions
    if (pendingSuggestions > 0) {
      row("Suggestions:", `${pendingSuggestions} pending`);
    }

    container.addChild(new Spacer(1));

    // NEXT STEPS section
    const nextLabel = "  NEXT STEPS ";
    const nextDashes = "─".repeat(Math.max(0, maxW - nextLabel.length));
    container.addChild(new Text(nextLabel + nextDashes, 0, 0, (_t: string) => theme.fg("accent", nextLabel) + theme.fg("dim", nextDashes)));

    const steps = result.nextSteps ?? [];
    steps.forEach((step: { action: string; command: string }, i: number) => {
      const actionLine = truncateToWidth(`  ${i + 1}. ${step.action}`, maxW);
      container.addChild(new Text(actionLine, 2, 0));
      const cmdLine = truncateToWidth(`     > ${step.command}`, maxW);
      container.addChild(new Text(cmdLine, 2, 0, (t: string) => theme.fg("success", t)));
      if (i < steps.length - 1) container.addChild(new Spacer(1));
    });

    container.addChild(new Spacer(1));

    // FOOTER
    const footerLine = truncateToWidth("  Run /PNW-next anytime to check your progress.", maxW);
    container.addChild(new Text(footerLine, 2, 0, (t: string) => theme.fg("dim", t)));

    const outerBox = new Box(1, 1);
    outerBox.addChild(container);
    return outerBox;
  });

  // ─── Events ─────────────────────────────────────────────────────────────
  pi.on("agent_end", async (event: any, ctx: any) => {
    const project = getProject();
    if (!project) return;
    
    // Update daily word count record
    const progress = loadProgress(project);
    const today = new Date().toISOString().split("T")[0];
    const words = getTotalWords(project);
    
    progress.history[today] = words;
    
    saveProgress(project, progress);
  });

  // ─── Command: /PNW-progress ───────────────────────────────────────────────
  pi.registerCommand("PNW-progress", {
    description: "Display progress dashboard (Word counts, daily goal, history)",
    handler: async (_args: string, ctx: any) => {
      const project = getProject();
      if (!project) {
        pi.sendMessage({ customType: "markdown", content: "No project loaded. Run /PNW-init first.", display: true });
        return;
      }

      const progress = loadProgress(project);
      const words = getTotalWords(project);
      
      const today = new Date().toISOString().split("T")[0];
      const todayWords = words;
      
      // Calculate daily change (simplistic: current total minus yesterday's total)
      let yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yKey = yesterday.toISOString().split("T")[0];
      const yesterdayWords = progress.history[yKey] || 0;
      
      let writtenToday = 0;
      if (progress.history[yKey] !== undefined) {
         writtenToday = todayWords - yesterdayWords;
      } else {
         writtenToday = todayWords; // First day tracking
      }
      
      if (writtenToday < 0) writtenToday = 0;

      const dailyGoal = progress.goals.daily;
      const totalGoal = progress.goals.total;
      
      const dPct = dailyGoal > 0 ? Math.min(100, (writtenToday / dailyGoal) * 100).toFixed(1) : "N/A";
      const tPct = totalGoal > 0 ? Math.min(100, (words / totalGoal) * 100).toFixed(1) : "N/A";

      pi.sendMessage({
        customType: "novel-progress",
        content: `Progress Dashboard`,
        display: true,
        details: {
          projectTitle: project.config.title,
          writtenToday, dailyGoal, dPct,
          words, totalGoal, tPct,
          apiCost: sessionUsageCost(ctx),
          managedCoverage: manuscriptCoverage(project),
          history: progress.history
        }
      });
    }
  });

  // ─── Command: /PNW-sprint ─────────────────────────────────────────────────
  pi.registerCommand("PNW-sprint", {
    description: "Start a timed writing sprint (e.g. /PNW-sprint 15 for 15 minutes)",
    handler: async (args: string, ctx: any) => {
      const project = getProject();
      if (!project) {
        pi.sendMessage({ customType: "markdown", content: "No project loaded. Run /PNW-init first.", display: true });
        return;
      }

      if (sprintInterval) {
        pi.sendMessage({ customType: "markdown", content: "A sprint is already running! Abort it with Ctrl+C first.", display: true });
        return;
      }

      let minutes = parseInt(args.trim(), 10);
      if (isNaN(minutes) || minutes <= 0) minutes = 25; // default pomodoro

      sprintRemainingSeconds = minutes * 60;
      sprintStartWords = getTotalWords(project);
      
      const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${String(m).padStart(2, "0")}:${String(s).padStart(2,"0")}`;
      };

      pi.sendMessage({ customType: "markdown", content: `Sprint started: ${minutes} minutes. Go write!`, display: true });

      // We attach to the global abort signal if available
      const controller = new AbortController();
      let aborted = false;

      // Note: Assuming ctx has access to process or signal events if appropriate, 
      // otherwise, we just let it run.
      // Here we simulate the interval logic
      sprintInterval = setInterval(() => {
        sprintRemainingSeconds -= 5;
        if (sprintRemainingSeconds <= 0) {
           if (sprintInterval) clearInterval(sprintInterval);
           sprintInterval = null;

           const endWords = getTotalWords(project);
           const diff = endWords - sprintStartWords;
           const wpm = minutes > 0 ? (diff / minutes).toFixed(1) : 0;
           pi.sendMessage({ customType: "markdown", content: `Sprint complete! You wrote ${diff} words (${wpm} WPM).`, display: true });
           if (ctx.ui?.setFooter) ctx.ui.setFooter(undefined);
           return;
        }

        // Live update footer
        if (ctx.ui?.setFooter) {
           const currWords = getTotalWords(project);
           const written = currWords - sprintStartWords;
           const sprintMsg = `Sprint: ${formatTime(sprintRemainingSeconds)} remaining | ${written} words written`;
           ctx.ui.setFooter((_ui: any, _theme: any) => new Text(sprintMsg, 0, 0));
        }
      }, 5000);

      if (ctx.signal) {
         ctx.signal.addEventListener("abort", () => {
           if (sprintInterval) clearInterval(sprintInterval);
           sprintInterval = null;
           aborted = true;
           const endWords = getTotalWords(project);
           const diff = endWords - sprintStartWords;
           if (ctx.ui?.setFooter) ctx.ui.setFooter(undefined);
           pi.sendMessage({ customType: "markdown", content: `Sprint aborted. You wrote ${diff} words.`, display: true });
         });
      }

      pi.sendMessage({
        customType: "markdown",
        content: `Sprint started. Check the footer for the timer!`,
        display: true
      });
    }
  });

  // ─── Command: /PNW-help ───────────────────────────────────────────────────
  pi.registerCommand("PNW-help", {
    description: "Show all available novel commands",
    handler: async (_args: string, ctx: any) => {
      const commands = pi.getCommands().filter((command: any) => command.name.startsWith("PNW-"))
        .sort((a: any, b: any) => a.name.localeCompare(b.name));

      pi.sendMessage({
        customType: "novel-help",
        content: "NOVEL WRITING COMMANDS\n\n" + commands.map((command: any) =>
          `/${command.name}\n  ${command.description || ""}`).join("\n\n"),
        display: true,
        details: commands
      });
    }
  });

  pi.registerCommand("PNW-next", {
    description: "Show where you are in the writing workflow and what to do next",
    handler: async (_args: string, _ctx: any) => {
      const project = getProject();
      const rootPath = project?.rootPath ?? null;
      const result = await detectWorkflowStage(project, rootPath);
      pi.sendMessage({ customType: "novel-next", content: "Workflow status analyzed.", display: true, details: result });
    }
  });

  // ─── Tool: progress_overview ──────────────────────────────────────────────
  pi.registerTool({
    name: "progress_overview",
    label: "Progress Overview",
    description: "Get the raw progress stats (word count, goals, history).",
    parameters: Type.Object({}),
    execute: async (_id: string, _params: any, _signal: any, _onUpdate: any, ctx: any) => {
      const project = getProject();
      if (!project) return { content: [{ type: "text", text: "No project loaded." }] };
      const { cumulative_api_cost_usd: _legacyCost, ...progress } = loadProgress(project);
      progress.currentWords = getTotalWords(project);
      progress.session_usage_cost_usd = sessionUsageCost(ctx);
      progress.usage_note = "Current session's reported model usage estimate, including compaction; not billing.";
      return { content: [{ type: "text", text: JSON.stringify(progress, null, 2) }] };
    }
  });

  // ─── Tool: progress_set_goal ──────────────────────────────────────────────
  pi.registerTool({
    name: "progress_set_goal",
    label: "Set Progress Goal",
    description: "Set the daily or total word count targets.",
    parameters: Type.Object({
      daily: Type.Optional(Type.Integer({ minimum: 0 })),
      total: Type.Optional(Type.Integer({ minimum: 0 }))
    }),
    execute: async (_id: string, params: any) => {
      const project = getProject();
      if (!project) return { content: [{ type: "text", text: "No project loaded." }] };
      const configPath = path.join(project.rootPath, "project.json");
      await withFileMutationQueue(configPath, async () => {
        const config = JSON.parse(readText(configPath));
        if (params.daily !== undefined) config.dailyWordGoal = params.daily;
        if (params.total !== undefined) config.targetWordCount = params.total;
        writeText(configPath, JSON.stringify(config, null, 2));
        project.config = config;
        saveProgress(project, loadProgress(project));
      });
      const progress = loadProgress(project);
      return { content: [{ type: "text", text: `Goals updated to: Daily ${progress.goals.daily}, Total ${progress.goals.total}` }] };
    }
  });

}
