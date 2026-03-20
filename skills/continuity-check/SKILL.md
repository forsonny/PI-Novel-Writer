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

1. **Estimate Cost**: Call the `cost_estimate` tool with `operation="analysis"` and `scope="scene"`. If the project is huge and scope is `all`, alert the user of the cost before proceeding.
2. **Read Scene**: Read the target scene using `novel_scene_read`.
3. **Analyze Continuity**: Use the `analyze_continuity` tool to cross-reference the scene content against `continuity/facts.json` and `continuity/character-states.json`.
4. **Report Flags**: Review any contradictions flagged by the tool (e.g., character in two places, wrong eye color, timeline inconsistencies).
5. **Suggest Fixes**: For each flagged contradiction, use `edit_suggest` to propose a correction, providing a clear rationale based on the established facts.
