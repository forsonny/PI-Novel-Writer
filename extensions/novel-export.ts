// novel-export.ts — Phase 5
// Compile and export extension

import path from "node:path";
import fs from "node:fs";
import { Type } from "@sinclair/typebox";
import { Box, Text, Container, Spacer, truncateToWidth } from "@mariozechner/pi-tui";
import { readText, writeText } from "./utils/platform.ts";
import { getProject } from "./novel-core.ts";

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function parseFrontmatter(content: string): { meta: Record<string, any>; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { meta: {}, body: content };
  const rawYaml = match[1];
  const body = content.slice(match[0].length);
  return { meta: {}, body };
}

async function compileManuscriptInternal(project: any) {
  const compiledLines: string[] = [];

  // Add Pandoc YAML metadata block
  compiledLines.push("---");
  compiledLines.push(`title: ${JSON.stringify(project.config.title)}`);
  compiledLines.push(`author: ${JSON.stringify(project.config.author || "Unknown")}`);
  compiledLines.push(`date: ${JSON.stringify(new Date().toISOString().split("T")[0])}`);
  compiledLines.push("---");
  compiledLines.push("");

  const sortedScenes = [...project.scenes.values()].sort((a: any, b: any) => {
    if (a.chapter !== b.chapter) return a.chapter - b.chapter;
    return a.scene - b.scene;
  });

  let currentChapter = -1;

  for (const scene of sortedScenes) {
    if (scene.chapter !== currentChapter) {
      if (project.config.format === "novel" || project.config.format === "novella") {
        compiledLines.push(`\n# Chapter ${scene.chapter}\n`);
      }
      currentChapter = scene.chapter;
    }

    const content = readText(scene.filePath);
    const { body } = parseFrontmatter(content);

    if (scene.scene > 1) {
      compiledLines.push(`\n* * *\n`);
    }

    compiledLines.push(body.trim());
    compiledLines.push("");
  }

  const exportsDir = path.join(project.rootPath, "exports");
  ensureDir(exportsDir);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(exportsDir, `manuscript-${timestamp}.md`);
  
  writeText(outputPath, compiledLines.join("\n"));
  
  return outputPath;
}

