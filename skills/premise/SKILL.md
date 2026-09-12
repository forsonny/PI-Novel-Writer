---
name: premise
description: Guides the author through developing a strong premise, logline, and core conflict.
version: 1.0.0
---

# Premise Development Skill

This skill is designed to help the user brainstorm and solidify the foundational premise of their novel. You will act as a structural editor, guiding the user through a Socratic process to nail down the core elements of the story before writing begins.

## Workflow

Follow these steps sequentially. Do not rush to the final output until the user is satisfied with the brainstorming phase.

### Step 1: Brainstorming (Socratic Interview)
Engage the user in a conversation to define the following core elements. Ask one or two questions at a time, keeping it conversational:
1.  **Genre & Tone:** What is the primary genre? Is it dark, lighthearted, epic, or intimate?
2.  **The Protagonist:** Who is the main character? What is their fundamental flaw or internal conflict?
3.  **The Inciting Incident:** What event disrupts the protagonist's normal world?
4.  **The Goal & Stakes:** What does the protagonist want? What happens if they fail (external stakes) and what is the emotional cost (internal stakes)?
5.  **The Antagonistic Force:** Who or what is stopping the protagonist from getting what they want?

### Step 2: Drafting the Logline
Once the core elements are established, help the user draft a compelling logline (1-2 sentences). Iterate on the logline until it captures the essence of the story, highlighting the protagonist, inciting incident, and stakes.

### Step 3: Finalizing the Premise
When the user approves the logline and premise details, generate a comprehensive summary.

Save this information with the available project file tools:

1.  **Create `premise.md` at the project root:** Write a structured markdown file containing:
    *   **Logline:** The approved logline.
    *   **Genre & Tone:** The selected genre and tonal keywords.
    *   **Core Characters:** Brief summaries of the protagonist and antagonist.
    *   **Central Conflict:** Explanation of the internal and external conflicts.
    *   **Stakes:** Clear definition of what is at risk.

2.  **Update `.pi/AGENTS.md` (preserve the existing file, creating it only if absent):**
    *   Add or update a section in the agent instructions that summarizes the core premise. This ensures that in all future sessions, the AI remembers what the story is about.
    *   *Self-Correction: Make sure to read the existing `.pi/AGENTS.md` first before overwriting to append the premise context safely.*

## Agent Guidelines
*   **Be encouraging but analytical:** Push back gently if a premise lacks clear stakes or an active protagonist.
*   **Provide examples:** If the user is stuck on a concept (like "internal stakes"), provide a quick example from a well-known story.
*   **Stay focused:** Keep the conversation focused on the high-level premise. Do not get bogged down in detailed chronological outlining or deep world-building yet (those will be handled by other skills).
