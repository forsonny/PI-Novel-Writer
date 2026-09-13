// novel-edit.ts — Phase 4
// Editing tools and analysis extension

import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { Type } from "typebox";
import { withFileMutationQueue, truncateHead } from "@earendil-works/pi-coding-agent";
import { Box, Text, Container, Spacer, truncateToWidth } from "@earendil-works/pi-tui";
import { readText, writeText } from "./utils/platform.ts";
import { projectPath } from "./utils/safety.ts";
import { proseHash, expectVersion } from "./llgf/version.ts";
import { Hash } from "./llgf/schema.ts";
import { getProject, refreshProject, replacePassage, parseFrontmatter, countWords, saveScene } from "./novel-core.ts";

export default function novelEditExtension(pi: any) {

  // ─── Message Renderers ──────────────────────────────────────────────────────
  pi.registerMessageRenderer("novel-edit-mode", (_message: any, _options: any, theme: any) => {
    const container = new Container();
    const maxW = Math.max(20, (process.stdout.columns || 80) - 4);
    const T = (str: string) => truncateToWidth(str, maxW);

    const headerBox = new Box(1, 0, (t: string) => theme.bold(theme.fg("accent", t)));
    headerBox.addChild(new Text(T(` ✍️ EDITING MODE ACTIVATED `), 0, 0));
    container.addChild(headerBox);
    container.addChild(new Spacer(1));
    container.addChild(new Text(T(`  Use edit tools to analyze and refine the manuscript.`), 2, 0));
    container.addChild(new Text(T(`  Commands: /PNW-suggestions`), 2, 0, (t: string) => theme.fg("dim", t)));
    const outerBox = new Box(1, 1);
    outerBox.addChild(container);
    return outerBox;
  });

  pi.registerMessageRenderer("novel-suggestions", (message: any, _options: any, theme: any) => {
    const details = message.details;
    const container = new Container();
    const maxW = Math.max(20, (process.stdout.columns || 80) - 4);
    const T = (str: string) => truncateToWidth(str, maxW);

    const titleColor = details.suggestions.length > 0 ? "warning" : "success";
    const headerBox = new Box(1, 0, (t: string) => theme.bold(theme.fg(titleColor, t)));
    headerBox.addChild(new Text(T(` 📝 PENDING SUGGESTIONS `), 0, 0));
    container.addChild(headerBox);
    container.addChild(new Spacer(1));

    if (!details.suggestions || details.suggestions.length === 0) {
      container.addChild(new Text(T(`  No pending suggestions. You're all caught up!  `), 2, 0, (t: string) => theme.fg("dim", t)));
    } else {
      for (const sug of details.suggestions) {
        container.addChild(new Text(T(`  ${theme.fg("warning", `[${sug.id}]`)} Ch ${sug.chapter} Sc ${sug.scene}`), 2, 0));
        container.addChild(new Text(T(`    ${theme.fg("dim", "Rationale:")} ${sug.rationale}`), 2, 0));
        if (sug.suggested_text) {
          container.addChild(new Text(T(`    ${theme.fg("dim", "Suggestion:")} ${sug.suggested_text}`), 2, 0));
        }
        container.addChild(new Spacer(1));
      }
      container.addChild(new Text(T(`  Use 'edit_accept', 'edit_reject', or 'edit_modify' tools to manage these. `), 2, 0, (t: string) => theme.fg("dim", t)));
    }

    const outerBox = new Box(1, 1);
    outerBox.addChild(container);
    return outerBox;
  });

  // ─── Slash Commands ───────────────────────────────────────────────────────
  pi.registerCommand("PNW-edit", {
    description: "Enter editing mode for a scene",
    handler: async (_args: string, _ctx: any) => {
      const project = getProject();
      if (!project) {
        pi.sendMessage({ customType: "markdown", content: "No project loaded. Run /PNW-init first.", display: true });
        return;
      }
      pi.sendMessage({
        customType: "novel-edit-mode",
        content: "Editing mode activated.",
        display: true
      });
    }
  });

  pi.registerCommand("PNW-suggestions", {
    description: "List pending edit suggestions",
    handler: async (_args: string, _ctx: any) => {
      const project = getProject();
      if (!project) {
        pi.sendMessage({ customType: "markdown", content: "No project loaded.", display: true });
        return;
      }
      const suggestionsPath = projectPath(project.rootPath, ".pi/edit-suggestions.json");
      if (!fs.existsSync(suggestionsPath)) {
        pi.sendMessage({ customType: "novel-suggestions", content: "No pending suggestions.", display: true, details: { suggestions: [] } });
        return;
      }
      try {
        const data = JSON.parse(readText(suggestionsPath));
        pi.sendMessage({
          customType: "novel-suggestions",
          content: "Pending Suggestions",
          display: true,
          details: { suggestions: data.pending || [] }
        });
      } catch(e) {
        pi.sendMessage({ customType: "markdown", content: "Error reading suggestions file.", display: true });
      }
    }
  });

  // ─── Helpers ────────────────────────────────────────────────────────────────
  function getSuggestionsFile() {
    const project = getProject();
    if (!project) return null;
    const suggestionsPath = projectPath(project.rootPath, ".pi/edit-suggestions.json");
    if (!fs.existsSync(suggestionsPath)) {
      writeText(suggestionsPath, JSON.stringify({ pending: [], accepted: [], rejected: [] }, null, 2));
    }
    return suggestionsPath;
  }

  // ─── Tools: Editing ───────────────────────────────────────────────────────
  pi.registerTool({
    name: "edit_suggest",
    label: "Suggest Edit",
    description: "Suggest an edit for a passage with rationale",
    parameters: Type.Object({
      chapter: Type.Number(),
      scene: Type.Number(),
      expectedSourceHash: Hash,
      original_text: Type.String({ minLength: 1 }),
      suggested_text: Type.String(),
      rationale: Type.String()
    }),
    execute: async (_id: string, params: any) => {
      const suggestionsPath = getSuggestionsFile();
      if (!suggestionsPath) return { content: [{ type: "text", text: "No project loaded." }] };
      const p = refreshProject(); if (!p) throw new Error("No project loaded");
      const scene = p.scenes.get(`${String(params.chapter).padStart(2, '0')}-${String(params.scene).padStart(2, '0')}`);
      if (!scene) throw new Error("Scene not found");
      const body = parseFrontmatter(readText(scene.filePath)).body;
      expectVersion(body, params.expectedSourceHash);
      if (body.split(params.original_text).length !== 2) throw new Error("Original passage must occur exactly once in current prose");
      const newId = `sug_${randomUUID()}`;
      await withFileMutationQueue(suggestionsPath, async () => {
        const data = JSON.parse(readText(suggestionsPath));
        data.pending.push({ id: newId, ...params, sourceHash: params.expectedSourceHash, sceneId: scene.id ?? null,
          sourcePath: path.relative(p.rootPath, scene.filePath), timestamp: Date.now() });
        writeText(suggestionsPath, JSON.stringify(data, null, 2));
      });
      return { content: [{ type: "text", text: `Suggestion ${newId} logged.` }] };
    }
  });

  pi.registerTool({
    name: "edit_list_suggestions",
    label: "List Suggestions",
    description: "List pending edit suggestions for a scene or chapter",
    parameters: Type.Object({
      chapter: Type.Optional(Type.Number()),
      scene: Type.Optional(Type.Number())
    }),
    execute: async (_id: string, params: any) => {
      const suggestionsPath = getSuggestionsFile();
      if (!suggestionsPath) return { content: [{ type: "text", text: "No project loaded." }] };
      const data = JSON.parse(readText(suggestionsPath));
      let pending = data.pending;
      if (params.chapter) pending = pending.filter((s:any) => s.chapter === params.chapter);
      if (params.scene) pending = pending.filter((s:any) => s.scene === params.scene);
      return { content: [{ type: "text", text: JSON.stringify(pending, null, 2) }] };
    }
  });

  pi.registerTool({
    name: "edit_accept",
    label: "Accept Edit",
    description: "Accept a pending edit suggestion",
    parameters: Type.Object({ id: Type.String() }),
    execute: async (_id: string, params: any) => {
      const suggestionsPath = getSuggestionsFile();
      if (!suggestionsPath) return { content: [{ type: "text", text: "No project loaded." }] };
      const root = getProject()!.rootPath;
      await withFileMutationQueue(suggestionsPath, async () => {
        const data = JSON.parse(readText(suggestionsPath));
        const idx = data.pending.findIndex((s:any) => s.id === params.id);
        if (idx === -1) throw new Error(`Suggestion ${params.id} not found.`);
        const sug = data.pending[idx];
        if (!sug.sourceHash) throw new Error("Legacy suggestion has no source version. Re-read and create a new suggestion; the original is retained.");
        const p = refreshProject(); if (!p || p.rootPath !== root) throw new Error("The loaded project changed before accepting the suggestion");
        const scene = [...p.scenes.values()].find(s => sug.sceneId ? s.id === sug.sceneId : path.relative(root, s.filePath) === sug.sourcePath);
        if (!scene) throw new Error("Suggestion's scene is missing or has moved without a stable identity");
        await replacePassage(scene.chapter, scene.scene, sug.original_text, sug.suggested_text, sug.sourceHash, root);
        data.pending.splice(idx, 1);
        data.accepted.push(sug);
        writeText(suggestionsPath, JSON.stringify(data, null, 2));
      });
      return { content: [{ type: "text", text: `Suggestion ${params.id} accepted.` }] };
    }
  });

  pi.registerTool({
    name: "edit_reject",
    label: "Reject Edit",
    description: "Reject a pending edit suggestion",
    parameters: Type.Object({ id: Type.String(), reason: Type.Optional(Type.String()) }),
    execute: async (_id: string, params: any) => {
      const suggestionsPath = getSuggestionsFile();
      if (!suggestionsPath) return { content: [{ type: "text", text: "No project loaded." }] };
      return withFileMutationQueue(suggestionsPath, async () => {
      const data = JSON.parse(readText(suggestionsPath));
      const idx = data.pending.findIndex((s:any) => s.id === params.id);
      if (idx === -1) return { content: [{ type: "text", text: `Suggestion ${params.id} not found.` }] };
      const sug = data.pending.splice(idx, 1)[0];
      sug.reject_reason = params.reason;
      data.rejected.push(sug);
      writeText(suggestionsPath, JSON.stringify(data, null, 2));
      return { content: [{ type: "text", text: `Suggestion ${params.id} rejected.` }] };
      });
    }
  });

  pi.registerTool({
    name: "edit_modify",
    label: "Modify Edit",
    description: "Modify an existing edit suggestion",
    parameters: Type.Object({ id: Type.String(), new_suggested_text: Type.String() }),
    execute: async (_id: string, params: any) => {
      const suggestionsPath = getSuggestionsFile();
      if (!suggestionsPath) return { content: [{ type: "text", text: "No project loaded." }] };
      return withFileMutationQueue(suggestionsPath, async () => {
      const data = JSON.parse(readText(suggestionsPath));
      const sug = data.pending.find((s:any) => s.id === params.id);
      if (!sug) return { content: [{ type: "text", text: `Suggestion ${params.id} not found.` }] };
      sug.suggested_text = params.new_suggested_text;
      writeText(suggestionsPath, JSON.stringify(data, null, 2));
      return { content: [{ type: "text", text: `Suggestion ${params.id} modified.` }] };
      });
    }
  });

  pi.registerTool({
    name: "edit_line",
    label: "Edit Line",
    description: "Targeted line editing with line_start/line_end support",
    parameters: Type.Object({
      chapter: Type.Number(),
      scene: Type.Number(),
      line_start: Type.Number(),
      line_end: Type.Number(),
      new_content: Type.String(),
      expectedSourceHash: Hash
    }),
    execute: async (_id: string, params: any) => {
      const project = getProject();
      if (!project) return { content: [{ type: "text", text: "No project loaded." }] };
      const key = `${String(params.chapter).padStart(2, '0')}-${String(params.scene).padStart(2, '0')}`;
      const scene = project.scenes.get(key);
      if (!scene) return { content: [{ type: "text", text: `Scene not found.` }] };
      
      await withFileMutationQueue(scene.filePath, async () => {
      const content = readText(scene.filePath);
      // We need to carefully split frontmatter from body
      const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
      let frontmatter = "";
      let body = content;
      if (match) {
        frontmatter = match[0];
        body = content.slice(frontmatter.length);
      }
      
      expectVersion(body, params.expectedSourceHash);
      const lines = body.split("\n");
      if (!Number.isInteger(params.line_start) || !Number.isInteger(params.line_end) ||
          params.line_start < 1 || params.line_end < params.line_start || params.line_end > lines.length) {
        throw new Error(`Invalid line range. Scene contains ${lines.length} lines.`);
      }
      const start = params.line_start - 1;
      const end = params.line_end;
      lines.splice(start, end - start, ...params.new_content.split("\n"));
      
      saveScene(scene.filePath, frontmatter + lines.join("\n"));
      });
      return { content: [{ type: "text", text: `Replaced lines ${params.line_start} to ${params.line_end}.` }] };
    }
  });

  // These tools supply evidence, not fabricated editorial verdicts.
  function analysisInput(params: any, task: string, continuity = false) {
    const project = getProject();
    if (!project) throw new Error("No project loaded.");
    const key = `${String(params.chapter).padStart(2, "0")}-${String(params.scene).padStart(2, "0")}`;
    const scene = project.scenes.get(key);
    if (!scene) throw new Error(`Scene ${params.chapter}.${params.scene} not found.`);
    const { body } = parseFrontmatter(readText(scene.filePath));
    let text = `EDITORIAL TASK (not yet performed): ${task}\nCite actual passages; distinguish supported, uncertain, and contradicted findings. No invented reader responses or percentages.\nSource: ${scene.filePath}\n\n${body}`;
    if (continuity) for (const relative of ["continuity/facts.json", "continuity/character-states.json", "timeline/timeline.json"]) {
      const file = path.join(project.rootPath, relative);
      text += `\n\nSource: ${file}\n${fs.existsSync(file) ? readText(file) : "Not recorded; verify from earlier prose."}`;
    }
    const output = truncateHead(text);
    return { content: [{ type: "text", text: output.content + (output.truncated ? "\n[Truncated; read the listed source files before completing the review.]" : "") }] };
  }

  // ─── Tools: Analysis ──────────────────────────────────────────────────────
  pi.registerTool({
    name: "analyze_pacing",
    label: "Analyze Pacing",
    description: "Read scene evidence for the agent to analyze pacing; does not generate an editorial verdict.",
    parameters: Type.Object({ chapter: Type.Number(), scene: Type.Number() }),
    execute: async (_id: string, params: any) => {
      return analysisInput(params, "Assess attention, scene/summary balance, repetition, tension, and consequences against the scene's purpose.");
    }
  });

  pi.registerTool({
    name: "analyze_dialogue",
    label: "Analyze Dialogue",
    description: "Read scene evidence for the agent to assess dialogue and character voices.",
    parameters: Type.Object({ chapter: Type.Number(), scene: Type.Number() }),
    execute: async (_id: string, params: any) => {
      return analysisInput(params, "Assess speech acts, subtext, differentiated attention and voice, and redundant exposition.");
    }
  });

  pi.registerTool({
    name: "analyze_wordcount",
    label: "Analyze Wordcount",
    description: "Detailed word count breakdown per chapter/scene",
    parameters: Type.Object({}),
    execute: async (_id: string, _params: any) => {
      const project = getProject();
      if (!project) return { content: [{ type: "text", text: "No project loaded." }] };
      const scenes = [...project.scenes.values()].map(s => ({
        chapter: s.chapter, scene: s.scene, words: countWords(parseFrontmatter(readText(s.filePath)).body)
      }));
      return { content: [{ type: "text", text: JSON.stringify({ totalWords: scenes.reduce((n, s) => n + s.words, 0), targetWords: project.config.targetWordCount, scenes }) }] };
    }
  });

  pi.registerTool({
    name: "analyze_continuity",
    label: "Analyze Continuity",
    description: "Load scene and continuity records for the agent to cross-reference. Missing records are unknown, not a clean review.",
    parameters: Type.Object({ chapter: Type.Number(), scene: Type.Number() }),
    execute: async (_id: string, params: any) => {
      return analysisInput(params, "Reconstruct causal action, knowledge access, resources, costs, reliability, chronology, and relationship consequences.", true);
    }
  });

  pi.registerTool({
    name: "analyze_readability",
    label: "Analyze Readability",
    description: "Read prose for a contextual readability review; no invented grade-level score.",
    parameters: Type.Object({ chapter: Type.Number(), scene: Type.Number() }),
    execute: async (_id: string, params: any) => {
      return analysisInput(params, "Assess referents, terminology, sentence and paragraph relations, and orientation. Preserve intentional difficulty and voice.");
    }
  });
}
