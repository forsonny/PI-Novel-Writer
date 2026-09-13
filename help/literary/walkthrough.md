# One reviewed scene

Load the novel with `/PNW-load <path>`, preview managed migration, inspect its
changes and apply the returned digest. Grant a small call/token allowance. This
permission is separate from migration and saved project preferences.

Ask Pi to use the literary-workflow skill. It reads runtime schemas, builds a
project-specific voice and scene contract, reads the exact scene source hash,
saves the setup JSON outside `.pnw`, and calls `novel_literary_prepare`. Future
jobs must be prepared against the current accepted state, not an obsolete HEAD.

Run the prepared job. The no-tool worker receives only its role-specific packet;
it cannot see the parent's full conversation or use filesystem/bash tools.
Generated units, discarded alternatives, diagnosis, state proposals, comparison
and usage are retained. A keep-source decision is a successful editorial outcome.

Inspect status. Under delegated authority Pi may accept a ready result; in
collaborative mode the author uses the explicit accept command. Failed facts,
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
