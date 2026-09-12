# /PNW-edit — Resources

Suggestions are stored as one object with `pending`, `accepted`, and `rejected`
arrays in `.pi/edit-suggestions.json`. IDs use `sug_` plus a random UUID. Accepted
and rejected records move between arrays; modified suggestions remain pending.

Accepting requires the original passage to match exactly once. A stale, empty, or
ambiguous match fails and leaves the suggestion pending. Successful scene changes
retain the previous prose under `notes/revisions/`.

Continuity and timeline files are ordinary author/AI-maintained records. Advancing
a scene status does not extract facts, knowledge, or events automatically.
Analysis tools return source evidence and a task statement, not computed literary
scores or a clean verdict.