export default function novelExportExtension(pi: any) {

  // ─── Message Renderers ──────────────────────────────────────────────────────
  pi.registerMessageRenderer("novel-compile", (message: any, _options: any, theme: any) => {
    const details = message.details;
    const container = new Container();
    const maxW = Math.max(20, (process.stdout.columns || 80) - 4);
    const T = (str: string) => truncateToWidth(str, maxW);

    const titleColor = details.success ? "success" : "error";
    const headerBox = new Box(1, 0, (t: string) => theme.bold(theme.fg(titleColor, t)));
    headerBox.addChild(new Text(T(` 📚 MANUSCRIPT COMPILATION `), 0, 0));
    container.addChild(headerBox);
    container.addChild(new Spacer(1));

    if (details.success) {
      container.addChild(new Text(T(`  ${theme.fg("success", "✓")} Manuscript successfully compiled. `), 2, 0));
      container.addChild(new Text(T(`    ${theme.fg("dim", `Path: ${details.mdPath}`)}`), 2, 0));
      
      container.addChild(new Spacer(1));
      if (details.docxSuccess) {
         container.addChild(new Text(T(`  ${theme.fg("success", "✓")} DOCX export successful. `), 2, 0));
         container.addChild(new Text(T(`    ${theme.fg("dim", `Path: ${details.docxPath}`)}`), 2, 0));
      } else if (details.pandocMissing) {
         container.addChild(new Text(T(`  ${theme.fg("warning", "⚠")} Pandoc not found. Auto-export to DOCX skipped. `), 2, 0));
         container.addChild(new Spacer(1));
         container.addChild(new Text(T(`  To enable DOCX export, please install pandoc:`), 2, 0));
         container.addChild(new Text(T(`    MacOS:   brew install pandoc`), 2, 0, (t: string) => theme.fg("dim", t)));
         container.addChild(new Text(T(`    Windows: choco install pandoc`), 2, 0, (t: string) => theme.fg("dim", t)));
         container.addChild(new Text(T(`    Linux:   apt install pandoc`), 2, 0, (t: string) => theme.fg("dim", t)));
      } else if (details.error) {
        container.addChild(new Spacer(1));
        container.addChild(new Text(T(`  ${theme.fg("error", "✗")} DOCX export failed:`), 2, 0));
        container.addChild(new Text(T(`    ${theme.fg("error", String(details.error))}`), 2, 0));
      }
    } else {
      container.addChild(new Text(T(`  ${theme.fg("error", "✗")} Compilation failed:`), 2, 0));
      container.addChild(new Text(T(`    ${theme.fg("error", String(details.error))}`), 2, 0));
    }

    const outerBox = new Box(1, 1);
    outerBox.addChild(container);
    return outerBox;
  });

  // ─── Tool: compile_manuscript ─────────────────────────────────────────────
  pi.registerTool({
    name: "compile_manuscript",
    label: "Compile Manuscript",
    description: "Compile all scenes into a single ordered markdown file, sorting by canonical order and adding headings.",
    parameters: Type.Object({}),
    execute: async () => {
      const project = getProject();
      if (!project) return { content: [{ type: "text", text: "No project loaded. Run /PNW-init first." }] };

      const outputPath = await compileManuscriptInternal(project);
      return {
        content: [{ type: "text", text: `Compiled manuscript saved to: ${outputPath}` }]
      };
    }
  });

  // ─── Tool: export_docx ────────────────────────────────────────────────────
  pi.registerTool({
    name: "export_docx",
    label: "Export DOCX",
    description: "Convert compiled markdown manuscript to DOCX via Pandoc.",
    parameters: Type.Object({
      inputPath: Type.String({ description: "Absolute path to the compiled markdown file." }),
      outputPath: Type.String({ description: "Absolute path for the output .docx file." })
    }),
    execute: async (_id: string, params: any) => {
      try {
        const { inputPath, outputPath } = params;
        if (!fs.existsSync(inputPath)) {
          return { content: [{ type: "text", text: `Input file not found: ${inputPath}` }] };
        }
        
        ensureDir(path.dirname(outputPath));

        const cmdResult = await pi.exec("bash", ["-c", `pandoc "${inputPath}" -o "${outputPath}"`]);
        if (cmdResult.code !== 0) {
           return { content: [{ type: "text", text: `Pandoc conversion failed: \n${cmdResult.stderr || cmdResult.stdout}` }] };
        }
        return { content: [{ type: "text", text: `Successfully exported to DOCX: ${outputPath}` }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error executing pandoc: ${err.message}` }] };
      }
    }
  });

  // ─── Command: /PNW-compile ────────────────────────────────────────────────
  pi.registerCommand("PNW-compile", {
    description: "Compile manuscript into a single file and attempt export to DOCX",
    handler: async (_args: string, _ctx: any) => {
      const project = getProject();
      if (!project) {
        pi.sendMessage({ customType: "markdown", content: "No project loaded. Run /PNW-init first.", display: { title: "Error", isSummary: true } });
        return;
      }

      pi.sendMessage({ customType: "markdown", content: "Compiling manuscript...", display: { title: "Compile", isSummary: true } });
      const mdPath = await compileManuscriptInternal(project);
      pi.sendMessage({ customType: "markdown", content: `Compiled manuscript saved to: ${mdPath}`, display: { title: "Compile", isSummary: true } });

      const docxPath = mdPath.replace(/\.md$/, ".docx");

      let hasPandoc = false;
      try {
        const checkRes = await pi.exec("bash", ["-c", "which pandoc || where pandoc"]);
        if (checkRes.code === 0 && checkRes.stdout?.trim()) {
           hasPandoc = true;
        }
      } catch (e) {
        // Assume false
      }

      if (!hasPandoc) {
        pi.sendMessage({
          customType: "novel-compile",
          content: "Compilation finished. Missing pandoc.",
          display: { title: "Compile", isSummary: false },
          details: { success: true, mdPath, hasPandoc: false }
        });
        return;
      }

      pi.sendMessage({ customType: "markdown", content: "Exporting to DOCX via Pandoc...", display: { title: "Compile", isSummary: true } });
      try {
        const cmdResult = await pi.exec("bash", ["-c", `pandoc "${mdPath}" -o "${docxPath}"`]);
        if (cmdResult.code !== 0) {
           pi.sendMessage({
             customType: "novel-compile",
             content: `Compilation finished with pandoc error.`,
             display: { title: "Compile Failed", isSummary: false },
             details: { success: true, mdPath, hasPandoc: true, error: cmdResult.stderr || cmdResult.stdout }
           });
           return;
        }
        pi.sendMessage({
          customType: "novel-compile",
          content: `Compilation finished successfully.`,
          display: { title: "Compile Success", isSummary: false },
          details: { success: true, mdPath, hasPandoc: true, docxPath }
        });
      } catch (err: any) {
        pi.sendMessage({
          customType: "novel-compile",
          content: `Compilation finished with exception.`,
          display: { title: "Compile Error", isSummary: false },
          details: { success: true, mdPath, hasPandoc: true, error: err.message }
        });
      }
    }
  });
}
