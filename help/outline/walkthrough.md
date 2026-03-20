# /PNW-outline — Walkthrough

How to build, maintain, and use chapter outlines effectively.

---

## Part 1: Two Ways to Create Outlines

### Method A: Skills-first (recommended for new projects)

The `outline-novel` skill guides you through the full beat sheet — all acts,
turning points, and chapter purposes. The `outline-chapter` skill then fills
in scene-level detail for each chapter.

**Full outlining sequence:**
```
Ask AI: "Run the outline-novel skill"
  -> Creates the global beat sheet (acts, turning points, climax)
  -> Calls outline_chapter_create for each chapter with high-level purpose

Ask AI: "Run the outline-chapter skill for chapter 1"
  -> Asks targeted questions about scenes, POV, conflict
  -> Updates chapter 1 outline with full scene breakdown

Repeat for each chapter:
Ask AI: "Run the outline-chapter skill for chapter 2"
...

/PNW-outline    <- verify all chapters look complete
```

---

### Method B: Direct creation

If you already know your structure:

> "Create an outline for chapter 2: 'The Road to Ashenveil'. POV: Elara.
> Timeline: Days 2-4. Purpose: Introduce Sienna, deepen Elara's backstory.
> 4 scenes. Emotional arc: guarded -> vulnerable."

The AI calls `outline_chapter_create` with the relevant parameters.

---

## Part 2: Reading the Outline Before Drafting

Before starting a new scene or chapter, always review the outline:

```
/PNW-outline                          <- see all chapters at a glance
```

Then ask the AI to read the specific chapter you are about to draft:

> "Read the outline for chapter 3"

The AI calls `outline_chapter_read(chapter: 3)` and presents the full
scene breakdown. Review the scene goals, conflicts, and emotional arc
before beginning.

---

## Part 3: Scene Cards Within Outlines

Scene cards are sub-sections within a chapter outline. They define
individual scene goals before you draft.

**Add or update a scene card:**
> "Add a scene card for chapter 2, scene 3. Goal: Elara and Sienna reach
> Redford before nightfall. Conflict: Brotherhood checkpoint at the city gate.
> Disaster: Drath is leading the checkpoint personally."

The AI calls `outline_scene_card_create(chapter: 2, scene: 3, content: "...")`.

**Scene card format (suggested):**
```
**Scene 3 — The Redford Checkpoint**
Goal: Reach the city before nightfall.
Conflict: Brotherhood checkpoint at the gate. Drath is present.
Disaster: Elara is almost recognized. They slip through only because
Sienna distracts a guard — a risk that changes how Elara sees Sienna.
End state: Inside Redford; Elara shaken; dynamic between them shifted.
```

---

## Part 4: Reordering Chapters

If you decide to restructure your novel and move chapters:

> "Move chapter 3 to become chapter 5"

The AI calls `outline_chapter_reorder(oldChapter: 3, newChapter: 5)`.

**What changes:**
- `outline/chapters/03-*.md` → `outline/chapters/05-*.md`
- `manuscript/chapters/03/` → `manuscript/chapters/05/`
- All scene frontmatter `chapter` fields updated

**After reordering:**
```
/PNW-outline     <- verify the new order
novel_validate   <- check scene frontmatter was updated
```

If gaps exist (e.g., you moved 3 to 5 but now there is no chapter 3),
you will need to renumber the intermediate chapters manually.

---

## Part 5: Updating Outlines as the Story Changes

Drafting always reveals gaps and surprises in the outline. Update the
outline to reflect what you actually wrote:

### After a scene diverged from the plan:

> "Update the chapter 2 outline. Scene 3 ended with Sienna revealing she
> works for the Concord, not just a coincidence. Add this to the scene 3
> notes and update the chapter purpose to reflect this revelation."

The AI calls `outline_chapter_update` with the revised body.

### After deciding to add a chapter:

> "Create a chapter outline for chapter 7: 'The Archivist'. This is a
> new chapter between the current 6 and 7. POV: Elara. Purpose: exposition
> of the Ember Gate's history via the Archivist."

Then reorder if needed to insert it properly.

---

## Part 6: Retroactive Outlining

If you drafted without an outline and want to document what you wrote:

Ask the AI: "Run the retroactive-outline skill"

The skill reads your drafted scenes, extracts the structure (chapter
purposes, scene beats, emotional arcs), and writes outline files that
match what is actually in the manuscript. This is useful for:
- Getting into the outline-first workflow mid-project
- Documenting a finished or near-finished draft
- Identifying structural issues before editing

---

## Part 7: Outline vs. Manuscript Relationship

The outline is a planning document. The manuscript is the executed version.
They will diverge — that is expected and healthy. Do not rewrite the outline
to match every small deviation; update it only when the structural change is
significant (a scene was cut, a chapter was split, a major plot point moved).

Use the outline as a guide for the AI when drafting, not as a rigid script.
