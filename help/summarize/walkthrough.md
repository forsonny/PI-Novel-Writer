# Summary System — Walkthrough

## Inspect without changing

Ask the AI to call `summary_read` with a chapter and optional scene. Confirm the
returned body, freshness state, and source path. Ordinary read-only access to the
same file is also allowed.

## Create or refresh

1. Draft or revise the scene.
2. Run `/PNW-summarize <chapter> <scene>`.
3. For a completed chapter, run `/PNW-summarize chapter <n>`.
4. Run `novel_summary_refresh` to confirm mechanical freshness.

For several changes, `/PNW-summarize` lists all items and queues supported
regeneration. Orphans are reported but not silently deleted.

Freshness is not factual review. Compare names, dates, knowledge, custody,
resource counts, injuries, promises and event order with prose and actual records.
Replace an inaccurate summary through `summary_generate`; do not edit its hash.

Use `context_summary` to see which fresh summaries were selected or omitted by
budget. Read omitted material explicitly when it matters.
