// novel-export.ts — Phase 5
// Compile and export extension

import path from "node:path";
import fs from "node:fs";
import { Type } from "typebox";
import { Box, Text, Container, Spacer, truncateToWidth } from "@earendil-works/pi-tui";
import { readText, writeText } from "./utils/platform.ts";
import { refreshProject, type NovelProject } from "./novel-core.ts";
import { exportManuscript, type ExportOptions } from "./llgf/manuscript.ts";

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

export function compileManuscriptInternal(project: NovelProject, options: ExportOptions = {}) {
  return exportManuscript(project, options).path;
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
    description: "Export a working draft or one immutable accepted snapshot, with a source manifest. Export does not publish or certify literary quality.",
    parameters: Type.Object({ mode: Type.Optional(Type.Union([Type.Literal("working"), Type.Literal("accepted")])), requireComplete: Type.Optional(Type.Boolean()) }),
    execute: async (_id: string, params: ExportOptions) => {
      const project = refreshProject();
      if (!project) return { content: [{ type: "text", text: "No project loaded. Run /PNW-init first." }] };

      const output = exportManuscript(project, params);
      return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }] };
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

        const cmdResult = await pi.exec("pandoc", [inputPath, "-o", outputPath]);
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
    description: "Compile working or accepted manuscript and attempt DOCX: /PNW-compile [working|accepted]",
    handler: async (args: string, _ctx: any) => {
      const project = refreshProject();
      if (!project) {
        pi.sendMessage({ customType: "markdown", content: "No project loaded. Run /PNW-init first.", display: true });
        return;
      }

      pi.sendMessage({ customType: "markdown", content: "Compiling manuscript...", display: true });
      const mode = args.trim() || "working";
      if (mode !== "working" && mode !== "accepted") throw new Error("Use /PNW-compile working or /PNW-compile accepted");
      const output = exportManuscript(project, { mode });
      const mdPath = output.path;
      pi.sendMessage({ customType: "markdown", content: output.warnings.join("\n"), display: true });
      pi.sendMessage({ customType: "markdown", content: `Compiled manuscript saved to: ${mdPath}`, display: true });

      const docxPath = mdPath.replace(/\.md$/, ".docx");

      let hasPandoc = false;
      try {
        const checkRes = await pi.exec("pandoc", ["--version"]);
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
          display: true,
          details: { success: true, mdPath, pandocMissing: true }
        });
        return;
      }

      pi.sendMessage({ customType: "markdown", content: "Exporting to DOCX via Pandoc...", display: true });
      try {
        const cmdResult = await pi.exec("pandoc", [mdPath, "-o", docxPath]);
        if (cmdResult.code !== 0) {
           pi.sendMessage({
             customType: "novel-compile",
             content: `Compilation finished with pandoc error.`,
             display: true,
             details: { success: true, mdPath, hasPandoc: true, error: cmdResult.stderr || cmdResult.stdout }
           });
           return;
        }
        pi.sendMessage({
          customType: "novel-compile",
          content: `Compilation finished successfully.`,
          display: true,
          details: { success: true, mdPath, docxSuccess: true, docxPath }
        });
      } catch (err: any) {
        pi.sendMessage({
          customType: "novel-compile",
          content: `Compilation finished with exception.`,
          display: true,
          details: { success: true, mdPath, hasPandoc: true, error: err.message }
        });
      }
    }
  });
}
