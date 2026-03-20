# /PNW-edit — Help Reference

Enter editing mode and access the full suite of manuscript analysis and
revision tools.

---

## Command

### `/PNW-edit`

**Usage:**
```
/PNW-edit
```

**Parameters:** none

**What it does:**
1. Signals the AI to shift into editing mode — it adopts a critical, analytical
   stance rather than a generative one
2. Activates the editing tools (analyze_*, edit_suggest, edit_line)
3. Presents a menu of available editing operations for the current project
4. The AI reads project state to determine what stage of editing is appropriate

**Requirements:** A project must be loaded. At least one scene must have `draft`
status or higher for editing to be meaningful.

**When to use:**
- After completing a full chapter or draft to begin the revision process
- When you want targeted analysis (pacing, dialogue, continuity)
- When transitioning from drafting mode to editing mode for the session

---

## Editing Tools

### Analysis Tools

#### `analyze_pacing`

Break down a scene into ACTION, DIALOGUE, and REFLECTION segments.

**Parameters:**

| Parameter | Type   | Required | Description     |
|-----------|--------|----------|-----------------|
| `chapter` | number | yes      | Chapter number  |
| `scene`   | number | yes      | Scene number    |

**Returns:**
```
Scene 3.2 — Pacing Analysis

Segment breakdown:
  ACTION:      42%   [=====>      ]
  DIALOGUE:    38%   [====>       ]
  REFLECTION:  20%   [==>         ]

Action sequences: 4 (avg 180 words each)
Dialogue exchanges: 7 (avg 95 words each)
Reflection passages: 3 (avg 120 words each)

Pacing assessment: Well-balanced. The scene shifts between action and
dialogue at regular intervals. The two reflection passages feel slightly
long given the urgency of the situation — consider trimming the second one.
```

**When to use:**
- When a scene feels "stuck" or slow
- When a scene feels rushed or breathless
- To confirm a scene has enough variety

---

#### `analyze_dialogue`

Analyze dialogue tag usage and attribution patterns.

**Parameters:**

| Parameter | Type   | Required | Description     |
|-----------|--------|----------|-----------------|
| `chapter` | number | yes      | Chapter number  |
| `scene`   | number | yes      | Scene number    |

**Returns:** Count of said/asked/other tags, untagged lines, distribution
across characters, and notes on attribution clarity.

---

#### `analyze_wordcount`

Detailed word count breakdown for the entire project.

**Parameters:** none

**Returns:** Per-scene and per-chapter word counts with subtotals and the
project total vs. target.

---

#### `analyze_continuity`

Cross-reference scene prose against `continuity/facts.json` and
`continuity/character-states.json`.

**Parameters:**

| Parameter | Type   | Required | Description     |
|-----------|--------|----------|-----------------|
| `chapter` | number | yes      | Chapter number  |
| `scene`   | number | yes      | Scene number    |

**Returns:** List of potential continuity issues — facts in the scene that
contradict stored facts, or character knowledge/state inconsistencies.

**When to use:**
- After drafting a scene where characters learn or reveal information
- When the AI has generated content you want to fact-check
- During a continuity-check editing pass

---

#### `analyze_readability`

Compute Flesch-Kincaid grade level and sentence length distribution.

**Parameters:**

| Parameter | Type   | Required | Description     |
|-----------|--------|----------|-----------------|
| `chapter` | number | yes      | Chapter number  |
| `scene`   | number | yes      | Scene number    |

**Returns:** FK grade level, average sentence length, longest and shortest
sentences, proportion of complex vs. simple sentences.

---

### Edit Application Tools

#### `edit_suggest`

Propose an edit for review without immediately applying it.

**Parameters:**

| Parameter       | Type   | Required | Description                                  |
|-----------------|--------|----------|----------------------------------------------|
| `chapter`       | number | yes      | Chapter number                               |
| `scene`         | number | yes      | Scene number                                 |
| `original_text` | string | yes      | The passage as it currently reads            |
| `suggested_text`| string | yes      | The proposed replacement                     |
| `rationale`     | string | yes      | Why this change improves the scene           |

**Effect:** Stores the suggestion in `.pi/edit-suggestions.json` as `pending`.
Does NOT modify the scene file. Use `/PNW-suggestions` to review and apply.

---

#### `edit_line`

Apply a targeted line edit directly to a scene (no suggestion queue).

**Parameters:**

| Parameter    | Type   | Required | Description                       |
|--------------|--------|----------|-----------------------------------|
| `chapter`    | number | yes      | Chapter number                    |
| `scene`      | number | yes      | Scene number                      |
| `line_start` | number | yes      | First line to replace (1-based)   |
| `line_end`   | number | yes      | Last line to replace (inclusive)  |
| `new_content`| string | yes      | Replacement content               |

**Effect:** Writes the change directly to the scene file. Use when you want
immediate application without the suggestion workflow.

---

## Editing Skills

The editing commands work best in conjunction with the editing skills:

| Skill               | Use case                                       |
|---------------------|------------------------------------------------|
| `dev-edit`          | Structural and narrative issues (big picture)  |
| `line-edit`         | Prose quality, sentence rhythm, word choice    |
| `copy-edit`         | Grammar, punctuation, style consistency        |
| `continuity-check`  | Cross-reference facts across the manuscript    |
| `voice-match`       | Ensure character dialogue matches established voice |

Invoke a skill by asking the AI: "Run the dev-edit skill on chapter 2"

---

## Scene Status Progression

Editing advances scene status. The recommended progression:

```
outline   -> not yet drafted (AI cannot edit; nothing to analyze)
draft     -> first draft written; ready for dev-edit and line-edit
revised   -> significant revisions applied
polished  -> final refinements applied; ready for copy-edit
final     -> no further edits expected; contributes to export
```

Advance a scene's status with:
```
novel_scene_status(chapter: 1, scene: 2, status: "revised")
```
