# Summary System — Resources

## Storage

- Scene: `summaries/scenes/01-02.md`
- Chapter: `summaries/chapters/01.md`
- Optional act notes: `summaries/acts/01.md`

Scene fingerprints use only the scene body. Chapter fingerprints use all drafted
scenes in canonical reading order. Act notes have no verified source and are not
automatically treated as current summaries.

## Read and write custody

- Read with `summary_read` or ordinary read-only file access.
- Write or replace with `summary_generate`.
- `novel_summary_refresh` checks mechanical freshness only.
- Existing custom summary files are not migrated or erased automatically.

## Context selection

Fresh scene summaries are considered newest first and added while they fit. If no
scene summary fits, fresh chapter summaries are considered. `context_summary`
reports selected summaries. Budgeting uses an approximate four characters/token.

A matching fingerprint cannot validate meaning. A fabricated, incomplete, or
misleading summary can still be mechanically fresh.
