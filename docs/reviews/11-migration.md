# Change 11: previewed, recoverable project migration

Implemented the S07 migration service with read-only previews, version-bound explicit
approval, stable scene identities, byte-exact backups, a private recovery journal,
and a section-granularity three-way merge of installed Markdown guidance. Conflicting
sections keep author text and retain incoming guidance for inspection. Unknown
baseline means no guessed merge. Legacy state remains unverified and managed mode
is opt-in; opening a project performs no migration.

Review: the first test run exposed that the existing writeText helper normalizes
CRLF, invalidating byte-exact backup and rollback expectations. Replaced it in the
migration path with an exact-byte, fsync-before-rename writer. Also constrained
migration targets and validated saved recovery journals and store/project identity.

Verification: syntax, strict TypeScript, and all 55 regression tests pass locally.
New tests cover author edits, merge conflicts, stale/tampered previews, untouched
prose/custom metadata/CRLF, idempotent re-entry, rollback after an injected write
fault, and path containment. The local Node is 22.16.0; release CI uses the supported
22.19.0 runtime. This change is a tested service; the user commands are wired in the
integration change. A process that can replace filesystem entries concurrently is
not contained by these path checks; use a trusted local project directory.
