# Beyond Fluency recovery: verified identity, blocked execution

## Outcome

**NOT MERGED. The candidate is preserved remotely, not approved.**

This session independently verified the delivery checksums, reconstructed its exact
Git tree without executing the application script, preserved the newer master
handoff, and pushed an explicitly unverified recovery candidate. It did not
reproduce the regression suite, perform the complete integration review, or
establish that the candidate is ready to merge.

The blocking condition is an execution-safety constraint, **not a demonstrated
product defect and not missing GitHub permissions**. The session prohibits
permanent directory deletion, including deletion by child processes and tests.
The supplied `tests/helpers.ts` calls `fs.rmSync(root, {recursive:true, force:true})`
when disposing project fixtures. The supplied `scripts/verify-package.mjs` does
the same to its temporary package directory in `finally`. The exception for
temporary files does not include directories. Neither script was executed.
Opening a PR would automatically run these scripts in the configured matrix;
no PR was opened merely to move the prohibited execution to another machine.

**Smallest next user action:** arrange an independently operated verification run
of the candidate in an environment whose governing rules permit its cleanup, and
supply the exact tested commit and logs; alternatively revise the governing
execution environment before resuming. Ordinary merge authorization has already
been given and need not be requested again. Do not weaken assertions, silently
disable cleanup, or claim that this limitation proves a software failure.

## Actual repository and delivery identities

| Item | Independently observed value |
|---|---|
| Repository | `forsonny/PI-Novel-Writer` |
| Authenticated access | GitHub CLI authenticated; repository permission ADMIN; recovery push succeeded |
| Default branch | `master` |
| Current master | `157a62df9d35a979a949304d742fed7628cc94c7` |
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
| Candidate parent | Current master `157a62df9d35a979a949304d742fed7628cc94c7` |
| Candidate PR / merge / post-merge check | None / none / not applicable |

Branch protection lookup returned HTTP 404, “Branch not protected.” This is not
permission to bypass verification. No repository settings were changed.

The old handoff describes Changes 01–19 as merged and a 107-test checkpoint as
unmerged. The separately discovered
`PI-Novel-Writer-0.3.0-rc.1-delivery.zip` contains later Changes 20–35 and claims
147 tests. Those are different checkpoints, not interchangeable evidence.
Master differs from the delivery's base only by `docs/HANDOFF.md`.
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
and the dissertation's evidence-status passages were also inspected. The full
paper and all historical reviews were not re-audited in this blocked session.

The application guard requires a clean checkout and exact base tree, then applies
and stages the patch and checks the result tree. Current master is not that exact
base: it contains a newer handoff. The guard was not bypassed or executed.
Instead, an external alternate Git index loaded the verified completion base,
checked and applied the cumulative patch **to the index only**, and produced the
exact expected tree. A second alternate index started from current master and
repeated the check/application. This preserved the extra handoff and produced the
integrated tree above. Neither operation deleted working files.

A normal commit object with current master as its parent preserves the integrated
tree. That candidate was pushed without force to its new branch. A fresh GitHub
read returned the exact candidate commit. A fresh master read still returned
`157a62d...`. No existing branch was deleted or rewritten. The candidate branch
does not match this workflow's push triggers, so its preservation push does not
constitute a CI run. This report is maintained separately on
`recovery/beyond-fluency-verification`.

## Checks actually performed

| Check | Environment / result |
|---|---|
| All delivery manifest checksums | Git Bash `sha256sum -c SHA256SUMS.txt`: all 16 matched |
| Exact-base patch validation | Alternate index: `git apply --cached --check` passed |
| Exact-base patch replay | Result tree exactly `4e418f...` |
| Source archive identity | All 230 files' Git blob hashes match the exact replay tree |
| Current-master reconciliation | Cached application passed; only preserved `docs/HANDOFF.md` differs from delivery |
| Supplied package/source bytes | All 187 regular tar members match source bytes |
| Candidate syntax | `node scripts/check.mjs`, run from extracted candidate root: exit 0 |
| Local runtime | Windows / Git Bash; Node `v22.19.0` |
| Declared development versions | Pi `0.85.1`, TypeBox `1.3.27`, TypeScript `5.9.3`, Node types `22.19.19`; manifest inspection, not a fresh install |
| Fresh dependency installation | Not run |
| Strict type checking | Not run |
| Runtime/exported schema comparison | Not run; prior claim is 29 |
| Regression suite | Not run; prior claim is 147 passed |
| Fresh package/import/exclusion check | Not run |
| Ubuntu / Windows / macOS candidate CI | Not run |
| Live-provider evaluation | Not run; no paid calls authorized or started |
| Human literary evaluation | Not run |

