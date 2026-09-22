# pi-novel-writer

A novel-writing environment for Pi. **0.3.0-rc.1** adds an opt-in managed
literary workflow: conditional voice, explicit scene intent, epistemic memory,
isolated drafting/review workers, protected revision, atomic prose/state acceptance,
and chapter/arc/manuscript audits. Existing collaborative and legacy autonomous
workflows remain available.

This is an experimental implementation of the supplied *Beyond Fluency* design,
not a demonstrated solution to novel-scale literary quality. See
[implementation scope and verification](docs/implementation-status.md),
[change history](CHANGELOG.md), and [managed workflow](skills/literary-workflow/SKILL.md).

## Managed literary workflow

In a separate novel directory, initialize or load the project, then preview:

```text
/PNW-literary migrate delegated
/PNW-literary apply <digest returned by the preview>
```

Approved activation creates matching empty accepted history if it is missing;
repeating activation preserves existing history. Migration preserves manuscript
wording and author guidance. It does not accept prose, validate imported facts
or authorize paid calls. Existing saved guidance can be upgraded
separately with `/PNW-literary upgrade-guidance 0.2.2` and explicit application of
the returned preview. Author conflicts remain visible instead of being overwritten.

For a bounded single-scene session, **prepare before authorizing execution**.
Ask Pi to use the `literary-workflow` skill to propose the actual plan, voice and
scene setup without running workers. Complete any author design approvals, then
ask Pi to prepare one version-bound job and return its ID and budget. The
[walkthrough](help/literary/walkthrough.md) explains those preparation steps.
`configs/example-scene-setup.json` is only an illustration: replace its IDs and
narrative/voice data before use.

Choose call/reserved-token limits that cover the prepared job's budget, then
enter these commands directly, replacing the placeholders:

```text
/PNW-literary authorize <calls> <tokens>
/PNW-literary run <jobId>
/PNW-literary status <jobId>
```

Do not insert an ordinary chat request between authorization and running.
Ordinary input deliberately revokes permission. If you need to redirect the work,
finish that discussion, prepare against current sources and authorize again.
Limits are not a cost prediction. Running leaves the result provisional; inspect
it and, only if ready and wanted, explicitly accept with
`/PNW-literary accept <jobId>`. Acceptance is not publication or a human study.

For delegated automatic continuation on a managed project:

```text
/PNW-auto start --calls 100 --tokens 1000000 --turns 30 <your brief>
/PNW-auto pause
/PNW-auto resume --calls 100 --tokens 1000000 --turns 30
```

Limits are explicitly authorized per session; restart never restores spending
permission. Model tools cannot silently increase them. Worker and coordinator
usage are reported separately. Creative delegation never authorizes publication.

