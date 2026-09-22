# Managed literary writing

Use this opt-in workflow alongside the ordinary novel tools. Existing prose,
custom notes and saved guidance remain unchanged until explicitly edited.

## Author commands

| Command | Effect |
|---|---|
| `/PNW-literary status [jobId]` | Show saved work, accepted head and current session allowance. |
| `/PNW-literary migrate [collaborative|delegated|research]` | Preview stable identities/settings and backups. No paid calls. |
| `/PNW-literary apply <digest>` | Apply the exact current migration/guidance preview; enabled projects also establish matching empty accepted history if absent, without accepting prose or authorizing calls. |
| `/PNW-literary upgrade-guidance [0.2.2]` | Preview saved guidance merge. Unknown baseline retains the current copy. |
| `/PNW-literary authorize <calls> <tokens>` | Permit bounded workers for already prepared work on the current project/model, only for this session. Enter `run` directly next; ordinary chat revokes the grant. |
| `/PNW-literary run <jobId>` | Run the prepared job within the allowance. Prose remains provisional. |
| `/PNW-literary accept <jobId>` | Author acceptance of a reviewed candidate, not a fabricated human study. |
| `/PNW-literary design <kind> <relative.json> <head>` | Save a source-bound plan, voice, anchor or registry design. |
| `/PNW-literary pause` | Revoke permission and abort active workers; retain candidates. |
| `/PNW-literary inspect <jobId> <reason>` | Acknowledge an inspected interrupted reservation without inventing a refund. |
| `/PNW-literary recover-job <jobId> <lockToken>` | Recover an inspected dead same-machine execution lock only. |
| `/PNW-literary migration-lock` | Inspect the setup writer and its migration operation ID. |
| `/PNW-literary recover-migration-lock <lockToken>` | Release only the inspected, stopped same-machine setup writer; does not roll back source changes. |
| `/PNW-literary recover-migration <migrationId>` | Recover an interrupted recorded migration. |
| `/PNW-literary account-lock <jobId>` | Inspect the writer of a job's usage record. |
| `/PNW-literary recover-account-lock <jobId> <lockToken>` | Release only the inspected, stopped same-machine accounting writer; retain reservations and charges. |
| `/PNW-literary store-lock` | Inspect a store writer lock without removing it. |
| `/PNW-literary recover-store <lockToken>` | Recover only an identifiable dead same-machine store owner. |
| `/PNW-literary restore <ancestorHash>` | Preview restoring an earlier complete accepted snapshot. |
| `/PNW-literary apply-restore <digest>` | Create a new accepted child with earlier prose/state; retain later history and current working files. |

Model tools expose schema/design/preparation/run/acceptance and audit operations,
not commands for inventing human authority or increasing a budget. Delegated
acceptance requires the existing author grant. The coordinator still chooses
scene intent and evaluates limitations; runtime schema validity is not truth.

## Important boundaries

Prepared job limits are fixed; renewing the session allowance does not refill
an exhausted job. Its candidate remains in the private checkpoint. Use the
[exhausted-job recovery recipe](walkthrough.md#when-a-job-exhausts-its-allowance)
for an explicit source-bound working edit and fresh preparation, preserving all
prior charges and requiring new review.

For one scene: propose/approve controls and prepare the job **before**
authorizing workers. Then enter `authorize`, `run` and `status` directly.
Do not ask Pi in a new ordinary message to run after granting permission; that
message intentionally revokes the grant. Inspect the result before explicit
author acceptance. See the walkthrough for the complete order.

If the source changes were applied but initial history creation failed, the
error is not successful activation. After resolving the reported obstruction
without removing live or unknown locks, retry the same approved apply in that
session. After reopening, obtain and approve a fresh migration preview. A preview
with no remaining source changes can still establish missing initial history.
Neither retry resets an existing accepted history or grants a worker allowance.

After an interrupted migration, inspect `migration-lock`. Its `operationId`
identifies the journal. Recover a verifiably stopped same-machine owner with
`recover-migration-lock`, then inspect its journal. Use `recover-migration` for
an incomplete journal before a fresh preview. If the journal is complete or was
never created, obtain a fresh preview without rollback after owner recovery.
If interrupted job accounting blocks inspection, use
`account-lock` and `recover-account-lock` first; inspect pending calls separately.
Execution and accepted-store locks retain their separate recovery commands.

Live, foreign, changed and unverifiable owners are refused. Old empty locks,
or a crash before owner metadata was saved, cannot be recovered automatically:
stop rather than guess. Recovery never grants execution permission or refunds
unknown usage.

Working Markdown and accepted prose are distinct. Manual changes create divergence;
re-prepare/review to accept them. Export the appropriate version before attempting
recovery. Never delete `.pnw`, lock files or unknown private records to silence a
warning. Keys and logs are confidential manuscript material, not ordinary Git
publication content. See the [walkthrough](walkthrough.md),
[resources](resources.md), and [managed skill](../../skills/literary-workflow/SKILL.md).

`status <jobId>` distinguishes scene jobs from chapter/arc/manuscript review jobs.
Sequence-review status shows its saved accounting, execution owner and completed
audit reference when present; it has no scene candidate or scene checkpoint.
An accepted job describes a past saved review, not proof that current prose has
been assessed. Recovery does not complete an interrupted review. After recovering
an identified stopped execution owner, `inspect` retains unknown usage as charged
and reports the audit job's paused state. Request a fresh scoped audit for another
attempt; do not use the scene `run`/`accept` route or create a fictional checkpoint.
