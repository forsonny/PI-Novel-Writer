# Beyond Fluency implementation handoff

Prepared 13 September 2026. This is a partial implementation checkpoint, not a completed release or evidence of improved literary output.

## Start here

Completed development-branch work through **Change 19** was merged into `master` in **PR #1**.

- Original baseline: `1ce34a1593595d30cfa1889cfef8dbb7dbc42e84`, package version 0.2.2.
- Merged branch: `feat/beyond-fluency-completion`.
- Implementation head: `cd95b6c5003dc277e3573370cdb8ae30871e65fb`.
- Exact verified source tree: `926d6aab59b21bb0e9c79b334e0a982390b92dc9`.
- Merge commit: `8fbc55538c7c22462952a457355218d4764ecbc3`.
- Merge time: 2026-09-13 05:23:34 UTC.
- Scope: 43 commits, 77 changed files, 7,740 additions and 889 deletions.
- Fresh local verification: syntax, strict TypeScript, and **90 passing tests**, none failed or skipped.
- Supported-runtime PR verification: successful Actions run `34739979178`, job `103677929487`, using Node 22.19.0.

The package manifest is still **0.2.2**. No package release was published. Both development branches were preserved; no force push or history rewrite was used. The older `feat/beyond-fluency-reviewed` branch ends with an obsolete queued patch. Do not merge or reapply it blindly.

A separate attached archive, **`PI-Novel-Writer-checkpoint-107.zip`**, contains later local Changes **20-23**. It is **not merged**. Fresh local verification of the archive and its source-only differences on the verified branch passed **107 tests**. That is not a supported-runtime remote CI result. Reconcile it explicitly in the next session.

The handoff bundle supplied with the conversation contains the full 4,697-word report, original blueprint/crosswalk, source snapshot, later archive, a checked recovery patch, test logs, and a new-session starter. The repository does not contain the full later archive. Attach the bundle to the next session; do not assume a new chat can access the previous chat's files.

## Goal and evidence boundary

Upgrade PI Novel Writer using the supplied *Beyond Fluency* dissertation: conditional authorial voice; separate narrative/stylistic memory; epistemic state and information permissions; scene-specific context; bounded provisional drafting; evidence-linked diagnosis; protected, selective revision; atomic prose/state acceptance; longitudinal audits and honest evaluation.

The dissertation is a theory, architecture, and experimental-design proposal. Its novel-scale benchmark was not executed. The six sample passages are a worked demonstration, not independent efficacy results. Preserve the 56 Chapter 5 distinctions mapped to 48 Appendix B families, the original severity scales, evidence-method differences, and revision-pass mapping. Do not impose the paper's illustrative aesthetic or heuristic thresholds as universal requirements.

Preserve existing strengths: discovery writing, quiet scenes, author delegation, progression causality, distinction between planned and established state, earlier prose, and the refusal to invent human feedback.

## What is merged

Historical cumulative counts below come from the committed review records. The final 90-test source was freshly rerun during handoff; every earlier historical commit was not separately rerun.

| Change | Delivered scope | Recorded tests |
|---|---|---|
| 01 | Baseline syntax checks, fixtures and CI. | Initial fixtures |
| 02 | Trusted scene paths, metadata allowlisting, containment, duplicate detection and portable writes. | 9 |
| 03 | Credential-free Git remotes, argument execution, preview-bound scoped publication and no automatic force push. | 14 |
| 04 | Strict TypeScript and actual extension-dispatch fixtures for all four manuscript formats; pinned development host. | 18 |
| 05 | Versioned 56-to-48 taxonomy, separate rubric/cause namespaces and named revision passes. | 21 |
| 06 | Stable scene IDs, move/split/merge lineage, hashes and optional source checks on legacy writes. | 24 |
| 07 | Immutable, project-bound object store and atomic accepted snapshots with recovery/idempotency. | 30 |
| 08 | Epistemic propositions, Scene Intent Contracts, information permissions and protections. | 36 |
| 09 | Conditional AVS, anchors/epochs, Voice Compiler, budgets and omission receipts. | 42 |
| 10 | Scene/role-specific dual-memory context selection and evidence receipts. | 50 |
| 11 | Previewed, recoverable migration, exact-byte backups and three-way guidance merge service. | 55 |
| 12 | Stateless no-tool Pi model-runtime workers, bounded inputs, cancellation, timeout and provenance. | 60 |
| 13 | `summary_source`, required source hash on summary writes, ordered chapter fingerprints and dependency freshness. | 64 |
| 14 | Promise/motif/affordance domain services with evidence, eligibility, transformation and dormancy. | 68 |
| 15 | Evidence-linked diagnostics, separated evaluator/severity/uncertainty, descriptive metrics and limited overlap screening. | 72 |
| 16 | Scoped source-bound patches, selective revision routing, exact/semantic protection and comparison/recovery. | 76 |
| 17 | Multidimensional scene gates and durable call/token reservations. | 80 |
| 18 | Executable managed scene pipeline and atomic prose/state/evidence acceptance. | 85 |
| 19 | Pi adapter, migration commands, session-local authority, prepare/run/status/accept and pause. | 90 |

