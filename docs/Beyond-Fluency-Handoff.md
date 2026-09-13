# Beyond Fluency: verified merge and handoff

## Outcome

**MERGED through [PR #2](https://github.com/forsonny/PI-Novel-Writer/pull/2)
on 13 September 2026 at 07:26:17 UTC.**

The exact delivery was recovered, integrated with newer master documentation,
reviewed, corrected in seven separate checkpoints, and merged without force or
branch deletion. Fresh GitHub reads confirmed the merge and resulting master
`5f80cba0eee466ef3f96bc237a505db7cfe07b27`.

The final implementation passed **151 tests, zero failures/skips, strict typing,
29 runtime/schema comparisons, syntax checks and package/import/private-exclusion
checks (189 files) on Ubuntu, Windows and macOS, all using Node 22.19.0**.
The PR test-merge tree exactly equals the actual merge tree. Post-merge evidence
is recorded below. This report is a documentation follow-up to the feature merge.

The earlier cleanup-policy blockers were resolved by explicit user-requested rule
changes and reloads. The hosted workflow was inspected: GitHub-hosted disposable
runners, no workstation mounts or persistent/external cleanup targets, read-only
repository permissions, pinned standard actions, no shared-cache cleanup.
Job metadata confirmed the GitHub Actions runner group for all three platforms.
No local safeguard or assertion was bypassed. No paid provider call, private
manuscript upload, npm publication or independent human literary evaluation occurred.

## Actual repository and delivery identities

| Item | Independently observed value |
|---|---|
| Repository | `forsonny/PI-Novel-Writer` |
| Authenticated access | GitHub CLI authenticated; repository permission ADMIN; recovery push succeeded |
| Default branch | `master` |
| Master at recovery start | `157a62df9d35a979a949304d742fed7628cc94c7` |
| Historical reviewed branch | `9845c06ba67ba5bada2e7635244bbdf79534d0d3` |
| Historical completion branch | `cd95b6c5003dc277e3573370cdb8ae30871e65fb` |
| Existing merged PR | [#1](https://github.com/forsonny/PI-Novel-Writer/pull/1) |
| Existing merge | `8fbc55538c7c22462952a457355218d4764ecbc3` |
| Audited baseline in history | `1ce34a1593595d30cfa1889cfef8dbb7dbc42e84` |
| Verified delivery base tree | `926d6aab59b21bb0e9c79b334e0a982390b92dc9` |
| Claimed original local commit | `466bd92c7e8d5fca1bea7f5caaf35f8fa2b96a73`; absent from fetched local objects; also present in source ZIP comment |
| Independently reproduced delivery tree | `4e418f00c8126cabe4166f8bfd1ed980251b1ad2` |
| Delivery patch SHA-256 | `9a76a39021a9bf9bf49edb34dbbbd28a2dbff1a918b45886800761ae0c1fe525` |
| Integrated recovery tree | `891805287476f57530234eaae7ab46846323ca3b` |
| Preserved candidate commit | `76b9e3c5523466ee1be0c3489cf50aa31cc21191` |
| Candidate branch | `recovery/beyond-fluency-candidate` |
| Candidate parent | Starting master `157a62df9d35a979a949304d742fed7628cc94c7` |
| Integrated working branch | `recovery/beyond-fluency-verification` |
| Implementation merge checkpoint | `616e253a3983aced26331a28b36219bcb994ede4` |
| Final implementation head | `754c64c2e721d12ba3e8f537c09c177ee47be6e4` |
| PR test-merge commit | `194ef75e76367423ee2950a2eafb0e310201d28d` |
| Verified final implementation tree | `97eb0ba53eb3edb380f9a5309d46ec50f7ae1727` |
| Feature PR | [#2](https://github.com/forsonny/PI-Novel-Writer/pull/2), merged |
| Actual merge / resulting master | `5f80cba0eee466ef3f96bc237a505db7cfe07b27` |
| Final-head PR checks | [34745144723](https://github.com/forsonny/PI-Novel-Writer/actions/runs/34745144723), all three successful |
| Post-merge checks | [34745228600](https://github.com/forsonny/PI-Novel-Writer/actions/runs/34745228600), all three successful on actual merge `5f80cba...` |

Branch protection lookup returned HTTP 404, “Branch not protected.” This is not
permission to bypass verification. No repository settings were changed.

The old handoff describes Changes 01–19 as merged and a 107-test checkpoint as
unmerged. The separately discovered
`PI-Novel-Writer-0.3.0-rc.1-delivery.zip` contains later Changes 20–35 and claims
147 tests. Those are different checkpoints, not interchangeable evidence.
Starting master differed from the delivery's base only by `docs/HANDOFF.md`.
The integrated recovery tree differs from the exact delivery tree only by that
preserved document. No newer source change was overwritten.

## Recovery method and retained evidence

The delivery was extracted outside the active repository to
`C:/dev/pi_novel_writer/recovery-evidence/pi-novel-writer-delivery`.
The source was extracted alongside it to `pi-novel-writer-0.3.0-rc.1`.
These directories have been retained.

Read before any candidate script execution: delivery README, manifest, checksum
list, QA report, implementation status, application guard, and review records
24–35. The original merge handoff, original blueprint's architecture and backlog,
and the dissertation's evidence-status passages were also inspected. Reviews
20–23 and the full blueprint were read during continuation. The full dissertation
and every historical review were not independently re-audited.

The application guard requires a clean checkout and exact base tree, then applies
and stages the patch and checks the result tree. Starting master was not that exact
base: it contained a newer handoff. The guard was not bypassed or executed.
Instead, an external alternate Git index loaded the verified completion base,
checked and applied the cumulative patch **to the index only**, and produced the
exact expected tree. A second alternate index started from that master and
repeated the check/application. This preserved the extra handoff and produced the
integrated tree above. Neither operation deleted working files.

A normal commit object with starting master as its parent preserves the integrated
tree. That candidate was pushed without force to its new branch. A fresh GitHub
read returned the exact candidate commit. A fresh master read still returned
`157a62d...`. No existing branch was deleted or rewritten. The candidate branch
does not match this workflow's push triggers, so its preservation push does not
constitute a CI run. The delivery was subsequently merged locally into
`recovery/beyond-fluency-verification`, retaining both parents and this report.
The obsolete patch executor was moved to the Windows Recycle Bin before that
merge; it was not permanently deleted. No source ZIP was copied over master.

## Corrective checkpoints and review

Two supervised read-only reviewers inspected the recovered source, not the older
checkout. Their review covered the adapter, workers, authority, pipeline, store,
jobs/execution, autonomy, export/progress, context, migration, audits and revision
paths with relevant tests. Both finished and their sessions were released. Their
findings were independently reproduced before repair:

1. `71769b8b471635db68d880019e19310f7aa7d874`: a ready scene could be accepted after
   insertion of an earlier sibling. Persist and recheck reading-order identity
   during execution and acceptance. The regression exercises both model-tool
   and explicit author acceptance and confirms unchanged accepted HEAD/prose on
   rejection. Red: missing expected rejection; green: 11 relevant tests and types.
2. `0b52dc7623830f2dfbcc312bfecbe1f8f4293099`: a selected anchor's otherwise
   unretrieved evidence did not invalidate downstream acceptance. Attach selected
   anchor records and accepted source-span versions to actual context receipts.
   Red: acceptance incorrectly remained fresh; green: 18 context/voice/evidence
   tests and types. Prose-first reading remains free of voice/control context.
3. `befbe9fe129efa250b61dc15c7aaa56ee60fd4ca`: `export_docx` could call Pandoc with
   an arbitrary destination during managed unattended writing, bypassing direct
   write restrictions. Block that tool while armed; scoped `compile_manuscript`
   remains available, and author-directed conversion remains available after
   pause. Red: hook allowed it; green: all 3 managed-completion tests and types.
   The regression checks manuscript and outside-project destinations without
   invoking Pandoc or damaging a manuscript.
4. `3feb3190108491f13aaa454e0bcd8514f634bb15`: with `core.autocrlf=true`, the actual
   Windows checkout failed exact schema comparison although the LF-only ZIP
   passed. `.gitattributes` now retains LF for generated schema JSON. Existing
   schema tests reproduced and verify the repair; runtime schemas did not change.
5. `d62844d016dac2b0206dbbe63e438201ea80d9d5`: hosted Windows rejected legitimate
   Git repository roots with different native path spellings. Compare directory
   filesystem identities instead of path strings. A namespaced-path regression
   failed before repair and passed afterward; nested parent repositories remain
   rejected. Six focused tests and strict types passed.
6. `159e883826e1a2bcb0c7c589f625d61dc50f1cfc`: macOS temporary roots could use
   `/var` while scanned scenes used `/private/var`, producing invalid relative
   manuscript addresses. Canonicalize loaded project roots. An explicit
   symlink-root regression failed before repair; 17 focused tests and types
   passed afterward. Two existing path assertions now correctly expect the
   already-documented canonical result rather than a lexical alias; containment
   and escaping-symlink checks remain intact.
7. `754c64c2e721d12ba3e8f537c09c177ee47be6e4`: retain the selected working-directory
   alias when it resolves to the armed project's canonical root. This allows
   legitimate note writes on macOS without allowing manuscript writes through
   that alias. The protected-write regression failed before repair; all three
   managed-completion tests and types passed afterward.

Each issue was committed separately after its relevant checks and diff review.
The final hosted aggregate checks each passed 151/151 with no skips. No additional blocking
product defect was established by these reviews. This is bounded engineering
review, not proof that all possible defects are absent.

## Checks actually performed

| Check | Environment / result |
|---|---|
| All delivery manifest checksums | Git Bash `sha256sum -c SHA256SUMS.txt`: all 16 matched |
| Exact-base patch validation | Alternate index: `git apply --cached --check` passed |
| Exact-base patch replay | Result tree exactly `4e418f...` |
| Source archive identity | All 230 files' Git blob hashes match the exact replay tree |
| Current-master reconciliation | Cached application passed; only preserved `docs/HANDOFF.md` differs from delivery |
| Supplied package/source bytes | All 187 regular tar members match source bytes |
| Candidate syntax | Passed for extracted candidate and integrated checkout |
| Local runtime | Windows / Git Bash; Node `v22.19.0` |
| Installed development versions | Pi `0.85.1`, TypeBox `1.3.27`, TypeScript `5.9.3`, Node types `22.19.19`; inspected installed manifests |
| Dependency installation | Local install exited 0 with cleanup warnings; clean hosted `npm ci --ignore-scripts` passed on all three platforms |
| Strict type checking | Passed original and corrected implementation |
| Runtime/exported schema comparison | Passed, 29 exact comparisons |
| Regression suite | Original local 147/147; local four-fix checkpoint 149/149; final hosted implementation 151/151 on each platform |
| Fresh package/import/exclusion check | Passed: original 187 files, integrated 189 (two retained handoffs) |
| Ubuntu / Windows / macOS candidate CI | All passed in run 34745144723 at the final implementation tree |
| Live-provider evaluation | Not run; no paid calls authorized or started |
| Human literary evaluation | Not run |

An initial syntax invocation used the repository's current working directory and
therefore checked the older checkout. It was not counted as candidate validation;
the candidate-root invocation above was then run explicitly.

The delivered package report says 186 files; direct archive enumeration and the
fresh original package check both found 187. The prior reported count was not
reproduced. Integrated packaging contains 189 because it also retains
`docs/HANDOFF.md` and `docs/Beyond-Fluency-Handoff.md`. Required files, relative
imports and private/development exclusions passed the actual check.

### Local verification environment and retained logs

An external, unshipped preload at
`C:/dev/pi_novel_writer/recovery-evidence/safe-cleanup.cjs` records temporary
creation/identity, verifies exact cleanup targets and protected workspace
identities, and rejects permanent removal outside the named Temp location.
It neither edits candidate tests nor disables their assertions. Native recursive
cleanup receives a verified exact directory and inspected contents; links are
not followed outside Temp. Its audit is retained as `cleanup-audit.jsonl`.

The dependency installer completed but emitted warnings because removal of
irrelevant bundled platform packages outside Temp was denied. Those files were
retained; this is not a warning-free pristine-install claim. Dependencies were
then copied on the same Windows machine into the integrated checkout. No
incompatible-platform dependency copy or unsupported runtime was used.

The first guarded test attempt failed 84 cases due to the preload's handling of
native recursive Buffer paths and already-inspected descendants, not candidate
assertions. The preload was corrected and the unchanged original suite passed
147/147. Both failed and passing logs are retained; this was not hidden as a
product fix. The actual checkout subsequently failed schema agreement due to
CRLF, producing corrective checkpoint 4 above.

Retained under `C:/dev/pi_novel_writer/recovery-evidence/`:
`windows-candidate-check.log`, `windows-candidate-check-2.log`,
`windows-package-check.log`, `order-red.log`, `order-green.log`,
`anchor-red.log`, `anchor-green.log`, `export-boundary-red.log`,
`export-boundary-green.log`, `windows-integrated-check.log`,
`windows-integrated-check-2.log`, and `windows-integrated-package.log`.
The final package command was also rerun after the line-ending fix and passed.
The commands were `npm run check` and `npm run pack:check`, with the external
preload supplied through `NODE_OPTIONS`.

A subsequent report-finalization run (`windows-final-tree-check.log`) had
148 passes and one atomic-replacement error while writing a job checkpoint.
The unchanged implementation passed all 149 on the immediate full rerun
(`windows-final-tree-recheck.log`). The failed run is retained, not discarded.
Its underlying filesystem cause was not established; no retry, assertion or
error handling was weakened. Investigate if it recurs in final-tree verification;
the passing rerun does not prove that intermittent Windows I/O failures cannot occur.

### Hosted failures, repairs and final verification

| Run | Tested head | Result |
|---|---|---|
| [34744782436](https://github.com/forsonny/PI-Novel-Writer/actions/runs/34744782436) | `53d331b7371dfa2b722d2b20b5bab4c9424d190c` | Ubuntu 149 passed; Windows 146 passed / 3 failed (Git-root aliases); macOS 143 passed / 6 failed (canonical-root mismatch and path expectations). |
| [34744962850](https://github.com/forsonny/PI-Novel-Writer/actions/runs/34744962850) | `159e883826e1a2bcb0c7c589f625d61dc50f1cfc` | Ubuntu and Windows 151 passed; macOS 150 passed / 1 failed (note-write alias handling). |
| [34745144723](https://github.com/forsonny/PI-Novel-Writer/actions/runs/34745144723) | `754c64c2e721d12ba3e8f537c09c177ee47be6e4` | All three: 151 passed, zero failed/skipped; types, schemas and package checks passed. |
| [34745228600](https://github.com/forsonny/PI-Novel-Writer/actions/runs/34745228600) | `5f80cba0eee466ef3f96bc237a505db7cfe07b27` | Post-merge: all three passed all 151 tests, types, 29 schemas and 189-file package checks. |

The passing PR jobs were Ubuntu `103691578349`, Windows `103691578441`, and
macOS `103691578459`. All checked out test-merge commit `194ef75...`; its tree
`97eb0ba...` matched both the source head and actual merge `5f80cba...`.
The merge used an expected-head guard, and repository automatic branch deletion
was confirmed disabled. Both historical development branches and both recovery
branches remained present after merge.

Hosted logs are retained locally as `hosted-first-failures.log`,
`hosted-second-failures.log`, `hosted-passing-candidate.log` and `hosted-postmerge.log` in the external
recovery-evidence directory. GitHub retained source snapshots and normal run
logs. Hosted runs do not use the workstation preload.

GitHub warned that the pinned action wrappers now run under its Node 24
compatibility handling. The actual project test runtime was explicitly logged as
Node 22.19.0 on every platform. The warning did not fail checks, and updating
unrelated action versions was not added to this merge task.

Historical GitHub results read this session:

- [34740428855](https://github.com/forsonny/PI-Novel-Writer/actions/runs/34740428855): success at starting master `157a62d...`.
- [34740186040](https://github.com/forsonny/PI-Novel-Writer/actions/runs/34740186040): success at merge `8fbc555...`.
- [34739979178](https://github.com/forsonny/PI-Novel-Writer/actions/runs/34739979178): success at completion base `cd95b6c...`.
- Historical reviewed-branch run `34733954080` was failed. It was not investigated as a candidate failure.

None of these older runs verifies the recovered or corrected candidate.

## Original plan and relationship to the dissertation

The blueprint retains Pi as host with compatibility adapters and internal,
testable controls. Its intended flow is author constraints and scene contracts,
bounded role-specific context and conditional voice, provisional prose and state,
evidence-linked diagnosis, selective revision, independent preservation checks,
atomic acceptance, and sequence-level audits. It preserves progression causality,
quiet scenes, discovery, uncertainty, and explicit author delegation.

The source's conflicting counts and scales must remain visible: 56 Chapter 5
distinctions versus 48 Appendix B families, two severity systems, different
evidence-code meanings, separate cause namespaces, and different revision-pass
enumerations. The candidate adds cards and runtime schemas; these are not
validated literary detectors merely because they exist.

The supplied dissertation DOCX SHA-256 independently matches the blueprint:
`4765b140b64ce7f9d4ae1e8e753cbf122c77d59fa8e38bd50a6487afd9916464`.
Its own text calls the integrated framework an original proposal, says the
novel-scale benchmark has not been executed, and identifies the six passages as
a worked demonstration rather than independent model runs.

## S01–S24 reconciliation at the verified engineering checkpoint

Execution Changes 01–35 are not blueprint tickets S01–S24. “Implemented and
verified” below is limited to the stated software behavior exercised by the
fresh three-platform tests and bounded source review. It is not live-provider
or literary-efficacy certification. Partial means a material part of the
original ticket extends beyond the delivered software or executed evidence.
All named test files ran in the 151-test aggregate on each platform. Paths are relative to the repository.
`extensions/llgf/` is abbreviated as `llgf/`.

| Ticket | Status | Implementation and available verification | Remaining acceptance boundary |
|---|---|---|---|
| S01 Git safety | Implemented and verified | `extensions/novel-github.ts`, `extensions/utils/git.ts`; `tests/git-safety.test.ts` | Tested previews, secret exclusions, scoped staging and no force fallback; not a live publication trial. |
| S02 path/metadata safety | Implemented and verified | `extensions/novel-core.ts`, `extensions/utils/safety.ts`; `tests/path-safety.test.ts` | Windows containment/metadata tests pass; not a hostile-process sandbox. |
| S03 verification harness | Implemented and verified | `package.json`, `.github/workflows/verify.yml`, `scripts/check.mjs`, `scripts/test.mjs`, `.gitattributes` | Syntax, types, schemas and tests pass on Ubuntu, Windows and macOS with Node 22.19.0; other host/runtime versions are not established. |
| S04 source distinctions | Implemented and verified | `research/source-crosswalk.md`, `llgf/taxonomy.ts`, `llgf/pattern-cards.ts`; taxonomy/pattern-card tests | 56-to-48 mapping, scale distinctions and critic-card dispatch pass; not empirical taxonomy validation. |
| S05 identities/versions | Partial | `llgf/version.ts`, core scene operations; `tests/version.test.ts`, extension-integration tests | Scene move/split/merge and version checks pass; full legacy entity/bible migration is not established. |
| S06 unified acceptance | Partial | `llgf/store.ts`, `llgf/pipeline.ts`; store/pipeline/integrity tests | Managed atomic acceptance is delivered; review 30 explicitly retains non-atomic legacy suggestion-log/scene writes. |
| S07 migration | Implemented and verified | `llgf/migration.ts`, `llgf/guidance.ts`, literary adapter; migration/guidance tests | Preview approval, backups, custom guidance, conflicts and interrupted recovery pass on fixtures, not a private manuscript migration. |
| S08 conditional voice | Implemented and verified | `llgf/voice.ts`, `llgf/drift.ts`, `skills/voice-match/SKILL.md`; voice/drift/evidence-review tests | Compiler/epoch and selected-anchor freshness checks pass; author calibration and literary effectiveness unassessed. |
| S09 scene/plan contracts | Partial | `llgf/narrative.ts`, `llgf/planning.ts`; narrative/registry-service tests | Managed contracts/design routes and quiet/discovery cases pass; legacy Markdown outlines remain distinct. |
| S10 scoped context | Implemented and verified | `llgf/context.ts`, pipeline; context/evidence-review tests | Temporal cutoff, required evidence, dependency closure and budget rejection pass; token counts remain approximate. |
| S11 isolated workers | Implemented and verified | `llgf/workers.ts`, `llgf/authority.ts`, literary adapter; workers/literary-adapter tests | Stateless no-tool calls are the documented adaptation; mock host only, no live-provider compliance evidence. |
| S12 epistemic state | Implemented and verified | `llgf/narrative.ts`, context/pipeline; narrative/integrity tests | Acquisition, supersession, ambiguity and validated state acceptance pass; model truthfulness is not guaranteed. |
| S13 summaries | Implemented and verified | `extensions/novel-write.ts`, `llgf/summaries.ts`; summaries tests | Source hashes and transitive freshness pass; freshness is not factual truth. |
| S14 narrative registries | Implemented and verified | `llgf/registries.ts`, `llgf/registry-service.ts`; registries/registry-service tests | Retrieval, event evidence and atomic promise-event acceptance pass; literary recurrence quality remains unassessed. |
| S15 diagnostics | Partial | `llgf/diagnostics.ts`, pattern cards, pipeline; diagnostics/pattern-cards/evidence-review tests | Evidence-card dispatch and no-action structures pass; comprehensive calibrated semantic detectors are not delivered. |
| S16 protection | Implemented and verified | `llgf/revision.ts`, narrative/pipeline; revision/evidence-review tests | Exact spans and rejection of an ambiguity-destroying assessment pass; semantic judgments remain fallible. |
| S17 revision routing | Implemented and verified | `llgf/revision.ts`, pipeline; revision/pipeline tests | Source/candidate choice, targeted routing and oscillation bounds pass; no literary improvement inferred. |
| S18 bounded generation | Implemented and verified | `llgf/generation.ts`, pipeline; generation/pipeline tests | Functional alternatives, append limits and retained rejected attempts pass; mock outputs only. |
| S19 guidance | Implemented and verified | `system/SYSTEM.md`, expansion/dialogue prompts, guidance service; guidance tests | Conditional guidance and author-preserving migration pass; live-model adherence unassessed. |
| S20 audits/drift | Partial | `llgf/audits.ts`, `llgf/drift.ts`; audits/drift tests | Reporting implementation delivered; calibration and human evidence absent; oversized scopes explicitly limited. |
| S21 recovery/autonomy | Implemented and verified | `extensions/novel-auto.ts`, `llgf/completion.ts`, jobs/execution; managed-completion/integrity/restore tests | Pause, reservations, execution leases, late-output checks, whole-state restore and export-boundary regression pass; not a live whole-book run. |
| S22 progress/gates | Implemented and verified | `extensions/novel-progress.ts`, manuscript/completion; manuscript/managed-completion tests | Four-format resolution, accepted coverage and separation from final labels pass. |
| S23 snapshot export | Implemented and verified | `extensions/novel-export.ts`, `llgf/manuscript.ts`; manuscript/release-contracts tests and package check | Immutable capture, sparse order, working divergence and private exclusions pass; Pandoc conversion itself was not executed. |
| S24 evaluation | Partial | `llgf/evaluation.ts`, `llgf/resources.ts`, `scripts/evaluate.mjs`, `protocols/evaluation.md`; evaluation tests | Offline preparation delivered, not 15 generation engines or executed benchmark/human study. Paid experiments intentionally deferred in this task. |

No ticket is labeled “implemented and verified” solely from delivered green logs.
The synthetic 100,000-word test concerns storage/export, not novel-writing quality.

## Installation, migration, rollback and operating cautions

- Do not install this release candidate over the only copy of a manuscript.
  Dependencies and mock-host tests were exercised, not a live Pi writing session.
- Candidate declares Node `>=22.19.0`. Inspect its README and help for local Pi
  installation; npm publication was neither performed nor authorized.
- Documented local installation, after selecting the intended verified checkout:
  `pi install /absolute/path/to/pi-novel-writer`. Open Pi in a separate novel
  directory, not the extension checkout, and load the existing project.
  This documented host-install route was not itself executed in this session.
- Migration is preview-first and separately approved. A package upgrade is not
  approval to replace a saved project's guidance. Preserve working manuscripts,
  `.pnw` history and exact-byte backups before any user-run migration.
- In a backed-up project, `/PNW-literary migrate collaborative` previews managed
  migration. Inspect the listed changes, then `/PNW-literary apply <digest>`
  approves that exact preview. Use delegated governance only intentionally.
  `/PNW-literary upgrade-guidance 0.2.2` separately previews the saved-guidance
  merge; inspect conflicts before applying its returned digest.
- `/PNW-literary status` is read-only. `/PNW-literary authorize <calls> <tokens>`
  is a separate permission to transmit project content to the selected provider;
  it can incur cost. Do not issue it merely to inspect migration or installation.
- Provider execution permission and author acceptance are separate. No provider
  credentials, private manuscripts or reader data were uploaded in this session.
- Working Markdown can differ from accepted prose. Export mode must be explicit;
  restoring an accepted snapshot does not automatically reconcile working files.
- Prepared jobs from before the reading-order repair lack its captured identity
  and must be prepared again. Existing candidates/history are not deleted.
- During managed unattended writing, use scoped Markdown compilation. Pause for
  author-directed DOCX conversion; it is no longer allowed through the unrestricted
  conversion tool while managed autonomy is armed.
- `/PNW-literary pause` revokes execution. For accepted-history rollback,
  `/PNW-literary restore <snapshot>` previews and `apply-restore <digest>` creates
  a new accepted snapshot rather than erasing history. Preserve working files and
  inspect an accepted export before reconciling them.
- Keep project-data rollback separate from code rollback. The implementation is
  now merged. If a code rollback is needed, use a reviewed revert of merge
  `5f80cba...` against its first parent rather than hard-resetting or force-pushing.
  Do not assume older code can safely open migrated project data. Preserve data
  backups and accepted history independently before any rollback.
- Hashes and permissions are not encryption, truth, literary merit or proof of
  originality. Unknown costs are not zero. Human review must remain “not performed”
  unless actual independent readers supplied it.

## Prioritized remaining work

The recovery, corrective review and implementation merge are complete.
The following are separately scoped follow-up work, not blockers to this merge:

1. **Live-host/provider validation before production use.** With explicit
   transmission and budget approval, exercise a disposable original project in
   the intended Pi host/provider: prepare, run, pause/resume, accept, inspect state,
   and export. Acceptance: actual schema compliance, usage/cancellation evidence,
   preserved author text, and honest limits. No paid call is authorized by this
   handoff alone.
2. **Legacy migration/mutation coverage (S05/S06/S09).** Inventory remaining legacy
   entity, outline and edit paths; decide compatibility/deprecation explicitly.
   Acceptance: migration previews preserve custom text, every claimed managed
   path uses source checks and acceptance, and legacy exceptions are visible.
   Do not turn this into an unrequested rewrite of working compatibility tools.
3. **Calibrated diagnostics and longitudinal assessment (S15/S20).** Acceptance:
   declared corpora/conditions, independent evidence, unknown values for missing
   calibration, preserved voice epochs, and report-only alarms until validated.
4. **Empirical literary evaluation (S24).** Acceptance: preregistered matched-cost
   baselines, held-out works, retained failed/rejected outputs and interventions,
   blinded actual readers, and uncertainty at the lengths/models actually tested.
   Fifteen declared ablation labels and a packet generator are not fifteen
   executed experiments. A synthetic 100k-word storage pass is not a novel result.
5. **Release decision.** Confirm actual host/provider behavior, licenses, install
   instructions and the intended distribution version. Publication needs separate
   authorization. The package remains `0.3.0-rc.1`; nothing was published to npm.

The one intermittent local atomic-write failure remains a disclosed observation,
not an identified persistent defect. Its underlying cause was not established;
it did not recur in the passing hosted final-head or post-merge matrices. Preserve
its logs if investigation becomes necessary rather than adding speculative retries.

## Self-contained next-session prompt

> Continue PI Novel Writer from current master, not an old delivery archive.
> Read docs/Beyond-Fluency-Handoff.md and inspect fresh remote state before changing
> anything. The recovery/merge task is complete: PR #2 merged at
> 5f80cba0eee466ef3f96bc237a505db7cfe07b27 from head
> 754c64c2e721d12ba3e8f537c09c177ee47be6e4. Its tree
> 97eb0ba53eb3edb380f9a5309d46ec50f7ae1727 matched the passing PR test merge.
> Run 34745144723 passed before merge and 34745228600 passed on the actual merge:
> Ubuntu, Windows and macOS, Node 22.19.0, 151 tests each, strict types, 29 schema
> comparisons and 189-file package/import/private-exclusion checks. A later
> documentation-only commit finalizes the report; inspect its current check status.
> Recovery verified 16 delivery checksums and 230 source blobs, preserved newer
> master work, and fixed seven concrete issues in separate commits. Do not reapply
> the cumulative patch or recreate those fixes. Both development and recovery
> branches were retained. No force push, npm publication, private manuscript upload,
> paid provider experiment or human literary evaluation occurred.
> Engineering results are not literary-efficacy evidence; the synthetic 100k-word
> case tested storage/export only. Read the S01–S24 map and remaining-work acceptance
> criteria before proposing the next scope. Ask for the user's next product priority
> if none is given; do not automatically start the deferred research or paid work.
> Preserve source versions, ambiguity, voice, author text and explicit transmission
> authority. Use small verified checkpoints and stop on a concrete blocker rather
> than bypassing checks or overwriting unrelated work.
