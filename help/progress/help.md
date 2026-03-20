# /PNW-progress — Help Reference

Display the word count progress dashboard and manage writing goals.

---

## Command

### `/PNW-progress`

**Usage:**
```
/PNW-progress
```

**Parameters:** none

**What it does:**
1. Reads current project word count from scene files
2. Reads daily and total word count goals from `.pi/progress.json`
3. Reads the last 7 days of word count history
4. Reads cumulative and session API cost
5. Renders a progress dashboard with visual bars and sparkline graph

**Requirements:** A project must be loaded.

**When to use:**
- At the start of a session to see how you are tracking against goals
- At the end of a session to record and celebrate daily progress
- When planning a writing sprint to know how far you are from your daily target
- When reviewing your productivity over the past week

---

## Dashboard Output

```
=== PROGRESS: THE EMBER GATE ===

TOTAL PROGRESS
  67,240 / 120,000 words  [==========>       ] 56%

DAILY GOAL
  Today: 847 / 1,000 words  [=========>  ] 85%
  To go: 153 words

LAST 7 DAYS
  Mon 847  [=========>  ]
  Tue 0    [            ]
  Wed 1204 [============]  <- best day
  Thu 890  [=========   ]
  Fri 0    [            ]
  Sat 543  [=====>      ]
  Sun 320  [===         ]

  7-day total: 3,804 words   avg: 543/day

API COST
  This session:  $0.24
  Project total: $8.17
```

---

## Goal Management Tool

### `progress_set_goal`

Set or update word count targets.

**Parameters:**

| Parameter | Type   | Required | Description                           |
|-----------|--------|----------|---------------------------------------|
| `daily`   | number | no       | Daily word count target               |
| `total`   | number | no       | Total project word count target       |

**Examples:**
> "Set my daily goal to 1,500 words"
> "Update my total word count target to 100,000 words"
> "Set daily goal 500 and total goal 80000"

**Notes:**
- `daily` sets the goal in `.pi/progress.json` → `dailyGoal`
- `total` updates `targetWordCount` in `project.json`
- Both can be set in the same call
- Setting a goal to 0 effectively disables it (no progress bar shown)

---

### `progress_overview`

Read raw progress data without the visual dashboard.

**Parameters:** none

**Returns:**
```json
{
  "totalWords": 67240,
  "targetWords": 120000,
  "dailyGoal": 1000,
  "todayWords": 847,
  "weekHistory": [
    { "date": "2026-03-14", "words": 847 },
    { "date": "2026-03-15", "words": 0 },
    ...
  ],
  "sessionCost": 0.24,
  "totalCost": 8.17
}
```

**When the AI calls it:**
- When you ask about your progress without running `/PNW-progress`
- When computing how many words remain to a goal
- When the sprint completion summary references your daily progress

---

## Daily Word Count Tracking

Word counts are automatically updated at the end of each turn via the
`agent_end` event handler. Every time the AI completes a response, the
system computes the delta in scene word counts and adds it to today's
total in `.pi/progress.json`.

**This means:**
- You do not need to manually record word counts
- Word counts are tracked whether you use `/PNW-sprint` or write freely
- Adding words, editing words, and deleting words all affect the daily count
- The count reflects net words added (edits that shorten scenes reduce it)

---

## Common Workflows

```
Start of session:
  /PNW-progress    <- see where you stand against daily goal

During session:
  /PNW-sprint      <- focused sprint to hit a target

End of session:
  /PNW-progress    <- see words written today

Change goals:
  Ask AI: "Set my daily goal to 800 words"
  Ask AI: "Update my total target to 100,000 words"
```
