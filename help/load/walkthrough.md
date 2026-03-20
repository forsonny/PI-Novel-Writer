# /PNW-load — Walkthrough

Step-by-step guide for loading projects and managing multiple novels.

---

## Part 1: Starting a Session

Every time you open pi and want to work on a novel, you must load the project.
Tools are dormant until a project is loaded.

### Scenario: You open pi in your project directory

If pi is already open in the project root (e.g., `C:/novels/the-ember-gate/`):

```
/PNW-load
```

pi reads `project.json` from the current directory, scans your scenes, and
confirms the project is ready. All commands and tools activate.

### Scenario: You open pi in a different directory

If pi opened in your home directory or another location:

```
/PNW-load C:/novels/the-ember-gate
```

pi navigates to that path, loads the project, and confirms. Your working
directory in the terminal does not change — only the project state changes
in pi's memory.

---

## Part 2: What You See After Loading

After `/PNW-load` succeeds, the AI reports:

```
Project loaded: The Ember Gate
Author: Your Name
Scenes: 24 across 6 chapters
Word count: 42,310 / 120,000
```

If there are warnings (missing directories, scene count mismatch), they appear
here. You can usually ignore them unless they indicate a structural problem.

**Follow up immediately with:**
```
/PNW-status
```
This gives you the full dashboard to reorient before writing.

---

## Part 3: Switching Between Projects

pi-novel-writer supports one active project per session. To switch:

```
/PNW-load C:/novels/second-novel
```

The previous project's state is replaced. No files from either project are
modified when you switch.

**Common multi-project session:**
```
Morning: /PNW-load C:/novels/fantasy-novel
         ... write for 2 hours ...

Afternoon: /PNW-load C:/novels/thriller-short-story
           ... work on short story ...
```

---

## Part 4: Diagnosing Load Problems

### "No project.json found"

The directory does not have an initialized project. Options:
- Check your path: `ls` (or `dir`) to confirm you are in the right place
- If starting fresh: `/PNW-init` to create a new project here
- If the project lives elsewhere: `/PNW-load <correct-path>`

### "Invalid project.json"

The config file exists but cannot be parsed. Possible causes:
- Manual edit introduced a JSON syntax error
- File corruption (rare)

**Fix:** Open `project.json` in a text editor, find and fix the syntax error,
then reload. A JSON validator tool can help locate the problem line.

### Scene count is wrong after load

If `/PNW-status` shows fewer scenes than you expect:
- Check `manuscript/chapters/` for missing chapter directories
- Run `novel_validate` to find frontmatter issues
- Run `novel_reindex` to resync frontmatter with file paths

---

## Part 5: Load as Part of a Consistent Session Routine

```
SESSION START
  /PNW-load                  <- activate the project
  /PNW-status                <- check current state
  /PNW-summarize             <- refresh any stale summaries from last session
  /PNW-next                  <- get oriented on what to do next

... work ...

SESSION END
  /PNW-summarize             <- final summary refresh
  /PNW-progress              <- record your session word count
```

---

## Part 6: After Cloning a Project from Git

If you are restoring a project from version control on a new machine:

1. Clone the repository to a local directory
2. Open pi
3. `/PNW-load <path-to-cloned-repo>`

The `.pi/` directory (which stores daily progress history) may be missing if
it was excluded from git. That is normal — `progress.json` will be recreated
with an empty history.

The `node_modules/` directory will also be missing. Run `npm install` in the
`pi-novel-writer` extension directory before loading if you need the extension
environment to rebuild.
