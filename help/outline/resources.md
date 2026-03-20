# /PNW-outline — Resources

Technical reference for outline file format, storage, and injection.

---

## File Structure

```
<project-root>/
  outline/
    chapters/
      01-The-Awakening.md
      02-The-Road-to-Ashenveil.md
      03-The-Brotherhood.md
      04-Ember-Gate.md
```

**Filename format:** `{chapter}-{title}.md`
- Chapter is zero-padded to 2 digits
- Title spaces replaced with `-`
- Example: `03-The-Brotherhood.md`

---

## Outline File Format

```yaml
---
chapter: 3
title: The Brotherhood
pov: Elara Voss
locations:
  - Ashenveil
  - Brotherhood Outpost
timeline: Day 5
purpose: "Elara discovers the Brotherhood's true objective. Point of no return."
targetWordCount: 8000
emotional_arc_enter: cautious optimism
emotional_arc_exit: resolute dread
plot_threads_advanced:
  - Brotherhood conspiracy
  - Elara's guilt
scenes: 5
---

[Chapter outline prose body here]
```

---

## Frontmatter Schema

| Field                   | Type     | Required | Description                               |
|-------------------------|----------|----------|-------------------------------------------|
| `chapter`               | number   | yes      | Chapter number (1-based)                  |
| `title`                 | string   | yes      | Chapter title                             |
| `pov`                   | string   | no       | POV character(s)                          |
| `locations`             | string[] | no       | Featured locations                        |
| `timeline`              | string   | no       | When in story time this chapter occurs    |
| `purpose`               | string   | no       | Narrative purpose (1-2 sentences)         |
| `targetWordCount`       | number   | no       | Planned word count for this chapter       |
| `emotional_arc_enter`   | string   | no       | Character emotional state entering chapter|
| `emotional_arc_exit`    | string   | no       | Character emotional state leaving chapter |
| `plot_threads_advanced` | string[] | no       | Plot threads that move forward here       |
| `scenes`                | number   | no       | Planned scene count                       |

---

## Context Injection

Chapter outlines are injected in the `[STORY CONTEXT]` block:

```
[STORY CONTEXT]
--- CHAPTER OUTLINES ---
[chapter:03] The Brotherhood
  Purpose: Elara discovers the Brotherhood's true objective...
  Timeline: Day 5
  [Scene 1] The Watcher: Elara observes the outpost...
  [Scene 2] The Infiltration: ...
```

**Budget:** Controlled by `contextBudget.outline` in `project.json` (default: 3000 tokens).

Only the outline for the current chapter (or the chapter being drafted) is typically
injected. If budget allows, the next chapter's outline is also included.

---

## Tool Reference

### `/PNW-outline` command

| Field          | Detail                                            |
|----------------|---------------------------------------------------|
| Registered in  | `extensions/novel-bible.ts`                       |
| Description    | Show beat sheet and chapter outline summary       |
| Usage          | `/PNW-outline`                                    |
| Side effect    | Read-only                                         |

### `outline_chapter_create`

| Field          | Detail                                            |
|----------------|---------------------------------------------------|
| Registered in  | `extensions/novel-bible.ts`                       |
| Label          | Create Chapter Outline                            |
| Input          | chapter, title, pov?, locations?, timeline?, etc. |
| Output         | Path of created/overwritten file                  |
| Side effect    | Writes outline file                               |

### `outline_chapter_read`

| Field          | Detail                                            |
|----------------|---------------------------------------------------|
| Registered in  | `extensions/novel-bible.ts`                       |
| Label          | Read Chapter Outline                              |
| Input          | chapter                                           |
| Output         | Full frontmatter + body                           |

### `outline_chapter_update`

| Field          | Detail                                            |
|----------------|---------------------------------------------------|
| Registered in  | `extensions/novel-bible.ts`                       |
| Label          | Update Chapter Outline                            |
| Input          | chapter, body                                     |
| Output         | Confirmation                                      |
| Side effect    | Overwrites prose body; preserves frontmatter      |

### `outline_scene_card_create`

| Field          | Detail                                            |
|----------------|---------------------------------------------------|
| Registered in  | `extensions/novel-bible.ts`                       |
| Label          | Create Scene Card                                 |
| Input          | chapter, scene, content                           |
| Output         | Confirmation                                      |
| Side effect    | Upserts scene section in outline file             |

### `outline_chapter_reorder`

| Field          | Detail                                            |
|----------------|---------------------------------------------------|
| Registered in  | `extensions/novel-bible.ts`                       |
| Label          | Reorder Chapter                                   |
| Input          | oldChapter, newChapter                            |
| Output         | List of moved files                               |
| Side effect    | Renames outline + manuscript dirs; updates frontmatter |

---

## Related Files

| File                         | Purpose                                          |
|------------------------------|--------------------------------------------------|
| `extensions/novel-bible.ts`  | All outline tools and /PNW-outline command       |
| `outline/chapters/`          | Chapter outline files                            |
| `help/bible/help.md`         | Bible entries (complementary to outlines)        |
| `help/init/resources.md`     | Directory structure created on init              |
