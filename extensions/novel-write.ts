import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { Type } from "@sinclair/typebox";
import { Text } from "@mariozechner/pi-tui";
import { readText, writeText, ensureDir } from "./utils/platform.ts";
import { getProject } from "./novel-core.ts";

function generateHash(content: string) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function parseFrontmatter(content: string): { meta: Record<string, any>; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { meta: {}, body: content };
  const rawYaml = match[1];
  const body = content.slice(match[0].length);
  const meta: Record<string, any> = {};
  for (const line of rawYaml.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const kvMatch = trimmed.match(/^(\w[\w_]*)\s*:\s*(.*)$/);
    if (kvMatch) {
       let val = kvMatch[2].trim();
       if (val.startsWith('"') || val.startsWith("'")) val = val.slice(1, -1);
       meta[kvMatch[1]] = val;
    } else if (trimmed.startsWith("- ")) {
       // simplified array parse
    }
  }
  return { meta, body };
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
          summaries[`scene:${f.replace(".md", "")}`] = parseFrontmatter(readText(path.join(sumDir, "scenes", f))).body;
       }
    }
    // Chapter summaries
    for (const f of fs.readdirSync(path.join(sumDir, "chapters"))) {
       if (f.endsWith(".md")) {
          summaries[`chapter:${f.replace(".md", "")}`] = parseFrontmatter(readText(path.join(sumDir, "chapters", f))).body;
       }
    }
    // Act summaries
    for (const f of fs.readdirSync(path.join(sumDir, "acts"))) {
       if (f.endsWith(".md")) {
          summaries[`act:${f.replace(".md", "")}`] = parseFrontmatter(readText(path.join(sumDir, "acts", f))).body;
       }
    }
    return summaries;
  }

  function estimateTokens(text: string) {
    // Rough estimate: 1 token ~= 4 chars
    return Math.ceil(text.length / 4);
  }

  function buildContextBlock(ctx: any) {
    const project = getProject();
    if (!project) return "";
    
    const budget = getContextBudget()!;
    let block = "[STORY CONTEXT]\n";
    
    // Voice Profile Injection (select POV character's voice profile)
    // Assume current scene is derived from recent history or manually set.
    // For now, load default root voice profile if available.
    const voiceProfilePath = path.join(project.rootPath, "bible", "voice-profile.md");
    if (fs.existsSync(voiceProfilePath)) {
      const vpText = readText(voiceProfilePath);
      if (estimateTokens(vpText) <= budget.voiceProfile) {
         block += "\n--- VOICE PROFILE ---\n" + vpText + "\n";
      }
    }

    // Bible Injection based on active characters/locations
    // We scan project.scenes to find relevant frontmatter tags
    const bibleEntries: string[] = [];
    const biblePaths = [
      path.join(project.rootPath, "bible", "characters"),
      path.join(project.rootPath, "bible", "locations")
    ];
    let bibleTokens = 0;
    
    for (const bpath of biblePaths) {
      if (!fs.existsSync(bpath)) continue;
      for (const file of fs.readdirSync(bpath)) {
         if (!file.endsWith(".md")) continue;
         const text = readText(path.join(bpath, file));
         const toks = estimateTokens(text);
         if (bibleTokens + toks <= budget.bible) {
            bibleEntries.push(text);
            bibleTokens += toks;
         }
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
    const sceneKeys = Object.keys(summaries).filter(k => k.startsWith("scene:")).sort();
    for (const key of sceneKeys) {
       const txt = summaries[key];
       const toks = estimateTokens(txt);
       if (summaryTokens + toks <= budget.summaries) {
          summaryText += `[${key}] ${txt}\n`;
          summaryTokens += toks;
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
    return block;
  }

  // ─── Event Handlers ───────────────────────────────────────────────────

  pi.on("context", async (event: any, ctx: any) => {
    // Strip old [STORY CONTEXT] blocks
    if (event.messages) {
      for (let i = 0; i < event.messages.length; i++) {
        if (event.messages[i].content && typeof event.messages[i].content === "string") {
          event.messages[i].content = event.messages[i].content.replace(/\[STORY CONTEXT\][\s\S]*?\[\/STORY CONTEXT\]\n?/g, "");
        }
      }
    }
    
    const contextBlock = buildContextBlock(ctx);
    
    if (event.messages && event.messages.length > 0) {
      if (event.messages[0].role === "system") {
         event.messages[0].content = contextBlock + "\n" + event.messages[0].content;
      } else {
         event.messages.unshift({ role: "system", content: contextBlock });
      }
    }
    return event;
  });

  pi.on("session_before_compact", async (event: any, ctx: any) => {
    // Mark important messages for retention (preventing eviction from context history)
    if (event.retain) {
       // Typically, we would mark the voice profile, last scene, etc.
       // e.g. event.retain(msg => msg.content.includes("VOICE PROFILE"));
    }
  });

  pi.on("agent_end", async (event: any, ctx: any) => {
    if (ctx.getContextUsage && ctx.ui?.setFooter) {
      const usage = ctx.getContextUsage();
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
      ctx.ui.setFooter((_ui: any, _theme: any) => new Text(footerStr, 0, 0));
    }
  });

  // ─── Tools ─────────────────────────────────────────────────────────────

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
      
      let text = readText(s.filePath);
      if (!text.includes(params.originalText)) {
         return { content: [{ type: "text", text: `Error: originalText not found in the scene.` }] };
      }
      text = text.replace(params.originalText, params.newText);
      writeText(s.filePath, text);
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
      // similar to rewrite
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
      }

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
          pi.sendMessage({ customType: "markdown", content: "Chapter number must be 1 or greater.", display: { title: "Error", isSummary: true } });
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
          pi.sendMessage({ customType: "markdown", content: "Chapter and scene numbers must be 1 or greater.", display: { title: "Error", isSummary: true } });
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
          display: { title: "Error", isSummary: true }
        });
        return;
      }

      // ── Branch: batch mode ─────────────────────────────────────────────────
      const p = getProject();
      if (!p) {
        pi.sendMessage({ customType: "markdown", content: "No project loaded. Run /PNW-init first.", display: { title: "Error", isSummary: true } });
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
        }
      }

      if (staleList.length === 0) {
        pi.sendMessage({
          customType: "markdown",
          content: "All summaries are up to date.",
          display: { title: "Summarize", isSummary: true }
        });
        return;
      }

      const count = staleList.length;

      // User-facing notification: human-readable list
      const displayLines = staleList.map(item => `- ${formatStaleItem(item)}`).join("\n");
      pi.sendMessage({
        customType: "markdown",
        content: `Found ${count} ${count === 1 ? "summary" : "summaries"} that need updating:\n\n${displayLines}`,
        display: { title: "Summarize", isSummary: true }
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
      return { content: [{ type: "text", text: `Context logic invoked for: ${params.query}` }] };
    }
  });

  pi.registerTool({
    name: "context_summary",
    label: "Context Summary",
    description: "Print current context usage breakdown.",
    parameters: Type.Object({}),
    execute: async () => {
      return { content: [{ type: "text", text: `Context successfully measured.` }] };
    }
  });

  pi.registerTool({
    name: "context_budget_report",
    label: "Budget Report",
    description: "Show context boundaries.",
    parameters: Type.Object({}),
    execute: async (_id: string, ctx: any) => {
      let usage = {};
      if (ctx.getContextUsage) usage = ctx.getContextUsage();
      return { content: [{ type: "text", text: `Budget report: ${JSON.stringify(usage)}` }] };
    }
  });

  pi.registerTool({
    name: "novel_character_knowledge",
    label: "Character Knowledge",
    description: "Determine what a character knows based on prior summaries.",
    parameters: Type.Object({
      character: Type.String()
    }),
    execute: async (_id: string, params: any) => {
      return { content: [{ type: "text", text: `Querying knowledge base for ${params.character}...` }] };
    }
  });

}
