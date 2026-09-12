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

1. **Estimate Selected Text**: Call `cost_estimate` with the requested scene/chapter scope and identifiers. It estimates selected prose tokens, not billing or the complete workflow.
2. **Analyze Pacing & Wordcount**: Use the `analyze_pacing` and `analyze_wordcount` tools on the target scenes.
3. **Review Structure**: Evaluate the scene's emotional arc, narrative tension curve, and how it advances the plot.
4. **Act on Findings**: In supervised work, log exact passage changes with `edit_suggest` for author review. In an authorized autonomous run, apply justified revisions directly and preserve prior prose. Analysis tools provide evidence, not percentages or verdicts.
