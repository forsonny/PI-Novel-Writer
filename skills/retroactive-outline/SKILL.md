---
name: retroactive-outline
description: Analyzes existing prose to generate an outline, beat sheet, and character bible entries. Perfect for "pantsers."
version: 1.0.0
---

# Retroactive Outline Skill

This skill is designed for writers who write by the seat of their pants ("pantsers"). It helps them transition to a structured project by analyzing existing prose and extracting the structure into outlines and world bible entries.

You will act as an analytical editor/archivist, reading through the author's manuscripts and formally organizing the story logic.

## Workflow

Begin with `novel_project_info` and `novel_scene_list` to identify the format and available prose. Confirm which chapters or scenes the user wants analyzed. If none are specified, iterate through the listed scenes in story order.

Novel and novella prose uses chapters and scenes under `manuscript/chapters/`; short stories use flat scenes under `manuscript/scenes/`; flash fiction uses the single `manuscript/story.md`. Prefer `novel_scene_list` and `novel_scene_read` over assuming a path.

### Step 1: Analyze Prose
Read the selected prose iteratively with `novel_scene_read`. Analyze the events, characters, and locations.

### Step 2: Extract Bible Entries
Identify characters, locations, and important lore elements mentioned in the prose.
*   Cross-reference with existing bible entries: Use `bible_search` or `bible_read` to see if the element already exists.
*   If new, ask for confirmation in supervised work. In an authorized autonomous run, save supported actual details without milestone approval and label uncertainty.
*   If the user agrees, use `bible_create` to store the new entity.

### Step 3: Build the Outline
Extract the narrative beats from the format's story units:
*   For a novel or novella, identify each chapter's central conflict, purpose, POV, scenes, actions, and emotional shifts.
*   For a short story, analyze the flat scene sequence without inventing narrative chapters.
*   For flash fiction, analyze the single story as one compressed unit.

### Step 4: Documentation (Action Phase)
Use the Pi extension actions to save this analysis.
1.  **Outline:** For novels and novellas, use `outline_chapter_create` for each chapter. For short stories and flash fiction, use chapter 1 as the outline action's compatibility address, not as a narrative chapter.
2.  **Scene Cards:** Use `outline_scene_card_create` for each actual scene or for the single flash-fiction story.

### Note for the AI
Do not overwhelm the user by dumping massive amounts of generated text into the chat. Rather, summarize the work you plan to do, then execute it silently using the platform tools. Confirm in supervised work once the files have been created. During an authorized autonomous run, checkpoint the saved evidence and continue.
