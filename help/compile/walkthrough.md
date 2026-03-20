# /PNW-compile — Walkthrough

How to compile and export your manuscript at every stage.

---

## Part 1: Your First Compile

You do not need a finished novel to compile. Compile early and often to
review your manuscript as a continuous document — it reveals pacing and
structural issues that are invisible when working scene by scene.

### Scenario: You have finished drafting Chapter 1

```
/PNW-compile
```

Output:
```
Compiled manuscript saved to:
  exports/manuscript-20260320-143022.md
  Scenes included: 6
  Total words: 14,200
  Chapters: 1 (partial project)

Pandoc found. Converting to DOCX...
DOCX saved to:
  exports/manuscript-20260320-143022.docx
```

Open the `.docx` in Word, LibreOffice, or Google Docs to read Chapter 1
as a complete document without frontmatter clutter.

---

## Part 2: Compiling to Review Structure

One of the most useful things about compiling mid-draft is reading the
scene breaks and chapter transitions.

Look for:
- Do chapters feel like a satisfying unit?
- Are the `* * *` scene breaks in sensible places?
- Does the opening of each chapter hook you in?
- Are there scenes that feel redundant when read consecutively?

These structural observations are harder to make when you are editing scenes
individually. The compiled view shows the full shape.

---

## Part 3: Sharing with Beta Readers

When your draft is complete enough to share:

**Step 1 — Compile:**
```
/PNW-compile
```

**Step 2 — Find the output:**
```
exports/manuscript-20260320-143022.docx
```

**Step 3 — Share:**
Send the `.docx` file directly. It is a standard Word-compatible document.

If your readers prefer PDF, open the `.docx` in Word or LibreOffice and
export to PDF from there. Pandoc can also generate PDF directly, but
this requires a LaTeX installation — `.docx` is simpler for most uses.

---

## Part 4: Preparing a Final Submission Manuscript

Before compiling a submission draft:

1. **Advance all scenes to `final` status:**
   > "Mark all scenes in chapters 1 through 6 as final"

   The AI calls `novel_scene_status` for each scene.

2. **Verify scene statuses:**
   ```
   /PNW-status
   ```
   All chapters should show `[final]`.

3. **Update project metadata in `project.json`:**
   ```json
   {
     "title": "The Ember Gate",
     "author": "Your Name"
   }
   ```

4. **Compile:**
   ```
   /PNW-compile
   ```

5. **Inspect the output:**
   Open `exports/manuscript-{timestamp}.docx`. Check:
   - Title and author appear correctly in the document
   - All chapters are present in order
   - Scene breaks look clean
   - No frontmatter has leaked into the prose

---

## Part 5: Pandoc Is Not Installed

If you see:
```
Pandoc not found. Markdown compiled but DOCX export skipped.
Install Pandoc from: https://pandoc.org/installing.html
```

The compiled `.md` file is still useful:
- Open it in any Markdown viewer or editor
- Paste it into Google Docs (File > Import)
- Convert it using an online Markdown-to-DOCX tool

To install Pandoc:
- Windows: `winget install --id JohnMacFarlane.Pandoc` or download from pandoc.org
- macOS: `brew install pandoc`
- Linux: `sudo apt-get install pandoc` (or equivalent for your distro)

After installing, run `/PNW-compile` again.

---

## Part 6: Multiple Compiles Over Time

Each compile creates a timestamped file. Use this for:

**Tracking draft evolution:**
```
exports/manuscript-20260101-090000.md    <- first compile after chapter 1
exports/manuscript-20260210-140000.md    <- after chapter 3
exports/manuscript-20260315-093000.md    <- complete first draft
exports/manuscript-20260320-143000.docx  <- after first editing pass
```

**Diffing two versions:**
Use a text diff tool on the `.md` files to see what changed between compiles.
This is useful after a large editing pass to verify what was and was not changed.

---

## Part 7: When Compile Output Looks Wrong

### Scenes appear in wrong order

Scene files are sorted numerically by chapter, then scene number. If scenes
appear out of order:
- Check that chapter directory names are zero-padded numbers (`01`, `02`, etc.)
- Check that scene filenames are zero-padded (`scene-01.md`, `scene-02.md`)
- Run `novel_reindex` to resync frontmatter

### Chapter headings are missing

Chapter headings only appear in `novel` and `novella` workflows. If your
`project.json` has `"workflow": "short-story"`, headings are omitted by design.

### Frontmatter appears in the compiled output

This indicates a scene file has a malformed YAML block (missing closing `---`).
Run `novel_validate` to find the problematic file, fix the frontmatter, then
recompile.
