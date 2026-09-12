# /PNW-suggestions — Resources

Storage shape:

```json
{ "pending": [], "accepted": [], "rejected": [] }
```

A record contains `id`, chapter, scene, original text, suggested text, rationale,
and a millisecond timestamp. Rejected records may add `reject_reason`. There is no
status field or resolved timestamp; array custody is the status.

Accepting uses an exact-once match in the scene body. It retains prior prose in
`notes/revisions/`. A stale or ambiguous suggestion is not consumed. IDs are random
UUIDs prefixed with `sug_`.

Scene status changes do not auto-extract facts, knowledge, summaries or timeline
events.
