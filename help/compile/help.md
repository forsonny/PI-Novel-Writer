# /PNW-compile — Help Reference

Compile the entire manuscript into a single document and export it to DOCX.

---

## Command

### `/PNW-compile`

**Usage:**
```
/PNW-compile
```

**Parameters:** none

**What it does:**
1. Scans all scenes in canonical order (by chapter number, then scene number)
2. Assembles a Pandoc-format Markdown document:
   - YAML metadata block at the top (title, author, date)
   - Chapter headings before each chapter's first scene
   - Scene break markers (`* * *`) between scenes within a chapter
3. Saves the compiled Markdown to `exports/manuscript-{timestamp}.md`
4. Attempts to run `pandoc` to convert the Markdown to DOCX
5. Saves the DOCX to `exports/manuscript-{timestamp}.docx`
6. If Pandoc is not installed, shows installation instructions

**Requirements:**
- A project must be loaded
- For DOCX export: Pandoc must be installed (see `help/compile/resources.md`)

**When to use:**
- When you want a single readable document of your entire manuscript
- When sharing a draft with beta readers or editors
- When preparing a final manuscript for submission
- Periodically during drafting to review the full text as a continuous document

---

## What Scenes Are Included

The compiler includes scenes based on their status:

| Status    | Included in compile? |
|-----------|----------------------|
| outline   | No                   |
| draft     | Yes                  |
| revised   | Yes                  |
| polished  | Yes                  |
| final     | Yes                  |

Only scenes with prose content (status `draft` or higher) appear in the
compiled output. Outline-only scenes are skipped.

---

## Compiled Output Format

The compiled Markdown file looks like:

```markdown
---
title: The Ember Gate
author: Your Name
date: 2026-03-20
---

# Chapter 1: The Awakening

Chapter 1 prose here...

* * *

Chapter 1 scene 2 prose here...

* * *

Chapter 1 scene 3 prose here...

# Chapter 2: The Road to Ashenveil

Chapter 2 scene 1 prose here...
```

The scene frontmatter (YAML headers from individual scene files) is stripped
from the compiled output. Only prose bodies appear in the compiled document.

---

## AI-Callable Export Tools

### `compile_manuscript`

Assemble all scenes into a single ordered Markdown file.

**Parameters:** none

**Returns:**
```
Compiled manuscript saved to:
  exports/manuscript-20260320-143022.md
  Scenes included: 24
  Total words: 67,240
  Chapters: 6
```

**Error states:**
- `"No scenes with draft status or higher"` — nothing to compile yet
- File write errors indicate a permissions problem with `exports/`

---

### `export_docx`

Convert a compiled Markdown file to DOCX using Pandoc.

**Parameters:**

| Parameter    | Type   | Required | Description                          |
|--------------|--------|----------|--------------------------------------|
| `inputPath`  | string | yes      | Path to the compiled .md file        |
| `outputPath` | string | yes      | Path for the output .docx file       |

**Returns:**
```
DOCX exported successfully:
  exports/manuscript-20260320-143022.docx
```

**Error states:**
- `"Pandoc not found"` — install Pandoc; see `help/compile/resources.md`
- `"Pandoc conversion failed"` — check Pandoc installation and permissions

---

## Export Files

All compiled and exported files are saved to `exports/`:

```
exports/
  manuscript-20260320-143022.md       <- compiled Markdown
  manuscript-20260320-143022.docx     <- final DOCX
  manuscript-20260315-091005.md       <- previous compile
  manuscript-20260315-091005.docx     <- previous DOCX
```

Files are never deleted by the system. Old compiles accumulate. Delete
outdated files manually when the folder gets cluttered.

---

## Common Workflows

```
First draft complete:
  /PNW-compile    <- compile to review as a continuous document
  -> share .docx with beta readers

After editing pass:
  /PNW-compile    <- compile the revised version
  -> compare with previous compile in a diff tool

Final submission:
  Advance all scenes to "final" status
  /PNW-compile    <- clean compile of final-only scenes
  -> the .docx is your submission draft
```
