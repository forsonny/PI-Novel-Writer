# pi-novel-writer Help Index

Each slash command has its own folder with three files:

  help.md        — Command reference, parameters, tools, error states
  walkthrough.md — Step-by-step scenarios and workflows
  resources.md   — Technical internals, file paths, data structures

---

## Setup and Navigation

| Command         | Folder           | Purpose                                             |
|-----------------|------------------|-----------------------------------------------------|
| /PNW-init       | help/init/       | Initialize a new novel project in current directory |
| /PNW-load       | help/load/       | Load an existing project from a path               |
| /PNW-status     | help/status/     | Dashboard: word counts, chapters, alerts            |
| /PNW-help       | help/help/       | List all commands grouped by workflow stage         |
| /PNW-next       | help/next/       | Detect your stage and show what to do next          |

## World-Building and Story Structure

| Command         | Folder           | Purpose                                             |
|-----------------|------------------|-----------------------------------------------------|
| /PNW-bible      | help/bible/      | List and manage world-building bible entries        |
| /PNW-outline    | help/outline/    | View beat sheet and chapter outlines                |

## Writing

| Command         | Folder           | Purpose                                             |
|-----------------|------------------|-----------------------------------------------------|
| /PNW-sprint     | help/sprint/     | Timed writing sprint (Pomodoro-style)               |
| /PNW-summarize  | help/summarize/  | Generate or refresh scene and chapter summaries     |

## Editing

| Command         | Folder           | Purpose                                             |
|-----------------|------------------|-----------------------------------------------------|
| /PNW-edit       | help/edit/       | Enter editing mode; trigger analysis and revisions  |
| /PNW-suggestions| help/suggestions/| List, accept, reject, or modify pending edits       |

## Publishing

| Command         | Folder           | Purpose                                             |
|-----------------|------------------|-----------------------------------------------------|
| /PNW-compile    | help/compile/    | Compile manuscript and export to DOCX               |
| /PNW-progress   | help/progress/   | Progress dashboard and word-count goals             |

---

## Quick Command Syntax

```
/PNW-init                          start a new project here
/PNW-init --quick                  minimal setup, skip templates

/PNW-load                          load project in current directory
/PNW-load C:/path/to/novel         load project at explicit path

/PNW-status                        full project dashboard

/PNW-bible                         list all bible entries
/PNW-outline                       list all chapter outlines

/PNW-edit                          enter editing mode
/PNW-suggestions                   view pending edit suggestions

/PNW-sprint                        25-minute sprint (default)
/PNW-sprint 15                     15-minute sprint

/PNW-summarize                     batch refresh all stale summaries
/PNW-summarize 1 2                 summarize scene 1.2
/PNW-summarize chapter 3           summarize chapter 3

/PNW-compile                       compile all scenes to DOCX

/PNW-progress                      progress dashboard
/PNW-help                          show commands menu
/PNW-next                          show next recommended step
```

---

## Workflow Stages (detected by /PNW-next)

```
Stage 1  No project loaded
Stage 2  Project ready — begin planning
Stage 3  Bible started — create outline
Stage 4  Outlined — begin drafting
Stage 5  Drafting — summaries need updating
Stage 6  Drafting in progress
Stage 7  First draft complete — begin editing
Stage 8  Editing in progress
Stage 9  Ready to export
```

---

## Skills (invoked by asking the AI)

Skills are Markdown workflows. Ask the AI to run one by name:

```
getting-started        initial project setup tour
premise                develop your story premise
world-building         create bible entries
character-interview    deep character development
outline-novel          full novel beat sheet
outline-chapter        individual chapter outline
draft-scene            draft a scene
retroactive-outline    generate outline from existing scenes
dev-edit               developmental editing pass
line-edit              line-level prose refinement
copy-edit              grammar and style pass
continuity-check       cross-reference against facts
voice-match            check character voice consistency
import                 import an existing manuscript
```

---

## Prompts (short AI instructions)

```
brainstorm             generate story ideas
what-if                explore scenario variations
scene-expand           expand a scene sketch
dialogue-polish        refine dialogue
```
