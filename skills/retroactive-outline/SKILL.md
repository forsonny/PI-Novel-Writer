---
name: retroactive-outline
description: Analyzes existing prose to generate an outline, beat sheet, and character bible entries. Perfect for "pantsers."
version: 1.0.0
---

# Retroactive Outline Skill

This skill is designed for writers who write by the seat of their pants ("pantsers"). It helps them transition to a structured project by analyzing existing prose and extracting the structure into outlines and world bible entries.

You will act as an analytical editor/archivist, reading through the author's manuscripts and formally organizing the story logic.

## Workflow

Begin by confirming with the user which chapters or scenes they want analyzed. If none are specified, read the files in the `manuscript/chapters/` directory iteratively.

### Step 1: Analyze Prose
Iteratively read chapters using the standard file reading tools. Analyze the events, characters, and locations within the pros.

### Step 2: Extract Bible Entries
Identify characters, locations, and important lore elements mentioned in the prose.
*   Cross-reference with existing bible entries: Use `bible_search` or `bible_read` to see if the element already exists.
*   If new, ask the user to confirm the extracted details: "I noticed a new character, Captain Vance. Should I create a character profile for him?"
*   If the user agrees, use `bible_create` to store the new entity.

### Step 3: Build the Outline
Extract the narrative beats from the chapters:
*   Identify the central conflict and the purpose of the chapter.
*   Determine the POV character.
*   Break the prose down into distinct scenes. For each scene, summarize the action and emotional shift.

### Step 4: Documentation (Action Phase)
You must use the PI extension tools to save this analysis.
1.  **Chapter Outline:** Use `outline_chapter_create` to generate the formal chapter outline document for each chapter analyzed (e.g., Chapter 1: The Arrival).
2.  **Scene Cards:** Use `outline_scene_card_create` to document the specific beats of the chapter into distinct scene cards (e.g., ## Scene 1).

### Note for the AI
Do not overwhelm the user by dumping massive amounts of generated text into the chat. Rather, summarize the work you plan to do, then execute it silently using the platform tools. Confirm with the user once the files have been created.
