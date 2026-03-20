# /PNW-suggestions — Help Reference

View, manage, and apply pending edit suggestions from the AI.

---

## Command

### `/PNW-suggestions`

**Usage:**
```
/PNW-suggestions
```

**Parameters:** none

**What it does:**
1. Reads `.pi/edit-suggestions.json`
2. Filters to suggestions with `status: "pending"`
3. Displays each suggestion with its ID, location, original text, proposed text,
   and the AI's rationale

**Requirements:** A project must be loaded.

**When to use:**
- After running an editing skill (`dev-edit`, `line-edit`, `copy-edit`) that
  generated suggestions
- After asking the AI to analyze and suggest improvements
- To review a backlog of unprocessed suggestions before a writing session

---

## Suggestion Display Format

```
=== PENDING EDIT SUGGESTIONS ===

[edit-1710000000001]  Ch 2, Sc 3
  ORIGINAL: "She ran quickly toward the door."
  PROPOSED: "She ran for the door."
  REASON:   Remove adverb; 'ran' already implies speed.

[edit-1710000000002]  Ch 2, Sc 3
  ORIGINAL: "Elara felt that something was wrong."
  PROPOSED: "Something was wrong."
  REASON:   Remove distancing filter word 'felt'; direct statement is stronger.

[edit-1710000000003]  Ch 3, Sc 1
  ORIGINAL: "'We need to leave,' she said urgently."
  PROPOSED: "'We need to leave now.' She was already moving."
  REASON:   Replace adverb + said with action beat; shows urgency instead of
            labeling it.

3 pending suggestions
```

---

## Suggestion Management Tools

### `edit_accept`

Apply a pending suggestion to the scene file.

**Parameters:**

| Parameter | Type   | Required | Description                    |
|-----------|--------|----------|--------------------------------|
| `id`      | string | yes      | Suggestion ID (e.g. "edit-1710000000001") |

**What it does:**
- Finds the `original_text` in the scene file
- Replaces it with `suggested_text`
- Sets the suggestion status to `accepted`
- Returns the updated line count

**Error states:**
- `"Original text not found in scene"` — the scene may have been manually edited
  since the suggestion was created; the original no longer matches. Reject and
  apply manually if needed.

---

### `edit_reject`

Dismiss a suggestion without applying it.

**Parameters:**

| Parameter | Type   | Required | Description                        |
|-----------|--------|----------|------------------------------------|
| `id`      | string | yes      | Suggestion ID                      |
| `reason`  | string | no       | Optional note on why it was rejected |

**What it does:**
- Sets the suggestion status to `rejected`
- Leaves the scene file unchanged
- The suggestion remains in history (not deleted)

---

### `edit_modify`

Change the proposed text of a suggestion before accepting it.

**Parameters:**

| Parameter            | Type   | Required | Description                     |
|----------------------|--------|----------|---------------------------------|
| `id`                 | string | yes      | Suggestion ID                   |
| `new_suggested_text` | string | yes      | Your revised replacement text   |

**What it does:**
- Updates the `suggested_text` in the suggestion record
- Sets status back to `pending` if it was modified
- Does NOT apply the change to the scene file yet

**When to use:**
- The AI's suggestion is on the right track but the exact wording is not what
  you want
- You want to accept the spirit of the edit but use your own phrasing

---

### `edit_list_suggestions`

List suggestions for a specific scene or chapter (AI-callable).

**Parameters:**

| Parameter | Type   | Required | Description                           |
|-----------|--------|----------|---------------------------------------|
| `chapter` | number | no       | Filter by chapter                     |
| `scene`   | number | no       | Filter by scene (requires `chapter`)  |

**Returns:** All suggestions for the specified scope, including accepted and rejected.
Useful for reviewing the full edit history of a scene.

---

## Workflow: Processing a Suggestion Queue

After a dev-edit skill run that produced 12 suggestions:

```
/PNW-suggestions
```

For each suggestion, decide:

1. **Accept as-is:**
   > "Accept edit-1710000000001"

   The AI calls `edit_accept(id: "edit-1710000000001")`. The scene file updates.

2. **Accept with modification:**
   > "Modify edit-1710000000002: change the proposed text to 'The door was already closing.'"

   Then: > "Accept edit-1710000000002"

3. **Reject:**
   > "Reject edit-1710000000003. The urgency label is intentional — Drath's POV
   > scenes use more explicit emotional language."

4. **Bulk accept:** When you trust the AI's judgment on a category:
   > "Accept all suggestions that remove adverbs"

---

## Suggestion History

Accepted and rejected suggestions remain in `.pi/edit-suggestions.json` permanently.
This gives you a complete audit trail of every AI-suggested change for the project.

To view historical suggestions for a scene:
> "List all edit history for scene 2.3"

The AI calls `edit_list_suggestions(chapter: 2, scene: 3)` and returns the full
history including accepted and rejected items with timestamps.
