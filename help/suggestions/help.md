# /PNW-suggestions — Help Reference

`/PNW-suggestions` displays the current `pending` array from
`.pi/edit-suggestions.json`: ID, chapter, scene, rationale and proposed text. It
does not show original text or accepted/rejected history.

- `edit_suggest` creates `sug_<uuid>` and appends a pending record.
- `edit_accept` applies an exact-once passage replacement, then moves the record
  to `accepted`. Failure leaves it pending.
- `edit_reject` moves it to `rejected` and may add a reason.
- `edit_modify` changes proposed text while it remains pending.
- `edit_list_suggestions` returns pending records only, optionally filtered by
  chapter and/or scene.

There is no bulk-accept/reject tool. Process multiple IDs sequentially. In an
authorized autonomous run, justified revisions are applied directly rather than
queued for per-edit approval.
