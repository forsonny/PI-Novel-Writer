# /PNW-progress — Resources

Technical reference for progress tracking internals and data storage.

---

## Progress Data File

```
.pi/progress.json
```

**Format:**
```json
{
  "dailyGoal": 1000,
  "history": {
    "2026-03-14": {
      "words": 847,
      "cost": 0.18,
      "sprints": [
        { "start": "2026-03-14T09:00:00Z", "end": "2026-03-14T09:25:00Z", "words": 612 }
      ]
    },
    "2026-03-15": {
      "words": 0,
      "cost": 0,
      "sprints": []
    }
  },
  "costTotal": 8.17
}
```

**Fields:**

| Field         | Type   | Description                                    |
|---------------|--------|------------------------------------------------|
| `dailyGoal`   | number | Target words per day                           |
| `history`     | object | Date-keyed records of daily activity           |
| `history[date].words`  | number | Net words added that day              |
| `history[date].cost`   | number | API cost in USD for that day          |
| `history[date].sprints`| array  | Sprint records for that day           |
| `costTotal`   | number | Cumulative project API cost (USD)              |

---

## Automatic Word Count Updates

The `agent_end` event fires at the end of every AI response turn.

```
agent_end handler:
  1. Re-scan all scene files
  2. Compute current total word count (sum of all non-outline scenes)
  3. delta = currentTotal - previousTotal
  4. If delta != 0:
     today = YYYY-MM-DD (local time)
     progress.json[today].words += delta
     Write progress.json
```

This means:
- Adding 200 words increases today's count by 200
- Deleting 50 words decreases today's count by 50
- Net count is tracked, not gross additions

---

## API Cost Tracking

API cost is estimated per turn and accumulated in `.pi/progress.json`.

Cost calculation:
```
inputTokens  * (model input price)
outputTokens * (model output price)
```

Actual costs vary by model, region, and Anthropic pricing changes.
The cost displayed is an estimate and may differ slightly from your
actual Anthropic invoice.

---

## Daily Goal Storage

The daily goal is stored in `.pi/progress.json` → `dailyGoal`.
The total project target is stored in `project.json` → `targetWordCount`.

Both are used by `/PNW-progress` to compute the progress bars.

---

## Sprint Records

Each sprint (started via `/PNW-sprint`) creates a record:

```json
{
  "start": "2026-03-14T09:00:00Z",
  "end": "2026-03-14T09:25:00Z",
  "duration": 25,
  "words": 612,
  "wpm": 24.5
}
```

Sprint records are appended to the day's `sprints` array. They do not
double-count words — the sprint's word count is part of the day's total,
not in addition to it.

---

## Tool Reference

### `/PNW-progress` command

| Field          | Detail                                              |
|----------------|-----------------------------------------------------|
| Registered in  | `extensions/novel-progress.ts`                      |
| Description    | Display progress dashboard                          |
| Usage          | `/PNW-progress`                                     |
| Side effect    | Read-only                                           |

### `progress_overview`

| Field          | Detail                                              |
|----------------|-----------------------------------------------------|
| Registered in  | `extensions/novel-progress.ts`                      |
| Label          | Progress Overview                                   |
| Input          | none                                                |
| Output         | JSON with word counts, goals, history, costs        |

### `progress_set_goal`

| Field          | Detail                                              |
|----------------|-----------------------------------------------------|
| Registered in  | `extensions/novel-progress.ts`                      |
| Label          | Set Writing Goal                                    |
| Input          | daily?, total?                                      |
| Output         | Confirmation of updated goals                       |
| Side effect    | Updates `dailyGoal` in `.pi/progress.json`;         |
|                | updates `targetWordCount` in `project.json`         |

### `agent_end` event

| Field          | Detail                                              |
|----------------|-----------------------------------------------------|
| Registered in  | `extensions/novel-progress.ts`                      |
| Trigger        | End of every AI response turn                       |
| Side effect    | Re-scans scenes; updates `.pi/progress.json`        |

---

## Related Files

| File                            | Purpose                                       |
|---------------------------------|-----------------------------------------------|
| `extensions/novel-progress.ts`  | Progress command and tracking tools           |
| `.pi/progress.json`             | Daily word counts, goals, sprint records      |
| `project.json`                  | Total word count target                       |
| `help/sprint/help.md`           | Timed writing sprints                         |
| `help/status/help.md`           | Full project dashboard including word counts  |
