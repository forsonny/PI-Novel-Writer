// novel-bible.ts — Phase 2: Bible & Planning
// Bible CRUD + outline management extension

import path from "node:path";
import fs from "node:fs";
import { Type } from "@sinclair/typebox";
import { Box, Text, Container, Spacer, truncateToWidth } from "@mariozechner/pi-tui";
import { readText, writeText, resolvePath, pathsEqual, normalizeKey, toSafeFilename, validateFilename } from "./utils/platform.ts";
import { getProject } from "./novel-core.ts";

// ─── Shared Utilities ─────────────────────────────────────────────────────────

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function parseFrontmatter(content: string): { meta: Record<string, any>; body: string } {
  const match = content.match(FRONTMATTER_RE);
  if (!match) return { meta: {}, body: content };
  const rawYaml = match[1];
  const body = content.slice(match[0].length);
  // Simple YAML parser
  const meta: Record<string, any> = {};
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
        inArray = false;
      } else if (val.startsWith("[") && val.endsWith("]")) {
        meta[currentKey] = val.slice(1, -1).split(",").map(s => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
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
      meta[currentKey].push(trimmed.slice(2).trim().replace(/^["']|["']$/g, ""));
      inArray = true;
    }
  }
  return { meta, body };
}

function buildFrontmatter(meta: Record<string, any>): string {
  const lines: string[] = ["---"];
  for (const [key, val] of Object.entries(meta)) {
    if (Array.isArray(val)) {
      lines.push(`${key}:`);
      for (const item of val) {
        lines.push(`  - ${JSON.stringify(item)}`);
      }
    } else if (typeof val === "string") {
      lines.push(`${key}: ${JSON.stringify(val)}`);
    } else {
      lines.push(`${key}: ${val}`);
    }
  }
  lines.push("---", "");
  return lines.join("\n");
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

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

function findAllBibleEntries(rootPath: string): BibleEntryRef[] {
  const bibleDir = path.join(rootPath, "bible");
  if (!fs.existsSync(bibleDir)) return [];
  const files = getAllMdFiles(bibleDir);
  const entries: BibleEntryRef[] = [];

  for (const file of files) {
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
    label: "Check Bible Consistency",
    description: "Check if the continuity/facts.json file is stale compared to bible entries",
    parameters: Type.Object({}),
    execute: async () => {
      const project = getProject();
      if (!project) return { content: [{ type: "text", text: "No project loaded." }] };

      const factsPath = path.join(project.rootPath, "continuity", "facts.json");
      if (!fs.existsSync(factsPath)) return { content: [{ type: "text", text: "facts.json not found. Run world-building first." }] };

      const factsData = JSON.parse(readText(factsPath));
      let lastSyncedMs = 0;
      if (factsData.last_synced) {
        lastSyncedMs = new Date(factsData.last_synced).getTime();
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
        return { content: [{ type: "text", text: "All continuity facts are up-to-date with current bible entries." }] };
      }

      return { content: [{ type: "text", text: `Warning: facts.json is stale. ${staleItems.length} bible entries have been modified since last sync:\n\n` + staleItems.join("\n") }] };
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
    label: "Update Chapter Outline Outline",
    description: "Update a chapter outline's body exactly",
    parameters: Type.Object({
      chapter: Type.Number({ description: "Chapter number" }),
      body: Type.String({ description: "New full body for the outline (e.g. updated scene breakdown)" })
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

      writeText(filePath, buildFrontmatter(meta) + newBody);
      return { content: [{ type: "text", text: `Updated scene card ${params.scene} in Chapter ${params.chapter} outline.` }] };
    }
  });

  pi.registerTool({
    name: "outline_chapter_reorder",
    label: "Reorder Chapter Outline",
    description: "Rename a chapter outline file and its manuscript directory to a new chapter number",
    parameters: Type.Object({
      oldChapter: Type.Number({ description: "Current chapter number" }),
      newChapter: Type.Number({ description: "New chapter number" })
    }),
    execute: async (_id: string, params: any) => {
      const project = getProject();
      if (!project) return { content: [{ type: "text", text: "No project loaded." }] };

      // 1. Move the outline file
      const outDir = path.join(project.rootPath, "outline", "chapters");
      const oldPrefix = String(params.oldChapter).padStart(2, "0");
      const newPrefix = String(params.newChapter).padStart(2, "0");
      
      const outFiles = fs.readdirSync(outDir);
      const outFile = outFiles.find(f => f.startsWith(`${oldPrefix}-`) && f.endsWith(".md"));

      if (outFile) {
        const newOutFile = outFile.replace(new RegExp(`^${oldPrefix}-`), `${newPrefix}-`);
        const oldOutPath = path.join(outDir, outFile);
        const newOutPath = path.join(outDir, newOutFile);
        
        // update frontmatter internally
        const content = readText(oldOutPath);
        const { meta, body } = parseFrontmatter(content);
        meta.chapter = params.newChapter;
        writeText(oldOutPath, buildFrontmatter(meta) + body);
        
        fs.renameSync(oldOutPath, newOutPath);
      }

      // 2. Move the manuscript directory
      const msDir = path.join(project.rootPath, "manuscript", "chapters");
      if (fs.existsSync(msDir)) {
        const msDirs = fs.readdirSync(msDir);
        const oldMsDir = msDirs.find(d => d.startsWith(`${oldPrefix}-`) || d === oldPrefix);
        if (oldMsDir) {
          let newMsDir = oldMsDir.replace(new RegExp(`^${oldPrefix}`), newPrefix);
          if (newMsDir === oldMsDir) newMsDir = newPrefix; // if it was exactly "01" say
          fs.renameSync(path.join(msDir, oldMsDir), path.join(msDir, newMsDir));
        }
      }

      return { content: [{ type: "text", text: `Reordered chapter ${params.oldChapter} -> ${params.newChapter}.` }] };
    }
  });


  // ─── Slash Commands ───────────────────────────────────────────────────────────

  pi.registerCommand("PNW-bible", {
    description: "List bible entries and stats",
    handler: async (_args: string, ctx: any) => {
      const project = getProject();
      if (!project) {
        pi.sendMessage({ customType: "markdown", content: "No project loaded. Run /PNW-init first.", display: { title: "Error", isSummary: true } });
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
        display: { title: "Bible", isSummary: false },
        details: { entries: displayEntries }
      });
    }
  });

  pi.registerCommand("PNW-outline", {
    description: "Show a summary of the current beat sheet and chapter outlines",
    handler: async (_args: string, ctx: any) => {
      const project = getProject();
      if (!project) {
        pi.sendMessage({ customType: "markdown", content: "No project loaded. Run /PNW-init first.", display: { title: "Error", isSummary: true } });
        return;
      }

      const outDir = path.join(project.rootPath, "outline", "chapters");
      if (!fs.existsSync(outDir)) {
        pi.sendMessage({ customType: "markdown", content: "No outlines found.", display: { title: "Outline", isSummary: true } });
        return;
      }

      const files = fs.readdirSync(outDir).filter((f: string) => f.endsWith(".md")).sort();
      const outlines = [];
      for (const file of files) {
        const content = readText(path.join(outDir, file));
        const lines = content.split("\n");

        // Chapter number: from filename prefix (e.g. "03-floor-one.md" -> 3)
        const chapterFromFile = parseInt(file, 10);
        const chapter = isNaN(chapterFromFile) ? "?" : chapterFromFile;

        // Title: first `# ...` heading, strip the leading `# Chapter N: ` prefix if present
        const h1Line = lines.find((l: string) => l.startsWith("# "));
        let title = "Untitled";
        if (h1Line) {
          title = h1Line.replace(/^#\s+/, "").replace(/^Chapter\s+\d+[:\s]+/i, "").trim() || h1Line.replace(/^#\s+/, "").trim();
        }

        // Purpose: first non-empty line after `## Narrative Purpose`
        let purpose = "";
        const purposeIdx = lines.findIndex((l: string) => /^##\s+Narrative Purpose/i.test(l));
        if (purposeIdx !== -1) {
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
        display: { title: "Outline Summary", isSummary: false },
        details: { outlines }
      });
    }
  });

} // end extension
