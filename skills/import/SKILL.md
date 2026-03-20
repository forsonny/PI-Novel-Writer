---
name: import
description: Import an existing manuscript (DOCX, Markdown, or plain text) into the project structure
---

# Import Existing Manuscript

This skill helps you bring an existing manuscript into the novel project structure.

## Supported Formats

### Option A: DOCX Import (Requires Pandoc)

1. **Check Pandoc availability:**
   Run: `pandoc --version`
   If not installed:
   - **Windows:** `winget install --id JohnMacFarlane.Pandoc` (restart terminal after)
   - **macOS:** `brew install pandoc`
   - **Linux:** `sudo apt install pandoc`

2. **Convert DOCX to Markdown:**
   Use `pi.exec("bash", ["-c", "pandoc \"<input.docx>\" -o \"<output.md>\" --from docx --to markdown --wrap=none"])` to convert.

3. **Detect chapter breaks:**
   Read the converted markdown. Look for chapter headings:
   - `# Chapter X` or `## Chapter X` headings
   - `CHAPTER X` in all-caps lines
   - Numbered headings like `1.` or `I.`

4. **Split into scene files:**
   For each detected chapter, create the chapter directory under `manuscript/chapters/` and split scenes based on:
   - `***` or `---` scene break markers
   - Extra blank lines (3+) between sections
   - If no scene breaks are found, treat the whole chapter as one scene

5. **Generate frontmatter:**
   For each scene, create YAML frontmatter with chapter number, scene number, and status set to `"draft"` (since it's existing prose).

### Option B: Markdown Import

1. Ask the author for the path to their markdown file(s).
2. Read the file(s) using the built-in `read` tool.
3. Follow steps 3-5 from the DOCX workflow above.

### Option C: Plain Text Import

1. Ask the author for the path to their text file.
2. Read the file using the built-in `read` tool.
3. Use AI analysis to detect chapter/scene breaks:
   - Look for "Chapter" headings in any format
   - Look for scene break patterns (blank lines, asterisks, dashes)
   - Look for significant time/location shifts in the prose
4. **Interactive verification:** Show the detected breaks to the author:
   > "I detected 24 chapter breaks and 67 scene breaks. Here's a preview:
   > - Chapter 1: Lines 1-342 (3 scenes)
   > - Chapter 2: Lines 343-621 (2 scenes)
   > ...
   > Does this look right? Should I adjust any breaks?"
5. After confirmation, create the project structure and split the files.

## After Import

1. Update `project.json` with detected metadata (title, approximate word count).
2. Set all imported scenes to `"draft"` status.
3. Offer to run retroactive analysis:
   > "Would you like me to analyze your manuscript and generate:
   > - Character bible entries from the prose
   > - A working outline/beat sheet
   > - Chapter summaries for context"
   >
   > This uses the `retroactive-outline` skill (available after Phase 2).

## Important Notes

- **Backup first!** Always recommend the author keeps their original file.
- **Line endings:** All imported files are automatically normalized to LF (Unix-style).
- **Encoding:** Assumes UTF-8. If the file has special characters that look wrong, check encoding.
