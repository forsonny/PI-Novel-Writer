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
  "goals": { "daily": 1000, "total": 90000 },
  "history": {
    "2026-03-14": 847,
    "2026-03-15": 1600
  }
}
```

**Fields:**

| Field         | Type   | Description                                    |
|---------------|--------|------------------------------------------------|
| `goals.daily` | number | Daily target; current project settings are authoritative |
| `goals.total` | number | Manuscript target; current project settings are authoritative |
| `history`     | object | UTC date-keyed snapshots of total manuscript words |
| `history[date]` | number | Total manuscript words at the latest saved update that date |

---

## Automatic Word Count Updates

The `agent_end` event fires at the end of every AI response turn.

```
agent_end handler:
  1. Compute current total scene-body word count
  2. today = YYYY-MM-DD (UTC)
  3. progress.history[today] = currentTotal
  4. Write progress.json
```

The daily display compares the current total with yesterday's snapshot, when
available. The stored history is not an operation-by-operation activity ledger.

---

## API Cost Tracking

Usage is read from the current Pi session, using the same entry scope as its
footer: assistant and nested tool usage, compaction and branch-summary usage.
It is recomputed rather than incremented at every `agent_end`, avoiding duplicate
counting after retries or reloads. It is a reported estimate, not billing.

`progress_overview` returns `session_usage_cost_usd` and `usage_note`. Legacy
project cost fields are not treated as authoritative or returned as a current
zero-cost claim. If no session usage interface is available, the dashboard says
that the estimate is unavailable.

---

## Daily Goal Storage

The authoritative daily goal is `project.json` → `dailyWordGoal`.
The authoritative total target is `project.json` → `targetWordCount`.

`progress_set_goal` updates those settings and `.pi/progress.json`'s `goals`
together. Both dashboards use those project settings. Set a desired goal once
to reconcile a legacy project whose old stores disagreed.

---

## Sprint Records

The sprint reports its word delta in the session UI. A separate durable sprint
array is not currently saved in `progress.json`.

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
| Side effect    | Updates `dailyWordGoal` / `targetWordCount` in `project.json` and synchronizes progress goals |

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
| `.pi/progress.json`             | Word-count snapshots and stored goals         |
| `project.json`                  | Authoritative daily and total word targets    |
| `help/sprint/help.md`           | Timed writing sprints                         |
| `help/status/help.md`           | Full project dashboard including word counts  |
