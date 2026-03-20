# Summary System — Help Reference

Quick reference for all summary commands and tools in pi-novel-writer.

---

## Commands

### `/PNW-summarize`

Run a full batch summary refresh. Detects all stale and missing summaries across
the project and instructs the AI to regenerate them in order.

**Usage:**
```
/PNW-summarize
```

**What it does:**
1. Scans every drafted scene for hash mismatches (prose changed since last summary)
2. Scans for scenes that have no summary file yet
3. Checks for chapter summary files that no longer have matching scenes (orphans)
4. Checks for chapters with drafted scenes but no chapter summary yet
5. If anything needs attention: lists each item and instructs the AI to call
   `summary_generate` for each one in order
6. If everything is current: confirms "All scene and chapter summaries are up-to-date."

**Requirements:** A project must be loaded (`/PNW-init` or `/PNW-load`).

**When to use:**
- After a long writing session before starting a new one
- After editing multiple scenes
- When the AI seems unaware of recent plot events

---

### `/PNW-summarize <chapter> <scene>`

Generate or refresh the summary for a single scene.

**Usage:**
```
/PNW-summarize 1 2
/PNW-summarize 3 1
```

**What it does:**
Instructs the AI to read scene prose with `continue_writing` then store a new
summary via `summary_generate(chapter, scene)`.

**When to use:**
- After editing one specific scene
- After drafting a new scene

**Error states:**
- `"Chapter and scene numbers must be 1 or greater"` — numbers must be positive integers
- The AI will report if the scene does not exist in the project

---

### `/PNW-summarize chapter <n>`

Generate or refresh the chapter-level summary for a single chapter.

**Usage:**
```
/PNW-summarize chapter 1
/PNW-summarize chapter 4
```

**What it does:**
Instructs the AI to review existing scene summaries for that chapter, then write
a cohesive chapter-level summary via `summary_generate(chapter)` (no scene parameter).

**When to use:**
- After finishing a full chapter (all scenes drafted and summarized)
- When the context window is large and you want chapter-level compression
- Before beginning a new chapter to give the AI a coherent prior-chapter summary

**Error states:**
- `"Chapter number must be 1 or greater"` — must be a positive integer

---

## AI-Callable Tools

These tools are called by the AI in response to `/PNW-summarize` commands or on direct request.

### `summary_generate`

Store a summary for a scene or chapter.

**Parameters:**
| Parameter | Type | Required | Description |
|---|---|---|---|
| `chapter` | number | yes | Chapter number (1-based) |
| `scene` | number | no | Scene number (1-based). Omit for a chapter summary. |
| `summaryText` | string | yes | The summary text to store |

**What it does:**
- For scene summaries: reads the scene body, computes its SHA-256 hash, and stores
  `summaries/scenes/{ch}-{sc}.md` with the hash in frontmatter
- For chapter summaries: stores `summaries/chapters/{ch}.md` with a hash of empty
  string (no scene body to hash at the chapter level)
- Returns the path of the written file so you can verify it

**Error states:**
- `"Project not found"` — no project is loaded
- `"Scene X.Y not found. Cannot generate summary for a non-existent scene."` — the
  scene file must exist before a summary can be created

---

### `novel_summary_refresh`

Inspect the project and report which summaries are stale or missing.

**Parameters:** none

**Returns:**
- `"All scene and chapter summaries are up-to-date."` — nothing needs regenerating
- A list of items that need attention, each annotated with the reason:
  - `(missing summary)` — no summary file exists for this drafted scene
  - `(stale)` — the scene prose has changed since the summary was written
  - `(missing chapter summary)` — a chapter has drafted scenes but no chapter summary
  - `(orphan chapter summary — no scenes exist for this chapter)` — a chapter
    summary file exists for a chapter that has no scenes

**When the AI calls it:**
The AI calls this tool automatically when you run `/PNW-summarize` (batch mode).
You can also ask the AI directly: "Run novel_summary_refresh" or "Check my summaries."

---

## Summary File Format

Summary files use YAML frontmatter to store an integrity hash.

**Scene summary:** `summaries/scenes/01-02.md`
```
---
hash: a3f5b2c1...  (SHA-256 of scene prose body, excluding its own frontmatter)
---
Chapter 1, Scene 2: Elara arrives at the collapsed bridge and discovers the
message scratched into the stone. She realizes the Brotherhood reached the
crossing before her. Tension established; she decides to ford the river instead.
```

**Chapter summary:** `summaries/chapters/01.md`
```
---
hash: e3b0c44298fc...  (SHA-256 of empty string — no prose body for chapters)
---
Chapter 1 establishes Elara's mission and the Brotherhood's interference. She
departs the capital, loses her map at the inn, and arrives at the bridge to
find her route compromised. She pivots to the river crossing. Tone: urgent,
isolated, determined.
```

**Critical:** Do NOT read or write summary files manually. Always use
`summary_generate` and `novel_summary_refresh` (or `/PNW-summarize`).

---

## How Summaries Feed the AI Context

Summaries are injected automatically at the start of every AI turn via the
context event handler. Injection is tiered by budget:

1. **Scene summaries** fill the context first (most specific, most useful)
2. **Chapter summaries** are used if scene summaries exceed the budget
3. **Act summaries** are used if chapter summaries also exceed the budget

The context budget is controlled by `settings.contextBudget.summaries` in
`project.json` (default: 5000 tokens). For long novels where scene summaries
exceed this budget, regular chapter summary generation keeps the AI grounded.

---

## Common Issues

| Problem | Cause | Fix |
|---|---|---|
| AI doesn't know about a scene you wrote | Scene has no summary or summary is stale | Run `/PNW-summarize` or `/PNW-summarize <ch> <sc>` |
| `/PNW-summarize` reports a scene as stale | Scene prose was edited after the summary was written | Run `/PNW-summarize <ch> <sc>` for that scene |
| Orphan chapter summary reported | You deleted or moved all scenes for a chapter | Delete the orphan file from `summaries/chapters/` manually, or ask the AI to remove it |
| `summary_generate` returns "Scene not found" | The scene file doesn't exist yet | Draft the scene first, then summarize |
| Summary was written but AI still ignores it | Context budget exceeded; scene summaries bumped to chapter tier | Generate chapter summaries via `/PNW-summarize chapter <n>` to stay within budget |
