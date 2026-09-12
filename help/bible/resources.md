# /PNW-bible — Resources

Bible files live under `bible/characters`, `locations`, `items`, `factions`, and
`world`. The voice profile is separate and is not listed as an entry.

Frontmatter supports `type`, `name`, `aliases`, `priority`, and `tags`. Priority is
`core`, `secondary`, or `minor`; the default is `secondary`. Names and aliases are
matched case-insensitively. Files are discovered from disk on lookup, so no
separate persistent index is maintained.

`bible_delete` archives rather than permanently erasing. Move an archived file
back to restore it.

Automatic context uses all five types in deterministic priority/name order within
the bible budget. `context_summary` reports selected and omitted entries. Explicit
`bible_read` remains the reliable way to load a specific entry.

`bible_consistency_check` reads the synchronization date in
`continuity/facts.json` and compares file modification dates. It does not compare
claims. Missing, invalid, or future dates are unknown, not clean.
