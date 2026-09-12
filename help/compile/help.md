# /PNW-compile — Help Reference

`/PNW-compile` compiles every discovered scene in canonical reading order into a
timestamped Markdown file, then attempts DOCX conversion when Pandoc is available.
The current compiler does not filter by scene status or empty body.

Novel and novella projects receive `# Chapter N` headings. Short-story and
flash-fiction projects do not. Chapter titles are not added. A `* * *` break is
inserted before every scene whose numeric scene ID is greater than 1.

Output is written under `exports/` and old exports are retained. The command does
not publish, upload, produce PDF/EPUB, apply a custom reference document, or delete
older exports.

`compile_manuscript` writes Markdown only. `export_docx` converts one absolute
Markdown path to one absolute DOCX path with `pandoc input -o output`.
