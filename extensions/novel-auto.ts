import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { Type } from "typebox";
import { summaryCurrent } from "./llgf/summaries.ts";
import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getProject, refreshProject, parseFrontmatter, countWords, sceneKey } from "./novel-core.ts";
import { compileManuscriptInternal } from "./novel-export.ts";
import { readText, writeText } from "./utils/platform.ts";

const phases = ["brainstorm", "outline", "draft", "review", "complete"] as const;
type Phase = typeof phases[number];
const findingStatuses = ["supported", "uncertain", "contradicted", "not-applicable"] as const;
const aspects = ["causality", "perspective", "progression", "continuity", "emotion", "language"] as const;
const runFile = ".pi/novel-run.json";
const workflowPath = fileURLToPath(new URL("../skills/autonomous-novel/SKILL.md", import.meta.url));
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
type SceneRef = { chapter: number; scene: number };
type Finding = {
  aspect: typeof aspects[number];
  status: "supported" | "uncertain" | "contradicted" | "not-applicable";
  quote: string;
  note: string;
  blocking: boolean;
};
interface Run {
  version: 1;
  brief: string;
  phase: Phase;
  status: "running" | "paused" | "blocked" | "complete";
  revision: number;
  next: string;
  evidence: Record<string, string>;
  plan: SceneRef[];
  planHistory?: { plan: SceneRef[]; reason: string }[];
  minWords: number;
  maxWords: number;
  reviews: Record<string, { hash: string; reconstruction: string; findings: Finding[] }>;
  blocker?: string;
  output?: string;
}

function project() {
  const p = refreshProject();
  if (!p) throw new Error("No novel loaded. Use /PNW-init or /PNW-load first.");
  return p;
}

export function readRun(root: string): Run | null {
  const file = path.join(root, runFile);
  if (!fs.existsSync(file)) return null;
  const run = JSON.parse(readText(file)) as Run;
  if (run.version !== 1 || !phases.includes(run.phase) || !Array.isArray(run.plan) ||
      !run.evidence || !run.reviews || typeof run.brief !== "string") {
    throw new Error("The saved writing run is unreadable. It has been left untouched.");
  }
  return run;
}

function saveRun(root: string, run: Run) {
  writeText(path.join(root, runFile), JSON.stringify(run, null, 2) + "\n");
}

function evidenceFile(root: string, relative: string) {
  const file = fs.realpathSync(path.resolve(root, relative));
  const rel = path.relative(fs.realpathSync(root), file);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel) ||
      rel.split(path.sep).some(part => part.startsWith(".")) ||
      !/\.(md|json)$/.test(rel) || !fs.statSync(file).isFile()) {
    throw new Error(`Evidence must be a Markdown or JSON document inside this novel: ${relative}`);
  }
  const text = readText(file);
  if (!text.trim()) throw new Error(`Evidence is empty: ${relative}`);
  return { relative: rel.replace(/\\/g, "/"), text };
}

function requireEvidence(root: string, run: Run, relative: string) {
  const item = evidenceFile(root, relative);
  if (run.evidence[item.relative] !== hash(item.text)) {
    throw new Error(`Save a checkpoint referencing the current ${relative} before advancing.`);
  }
}

export function manuscriptIssues(p: ReturnType<typeof project>, run: Run, reviewed: boolean): string[] {
  const issues: string[] = [];
  const expected = new Set(run.plan.map(s => sceneKey(s.chapter, s.scene)));
  if (!expected.size) issues.push("No scene plan recorded.");
  let words = 0;
  for (const key of expected) {
    const scene = p.scenes.get(key);
    if (!scene) { issues.push(`${key}: planned scene missing`); continue; }
    const { body, meta } = parseFrontmatter(readText(scene.filePath));
    words += countWords(body);
    if (!body.trim() || !["draft", "revised", "polished", "final"].includes(meta.status)) {
      issues.push(`${key}: prose is missing or not drafted`);
    }
    if (reviewed) {
      const review = run.reviews[key];
      if (!review || review.hash !== hash(body)) issues.push(`${key}: review missing or stale`);
      else if (review.findings.some(f => f.blocking)) issues.push(`${key}: blocking review finding`);
      const summary = path.join(p.rootPath, "summaries", "scenes", `${key}.md`);
      if (!fs.existsSync(summary) || !summaryCurrent(p.rootPath, parseFrontmatter(readText(summary)).meta, body)) {
        issues.push(`${key}: summary missing or stale`);
      }
    }
  }
  for (const key of p.scenes.keys()) {
    if (!expected.has(key)) issues.push(`${key}: scene is absent from the recorded plan`);
  }
  if (words < run.minWords || words > run.maxWords) {
    issues.push(`Manuscript has ${words} words; the recorded range is ${run.minWords}–${run.maxWords}.`);
  }
  return issues;
}

