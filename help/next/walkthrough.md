# /PNW-next — Walkthrough

How to use /PNW-next to navigate the full novel-writing workflow.

---

## Part 1: Using /PNW-next as Your Session Opener

Every session should begin with:

```
/PNW-load           <- load your project
/PNW-next           <- orient yourself
```

`/PNW-next` tells you exactly what state you are in and what the most
productive next move is. Over the course of writing a novel, this command
becomes your primary navigation tool.

---

## Part 2: The Full Journey — Stage by Stage

### From empty directory to first sentence

```
/PNW-next
> Stage 1: No project loaded.
> /PNW-init to start

/PNW-init
/PNW-next
> Stage 2: Project ready — begin planning.
> Ask AI: "Run the getting-started skill"
```

### From planning to outline

```
Ask AI: "Run the getting-started skill"
Ask AI: "Run the premise skill"
Ask AI: "Run the world-building skill"  (multiple calls)
/PNW-next
> Stage 3: Bible started — create outline.
> Ask AI: "Run the outline-novel skill"
```

### From outline to first draft

```
Ask AI: "Run the outline-novel skill"
Ask AI: "Run the outline-chapter skill for chapter 1"
... repeat for each chapter ...
/PNW-next
> Stage 4: Outlined — begin drafting.
> Ask AI: "Run the draft-scene skill"
```

### Drafting loop

```
Ask AI: "Run the draft-scene skill"
/PNW-summarize <ch> <sc>
/PNW-next
> Stage 5: Summaries need updating (if any stale)
    -> /PNW-summarize
> Stage 6: Drafting in progress (if summaries current)
    -> /PNW-sprint or "Run the draft-scene skill"
```

### Finishing the draft

```
... all scenes drafted ...
/PNW-next
> Stage 7: First draft complete.
> /PNW-edit
> Ask AI: "Run the dev-edit skill on chapter 1"
```

### Editing loop

```
/PNW-edit
Ask AI: "Run the dev-edit skill on chapter N"
/PNW-suggestions
... process suggestions ...
/PNW-next
> Stage 8: Editing in progress.
> /PNW-suggestions (N pending)
> Continue with line-edit skill
```

### Preparing to export

```
... all scenes polished/final ...
/PNW-next
> Stage 9: Ready to export.
> /PNW-compile
```

---

## Part 3: When Stage Detection Seems Wrong

### "It says Stage 2 but I have bible entries"

Check that the bible entries were actually saved:
```
/PNW-bible
```

If bible entries appear there, the stage detection may be reading 0 entries
because of a bible index issue. Try:
```
/PNW-load    <- reload to rebuild the index
/PNW-next    <- re-check
```

### "It says Stage 5 (stale summaries) every session"

This is expected if you drafted scenes in the previous session and did not
summarize them before closing. The fix is always the same:
```
/PNW-summarize
```

Make this part of your end-of-session routine to prevent it.

### "It says Stage 4 but I have drafted scenes"

Stage 4 is triggered when all scenes are `outline` status. If your drafted
scenes show `outline` status, they need to be advanced:
```
Ask AI: "Mark scene 1.1 as draft"
```
or
```
novel_scene_status(chapter: 1, scene: 1, status: "draft")
```

---

## Part 4: Multi-Stage Days

On intensive writing days, you may move through multiple stages in a single
session. Run `/PNW-next` frequently to track your progress:

```
/PNW-next     <- Stage 5: fix summaries
/PNW-summarize
/PNW-next     <- Stage 6: continue drafting
/PNW-sprint
... draft 2 scenes ...
/PNW-summarize 3 4
/PNW-summarize 3 5
/PNW-next     <- Stage 6 still: more scenes to draft
```

Each `/PNW-next` call recalculates stage from scratch, so it always reflects
your current state — not a cached view.

---

## Part 5: /PNW-next vs. /PNW-status

| /PNW-next                          | /PNW-status                           |
|------------------------------------|---------------------------------------|
| Tells you what to DO               | Shows you what IS                     |
| Contextual, prescriptive           | Comprehensive, descriptive            |
| 2-4 recommended next steps         | Full chapter table, all alerts        |
| Best for: orientation, momentum    | Best for: deep review, problem-finding|

Run both at the start of a session for the complete picture:
```
/PNW-status    <- what is the full state of the project?
/PNW-next      <- what should I do first?
```
