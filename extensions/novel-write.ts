import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { Type } from "typebox";
import { truncateHead } from "@earendil-works/pi-coding-agent";
import { readText, writeText, ensureDir, normalizeKey } from "./utils/platform.ts";
import { getProject, replacePassage, orderedScenes, sceneKey, parseFrontmatter } from "./novel-core.ts";
import { findAllBibleEntries } from "./novel-bible.ts";

function generateHash(content: string) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

export function chapterSource(project: any, chapter: number): string {
  return orderedScenes(project)
    .filter(s => s.chapter === chapter && s.status !== "outline")
    .map(s => `${sceneKey(s.chapter, s.scene)}\n${parseFrontmatter(readText(s.filePath)).body}`)
    .join("\n\n");
}

export default function novelWriteExtension(pi: any) {

  function getContextBudget() {
    const project = getProject();
    if (!project) return null;
    return project.config.settings.contextBudget || {
      system: 3000,
      bible: 3000,
      summaries: 5000,
      outline: 3000,
      recentProse: 2000,
      currentScene: 3000,
      voiceProfile: 500
    };
  }

  // Tiered Summaries structure
  function loadSummaries(project: any) {
    const sumDir = path.join(project.rootPath, "summaries");
    const summaries: Record<string, string> = {};
    ensureDir(path.join(sumDir, "scenes"));
    ensureDir(path.join(sumDir, "chapters"));
    ensureDir(path.join(sumDir, "acts"));
    
    // Read scene summaries
    for (const f of fs.readdirSync(path.join(sumDir, "scenes"))) {
       if (f.endsWith(".md")) {
          const key = f.replace(".md", "");
          const scene = project.scenes.get(key);
          const summary = parseFrontmatter(readText(path.join(sumDir, "scenes", f)));
          if (scene && summary.meta.hash === generateHash(parseFrontmatter(readText(scene.filePath)).body)) {
            summaries[`scene:${key}`] = summary.body;
          }
       }
    }
    // Chapter summaries
    for (const f of fs.readdirSync(path.join(sumDir, "chapters"))) {
       if (f.endsWith(".md")) {
          const source = chapterSource(project, Number(f.replace(".md", "")));
          const summary = parseFrontmatter(readText(path.join(sumDir, "chapters", f)));
          if (source && summary.meta.hash === generateHash(source)) summaries[`chapter:${f.replace(".md", "")}`] = summary.body;
       }
    }
    // Act summaries have no verifiable source fingerprint; read them explicitly as notes.
    return summaries;
  }

  function estimateTokens(text: string) {
    // Rough estimate: 1 token ~= 4 chars
    return Math.ceil(text.length / 4);
  }

  function buildContextBlock(ctx: any) {
    const project = getProject();
    const selection = { bible: [] as string[], omittedBible: [] as string[], summaries: [] as string[], omittedSummaries: [] as string[] };
    if (!project) return { block: "", ...selection };
    
    const budget = getContextBudget()!;
    let block = "[STORY CONTEXT]\n";
    
    // Voice Profile Injection (select POV character's voice profile)
    // Assume current scene is derived from recent history or manually set.
    // For now, load default root voice profile if available.
    const voiceProfilePath = path.resolve(project.rootPath, project.config.settings.voiceProfilePath || "bible/voice-profile.md");
    if (fs.existsSync(voiceProfilePath)) {
      const vpText = readText(voiceProfilePath);
      if (estimateTokens(vpText) <= budget.voiceProfile) {
         block += "\n--- VOICE PROFILE ---\n" + vpText + "\n";
      }
    }

    // Include all supported bible types, in explicit priority order.
    const bibleEntries: string[] = [];
    let bibleTokens = 0;
    const priorities: Record<string, number> = { core: 0, secondary: 1, minor: 2 };
    const entries = findAllBibleEntries(project.rootPath).sort((a, b) =>
      (priorities[a.priority] ?? 1) - (priorities[b.priority] ?? 1) ||
      a.name.localeCompare(b.name) || a.filePath.localeCompare(b.filePath));
    for (const entry of entries) {
      const text = readText(entry.filePath);
      const toks = estimateTokens(text);
      if (bibleTokens + toks <= budget.bible) {
        bibleEntries.push(text);
        bibleTokens += toks;
        selection.bible.push(entry.name);
      } else {
        selection.omittedBible.push(entry.name);
      }
    }
    if (bibleEntries.length > 0) {
       block += "\n--- BIBLE ENTRIES ---\n" + bibleEntries.join("\n\n") + "\n";
    }
    
    // Tiered Summarization Logic
    const summaries = loadSummaries(project);
    let summaryText = "";
    let summaryTokens = 0;
    
    // Tiered fallback: scene summaries first, then chapter summaries, then act summaries
    const sceneKeys = orderedScenes(project).reverse()
      .map(s => `scene:${sceneKey(s.chapter, s.scene)}`).filter(key => key in summaries);
    for (const key of sceneKeys) {
       const txt = summaries[key];
       const toks = estimateTokens(txt);
       if (summaryTokens + toks <= budget.summaries) {
          summaryText += `[${key}] ${txt}\n`;
          summaryTokens += toks;
          selection.summaries.push(key);
       }
       // skip entries that exceed budget; continue to next scene
    }
    // If no scene summaries fit, fall back to chapter summaries
    if (summaryTokens === 0) {
       const chapterKeys = Object.keys(summaries).filter(k => k.startsWith("chapter:")).sort();
       for (const key of chapterKeys) {
          const txt = summaries[key];
          const toks = estimateTokens(txt);
          if (summaryTokens + toks <= budget.summaries) {
             summaryText += `[${key}] ${txt}\n`;
             summaryTokens += toks;
             selection.summaries.push(key);
          }
       }
    }
    // If still nothing, fall back to act summaries
    if (summaryTokens === 0) {
       const actKeys = Object.keys(summaries).filter(k => k.startsWith("act:")).sort();
       for (const key of actKeys) {
          const txt = summaries[key];
          const toks = estimateTokens(txt);
          if (summaryTokens + toks <= budget.summaries) {
             summaryText += `[${key}] ${txt}\n`;
             summaryTokens += toks;
          }
       }
    }
    if (summaryText) {
       block += "\n--- PROGRESS SUMMARIES ---\n" + summaryText + "\n";
    }

    block += "[/STORY CONTEXT]\n";
    selection.omittedSummaries = Object.keys(summaries).filter(key => !selection.summaries.includes(key));
    return { block, ...selection };
  }

  // ─── Event Handlers ───────────────────────────────────────────────────

  pi.on("context", async (event: any, ctx: any) => {
    const messages = event.messages.filter((m: any) => m.customType !== "novel-story-context");
    const { block } = buildContextBlock(ctx);
    if (block) messages.push({
      role: "custom", customType: "novel-story-context",
      content: block, display: false, timestamp: Date.now()
    });
    return { messages };
  });

  pi.on("agent_end", async (event: any, ctx: any) => {
    if (ctx.hasUI && ctx.getContextUsage) {
      const usage = ctx.getContextUsage();
      if (!usage) return;
      let footerStr = "";
      if (usage.percent > 80) {
        footerStr = `⚠️ Context warning: ${usage.percent}% full (${usage.tokens} tokens). Summaries may downgrade.`;
      } else {
        footerStr = `Context: ${usage.percent}% (${usage.tokens} tokens)`;
      }
      const p = getProject();
      if (p && p.config.workflow === "discovery" && p.scenes.size >= 3) {
        footerStr += " | 💡 Tip: 3+ scenes drafted. Consider running the 'retroactive-outline' skill.";
      }
      ctx.ui.setStatus("novel-context", footerStr);
    }
  });

  // ─── Tools ─────────────────────────────────────────────────────────────

  pi.registerTool({
    name: "summary_read",
    label: "Read Saved Summary",
    description: "Read an existing scene or chapter summary without changing it. Freshness checks prose changes, not factual accuracy.",
    parameters: Type.Object({
      chapter: Type.Integer({ minimum: 1 }),
      scene: Type.Optional(Type.Integer({ minimum: 1 }))
    }),
    execute: async (_id: string, params: any) => {
      const p = getProject();
      if (!p) throw new Error("No project loaded.");
      const key = params.scene == null ? String(params.chapter).padStart(2, "0") : sceneKey(params.chapter, params.scene);
      const file = path.join(p.rootPath, "summaries", params.scene == null ? "chapters" : "scenes", `${key}.md`);
      if (!fs.existsSync(file)) return { content: [{ type: "text", text: `Summary missing: ${file}. Nothing changed.` }] };
      const summary = parseFrontmatter(readText(file));
      const scene = params.scene == null ? undefined : p.scenes.get(key);
      const source = params.scene == null ? chapterSource(p, params.chapter) :
        scene ? parseFrontmatter(readText(scene.filePath)).body : "";
      const freshness = !source ? "orphan: no source prose" : summary.meta.hash === generateHash(source) ? "current" : "stale";
      const output = truncateHead(summary.body);
      return { content: [{ type: "text", text: `Source: ${file}\nFreshness: ${freshness} (not a factual review).\n${output.content}${output.truncated ? "\n[Truncated; use ordinary read-only access to the source for the rest.]" : ""}` }] };
    }
  });

  pi.registerTool({
    name: "draft_scene",
    label: "Draft Scene",
    description: "Initialize the drafting space for a given scene using outline and context.",
    parameters: Type.Object({
      chapter: Type.Number(),
      scene: Type.Number(),
      instructions: Type.Optional(Type.String())
    }),
    execute: async (_id: string, params: any) => {
      // In discovering mode, we might generate the text. We just acknowledge readiness here.
      return { content: [{ type: "text", text: `Ready to draft Chapter ${params.chapter} Scene ${params.scene}.\nInstructions: ${params.instructions || "None"}` }] };
    }
  });

  pi.registerTool({
    name: "continue_writing",
    label: "Continue Writing",
    description: "Provide the latest text of the current scene to continue from.",
    parameters: Type.Object({
      chapter: Type.Number(),
      scene: Type.Number()
    }),
    execute: async (_id: string, params: any) => {
      const p = getProject();
      if (!p) return { content: [{ type: "text", text: "Project not found." }] };
      const s = p.scenes.get(`${String(params.chapter).padStart(2, "0")}-${String(params.scene).padStart(2, "0")}`);
      if (!s) return { content: [{ type: "text", text: `Scene not found.` }] };
      const { body } = parseFrontmatter(readText(s.filePath));
      return { content: [{ type: "text", text: `Current text:\n\n${body}\n\nContinue writing from here.` }] };
    }
  });

  pi.registerTool({
    name: "rewrite_passage",
    label: "Rewrite Passage",
    description: "Replace a specific passage in a scene.",
    parameters: Type.Object({
      chapter: Type.Number(),
      scene: Type.Number(),
      originalText: Type.String(),
      newText: Type.String()
    }),
    execute: async (_id: string, params: any) => {
      const p = getProject();
      if (!p) return { content: [{ type: "text", text: "Project not found." }] };
      const s = p.scenes.get(`${String(params.chapter).padStart(2, "0")}-${String(params.scene).padStart(2, "0")}`);
      if (!s) return { content: [{ type: "text", text: `Scene not found.` }] };
      
      await replacePassage(params.chapter, params.scene, params.originalText, params.newText);
      return { content: [{ type: "text", text: `Passage rewritten successfully.` }] };
    }
  });

  pi.registerTool({
    name: "expand_passage",
    label: "Expand Passage",
    description: "Expand a passage (shorthand for rewrite).",
    parameters: Type.Object({
      chapter: Type.Number(),
      scene: Type.Number(),
      originalText: Type.String(),
      expandedText: Type.String()
    }),
    execute: async (_id: string, params: any) => {
      await replacePassage(params.chapter, params.scene, params.originalText, params.expandedText);
      return { content: [{ type: "text", text: `Passage expanded.` }] };
    }
  });

  pi.registerTool({
    name: "compress_passage",
    label: "Compress Passage",
    description: "Compress a passage (shorthand for rewrite).",
    parameters: Type.Object({
      chapter: Type.Number(),
      scene: Type.Number(),
      originalText: Type.String(),
      compressedText: Type.String()
    }),
    execute: async (_id: string, params: any) => {
      await replacePassage(params.chapter, params.scene, params.originalText, params.compressedText);
      return { content: [{ type: "text", text: `Passage compressed.` }] };
    }
  });

  pi.registerTool({
    name: "summary_generate",
    label: "Generate Summary",
    description: "Store a new summary for a scene/chapter.",
    parameters: Type.Object({
      chapter: Type.Number(),
      scene: Type.Optional(Type.Number()),
      summaryText: Type.String()
    }),
    execute: async (_id: string, params: any) => {
      const p = getProject();
      if (!p) return { content: [{ type: "text", text: "Project not found." }] };
      
      const sumDir = path.join(p.rootPath, "summaries");
      let targetFile = "";
      if (params.scene != null) {
         ensureDir(path.join(sumDir, "scenes"));
         targetFile = path.join(sumDir, "scenes", `${String(params.chapter).padStart(2, "0")}-${String(params.scene).padStart(2, "0")}.md`);
      } else {
         ensureDir(path.join(sumDir, "chapters"));
         targetFile = path.join(sumDir, "chapters", `${String(params.chapter).padStart(2, "0")}.md`);
      }
      
      let body = "";
      if (params.scene != null) {
        const sceneKey = `${String(params.chapter).padStart(2, "0")}-${String(params.scene).padStart(2, "0")}`;
        const sceneEntry = p.scenes.get(sceneKey);
        if (!sceneEntry) {
          return { content: [{ type: "text", text: `Scene ${params.chapter}.${params.scene} not found. Cannot generate summary for a non-existent scene.` }] };
        } else {
          const raw = readText(sceneEntry.filePath);
          const parsed = parseFrontmatter(raw);
          body = parsed.body;
        }
      } else {
        body = chapterSource(p, params.chapter);
        if (!body) throw new Error(`Chapter ${params.chapter} has no drafted scenes.`);
      }
      if (!params.summaryText.trim()) throw new Error("Summary text cannot be empty.");

      const hash = generateHash(body);
      const content = `---\nhash: ${hash}\n---\n${params.summaryText}`;
      writeText(targetFile, content);

      return { content: [{ type: "text", text: `Summary stored: ${targetFile}` }] };
    }
  });

  pi.registerTool({
    name: "novel_summary_refresh",
    label: "Refresh Summaries",
    description: "Find stale scene summaries (hash mismatch with scene prose) and missing or orphaned chapter summaries. Only checks chapters that have at least one drafted scene.",
    parameters: Type.Object({}),
    execute: async () => {
      const p = getProject();
      if (!p) return { content: [{ type: "text", text: "Project not found." }] };
      const sumDir = path.join(p.rootPath, "summaries", "scenes");
      ensureDir(sumDir);
      
      const stale: string[] = [];
      for (const [key, scene] of p.scenes) {
          if (scene.status === "outline") continue; // only check drafted/revised scenes
          
          const sumFile = path.join(sumDir, `${key}.md`);
          if (!fs.existsSync(sumFile)) {
              stale.push(key + " (missing summary)");
              continue;
          }
          const { meta } = parseFrontmatter(readText(sumFile));
          const { body } = parseFrontmatter(readText(scene.filePath));
          if (generateHash(body) !== meta.hash) {
              stale.push(key + " (stale)");
          }
      }
      
      // Check chapter summaries
      const chSumDir = path.join(p.rootPath, "summaries", "chapters");
      if (fs.existsSync(chSumDir)) {
        // Detect orphan chapter summary files (no scenes exist for that chapter)
        for (const f of fs.readdirSync(chSumDir)) {
          if (!f.endsWith(".md")) continue;
          const chNum = parseInt(f.replace(".md", ""), 10);
          if (isNaN(chNum)) continue;
          const hasScenes = Array.from(p.scenes.values()).some(s => s.chapter === chNum);
          if (!hasScenes) {
            stale.push(`chapter-${String(chNum).padStart(2, "0")} (orphan chapter summary — no scenes exist for this chapter)`);
          }
        }
      }
      // Detect chapters with drafted scenes but missing a chapter summary file
      const chapterNums = new Set(Array.from(p.scenes.values()).map(s => s.chapter));
      for (const chNum of chapterNums) {
        const hasDraftedScene = Array.from(p.scenes.values()).some(
          s => s.chapter === chNum && s.status !== "outline"
        );
        if (!hasDraftedScene) continue;
        const chFile = path.join(p.rootPath, "summaries", "chapters", `${String(chNum).padStart(2, "0")}.md`);
        if (!fs.existsSync(chFile)) {
          stale.push(`chapter-${String(chNum).padStart(2, "0")} (missing chapter summary)`);
        } else if (parseFrontmatter(readText(chFile)).meta.hash !== generateHash(chapterSource(p, chNum))) {
          stale.push(`chapter-${String(chNum).padStart(2, "0")} (stale chapter summary)`);
        }
      }

      if (stale.length === 0) {
          return { content: [{ type: "text", text: "All scene and chapter summaries are up-to-date." }] };
      }
      return { content: [{ type: "text", text: `The following summaries need attention:\n- ${stale.join("\n- ")}` }] };
    }
  });

  pi.registerCommand("PNW-summarize", {
    description: "Generate or refresh summaries. Usage: /PNW-summarize | /PNW-summarize <chapter> <scene> | /PNW-summarize chapter <n>",
    handler: async (args: string, _ctx: any) => {
      const trimmed = args.trim();

      // Convert internal stale-list keys into plain English for display
      function formatStaleItem(item: string): string {
        const sceneMatch = item.match(/^(\d+)-(\d+)\s+\((.+)\)$/);
        if (sceneMatch) {
          const ch = parseInt(sceneMatch[1], 10);
          const sc = parseInt(sceneMatch[2], 10);
          const tag = sceneMatch[3];
          const reason = tag === "stale" ? "prose has changed since last summary"
                       : tag === "missing summary" ? "no summary written yet"
                       : tag;
          return `Chapter ${ch}, Scene ${sc} — ${reason}`;
        }
        const chapterMatch = item.match(/^chapter-(\d+)\s+\((.+?)\)/);
        if (chapterMatch) {
          const ch = parseInt(chapterMatch[1], 10);
          const tag = chapterMatch[2];
          const reason = tag.includes("missing") ? "no chapter summary yet"
                       : tag.includes("orphan") ? "orphan summary file (chapter has no scenes)"
                       : tag;
          return `Chapter ${ch} — ${reason}`;
        }
        return item;
      }

      // ── Branch: chapter mode ───────────────────────────────────────────────
      const chapterMatch = trimmed.match(/^chapter\s+(\d+)$/i);
      if (chapterMatch) {
        const chapterNum = parseInt(chapterMatch[1], 10);
        if (chapterNum < 1) {
          pi.sendMessage({ customType: "markdown", content: "Chapter number must be 1 or greater.", display: true });
          return;
        }
        pi.sendUserMessage(
          `Generate a chapter-level summary for Chapter ${chapterNum}. Review the existing scene summaries for that chapter, then write a cohesive summary and store it with summary_generate (chapter: ${chapterNum}, no scene parameter).`,
          { deliverAs: "followUp" }
        );
        return;
      }

      // ── Branch: scene mode ─────────────────────────────────────────────────
      const sceneMatch = trimmed.match(/^\s*(\d+)\s+(\d+)\s*$/);
      if (sceneMatch) {
        const chapterNum = parseInt(sceneMatch[1], 10);
        const sceneNum   = parseInt(sceneMatch[2], 10);
        if (chapterNum < 1 || sceneNum < 1) {
          pi.sendMessage({ customType: "markdown", content: "Chapter and scene numbers must be 1 or greater.", display: true });
          return;
        }
        pi.sendUserMessage(
          `Generate a summary for Chapter ${chapterNum}, Scene ${sceneNum}. Read the scene prose with continue_writing, write a concise summary, then store it with summary_generate (chapter: ${chapterNum}, scene: ${sceneNum}).`,
          { deliverAs: "followUp" }
        );
        return;
      }

      // ── Branch: unknown non-empty args ─────────────────────────────────────
      if (trimmed !== "") {
        pi.sendMessage({
          customType: "markdown",
          content: "Unknown arguments. Usage:\n- `/PNW-summarize` — refresh all stale summaries\n- `/PNW-summarize 1 2` — summarize Chapter 1, Scene 2\n- `/PNW-summarize chapter 1` — summarize Chapter 1",
          display: true
        });
        return;
      }

      // ── Branch: batch mode ─────────────────────────────────────────────────
      const p = getProject();
      if (!p) {
        pi.sendMessage({ customType: "markdown", content: "No project loaded. Run /PNW-init first.", display: true });
        return;
      }

      const sumDir = path.join(p.rootPath, "summaries", "scenes");
      ensureDir(sumDir);

      const staleList: string[] = [];

      // Scene-level staleness: mirrors novel_summary_refresh
      for (const [key, scene] of p.scenes) {
        if (scene.status === "outline") continue;
        const sumFile = path.join(sumDir, `${key}.md`);
        if (!fs.existsSync(sumFile)) {
          staleList.push(`${key} (missing summary)`);
          continue;
        }
        const { meta } = parseFrontmatter(readText(sumFile));
        const { body } = parseFrontmatter(readText(scene.filePath));
        if (generateHash(body) !== meta.hash) {
          staleList.push(`${key} (stale)`);
        }
      }

      // Detect orphan chapter summary files: mirrors novel_summary_refresh
      const chSumDir = path.join(p.rootPath, "summaries", "chapters");
      if (fs.existsSync(chSumDir)) {
        for (const f of fs.readdirSync(chSumDir)) {
          if (!f.endsWith(".md")) continue;
          const chNum = parseInt(f.replace(".md", ""), 10);
          if (isNaN(chNum)) continue;
          const hasScenes = Array.from(p.scenes.values()).some(s => s.chapter === chNum);
          if (!hasScenes) {
            staleList.push(`chapter-${String(chNum).padStart(2, "0")} (orphan chapter summary — no scenes exist for this chapter)`);
          }
        }
      }

      // Chapter-level staleness: mirrors novel_summary_refresh
      const chapterNums = new Set(Array.from(p.scenes.values()).map(s => s.chapter));
      for (const chNum of chapterNums) {
        const hasDraftedScene = Array.from(p.scenes.values()).some(
          s => s.chapter === chNum && s.status !== "outline"
        );
        if (!hasDraftedScene) continue;
        const chFile = path.join(p.rootPath, "summaries", "chapters", `${String(chNum).padStart(2, "0")}.md`);
        if (!fs.existsSync(chFile)) {
          staleList.push(`chapter-${String(chNum).padStart(2, "0")} (missing chapter summary)`);
        } else if (parseFrontmatter(readText(chFile)).meta.hash !== generateHash(chapterSource(p, chNum))) {
          staleList.push(`chapter-${String(chNum).padStart(2, "0")} (stale chapter summary)`);
        }
      }

      if (staleList.length === 0) {
        pi.sendMessage({
          customType: "markdown",
          content: "All summaries are up to date.",
          display: true
        });
        return;
      }

      const count = staleList.length;

      // User-facing notification: human-readable list
      const displayLines = staleList.map(item => `- ${formatStaleItem(item)}`).join("\n");
      pi.sendMessage({
        customType: "markdown",
        content: `Found ${count} ${count === 1 ? "summary" : "summaries"} that need updating:\n\n${displayLines}`,
        display: true
      });

      // AI instruction: build parameter list and trigger AI action in next turn
      const aiLines = staleList.map(item => {
        const sm = item.match(/^(\d+)-(\d+)\s+/);
        if (sm) {
          const ch = parseInt(sm[1], 10);
          const sc = parseInt(sm[2], 10);
          return `- Chapter ${ch}, Scene ${sc} → summary_generate(chapter:${ch}, scene:${sc})`;
        }
        const cm = item.match(/^chapter-(\d+)\s+/);
        if (cm) {
          const ch = parseInt(cm[1], 10);
          if (item.includes("orphan")) return `- Chapter ${ch} orphan summary — skip`;
          return `- Chapter ${ch} → summary_generate(chapter:${ch})`;
        }
        return `- ${item}`;
      }).join("\n");
      pi.sendUserMessage(
        `Generate summaries for these ${count} items, calling summary_generate for each in order:\n${aiLines}`,
        { deliverAs: "followUp" }
      );
    }
  });

  pi.registerTool({
    name: "context_inject",
    label: "Inject Context",
    description: "Load an arbitrary bible entry on demand.",
    parameters: Type.Object({
      query: Type.String()
    }),
    execute: async (_id: string, params: any) => {
      const p = getProject();
      if (!p) throw new Error("No project loaded.");
      const matches: string[] = [];
      const walk = (dir: string) => {
        if (!fs.existsSync(dir)) return;
        for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
          const file = path.join(dir, item.name);
          if (item.isDirectory()) walk(file);
          else if (item.isFile() && item.name.endsWith(".md")) {
            const text = readText(file);
            if (text.toLowerCase().includes(params.query.toLowerCase())) {
              matches.push(`Source: ${file}\n${text}`);
            }
          }
        }
      };
      walk(path.join(p.rootPath, "bible"));
      const output = truncateHead(matches.join("\n\n") || "No matching bible entries.");
      return { content: [{ type: "text", text: output.content + (output.truncated ? "\n[Truncated; read the listed sources directly.]" : "") }] };
    }
  });

  pi.registerTool({
    name: "context_summary",
    label: "Context Summary",
    description: "Print current context usage breakdown.",
    parameters: Type.Object({}),
    execute: async (_id: string, _params: any, _signal: any, _onUpdate: any, ctx: any) => {
      const { block, ...selection } = buildContextBlock(ctx);
      return { content: [{ type: "text", text: JSON.stringify({ usage: ctx.getContextUsage(), budgets: getContextBudget(), storyContextEstimatedTokens: estimateTokens(block), selection, note: "Omitted summaries lists only fresh summaries not selected. Stale/missing summaries are excluded; use novel_summary_refresh to check them. Selection is not factual validation." }) }] };
    }
  });

  pi.registerTool({
    name: "context_budget_report",
    label: "Budget Report",
    description: "Show context boundaries.",
    parameters: Type.Object({}),
    execute: async (_id: string, _params: any, _signal: any, _onUpdate: any, ctx: any) => {
      return { content: [{ type: "text", text: JSON.stringify({ usage: ctx.getContextUsage(), budgets: getContextBudget() }) }] };
    }
  });

  pi.registerTool({
    name: "novel_character_knowledge",
    label: "Character Knowledge",
    description: "Read only a matching actual character record, or use chapter AND scene for evidence involving that character up to and including that scene. Evidence requires interpretation; it is not a knowledge verdict.",
    parameters: Type.Object({
      character: Type.String(),
      chapter: Type.Optional(Type.Integer({ minimum: 1 })),
      scene: Type.Optional(Type.Integer({ minimum: 1 }))
    }),
    execute: async (_id: string, params: any) => {
      const p = getProject();
      if (!p) throw new Error("No project loaded.");
      if ((params.chapter == null) !== (params.scene == null)) throw new Error("Provide both chapter and scene for a knowledge cutoff.");
      const entry = findAllBibleEntries(p.rootPath).find(e => e.type === "character" &&
        [e.name, ...e.aliases].some(n => normalizeKey(n) === normalizeKey(params.character)));
      const names = new Set([params.character, ...(entry ? [entry.name, ...entry.aliases] : [])].map(normalizeKey));
      let evidence = "";
      if (params.chapter != null) {
        const scenes = orderedScenes(p);
        const end = scenes.findIndex(s => s.chapter === params.chapter && s.scene === params.scene);
        if (end < 0) throw new Error("The cutoff scene does not exist.");
        const summaries = loadSummaries(p);
        for (const s of scenes.slice(0, end + 1)) {
          if (s.status === "outline" || ![s.pov, ...(s.characters_present || [])].some(n => names.has(normalizeKey(n || "")))) continue;
          const key = sceneKey(s.chapter, s.scene);
          const summary = summaries[`scene:${key}`];
          const file = summary ? path.join(p.rootPath, "summaries", "scenes", `${key}.md`) : s.filePath;
          evidence += `\nSource: ${file}\nScene ${key} (${summary ? "current summary, not fact-checked" : "prose; no current summary"}):\n${summary || parseFrontmatter(readText(s.filePath)).body}\n`;
        }
        evidence ||= "No matching character-tagged scenes through this cutoff. Check scene participants; absence is unknown.";
      } else {
        const file = path.join(p.rootPath, "continuity", "character-states.json");
        const data = fs.existsSync(file) ? JSON.parse(readText(file)) : {};
        const records = data.actual ?? data.characters ?? data;
        const match = Object.keys(records).find(n => names.has(normalizeKey(n)));
        evidence = match ? `Source: ${file}\n${JSON.stringify({ [match]: records[match] }, null, 2)}` :
          `No matching actual character record for ${params.character}. Planned records were not used.`;
      }
      const output = truncateHead(evidence);
      return { content: [{ type: "text", text: `Evidence for ${entry?.name || params.character}${params.chapter != null ? ` through ${params.chapter}.${params.scene}; latest mixed-state ledger excluded` : " (latest saved record, which may contain historical fields)"}.\nAbsence is unknown, not proof of ignorance. A scene can contain facts the character did not learn; verify viewpoint, disclosure and summary accuracy against prose. This lookup does not remove future information elsewhere in the conversation.\n${output.content}${output.truncated ? "\n[Truncated; read the listed sources in smaller parts before concluding.]" : ""}` }] };
    }
  });

}
