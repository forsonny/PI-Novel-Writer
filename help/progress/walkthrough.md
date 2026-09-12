# /PNW-progress — Walkthrough

How to use progress tracking to build and maintain a writing habit.

---

## Part 1: Setting Up Your Goals

### Set a realistic daily goal

The default daily goal is 2,000 words. Choose a goal that fits your routine.

Adjust based on your schedule:

> "Set my daily goal to 500 words"
> "Set my daily goal to 1500 words"
> "Set my daily goal to 2000 words"

Both dashboards use the same project settings. Setting a goal updates both views;
editing the target in `project.json` is also reflected in the progress view.

### Set your total project target

If you know your target length:

> "Set my total word count goal to 90,000 words"

Or update it in `project.json` directly:
```json
{
  "targetWordCount": 90000
}
```

---

## Part 2: Daily Progress Routine

### Start of session

```
/PNW-progress
```

This shows:
- The dashboard's derived word change for today and how it compares with your daily goal
- Your current total manuscript words and seven stored daily total snapshots

**If you are far from your goal:**
```
/PNW-sprint
```
Start a 25-minute sprint to build momentum.

**If you are close to your goal:**
Write freely — the word count updates automatically after each AI turn.

---

### Mid-session check

Ask the AI: "How many words have I written today?"

The AI calls `progress_overview` and derives today's change from stored total-manuscript snapshots. Treat that result as an estimate when dates are missing or the manuscript was edited.

---

### End of session

```
/PNW-progress
```

Review:
- Did the dashboard's derived word change reach your daily goal?
- What is the current total manuscript word count?
- Do the seven stored totals reflect the manuscript growth or edits you expected?

---

## Part 3: Reading the Seven-Day Chart

The chart shows seven UTC-date snapshots of the manuscript's **total** word
count. Each bar is scaled against the largest stored total in those seven dates.
It is not daily writing velocity, a streak, or a weekly average.

Interpret it cautiously:
- A higher total can reflect new prose or expansion edits.
- A lower total can reflect cuts or rewrites.
- A zero can mean no snapshot was stored for that date; it does not prove that no writing happened.
- Differences between snapshots are not a precise activity log because missing dates and edits can distort them.

---

## Part 4: Using Progress with Sprints

Sprints and progress tracking work together. When a sprint ends, it
shows you how many words you wrote in the sprint period. The daily
count in `/PNW-progress` will reflect those words.

**Typical sprint-based session:**
```
/PNW-progress           <- see starting position (daily: 0/1000)
/PNW-sprint             <- 25-minute sprint
  ... write ...
Sprint ends: 640 words in 25 min (25.6 WPM)

/PNW-progress           <- daily: 640/1000
/PNW-sprint             <- second sprint to finish the goal
  ... write ...
Sprint ends: 430 words in 25 min

/PNW-progress           <- daily: 1070/1000 [GOAL MET]
```

---

## Part 5: Understanding Reported Usage

Both dashboards show the current Pi session's reported usage estimate, including
assistant, nested tool, and compaction usage. Resuming the same saved session
retains its usage. This is not a project lifetime total or a verified charge.
Subscription-backed sessions may also report such estimates.

`cost_estimate` estimates a selected text's token footprint, not the full cost
of completing a workflow. For one scene, specify its chapter and scene numbers.
Repeated history, other context, prompts and later revision passes are excluded.

---

## Part 6: Long-Term Progress Tracking

The `.pi/progress.json` file stores UTC-date snapshots of total manuscript words
and stored goals. It is not a precise daily activity log: missing days and edits can
make derived daily deltas misleading. The current dashboard shows seven dates.

No summary view for the full history is currently built into the dashboard
(it shows 7 days). To see longer history, ask the AI:

> "Show me the stored manuscript-total snapshots by month from progress.json"

The AI can group the stored snapshots for you, but should not present them as
monthly words written, daily velocity, streaks, or reliable weekly averages.
