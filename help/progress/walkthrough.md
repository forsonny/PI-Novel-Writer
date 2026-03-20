# /PNW-progress — Walkthrough

How to use progress tracking to build and maintain a writing habit.

---

## Part 1: Setting Up Your Goals

### Set a realistic daily goal

The default daily goal is 1,000 words. This is sustainable for most writers
working for 45-60 minutes per day.

Adjust based on your schedule:

> "Set my daily goal to 500 words"    <- for 20-30 min sessions
> "Set my daily goal to 1500 words"   <- for dedicated 90 min sessions
> "Set my daily goal to 2000 words"   <- for intensive drafting periods

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
- How far you are from your daily goal today
- Whether you have a streak or recent momentum to maintain

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

The AI calls `progress_overview` and reports your current daily total.

---

### End of session

```
/PNW-progress
```

Review:
- Did you hit your daily goal?
- How does today compare to your weekly average?
- What is your momentum trend (is the sparkline rising or falling)?

---

## Part 3: Reading the Weekly Sparkline

The 7-day history bar chart shows your writing velocity over the past week.

**Patterns to recognize:**

```
Mon 1200 [============]
Tue 1150 [===========]
Wed 900  [=========  ]
Thu 0    [           ]  <- missed day
Fri 1400 [===========]  <- recovery
Sat 800  [========   ]
Sun 0    [           ]  <- rest day
```

This is a healthy pattern. One rest day per week is sustainable.

```
Mon 200  [==         ]
Tue 150  [=          ]
Wed 0    [           ]
Thu 0    [           ]
Fri 100  [           ]
Sat 0    [           ]
Sun 300  [===        ]
```

This pattern suggests momentum problems. Options:
- Lower your daily goal to something you can actually hit
- Use `/PNW-sprint` to make sessions more focused
- Block a specific daily writing time and treat it as an appointment

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

## Part 5: Understanding API Cost

The progress dashboard shows API cost to help you understand the financial
impact of your writing sessions.

- **Session cost:** Cost of the current pi session (resets when you restart pi)
- **Project total:** All API costs since the project was initialized

**What drives cost:**
- Drafting scenes (moderate — one model call per scene section)
- Running editing skills (higher — multiple analysis passes)
- Running `analyze_*` tools (moderate per call)
- Long context windows from large bible/summary injections (higher per call)

**Tips for managing cost:**
- Use `/PNW-sprint` for focused drafting (fewer exploratory calls)
- Run `cost_estimate` before bulk operations
- Increase `contextBudget.*` only if you need more context; smaller budgets
  reduce cost per call

---

## Part 6: Long-Term Progress Tracking

The `.pi/progress.json` file stores your full history:
- Daily word counts going back to project start
- API cost per day
- Sprint session records

This is a plain JSON file you can open and read. It will eventually show you:
- Your average pace across the entire project
- Which days and times you write most productively
- Your total invested cost for the novel

No summary view for the full history is currently built into the dashboard
(it shows 7 days). To see longer history, ask the AI:

> "Show me my monthly word count totals from progress.json"

The AI reads the file and computes the summary for you.
