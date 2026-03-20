# /PNW-sprint — Resources

Technical reference for sprint timing, word tracking, and session storage.

---

## Sprint Implementation

Sprints use pi's footer widget system to display the countdown timer:

```
pi.setWidget("footer", {
  type: "countdown",
  duration: minutes * 60,
  label: "Sprint",
  onExpire: handleSprintEnd
})
```

The footer widget is visible throughout the sprint session.

---

## Word Count Tracking During Sprint

Sprint word count is computed by comparing the scene word counts at sprint
start against scene word counts at sprint end.

```
Sprint start:
  baselineWords = sum of all scene word_counts

Sprint end:
  finalWords = sum of all scene word_counts (re-scanned)
  sprintWords = finalWords - baselineWords
  wpm = sprintWords / minutes
```

The same mechanism is used by the `agent_end` handler for daily tracking.
Sprint words are not double-counted — the daily total is the same regardless
of whether a sprint was running.

---

## Sprint Record Storage

Each completed sprint is stored in `.pi/progress.json`:

```json
{
  "history": {
    "2026-03-20": {
      "words": 1030,
      "cost": 0.31,
      "sprints": [
        {
          "start": "2026-03-20T09:00:00Z",
          "end": "2026-03-20T09:25:00Z",
          "duration": 25,
          "words": 580,
          "wpm": 23.2
        },
        {
          "start": "2026-03-20T09:32:00Z",
          "end": "2026-03-20T09:57:00Z",
          "duration": 25,
          "words": 450,
          "wpm": 18.0
        }
      ]
    }
  }
}
```

---

## Sprint Duration Limits

The sprint command accepts any positive integer for minutes. There is no
maximum enforced, but the footer timer will only display hours:minutes:seconds
up to 99:59:59.

Minimum practical duration: 1 minute (useful for testing, not real writing).

---

## Tool Reference

### `/PNW-sprint` command

| Field          | Detail                                              |
|----------------|-----------------------------------------------------|
| Registered in  | `extensions/novel-progress.ts`                      |
| Description    | Start a timed writing sprint                        |
| Usage          | `/PNW-sprint` or `/PNW-sprint <minutes>`            |
| Side effect    | Sets footer timer; records sprint in progress.json  |

---

## Related Files

| File                            | Purpose                                       |
|---------------------------------|-----------------------------------------------|
| `extensions/novel-progress.ts`  | Sprint command; timer and tracking logic       |
| `.pi/progress.json`             | Sprint records and daily word counts           |
| `help/progress/help.md`         | Word count goals and progress dashboard        |
