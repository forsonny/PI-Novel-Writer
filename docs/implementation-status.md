# Implementation scope and verification

## Snapshot basis

Original audited release: 0.2.2 at
`1ce34a1593595d30cfa1889cfef8dbb7dbc42e84`.
The inspected remote completion branch was
`cd95b6c5003dc277e3573370cdb8ae30871e65fb`, including reviewed scene pipeline and
Pi adapter work. Conversation checkpoint changes 20-23 were recovered and checked
before changes 24 onward. The final local release candidate is `0.3.0-rc.1`.

Changes in this delivery are local Git commits. The connected GitHub actions
available during completion supplied reads and artifact downloads, not repository
writes. This document is not a claim of a push, pull request, merge or npm release.
The delivery patch is against the inspected remote completion snapshot, not master.

## Blueprint traceability

| Ticket | Implemented software path | Review/tests |
|---|---|---|
| S01 | Credential-free Git with explicit bounded publication preview | Changes 03-04; Git safety fixtures |
| S02 | Trusted metadata, project containment, portable writes | Changes 02, 06; safety fixtures |
| S03 | Pinned dependencies, strict typing, actual tool dispatch fixtures, read-only CI matrix | Changes 01, 04, 33, 35 |
| S04 | Versioned 56-to-48 concepts, source scale distinctions, evidence/status vocabulary | Change 05; taxonomy fixtures |
| S05 | Stable scene IDs, source hashes, split/merge lineage | Change 06; extension/integration fixtures |
| S06 | Atomic accepted store and scene gateway; working Markdown projection | Changes 07, 18, 20, 30 |
| S07 | Preview-first migration and three-way saved guidance upgrade | Changes 11, 29 |
| S08 | Conditional AVS, epochs, compiler, anchors, uncertainty | Changes 09, 18, 26 |
| S09 | Scene and hierarchical plan contracts, permissible exits and unknowns | Changes 08, 21 |
| S10 | Selected role/task context with required coverage and receipts | Changes 10, 18, 23 |
| S11 | Stateless Pi-runtime workers: no tools, resource discovery or parent conversation | Changes 12, 18-19 |
| S12 | Epistemic status, acquisition/time, evidence, supersession and provisional extraction | Changes 08, 18, 20 |
| S13 | Source-bound summaries and accepted evidence-derived views | Changes 13, 18 |
| S14 | Promise, motif and optional language-affordance designs and events | Changes 14, 21 |
| S15 | Direct/proxy observations and evidence-linked model interpretation, with no-action outcomes | Changes 15, 18, 23, 34 |
| S16 | Exact-text and interpretation protection; regression checking | Changes 08, 16, 20, 23 |
| S17 | Named dependency-aware passes, bounded attempts and keep-source comparison | Changes 16-18 |
| S18 | Bounded append-only units and risk-selective functional candidates | Changes 18, 22 |
| S19 | Conditional writing/expansion/dialogue guidance and author-preserving migration | Change 29 |
| S20 | Source-bound chapter/arc/manuscript review and report-only conditional drift | Changes 26-27 |
| S21 | Durable jobs, reservation accounting, pause/cancellation, recovery, managed completion | Changes 17-19, 28, 31 |
| S22 | Format-correct progress and evidence coverage distinct from status labels | Changes 25, 28 |
| S23 | Working/accepted snapshot exports with private provenance | Changes 03, 25, 31 |
| S24 | Offline frozen trials, five tiers, fifteen ablation labels, negative controls, blinded paired packets, resource reports | Changes 32-33; evaluation protocol |

This matrix records the implemented initial software scope. It does not convert
proposed effects, mathematical models or research protocols into observed results.

## Observed checks

The local environment uses Node 22.16.0 on Linux with the supplied pinned Pi 0.85.1
development dependency artifact. Syntax checks, strict TypeScript, runtime/schema
agreement, 147 regression tests and package-content checks are run for this
candidate. Individual review files record each checkpoint and repaired issues.
No tests are skipped in the local final regression run. Confirm exact commands and
results in the delivered test logs.

The 100,000-word case uses synthetic prose in 50 scenes. It validates immutable
storage, word counts, order, separators, later-version isolation and rejection of
unreviewed completeness. It does not test whether a model writes a good novel.

The preceding remote snapshot had successful CI, but that result does not cover
later local changes. Obtaining the supported 22.19.0 runtime locally failed because
nodejs.org could not be resolved. The shipped Ubuntu/Windows/macOS 22.19.0 matrix
must still run on the final changes. Do not call configuration an executed result.

## Deliberate limits and release gates

- This is a release candidate. No live paid model calls, blind human readings,
  provider-specific behavior experiment or full novel benchmark was conducted.
- UTF-8-size token estimates and reserved allowances are approximate, not invoices.
  Hard monetary limits are refused without reliable provider pricing. Coordinator
  and compaction usage are separate from worker resource summaries.
- Semantic judgments are model-assisted assessments. Exact spans and hashes are
  mechanically checked, but evidence relevance, ambiguity preservation and
  originality judgments are not formally guaranteed. Similarity screens cover only
  supplied permitted comparison sources, not all training data or published work.
- The monitor computes transparent conditional surface proxies with frozen supplied
  reference bands. Semantic voice, reliable speaker classifiers, image semantics,
  learned change points, calibrated uncertainty, corpus reliability and reader
  preference are not asserted. Missing calibration is uncalibrated, not a score.
- The evaluation CLI consumes already generated frozen outputs. It labels actual
  ablation treatments but does not implement fifteen independent experimental
  generation engines or run mixed-effects/power analyses without data. Scalar,
  clustering and continuous-reading study instruments remain protocol work.
- Whole-sequence model audits require the complete declared scope to fit. Oversized
  scopes fail explicitly, not through hidden sampling. A larger explicitly selected
  model or external review may be needed for a long manuscript.
- Filesystem locks protect cooperating local writers, not a hostile process racing
  symlinks. Unsupported fsync behavior is reported. Generic/manual editing remains
  possible outside managed unattended runs and creates divergence requiring review.
- Imported old state remains unverified; author approval and paid execution are
  separate. Human checkpoints, publication and protected ending changes cannot be
  manufactured by saved model-produced JSON.
- Backup, encryption at rest, provider retention and external reader governance
  require an appropriate local environment. Private directories and scoped output
  are not a claim that this package encrypts a disk or controls provider retention.

Before merging/releasing: apply the exact patch to the inspected development base,
review the diff, run the supported-runtime CI matrix, exercise a small authorized
project with the intended provider, and inspect prose/state/voice results. Literary
efficacy requires the separate protocol in `protocols/evaluation.md`.
