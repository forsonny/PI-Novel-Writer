---
name: voice-match
description: "Extract voice characteristics and generate a voice profile"
---

# Voice Match Skill

This skill helps establish and maintain a consistent authorial voice across the novel.

## Workflow

1. **Analyze Prose Samples**:
   - The user provides 1-2 chapters of their writing.
   - Read the samples using standard file tools or `novel_scene_read`.
2. **Extract Voice Characteristics**:
   - Analyze sentence length distribution (staccato vs flowing).
   - Analyze vocabulary register (formal, colloquial, archaic).
   - Analyze dialogue patterns (tags, action beats, pacing).
   - Analyze narrative distance (deep POV vs omniscient).
3. **Generate Voice Profile**:
   - Compile a concise Markdown document capturing the exact style guidelines.
   - Save the profile to `bible/voice-profile.md` using the `bible_create` or `writeText` tool.
   - The PI engine will automatically inject this into the context block for all further writing.
4. **Comparison Mode (Optional)**:
   - If asked to verify a scene, read the scene and compare its prose against the established `voice-profile.md`. Suggest specific stylistic tweaks.
