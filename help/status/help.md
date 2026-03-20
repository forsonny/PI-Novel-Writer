# /PNW-status — Help Reference

Display the full project dashboard: word counts, chapter breakdown, scene
statuses, and project health alerts.

---

## Command

### `/PNW-status`

**Usage:**
```
/PNW-status
```

**Parameters:** none

**What it does:**
1. Reads current word counts for every scene
2. Aggregates by chapter (total words, scene count, dominant status)
3. Computes overall project progress against `targetWordCount`
4. Reads API cost tracking from `.pi/progress.json`
5. Detects gaps: chapters with no scenes, scenes with no summaries, outline-only scenes
6. Renders a formatted dashboard in the terminal

**Requirements:** A project must be loaded (`/PNW-init` or `/PNW-load`)

**When to use:**
- At the start of every session to reorient
- After a long writing session to see progress
- After structural changes (new chapters, moved scenes) to verify the project looks correct
- When the AI seems confused about the project structure

---

## Dashboard Output

```
=== THE EMBER GATE ===
Author: Your Name   Genre: fantasy   Workflow: novel

WORD COUNT
  42,310 / 120,000  [==========>            ] 35%
  Daily goal: 1,000 words  (today: 847)

CHAPTERS
  Ch 1  The Awakening           8 scenes    14,200 wds  [draft    ]
  Ch 2  The Road to Ashenveil   5 scenes     8,100 wds  [draft    ]
  Ch 3  The Brotherhood        6 scenes     9,800 wds  [outline  ]
  Ch 4  Ember Gate              4 scenes     7,400 wds  [outline  ]
  Ch 5  (no scenes)             0 scenes         0 wds  [--       ]
  Ch 6  The Reckoning          1 scene         810 wds  [draft    ]

ALERTS
  ! Ch 3 has no chapter summary
  ! Ch 5 has no scenes — is this intentional?
  ! 3 scenes missing summaries across the project

API COST
  Session: $0.18   Total: $4.22
```

---

## Chapter Status Logic

The chapter status shown in `/PNW-status` is determined by the **dominant** scene
status in that chapter:

| Dominant scene status | Chapter shows |
|-----------------------|---------------|
| All outline           | outline       |
| Any draft or higher   | draft         |
| All revised or higher | revised       |
| All polished or higher| polished      |
| All final             | final         |

"Dominant" means the majority status. A chapter with 5 revised scenes and 1 draft
scene shows `draft`.

---

## Alerts

The dashboard emits alerts for these conditions:

| Alert                                | Meaning                                             |
|--------------------------------------|-----------------------------------------------------|
| Chapter has no scenes                | An outline exists but no manuscript scenes yet      |
| Chapter has no chapter summary       | Useful reminder when chapter has many drafted scenes|
| N scenes missing summaries           | These scenes are not contributing to AI context     |
| Scene count and outline mismatch     | Outline plans X scenes but Y exist in manuscript    |

---

## AI-Callable Tools Used by /PNW-status

### `novel_chapter_list`

**Parameters:** none

**Returns:**
```json
[
  {
    "chapter": 1,
    "title": "The Awakening",
    "sceneCount": 8,
    "wordCount": 14200,
    "statuses": ["draft", "draft", "draft", "outline", ...]
  },
  ...
]
```

### `novel_scene_list`

**Parameters:**

| Parameter | Type   | Required | Description                  |
|-----------|--------|----------|------------------------------|
| `chapter` | number | no       | Filter to a specific chapter |

**Returns:** Array of scene refs with chapter, scene, title, status, word_count.

### `analyze_wordcount`

Detailed word count breakdown. The AI can call this for a per-scene report.

**Parameters:** none

**Returns:** A table of chapter/scene/word_count with totals.

### `progress_overview`

**Parameters:** none

**Returns:**
```json
{
  "totalWords": 42310,
  "targetWords": 120000,
  "dailyGoal": 1000,
  "todayWords": 847,
  "sessionCost": 0.18,
  "totalCost": 4.22
}
```

---

## Common Follow-Up Commands After /PNW-status

```
/PNW-next              <- get specific guidance based on what status shows
/PNW-summarize         <- fix missing/stale summaries flagged in alerts
/PNW-bible             <- check bible entries if world-building is sparse
/PNW-outline           <- check outlines if chapters are lacking structure
/PNW-sprint            <- jump directly into writing
```
