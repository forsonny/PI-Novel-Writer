---
name: line-edit
description: Sentence-level editing for prose quality, rhythm, and word choice
---

# Line Edit Skill

This skill focuses on improving the prose itself: sentence-level rhythm, show vs. tell, passive voice, and phrasing.

## Workflow

1. **Read Scene**: Use `novel_scene_read` to load the current text.
2. **Analyze Dialogue**: Run `analyze_dialogue` if the scene contains heavy conversations to check for tag repetition or adverb overuse.
3. **Refine Prose**: Look for opportunities to:
   - Convert telling into showing.
   - Vary sentence lengths and rhythm.
   - Replace weak verbs and excessive adverbs with stronger verbs.
   - Eliminate clichés.
4. **Execute Edits**: 
   - For small sentence swaps, use `edit_line`.
   - For overall suggestions that need author approval, use `edit_suggest`.
