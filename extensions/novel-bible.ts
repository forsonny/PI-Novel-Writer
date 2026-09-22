// novel-bible.ts — Phase 2: Bible & Planning
// Bible CRUD + outline management extension

import path from "node:path";
import fs from "node:fs";
import { Type } from "typebox";
import { Box, Text, Container, Spacer, truncateToWidth } from "@earendil-works/pi-tui";
import { readText, writeText, resolvePath, pathsEqual, normalizeKey, toSafeFilename, validateFilename } from "./utils/platform.ts";
import { getProject, refreshProject, parseFrontmatter, buildFrontmatter, saveScene } from "./novel-core.ts";
import { projectPath, positiveInteger } from "./utils/safety.ts";

// ─── Shared Utilities ─────────────────────────────────────────────────────────

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function getAllMdFiles(root: string, dir: string): string[] {
  dir = projectPath(root, dir);
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = projectPath(root, path.join(dir, entry.name));
    if (entry.isDirectory()) results.push(...getAllMdFiles(root, full));
    else if (entry.name.endsWith(".md")) results.push(full);
  }
  return results;
}

function getBibleSubdir(type: string): string {
  switch (type.toLowerCase()) {
    case "character": return "characters";
    case "location": return "locations";
    case "item": return "items";
    case "faction": return "factions";
    case "world": return "world";
    default: return "world"; // fallback
  }
}

// ─── Bible Helpers ────────────────────────────────────────────────────────────

interface BibleEntryRef {
  filePath: string;
  name: string;
  aliases: string[];
  type: string;
  priority: string;
}

