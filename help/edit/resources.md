# /PNW-edit — Resources

Technical reference for editing tools, suggestion storage, and continuity files.

---

## Edit Suggestion Storage

All suggestions created by `edit_suggest` are stored in:
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
    "created": "2026-03-20T10:00:00Z"
  }
]
```

**Status values:**
- `pending` — awaiting review
- `accepted` — approved; change has been applied to the scene file
- `rejected` — dismissed; scene file was not changed
- `modified` — the suggested text was edited before acceptance

---

## Continuity Files

### `continuity/facts.json`

Stores world facts extracted from scenes as they advance to `revised` status.

**Format:**
```json
{
  "ember-gate-location": {
    "fact": "The Ember Gate is located east of Ashenveil",
    "source": "scene 1.6",
    "established": "2026-03-15"
  },
  "elara-seal-lost": {
    "fact": "Elara lost her messenger seal at the Redford checkpoint",
    "source": "scene 1.4",
    "established": "2026-03-16"
  }
}
```

Facts are auto-extracted by the `novel:scene-status-updated` event handler
when a scene advances to `revised` or higher.

### `continuity/character-states.json`

Tracks what each character knows, possesses, or believes at the end of each scene.

**Format:**
```json
{
  "Elara Voss": {
    "after-scene-1-4": {
      "knows": ["Brotherhood is following her", "Redford checkpoint is compromised"],
      "possesses": ["Concord letter", "travel provisions"],
      "believes": ["Sienna is trustworthy"]
    }
  }
}
```

---

## Analysis Tool Technical Details

### `analyze_pacing`

Segment classification algorithm:
- **ACTION:** Lines containing physical movement verbs (ran, struck, crossed, grabbed)
  and environmental descriptions without interior thought
- **DIALOGUE:** Lines within quotation marks and immediately adjacent attribution lines
- **REFLECTION:** Interior monologue, sensory perception passages, memory sequences

Percentages are word-count-based, not line-count-based.

### `analyze_readability`

Uses Flesch-Kincaid Grade Level formula:
```
FKGL = 0.39 * (words/sentences) + 11.8 * (syllables/words) - 15.59
```

Syllable count is approximated by counting vowel clusters per word.

### `analyze_continuity`

Reads:
1. Scene prose via `novel_scene_read`
2. `continuity/facts.json` for established world facts
3. `continuity/character-states.json` for character knowledge state

Comparison strategy: keyword extraction from the scene, then fact-table
lookup for known entities (character names, locations, items).

---

## Tool Reference

### `/PNW-edit` command

| Field          | Detail                                           |
|----------------|--------------------------------------------------|
| Registered in  | `extensions/novel-edit.ts`                       |
| Description    | Enter editing mode for a scene                   |
| Usage          | `/PNW-edit`                                      |
| Side effect    | Signals AI mode shift; no file changes           |

### `analyze_pacing`

| Field          | Detail                                           |
|----------------|--------------------------------------------------|
| Registered in  | `extensions/novel-edit.ts`                       |
| Label          | Analyze Pacing                                   |
| Input          | chapter, scene                                   |
| Output         | Segment percentages and narrative assessment     |

### `analyze_dialogue`

| Field          | Detail                                           |
|----------------|--------------------------------------------------|
| Registered in  | `extensions/novel-edit.ts`                       |
| Label          | Analyze Dialogue                                 |
| Input          | chapter, scene                                   |
| Output         | Tag frequency, attribution report                |

### `analyze_wordcount`

| Field          | Detail                                           |
|----------------|--------------------------------------------------|
| Registered in  | `extensions/novel-edit.ts`                       |
| Label          | Analyze Word Count                               |
| Input          | none                                             |
| Output         | Per-scene/chapter table with totals              |

### `analyze_continuity`

| Field          | Detail                                           |
|----------------|--------------------------------------------------|
| Registered in  | `extensions/novel-edit.ts`                       |
| Label          | Analyze Continuity                               |
| Input          | chapter, scene                                   |
| Output         | List of fact discrepancies or "No issues found"  |

### `analyze_readability`

| Field          | Detail                                           |
|----------------|--------------------------------------------------|
| Registered in  | `extensions/novel-edit.ts`                       |
| Label          | Analyze Readability                              |
| Input          | chapter, scene                                   |
| Output         | FK grade level, sentence length distribution     |

### `edit_suggest`

| Field          | Detail                                           |
|----------------|--------------------------------------------------|
| Registered in  | `extensions/novel-edit.ts`                       |
| Label          | Suggest Edit                                     |
| Input          | chapter, scene, original_text, suggested_text, rationale |
| Output         | Suggestion ID                                    |
| Side effect    | Appends to `.pi/edit-suggestions.json`           |

### `edit_line`

| Field          | Detail                                           |
|----------------|--------------------------------------------------|
| Registered in  | `extensions/novel-edit.ts`                       |
| Label          | Line Edit                                        |
| Input          | chapter, scene, line_start, line_end, new_content|
| Output         | Confirmation of change                           |
| Side effect    | Directly modifies scene file                     |

---

## Related Files

| File                          | Purpose                                         |
|-------------------------------|-------------------------------------------------|
| `extensions/novel-edit.ts`    | All edit and analysis tools; /PNW-edit command  |
| `.pi/edit-suggestions.json`   | Pending/accepted/rejected suggestions           |
| `continuity/facts.json`       | Established world facts                         |
| `continuity/character-states.json` | Character knowledge snapshots              |
| `help/suggestions/help.md`    | Managing the suggestion queue                   |
