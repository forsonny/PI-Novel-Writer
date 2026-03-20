# pi-novel-writer

A full-stack novel writing environment for [PI](https://github.com/anthropics/pi), Anthropic's
terminal coding agent. Turns PI into an AI-assisted writing tool with structured workflows for
planning, drafting, editing, and exporting a novel — without leaving your terminal.

---

## What It Does

pi-novel-writer extends PI with a suite of slash commands, AI tools, and skills that guide
you from a blank directory to a compiled manuscript. Everything is plain files on disk:
Markdown scenes, YAML frontmatter, JSON progress records, and no proprietary formats.

**Workflow stages it covers:**

```
Premise  ->  World Bible  ->  Outline  ->  Drafting  ->  Editing  ->  Export
```

At each stage, the AI has structured access to your world-building data, chapter outlines,
and scene summaries — so it stays consistent across a 90,000-word novel without requiring
you to manually paste context.

---

## Prerequisites

- **PI** — the agent this package extends
- **Node.js 20+**
- **Pandoc** (optional, for DOCX export)
  - Windows: `winget install JohnMacFarlane.Pandoc`
  - macOS: `brew install pandoc`
  - Linux: `apt-get install pandoc`

---

## Installation

Clone or download this repository, then load the extension when starting PI:

```bash
pi -e /path/to/pi-novel-writer/
```

To make it permanent, add the extension path to your PI configuration.

---

## Quick Start

```bash
# 1. Create a directory for your novel and open PI with this extension
mkdir my-novel && cd my-novel
pi -e /path/to/pi-novel-writer/

# 2. Initialize the project
/PNW-init

# 3. Run the guided setup skill to configure title, genre, and targets
Run the getting-started skill

# 4. Build your world and structure
Run the premise skill
Run the world-building skill
Run the character-interview skill for [character name]
Run the outline-novel skill

# 5. Start writing
/PNW-sprint
```

---

## Commands

### Setup and Navigation

| Command              | Description                                                     |
|----------------------|-----------------------------------------------------------------|
| `/PNW-init`          | Initialize a new novel project in the current directory         |
| `/PNW-init --quick`  | Minimal init — directories and config only, no template files   |
| `/PNW-load`          | Load the project in the current directory                       |
| `/PNW-load <path>`   | Load a project from an explicit path                            |
| `/PNW-status`        | Full dashboard: word counts, chapter table, alerts              |
| `/PNW-help`          | List all commands grouped by workflow stage                     |
| `/PNW-next`          | Detect current workflow stage and show what to do next          |

### World-Building and Structure

| Command         | Description                                          |
|-----------------|------------------------------------------------------|
| `/PNW-bible`    | List all world-building entries (characters, locations, factions, items, world) |
| `/PNW-outline`  | Show beat sheet and chapter outline summaries        |

### Writing

| Command              | Description                                              |
|----------------------|----------------------------------------------------------|
| `/PNW-sprint`        | Start a 25-minute timed writing sprint                   |
| `/PNW-sprint <min>`  | Sprint for a custom duration (e.g. `/PNW-sprint 15`)     |
| `/PNW-summarize`     | Batch refresh all stale or missing summaries             |
| `/PNW-summarize <ch> <sc>` | Summarize one scene (e.g. `/PNW-summarize 2 3`)    |
| `/PNW-summarize chapter <n>` | Summarize a whole chapter (e.g. `/PNW-summarize chapter 2`) |

### Editing

| Command             | Description                                               |
|---------------------|-----------------------------------------------------------|
| `/PNW-edit`         | Enter editing mode; activate analysis and revision tools  |
| `/PNW-suggestions`  | View, accept, reject, or modify pending AI edit suggestions |

### Publishing

| Command         | Description                                              |
|-----------------|----------------------------------------------------------|
| `/PNW-compile`  | Compile manuscript to Markdown and export to DOCX via Pandoc |
| `/PNW-progress` | Word count progress dashboard with 7-day history         |

---

## Skills

Skills are AI-guided workflows invoked by asking the AI directly.
They run multi-step processes and call the underlying tools automatically.

| Skill                | Trigger phrase                                    | Purpose                           |
|----------------------|---------------------------------------------------|-----------------------------------|
| `getting-started`    | "Run the getting-started skill"                   | Guided initial project setup      |
| `premise`            | "Run the premise skill"                           | Develop story concept and hook    |
| `world-building`     | "Run the world-building skill"                    | Create bible entries interactively|
| `character-interview`| "Run the character-interview skill for [name]"    | Deep character development        |
| `outline-novel`      | "Run the outline-novel skill"                     | Full beat sheet, all chapters     |
| `outline-chapter`    | "Run the outline-chapter skill for chapter [N]"   | Scene-by-scene chapter breakdown  |
| `draft-scene`        | "Run the draft-scene skill"                       | Draft a scene from its outline    |
| `retroactive-outline`| "Run the retroactive-outline skill"               | Generate outline from existing scenes |
| `import`             | "Run the import skill"                            | Import an existing manuscript     |
| `dev-edit`           | "Run the dev-edit skill on chapter [N]"           | Developmental/structural editing  |
| `line-edit`          | "Run the line-edit skill on scene [N.M]"          | Prose refinement                  |
| `copy-edit`          | "Run the copy-edit skill on chapter [N]"          | Grammar and style pass            |
| `continuity-check`   | "Run the continuity-check skill on chapter [N]"   | Fact-check against world bible    |
| `voice-match`        | "Run the voice-match skill for [character]"       | Character voice consistency check |

---

## Prompts

Short prompts for focused AI tasks, invoked the same way as skills.

| Prompt             | Purpose                                         |
|--------------------|-------------------------------------------------|
| `brainstorm`       | Generate story ideas from a concept or question |
| `what-if`          | Explore scenario variations                     |
| `scene-expand`     | Expand a scene sketch into full prose           |
| `dialogue-polish`  | Refine a dialogue exchange                      |

---

## Project Structure

Running `/PNW-init` creates the following layout in your novel directory:

```
my-novel/
  project.json              # project config, word count targets, context budgets
  system/
    SYSTEM.md               # AI system prompt (edit to customize behavior)
    AGENTS.md               # agent role definitions
  manuscript/
    chapters/
      01/
        scene-01.md         # scene files with YAML frontmatter
        scene-02.md
      02/
        ...
  bible/
    characters/             # character entries
    locations/              # location entries
    items/                  # item entries
    factions/               # faction entries
    world/                  # world rules, magic systems, etc.
  outline/
    chapters/               # chapter outline files
  summaries/
    scenes/                 # per-scene summaries with integrity hashes
    chapters/               # chapter-level summaries
    acts/                   # act summaries (optional)
  exports/                  # compiled Markdown and DOCX output
  continuity/
    facts.json              # extracted world facts for consistency checking
    character-states.json   # character knowledge snapshots per scene
  timeline/
    timeline.json           # timeline event records
  notes/
    deleted-scenes/         # archived scenes (non-destructive delete)
    deleted-bible/          # archived bible entries
  .pi/
    progress.json           # daily word counts, sprint records, API costs
```

All files are plain text. No database, no binary formats.

---

## How Context Injection Works

The AI has access to your world at every turn without manual pasting. Context is
injected automatically in layers, each controlled by a token budget in `project.json`:

```
[STORY CONTEXT]
  Voice profile      <- writing style sample (voiceProfile budget)
  Bible entries      <- characters, locations, factions (bible budget)
  Chapter outlines   <- current + upcoming chapter structure (outline budget)
  Summaries          <- scene summaries, or chapter summaries if scenes exceed budget
  Recent prose       <- last few hundred words of the current scene
```

Adjust budgets in `project.json` under `settings.contextBudget`. Token estimation
uses a 4 characters-per-token approximation.

---

## Summary System

Summaries are how the AI maintains continuity across a novel without re-reading
every scene on every turn. Each drafted scene has a corresponding summary file
with a SHA-256 hash of the scene body. If the prose changes, the hash fails and
the summary is flagged as stale.

```bash
/PNW-summarize              # find and refresh all stale or missing summaries
/PNW-summarize 2 3          # refresh summary for chapter 2, scene 3
/PNW-summarize chapter 2    # refresh the chapter-level summary for chapter 2
```

See `help/summarize/` for full documentation.

---

## Edit Suggestion Workflow

Editing skills generate suggestions stored in `.pi/edit-suggestions.json` rather
than modifying scene files directly. You review and approve each change:

```bash
/PNW-edit                   # enter editing mode
# Ask AI: "Run the dev-edit skill on chapter 1"
/PNW-suggestions            # review the generated suggestions
# Accept: "Accept edit-1710000000001"
# Reject: "Reject edit-1710000000003. I like the original phrasing."
# Modify: "Modify edit-1710000000002: change the proposed text to [your version]"
```

---

## Help System

Every command has detailed documentation in the `help/` directory:

```
help/INDEX.md               # full command index and quick reference
help/{command}/
  help.md                   # parameters, tools, error states
  walkthrough.md            # step-by-step scenarios
  resources.md              # file formats, internals, tool reference
```

Ask the AI to read any help file:
```
Read help/compile/walkthrough.md
Read help/INDEX.md
```

Or run `/PNW-help` for the compact command list.

---

## Architecture

pi-novel-writer is built from three types of components:

**Extensions** (TypeScript modules, loaded via `jiti` — no compile step required):
- `novel-core.ts` — project state, scene CRUD, `/PNW-init`, `/PNW-load`, `/PNW-status`
- `novel-bible.ts` — world bible, outlines, `/PNW-bible`, `/PNW-outline`
- `novel-write.ts` — drafting tools, context injection, summary system, `/PNW-summarize`
- `novel-edit.ts` — analysis, edit suggestions, `/PNW-edit`, `/PNW-suggestions`
- `novel-export.ts` — manuscript compilation, Pandoc DOCX, `/PNW-compile`
- `novel-progress.ts` — word count tracking, sprints, `/PNW-progress`, `/PNW-sprint`
- `novel-github.ts` — GitHub integration for novel repositories

**Skills** (Markdown workflow files in `skills/`):
Structured multi-step AI workflows. The AI reads the skill file, then conducts a
guided process using the registered tools. No code execution required.

**Prompts** (Markdown templates in `prompts/`):
Short focused prompts for common single-task AI requests.

---

## Contributing

Improvements to skills, prompts, and extensions are welcome.

- Skills and prompts are Markdown files — no TypeScript knowledge needed to contribute
- Extension tools follow the PI tool registration API (`pi.registerTool`, `pi.registerCommand`)
- Open an issue before submitting a large change

---

## License

MIT
