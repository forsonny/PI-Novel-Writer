# /PNW-init — Help Reference

Initialize a new novel project in the current working directory.

---

## Command

### `/PNW-init`

Set up a fresh novel project with all required directories, configuration, and
starter files.

**Usage:**
```
/PNW-init
/PNW-init --quick
```

**What it does:**
1. Creates `project.json` with default configuration
2. Builds the full directory structure (manuscript, bible, outline, summaries, exports, etc.)
3. Generates `system/SYSTEM.md` — the AI system prompt for this project
4. Generates `system/AGENTS.md` — role definitions from the template
5. Creates Chapter 1 directory inside `manuscript/chapters/`
6. Creates the opening scene file `scene-01.md` with default frontmatter
7. Emits `novel:project-loaded` to register the project in memory

**Options:**

| Flag      | Effect                                                            |
|-----------|-------------------------------------------------------------------|
| `--quick` | Minimal setup: creates project.json and directories only; skips  |
|           | SYSTEM.md and AGENTS.md generation; useful for import workflows  |

**Requirements:**
- No pre-existing `project.json` in the current directory (init will warn if one exists)
- The current directory should be the intended project root

**When to use:**
- Starting a completely new novel from scratch
- Beginning a project after running the `getting-started` skill
- Before any other `/PNW-*` command — init is always first

**Error states:**
- `"project.json already exists"` — a project is already initialized here;
  use `/PNW-load` instead to load it, or delete `project.json` to re-init
- Directory creation errors indicate a permissions problem with the working directory

---

## AI-Callable Tools (registered alongside /PNW-init)

These tools become available after a project is loaded. Init triggers the project load event
that makes all scene, bible, and outline tools active.

### `novel_project_info`

Read the current `project.json`.

**Parameters:** none

**Returns:**
```json
{
  "title": "Untitled",
  "author": "",
  "genre": "fantasy",
  "targetWordCount": 90000,
  "workflow": "novel",
  "settings": { ... }
}
```

**When the AI calls it:**
- When asked for project metadata
- At the start of planning sessions to confirm current configuration

### `novel_scene_create`

Create a new scene file with YAML frontmatter.

**Parameters:**

| Parameter           | Type     | Required | Description                                      |
|---------------------|----------|----------|--------------------------------------------------|
| `chapter`           | number   | yes      | Chapter number (1-based)                         |
| `title`             | string   | no       | Scene title                                      |
| `pov`               | string   | no       | Point-of-view character name                     |
| `location`          | string   | no       | Setting for this scene                           |
| `timeline`          | string   | no       | Timeline position (e.g. "Day 3, morning")        |
| `characters_present`| string[] | no       | List of characters in the scene                  |

**What it does:**
- Auto-numbers the scene by scanning existing files in the chapter directory
- Creates `manuscript/chapters/{ch}/scene-{sc}.md` with populated frontmatter
- Returns the path of the created file

### `novel_validate`

Scan all scene files for frontmatter issues (missing required fields, bad format).

**Parameters:**

| Parameter | Type    | Required | Description                                      |
|-----------|---------|----------|--------------------------------------------------|
| `fix`     | boolean | no       | If true, attempt to auto-correct detectable issues|

**Returns:** A report listing any problems found, or "All scenes valid."

### `novel_reindex`

Rewrite all scene frontmatter `chapter` and `scene` fields to match their file path positions.
Run this after manually moving or renaming scene files.

**Parameters:** none

---

## Project.json Structure

`project.json` is created at init time with these default fields:

```json
{
  "title": "Untitled",
  "author": "",
  "genre": "fantasy",
  "targetWordCount": 90000,
  "workflow": "novel",
  "createdAt": "<ISO timestamp>",
  "settings": {
    "contextBudget": {
      "system":       3000,
      "bible":        3000,
      "summaries":    5000,
      "outline":      3000,
      "recentProse":  2000,
      "currentScene": 3000,
      "voiceProfile":  500
    },
    "autoSummary": {
      "enabled": false,
      "threshold": 500
    }
  }
}
```

Edit this file directly to change project metadata, word count targets, or context budgets.

---

## Common Workflows After Init

```
/PNW-init
  -> Ask AI to run "getting-started" skill    (guided setup tour)
  -> Ask AI to run "premise" skill            (develop your story concept)
  -> Ask AI to run "world-building" skill     (create bible entries)
  -> /PNW-bible                               (verify entries were created)
  -> Ask AI to run "outline-novel" skill      (build beat sheet)
  -> /PNW-outline                             (verify chapters outlined)
  -> Ask AI to run "draft-scene" skill        (begin writing)
```
