# /PNW-edit — Walkthrough

How to run an editing pass from first draft to polished prose.

---

## Part 1: The Editing Sequence

A complete editing pass moves each scene through four stages:

```
draft -> revised -> polished -> final
```

Each stage has a corresponding tool or skill:

| Stage transition   | Primary tool/skill         | Focus                      |
|--------------------|----------------------------|----------------------------|
| draft -> revised   | dev-edit skill             | Structure, plot, character |
| draft -> revised   | analyze_pacing             | Scene rhythm               |
| draft -> revised   | analyze_continuity         | Fact-checking              |
| revised -> polished| line-edit skill            | Prose, sentence rhythm     |
| revised -> polished| analyze_dialogue           | Dialogue quality           |
| polished -> final  | copy-edit skill            | Grammar, consistency       |
| polished -> final  | analyze_readability        | Grade level, complexity    |

You do not have to do all stages for every scene. Choose the depth that
matches your project's needs.

---

## Part 2: Running a Dev-Edit Pass

Developmental editing focuses on whether the scene works — does the
conflict escalate, does the character behave consistently, does the scene
have a clear purpose?

**Step 1 — Enter editing mode:**
```
/PNW-edit
```

**Step 2 — Run the dev-edit skill on a chapter:**
Ask the AI: "Run the dev-edit skill on chapter 2"

The skill:
- Reads each scene in the chapter
- Evaluates structure, pacing, character motivation, conflict, and resolution
- Calls `edit_suggest` for each recommended change (no immediate edits)

**Step 3 — Review suggestions:**
```
/PNW-suggestions
```

You will see a list of pending suggestions. Accept, reject, or modify each one.

**Step 4 — Advance the scene status:**
Ask the AI: "Mark all chapter 2 scenes as revised"

The AI calls `novel_scene_status` for each scene.

---

## Part 3: Running a Pacing Analysis

Use this when a scene feels off — too slow, too rushed, or tonally flat.

**Step 1 — Run the analysis:**
Ask the AI: "Analyze the pacing of scene 3.2"

The AI calls `analyze_pacing(chapter: 3, scene: 2)`.

**Step 2 — Interpret the results:**

- ACTION under 30% in a tense scene: add physical beats, cut interior monologue
- DIALOGUE over 60% in a scene with little conflict: the scene may be exposition-heavy
- REFLECTION over 40% in any scene: pacing will feel slow; consider shortening

**Step 3 — Apply changes:**

If the analysis reveals a long reflection passage to cut:
> "Edit scene 3.2 — trim the reflection passage at lines 45-62. Keep the core
> emotional beat but cut the backstory digression."

The AI calls `edit_line` or `edit_suggest` depending on your instruction.

---

## Part 4: Running a Continuity Check

Before advancing scenes to `revised`, check for factual errors.

**Step 1 — Run continuity analysis:**
Ask the AI: "Run the continuity-check skill on chapter 3"

The skill reads the scene and cross-references:
- `continuity/facts.json` — established world facts
- `continuity/character-states.json` — what characters know at this point

**Step 2 — Review flagged items:**

The skill will report things like:
```
! Scene 3.2: Elara uses her messenger seal, but she lost it in scene 1.4
  according to character-states.json.

! Scene 3.3: The Brotherhood outpost is described as "north of Ashenveil"
  but facts.json records it as "east of Ashenveil" (from scene 1.6).
```

**Step 3 — Fix each issue:**
> "Fix scene 3.2: change 'used the seal' to 'reached for where the seal used to be'"

---

## Part 5: Line Editing a Scene

Line editing improves prose at the sentence level — rhythm, word choice,
clarity, and style.

**Step 1 — Ask the AI to run the line-edit skill:**
Ask the AI: "Run the line-edit skill on scene 2.3"

The skill:
- Reads the scene
- Identifies weak constructions (passive voice, filler words, cliches, adverb overuse)
- Calls `edit_suggest` for each suggested line change

**Step 2 — Review the suggestions:**
```
/PNW-suggestions
```

Accept changes that improve the prose. Reject any that change your intended voice.

**Step 3 — Advance the scene:**
Ask the AI: "Mark scene 2.3 as polished"

---

## Part 6: Direct Line Edits (Bypassing Suggestions)

For small targeted fixes you are confident about:

> "In scene 2.1, replace lines 12 through 14 with: 'She crossed the threshold
> without slowing. The door swung shut behind her.'"

The AI calls `edit_line(chapter: 2, scene: 1, line_start: 12, line_end: 14, ...)`.

This writes directly to the scene file. Use when the change is unambiguous
and you do not need the review step.

---

## Part 7: Copy Edit Pass

The final pass before export. Run after all scenes are `polished`.

Ask the AI: "Run the copy-edit skill on chapter 1"

The skill checks:
- Grammar and punctuation
- Consistent capitalization of proper nouns
- Consistent use of em-dashes, ellipses, quote formatting
- Repeated words in close proximity

Suggestions go through the `edit_suggest` workflow as usual.

After all scenes pass copy-edit:
Ask the AI: "Mark all chapter 1 scenes as final"
```
/PNW-compile
```

---

## Quick Reference

```
/PNW-edit                          enter editing mode
/PNW-suggestions                   view pending edits

Ask: "Run the dev-edit skill on chapter N"      structural editing
Ask: "Analyze pacing of scene N.M"              pacing breakdown
Ask: "Run the continuity-check skill on ch N"   fact-checking
Ask: "Run the line-edit skill on scene N.M"     prose refinement
Ask: "Run the copy-edit skill on chapter N"     grammar pass
Ask: "Mark scene N.M as revised/polished/final" advance status
```
