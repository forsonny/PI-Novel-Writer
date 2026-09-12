# Summary System — Help Reference

## Commands

- `/PNW-summarize` finds drafted scene and chapter summaries that are missing or stale, plus orphaned chapter summaries, then asks the AI to regenerate actionable items.
- `/PNW-summarize <chapter> <scene>` replaces one scene summary through `summary_generate`.
- `/PNW-summarize chapter <n>` replaces one chapter summary.

These commands may rewrite summaries. To inspect one without changing it, use `summary_read({chapter, scene?})` or ordinary read-only access.

## Tools

`summary_read` is read-only. It returns an existing summary body, freshness, and source path without regeneration. Long bodies may be truncated; use ordinary read-only access to the reported source for the remainder.

`summary_generate` is the supported write path. Scene summaries fingerprint scene prose; chapter summaries fingerprint ordered drafted scenes.

`novel_summary_refresh` reports missing and stale scene or chapter summaries, plus orphaned **chapter** summaries, without changing them. It does not detect orphaned scene summaries.

## Meaning of fresh

Fresh means source prose has not changed. It does **not** mean the summary is complete or accurate. Automatic context excludes stale summaries; use `context_summary` to inspect selected summaries.
