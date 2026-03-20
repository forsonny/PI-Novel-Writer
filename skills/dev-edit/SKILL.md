---
name: dev-edit
description: Developmental editing for big-picture analysis (structure, pacing, character arcs)
---

# Developmental Edit Skill

This skill focuses on macro-level editing: story structure, pacing, theme development, and plot holes.

## Prerequisites
- Target chapters or scenes must be in at least `draft` status.
- Use `cost_estimate` before executing bulk analysis or edits.

## Workflow

1. **Estimate Cost**: Call `cost_estimate` with `operation="bulk-edit"` or `operation="analysis"` depending on whether you are just analyzing or rewriting.
2. **Analyze Pacing & Wordcount**: Use the `analyze_pacing` and `analyze_wordcount` tools on the target scenes.
3. **Review Structure**: Evaluate the scene's emotional arc, narrative tension curve, and how it advances the plot.
4. **Suggest Structural Edits**: If a scene is lacking tension or pacing is off, log suggestions using `edit_suggest` for the author to review. Do not rewrite without permission, but provide detailed structural critiques.
