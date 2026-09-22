# One reviewed scene

Load the novel with `/PNW-load <path>`, preview managed migration, inspect its
changes and apply the returned digest. Successful enabled activation establishes
an empty accepted history with the matching project identity if one is absent.
Imported prose and facts remain unverified; repeating activation retains existing
history. Check status before proceeding. Activation does not authorize workers.

**Prepare first, authorize last.** Ask Pi to use the literary-workflow skill to
read runtime schemas and propose project-specific plans, voice and scene setup,
without running workers or accepting prose. Proposed JSON stays outside `.pnw`.
If accepted designs need creating or updating, inspect the proposals and use
`/PNW-literary design <kind> <path> <head>` yourself. Read current status after each
design save to obtain the new head before another save. Without delegated
execution authority, Pi must not use `novel_literary_design` to bypass this step.

Then ask Pi to read the exact scene source and call `novel_literary_prepare`.
Preparation needs no worker allowance. Have it return the job ID and budget,
then stop and wait. Future jobs must use current accepted state and source
versions, not an obsolete HEAD.

Choose call/reserved-token limits covering that prepared job's budget. Replace
the placeholders and enter these commands directly:

```text
/PNW-literary authorize <calls> <tokens>
/PNW-literary run <jobId>
/PNW-literary status <jobId>
```

Do not send ordinary chat between authorize and run: new ordinary input
intentionally revokes permission. For a redirection, discuss it first, prepare
again when source/control changes require it, and only then authorize the work.
Migration and saved preferences never supply this session-local permission.

The no-tool worker receives only its role-specific packet;
it cannot see the parent's full conversation or use filesystem/bash tools.
Generated units, discarded alternatives, diagnosis, state proposals, comparison
and usage are retained. A keep-source decision is a successful editorial outcome.

Inspect status and the saved evidence. The result is provisional until the author
explicitly enters `/PNW-literary accept <jobId>` for a ready result they want.
That command does not need a spending grant, but all source/evidence and governance
checks still apply. During separately authorized automatic continuation, Pi may
instead use delegated acceptance within that existing authority. Failed facts,
protected meanings or evidence requirements cannot be averaged away with a style
score. Update only from the final reviewed text. Acceptance commits text and its
state/evidence together; working-file projection is checked for external edits.

Audit chapters/arcs/manuscript using `novel_literary_audit` with `review: true` for
a separately reserved model review. Read-only inspection does not call a model.
Long sequences that do not fit fail rather than being silently sampled. Missing
human review and uncalibrated voice measures remain explicit limitations.

Export with `/PNW-compile accepted` to use one immutable accepted snapshot or
`/PNW-compile working` to read current files. Neither publishes the manuscript.
A pause, project/model change or new author input revokes active worker authority.
After interruption inspect saved work and recover only identifiable dead locks;
resume requires a fresh explicit allowance. Do not re-run an already accepted
job to overwrite current manual work.

For interrupted setup, inspect `/PNW-literary migration-lock`, retain the shown
operation ID and token, then use `/PNW-literary recover-migration-lock <token>`
only after its same-machine writer has stopped. Inspect the journal; if incomplete,
use `/PNW-literary recover-migration <operationId>` before a fresh preview. A
complete or absent journal needs a fresh preview after owner recovery, not rollback.

For an interrupted usage-record update, inspect `/PNW-literary account-lock
<jobId>` and use `/PNW-literary recover-account-lock <jobId> <token>` for a
verified stopped owner. This only releases the accounting lock; pending calls
remain charged until explicitly inspected, and inspection never refunds unknown
consumption. Recover a separate execution lock if present before inspecting calls.
Do not infer ownership for an old empty, malformed, changed or foreign lock.

For a chapter, arc or whole-book review, use the same `status <jobId>`,
stopped-owner recovery and interrupted-call inspection commands. Status identifies
it as a sequence audit and does not require a scene candidate. A recovered or
paused audit is not complete; request a new scoped `novel_literary_audit` with
current sources and fresh permission rather than attempting a scene run.

## When a job exhausts its allowance

Each prepared job has fixed call/token limits. Increasing the session allowance
does **not** refill or resume a blocked job. Preparation and status disclose this
before execution; choose a job budget that includes drafting and review, not just
the first draft call. Recovery never refunds earlier calls or reservations.

The supported alternative is an explicit working-copy edit and a fresh job:

1. Pause, inspect the old job's status and retain its ID, reason, original source
   hash, candidate hash and private checkpoint path. Do not edit its private job
   or checkpoint records.
2. Read the complete checkpoint as data and obtain its decoded `body` exactly,
   not its sketch, JSON wrapper or an invented continuation. It is provisional
   text, not accepted prose. Read the current scene with `novel_scene_read`.
3. Compare the current source hash with the old job's `originalSourceHash`.
   If they differ, do not replace newer work blindly: compare and obtain the
   author's specific reconciliation decision first.
4. With explicit author permission, use `novel_scene_write` to store that complete
   candidate as **working prose**, supplying the current `expectedSourceHash`.
   This preserves the old working version. The ordinary scene writer normalizes
   CRLF line endings to LF; keep all other prose and whitespace unchanged. The
   original private candidate remains untouched. Read the working copy back; its
   normalized prose hash must match `candidateHash`. Any stale-write refusal requires a fresh read and
   a new decision, not dropping the source check.
5. Prepare a new setup against current controls and the new scene source hash.
   Use `review_existing` if the candidate has reached its intended scene ending,
   or `continue` if more prose is needed. Set the new job's requested limits;
   changed protected spans/dependencies must be reconciled before preparation.
6. Prepare a **new job**, then authorize and run it directly as above. Do not run
   the exhausted job again. The new job must complete its own reviews before
   explicit acceptance; neither copying nor new permission accepts the text.

Keep the old candidate and accounting as evidence. This route is not in-place
resumption and does not carry old review approval onto the new working draft.
