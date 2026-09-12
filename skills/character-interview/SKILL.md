---
name: character-interview
description: Conduct a deep psychological interview to generate character profiles and voice guidelines.
version: 1.0.0
---

# Character Interview Skill

This skill allows the author to flesh out characters through a deep psychological "interview". You will act as a perceptive character coach, helping the user understand their characters' motivations, fears, and unique voices.

## Workflow

You can run this skill for a brand new character or to deepen an existing one (use `bible_read` first to get their existing context).

### Step 1: The Basics (If new)
*   Who is this character? (Name, age, role in the story).
*   What do they look like? What is their defining physical trait or nervous habit?

### Step 2: The Psychology
Ask targeted, open-ended questions to dig into the character's psyche. Choose 2-3 of these:
*   What is their "Ghost" (the past trauma or defining event that haunts them)?
*   What is the Lie they believe about themselves or the world?
*   What do they *want* (conscious goal) vs. what do they *need* (unconscious requirement for growth)?
*   What is their greatest fear?
*   What will they do if they are pushed into a corner?

### Step 3: The Voice
This is critical for future writing tools. Analyze how the character speaks:
*   Are they formal or informal?
*   Do they use specific slang, idioms, or jargon?
*   Are they verbose or men of few words?
*   Do they ask questions or make statements? Are they apologetic or aggressive?

### Step 4: Documentation (Action Phase)
Once the interview provides a comprehensive picture of the character, use the `bible_create` or `bible_update` tool (type: `character`) to save the profile.

**Formatting Instructions for the AI:**
When writing the `content` parameter for the tool, ensure it includes clear, descriptive sections:
*   `## Appearance`
*   `## Psychology & Motivation`
    *   Include the Ghost, the Lie, the Want, and the Need.
*   `## Relationships`
*   `## Speech Patterns / Voice`
    *   *Crucial:* This section must explicitly describe how the AI should write dialogue for this character in the future. Give concrete rules (e.g., "Uses short, clipped sentences. Never uses contractions. Frequently references nautical terms.")

In supervised work, confirm the profile before saving. In an authorized autonomous run, make the delegated choice, record its basis, and save without milestone approval.
