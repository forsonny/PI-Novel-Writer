# /PNW-status — Resources

Technical reference for dashboard data sources and rendering logic.

---

## Data Sources

| Dashboard section   | Source                                           |
|---------------------|--------------------------------------------------|
| Word count total    | Sum of `word_count` fields across all non-outline scenes |
| Target word count   | `project.json` → `targetWordCount`               |
| Chapter titles      | `outline/chapters/{ch}-*.md` frontmatter         |
| Scene counts        | `p.scenes` array filtered by chapter             |
| Scene status        | Scene frontmatter `status` field                 |
| Chapter status      | Computed from dominant scene status              |
| Daily goal          | `.pi/progress.json` → `dailyGoal`                |
| Today's words       | `.pi/progress.json` → today's date entry         |
| API cost            | `.pi/progress.json` → `costSession`, `costTotal` |

---

## Chapter Status Computation

```
scenes = all scenes for this chapter

if all scenes are status "outline":
  chapter status = "outline"
else if any scene is status "draft":
  chapter status = "draft"
else if all scenes are "revised" or higher:
  chapter status = "revised"
else if all scenes are "polished" or higher:
  chapter status = "polished"
else if all scenes are "final":
  chapter status = "final"
```

---

## Alert Detection Logic

```
for each chapter in outline/:
  if no scenes exist for this chapter:
    emit "Ch N has no scenes"

for each chapter with at least one drafted scene:
  if summaries/chapters/{ch}.md does not exist:
    emit "Ch N has no chapter summary"

count scenes with status != "outline" AND no summary file:
  if count > 0:
    emit "N scenes missing summaries"

for each chapter:
  outline.sceneCount vs len(p.scenes for chapter)
  if mismatch:
    emit "Scene count mismatch in Ch N"
```

---

## Tool Reference

### `/PNW-status` command

| Field          | Detail                                                |
|----------------|-------------------------------------------------------|
| Registered in  | `extensions/novel-core.ts`                            |
| Description    | Show project dashboard                                |
| Usage          | `/PNW-status`                                         |
| Side effect    | Read-only; no files modified                          |

### `novel_chapter_list`

| Field          | Detail                                                |
|----------------|-------------------------------------------------------|
| Registered in  | `extensions/novel-core.ts`                            |
| Label          | List Chapters                                         |
| Input          | none                                                  |
| Output         | Array of chapter summaries with word count and status |

### `novel_scene_list`

| Field          | Detail                                                |
|----------------|-------------------------------------------------------|
| Registered in  | `extensions/novel-core.ts`                            |
| Label          | List Scenes                                           |
| Input          | `chapter` (optional)                                  |
| Output         | Array of scene refs with metadata                     |

### `analyze_wordcount`

| Field          | Detail                                                |
|----------------|-------------------------------------------------------|
| Registered in  | `extensions/novel-edit.ts`                            |
| Label          | Analyze Word Count                                    |
| Input          | none                                                  |
| Output         | Per-scene and per-chapter word count table            |

### `progress_overview`

| Field          | Detail                                                |
|----------------|-------------------------------------------------------|
| Registered in  | `extensions/novel-progress.ts`                        |
| Label          | Progress Overview                                     |
| Input          | none                                                  |
| Output         | Word count, goals, daily count, API cost totals       |

---

## Related Files

| File                         | Purpose                                           |
|------------------------------|---------------------------------------------------|
| `extensions/novel-core.ts`   | /PNW-status command and list tools                |
| `extensions/novel-progress.ts`| progress_overview and daily tracking             |
| `project.json`               | Target word count, workflow type                  |
| `.pi/progress.json`          | Daily word counts and API cost history            |
| `help/load/help.md`          | Loading a project before running status           |
| `help/next/help.md`          | Interpreting status and deciding what to do next  |
| `help/progress/help.md`      | Detailed progress tracking and goals              |
