# /PNW-suggestions — Resources

Technical reference for the suggestion storage format and tool details.

---

## Suggestion File

```
.pi/edit-suggestions.json
```

**Format:**
```json
[
  {
    "id": "edit-1710000000001",
    "chapter": 2,
    "scene": 3,
    "original_text": "She ran quickly toward the door.",
    "suggested_text": "She ran for the door.",
    "rationale": "Remove adverb; 'ran' already implies speed.",
    "status": "pending",
    "created": "2026-03-20T10:00:00Z",
    "resolved": null,
    "resolvedReason": null
  },
  {
    "id": "edit-1710000000002",
    "chapter": 2,
    "scene": 3,
    "original_text": "Elara felt that something was wrong.",
    "suggested_text": "Something was wrong.",
    "rationale": "Remove distancing filter word.",
    "status": "accepted",
    "created": "2026-03-20T10:00:00Z",
    "resolved": "2026-03-20T11:30:00Z",
    "resolvedReason": null
  }
]
```

**Status values:**

| Status     | Meaning                                            |
|------------|----------------------------------------------------|
| `pending`  | Awaiting review; scene not yet modified            |
| `accepted` | Approved; scene file was modified                  |
| `rejected` | Dismissed; scene file unchanged                    |
| `modified` | Proposed text was changed via edit_modify          |

---

## ID Format

Suggestion IDs are generated as:
```
"edit-" + Date.now()
```

Example: `edit-1710000000001`

IDs are monotonically increasing (based on timestamp) so they sort
chronologically within the session.

---

## Accept Logic

When `edit_accept` is called:

```
1. Find suggestion by ID in edit-suggestions.json
2. Read scene file at manuscript/chapters/{ch}/scene-{sc}.md
3. Find original_text in scene body (exact match, after stripping frontmatter)
4. Replace first occurrence of original_text with suggested_text
5. Write updated scene file
6. Update suggestion status to "accepted" with resolved timestamp
7. Return confirmation with line number changed
```

If `original_text` is not found:
- Scene was modified since suggestion was created
- Return error: "Original text not found in scene {ch}.{sc}"
- Suggestion status is NOT changed; remains pending

---

## Event Integration

The `novel:scene-status-updated` event fires when `novel_scene_status` is called.
It reads the scene at its new status level and:

- At `revised` or higher: extracts facts into `continuity/facts.json`
- At `revised` or higher: updates `continuity/character-states.json`
- At `final`: records the scene in `timeline/timeline.json`

This means running editing passes and advancing scene statuses is how the
continuity tracking system stays current.

---

## Tool Reference

### `/PNW-suggestions` command

| Field          | Detail                                            |
|----------------|---------------------------------------------------|
| Registered in  | `extensions/novel-edit.ts`                        |
| Description    | List pending edit suggestions                     |
| Usage          | `/PNW-suggestions`                                |
| Side effect    | Read-only                                         |

### `edit_accept`

| Field          | Detail                                            |
|----------------|---------------------------------------------------|
| Registered in  | `extensions/novel-edit.ts`                        |
| Label          | Accept Edit Suggestion                            |
| Input          | id                                                |
| Output         | Confirmation with line changed                    |
| Side effect    | Modifies scene file; updates suggestions JSON     |

### `edit_reject`

| Field          | Detail                                            |
|----------------|---------------------------------------------------|
| Registered in  | `extensions/novel-edit.ts`                        |
| Label          | Reject Edit Suggestion                            |
| Input          | id, reason?                                       |
| Output         | Confirmation                                      |
| Side effect    | Updates suggestions JSON only; scene unchanged    |

### `edit_modify`

| Field          | Detail                                            |
|----------------|---------------------------------------------------|
| Registered in  | `extensions/novel-edit.ts`                        |
| Label          | Modify Edit Suggestion                            |
| Input          | id, new_suggested_text                            |
| Output         | Confirmation                                      |
| Side effect    | Updates suggested_text in suggestions JSON        |

### `edit_list_suggestions`

| Field          | Detail                                            |
|----------------|---------------------------------------------------|
| Registered in  | `extensions/novel-edit.ts`                        |
| Label          | List Edit Suggestions                             |
| Input          | chapter?, scene?                                  |
| Output         | Array of suggestions for the specified scope      |

### `edit_suggest`

| Field          | Detail                                            |
|----------------|---------------------------------------------------|
| Registered in  | `extensions/novel-edit.ts`                        |
| Label          | Suggest Edit                                      |
| Input          | chapter, scene, original_text, suggested_text, rationale |
| Output         | Suggestion ID                                     |
| Side effect    | Appends to `.pi/edit-suggestions.json`            |

---

## Related Files

| File                          | Purpose                                         |
|-------------------------------|-------------------------------------------------|
| `extensions/novel-edit.ts`    | All suggestion tools; /PNW-suggestions command  |
| `.pi/edit-suggestions.json`   | Suggestion storage                              |
| `help/edit/help.md`           | Editing mode and analysis tools                 |
