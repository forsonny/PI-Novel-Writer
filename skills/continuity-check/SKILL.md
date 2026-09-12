---
name: continuity-check
description: Verify continuity against the fact database and bible entries
---

# Continuity Check Skill

This skill guides the AI through checking a scene for continuity errors using the project's fact database and character states.

## Prerequisites
- The scene to be checked must exist.
- Use `cost_estimate` to check the cost of running a full continuity scan before proceeding.

## Workflow

1. **Estimate Selected Text**: Call `cost_estimate` with `operation="analysis"`, `scope="scene"` and the target `chapter` and `scene`. For a chapter, supply `scope="chapter"` and `chapter`; use `all` only for the requested whole manuscript. This is a text-token estimate, not billing, and excludes repeated context.
2. **Read Scene**: Read the target scene using `novel_scene_read`.
3. **Analyze Continuity**: Use `analyze_continuity` to load the actual scene and records. Use `summary_read` for saved summaries and bounded `novel_character_knowledge` when viewpoint knowledge matters. Perform the comparison yourself, citing passages; tools supply evidence, not a verdict.
4. **Report Flags**: Distinguish supported facts, uncertainties and contradictions. Missing records are unknown, not a clean review. `bible_consistency_check` checks dates only; missing, invalid or future synchronization dates mean unknown. Reconcile changed dates, counts, custody, resources and ordering across current headers, cards, master plan and actual records. Label superseded plans; future plans are not canon.
5. **Suggest Fixes**: For each flagged contradiction, use `edit_suggest` to propose a correction, providing a clear rationale based on the established facts.
