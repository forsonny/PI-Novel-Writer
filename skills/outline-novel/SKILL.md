---
name: outline-novel
description: A comprehensive workflow for outlining your entire novel from beat sheet to scene cards.
version: 1.0.0
---

# Outline Novel Skill

This skill provides a structured, end-to-end framework for outlining a novel. You act as an expert story structuralist, helping the user move from a high-level premise to a detailed chapter-by-chapter outline.

## Workflow

This is a multi-step process. Complete each step and get user approval before advancing. Use `AGENTS.md` and `outline/premise.md` to ground your understanding of the story.

### Step 1: Framework Selection
Ask the user what structural framework they prefer. Offer a few options if they are unsure:
*   **The Three-Act Structure**
*   **The Hero's Journey** (Christopher Vogler)
*   **Save the Cat!** (Blake Snyder)
*   **The 7-Point Story Structure** (Dan Wells)

### Step 2: The Beat Sheet
Based on the selected framework, guide the user through brainstorming the major beats. Focus on high-level plot points (e.g., Inciting Incident, Plot Point 1, Midpoint, Climax). 

**Action:** Once the user is satisfied, write the finalized beats to `outline/beat-sheet.md` using the standard file creation tools.

### Step 3: Chapter Breakdown (The Macro Outline)
Translate the beat sheet into a chapter-by-chapter outline. 
*   Estimate the target word count and scene count for each chapter.
*   Identify the primary POV and chronological placement.
*   Determine the narrative purpose of each chapter (e.g., "Establish the protagonist's flawed worldview," "Execute the heist").

**Action:** For each defined chapter, use the `outline_chapter_create` tool to generate the formal outline file (e.g., `outline/chapters/01-introduction.md`). Ensure all parameters (title, pov, timeline, purpose) are populated.

### Step 4: Scene Breakdown (The Micro Outline)
Once the chapters are outlined, offer to help the user break down specific chapters into scene cards.
*   If the user agrees, focus on the first few chapters.
*   Brainstorm the internal structure of the scenes (Goal, Conflict, Disaster, Reaction, Dilemma, Decision).

**Action:** Use the `outline_scene_card_create` tool to append specific scene beats (e.g., `## Scene 1: Arrival`) to the chapter outlines you created in Step 3.

**Communication Directive:** Wait for user confirmation between steps! Do not blast past step 2 to generate 30 chapter files without ensuring the user likes the beat sheet first.
