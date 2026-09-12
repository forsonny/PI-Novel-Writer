# /PNW-bible — Help Reference

`/PNW-bible` lists every Markdown bible entry except the voice profile, showing a
short body snippet. Entries can be character, location, item, faction, or world.

## Tools

- `bible_create`: create an entry. Priority values are `core`, `secondary`
  (default), or `minor`.
- `bible_read`: read by exact name or alias.
- `bible_update`: replace aliases, priority, tags, and/or body.
- `bible_delete`: move the entry to `notes/deleted-bible/`; it is recoverable.
- `bible_list`: filter by type or priority.
- `bible_search`: literal or regular-expression search, capped for readability.
- `bible_consistency_check`: compare bible modification dates with
  `continuity/facts.json`'s synchronization date.

The consistency check is **date-based freshness only**. Missing, invalid, or future
synchronization dates mean unknown. Even a mechanically current result is not a
semantic clean verdict; compare factual claims with prose and records.

Automatic context considers all five types, ordered deterministically by priority:
core, then secondary, then minor. Entries that do not fit are omitted. Use
`context_summary` to inspect selected and omitted entries and `bible_read` for
anything load-bearing.
