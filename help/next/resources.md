# /PNW-next — Resources

Technical reference for workflow stage detection logic.

---

## Stage Detection Algorithm

```
function detectStage(project):

  // Stage 1: No project
  if not project:
    return STAGE_1

  scenes = project.scenes
  drafted = scenes.filter(s => s.status != "outline")

  // Stage 2: Empty project
  bibleCount   = countFiles("bible/")
  outlineCount = countFiles("outline/chapters/")
  if bibleCount == 0 AND outlineCount == 0 AND len(scenes) == 0:
    return STAGE_2

  // Stage 3: Bible started, no outline
  if bibleCount > 0 AND outlineCount == 0:
    return STAGE_3

  // Stage 4: Outlined, no draft
  if outlineCount > 0 AND len(drafted) == 0:
    return STAGE_4

  // Stage 5: Draft exists, summaries stale
  stale = novel_summary_refresh()
  if len(stale) > 0:
    return STAGE_5

  // Stage 6: Active drafting
  allScenes = scenes
  draftedAll = allScenes.every(s => s.status != "outline")
  if not draftedAll:
    return STAGE_6

  // Stage 7: First draft complete
  revisedOrHigher = scenes.filter(s => ["revised","polished","final"].includes(s.status))
  if len(revisedOrHigher) == 0:
    return STAGE_7

  // Stage 8: Editing in progress
  pendingSuggestions = readSuggestions().filter(s => s.status == "pending")
  if len(pendingSuggestions) > 0:
    return STAGE_8

  // Stage 9: Ready to export
  allPolishedOrFinal = scenes.every(s => ["polished","final"].includes(s.status))
  if allPolishedOrFinal:
    return STAGE_9

  // Default: still in editing
  return STAGE_8
```

---

## Stage Labels

```typescript
const STAGE_LABELS = {
  1: "No project loaded",
  2: "Project ready — start planning",
  3: "Bible started — create outline",
  4: "Outlined — begin drafting",
  5: "Drafting — summaries need updating",
  6: "Drafting in progress",
  7: "First draft complete — begin editing",
  8: "Editing in progress",
  9: "Ready to export"
}
```

---

## Stats Reported Per Stage

Each stage report includes a subset of these stats:

| Stat                   | Relevant in stages |
|------------------------|--------------------|
| Scene count            | 2-9                |
| Drafted scene count    | 4-9                |
| Word count / target    | 4-9                |
| Bible entry count      | 2-4                |
| Outline count          | 3-4                |
| Missing summary count  | 5                  |
| Daily word count       | 5-7                |
| Revised/polished count | 7-9                |
| Pending suggestion count| 8                 |

---

## /PNW-next vs. WorkflowStageResult

The command renders a WorkflowStageResult object:

```typescript
interface WorkflowStageResult {
  stage:     number
  label:     string
  stats:     Record<string, number | string>
  nextSteps: Array<{
    command:     string
    description: string
  }>
}
```

The same data is returned by the internal `detectWorkflowStage()` function,
which the `progress_overview` tool also calls.

---

## Tool Reference

### `/PNW-next` command

| Field          | Detail                                              |
|----------------|-----------------------------------------------------|
| Registered in  | `extensions/novel-progress.ts`                      |
| Description    | Show workflow stage and next steps                  |
| Usage          | `/PNW-next`                                         |
| Side effect    | Calls `novel_summary_refresh` to detect stale summaries |
| Project needed?| Yes — Stage 1 shown if no project loaded            |

---

## Related Files

| File                            | Purpose                                        |
|---------------------------------|------------------------------------------------|
| `extensions/novel-progress.ts`  | /PNW-next and /PNW-help command registration   |
| `help/help/help.md`             | Command listing (/PNW-help command)            |
| `help/status/help.md`           | Full project dashboard (/PNW-status)           |
| `help/summarize/help.md`        | Summary system (addresses Stage 5)             |
