# /PNW-help — Walkthrough

How to navigate the help system and find what you need quickly.

---

## Part 1: The Three Layers of Help

### Layer 1: /PNW-help (quick reference)

Gives you the command list in 20 seconds. Use this when you know roughly
what you want to do and just need the exact command name.

```
/PNW-help
```

### Layer 2: /PNW-next (contextual guidance)

Tells you specifically what to do next based on your current project state.
More useful than `/PNW-help` mid-project because it knows where you are.

```
/PNW-next
```

### Layer 3: help/ folder (deep documentation)

When you need to understand a command fully — all its options, all its tools,
how it works under the hood, and step-by-step workflows.

Ask the AI:
> "Read help/compile/walkthrough.md"
> "Show me the resources file for the summarize command"
> "Read help/INDEX.md"

---

## Part 2: Finding the Right Help File

### You want to understand a command

```
help/{command}/help.md         <- parameters, tools, error states
```

Examples:
```
help/init/help.md
help/sprint/help.md
help/compile/help.md
```

### You want step-by-step instructions

```
help/{command}/walkthrough.md  <- scenarios and workflows
```

### You want technical details

```
help/{command}/resources.md    <- file formats, algorithms, tool table
```

### You want an overview of everything

```
help/INDEX.md                  <- full command index with table
```

---

## Part 3: New Writer Orientation

If you are new to pi-novel-writer, read these in order:

1. `help/init/walkthrough.md` — start a project
2. `help/INDEX.md` — understand the full command set
3. `help/bible/walkthrough.md` — build the world bible
4. `help/outline/walkthrough.md` — create chapter outlines
5. `help/sprint/walkthrough.md` — start writing

Ask the AI at any point:
> "What should I do next?"   <- runs /PNW-next logic

---

## Part 4: Looking Up a Specific Tool

If you want to know how a specific AI tool works (rather than a slash command):

Ask the AI:
> "Explain how edit_suggest works"
> "What does novel_scene_status do?"
> "How does bible_consistency_check work?"

Or search the help files:
> "Find documentation for analyze_pacing in the help folder"

---

## Part 5: Help When Something Breaks

If a command is not working as expected:

1. Check the `help/{command}/help.md` error states section
2. Check the `help/{command}/resources.md` technical details
3. Run `/PNW-status` to confirm the project is loaded and healthy
4. Run `novel_validate` to check for frontmatter issues
5. Ask the AI: "Why might /PNW-X be behaving unexpectedly?"

Common first steps for most problems:
```
/PNW-load        <- confirm project is loaded
/PNW-status      <- confirm structure looks right
novel_validate   <- check for file issues
```
