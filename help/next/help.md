# /PNW-next — Help Reference

Detect your current workflow stage and get specific, actionable next steps.

---

## Command

### `/PNW-next`

**Usage:**
```
/PNW-next
```

**Parameters:** none

**What it does:**
1. Reads the current project state (scenes, bible, outlines, summaries, suggestions)
2. Determines which of 9 workflow stages you are in
3. Displays your current stats (word count, scene count, bible entries, etc.)
4. Shows the 2-4 most relevant next steps with specific commands

**Requirements:** A project must be loaded (`/PNW-init` or `/PNW-load`)

**When to use:**
- At the start of every session — the best single command to orient yourself
- After completing a major milestone (finished a chapter, completed an editing pass)
- When you are not sure what to do next
- When returning to a project after a long break

---

## Workflow Stages

### Stage 1: No project loaded

```
No project is active.

  /PNW-init           start a new novel project here
  /PNW-load <path>    load an existing project
```

---

### Stage 2: Project ready — begin planning

```
Project loaded. No bible entries, no outline, no draft scenes.

Current state:
  Scenes:        0 (0 drafted)
  Bible entries: 0
  Word count:    0

Recommended next steps:
  Ask AI: "Run the getting-started skill"    guided setup tour
  Ask AI: "Run the premise skill"            develop your story concept
  Ask AI: "Run the world-building skill"     start building your world
```

---

### Stage 3: Bible started — create outline

```
Bible entries exist but no chapter outlines yet.

Current state:
  Bible entries: 8 (4 characters, 3 locations, 1 world)
  Scenes:        0 (0 drafted)

Recommended next steps:
  Ask AI: "Run the outline-novel skill"      create beat sheet
  Ask AI: "Run the character-interview skill" deepen character entries
  /PNW-bible                                 review existing entries
```

---

### Stage 4: Outlined — begin drafting

```
Chapter outlines exist but no scenes drafted yet.

Current state:
  Bible entries: 8
  Chapters outlined: 6 (32 scenes planned)
  Words drafted:     0

Recommended next steps:
  Ask AI: "Run the draft-scene skill"        begin writing
  Ask AI: "Read the outline for chapter 1"   review before drafting
  /PNW-sprint                                start a timed session
```

---

### Stage 5: Drafting — summaries need updating

```
Scenes are drafted but summaries are stale or missing.
The AI may have incomplete context for recent events.

Current state:
  Scenes drafted:    14
  Missing summaries: 3
  Stale summaries:   2

Recommended next steps:
  /PNW-summarize    refresh all stale/missing summaries
  /PNW-progress     check your word count progress
```

---

### Stage 6: Drafting in progress

```
Active drafting phase. Project is in good health.

Current state:
  Word count:         42,310 / 120,000  (35%)
  Scenes drafted:     24
  Chapters complete:  3 / 8
  Daily goal:         847 / 1,000 today

Recommended next steps:
  /PNW-sprint                            continue drafting
  Ask AI: "Run the draft-scene skill"    draft the next scene
  /PNW-status                            full dashboard view
```

---

### Stage 7: First draft complete — begin editing

```
All scenes are drafted. Ready for the first editing pass.

Current state:
  Word count:    88,420 / 90,000
  Scenes total:  62 (all draft status or higher)
  Suggestions:   0 pending

Recommended next steps:
  /PNW-edit                                  enter editing mode
  Ask AI: "Run the dev-edit skill on chapter 1"
  /PNW-summarize                             refresh summaries before editing
```

---

### Stage 8: Editing in progress

```
Editing is underway.

Current state:
  Scenes revised:   18 / 62
  Scenes polished:   4 / 62
  Pending edits:    12

Recommended next steps:
  /PNW-suggestions            review pending suggestions
  /PNW-edit                   continue editing pass
  Ask AI: "Run the line-edit skill on chapter N"
```

---

### Stage 9: Ready to export

```
All scenes are polished or final. Ready to compile.

Current state:
  Scenes final:     62 / 62
  Pending edits:     0
  Word count:       91,240

Recommended next steps:
  /PNW-compile    generate final DOCX manuscript
```

---

## Stage Detection Logic

`/PNW-next` determines your stage by checking these conditions in order:

| Check                                          | Stage |
|------------------------------------------------|-------|
| No project loaded                              | 1     |
| 0 bible entries AND 0 outlines AND 0 scenes    | 2     |
| Bible entries exist, 0 outlines                | 3     |
| Outlines exist, 0 drafted scenes               | 4     |
| Drafted scenes exist AND stale/missing summaries| 5    |
| Drafted scenes, summaries current, draft < 100% | 6   |
| All scenes drafted, 0 revised or polished      | 7     |
| Some scenes revised/polished, pending edits > 0| 8    |
| All scenes polished or final, 0 pending edits  | 9     |