Prepared jobs also have fixed budgets: renewing session permission does not refill
an exhausted job. Its saved draft and prior charges remain intact. Use the
[candidate-reuse procedure](help/literary/walkthrough.md#when-a-job-exhausts-its-allowance)
for an explicit working edit, fresh preparation and new permission—not a silent restart.

Managed completion requires current accepted scenes, summaries, reading order and
complete chapter/arc/manuscript audits, not a `final` status label. A model audit is
not a human read. Long scopes that exceed context are reported as incomplete.
Export working files with `/PNW-compile working` or an immutable accepted snapshot
with `/PNW-compile accepted`. These exports do not publish anything.

The detailed [literary help](help/literary/help.md) covers recovery, restoration,
source-bound edits, permissions and data paths. The remaining legacy workflow
reference below applies to projects that have **not** enabled managed mode.

## Legacy autonomous writing

After opening Pi in a **separate folder for your novel**:

```text
/PNW-init
/PNW-auto start Write a standalone progression-fantasy novel about ... [your brief]
```

Include any fixed audience, length, content boundaries, viewpoint, ending
requirements, and ideas you want preserved. The writer makes other creative
choices independently. It does **not** pause for concept, outline, voice, chapter,
or edit approval. It stops at the reviewed draft, a genuine blocker, or your
interruption. It does not publish, upload, or purchase anything.

```text
/PNW-auto status
/PNW-auto status full
/PNW-auto pause
/PNW-auto resume
```

Pi must remain running for automatic continuation. Reloading, closing Pi,
switching novels, an aborted response, or an unrecovered model error stops the
run; resume explicitly after inspecting the saved work. A new ordinary message
pauses the run so you can redirect it. Creative delegation is saved; execution
permission is not silently restored on startup. If the model stops without
saving progress, one recovery request asks it to checkpoint real work or name a
blocker; a second failure stops rather than looping indefinitely.

`/PNW-auto pause` acknowledges only after the current activity has settled.
Status/progress and sprint notices are informational: they do not request another
model response or restart a paused run. Explicit resume restarts autonomy; a new
author request can still make a separately directed edit while autonomy stays paused.

Successful checkpoints end a work unit without an extra model recap. Between
units (and on resume), autonomous writing requests compaction at the smaller of
128,000 tokens or 60% of the model context window. Saved prose, decisions and
continuity remain on disk; compaction failure pauses rather than restarting blindly.
This limit is a bounded default, not a claim of an optimal configuration.
Progress replies are compact by default. Request `status full` or
`novel_auto_status(full: true)` only when the complete evidence/issue index is needed.
Changing progress is supplied at the end of context, not in the stable instructions.

The process adapts the supplied progression-fantasy brainstorming, outlining,
and drafting/prose theses. It preserves candidate alternatives, causal scene
plans, capability/knowledge/resource consequences, and prose-based review
evidence. The full sources and operational mapping are in
[`skills/autonomous-novel/`](skills/autonomous-novel/SKILL.md).
Other genres can use the same route with progression-specific checks marked
not applicable rather than imposed as a formula.

The run saves its brief, phase, next action, evidence and review fingerprints in
`.pi/novel-run.json`. Creative records stay in the normal novel folders, with
entry points at `notes/auto-brief.md`, `notes/auto-concept.md`,
`outline/auto-plan.md`, and `notes/auto-review.md`. New runs do not replace saved
runs; use another novel folder for another brief.

Completion requires every planned scene, the recorded length range, a current
six-aspect review and summary for each scene, no blocking review findings, and
a current final review document. It compiles the current prose into `exports/`.
These are **coverage and freshness checks**, not proof of literary quality.
Reviews are AI assessments, not independent human or market validation.
Read the manuscript and its accepted limitations before treating it as final.

### Existing projects

Use `/PNW-load <path>`; do not initialize again. Initialization now refuses to
overwrite an existing novel. The autonomous route is opt-in and preserves
existing prose. Scene writes and targeted revisions keep prior versions in
`notes/revisions/`; backups are named by their content fingerprint and include
scene metadata. Older project-specific writing instructions are not overwritten. Installed
`.pi/APPEND_SYSTEM.md` copies do not update with the package. To upgrade project
guidance, compare and merge the current rules without overwriting author additions.
The exact old stock prohibition on reading summaries is corrected in the running
instructions without changing your files. Merge that correction into saved guidance
too, but keep summary writes through
`summary_generate`. Remove conflicting milestone approvals only if you want the
autonomous delegation to replace them.

---

## What It Does

pi-novel-writer extends Pi with a suite of slash commands, AI tools, and skills that guide
you from a blank directory to a compiled manuscript. Everything is plain files on disk:
Markdown scenes, YAML frontmatter, JSON progress records, and no proprietary formats.

**Workflow stages it covers:**

```
Premise  ->  World Bible  ->  Outline  ->  Drafting  ->  Editing  ->  Export
```

At each stage, the AI can retrieve world-building data, outlines and summaries.
That supports continuity across a long manuscript, but does not guarantee it:
factual claims still need comparison with actual prose.

---

## Prerequisites

- **Pi 0.85.1** - the pinned development baseline; uses the `@earendil-works` packages and current extension lifecycle
- **Node.js 22.19+**
- **Pandoc** (optional, for DOCX export)
  - Windows: `winget install JohnMacFarlane.Pandoc`
  - macOS: `brew install pandoc`
  - Linux: `apt-get install pandoc`

---

## Installation

Clone or download this repository, then load the extension when starting Pi:

```bash
pi -e /path/to/pi-novel-writer/
```

To make it permanent:

```bash
pi install /absolute/path/to/pi-novel-writer
```

Pi supplies the declared peer dependencies. No TypeScript compilation step or
separate runtime dependency installation is needed when loaded through Pi.

---

## Quick Start

```bash
# 1. Create a directory for your novel and open Pi with this extension
mkdir my-novel && cd my-novel
pi -e /path/to/pi-novel-writer/

# 2. Initialize the project
/PNW-init

# 3. Run the guided setup skill to configure title, genre, and targets
Run the getting-started skill

# 4. Build your world and structure
Run the premise skill
Run the world-building skill
Run the character-interview skill for [character name]
Run the outline-novel skill

# 5. Start writing
/PNW-sprint
```

---

## Commands

### Setup and Navigation

| Command              | Description                                                     |
|----------------------|-----------------------------------------------------------------|
| `/PNW-init`          | Initialize a new novel project in the current directory         |
| `/PNW-init --quick`  | Minimal init: configuration, Git text settings and one outline-status scene; no full templates |
| `/PNW-load`          | Load the project in the current directory                       |
| `/PNW-load <path>`   | Load a project from an explicit path                            |
| `/PNW-status`        | Full dashboard: word counts, chapter table, alerts              |
| `/PNW-help`          | List all currently registered novel commands alphabetically     |
| `/PNW-next`          | Detect current workflow stage and show what to do next          |
| `/PNW-auto start <brief>` | Start autonomous writing through a reviewed draft         |
| `/PNW-auto status`  | Show saved writing phase, next action and evidence             |
| `/PNW-auto pause`   | Stop the current response and automatic continuation          |
| `/PNW-auto resume`  | Continue the saved run after interruption or a resolved blocker |

### World-Building and Structure

| Command         | Description                                          |
|-----------------|------------------------------------------------------|
| `/PNW-bible`    | List all world-building entries (characters, locations, factions, items, world) |
| `/PNW-outline`  | List chapter outline titles and purposes, not the beat sheet body |

### Writing

| Command              | Description                                              |
|----------------------|----------------------------------------------------------|
| `/PNW-sprint`        | Start a 25-minute timed writing sprint                   |
| `/PNW-sprint <min>`  | Sprint for a custom duration (e.g. `/PNW-sprint 15`)     |
| `/PNW-summarize`     | Batch refresh all stale or missing summaries             |
| `/PNW-summarize <ch> <sc>` | Summarize one scene (e.g. `/PNW-summarize 2 3`)    |
| `/PNW-summarize chapter <n>` | Summarize a whole chapter (e.g. `/PNW-summarize chapter 2`) |

### Editing

| Command             | Description                                               |
|---------------------|-----------------------------------------------------------|
| `/PNW-edit`         | Show editing guidance; does not change which tools are enabled |
| `/PNW-suggestions`  | List pending suggestions; ask the AI to accept, reject or modify a displayed ID |

### Publishing and remote copies

| Command         | Description                                              |
|-----------------|----------------------------------------------------------|
| `/PNW-compile`  | Compile every discovered scene to Markdown; attempt DOCX via Pandoc |
| `/PNW-progress` | Word count progress dashboard with 7-day UTC snapshots   |
| `/PNW-github` | Show local Git/GitHub status |
| `/PNW-github-connect <url>` | Configure an HTTPS remote without committing or publishing |
| `/PNW-github-push [message]` | Preview exact eligible files, confirm, commit, and push |
| `/PNW-github-pull` | Fast-forward the saved branch only when the working tree is clean |
| `/PNW-github-clone <url> [dir]` | Clone with the Git credential helper; inspect before loading |

Compilation does not filter scene status, publish, create PDF/EPUB, apply custom
formatting, or clean old exports. Scene and bible “delete” tools archive recoverable
copies. Merge archives both inputs but removes the second scene from the active
manuscript. GitHub connect never publishes. Pushes never force-update history,
never stage private `.pi/` or `.pnw/` files, and are bound to a reviewed file preview.
Authentication uses your configured Git credential helper. Do not paste tokens
into chat. Existing token-bearing configurations require explicit
`novel_github_credentials_cleanup` preview and approval; this does not erase prior
logs, revoke credentials, or rewrite history.

---

## Skills

Skills are AI-guided workflows invoked by asking the AI directly.
They run multi-step processes and call the underlying tools automatically.

| Skill                | Trigger phrase                                    | Purpose                           |
|----------------------|---------------------------------------------------|-----------------------------------|
| `getting-started`    | "Run the getting-started skill"                   | Guided initial project setup      |
| `autonomous-novel`   | `/PNW-auto start <brief>`                         | Autonomous, thesis-based manuscript workflow |
| `premise`            | "Run the premise skill"                           | Develop story concept and hook    |
| `world-building`     | "Run the world-building skill"                    | Create bible entries interactively|
| `character-interview`| "Run the character-interview skill for [name]"    | Deep character development        |
| `outline-novel`      | "Run the outline-novel skill"                     | Full beat sheet, all chapters     |
| `outline-chapter`    | "Run the outline-chapter skill for chapter [N]"   | Scene-by-scene chapter breakdown  |
| `draft-scene`        | "Run the draft-scene skill"                       | Draft a scene from its outline    |
| `retroactive-outline`| "Run the retroactive-outline skill"               | Generate outline from existing scenes |
| `import`             | "Run the import skill"                            | Import an existing manuscript     |
| `dev-edit`           | "Run the dev-edit skill on chapter [N]"           | Developmental/structural editing  |
| `line-edit`          | "Run the line-edit skill on scene [N.M]"          | Prose refinement                  |
| `copy-edit`          | "Run the copy-edit skill on chapter [N]"          | Grammar and style pass            |
| `continuity-check`   | "Run the continuity-check skill on chapter [N]"   | Fact-check against world bible    |
| `voice-match`        | "Run the voice-match skill for [character]"       | Character voice consistency check |
| `github-setup`       | "Run the github-setup skill"                      | Guided, explicitly authorized remote setup |

---

## Prompts

Short prompts for focused AI tasks. Invoke them as slash commands, for example
`/scene-expand <your sketch>` or `/dialogue-polish <your dialogue>`.

| Prompt             | Purpose                                         |
|--------------------|-------------------------------------------------|
| `brainstorm`       | Generate story ideas from a concept or question |
| `what-if`          | Explore scenario variations                     |
| `scene-expand`     | Expand a scene sketch into full prose           |
| `dialogue-polish`  | Refine a dialogue exchange                      |

---

## Project Structure

Full `/PNW-init` starts a novel with one scene. The layout grows as work is saved:

```
my-novel/
  project.json              # project config, word count targets, context budgets
  manuscript/
    chapters/
      01/
        scene-01.md         # scene files with YAML frontmatter
        scene-02.md
      02/
        ...
  bible/
    characters/             # character entries
    locations/              # location entries
    items/                  # item entries
    factions/               # faction entries
    world/                  # world rules, magic systems, etc.
  outline/
    chapters/               # chapter outline files
  summaries/
    scenes/                 # per-scene summaries with integrity hashes
    chapters/               # chapter-level summaries
  exports/                  # compiled Markdown and DOCX output
  continuity/
    facts.json              # agent-maintained facts with scene evidence, not automatic extraction
    character-states.json   # agent-maintained actual character records; shapes may vary
  timeline/
    timeline.json           # timeline event records
  notes/
    deleted-scenes/         # archived scenes (non-destructive delete)
    deleted-bible/          # archived bible entries
  .pnw/                     # private managed snapshots, objects, jobs and migration backups
                            # present only after explicit managed migration
  .pi/
    APPEND_SYSTEM.md        # writing guidance added to Pi's normal instructions
    AGENTS.md               # editable project notes
    novel-run.json          # autonomous progress, only after explicitly starting
    progress.json           # UTC total-word snapshots and stored goals
```

Project sources and records are plain text. Optional DOCX exports are binary; no database is used.
Short-story format uses `manuscript/scenes/`; flash fiction uses
`manuscript/story.md`. Use scene tools to discover paths rather than assuming
the novel layout.

---

## Legacy context injection

Outside managed workers, automatic context includes the voice profile, a bounded selection of bible
entries and fresh summaries. It is not guaranteed to include everything a scene
needs. Drafting must explicitly read its scene card, relevant prior prose and
continuity records. Autonomous progress is restored separately on each continuation.

```
[STORY CONTEXT]
  Voice profile      <- writing style sample (voiceProfile budget)
  Bible entries      <- all five types; core, secondary, then minor (bible budget)
  Summaries          <- fresh scene summaries (recent first), with chapter fallback
```

Adjust budgets in `project.json` under `settings.contextBudget`. Token estimation
uses a 4 characters-per-token approximation. `context_summary` reports selected
and omitted bible entries and selected summaries.

---

## Summary System

New summary writes require the hash of the source actually read and their relevant
file dependencies. A stale prepared summary is rejected instead of stamped as fresh.
Managed acceptance also stores an immutable evidence-derived summary.

Summaries help maintain continuity without rereading every scene on every turn.
Each drafted scene has a corresponding summary file
with a SHA-256 hash of the scene body. If the prose changes, the hash fails and
the summary is flagged as stale and excluded from automatic context. Chapter
summaries fingerprint their drafted scene contents too. Legacy chapter summaries
need regeneration once; missing or unverified evidence is not called current.
Use `summary_read({chapter, scene?})` to inspect a saved summary, freshness and
source path without regeneration. Ordinary read-only summary access is allowed;
creation and replacement stay in `summary_generate`. A matching fingerprint proves
only that the source is unchanged, not that the summary is accurate.

```bash
/PNW-summarize              # find and refresh all stale or missing summaries
/PNW-summarize 2 3          # refresh summary for chapter 2, scene 3
/PNW-summarize chapter 2    # refresh the chapter-level summary for chapter 2
```

See `help/summarize/` for full documentation.

---

## Edit Suggestion Workflow

In collaborative work, editing skills can save suggestions in
`.pi/edit-suggestions.json`. Accepting a suggestion now actually replaces its
unique matching passage against its stable scene ID and expected full-source hash.
Old unversioned suggestions must be reproposed. Stale or ambiguous matches fail without consuming the
suggestion. Prior prose is retained. Autonomous writing applies its own justified
revisions instead of waiting for individual approvals.

```bash
/PNW-edit                   # enter editing mode
# Ask AI: "Run the dev-edit skill on chapter 1"
/PNW-suggestions            # review the generated suggestions
# Ask to accept, reject, or modify an actual suggestion ID shown by the list.
```

---

## Help System

Command-group documentation lives in `help/`; autonomous operation is covered
above and in `skills/autonomous-novel/SKILL.md`:

```
help/INDEX.md               # full command index and quick reference
help/{command}/
  help.md                   # parameters, tools, error states
  walkthrough.md            # step-by-step scenarios
  resources.md              # file formats, internals, tool reference
```

Ask the AI to read any help file:
```
Read help/compile/walkthrough.md
Read help/INDEX.md
```

Or run `/PNW-help` for the compact command list.

---

## Architecture

pi-novel-writer is built from three types of components:

**Extensions** (TypeScript modules, loaded via `jiti` — no compile step required):
- `novel-core.ts` — project state, scene CRUD, `/PNW-init`, `/PNW-load`, `/PNW-status`
- `novel-bible.ts` — world bible, outlines, `/PNW-bible`, `/PNW-outline`
- `novel-write.ts` — drafting tools, context injection, summary system, `/PNW-summarize`
- `novel-edit.ts` — analysis, edit suggestions, `/PNW-edit`, `/PNW-suggestions`
- `novel-export.ts` — manuscript compilation, Pandoc DOCX, `/PNW-compile`
- `novel-progress.ts` — word count tracking, sprints, `/PNW-progress`, `/PNW-sprint`
- `novel-github.ts` — GitHub integration for novel repositories
- `novel-literary.ts` - managed schema, design, preparation, execution, acceptance, audit and recovery commands
- `llgf/` - typed internal services and atomic store
- `novel-auto.ts` — persistent autonomous run, continuation, evidence and completion gates

Editorial analysis tools return actual scene evidence for the AI to assess.
They do not claim fixed pacing percentages, invented reading grades, or automatic
clean continuity. Status changes no longer overwrite character knowledge with
empty status markers. `bible_consistency_check` is date-based freshness only:
missing, invalid or future synchronization dates mean unknown, never factually
consistent. `novel_character_knowledge` returns only the matching actual character
record without a cutoff; with a cutoff it reconstructs evidence involving that
character through and including the scene. Evidence is not proof of knowledge and
cannot remove future information already present elsewhere in the conversation.

## Verification

See [the implementation status](docs/implementation-status.md) for observed test
results and outstanding release gates. Run `npm ci --ignore-scripts`,
`npm run check`, and `npm run pack:check` in the source checkout. The test host
validates actual extension registrations, but mocks provider responses. No live
provider or human evaluation of this release candidate is implied.

`npm run schemas` regenerates runtime-derived structural schemas; the suite fails
if exports are stale. `npm run evaluate -- ...` prepares offline frozen trial and
reader packets. See [the evaluation protocol](protocols/evaluation.md). It makes no
model calls and does not fabricate reader outcomes or statistical evidence.

### Corrected editing and progress behavior

- Splitting retains existing scene IDs so other scene references do not break.
  A continuation gets a new ID but an adjacent reading position (`order` in its
  frontmatter). Lists, searches, chapter summaries and compilation use that order.
  Refresh the split scenes' summaries and scene cards. Original prose is retained.
- Bulk find/replace and entity renaming retain earlier manuscript versions in
  `notes/revisions/`, just like targeted edits.
- Word goals are authoritative in `project.json`; `progress_set_goal` updates
  those settings and the progress view together. For an older project whose two
  goal stores disagreed, set the desired goal once to reconcile them.
- Usage displays show the **current session's reported estimate**, including
  tool and compaction usage, not a project lifetime bill. Unsupported telemetry
  is not silently presented as zero.
- `cost_estimate(scope: "scene")` requires `chapter` and `scene`;
  `scope: "chapter"` requires `chapter`. Its estimate excludes repeated history
  and other context and must not be interpreted as billing.

**Skills** (Markdown workflow files in `skills/`):
Structured multi-step AI workflows. The AI reads the skill file, then conducts a
guided process using the registered tools. No code execution required.

**Prompts** (Markdown templates in `prompts/`):
Short focused prompts for common single-task AI requests.

---

## Contributing

Improvements to skills, prompts, and extensions are welcome.

- Skills and prompts are Markdown files — no TypeScript knowledge needed to contribute
- Extension tools follow the Pi tool registration API (`pi.registerTool`, `pi.registerCommand`)
- Open an issue before submitting a large change

---

## License

MIT

## Development verification

The development host is pinned to Pi 0.85.1. Use Node 22.19.0 or later, then
`npm ci --ignore-scripts` and `npm run check`. Checks parse every TypeScript file,
run strict typechecking, and exercise the real extension registrations against a
non-model test host. A passing engineering suite is not a literary benchmark.
