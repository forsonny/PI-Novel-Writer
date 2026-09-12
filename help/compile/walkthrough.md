# /PNW-compile — Walkthrough

1. Run `/PNW-status` and inspect every scene you expect to include. Compilation
   includes outline-status and empty scenes too, so remove unintended placeholders
   from the active manuscript structure or fill them before compiling.
2. Run `/PNW-compile`.
3. Open the newest Markdown output in `exports/`. If Pandoc was found, also inspect
   the matching DOCX.
4. Check title, author, chapter order, scene order, breaks, and accidental empty
   sections. Chapter headings contain numbers only.

If DOCX is absent, install Pandoc separately and rerun. Existing exports are never
cleaned up automatically. Publication and sharing remain manual actions.
