# /PNW-load — Resources

Technical reference for the load command and project state management.

---

## What Gets Loaded into Memory

When `/PNW-load` completes, the following state is held in pi's memory for
the session duration:

| Property         | Source                         | Contents                             |
|------------------|--------------------------------|--------------------------------------|
| `p.root`         | Argument or current dir        | Absolute path to project root        |
| `p.config`       | `project.json`                 | Title, author, genre, targets, settings|
| `p.scenes`       | Scan of `manuscript/chapters/` | Array of scene refs (key, filePath, status, word_count) |
| `p.bibleIndex`   | Scan of `bible/`               | Name/alias -> filePath lookup table  |
| `p.outlineIndex` | Scan of `outline/chapters/`    | Chapter number -> outline file map   |

None of this state is written to disk. It is rebuilt from files on every load.

---

## Scene Key Format

Each loaded scene is identified by a `sceneKey`:

```
sceneKey(chapter, scene) -> "01-02"   (zero-padded to 2 digits)
```

The key is used as the summary filename, lookup key in `p.scenes`, and tag in
the context injection block:

```
[scene:01-02] Scene 2, Chapter 1 summary...
```

---

## Load Event

On successful load, the extension emits:

```
novel:project-loaded
  payload: { root: string, config: ProjectConfig, scenes: SceneRef[] }
```

All tools and commands that require an active project listen for this event
before activating. If a tool is called before load, it returns:

```
"No project loaded. Run /PNW-load or /PNW-init first."
```

---

## Error Handling

| Error                                 | Cause                                       |
|---------------------------------------|---------------------------------------------|
| `No project.json found at <path>`    | Directory not initialized                   |
| `Invalid project.json`               | JSON parse failure                          |
| `Cannot read manuscript directory`   | Permissions error on manuscript/ folder     |
| Scene scan warning: `Missing file`   | Scene key in memory has no corresponding file|

---

## Tool Reference

### `/PNW-load` command

| Field          | Detail                                               |
|----------------|------------------------------------------------------|
| Registered in  | `extensions/novel-core.ts`                           |
| Description    | Load an existing novel project from a path           |
| Usage          | `/PNW-load` or `/PNW-load <path>`                    |
| Side effect    | Emits `novel:project-loaded`; all tools activate     |

---

## Related Files

| File                        | Purpose                                            |
|-----------------------------|-----------------------------------------------------|
| `extensions/novel-core.ts`  | Load command implementation                         |
| `project.json`              | Config read on load                                 |
| `manuscript/chapters/`      | Scanned to build scene index                        |
| `.pi/progress.json`         | Daily progress history (read by /PNW-progress)      |
| `help/init/help.md`         | Creating a new project                              |
| `help/status/help.md`       | Viewing project state after loading                 |
