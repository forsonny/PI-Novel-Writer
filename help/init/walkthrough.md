# /PNW-init — Walkthrough

Step-by-step guide for initializing a novel project.

---

## Part 1: Before You Init

### What directory should I be in?

The directory you run `/PNW-init` in becomes the project root. Every file the
system creates — `project.json`, `manuscript/`, `bible/`, `outline/`, etc. —
will live here.

**Recommended structure:**
```
C:/novels/
  my-novel/          <- init here
  another-project/
```

If you are using pi from the terminal, navigate to your intended project root
before starting. If you are using pi as a desktop app, it uses the directory
you opened pi in.

### Can I init in a non-empty directory?

Yes, as long as there is no existing `project.json`. The init command only
creates new files and directories; it will not overwrite existing ones.

---

## Part 2: Running /PNW-init

### Scenario: Fresh project, full setup

**Step 1 — Run:**
```
/PNW-init
```

**What you will see:**
The AI reports each item created in order:
- `project.json` created
- Directories created: manuscript, bible, outline, summaries, exports, notes, continuity, etc.
- `system/SYSTEM.md` generated
- `system/AGENTS.md` generated
- Chapter 1 directory created
- Opening scene `manuscript/chapters/01/scene-01.md` created

**Step 2 — Verify:**
```
/PNW-status
```
You should see 0 words, 1 scene (status: outline), and a warning that no bible
entries exist yet.

**Step 3 — Begin planning:**
Ask the AI: "Run the getting-started skill"

---

### Scenario: Quick init for importing an existing manuscript

If you have scenes already written elsewhere and want to import them, skip the
template generation:

**Step 1 — Run:**
```
/PNW-init --quick
```

This creates `project.json` and the directory skeleton without writing the
AI system prompt templates. Useful when you will provide your own SYSTEM.md.

**Step 2 — Import your content:**
Ask the AI: "Run the import skill"

---

### Scenario: You already have a project.json

If you run `/PNW-init` in a directory that already has `project.json`, the
command will warn you and stop. This is intentional — re-running init on an
existing project would overwrite your configuration.

**If you want to reload the project:**
```
/PNW-load
```

**If you want to reset everything:**
Delete `project.json` manually, then run `/PNW-init`.

---

## Part 3: What Gets Created

After a full `/PNW-init`, your directory contains:

```
<project-root>/
  project.json                    <- project config and metadata
  system/
    SYSTEM.md                     <- AI system prompt (edit to customize AI behavior)
    AGENTS.md                     <- role definitions for writing/editing agents
  manuscript/
    chapters/
      01/
        scene-01.md               <- opening scene (status: outline)
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

## Part 4: Customizing project.json

After init, edit `project.json` to set your novel's metadata before writing.

**Minimum recommended edits:**

```json
{
  "title": "The Ember Gate",
  "author": "Your Name",
  "genre": "fantasy",
  "targetWordCount": 120000
}
```

**Workflow options:**
- `"novel"` — full chapter headings, scene breaks, standard export
- `"novella"` — same as novel but lighter structure
- `"short-story"` — single document, no chapter headings

---

## Part 5: Editing SYSTEM.md

`system/SYSTEM.md` is the AI's system prompt. It is injected automatically at
the start of every conversation turn. Customize it to:
- Define your novel's tone, world rules, and genre expectations
- Set POV and tense conventions
- Include specific instructions for the writing AI

**Example additions to SYSTEM.md:**
```markdown
## Tone
Dark and atmospheric. Avoid modern idioms. Prose is third-person limited.

## World Rules
Magic costs physical memory — each casting permanently erases a personal
recollection. The AI should never portray magic as cost-free.
```

---

## Part 6: The Full New-Project Flow

```
1.  /PNW-init
2.  Edit project.json (title, author, genre, word count target)
3.  Edit system/SYSTEM.md (tone, world rules, POV conventions)
4.  Ask AI: "Run the premise skill"
5.  Ask AI: "Run the world-building skill"
6.  Ask AI: "Run the character-interview skill" (for each main character)
7.  /PNW-bible  <- confirm all entries were created
8.  Ask AI: "Run the outline-novel skill"
9.  Ask AI: "Run the outline-chapter skill" (for each chapter)
10. /PNW-outline  <- confirm all chapters have outlines
11. Ask AI: "Run the draft-scene skill" (repeat for each scene)
12. /PNW-summarize <ch> <sc>  <- after each drafted scene
13. /PNW-progress  <- track your word count
```
