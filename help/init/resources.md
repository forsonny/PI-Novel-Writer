# /PNW-init — Resources

Technical reference for project initialization internals.

---

## Directory Structure Created

```
<project-root>/
  project.json
  system/
    SYSTEM.md
    AGENTS.md
  manuscript/
    chapters/
      01/
        scene-01.md
  bible/
    characters/
    locations/
    items/
    factions/
    world/
  outline/
    chapters/
  summaries/
    scenes/
    chapters/
    acts/
  exports/
  notes/
    deleted-scenes/
    deleted-bible/
  continuity/
    facts.json
    character-states.json
  timeline/
    timeline.json
  .pi/
    progress.json
```

---

## project.json Schema

```json
{
  "title":           "string — novel title",
  "author":          "string — author name",
  "genre":           "string — genre tag",
  "targetWordCount": "number — total word count goal",
  "workflow":        "novel | novella | short-story",
  "createdAt":       "ISO 8601 timestamp",
  "settings": {
    "contextBudget": {
      "system":        "number (tokens) — system prompt budget",
      "bible":         "number (tokens) — bible injection budget",
      "summaries":     "number (tokens) — summary injection budget",
      "outline":       "number (tokens) — outline injection budget",
      "recentProse":   "number (tokens) — recent prose budget",
      "currentScene":  "number (tokens) — current scene budget",
      "voiceProfile":  "number (tokens) — voice profile budget"
    },
    "autoSummary": {
      "enabled":   "boolean — auto-trigger summary after scene write",
      "threshold": "number — word count change to trigger auto-summary"
    }
  }
}
```

All `contextBudget` values are in estimated tokens (1 token ~= 4 characters).
Increasing a budget for one section reduces the available budget for others.

---

## Opening Scene Frontmatter

`manuscript/chapters/01/scene-01.md` is created with this default frontmatter:

```yaml
---
chapter: 1
scene: 1
title: Opening Scene
status: outline
pov: ""
location: ""
timeline: ""
characters_present: []
word_count: 0
created: <ISO timestamp>
updated: <ISO timestamp>
---
```

Scene status must progress through these values in order:
```
outline -> draft -> revised -> polished -> final
```

---

## Scene File Naming Convention

```
manuscript/chapters/{chapter}/scene-{scene}.md
```

Both `{chapter}` and `{scene}` are zero-padded to 2 digits:

```
manuscript/chapters/01/scene-01.md    chapter 1, scene 1
manuscript/chapters/03/scene-07.md    chapter 3, scene 7
manuscript/chapters/12/scene-02.md    chapter 12, scene 2
```

Chapter directories are named with the chapter number only (no title in path).
Titles live in outline files and scene frontmatter.

---

## SYSTEM.md Template

The generated `system/SYSTEM.md` includes:

- Project metadata block (title, author, genre)
- PI novel-writer tool inventory
- Summary file location conventions
- Scene frontmatter field definitions
- Status workflow documentation
- Context injection documentation
- Bible file format
- Outline file format

Edit freely after init. The file is re-read at the start of each turn.

---

## Event Emitted

On successful init, the extension emits:

```
novel:project-loaded
  -> registers project in pi memory
  -> scans manuscript/ and populates scene index
  -> makes all tools (scene, bible, outline, summary) available
```

---

## Tool Reference

### `/PNW-init` command

| Field          | Detail                                           |
|----------------|--------------------------------------------------|
| Registered in  | `extensions/novel-core.ts`                       |
| Description    | Initialize a new novel project                   |
| Usage          | `/PNW-init` or `/PNW-init --quick`               |
| Side effect    | Creates files and emits `novel:project-loaded`   |

### `novel_project_info`

| Field          | Detail                                           |
|----------------|--------------------------------------------------|
| Registered in  | `extensions/novel-core.ts`                       |
| Label          | Read Project Info                                |
| Input          | none                                             |
| Output         | Parsed contents of `project.json`                |

### `novel_reindex`

| Field          | Detail                                           |
|----------------|--------------------------------------------------|
| Registered in  | `extensions/novel-core.ts`                       |
| Label          | Reindex Scenes                                   |
| Input          | none                                             |
| Output         | Count of scenes updated; list of changes         |
| Side effect    | Rewrites frontmatter fields `chapter` and `scene`|

---

## Related Files

| File                          | Purpose                                         |
|-------------------------------|-------------------------------------------------|
| `extensions/novel-core.ts`   | Init command and scene/project tools            |
| `project.json`               | Project config (created by init)                |
| `system/SYSTEM.md`           | AI system prompt (created by init)              |
| `system/AGENTS.md.template`  | Agent role template used to generate AGENTS.md  |
| `help/load/help.md`          | Loading an existing project                     |
| `help/status/help.md`        | Checking project health after init              |
