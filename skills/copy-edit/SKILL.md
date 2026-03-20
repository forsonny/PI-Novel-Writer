---
name: copy-edit
description: Proofreading for grammar, spelling, punctuation and consistency
---

# Copy Edit Skill

This skill acts as the final polish stage, catching objective errors and formatting inconsistencies.

## Workflow

1. **Read Scene**: Use `novel_scene_read`.
2. **Analyze Readability**: Run `analyze_readability` to check for overly complex or run-on sentences.
3. **Proofread**: Scan the text specifically for:
   - Typos, grammar mistakes, and spelling errors.
   - Formatting issues (e.g., missing quotes, mismatched em dashes).
   - Inconsistent capitalization or character name spellings.
4. **Apply Corrections**: For undisputed grammar/spelling fixes, use the `edit_line` tool directly if authorized, or provide a list of typos for the author to manually address.
