# /PNW-sprint — Help Reference

Start a timed writing sprint to focus your session and track velocity.

---

## Command

### `/PNW-sprint`

Default 25-minute Pomodoro sprint.

**Usage:**
```
/PNW-sprint
```

### `/PNW-sprint <minutes>`

Sprint for a custom duration.

**Usage:**
```
/PNW-sprint 15    <- 15-minute sprint
/PNW-sprint 45    <- 45-minute sprint
/PNW-sprint 60    <- 1-hour session block
```

**Parameters:**

| Parameter  | Type   | Required | Description                                    |
|------------|--------|----------|------------------------------------------------|
| `minutes`  | number | no       | Sprint duration in minutes (default: 25)       |

**What it does:**
1. Records the start timestamp and word count baseline
2. Sets a countdown timer in the pi footer (visible throughout the session)
3. Tracks words written during the sprint via the `agent_end` event
4. When the timer expires, shows a sprint completion report:
   - Duration
   - Words written
   - Words per minute (WPM)
   - Progress toward daily goal

**Requirements:** A project must be loaded.

**When to use:**
- Any time you want a focused, time-boxed writing session
- When you feel distracted and need a defined start/end structure
- To track your writing velocity (words per minute) across sessions
- When you are close to your daily word goal and want a final push

---

## Sprint Completion Report

When the sprint timer expires:

```
=== SPRINT COMPLETE ===
Duration:    25 minutes
Words:       623
WPM:         24.9
Goal impact: 847 / 1,000 today  (623 words this sprint)
             [=========>  ] 85%

Nice work. You are 153 words from your daily goal.
```

---

## Aborting a Sprint

To stop a sprint before the timer expires:
- Tell the AI: "Stop the sprint"
- Or: "End the sprint early"

The sprint will end and show a partial report. Words written up to that
point are counted toward your daily total.

---

## Sprint Best Practices

**The 25-minute default (Pomodoro technique):**
- Write for 25 minutes without interruption
- Take a 5-minute break
- After 4 sprints, take a 20-minute break
- This rhythm prevents fatigue and maintains quality

**For short sessions:**
```
/PNW-sprint 15    <- fits in a lunch break or commute
```

**For intensive sessions:**
```
/PNW-sprint 45    <- deeper work blocks with longer focus window
```

**Avoid:**
- Checking messages during a sprint
- Switching between scenes during a sprint (pick one scene per sprint)
- Running editing tasks during a drafting sprint (separate sprint types)

---

## Related Tools

### `progress_overview`

The AI calls this at sprint completion to compute your daily goal progress.
You can also call it mid-sprint to check your word count:

> "How many words have I written today?"

---

## Sprint and Daily Goal Integration

Sprint word counts feed directly into your daily goal:

```
Daily goal: 1,000 words

Before sprint:  247 / 1,000
After Sprint 1 (612 words):  859 / 1,000
After Sprint 2 (220 words):  1,079 / 1,000  <- GOAL MET
```

Running `/PNW-progress` after a sprint shows the updated daily total.