Read `docs/implementation-review.md`, then `docs/reviews/08-narrative.md` through `19-pi-adapter.md` for scope, repairs discovered during review, tests and limitations.

The worker implementation deliberately uses `ModelRegistry.complete` with explicitly supplied messages and no tools instead of general sub-agent sessions. It does not inherit parent conversation or discover project resources. This is the documented implementation adaptation of the blueprint's role-isolation requirement, not a claim that a separate human evaluator exists.

The new managed path is opt-in. Legacy drafting/editing/progress/export and `/PNW-auto` have not all been routed through it. Good domain modules do not mean every public workflow has been upgraded.

## Later local work, not in master

| Local change | Scope | Priority |
|---|---|---|
| 20 | Transitive freshness; scoped state supersession; cutoff before supersession; cross-instance execution lease and explicit dead-owner recovery; preserve existing whitespace. | First recovery priority: correctness and concurrency. |
| 21 | Novel/arc/chapter plans; versioned design tools; protected ending/voice controls; registry retrieval and validated events committed with prose. | Connect previously domain-only services. |
| 22 | Small risk watch; optional two-to-four functional strategies for an elevated-risk first move; isolated selection and retained alternatives. | Candidate-aware generation with measured extra cost. |
| 23 | Prose-only reconstruction before contextual review; binding to consumed evidence and accepted voice; exact-span append hash repair. | Evidence integrity and avoiding outline-supplied meaning. |

Intermediate counts recorded in that archive are 95, 101, 104 and 107. Only its final 107-test state was freshly checked here.

Recovery artifacts supplied with the conversation:

| File | SHA-256 |
|---|---|
| `PI-Novel-Writer-checkpoint-107.zip` | `8f3d587870054f8a715d04e020a9776a88b380a43504a5e616b8251365b309f6` |
| `pnw-recover-completed.patch` | `2b66e2bf7131b6f00f22b8e3a33ed963d481eff4801ed7dc3ae23f16fe69ee31` |
| `PI_Novel_Writer_Beyond_Fluency_Blueprint.md` | `6172f5e55cfb42725e0453ec20d17e4c13a13b114e9bc75784084a440d37d66a` |
| `PI_Novel_Writer_AAPF_Crosswalk.json` | `ce97e3010f9b5ecf28ed36fbd68a22af2d80136abd72683bf5a1e5f09c209ffa` |

The recovery patch changes 24 source/test/review files, with 690 additions and 44 deletions. It was checked against the exact merged implementation tree. It **excludes** the archive's `.github/workflows/verify.yml` and `scripts/apply-reviewed-change.mjs`; those copies are not to replace current infrastructure. Check applicability against the actual new checkout before applying.

## Remaining plan, in order

**1. Reconcile the archive.** Start from current master, confirm it descends from the merge above, create a new branch, inspect the recovery patch and Changes 20-23, then run supported-runtime checks and inspect exact-head CI. Do not call a locally passing archive merged or independently validated. Until these correctness changes are reconciled, use a disposable manuscript copy and avoid concurrent managed writers.

**2. Finish guidance and onboarding.** Update `system/SYSTEM.md`, expansion/dialogue prompts, drafting/editing/outline/voice skills, help and README. Replace unconditional sensory/intensity/polish instructions with function-specific controls, protections and keep-source behavior. Actually deliver baseline-aware migration for saved `.pi/APPEND_SYSTEM.md` without overwriting author additions. The migration service exists; the complete new guidance distribution does not.

**3. Integrate whole-book scheduling.** Connect managed scene jobs to `novel-auto.ts`; preserve brief, scene plan, length, discovery and delegation. Add real chapter/arc jobs, stale dependency repair, bounded recovery and pause/resume behavior. Saved jobs must never grant paid execution permission. Test interruption, duplicate prevention, late responses and missing scene/review coverage.

