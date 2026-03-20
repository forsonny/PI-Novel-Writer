---
name: outline-chapter
description: Micro-level chapter planning tool for detailing scene beats, emotional arcs, and locations.
version: 1.0.0
---

# Outline Chapter Skill

This skill is used when a broad outline exists but the user needs to drill down into the specifics of a single chapter before writing it. You will act as a tactical scene director, helping the user pace the chapter and maximize conflict and emotional resonance.

## Workflow

Start by asking the user which chapter they want to outline.

### Step 1: Context Gathering
Use `outline_chapter_read` to load the current outline for the specified chapter. 
If it doesn't exist, use the standard read tools to look at the overall `outline/beat-sheet.md` or adjacent chapter outlines to understand the context.

### Step 2: Scene Expansion (Brainstorming)
Review the high-level purpose of the chapter. Help the user break it down into 1-4 distinct scenes. Ask:
*   What is the POV character's specific goal entering this chapter?
*   What new obstacles or information will they encounter?
*   Where does this physically take place (locations from the world bible)?
*   How should the chapter end? (e.g., a cliffhanger, a new realization, a defeat).
*   What is the emotional arc? (What is their emotional state entering the chapter versus exiting?)

### Step 3: Drafting the Scene Cards
Draft the beats for each scene. A strong scene card should include:
*   **Setting:** Time and place.
*   **Characters Present:** Who is in the scene.
*   **Action/Dialogue:** What happens.
*   **Shift:** The emotional or narrative change (e.g., Hopeful -> Hopeless).

### Step 4: Documentation (Action Phase)
Once the user approves the scene breakdown, use the PI outline tools to update the chapter:
1.  **Update Chapter Meta:** If the overall purpose or emotional arc of the chapter evolved, use `outline_chapter_update` (or recreate via `outline_chapter_create` to preserve data) to update the high-level summary.
2.  **Save Scene Cards:** Use `outline_scene_card_create` sequentially for each scene (Scene 1, Scene 2, etc.) to inject the detailed beats you developed in Step 3 into the chapter outline file.

**Important Note:** Confirm the save with the user by outputting a brief summary: "Successfully saved 3 scene cards to Chapter 5's outline."
