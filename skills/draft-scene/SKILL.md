---
name: draft-scene
description: "Workflow to generate a first draft from a scene outline"
---

# Draft Scene Skill

This skill guides the AI through drafting a complete scene from an outline.

## Managed-project routing

When `novel_literary_status` reports enabled managed writing, use the
`literary-workflow` skill for preparation, bounded drafting, isolated review and
atomic acceptance. The legacy direct-write instructions below apply only when
managed writing is disabled. Do not copy a generated candidate directly into a
scene to bypass protected meaning or current-source validation.

## Prerequisites
- Use `novel_project_info` to confirm the format, then `novel_scene_list` to confirm the target exists.
- Novel and novella scenes live under `manuscript/chapters/`; short-story scenes live under `manuscript/scenes/`; flash fiction uses `manuscript/story.md` as its single scene.

## Workflow

1. **Read the Target**: Prefer `novel_scene_list` and `novel_scene_read` over assuming a path. Use `outline_chapter_read` for the applicable scene card or outline. For short stories and flash fiction, action parameters use chapter 1 even though the manuscript has no narrative chapters. In an active autonomous run, also read its saved next action and continuity records; do not ask for milestone approval.
2. **Context Injection**:
   - Automatic context is bounded. Use `context_summary` to see selected/omitted bible entries and selected summaries. Explicitly read the current voice, relevant bible entries, earlier prose and fresh summaries.
   - Use `summary_read` for inspection without rewriting. Freshness is not factual accuracy. Use bounded `novel_character_knowledge` evidence for the POV cutoff, but do not treat every fact in it as known or assume it removes later information already in conversation.
   - If you need additional specific context, use the `context_inject` tool.
3. **Verify Budget**: Read the `context_budget_report` to ensure you have enough tokens.
4. **Draft**: 
   - Generate the prose.
   - `novel_scene_write` replaces the whole body, not appends. Supply the complete scene or read and combine existing prose before writing a continuation.
   - Follow the voice profile strictly.
5. **Discovery Mode Variant**: If the project workflow is marked as "discovery" and no detailed scene card exists, use `continue_writing` only to retrieve the current ending. Draft the continuation, combine it with the complete existing body, then call `novel_scene_write` once with the complete updated body. `continue_writing` does not append or save prose.
6. **Update Status**: Use `novel_scene_status` to change the scene status from `outline` to `draft`.
7. **Integrate**: Reconstruct what changed from the actual prose. Save `summary_generate`, update consequential continuity and later scene dependencies, and record discoveries separately from planned facts. Reconcile changed dates, counts, custody, resources and event order in the applicable outline, scene card, master plan and actual records. Label superseded plans; never promote future plans to canon.
