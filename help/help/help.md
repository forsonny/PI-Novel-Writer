# /PNW-help — Help Reference

Display all available commands grouped by workflow stage.

---

## Command

### `/PNW-help`

**Usage:**
```
/PNW-help
```

**Parameters:** none

**What it does:**
Displays a compact reference of all `/PNW-*` commands organized into two
workflow sections: Setup/Dashboard and Writing/Editing. Each entry shows
the command name, its brief description, and a usage example.

**Requirements:** None — this command works even when no project is loaded.

**When to use:**
- When you forget a command name or its syntax
- When introducing a new writer to the tool
- As a quick orientation at the start of a session

---

## Help Output

```
=== pi-novel-writer commands ===

SETUP / DASHBOARD
  /PNW-init              Initialize a new novel project
  /PNW-load [path]       Load existing project
  /PNW-status            Project dashboard
  /PNW-progress          Word count progress
  /PNW-next              What to do next
  /PNW-help              This help menu

WRITING / EDITING
  /PNW-bible             List bible entries
  /PNW-outline           Show chapter outlines
  /PNW-sprint [min]      Timed writing sprint (default 25m)
  /PNW-summarize         Refresh summaries
  /PNW-edit              Enter editing mode
  /PNW-suggestions       View pending edits
  /PNW-compile           Compile and export DOCX
```

---

## Beyond the Help Command

`/PNW-help` shows the command list. For deeper documentation:

| Resource                      | How to access                         |
|-------------------------------|---------------------------------------|
| Command reference             | `help/{command}/help.md`              |
| Step-by-step walkthroughs     | `help/{command}/walkthrough.md`       |
| Technical internals           | `help/{command}/resources.md`         |
| Full index of all commands    | `help/INDEX.md`                       |

Ask the AI to read any of these:
> "Read help/sprint/walkthrough.md"
> "Show me the resources for the compile command"
> "Read the help index"

---

## Skills and Prompts (Not Listed in /PNW-help)

The skills and prompts are invoked by asking the AI directly, not with
slash commands. They do not appear in the `/PNW-help` output.

**Skills:**

| Skill                  | Usage                                      |
|------------------------|--------------------------------------------|
| getting-started        | "Run the getting-started skill"            |
| premise                | "Run the premise skill"                    |
| world-building         | "Run the world-building skill"             |
| character-interview    | "Run the character-interview skill for X"  |
| outline-novel          | "Run the outline-novel skill"              |
| outline-chapter        | "Run the outline-chapter skill for ch N"   |
| draft-scene            | "Run the draft-scene skill"                |
| retroactive-outline    | "Run the retroactive-outline skill"        |
| dev-edit               | "Run the dev-edit skill on chapter N"      |
| line-edit              | "Run the line-edit skill on scene N.M"     |
| copy-edit              | "Run the copy-edit skill on chapter N"     |
| continuity-check       | "Run the continuity-check skill"           |
| voice-match            | "Run the voice-match skill for character X"|
| import                 | "Run the import skill"                     |

**Prompts:**

| Prompt           | Usage                                        |
|------------------|----------------------------------------------|
| brainstorm       | "Run the brainstorm prompt"                  |
| what-if          | "Run the what-if prompt"                     |
| scene-expand     | "Run the scene-expand prompt"                |
| dialogue-polish  | "Run the dialogue-polish prompt"             |
