# /PNW-outline — Help Reference

Display the beat sheet and chapter outlines for the project.

---

## Command

### `/PNW-outline`

**Usage:**
```
/PNW-outline
```

**Parameters:** none

**What it does:**
1. Scans `outline/chapters/` for all chapter outline files
2. Reads the frontmatter of each file (chapter number, title, purpose)
3. Reads the first paragraph or key fields of each outline
4. Renders a summary of all chapters with their narrative purpose

**Requirements:** A project must be loaded (`/PNW-init` or `/PNW-load`)

**When to use:**
- After the outline-novel or outline-chapter skills to verify structure
- Before drafting a chapter to review what scenes are planned
- When the AI seems to be deviating from the planned structure
- At the start of an editing session to review the overall arc

---

## Dashboard Output

```
=== CHAPTER OUTLINES ===

Ch 1  The Awakening
  Purpose: Establish Elara's world, the Brotherhood's threat, and her
  motivation for leaving the Capital.
  Scenes: 6 planned   POV: Elara   Timeline: Day 1

Ch 2  The Road to Ashenveil
  Purpose: Introduce Sienna, deepen Elara's backstory, raise stakes
  through the Brotherhood encounter at Redford.
  Scenes: 4 planned   POV: Elara   Timeline: Days 2-4

Ch 3  The Brotherhood
  Purpose: Elara discovers the Brotherhood's true objective. Point of
  no return — she cannot go back to neutral.
  Scenes: 5 planned   POV: Elara (+ 1 Drath POV)   Timeline: Day 5

Total: 3 chapter outlines  |  15 scenes planned
```

---

## AI-Callable Outline Tools

### `outline_chapter_create`

Create or regenerate a chapter outline file.

**Parameters:**

| Parameter              | Type     | Required | Description                                    |
|------------------------|----------|----------|------------------------------------------------|
| `chapter`              | number   | yes      | Chapter number (1-based)                       |
| `title`                | string   | yes      | Chapter title                                  |
| `pov`                  | string   | no       | Point-of-view character(s)                     |
| `locations`            | string[] | no       | Locations featured in this chapter             |
| `timeline`             | string   | no       | Timeline position (e.g. "Days 2-4")            |
| `purpose`              | string   | no       | Narrative purpose — what this chapter achieves |
| `targetWordCount`      | number   | no       | Target word count for this chapter             |
| `emotional_arc_enter`  | string   | no       | Character emotional state at chapter start     |
| `emotional_arc_exit`   | string   | no       | Character emotional state at chapter end       |
| `plot_threads_advanced`| string[] | no       | Plot threads that advance in this chapter      |
| `scenes`               | number   | no       | Number of scenes planned                       |
| `body`                 | string   | no       | Full outline prose (scene-by-scene breakdown)  |

**File created:** `outline/chapters/{ch}-{title}.md`

---

### `outline_chapter_read`

Read a chapter outline.

**Parameters:**

| Parameter | Type   | Required | Description         |
|-----------|--------|----------|---------------------|
| `chapter` | number | yes      | Chapter number      |

**Returns:** Full frontmatter + outline body.

---

### `outline_chapter_update`

Replace the prose body of a chapter outline (frontmatter is preserved).

**Parameters:**

| Parameter | Type   | Required | Description            |
|-----------|--------|----------|------------------------|
| `chapter` | number | yes      | Chapter number         |
| `body`    | string | yes      | New prose outline body |

---

### `outline_scene_card_create`

Add or update a scene-level card within a chapter outline.

**Parameters:**

| Parameter | Type   | Required | Description                            |
|-----------|--------|----------|----------------------------------------|
| `chapter` | number | yes      | Chapter number                         |
| `scene`   | number | yes      | Scene number within chapter            |
| `content` | string | yes      | Scene card content (goal, conflict, etc.)|

**What it does:**
- Finds or creates the scene section in the outline file
- Overwrites it with the provided content
- Preserves all other scene sections in the file

---

### `outline_chapter_reorder`

Rename a chapter and move its outline and manuscript files.

**Parameters:**

| Parameter    | Type   | Required | Description         |
|--------------|--------|----------|---------------------|
| `oldChapter` | number | yes      | Current chapter number |
| `newChapter` | number | yes      | New chapter number  |

**What it does:**
- Renames `outline/chapters/{old}-*.md` to `{new}-*.md`
- Renames `manuscript/chapters/{old}/` to `{new}/`
- Updates frontmatter in all scene files to reflect new chapter number
- Returns a list of all moved files

**Warning:** Run `novel_validate` after reordering to confirm all scene
frontmatter was updated correctly.

---

## Outline Structure

A well-structured chapter outline includes:

```markdown
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

## Overview

Chapter 3 transitions Elara from passive observer to active participant in
the Brotherhood's agenda. The chapter opens with her surveillance of the
outpost and ends with her in possession of information she cannot un-know.

## Scene Breakdown

### Scene 1 — The Watcher
Elara observes the outpost from the treeline. Brotherhood soldiers sort
refugees, separating those with "useful skills." Goal: establish scale of
Brotherhood operation. Conflict: Elara sees someone she recognizes.

### Scene 2 — The Infiltration
Elara disguises herself as a refugee to enter the outpost. Goal: reach
the records room. Conflict: Drath is present, not at the capital as expected.

...
```

---

## Common Workflows

```
After outline-novel skill:
  /PNW-outline     <- verify all chapters have outlines

Before drafting a chapter:
  Ask AI: "Read the outline for chapter 3"   <- review scene breakdown
  Ask AI: "Run the draft-scene skill"        <- begin writing

After structural changes:
  outline_chapter_reorder(2, 5)              <- move chapter
  /PNW-outline                               <- verify new order

After drafting reveals outline gaps:
  Ask AI: "Run the retroactive-outline skill"  <- generate outline from scenes
```