export function findAllBibleEntries(rootPath: string): BibleEntryRef[] {
  const bibleDir = projectPath(rootPath, "bible");
  if (!fs.existsSync(bibleDir)) return [];
  const files = getAllMdFiles(rootPath, bibleDir);
  const entries: BibleEntryRef[] = [];

  for (const file of files) {
    if (path.relative(bibleDir, file) === "voice-profile.md") continue;
    const content = readText(file);
    const { meta } = parseFrontmatter(content);

    // Derive type from subdirectory: bible/characters/ -> "character"
    const rel = path.relative(bibleDir, file).replace(/\\/g, "/");
    const subdir = rel.split("/")[0];
    const typeFromDir = subdir.replace(/s$/, ""); // "characters" -> "character"

    // Name: frontmatter > H1 heading > filename
    let name = meta.name;
    if (!name) {
      const h1 = content.split("\n").find((l: string) => l.startsWith("# "));
      name = h1 ? h1.replace(/^#\s+/, "").trim() : path.basename(file, ".md");
    }

    // Skip .gitkeep placeholders and voice-profile
    if (path.basename(file) === ".gitkeep") continue;

    entries.push({
      filePath: file,
      name,
      aliases: Array.isArray(meta.aliases) ? meta.aliases : [],
      type: meta.type || typeFromDir || "world",
      priority: meta.priority || "secondary"
    });
  }
  return entries;
}

function findBibleEntry(rootPath: string, nameOrAlias: string): BibleEntryRef | null {
  const entries = findAllBibleEntries(rootPath);
  const searchKey = normalizeKey(nameOrAlias);
  
  // exact name match first
  for (const e of entries) {
    if (normalizeKey(e.name) === searchKey) return e;
  }
  
  // then alias match
  for (const e of entries) {
    if (e.aliases.some(a => normalizeKey(a) === searchKey)) return e;
  }
  
  return null;
}

// ─── Extension ────────────────────────────────────────────────────────────────

export default function novelBibleExtension(pi: any) {

  // ─── Message Renderers ──────────────────────────────────────────────────────
  pi.registerMessageRenderer("novel-bible", (message: any, _options: any, theme: any) => {
    const details = message.details;
    const container = new Container();
    const maxW = Math.max(20, (process.stdout.columns || 80) - 4);
    const T = (str: string) => truncateToWidth(str, maxW);

    const headerBox = new Box(1, 0, (t: string) => theme.bold(theme.fg("accent", t)));
    headerBox.addChild(new Text(T(` 📖 NOVEL BIBLE SUMMARY `), 0, 0));
    container.addChild(headerBox);
    container.addChild(new Spacer(1));

    if (!details.entries || details.entries.length === 0) {
      container.addChild(new Text(T(`  No entries yet.  `), 2, 0, (t: string) => theme.fg("dim", t)));
    } else {
      for (const entry of details.entries) {
        container.addChild(new Text(T(`  ${theme.fg("accent", `[${entry.id}]`)} ${entry.name} (${entry.type})`), 2, 0));
        container.addChild(new Text(T(`    ${theme.fg("dim", String(entry.content).replace(/\n/g, " "))}`), 2, 0));
      }
    }
    
    container.addChild(new Spacer(1));
    container.addChild(new Text(T(`  Use the 'bible_list' or 'bible_search' tools to explore. `), 2, 0, (t: string) => theme.fg("dim", t)));

    const outerBox = new Box(1, 1);
    outerBox.addChild(container);
    return outerBox;
  });

  pi.registerMessageRenderer("novel-outline", (message: any, _options: any, theme: any) => {
    const details = message.details;
    const container = new Container();
    const maxW = Math.max(20, (process.stdout.columns || 80) - 4);
    const T = (str: string) => truncateToWidth(str, maxW);

    const headerBox = new Box(1, 0, (t: string) => theme.bold(theme.fg("accent", t)));
    headerBox.addChild(new Text(T(` 🗺️ NOVEL OUTLINE SUMMARY `), 0, 0));
    container.addChild(headerBox);
    container.addChild(new Spacer(1));

    if (!details.outlines || details.outlines.length === 0) {
      container.addChild(new Text(T(`  No outlines found.  `), 2, 0, (t: string) => theme.fg("dim", t)));
    } else {
      for (const out of details.outlines) {
        const chStr = String(out.chapter).padStart(2, "0");
        container.addChild(new Text(T(`  ${theme.fg("success", "CH " + chStr)} | ${out.title} `), 2, 0));
        if (out.purpose) {
           container.addChild(new Text(`       └─ ${out.purpose} `, 2, 0, (t: string) => theme.fg("dim", t)));
        }
      }
    }

    const outerBox = new Box(1, 1);
    outerBox.addChild(container);
    return outerBox;
  });

  // ─── Tool: bible_create ─────────────────────────────────────────────────────
  pi.registerTool({
    name: "bible_create",
    label: "Create Bible Entry",
    description: "Create a new world-building bible entry",
    parameters: Type.Object({
      type: Type.String({ description: "Entry type: character, location, item, faction, or world" }),
      name: Type.String({ description: "Primary name of the entity" }),
      aliases: Type.Optional(Type.Array(Type.String(), { description: "Other names or aliases" })),
      priority: Type.Optional(Type.String({ description: "Context priority: core, secondary, or minor. Default: secondary" })),
      tags: Type.Optional(Type.Array(Type.String(), { description: "Tags for categorization" })),
      content: Type.Optional(Type.String({ description: "Prose description/notes for the entry" }))
    }),
    execute: async (_id: string, params: any) => {
      const project = getProject();
      if (!project) return { content: [{ type: "text", text: "No project loaded. Run /PNW-init first." }] };

      const existing = findBibleEntry(project.rootPath, params.name);
      if (existing) {
        return { content: [{ type: "text", text: `Bible entry for "${params.name}" already exists.` }] };
      }

      const subdir = getBibleSubdir(params.type);
      const dirPath = path.join(project.rootPath, "bible", subdir);
      ensureDir(dirPath);

      const safeName = toSafeFilename(params.name);
      const valid = validateFilename(safeName);
      if (!valid.valid) return { content: [{ type: "text", text: `Invalid filename generated: ${valid.reason}` }] };

      let filePath = path.join(dirPath, `${safeName}.md`);
      let counter = 1;
      while (fs.existsSync(filePath)) {
        filePath = path.join(dirPath, `${safeName}-${counter}.md`);
        counter++;
      }

      const meta = {
        type: params.type,
        name: params.name,
        aliases: params.aliases || [],
        priority: params.priority || "secondary",
        tags: params.tags || []
      };

      let body = params.content || "";
      if (params.type === "character" && !body.includes("## Speech Patterns")) {
        // Add a stub section for character voices
        body += "\n\n## Speech Patterns / Voice\n(Define how this character speaks)";
      }

      writeText(filePath, buildFrontmatter(meta) + body);
      return { content: [{ type: "text", text: `Created bible entry for "${params.name}" at ${path.relative(project.rootPath, filePath)}` }] };
    }
  });

  // ─── Tool: bible_read ───────────────────────────────────────────────────────
  pi.registerTool({
    name: "bible_read",
    label: "Read Bible Entry",
    description: "Read a bible entry's full content by its name or alias",
    parameters: Type.Object({
      nameOrAlias: Type.String({ description: "Name or alias of the entry" })
    }),
    execute: async (_id: string, params: any) => {
      const project = getProject();
      if (!project) return { content: [{ type: "text", text: "No project loaded." }] };

      const entry = findBibleEntry(project.rootPath, params.nameOrAlias);
      if (!entry) return { content: [{ type: "text", text: `Bible entry "${params.nameOrAlias}" not found.` }] };

      const content = readText(entry.filePath);
      return { content: [{ type: "text", text: content }] };
    }
  });

  // ─── Tool: bible_update ─────────────────────────────────────────────────────
  pi.registerTool({
    name: "bible_update",
    label: "Update Bible Entry",
    description: "Update an existing bible entry's metadata or prose content",
    parameters: Type.Object({
      nameOrAlias: Type.String({ description: "Name or alias of the entry" }),
      aliases: Type.Optional(Type.Array(Type.String(), { description: "New list of aliases (replaces existing)" })),
      priority: Type.Optional(Type.String({ description: "New priority: core, secondary, minor" })),
      tags: Type.Optional(Type.Array(Type.String(), { description: "New list of tags (replaces existing)" })),
      content: Type.Optional(Type.String({ description: "New prose content (replaces existing body if provided)" }))
    }),
    execute: async (_id: string, params: any) => {
      const project = getProject();
      if (!project) return { content: [{ type: "text", text: "No project loaded." }] };

      const entry = findBibleEntry(project.rootPath, params.nameOrAlias);
      if (!entry) return { content: [{ type: "text", text: `Bible entry "${params.nameOrAlias}" not found.` }] };

      const fileContent = readText(entry.filePath);
      const { meta, body } = parseFrontmatter(fileContent);

      if (params.aliases) meta.aliases = params.aliases;
      if (params.priority) meta.priority = params.priority;
      if (params.tags) meta.tags = params.tags;

      const newBody = params.content !== undefined ? params.content : body;

      writeText(entry.filePath, buildFrontmatter(meta) + newBody);
      return { content: [{ type: "text", text: `Updated bible entry "${meta.name}".` }] };
    }
  });

  // ─── Tool: bible_delete ─────────────────────────────────────────────────────
  pi.registerTool({
    name: "bible_delete",
    label: "Delete Bible Entry",
    description: "Archive a bible entry to notes/deleted-bible/. Non-destructive.",
    parameters: Type.Object({
      nameOrAlias: Type.String({ description: "Name or alias of the entry" })
    }),
    execute: async (_id: string, params: any) => {
      const project = getProject();
      if (!project) return { content: [{ type: "text", text: "No project loaded." }] };

      const entry = findBibleEntry(project.rootPath, params.nameOrAlias);
      if (!entry) return { content: [{ type: "text", text: `Bible entry "${params.nameOrAlias}" not found.` }] };

      const archiveDir = path.join(project.rootPath, "notes", "deleted-bible");
      ensureDir(archiveDir);
      
      const fileName = path.basename(entry.filePath);
      const newPath = path.join(archiveDir, `${fileName.replace(".md", "")}-${Date.now()}.md`);
      fs.renameSync(entry.filePath, newPath);
      
      return { content: [{ type: "text", text: `Archived bible entry "${entry.name}" to notes/deleted-bible.` }] };
    }
  });

  // ─── Tool: bible_list ───────────────────────────────────────────────────────
  pi.registerTool({
    name: "bible_list",
    label: "List Bible Entries",
    description: "List all bible entries, optionally filtered by type or priority",
    parameters: Type.Object({
      type: Type.Optional(Type.String({ description: "Filter by type (character, location, item, faction, world)" })),
      priority: Type.Optional(Type.String({ description: "Filter by priority (core, secondary, minor)" }))
    }),
    execute: async (_id: string, params: any) => {
      const project = getProject();
      if (!project) return { content: [{ type: "text", text: "No project loaded." }] };

      let entries = findAllBibleEntries(project.rootPath);
      if (params.type) {
        entries = entries.filter(e => normalizeKey(e.type) === normalizeKey(params.type!));
      }
      if (params.priority) {
        entries = entries.filter(e => normalizeKey(e.priority) === normalizeKey(params.priority!));
      }

      if (entries.length === 0) return { content: [{ type: "text", text: "No bible entries found." }] };

      const lines = entries.map(e => `- [${e.priority}] ${e.name} (${e.type})` + (e.aliases.length > 0 ? ` (aka: ${e.aliases.join(", ")})` : ""));
      return { content: [{ type: "text", text: `Found ${entries.length} entries:\n\n${lines.join("\n")}` }] };
    }
  });

  // ─── Tool: bible_search ─────────────────────────────────────────────────────
  pi.registerTool({
    name: "bible_search",
    label: "Search Bible",
    description: "Search across all bible files for a keyword or regex",
    parameters: Type.Object({
      query: Type.String({ description: "Search query" }),
      regex: Type.Optional(Type.Boolean({ description: "Treat query as regex (default: false)" }))
    }),
    execute: async (_id: string, params: any) => {
      const project = getProject();
      if (!project) return { content: [{ type: "text", text: "No project loaded." }] };

      const results: string[] = [];
      const pattern = params.regex ? new RegExp(params.query, "gi") : null;
      const entries = findAllBibleEntries(project.rootPath);

      for (const entry of entries) {
        const content = readText(entry.filePath);
        const { body } = parseFrontmatter(content);
        const lines = body.split("\n");
        let matchesInFile = 0;

        for (let i = 0; i < lines.length; i++) {
          const match = pattern ? pattern.test(lines[i]) : lines[i].toLowerCase().includes(params.query.toLowerCase());
          if (match) {
            results.push(`${entry.name} (L${i + 1}): ${lines[i].trim()}`);
            matchesInFile++;
            if (matchesInFile > 5) break; // limit matches per file for readability
          }
          if (pattern) pattern.lastIndex = 0;
        }
        if (results.length >= 50) break; // safety
      }

      if (results.length === 0) return { content: [{ type: "text", text: "No results found in bible." }] };
      return { content: [{ type: "text", text: `Found ${results.length} literal matches:\n\n${results.join("\n")}` }] };
    }
  });

  // ─── Tool: bible_consistency_check ──────────────────────────────────────────
  pi.registerTool({
    name: "bible_consistency_check",
    label: "Check Bible Freshness",
    description: "Compare bible modification dates with continuity/facts.json last_synced. Date-based freshness only, never a factual consistency verdict.",
    parameters: Type.Object({}),
    execute: async () => {
      const project = getProject();
      if (!project) return { content: [{ type: "text", text: "No project loaded." }] };

      const factsPath = path.join(project.rootPath, "continuity", "facts.json");
      if (!fs.existsSync(factsPath)) return { content: [{ type: "text", text: "Freshness unknown: facts.json is missing. No factual comparison performed." }] };

      const factsData = JSON.parse(readText(factsPath));
      const lastSyncedMs = typeof factsData.last_synced === "string" && factsData.last_synced.trim()
        ? Date.parse(factsData.last_synced) : NaN;
      if (!Number.isFinite(lastSyncedMs) || lastSyncedMs > Date.now()) {
        return { content: [{ type: "text", text: "Freshness unknown: last_synced is missing, invalid, or in the future. Compare the records with actual prose; no factual comparison performed." }] };
      }

      const entries = findAllBibleEntries(project.rootPath);
      const staleItems: string[] = [];

      for (const entry of entries) {
        const stat = fs.statSync(entry.filePath);
        if (stat.mtimeMs > lastSyncedMs) {
          staleItems.push(`${entry.name} (modified: ${new Date(stat.mtimeMs).toISOString()})`);
        }
      }

      if (staleItems.length === 0) {
        return { content: [{ type: "text", text: "No bible entries have newer modification dates than last_synced. This is date-based freshness only; factual consistency has not been checked." }] };
      }

      return { content: [{ type: "text", text: `Date-based freshness warning: ${staleItems.length} bible entries have been modified since last_synced. This does not establish a factual contradiction; compare affected records and prose.\n\n` + staleItems.join("\n") }] };
    }
  });

  // ─── Outline Tools ──────────────────────────────────────────────────────────

  pi.registerTool({
    name: "outline_chapter_create",
    label: "Create Chapter Outline",
    description: "Create or regenerate a chapter outline file",
    parameters: Type.Object({
      chapter: Type.Number({ description: "Chapter number" }),
      title: Type.String({ description: "Chapter title" }),
      pov: Type.Optional(Type.String({ description: "POV character" })),
      locations: Type.Optional(Type.Array(Type.String(), { description: "Locations appearing in chapter" })),
      timeline: Type.Optional(Type.String({ description: "When this happens" })),
      purpose: Type.Optional(Type.String({ description: "Narrative purpose of this chapter" })),
      targetWordCount: Type.Optional(Type.Number({ description: "Target word count" })),
      emotional_arc_enter: Type.Optional(Type.String({ description: "State entering the chapter" })),
      emotional_arc_exit: Type.Optional(Type.String({ description: "State exiting the chapter" })),
      plot_threads_advanced: Type.Optional(Type.Array(Type.String())),
      scenes: Type.Optional(Type.Number({ description: "Number of scenes" })),
      body: Type.Optional(Type.String({ description: "Outline prose/scene cards" }))
    }),
    execute: async (_id: string, params: any) => {
      const project = getProject();
      if (!project) return { content: [{ type: "text", text: "No project loaded." }] };

      const dirPath = path.join(project.rootPath, "outline", "chapters");
      ensureDir(dirPath);

      const safeTitle = toSafeFilename(params.title);
      const chPrefix = String(params.chapter).padStart(2, "0");
      
      // Look for existing file for this chapter
      const files = fs.readdirSync(dirPath);
      let existingFile = files.find(f => f.startsWith(`${chPrefix}-`) && f.endsWith(".md"));
      
      const fileName = `${chPrefix}-${safeTitle}.md`;
      const filePath = existingFile ? path.join(dirPath, existingFile) : path.join(dirPath, fileName);

      const meta = {
        chapter: params.chapter,
        title: params.title,
        pov: params.pov || "",
        locations: params.locations || [],
        timeline: params.timeline || "",
        purpose: params.purpose || "",
        targetWordCount: params.targetWordCount || 2000,
        emotional_arc: {
          enter: params.emotional_arc_enter || "",
          exit: params.emotional_arc_exit || ""
        },
        plot_threads_advanced: params.plot_threads_advanced || [],
        scenes: params.scenes || 1
      };

      let contentToWrite = params.body || "## Scene 1\n(Describe scene 1...)";

      // If file exists, we can preserve its body if the user didn't provide one
      if (existingFile && !params.body) {
        const oldContent = readText(filePath);
        const parsed = parseFrontmatter(oldContent);
        contentToWrite = parsed.body;
      }

      writeText(filePath, buildFrontmatter(meta) + contentToWrite);
      
      // Also potentially rename if the title changed on an existing file
      if (existingFile && existingFile !== fileName) {
        fs.renameSync(filePath, path.join(dirPath, fileName));
      }

      return { content: [{ type: "text", text: `Chapter outline for Ch ${params.chapter} saved.` }] };
    }
  });

  pi.registerTool({
    name: "outline_chapter_read",
    label: "Read Chapter Outline",
    description: "Read a chapter outline file",
    parameters: Type.Object({
      chapter: Type.Number({ description: "Chapter number" })
    }),
    execute: async (_id: string, params: any) => {
      const project = getProject();
      if (!project) return { content: [{ type: "text", text: "No project loaded." }] };

      const dirPath = path.join(project.rootPath, "outline", "chapters");
      if (!fs.existsSync(dirPath)) return { content: [{ type: "text", text: "Outline directory not found." }] };

      const chPrefix = String(params.chapter).padStart(2, "0");
      const files = fs.readdirSync(dirPath);
      const file = files.find(f => f.startsWith(`${chPrefix}-`) && f.endsWith(".md"));

      if (!file) return { content: [{ type: "text", text: `Chapter outline ${params.chapter} not found.` }] };

      const content = readText(path.join(dirPath, file));
      return { content: [{ type: "text", text: content }] };
    }
  });

  pi.registerTool({
    name: "outline_chapter_update",
    label: "Update Chapter Outline",
    description: "Replace a chapter outline's body and optionally correct its title, timeline and scene count. Preserve unspecified metadata; reconcile other affected plans and actual records separately.",
    parameters: Type.Object({
      chapter: Type.Number({ description: "Chapter number" }),
      body: Type.String({ description: "New full body for the outline (e.g. updated scene breakdown)" }),
      title: Type.Optional(Type.String({ minLength: 1 })),
      timeline: Type.Optional(Type.String()),
      scenes: Type.Optional(Type.Integer({ minimum: 1 }))
    }),
    execute: async (_id: string, params: any) => {
      const project = getProject();
      if (!project) return { content: [{ type: "text", text: "No project loaded." }] };

      const dirPath = path.join(project.rootPath, "outline", "chapters");
      const chPrefix = String(params.chapter).padStart(2, "0");
      const files = fs.readdirSync(dirPath);
      const file = files.find(f => f.startsWith(`${chPrefix}-`) && f.endsWith(".md"));

      if (!file) return { content: [{ type: "text", text: `Chapter outline ${params.chapter} not found.` }] };

      const filePath = path.join(dirPath, file);
      const oldContent = readText(filePath);
      const { meta } = parseFrontmatter(oldContent);
      for (const key of ["title", "timeline", "scenes"]) {
        if (params[key] !== undefined) meta[key] = params[key];
      }
      writeText(filePath, buildFrontmatter(meta) + params.body);
      return { content: [{ type: "text", text: `Updated chapter ${params.chapter} outline.` }] };
    }
  });

  pi.registerTool({
    name: "outline_scene_card_create",
    label: "Create or Update Scene Card",
    description: "Add or overwrite a specific scene section (e.g., '## Scene 1') inside a chapter outline",
    parameters: Type.Object({
      chapter: Type.Number({ description: "Chapter number" }),
      scene: Type.Number({ description: "Scene number" }),
      content: Type.String({ description: "Content of the scene card (everything under the ## Scene header)" })
    }),
    execute: async (_id: string, params: any) => {
      const project = getProject();
      if (!project) return { content: [{ type: "text", text: "No project loaded." }] };

      const dirPath = path.join(project.rootPath, "outline", "chapters");
      const chPrefix = String(params.chapter).padStart(2, "0");
      const files = fs.readdirSync(dirPath);
      const file = files.find(f => f.startsWith(`${chPrefix}-`) && f.endsWith(".md"));

      if (!file) return { content: [{ type: "text", text: `Chapter outline ${params.chapter} not found.` }] };

      const filePath = path.join(dirPath, file);
      const oldContent = readText(filePath);
      const { meta, body } = parseFrontmatter(oldContent);

      // Simple regex to replace or append the specific scene card
      const sceneHeaderRegex = new RegExp(`(^|\\n)## Scene ${params.scene}(:.*?)?(\\n[\\s\\S]*?)(?=(\\n## Scene \\d+)|$)`, "i");
      const fullNewSection = `\n## Scene ${params.scene}\n${params.content.trim()}\n`;

      let newBody = body;
      if (sceneHeaderRegex.test(body)) {
        newBody = body.replace(sceneHeaderRegex, fullNewSection);
      } else {
        newBody = body.trimEnd() + "\n" + fullNewSection;
      }

      meta.scenes = Math.max(Number(meta.scenes) || 0, params.scene);
      writeText(filePath, buildFrontmatter(meta) + newBody);
      return { content: [{ type: "text", text: `Updated scene card ${params.scene} in Chapter ${params.chapter} outline.` }] };
    }
  });

  pi.registerTool({
    name: "outline_chapter_reorder",
    label: "Reorder Chapter Outline",
    description: "Move a novel/novella chapter to an unoccupied positive number, updating scene addresses while preserving stable identities. Does not shift other chapters or rewrite plot references.",
    parameters: Type.Object({
      oldChapter: Type.Integer({ minimum: 1, description: "Current chapter number" }),
      newChapter: Type.Integer({ minimum: 1, description: "New chapter number" })
    }),
    execute: async (_id: string, params: any) => {
      const project = refreshProject();
      if (!project) return { content: [{ type: "text", text: "No project loaded." }] };
      positiveInteger(params.oldChapter, "Source chapter");
      positiveInteger(params.newChapter, "Destination chapter");
      if (["short-story", "flash-fiction"].includes(project.config.format)) throw new Error("Chapter reorder is unsupported for this format.");
      if (params.oldChapter === params.newChapter) throw new Error("Choose a different unoccupied chapter number.");
      const outDir = projectPath(project.rootPath, "outline/chapters");
      const msDir = projectPath(project.rootPath, "manuscript/chapters");
      const newPrefix = String(params.newChapter).padStart(2, "0");
      const outFiles = fs.existsSync(outDir) ? fs.readdirSync(outDir).filter(f => f.endsWith(".md")) : [];
      const msDirs = fs.existsSync(msDir) ? fs.readdirSync(msDir) : [];
      const numbered = (name: string, number: number) => parseInt(name.split("-")[0], 10) === number;
      if (outFiles.some(f => numbered(f, params.newChapter)) || msDirs.some(d => numbered(d, params.newChapter))) {
        throw new Error("Destination chapter is occupied. No outline or prose was changed.");
      }
      const oldOutFiles = outFiles.filter(f => numbered(f, params.oldChapter));
      const oldMsDirs = msDirs.filter(d => numbered(d, params.oldChapter));
      if (oldOutFiles.length > 1 || oldMsDirs.length > 1) throw new Error("Ambiguous source chapter; no files were changed.");
      const outFile = oldOutFiles[0], oldMsDir = oldMsDirs[0];
      if (!outFile && !oldMsDir) throw new Error("Source chapter not found.");
      const scenes = [...project.scenes.values()].filter(s => s.chapter === params.oldChapter);
      const newMsDir = oldMsDir?.replace(/^\d+/, newPrefix);
      if (outFile) {
        const oldOutPath = projectPath(project.rootPath, path.join(outDir, outFile));
        const newOutPath = projectPath(project.rootPath, path.join(outDir, outFile.replace(/^\d+/, newPrefix)));
        const content = readText(oldOutPath);
        const { meta, body } = parseFrontmatter(content);
        meta.chapter = params.newChapter;
        writeText(oldOutPath, buildFrontmatter(meta) + body);
        fs.renameSync(oldOutPath, newOutPath);
      }
      if (oldMsDir && newMsDir) {
        fs.renameSync(projectPath(project.rootPath, path.join(msDir, oldMsDir)), projectPath(project.rootPath, path.join(msDir, newMsDir)));
        for (const scene of scenes) {
          const file = projectPath(project.rootPath, path.join(msDir, newMsDir, path.basename(scene.filePath)));
          const { meta, body } = parseFrontmatter(readText(file));
          meta.chapter = params.newChapter;
          saveScene(file, buildFrontmatter(meta) + body);
        }
      }
      refreshProject();
      return { content: [{ type: "text", text: `Reordered chapter ${params.oldChapter} -> ${params.newChapter}.` }] };
    }
  });


  // ─── Slash Commands ───────────────────────────────────────────────────────────

  pi.registerCommand("PNW-bible", {
    description: "List bible entries and stats",
    handler: async (_args: string, ctx: any) => {
      const project = getProject();
      if (!project) {
        pi.sendMessage({ customType: "markdown", content: "No project loaded. Run /PNW-init first.", display: true });
        return;
      }

      const found = findAllBibleEntries(project.rootPath);
      const displayEntries = found.map((e: BibleEntryRef, i: number) => {
        const content = readText(e.filePath);
        const { body } = parseFrontmatter(content);
        // First non-empty non-heading line as the snippet
        const snippet = body.split("\n").find((l: string) => l.trim() && !l.startsWith("#")) || "";
        return { id: String(i + 1).padStart(2, "0"), name: e.name, type: e.type, content: snippet.trim() };
      });

      pi.sendMessage({
        customType: "novel-bible",
        content: `Bible Summary`,
        display: true,
        details: { entries: displayEntries }
      });
    }
  });

  pi.registerCommand("PNW-outline", {
    description: "Show a summary of the current beat sheet and chapter outlines",
    handler: async (_args: string, ctx: any) => {
      const project = getProject();
      if (!project) {
        pi.sendMessage({ customType: "markdown", content: "No project loaded. Run /PNW-init first.", display: true });
        return;
      }

      const outDir = path.join(project.rootPath, "outline", "chapters");
      if (!fs.existsSync(outDir)) {
        pi.sendMessage({ customType: "markdown", content: "No outlines found.", display: true });
        return;
      }

      const files = fs.readdirSync(outDir).filter((f: string) => f.endsWith(".md")).sort();
      const outlines = [];
      for (const file of files) {
        const content = readText(path.join(outDir, file));
        const { meta } = parseFrontmatter(content);
        const lines = content.split("\n");

        // Chapter number: from filename prefix (e.g. "03-floor-one.md" -> 3)
        const chapterFromFile = parseInt(file, 10);
        const chapter = isNaN(chapterFromFile) ? "?" : chapterFromFile;

        // Title: first `# ...` heading, strip the leading `# Chapter N: ` prefix if present
        const h1Line = lines.find((l: string) => l.startsWith("# "));
        let title = meta.title || "Untitled";
        if (!meta.title && h1Line) {
          title = h1Line.replace(/^#\s+/, "").replace(/^Chapter\s+\d+[:\s]+/i, "").trim() || h1Line.replace(/^#\s+/, "").trim();
        }

        // Purpose: first non-empty line after `## Narrative Purpose`
        let purpose = meta.purpose || "";
        const purposeIdx = lines.findIndex((l: string) => /^##\s+Narrative Purpose/i.test(l));
        if (!purpose && purposeIdx !== -1) {
          for (let i = purposeIdx + 1; i < lines.length; i++) {
            const t = lines[i].trim();
            if (t && !t.startsWith("#")) { purpose = t; break; }
          }
        }

        outlines.push({ chapter, title, purpose });
      }
      
      pi.sendMessage({
        customType: "novel-outline",
        content: `Outline Summary`,
        display: true,
        details: { outlines }
      });
    }
  });

} // end extension