function summary(run: Run, full = false) {
  return {
    status: run.status, phase: run.phase, next: run.next,
    revision: run.revision, wordRange: [run.minWords, run.maxWords],
    plannedScenes: run.plan.length, recordedReviews: Object.keys(run.reviews).length,
    evidenceCount: Object.keys(run.evidence).length,
    ...(full ? { brief: run.brief, evidence: Object.keys(run.evidence) } : {}),
    blocker: run.blocker, output: run.output
  };
}

export default function novelAutoExtension(pi: ExtensionAPI) {
  // Execution permission is session-local. Opening/reloading a project never starts paid work.
  let armedRoot: string | undefined;
  let startRevision = 0;
  let recoverySent = false;
  let lastStop: string | undefined;
  let compacting = false;

  const show = (content: string) => pi.sendMessage({ customType: "novel-auto-status", content, display: true });
  const continueRun = (root: string, run: Run, recovery = false) => {
    startRevision = run.revision;
    pi.sendMessage({
      customType: "novel-auto-continue",
      content: `Continue the authorized novel-writing run in ${root}. Consult novel_auto_status for the next unit. Use ${workflowPath}; read it only if unavailable in the current context. Read the relevant scene and changed dependencies, not the entire artifact index or previously read theses on every unit. Complete one substantive unit, then call novel_auto_checkpoint; it ends the unit and automatic continuation proceeds. No milestone approvals. ${recovery ? "The previous response saved no checkpoint: inspect actual work, save its evidence, or report a genuine blocker. Do not repeat a status-only response." : ""}`,
      display: false
    }, { triggerTurn: true, deliverAs: "followUp" });
  };
  function pause(reason: string, blocked = false) {
    const root = armedRoot;
    armedRoot = undefined;
    if (!root) return;
    const run = readRun(root);
    if (!run || run.status === "complete") return;
    run.status = blocked ? "blocked" : "paused";
    run.blocker = reason;
    saveRun(root, run);
  }
  function queueNext(root: string, run: Run, ctx: any, recovery = false) {
    const usage = ctx.getContextUsage();
    const limit = Math.min(128_000, (usage?.contextWindow || 1_050_000) * 0.6);
    if (usage?.tokens != null && usage.tokens >= limit) {
      compacting = true;
      ctx.compact({
        customInstructions: `Preserve the authorized novel brief, current phase and next action, and references to saved prose and continuity in ${root}. Summarize the conversation, not the manuscript. Do not invent completed work or request milestone approvals.`,
        onComplete: () => {
          compacting = false;
          if (armedRoot !== root) return;
          const current = readRun(root);
          if (current?.status === "running") continueRun(root, current, recovery);
        },
        onError: (error: Error) => {
          compacting = false;
          if (armedRoot === root) {
            pause(`Conversation refresh failed: ${error.message}`);
            show("Writing paused because conversation refresh failed. Saved work is retained; resume after resolving the error.");
          }
        }
      });
    } else continueRun(root, run, recovery);
  }

  pi.registerCommand("PNW-auto", {
    description: "Write through a reviewed draft: start <brief> | status [full] | pause | resume",
    handler: async (args, ctx) => {
      const [action = "status", ...rest] = args.trim().split(/\s+/).filter(Boolean);
      if (action === "pause") {
        pause("Paused by the author.");
        await ctx.abort();
        show("Writing paused. Saved work is retained; use /PNW-auto resume to continue.");
        return;
      }
      const p = project();
      const run = readRun(p.rootPath);
      if (action === "status") {
        show(run ? JSON.stringify({ ...summary(run, rest[0] === "full"), continuingInThisSession: armedRoot === p.rootPath }, null, 2) : "No autonomous writing run. Use /PNW-auto start <your brief>.");
        return;
      }
      if (!["start", "resume"].includes(action)) throw new Error("Usage: /PNW-auto start <brief> | status | pause | resume");
      if (armedRoot) throw new Error("A writing run is already active. Pause it before starting or resuming another.");
      if (!ctx.isIdle()) throw new Error("Stop the current response before starting or resuming autonomous writing.");
      let next = run;
      if (action === "start") {
        if (run) throw new Error("A saved run already exists. Resume it; use a separate novel project for a new brief.");
        const brief = rest.join(" ");
        if (!brief) throw new Error("Supply the initial story brief after start.");
        next = {
          version: 1, brief, phase: "brainstorm", status: "running", revision: 0,
          next: "Extract the brief, record delegated choices, then develop and test candidate story engines.",
          evidence: {}, plan: [], minWords: 0, maxWords: 0, reviews: {}
        };
      } else {
        if (!run) throw new Error("No saved run to resume.");
        if (run.status === "complete" && manuscriptIssues(p, run, true).length === 0) {
          show(`The reviewed draft is complete: ${run.output}`);
          return;
        }
        if (run.phase === "complete") run.phase = "review";
      }
      next!.status = "running";
      delete next!.blocker;
      saveRun(p.rootPath, next!);
      armedRoot = p.rootPath;
      recoverySent = false;
      lastStop = undefined;
      show("Writing from your brief through a reviewed draft. Creative choices are delegated; no milestone approvals. /PNW-auto pause stops the run.");
      queueNext(p.rootPath, next!, ctx);
    }
  });

  pi.registerTool({
    name: "novel_auto_status",
    label: "Writing Run",
    description: "Read compact writing progress, next work and up to ten manuscript issues. Set full=true only when the complete brief, artifact index or issue list is needed. Does not start a run.",
    parameters: Type.Object({ full: Type.Optional(Type.Boolean()) }),
    async execute(_id, params) {
      const p = project();
      const run = readRun(p.rootPath);
      if (!run) throw new Error("No saved run. The author starts one with /PNW-auto start <brief>.");
      const issues = run.plan.length ? manuscriptIssues(p, run, run.phase === "review" || run.phase === "complete") : [];
      return {
        content: [{ type: "text", text: JSON.stringify({
          ...summary(run, params.full), root: p.rootPath, workflow: workflowPath,
          stateFile: path.join(p.rootPath, runFile),
          issueCount: issues.length, issues: params.full ? issues : issues.slice(0, 10),
          issuesTruncated: !params.full && issues.length > 10
        }, null, 2) }], details: {}
      };
    }
  });

  pi.registerTool({
    name: "novel_auto_checkpoint",
    label: "Save Writing Progress",
    description: "Save evidence after real work. phase is the NEXT phase (same or one forward). Supply the complete scene plan and length range when entering draft. Later plan revisions require updated outline evidence and planChangeReason, preserving existing prose. complete validates all planned prose, current reviews and summaries, then compiles. A blocker stops without declaring completion.",
    parameters: Type.Object({
      phase: StringEnum(phases),
      next: Type.String({ minLength: 1, maxLength: 4000 }),
      evidence: Type.Array(Type.String(), { maxItems: 200 }),
      plan: Type.Optional(Type.Array(Type.Object({
        chapter: Type.Integer({ minimum: 1 }), scene: Type.Integer({ minimum: 1 })
      }), { minItems: 1 })),
      planChangeReason: Type.Optional(Type.String({ minLength: 1, maxLength: 4000 })),
      minWords: Type.Optional(Type.Integer({ minimum: 1 })),
      maxWords: Type.Optional(Type.Integer({ minimum: 1 })),
      blocker: Type.Optional(Type.String({ minLength: 1, maxLength: 4000 }))
    }),
    async execute(_id, params) {
      const p = project();
      const run = readRun(p.rootPath);
      if (!run || armedRoot !== p.rootPath || run.status !== "running") throw new Error("No active writing run. Ask the author to resume it.");
      if (params.blocker) {
        run.next = params.next;
        saveRun(p.rootPath, run);
        pause(params.blocker, true);
        show(`Writing is blocked: ${params.blocker}\nSaved work is retained. Resolve the blocker, then /PNW-auto resume.`);
        return { content: [{ type: "text", text: "Blocker saved; automatic continuation stopped." }], details: {} };
      }
      const delta = phases.indexOf(params.phase) - phases.indexOf(run.phase);
      if (delta < 0 || delta > 1) throw new Error("Complete phases in order; repair earlier documents without resetting the run.");
      let changed = false;
      for (const relative of params.evidence) {
        const item = evidenceFile(p.rootPath, relative);
        const digest = hash(item.text);
        changed ||= run.evidence[item.relative] !== digest;
        run.evidence[item.relative] = digest;
      }
      if (!changed && !delta) throw new Error("No changed work evidence. Save substantive work before checkpointing.");
      if (run.phase === "brainstorm" && params.phase === "outline") {
        requireEvidence(p.rootPath, run, "notes/auto-brief.md");
        requireEvidence(p.rootPath, run, "notes/auto-concept.md");
      }
      if (params.plan) {
        if (run.phase === "brainstorm") throw new Error("Develop the concept before recording the scene plan.");
        const keys = params.plan.map(s => sceneKey(s.chapter, s.scene));
        if (new Set(keys).size !== keys.length) throw new Error("Duplicate scenes in the plan.");
        if (run.plan.length && JSON.stringify(run.plan) !== JSON.stringify(params.plan)) {
          if (!params.planChangeReason) throw new Error("Explain the discovered reason for revising the plan.");
          requireEvidence(p.rootPath, run, "outline/auto-plan.md");
          const previous = readRun(p.rootPath)!;
          if (previous.evidence["outline/auto-plan.md"] === run.evidence["outline/auto-plan.md"]) {
            throw new Error("Update the outline and its consequences before revising the plan.");
          }
          if ([...p.scenes.keys()].some(key => !keys.includes(key))) {
            throw new Error("A revised plan must preserve every existing scene. Revise its role rather than silently dropping prose.");
          }
          (run.planHistory ??= []).push({ plan: run.plan, reason: params.planChangeReason });
        }
        run.plan = params.plan;
      }
      if (run.phase === "outline" && params.phase === "draft") {
        requireEvidence(p.rootPath, run, "outline/auto-plan.md");
        requireEvidence(p.rootPath, run, "bible/voice-profile.md");
        if (!run.plan.length) throw new Error("Record the complete planned scene list before drafting.");
        if (!params.minWords || !params.maxWords || params.minWords > params.maxWords) throw new Error("Supply the manuscript length range from the brief.");
        run.minWords = params.minWords;
        run.maxWords = params.maxWords;
      }
      if (params.phase === "review" || params.phase === "complete") {
        const issues = manuscriptIssues(p, run, params.phase === "complete");
        if (issues.length) throw new Error(issues.join("\n"));
      }
      if (params.phase === "complete") {
        requireEvidence(p.rootPath, run, "notes/auto-review.md");
        run.output = compileManuscriptInternal(p);
        run.status = "complete";
      }
      run.phase = params.phase;
      run.next = params.next;
      run.revision++;
      saveRun(p.rootPath, run);
      if (run.status === "complete") {
        armedRoot = undefined;
        show(`Reviewed draft saved: ${run.output}\nReview and accepted limitations: ${path.join(p.rootPath, "notes/auto-review.md")}\nReview was performed by AI, not human readers.`);
      }
      return { content: [{ type: "text", text: JSON.stringify(summary(run)) }], details: {}, terminate: run.status === "running" };
    }
  });

  pi.registerTool({
    name: "novel_review_scene",
    label: "Record Prose Review",
    description: "Record a prose-first review against the CURRENT scene. Include all six aspects exactly once; quotes must occur in the prose (empty only for absent evidence or not-applicable checks). Changes to prose invalidate the review. This stores AI assessment, not human reader validation.",
    parameters: Type.Object({
      chapter: Type.Integer({ minimum: 1 }), scene: Type.Integer({ minimum: 1 }),
      reconstruction: Type.String({ minLength: 1 }),
      findings: Type.Array(Type.Object({
        aspect: StringEnum(aspects),
        status: StringEnum(findingStatuses),
        quote: Type.String(), note: Type.String({ minLength: 1 }), blocking: Type.Boolean()
      }), { minItems: 6, maxItems: 6 })
    }),
    async execute(_id, params) {
      const p = project();
      const run = readRun(p.rootPath);
      if (!run || armedRoot !== p.rootPath || run.phase !== "review") throw new Error("Scene review recording requires an active review phase.");
      const key = sceneKey(params.chapter, params.scene);
      const scene = p.scenes.get(key);
      if (!scene || !run.plan.some(s => sceneKey(s.chapter, s.scene) === key)) throw new Error("Scene is not in the plan.");
      const { body } = parseFrontmatter(readText(scene.filePath));
      if (new Set(params.findings.map(f => f.aspect)).size !== aspects.length) throw new Error("Review each of the six aspects exactly once.");
      if (!params.findings.some(f => f.quote.trim())) throw new Error("At least one exact passage is required.");
      for (const finding of params.findings) {
        if (finding.status === "supported" && !finding.quote.trim()) throw new Error("Supported findings need an exact quote.");
        if (finding.quote && !body.includes(finding.quote)) throw new Error(`Review quote not found for ${finding.aspect}. Read the current prose.`);
      }
      const review = { hash: hash(body), reconstruction: params.reconstruction, findings: params.findings };
      if (JSON.stringify(run.reviews[key]) === JSON.stringify(review)) throw new Error("This exact review is already recorded.");
      run.reviews[key] = review;
      run.revision++;
      saveRun(p.rootPath, run);
      return { content: [{ type: "text", text: `Review saved for ${key}. Blocking findings: ${params.findings.filter(f => f.blocking).length}.` }], details: {} };
    }
  });

  pi.on("before_agent_start", (event) => {
    if (!armedRoot) return;
    // Keep user-triggered turns stable too. Pi's custom-message continuations
    // bypass before_agent_start, so live state belongs in the context hook.
    return { systemPrompt: `${event.systemPrompt}\n\nAutonomous novel contract: follow ${workflowPath}. Read it after a fresh session or compaction when unavailable, not repeatedly for every scene. Continue until a reviewed manuscript or genuine blocker; no milestone approvals. Save actual work before novel_auto_checkpoint. Delegation covers creative choices, not publication, uploads, purchases, deletion, or unrelated projects. Current run state is supplied separately at the end of context.` };
  });
  pi.on("context", (event) => {
    const messages = event.messages.filter(m => !(m.role === "custom" && m.customType === "novel-auto-state"));
    if (armedRoot) {
      const run = readRun(armedRoot);
      if (run?.status === "running") messages.push({
        role: "custom", customType: "novel-auto-state", display: false, timestamp: Date.now(),
        content: `Active novel: ${armedRoot}\nAuthorized brief: ${run.brief}\nPhase: ${run.phase}\nNext: ${run.next}\nSaved state: ${path.join(armedRoot, runFile)}`
      });
    }
    return { messages };
  });
  pi.on("input", (event) => {
    if (event.source !== "extension") pause("Paused for the author's new instruction.");
  });
  pi.on("tool_call", (event) => {
    if (!armedRoot) return;
    if (event.toolName.startsWith("novel_github_") ||
        ["novel_scene_delete", "novel_scene_merge", "novel_scene_move", "novel_scene_split", "outline_chapter_reorder"].includes(event.toolName)) {
      return { block: true, reason: "Unattended writing does not authorize remote changes or destructive restructuring. Preserve the current work." };
    }
  });
  pi.on("agent_end", (event) => {
    const assistant = [...event.messages].reverse().find(m => m.role === "assistant");
    lastStop = assistant?.role === "assistant" ? assistant.stopReason : undefined;
  });
  pi.on("agent_settled", (_event, ctx) => {
    if (!armedRoot || compacting) return;
    if (getProject()?.rootPath !== armedRoot) { pause("The loaded novel changed."); return; }
    if (lastStop === "aborted" || lastStop === "error") { pause("Writing was interrupted. Resume after resolving the interruption."); return; }
    const run = readRun(armedRoot);
    if (!run || run.status !== "running") { armedRoot = undefined; return; }
    if (run.revision === startRevision) {
      if (recoverySent) {
        pause("The writer could not save a work checkpoint after a recovery attempt.", true);
        show("Writing stopped because progress could not be recorded. Saved work is retained; inspect it before resuming.");
        return;
      }
      recoverySent = true;
      queueNext(armedRoot, run, ctx, true);
    } else {
      recoverySent = false;
      queueNext(armedRoot, run, ctx);
    }
  });
  pi.on("session_shutdown", () => { pause("Session closed or reloaded; resume explicitly to continue writing."); });
  pi.events.on("novel:project-loaded", () => {
    if (armedRoot && getProject()?.rootPath !== armedRoot) pause("The loaded novel changed.");
  });
}
