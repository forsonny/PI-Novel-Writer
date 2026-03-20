---
name: draft-scene
description: "Workflow to generate a first draft from a scene outline"
---

# Draft Scene Skill

This skill guides the AI through drafting a complete scene from an outline.

## Prerequisites
- The scene must exist as a file in `manuscript/chapters/` with valid frontmatter.

## Workflow

1. **Read Scene Card**: Use the `novel_scene_read` tool to load the scene outline.
2. **Context Injection**:
   - The PI engine automatically injects the voice profile, bible entries (based on characters in scene), and tiered summaries via the `context` event.
   - If you need additional specific context, use the `context_inject` tool.
3. **Verify Budget**: Read the `context_budget_report` to ensure you have enough tokens.
4. **Draft**: 
   - Generate the prose.
   - For large scenes (>4000 words), stream the output logically using `novel_scene_write`. 
   - Follow the voice profile strictly.
5. **Discovery Mode Variant**: If the project workflow is marked as "discovery" and no detailed scene card exists, use the `continue_writing` tool to get the tail end of the last scene, then proceed with a freeform prompt to draft what happens next.
6. **Update Status**: Use `novel_scene_status` to change the scene status from `outline` to `draft`.