**4. Implement longitudinal audits and reporting-only drift.** Add chapter/arc/manuscript coverage, distal comparisons, recurrence, contrast, promise/motif development and active-epoch voice observations. An `audit` worker prompt is not a chapter controller or drift monitor. Keep weak measurements unknown and do not treat overlapping windows as independent evidence. Calibrate before enabling automatic stylistic intervention.

**5. Fix progress and export.** `novel-progress.ts` still reconstructs novel-only paths in one estimator, estimates words from characters, and can derive readiness from status labels. `novel-export.ts` reads working Markdown and uses `scene.scene > 1` for separators. Provide explicit working-draft versus accepted-snapshot exports, one snapshot per export, canonical position-based separators, and evidence-backed progress for all formats. Preserve private logs and reader data. Test sparse/split IDs and accepted snapshots whose Markdown projection failed.

**6. Build evaluation and release infrastructure.** Provide cost-matched baseline/ablation tooling, full failure/candidate retention, model/prompt manifests and blinded packet preparation. Preserve the original five length tiers and 15 ablations. Do not fabricate reader ratings, calibration, long-form efficacy or legal clearance. Remove temporary patch-transport code, narrow CI permissions, update version/changelog/docs, check package contents, verify supported platforms and run authorized live-model smoke tests before release.

Blueprint IDs S01-S24 and implementation Change numbers are different. The full downloadable report maps every S-ticket. Main foundations S01-S04 and S11/S13 are delivered at their stated scope; S05-S10/S12/S14-S18/S21 are partial or need integration; S19/S20/S22-S24 remain substantial work. This is not a percentage-complete estimate.

## Current interface and data locations

Entry adapter: `extensions/novel-literary.ts`. Scene loop: `extensions/llgf/pipeline.ts`. State/transactions: `store.ts`, `migration.ts`, `io.ts`, `version.ts`. Narrative/voice/context: `narrative.ts`, `voice.ts`, `context.ts`. Worker/review: `workers.ts`, `diagnostics.ts`, `revision.ts`, `gates.ts`. Authority/budgets: `authority.ts`, `jobs.ts`. Supporting domain modules: `registries.ts`, `summaries.ts`, `taxonomy.ts`.

Managed settings: `.pnw/project.json`. Saved jobs: `.pnw/jobs/`. Accepted objects/snapshots and editable manuscript files are distinct. A failed Markdown projection must not cause the accepted snapshot to be forgotten or a later author edit to be overwritten. Public accepted-snapshot export still needs implementation.

Merged `/PNW-literary` subcommands: `status [job]`, `migrate [collaborative|delegated|research]`, `apply <digest>`, `authorize <calls> <tokens>`, `run <job>`, `accept <job>`, `inspect <job> <reason>`, `recover-migration <id>`, `pause`.

Merged tools: `novel_literary_schema`, `novel_literary_prepare`, `novel_literary_status`, `novel_literary_run`, `novel_literary_accept`. Prepare accepts `chapter`, `scene`, `setupPath`, `expectedSourceHash`. Read the schema instead of guessing JSON fields. The `design`/`memory` tools and `recover-job` are local-checkpoint additions, not merged features.

## Verification boundaries

Pinned development versions: Pi coding-agent/AI/TUI 0.85.1, TypeBox 1.3.27, TypeScript 5.9.3, Node types 22.19.19. CI uses Node 22.19.0. Local handoff checks used 22.16.0 and mounted dependencies; direct Git clone failed due DNS. Run `npm ci --ignore-scripts` followed by `npm run check` on the supported runtime.

All provider tests are mocks. No new human review, live provider run, 100,000-word benchmark, cross-platform matrix or package release is claimed. Token/segmentation metrics are approximations; overlap checks are limited screens; evidence-linked model assessments are not semantic proofs. Filesystem containment is not an OS sandbox, and permission modes are not encryption.

## Next-session instruction

Read this file and the attached full report/blueprint. Verify current master before changing anything. First reconcile the local Changes 20-23 using the supplied source-only patch and supported-runtime CI. Then finish the remaining S01-S24 acceptance criteria in small sequential reviewed changes. Preserve all prose and source distinctions. Do not force-push, replay the obsolete queued patch, invent validation, or reimplement completed modules. Record exact commits, tests, limitations and the next action after each accepted change.
