# Summary System — Resources

Technical reference for the summary system internals.

---

## File Locations

All summary files live at the **project root**, never inside `manuscript/`.

```
<project-root>/
  summaries/
    scenes/
      01-02.md     <- chapter 01, scene 02
      01-03.md     <- chapter 01, scene 03
      02-01.md     <- chapter 02, scene 01
    chapters/
      01.md        <- chapter 01 summary
      02.md        <- chapter 02 summary
    acts/
      01.md        <- act 01 summary (optional, manually written)
```

**Filename rules:**
- Scene summaries: `{chapter}-{scene}.md` — both numbers zero-padded to 2 digits, no prefix
- Chapter summaries: `{chapter}.md` — zero-padded to 2 digits, no prefix
- Act summaries: same format — these are not auto-generated; write them manually if needed

---

## Integrity Hash

Every summary file stores a SHA-256 hash of the source prose in its YAML frontmatter.

```yaml
---
hash: a3f5b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1
---
```

**For scene summaries:** the hash is computed over the scene's prose body after
stripping the scene's own YAML frontmatter. This means editing scene metadata
(status, title, etc.) does not mark the summary as stale — only prose changes do.

**For chapter summaries:** the hash is computed over an empty string. Chapter
summaries are never automatically marked as stale because there is no single
prose body to compare against. Refresh them manually when a chapter's scenes
have all been updated.

**Staleness check:**

```
hash(current scene body) == hash stored in summary frontmatter
  -> up-to-date
  -> stale (needs regeneration)
```

---

## Context Budget

Summary injection respects a per-project token budget. Default values from `project.json`:

```json
{
  "settings": {
    "contextBudget": {
      "system":       3000,
      "bible":        3000,
      "summaries":    5000,
      "outline":      3000,
      "recentProse":  2000,
      "currentScene": 3000,
      "voiceProfile":  500
    }
  }
}
```

Token estimation: 1 token ~= 4 characters (rough estimate, sufficient for budget
management).

**Tiered injection logic:**

```
Load all scene summaries (scene:XX-XX keys)
  If total <= budget.summaries:
    Inject all scene summaries
  Else if any scene summaries fit:
    Inject as many as fit (skip entries that exceed budget)

If summaryTokens == 0 after scene pass:
  Load all chapter summaries (chapter:XX keys)
  Inject as many chapter summaries as fit

If summaryTokens == 0 after chapter pass:
  Load all act summaries (act:XX keys)
  Inject as many act summaries as fit
```

The fallback is three-tiered: scene -> chapter -> act. If a project grows large
enough that even chapter summaries exceed budget, act summaries provide top-level
continuity.

**Adjusting budget:** Edit `contextBudget.summaries` in `project.json` directly.
Increasing it keeps more scene summaries in context but consumes tokens that
other sections (bible, outline, recent prose) could use.

---

## Summary Injection in Context

Summaries appear in the AI context inside a `[STORY CONTEXT]` block prepended to
the system message at the start of each turn:

```
[STORY CONTEXT]
--- VOICE PROFILE ---
(voice profile content)

--- BIBLE ENTRIES ---
(character and location entries)

--- PROGRESS SUMMARIES ---
[scene:01-01] Scene 1 summary text here...
[scene:01-02] Scene 2 summary text here...
[chapter:01] Chapter 1 summary text here...

[/STORY CONTEXT]
```

Old `[STORY CONTEXT]` blocks from prior turns are stripped automatically before
the new one is injected, preventing context duplication across a long session.

---

## Tool Reference

### `summary_generate`

| Field | Detail |
|---|---|
| Registered in | `extensions/novel-write.ts` |
| Label | Generate Summary |
| Input: chapter | number, required |
| Input: scene | number, optional (omit for chapter summary) |
| Input: summaryText | string, required |
| Output | Path of written file |
| Side effect | Reads scene body, computes hash, writes file |

### `novel_summary_refresh`

| Field | Detail |
|---|---|
| Registered in | `extensions/novel-write.ts` |
| Label | Refresh Summaries |
| Input | none |
| Output | Text report of stale/missing summaries or "all up-to-date" |
| Side effect | None (read-only) |

Detection sub-cases (in order):
1. Stale scene summaries — hash mismatch; scene status != "outline"
2. Missing scene summaries — no file; scene status != "outline"
3. Orphan chapter summaries — chapter summary file exists but chapter has no scenes
4. Missing chapter summaries — chapter has drafted scenes but no chapter summary file

### `/PNW-summarize` command

| Field | Detail |
|---|---|
| Registered in | `extensions/novel-write.ts` |
| Description | Generate or refresh summaries |
| Usage | `/PNW-summarize \| /PNW-summarize <ch> <sc> \| /PNW-summarize chapter <n>` |
| Side effect | Calls `pi.sendMessage()` to dispatch an AI task |

The command does not call `summary_generate` directly. It sends a structured
message into the AI conversation and the AI calls the tool.

---

## Staleness Detection: Technical Flow

```
novel_summary_refresh (or /PNW-summarize batch mode):

  for each scene in p.scenes:
    skip if scene.status == "outline"
    summaryFile = summaries/scenes/{key}.md

    if not exists(summaryFile):
      mark as "(missing summary)"
      continue

    storedHash = parseFrontmatter(readFile(summaryFile)).meta.hash
    sceneBody  = parseFrontmatter(readFile(scene.filePath)).body
    if sha256(sceneBody) != storedHash:
      mark as "(stale)"

  for each file in summaries/chapters/:
    chapterNum = parseInt(filename)
    if no scenes exist for chapterNum:
      mark as "(orphan chapter summary)"

  for each unique chapter in scenes with at least one drafted scene:
    if not exists(summaries/chapters/{chapter}.md):
      mark as "(missing chapter summary)"
```

---

## Related Files

| File | Purpose |
|---|---|
| `extensions/novel-write.ts` | Summary tools and `/PNW-summarize` command |
| `system/SYSTEM.md` | System prompt — documents summary file locations and rules |
| `help/PNW-summarize/help.md` | Command and tool reference |
| `help/PNW-summarize/resources.md` | This file |
| `help/PNW-summarize/walkthrough.md` | Step-by-step usage guide |
| `summaries/` | Summary files directory (auto-created) |
