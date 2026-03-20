# Summary System — Walkthrough

A step-by-step guide to understanding and using the summary system effectively.

---

## Part 1: How Summaries Work

### What is a summary?

When you draft a scene, pi-novel-writer has no memory of what happened in earlier
scenes once they leave the visible context window. Summaries solve this: each
drafted scene has a short summary file stored alongside your manuscript. The AI
reads these summaries at the start of every turn to stay informed about prior
events, characters, and decisions — even scenes written weeks ago.

Without summaries, the AI must rely on its own (fallible) memory or re-read raw
prose, which eats context budget quickly. With summaries, it maintains continuity
across an entire novel in a fraction of the token space.

### When are summaries created?

They are not created automatically. After drafting or editing a scene, you run:

```
/PNW-summarize 1 2
```

The AI reads the scene prose, writes a summary, and stores it. From that point
forward, every AI turn starts with that summary already in context.

### When do summaries go stale?

If you edit a scene's prose after writing its summary, the summary becomes stale —
it no longer reflects the current text. The system detects this by comparing a
SHA-256 hash of the current scene body against the hash stored in the summary file.

Run `/PNW-summarize` (no args) to find all stale summaries and regenerate them.

---

## Part 2: First Summaries — After Drafting a Scene

### Scenario: You just finished drafting Chapter 1, Scene 1.

**Step 1 — Run the targeted summarize command:**

```
/PNW-summarize 1 1
```

The AI will:
1. Read the scene using `continue_writing`
2. Write a concise prose summary (who, what, where, why, how it ends)
3. Call `summary_generate` to store it at `summaries/scenes/01-01.md`
4. Confirm the path of the written file

**Step 2 — Draft the next scene and repeat:**

After drafting Chapter 1, Scene 2:
```
/PNW-summarize 1 2
```

---

## Part 3: Batch Refresh — After a Long Writing Session

You have been drafting for several hours. You wrote three scenes and edited two
older ones. Some summaries may be missing, some stale.

**Run:**
```
/PNW-summarize
```

**The AI responds with something like:**

> The following summaries need attention:
> - 01-02 (stale)
> - 02-01 (missing summary)
> - 02-02 (missing summary)
>
> Regenerating in order...

The AI then calls `summary_generate` for each item one by one. When finished,
all summaries are current.

**Check the result:**

Ask: "Run novel_summary_refresh" — it should confirm "All up-to-date."

---

## Part 4: Chapter Summaries

Chapter summaries are higher-level compressions of an entire chapter's events.
They are used as fallback context when the project grows large enough that all
individual scene summaries exceed the context budget.

### When to write a chapter summary

- After finishing all scenes in a chapter (all drafted and scene-summarized)
- Before starting a new chapter, as a self-contained prior-chapter brief
- When the AI seems to lose track of earlier chapters (budget may have been hit)

**Run:**
```
/PNW-summarize chapter 1
```

The AI will:
1. Review the existing scene summaries for Chapter 1
2. Write a cohesive chapter-level summary (arc, key events, ending state)
3. Call `summary_generate(chapter: 1)` — no scene parameter — to store it at
   `summaries/chapters/01.md`

### Chapter summary vs. scene summaries

Scene summaries are the primary context source. Chapter summaries are a fallback.
If you have both, scene summaries are injected first. Chapter summaries only appear
in context if the total scene summary content exceeds the token budget.

For most novels under 80,000 words, scene summaries alone will fit within budget.
For longer work, write chapter summaries proactively.

---

## Part 5: Integrating Summaries into Your Workflow

### Recommended session routine

```
Start of session:
  /PNW-summarize       <- check and refresh any stale summaries from last session

... draft or edit scenes ...

After each new scene:
  /PNW-summarize <ch> <sc>    <- summarize the scene you just finished

End of session:
  /PNW-summarize       <- final check (optional, catches anything missed)
```

### After editing an existing scene

Any prose change makes the scene's summary stale. The hash will not match. Run:

```
/PNW-summarize 2 3    <- replace with the chapter and scene you edited
```

You do not need to run the full batch `/PNW-summarize` for a single-scene edit.

### When starting a new chapter

Before drafting the first scene of a new chapter, consider running:

```
/PNW-summarize chapter <n>    <- summarize the chapter you just finished
```

This gives the AI a clean, compact picture of what happened before it helps you
open the new chapter.

---

## Part 6: Diagnosing Summary Problems

### The AI seems to have forgotten something

**Most likely cause:** The scene was drafted before summaries existed, or the
summary is stale.

**Fix:**
```
/PNW-summarize
```

Check the output. If the affected scene is listed as missing or stale, the AI
will regenerate it. If it is not listed, ask: "Run novel_summary_refresh" to
get the raw report.

### `/PNW-summarize` reports "All up-to-date" but the AI is still confused

**Possible cause:** The summary exists and is current, but it is not being injected
because the context budget is exceeded by other summaries above it in the order.

**Fix:** Generate chapter summaries so the AI has a smaller, more recent brief:

```
/PNW-summarize chapter 1
/PNW-summarize chapter 2
```

Also consider increasing `contextBudget.summaries` in `project.json`.

### A chapter summary is flagged as orphaned

An orphan occurs when a chapter summary file exists (`summaries/chapters/03.md`)
but chapter 3 has no scene files — perhaps you reorganized the project.

**Fix:** Ask the AI: "Delete the orphan chapter summary for chapter 3." Or
delete the file manually from `summaries/chapters/03.md`.

### The AI generated a bad summary

Summaries are prose — the AI can produce a poor one if the scene is long,
complex, or ambiguous.

**Fix:** Ask the AI to rewrite it:

> "Rewrite the summary for Chapter 2 Scene 1. Focus on the confrontation between
> Elara and the warden. Keep it under 100 words."

When satisfied, call `summary_generate` (or run `/PNW-summarize 2 1`) to overwrite
the stored file.

---

## Quick Reference Card

```
AFTER DRAFTING A SCENE
  /PNW-summarize <ch> <sc>              generate scene summary

AFTER FINISHING A FULL CHAPTER
  /PNW-summarize chapter <n>            generate chapter summary

BATCH CHECK (start or end of session)
  /PNW-summarize                        find and fix all stale/missing summaries

TARGETED SCENE REFRESH (after editing)
  /PNW-summarize <ch> <sc>              regenerate that scene's summary

CHECK STATUS (read-only, no AI action)
  Ask AI: "Run novel_summary_refresh"

CHANGE BUDGET
  Edit contextBudget.summaries in project.json (default: 5000 tokens)
```
