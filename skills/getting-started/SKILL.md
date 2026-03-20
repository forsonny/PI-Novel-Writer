---
name: getting-started
description: Guided walkthrough for setting up your first novel project
---

# Getting Started with Your Novel

Welcome! Let's set up your novel project. I'll walk you through a few key decisions.

## Step 1: What Are You Writing?

Ask the author:

> What format are you writing?
> - **Novel** (60,000–120,000 words) — chapters with multiple scenes
> - **Novella** (17,000–40,000 words) — shorter chapter structure
> - **Short Story** (1,000–17,000 words) — no chapters, just scenes
> - **Flash Fiction** (under 1,000 words) — a single file

Update `project.json` with their choice using the built-in `write` tool to set the `"format"` field.

## Step 2: How Do You Work?

Ask the author:

> Are you a **plotter** or a **pantser**?
> - **Structured (plotter):** You like to plan before you write. Outlines, beat sheets, character profiles — then drafting.
> - **Discovery (pantser):** You like to discover the story as you write. Dive in and figure it out along the way.

Update `project.json` `"workflow"` field to `"structured"` or `"discovery"`.

## Step 3: Project Details

Ask for and update in `project.json`:
- **Title** → `"title"` field
- **Genre** → `"genre"` field (e.g., `"epic-fantasy"`, `"literary-fiction"`, `"thriller"`)
- **POV** → `"pov"` field (e.g., `"first-person"`, `"third-limited"`, `"third-omniscient"`)
- **Tense** → `"tense"` field (`"past"` or `"present"`)
- **Target word count** → `"targetWordCount"` field

Use `novel_project_info` to read the current config, then update with the built-in `write` tool.

## Step 4: Next Steps

Based on their workflow choice:

### For Plotters (Structured)
1. "Would you like to **develop your premise** now?" → Launch the `premise` skill
2. After premise: suggest the `outline-novel` skill for beat sheet and chapter outlines
3. Then: `character-interview` skill for key characters
4. Then: begin drafting with `/draft`

### For Pantsers (Discovery)
1. "Ready to start writing?" → Open the first scene with `novel_scene_read` to show it
2. They can start writing immediately — just type their prose
3. After 3+ scenes, gently suggest: "Would you like me to analyze what you've written and build a working outline? Use the `retroactive-outline` skill."

## Available Commands

Here are the commands you'll use most:

| Command | What it does |
|---------|-------------|
| `/PNW-status` | See your project dashboard |
| `/PNW-help` | List all available commands |
| `/brainstorm [topic]` | Open brainstorming on any topic |
| `/what-if [scenario]` | Explore alternative scenarios |
| `/PNW-summarize [ch sc \| chapter n]` | Generate or refresh scene/chapter summaries |

More commands unlock as you progress through your project.
