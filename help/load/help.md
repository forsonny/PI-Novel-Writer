# /PNW-load — Help Reference

Load an existing novel project into the current pi session.

---

## Command

### `/PNW-load`

Load the project in the current working directory.

**Usage:**
```
/PNW-load
```

### `/PNW-load <path>`

Load a project from an explicit filesystem path.

**Usage:**
```
/PNW-load C:/novels/my-novel
/PNW-load ~/projects/the-ember-gate
/PNW-load ../other-project
```

**What it does:**
1. Reads `project.json` from the specified path (or current directory)
2. Scans `manuscript/chapters/` to build the in-memory scene index
3. Validates that expected directories exist (warns if any are missing)
4. Emits `novel:project-loaded` to activate all tools and make the project available

**Requirements:**
- The target directory must contain a valid `project.json`
- A project must have been initialized with `/PNW-init` previously

**When to use:**
- At the start of every writing session (tools are not active until a project is loaded)
- When switching between multiple projects
- After restarting pi (project state does not persist across sessions)

**Error states:**
- `"No project.json found at <path>"` — the directory has not been initialized;
  navigate to the correct path or run `/PNW-init` to create a new project
- `"Invalid project.json"` — the config file is malformed; inspect and repair it manually
- If scene files are missing from expected paths, a warning is shown but load continues

---

## Behavior Details

### What "loading" does

Loading does not move or copy files. It reads project state into memory for
the current session:

- The scene index (`p.scenes`) is populated by scanning `manuscript/chapters/`
- Project metadata (title, author, genre, targets) is read from `project.json`
- All registered tools become available (novel_scene_read, bible_create, etc.)
- The context injection system activates (summaries, bible, outline auto-inject)

### Session-level state

The loaded project state lives in memory for the duration of the pi session.
If you restart pi, you must run `/PNW-load` again. There is no autosave of
session state — only file writes are persistent.

### Loading a different project mid-session

Running `/PNW-load <new-path>` replaces the currently loaded project. The
previous project's in-memory state is discarded. No files are modified.

---

## After Loading

Once a project is loaded, these commands and tools become available:

**Commands:**
```
/PNW-status        dashboard
/PNW-bible         list bible entries
/PNW-outline       view chapter outlines
/PNW-edit          enter editing mode
/PNW-suggestions   view pending edits
/PNW-sprint        start writing sprint
/PNW-summarize     manage summaries
/PNW-compile       export manuscript
/PNW-progress      word count progress
/PNW-next          workflow guidance
```

**Tools (all active after load):**
- `novel_scene_read`, `novel_scene_write`, `novel_scene_create`
- `novel_scene_status`, `novel_scene_list`, `novel_chapter_list`
- `novel_search`, `novel_find_replace`, `novel_rename_entity`
- `bible_create`, `bible_read`, `bible_update`, `bible_list`, `bible_search`
- `outline_chapter_create`, `outline_chapter_read`, `outline_chapter_update`
- `summary_generate`, `novel_summary_refresh`
- `edit_suggest`, `edit_list_suggestions`, `edit_accept`, `edit_reject`
- `analyze_pacing`, `analyze_dialogue`, `analyze_continuity`, `analyze_readability`
- `compile_manuscript`, `export_docx`
- `progress_overview`, `progress_set_goal`
