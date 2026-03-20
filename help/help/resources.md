# /PNW-help — Resources

Technical reference for the help command and help system structure.

---

## Help Folder Structure

```
help/
  INDEX.md                    <- full command index and quick reference
  init/
    help.md
    walkthrough.md
    resources.md
  load/
    help.md
    walkthrough.md
    resources.md
  status/
    help.md
    walkthrough.md
    resources.md
  bible/
    help.md
    walkthrough.md
    resources.md
  outline/
    help.md
    walkthrough.md
    resources.md
  edit/
    help.md
    walkthrough.md
    resources.md
  suggestions/
    help.md
    walkthrough.md
    resources.md
  compile/
    help.md
    walkthrough.md
    resources.md
  progress/
    help.md
    walkthrough.md
    resources.md
  sprint/
    help.md
    walkthrough.md
    resources.md
  help/
    help.md
    walkthrough.md
    resources.md
  next/
    help.md
    walkthrough.md
    resources.md
  summarize/
    help.md
    walkthrough.md
    resources.md
  github/
    help.md
    walkthrough.md
    resources.md
```

---

## Document Conventions

Each help file follows a consistent structure:

**help.md:**
- Command syntax and parameters table
- "What it does" numbered list
- Requirements and "when to use"
- Error states
- All AI-callable tools the command uses, with full parameter tables

**walkthrough.md:**
- Scenario-based, step-by-step instructions
- Common workflows across multiple commands
- Troubleshooting by scenario
- Tips and best practices

**resources.md:**
- File paths and directory structure
- Data format examples (JSON, YAML, Markdown)
- Algorithm descriptions
- Complete tool reference table
- Related files cross-reference

---

## Tool Reference

### `/PNW-help` command

| Field          | Detail                                              |
|----------------|-----------------------------------------------------|
| Registered in  | `extensions/novel-progress.ts`                      |
| Description    | Show available commands grouped by workflow stage   |
| Usage          | `/PNW-help`                                         |
| Side effect    | Read-only                                           |
| Project needed?| No — works without a loaded project                 |

---

## Related Files

| File                           | Purpose                                          |
|--------------------------------|--------------------------------------------------|
| `extensions/novel-progress.ts` | /PNW-help and /PNW-next command registration     |
| `help/INDEX.md`                | Full command and skill index                     |
| `help/next/help.md`            | Contextual guidance based on project stage       |