An initial syntax invocation used the repository's current working directory and
therefore checked the older checkout. It was not counted as candidate validation;
the candidate-root invocation above was then run explicitly.

The delivered package report says 186 files; direct archive enumeration found 187
regular members, all matching source bytes. This count discrepancy remains to be
reconciled by the fresh package check. It is not evidence of a leaked private file
or a confirmed packaging defect. Byte agreement alone does not prove the
package's imports, exclusions, installation, or host behavior.

Historical GitHub results read this session:

- [34740428855](https://github.com/forsonny/PI-Novel-Writer/actions/runs/34740428855): success at current master `157a62d...`.
- [34740186040](https://github.com/forsonny/PI-Novel-Writer/actions/runs/34740186040): success at merge `8fbc555...`.
- [34739979178](https://github.com/forsonny/PI-Novel-Writer/actions/runs/34739979178): success at completion base `cd95b6c...`.
- Historical reviewed-branch run `34733954080` was failed. It was not investigated as a candidate failure.

None of these older runs verifies `76b9e3c...`.

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

## S01–S24 reconciliation at this blocked checkpoint

Execution Changes 01–35 are not blueprint tickets S01–S24. The following is a
traceability inventory, **not completed independent behavioral acceptance**.
“Implemented but unverified” means the delivery describes an implementation and
the listed source/test files were recovered intact; it does not mean their full
acceptance criteria were independently established. Test references below are
available fixtures, not fresh passing results. Paths are relative to the candidate.
`extensions/llgf/` is abbreviated as `llgf/`.

| Ticket | Status | Implementation and available verification | Remaining acceptance boundary |
|---|---|---|---|
| S01 Git safety | Implemented but unverified | `extensions/novel-github.ts`, `extensions/utils/git.ts`; `tests/git-safety.test.ts` | Recheck publication previews, sensitive exclusions, no force fallback and credential handling through actual dispatch. |
| S02 path/metadata safety | Implemented but unverified | `extensions/novel-core.ts`, `extensions/utils/safety.ts`; `tests/path-safety.test.ts` | Run containment and metadata tests on supported platforms; not a hostile-process sandbox. |
| S03 verification harness | Partial | `package.json`, `.github/workflows/verify.yml`, `scripts/check.mjs`, `scripts/test.mjs` | Syntax reproduced; types, tests and three-platform matrix remain unrun. |
| S04 source distinctions | Implemented but unverified | `research/source-crosswalk.md`, `llgf/taxonomy.ts`, `llgf/pattern-cards.ts`; taxonomy/pattern-card tests | Inspect complete mapping and actual critic dispatch; not an empirically validated taxonomy. |
| S05 identities/versions | Implemented but unverified | `llgf/version.ts`, core scene operations; `tests/version.test.ts`, extension-integration tests | Verify move/split/merge and all intended entity/dependency paths. |
| S06 unified acceptance | Partial | `llgf/store.ts`, `llgf/pipeline.ts`; store/pipeline/integrity tests | Managed atomic acceptance is delivered; review 30 explicitly retains non-atomic legacy suggestion-log/scene writes. |
| S07 migration | Implemented but unverified | `llgf/migration.ts`, `llgf/guidance.ts`, literary adapter; migration/guidance tests | Verify preview approval, byte backups, custom guidance, conflicts and interrupted recovery. |
| S08 conditional voice | Implemented but unverified | `llgf/voice.ts`, `llgf/drift.ts`, `skills/voice-match/SKILL.md`; voice/drift tests | Compiler/epoch behavior unrun; author calibration and literary effectiveness unassessed. |
| S09 scene/plan contracts | Implemented but unverified | `llgf/narrative.ts`, `llgf/planning.ts`; narrative/registry-service tests | Check actual setup/design routes and legacy outline boundaries; preserve quiet/discovery cases. |
| S10 scoped context | Implemented but unverified | `llgf/context.ts`, pipeline; context/evidence-review tests | Check temporal cutoff, required evidence, dependency closure and full-request budgets. |
| S11 isolated workers | Implemented but unverified | `llgf/workers.ts`, `llgf/authority.ts`, literary adapter; workers/literary-adapter tests | Stateless no-tool model calls are the documented adaptation; no live-provider compliance evidence. |
| S12 epistemic state | Implemented but unverified | `llgf/narrative.ts`, context/pipeline; narrative/integrity tests | Verify acquisition, supersession, ambiguity and provisional-to-accepted transition. |
| S13 summaries | Implemented but unverified | `extensions/novel-write.ts`, `llgf/summaries.ts`; summaries tests | Verify source hashes and transitive freshness; freshness is not factual truth. |
| S14 narrative registries | Implemented but unverified | `llgf/registries.ts`, `llgf/registry-service.ts`; registries/registry-service tests | Check retrieval and atomic event acceptance, not merely domain definitions. |
| S15 diagnostics | Implemented but unverified | `llgf/diagnostics.ts`, pattern cards, pipeline; diagnostics/pattern-cards/evidence-review tests | Actual evidence-card dispatch and no-action paths need checks; comprehensive semantic detectors not established. |
| S16 protection | Implemented but unverified | `llgf/revision.ts`, narrative/pipeline; revision/evidence-review tests | Exact spans mechanically testable; semantic preservation remains fallible assessment. |
| S17 revision routing | Implemented but unverified | `llgf/revision.ts`, pipeline; revision/pipeline tests | Revalidate source/candidate comparison, downstream freshness and oscillation bounds. |
| S18 bounded generation | Implemented but unverified | `llgf/generation.ts`, pipeline; generation/pipeline tests | Verify functional alternatives, append boundaries and accounting for rejected attempts. |
| S19 guidance | Implemented but unverified | `system/SYSTEM.md`, expansion/dialogue prompts, guidance service; guidance tests | Confirm saved-copy migration retains custom text and unknown baselines. |
| S20 audits/drift | Partial | `llgf/audits.ts`, `llgf/drift.ts`; audits/drift tests | Reporting implementation delivered; calibration and human evidence absent; oversized scopes explicitly limited. |
| S21 recovery/autonomy | Implemented but unverified | `extensions/novel-auto.ts`, `llgf/completion.ts`, jobs/execution; managed-completion/integrity/restore tests | Reproduce pause, retry, interruption, budget reservation and late-output acceptance checks. |
| S22 progress/gates | Implemented but unverified | `extensions/novel-progress.ts`, manuscript/completion; manuscript/managed-completion tests | Verify all four formats, accepted coverage and separation from status labels. |
| S23 snapshot export | Implemented but unverified | `extensions/novel-export.ts`, `llgf/manuscript.ts`; manuscript/release-contracts tests | Verify immutable snapshot capture, sparse ordering, working divergence and private exclusions. |
| S24 evaluation | Partial | `llgf/evaluation.ts`, `llgf/resources.ts`, `scripts/evaluate.mjs`, `protocols/evaluation.md`; evaluation tests | Offline preparation delivered, not 15 generation engines or executed benchmark/human study. Paid experiments intentionally deferred in this task. |

No ticket is labeled “implemented and verified” solely from delivered green logs.
The synthetic 100,000-word test concerns storage/export, not novel-writing quality.

## Installation, migration, rollback and operating cautions

- Do not install this unverified candidate over the only copy of a manuscript.
  No candidate installation was performed here.
- Candidate declares Node `>=22.19.0`. Inspect its README and help for local Pi
  installation; npm publication was neither performed nor authorized.
- Migration is preview-first and separately approved. A package upgrade is not
  approval to replace a saved project's guidance. Preserve working manuscripts,
  `.pnw` history and exact-byte backups before any user-run migration.
- Provider execution permission and author acceptance are separate. No provider
  credentials, private manuscripts or reader data were uploaded in this session.
- Working Markdown can differ from accepted prose. Export mode must be explicit;
  restoring an accepted snapshot does not automatically reconcile working files.
- Keep project-data rollback separate from code rollback. The candidate remains
  isolated on a new branch, so master requires no rollback. Never hard-reset or
  force-push to erase this checkpoint. A future merged code rollback should use a
  reviewed revert and must not assume older code can safely open migrated data.
- Hashes and permissions are not encryption, truth, literary merit or proof of
  originality. Unknown costs are not zero. Human review must remain “not performed”
  unless actual independent readers supplied it.

## Prioritized remaining work

1. **Resolve execution constraint.** Acceptance: the governing environment permits
   the real cleanup behavior, or an independently operated run supplies complete
   logs tied to the exact candidate. No silently modified tests.
2. **Run declared verification.** Inspect scripts first, then supported-runtime
   clean installation, `npm run check`, and `npm run pack:check`; all regressions,
   strict types, 29 schema comparisons and package/import/private exclusions must
   pass. Reconcile the 186/187 package count without treating count alone as failure.
3. **Complete integration review.** Trace adapter-to-worker-to-acceptance paths for
   all user-listed concerns. Each concrete blocking defect needs one logical fix,
   a failing-then-passing regression, reviewed diff and separate commit. Do not
   expand partial research features merely to make the traceability table greener.
4. **PR and final-tree CI.** Preserve current master, open a scoped PR, run Ubuntu,
   Windows and macOS on Node 22.19.0, inspect exact head/merge-test identities,
   resolve blocking failures, then merge with the expected-head guard. Freshly read
   PR, merge commit and resulting master; record post-merge verification. A push is
   not a merge, and an older successful run is insufficient.
5. **Finish final handoff.** Replace provisional traceability statuses with actual
   source-review and test evidence. Incorporate this report into the candidate,
   rerun relevant checks for the final tree, and deliver a downloadable copy.
6. **Separate later release/research gates.** With separate authorization, exercise
   an intended provider on a disposable project; conduct preregistered blinded
   human literary evaluation independently. Neither is to be fabricated or silently
   started during this recovery task. Do not publish to npm.

## Self-contained next-session prompt

> Resume recovery/verification of forsonny/PI-Novel-Writer, not implementation from
> scratch. Read docs/Beyond-Fluency-Handoff.md on
> recovery/beyond-fluency-verification and the original delivery/blueprint.
> Current master was 157a62df9d35a979a949304d742fed7628cc94c7. The preserved,
> UNVERIFIED candidate is recovery/beyond-fluency-candidate at
> 76b9e3c5523466ee1be0c3489cf50aa31cc21191, parented on that master.
> Its tree 891805287476f57530234eaae7ab46846323ca3b equals delivery tree
> 4e418f00c8126cabe4166f8bfd1ed980251b1ad2 plus the newer docs/HANDOFF.md.
> All 16 delivery checksums, 230 source blob identities, 187 supplied package
> member byte comparisons, and candidate syntax checks were independently
> reproduced on Windows Node 22.19.0. Types, schema agreement, 147 regressions,
> fresh package checks and cross-platform CI were NOT reproduced. The session
> stopped because test and package cleanup permanently deletes directories,
> forbidden by its governing file-safety rules. Resolve that constraint without
> bypassing it; inspect any independently supplied logs and exact commit identity.
> No candidate PR or merge exists from this checkpoint. GitHub ADMIN access and
> push worked. Verify fresh remote state, finish integration-path review and the
> 24-ticket reconciliation, fix only concrete blockers with regression tests, run
> all declared checks and three-platform CI, and merge only the verified final
> tree. Existing authorization covers branches, fixes, commits, pushes, PR and
> merge; do not ask for that again. No force push, unrelated overwrite, branch
> deletion, npm publication, private manuscript upload or paid experiment.
> Preserve uncertainty and separate engineering results, provider validation and
> human literary evaluation. Confirm the merge remotely and update/download the
> handoff; otherwise report the precise blocker and smallest user action.
