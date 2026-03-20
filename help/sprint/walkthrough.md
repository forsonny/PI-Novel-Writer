# /PNW-sprint — Walkthrough

How to use sprints effectively for consistent daily writing.

---

## Part 1: Your First Sprint

**Setup:** Have a scene you are ready to write or continue. Sprints work
best when you already know what you are about to write — the sprint creates
focus, not direction. If you are not sure what to write, review your outline
first.

**Step 1 — Review your target scene:**
Ask the AI: "Read the outline for chapter 2, scene 3"

**Step 2 — Start the sprint:**
```
/PNW-sprint
```

A 25-minute countdown appears in the footer. Begin writing immediately.

**Step 3 — Write without stopping:**
Do not edit. Do not reread. Do not second-guess. Write forward.
If you get stuck, write placeholder notes like `[expand this confrontation]`
and keep moving.

**Step 4 — Sprint ends:**
```
=== SPRINT COMPLETE ===
Duration: 25 minutes
Words:    612
WPM:      24.5
```

---

## Part 2: Interpreting Your WPM

| WPM range | Assessment                                          |
|-----------|-----------------------------------------------------|
| < 10      | Very slow — likely editing as you write; try not to look back |
| 10-20     | Steady pace — common for literary fiction with complex prose |
| 20-30     | Good velocity — healthy for most drafting sessions  |
| 30-40     | Fast velocity — comfortable when you know your material well |
| 40+       | Very fast — common when writing dialogue-heavy or action scenes |

WPM will naturally vary by scene type. Action scenes tend to be faster than
introspective or world-building scenes. Do not optimize for WPM — use it
as a diagnostic, not a target.

---

## Part 3: Two-Sprint Session (Most Common)

**Target: 1,000-word daily goal in two sprints**

```
/PNW-sprint         <- Sprint 1 (25 min), target ~600 words
   ... write scene 2.3 ...
Sprint ends: 580 words

Take a 5-minute break.

/PNW-sprint         <- Sprint 2 (25 min), target ~420 more words
   ... continue scene 2.3 or begin 2.4 ...
Sprint ends: 450 words

/PNW-progress       <- verify: 1,030 / 1,000 words  [GOAL MET]
/PNW-summarize 2 3  <- summarize what you just wrote
```

---

## Part 4: Sprint for Editing vs. Drafting

Sprints are most useful for drafting, but work for editing too.

**Drafting sprint:**
```
/PNW-sprint
```
Write new prose. No self-editing during the sprint.

**Editing sprint:**
```
/PNW-sprint 20    <- shorter block is better for editing focus
```
Work through suggestions for one chapter. Accept or reject each item.
Do not start new analysis tools mid-sprint — finish the queue you have.

**The key difference:** In a drafting sprint, your word count will rise.
In an editing sprint, your word count may stay flat or slightly decrease
(you are cutting and refining, not adding). Both are valid uses.

---

## Part 5: Choosing Sprint Duration

### Shorter sprints (10-15 minutes)

Best for:
- Writers who struggle with sustained focus
- Short sessions (lunch, commute, before meetings)
- New habit formation — short sprints feel achievable and build momentum

```
/PNW-sprint 10    <- entry-level commitment
/PNW-sprint 15    <- standard short sprint
```

### Standard sprint (25 minutes)

The Pomodoro sweet spot. Long enough for depth, short enough to stay sharp.
Best for most writers in a normal session.

```
/PNW-sprint       <- default
```

### Long sprints (40-60 minutes)

Best for:
- Experienced writers with strong focus capacity
- Writers in a flow state who do not want to be interrupted at 25 minutes
- High-output days (NaNoWriMo, intensive drafting weeks)

```
/PNW-sprint 45
/PNW-sprint 60
```

Note: after 60+ minutes, quality often declines. Two 30-minute sprints with
a break typically produce better prose than one 60-minute marathon.

---

## Part 6: Sprint Ritual

High-output writers often use a consistent pre-sprint ritual:

1. `/PNW-progress` — check daily standing
2. Review the scene outline: "Read the outline for scene X"
3. `/PNW-sprint` — start the clock
4. Write without stopping
5. Sprint ends — read the completion report
6. Take a break (5+ minutes away from screen)
7. `/PNW-summarize <ch> <sc>` — summarize the scene while it is fresh
8. Repeat or end the session

The ritual reduces the mental overhead of "deciding what to do" — you
always know the sequence, so you get to writing faster.

---

## Part 7: When You Get Stuck Mid-Sprint

Do not stop the sprint. Instead:

1. **Write a placeholder:** `[STUCK — describe what Elara sees when she
   enters the chamber]` and skip ahead

2. **Write what you know:** Skip to the next beat you are confident about
   and write that. Go back to the gap later.

3. **Ask the AI a single focused question:** "What would Elara notice first
   in this chamber?" Take the first answer and continue writing. Do not
   refine it during the sprint.

The goal of the sprint is momentum. Perfectionism kills sprints.
Address gaps in a dedicated editing session after the sprint.
