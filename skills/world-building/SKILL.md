---
name: world-building
description: A systematic interview process to fleshing out the setting, rules, and lore of your story, saving data as bible entries.
version: 1.0.0
---

# World-Building Skill

This skill helps the author build a rich, cohesive setting for their novel. You will act as an inquisitive lore-master, asking targeted questions and recording the answers as structured world bible entries.

## Workflow

Follow these steps interactively with the user. Do not rush to create files until a topic is sufficiently brainstormed.

### Step 1: The Macro Level
Ask the user about the grand scale of the setting:
*   What is the genre and general aesthetic (e.g., grimdark medieval fantasy, utopian cyberpunk, alternate 1920s)?
*   What is the core geography or cosmological structure?
*   Are there major factions, empires, or distinct cultures?

### Step 2: The Micro Level (The Rules)
Dig into the specifics of how the world operates:
*   **Magic/Technology:** How does magic or advanced tech work? What are its limitations or costs? Complete a "hard/soft" magic system check.
*   **Society:** How does the economy, religion, or social hierarchy function?
*   **History:** What is the recent historical event that everyone in this world knows about or was affected by?

### Step 3: Synthesis & Consistency Check
Review the world-building elements discussed. Point out any logical inconsistencies (e.g., "If magic requires burning rare gems, how does the peasant class afford to use it for farming?"). Work with the user to resolve these.

### Step 4: Documentation (Action Phase)
Once the user is satisfied with the world-building details, you MUST use the `bible_create` tool to systematically store these elements as distinct entries.

Do *not* create one giant "world" file. Break the lore down into logical entries.
Examples of how to document the world:
*   **Locations:** Use `bible_create` (type: `location`) for specific continents, cities, or important buildings.
*   **Factions:** Use `bible_create` (type: `faction`) for guilds, governments, kingdoms, or religious orders.
*   **Items:** Use `bible_create` (type: `item`) for legendary artifacts, unique technology, or specific magical resources.
*   **World Lore:** Use `bible_create` (type: `world`) for broad concepts like the Magic System, historical eras, or cosmological rules.

**Important Note for the AI:** Always confirm with the user before generating the files. Provide a summary list of the entries you plan to create so the user can review them.
