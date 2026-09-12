# /PNW-compile — Resources

Compilation refreshes the project, sorts scenes by chapter and stable reading
order, strips scene frontmatter, and writes Pandoc metadata for title, author and
the current UTC date. Output names use an ISO timestamp with colon and period
characters replaced by hyphens.

The compiler includes every discovered scene regardless of status. It does not
read chapter titles from outlines. For novel/novella it emits `# Chapter N`; other
formats receive no chapter heading. Scene breaks depend on numeric scene ID, so a
moved or split scene can receive a break based on its ID rather than its exact
position.

DOCX support requires Pandoc. No custom formatting, PDF, EPUB, deletion, or remote
sharing is implemented by these tools.
