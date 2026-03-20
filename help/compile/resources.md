# /PNW-compile — Resources

Technical reference for the compilation algorithm and Pandoc integration.

---

## Compilation Algorithm

```
1. Load all scenes from p.scenes
2. Filter to scenes with status != "outline"
3. Sort by chapter ASC, then scene ASC
4. Build Pandoc YAML metadata block:
     ---
     title: {project.title}
     author: {project.author}
     date: {current date}
     ---
5. For each chapter group:
   a. If workflow is "novel" or "novella":
      Emit "# Chapter N: {chapter title}"
      (Chapter title read from outline/chapters/{ch}-*.md frontmatter)
   b. For each scene in chapter:
      - Strip YAML frontmatter from scene file (everything between --- delimiters)
      - Emit prose body
      - If not last scene in chapter: emit "* * *"
6. Write to exports/manuscript-{timestamp}.md
7. Attempt Pandoc DOCX conversion
```

---

## Pandoc Command

The DOCX export calls:

```bash
pandoc \
  --from markdown \
  --to docx \
  --output "{outputPath}" \
  "{inputPath}"
```

No custom reference doc is used by default. For custom formatting (fonts,
margins, styles), create a `reference.docx` and pass it:

```bash
pandoc \
  --from markdown \
  --to docx \
  --reference-doc reference.docx \
  --output "{outputPath}" \
  "{inputPath}"
```

This is not built into the compile command — you would need to call
`export_docx` directly with the reference doc path if you add this
customization to the tool.

---

## Pandoc Installation

### Windows (recommended)

```
winget install --id JohnMacFarlane.Pandoc
```

Or download the installer from: https://pandoc.org/installing.html

### macOS

```
brew install pandoc
```

### Ubuntu/Debian Linux

```
sudo apt-get install pandoc
```

### Verify installation

```
pandoc --version
```

---

## Output File Naming

```
exports/manuscript-{YYYYMMDD}-{HHmmss}.md
exports/manuscript-{YYYYMMDD}-{HHmmss}.docx
```

The timestamp is in the local time zone at compile time.

---

## Workflow Type Behavior

| `project.json` workflow | Chapter headings | Scene breaks |
|-------------------------|------------------|--------------|
| `novel`                 | Yes              | `* * *`      |
| `novella`               | Yes              | `* * *`      |
| `short-story`           | No               | `* * *`      |

For `short-story`, the output is a single continuous document with scene
breaks but no chapter structure.

---

## Tool Reference

### `/PNW-compile` command

| Field          | Detail                                              |
|----------------|-----------------------------------------------------|
| Registered in  | `extensions/novel-export.ts`                        |
| Description    | Compile manuscript and attempt DOCX export          |
| Usage          | `/PNW-compile`                                      |
| Side effect    | Writes files to `exports/`                          |

### `compile_manuscript`

| Field          | Detail                                              |
|----------------|-----------------------------------------------------|
| Registered in  | `extensions/novel-export.ts`                        |
| Label          | Compile Manuscript                                  |
| Input          | none                                                |
| Output         | Path to compiled .md file and stats                 |
| Side effect    | Writes `exports/manuscript-{timestamp}.md`          |

### `export_docx`

| Field          | Detail                                              |
|----------------|-----------------------------------------------------|
| Registered in  | `extensions/novel-export.ts`                        |
| Label          | Export DOCX                                         |
| Input          | inputPath, outputPath                               |
| Output         | Path to output .docx file                           |
| Side effect    | Runs `pandoc`; writes `exports/manuscript-{timestamp}.docx` |

---

## Related Files

| File                          | Purpose                                          |
|-------------------------------|--------------------------------------------------|
| `extensions/novel-export.ts`  | Compile and export tools; /PNW-compile command   |
| `exports/`                    | Output directory for compiled files              |
| `project.json`                | Title, author, workflow used in compiled output  |
| `manuscript/chapters/`        | Source scene files                               |
| `outline/chapters/`           | Chapter titles for headings                      |
