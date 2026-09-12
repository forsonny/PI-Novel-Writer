---
name: import
description: Import an existing manuscript (DOCX, Markdown, or plain text) into a format-aware fiction project
---

# Import Existing Manuscript

This skill helps you bring an existing manuscript into the project structure.

Before splitting the source, use `novel_project_info` to confirm the project format. Prefer `novel_scene_list` and `novel_scene_read` when inspecting imported project prose rather than assuming a manuscript path:
- **novel / novella:** chapters containing scenes under `manuscript/chapters/`
- **short-story:** flat scenes under `manuscript/scenes/`
- **flash-fiction:** one story at `manuscript/story.md`

## Supported Formats

### Option A: DOCX Import (Requires Pandoc)

1. **Check Pandoc availability:**
   Run: `pandoc --version`
   If not installed:
   - **Windows:** `winget install --id JohnMacFarlane.Pandoc` (restart terminal after)
   - **macOS:** `brew install pandoc`
   - **Linux:** `sudo apt install pandoc`

2. **Convert DOCX to Markdown:**
   Run Pandoc through the available execution tool with separate arguments; do not construct a shell command from an untrusted path.

3. **Detect structural breaks for the project format:**
   - **Novel / novella:** detect chapter headings such as `# Chapter X`, `CHAPTER X`, numbered headings, or Roman numerals; then detect scene breaks within each chapter.
   - **Short story:** ignore chapter hierarchy and detect only scene breaks.
   - **Flash fiction:** keep the source as one story unless the author chooses another format.

4. **Split into project scenes:**
   Use `***`, `---`, three or more blank lines, and meaningful time or location shifts as evidence of scene breaks. If no scene break is found, keep the current story unit as one scene.

5. **Store the imported prose:**
   Prefer `novel_scene_create` followed by `novel_scene_write`, then set each imported scene to `"draft"` with `novel_scene_status`. Use its actual chapter number for novels and novellas; use chapter 1 as the action address for short stories and flash fiction. The actions place prose in the format-appropriate manuscript layout.

### Option B: Markdown Import

1. Ask the author for the path to their markdown file(s).
2. Read the file(s) using the built-in `read` tool.
3. Follow steps 3-5 from the DOCX workflow above, using the project's format.

### Option C: Plain Text Import

1. Ask the author for the path to their text file.
2. Read the file using the built-in `read` tool.
3. Use AI analysis to detect the structural breaks appropriate to the project format:
   - For novels and novellas, look for chapter headings and scene breaks.
   - For short stories, look only for scene breaks.
   - For flash fiction, preserve one story.
   - Use blank lines, asterisks, dashes, and significant time or location shifts as evidence.
4. **Interactive verification:** Show the detected chapters and scenes for a novel or novella, scenes for a short story, or the single story for flash fiction. Ask the author to confirm or adjust the proposed breaks.
5. After confirmation, store the prose through the scene creation, writing, and status actions described above.

## After Import

1. Update project settings only with stable detected metadata such as the title. Do not store an approximate or current manuscript word count in project settings; `novel_scene_list` computes current scene word counts from the prose.
2. Confirm all imported scenes have `"draft"` status with `novel_scene_list`.
3. Offer to run retroactive analysis:
   > "Would you like me to analyze your manuscript and generate:
   > - Character bible entries from the prose
   > - A working outline/beat sheet
   > - Scene summaries and, where applicable, chapter summaries for context"
   >
   > This uses the `retroactive-outline` skill (available after Phase 2).

## Important Notes

- **Backup first!** Always recommend the author keeps their original file.
- **Line endings:** Scene writes through the novel tools normalize line endings. Directly imported source files may retain their original endings.
- **Encoding:** Assumes UTF-8. If the file has special characters that look wrong, check encoding.
