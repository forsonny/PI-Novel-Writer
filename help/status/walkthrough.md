# /PNW-status — Walkthrough

How to read the dashboard and act on what it shows.

---

## Part 1: Reading the Dashboard

### Word count bar

```
42,310 / 120,000  [==========>            ] 35%
```

- First number: total words across all scenes with status `draft` or higher
- Second number: `targetWordCount` from `project.json`
- Percentage: progress toward the target
- Outline-only scenes (`status: outline`) do not count toward the total

### Chapter table

```
Ch 1  The Awakening           8 scenes    14,200 wds  [draft    ]
Ch 3  The Brotherhood         6 scenes     9,800 wds  [outline  ]
Ch 5  (no scenes)             0 scenes         0 wds  [--       ]
```

- Chapter titles come from the outline file, not the manuscript directory name
- `[outline]` means scenes exist but none have been drafted yet
- `[--]` means no scenes have been created for this chapter at all
- A chapter showing `[final]` means every scene in it has been marked `final`

### Alerts section

Alerts are warnings, not errors. The project is still usable. Common examples:

- `! Ch 5 has no scenes` — you may have planned this chapter in the outline
  but haven't started the scenes yet; this is normal if you are still drafting
- `! 3 scenes missing summaries` — these scenes are invisible to the AI when
  it helps you write later chapters; run `/PNW-summarize` to fix

---

## Part 2: Common Scenarios

### Scenario: Starting a new session

You open pi and load your project. Run `/PNW-status` to see where you left off.

Look at:
1. The word count bar — how far are you from your target?
2. The chapter table — which chapters are still in `outline` status?
3. Alerts — are there missing summaries to generate?

Then run `/PNW-next` for specific next-step guidance.

---

### Scenario: You wrote several scenes and want to check progress

After a few hours of writing:

```
/PNW-status
```

You will see the updated word count reflecting the scenes you just wrote.
If any new scenes are still showing `outline` status, ask the AI to run
`novel_scene_status` to advance them to `draft`.

If alerts appear about missing summaries for the scenes you just wrote, run:
```
/PNW-summarize
```

---

### Scenario: A chapter shows fewer scenes than expected

You planned 6 scenes for Chapter 3 in your outline, but the dashboard
shows 4. Possible causes:

1. You haven't created the other 2 scenes yet (normal if still drafting)
2. A scene was deleted (check `notes/deleted-scenes/`)
3. A scene file is present but the frontmatter chapter/scene numbers are wrong

**Fix for case 3:** Run `novel_validate` to find frontmatter issues,
then `novel_reindex` to sync everything.

---

### Scenario: The API cost seems high

If `/PNW-status` shows an API cost higher than expected:

- Cost is cumulative — it includes all sessions since the project started
- Long editing sessions with `analyze_*` tools cost more than straight drafting
- Consider using `/PNW-sprint` for focused drafting sessions to reduce exploratory
  AI calls

Use `cost_estimate` before running expensive operations like bulk edits or
full-project continuity checks.

---

## Part 3: Using Status to Plan Your Session

| Dashboard shows              | What to do                              |
|------------------------------|-----------------------------------------|
| Many outline-status chapters | Run outline skills or start drafting    |
| Word count < 20% of target   | Prioritize drafting; use sprint mode    |
| Several missing summaries    | Run /PNW-summarize before writing       |
| Chapters stuck at draft      | Begin editing pass; use dev-edit skill  |
| All chapters revised+        | Run copy-edit skill; then /PNW-compile  |
| Word count > 100% of target  | You are over your target; consider cuts |

---

## Part 4: Status and the AI's Awareness

`/PNW-status` is primarily for you. The AI does not automatically read the
dashboard output. However, the underlying data (scene index, word counts) is
always available to the AI via `novel_chapter_list` and `novel_scene_list`.

If the AI seems confused about your project structure, ask it directly:
```
"Run novel_chapter_list"
"Run novel_scene_list"
```

This gives the AI the same structured data that `/PNW-status` displays to you.
