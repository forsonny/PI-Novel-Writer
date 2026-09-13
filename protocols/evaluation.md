# Beyond Fluency evaluation protocol

Source: the supplied *Beyond Fluency* dissertation, dated 11 September 2026,
Chapters 7-9 and 12-14; Appendices E-F. This implementation prepares studies and
reports observed descriptive data. It does not reproduce an unexecuted experiment.

## Freeze a design before collecting outcomes

Copy `configs/benchmark.json` to a new study file and record the seed, protocol
reference, outcomes, exclusion/stopping rules, actual model and prompt versions,
resources and length tolerances. The bundled baseline is the original extension
commit `1ce34a1593595d30cfa1889cfef8dbb7dbc42e84`, not a deliberately weak prompt.
The five tiers are 1k, 5k, 20k, 50k and 100k words. Small-tier results cannot establish
novel-scale endurance. The template is not preregistration and authorizes no calls.

Every trial is one JSON object per line, validated against `TrialSchema` in
`extensions/llgf/evaluation.ts`. Preserve exact `body` text and its SHA-256
`textHash`, project/voice/premise/manuscript identity, model/access date, condition,
phase, location within the manuscript, source rights and every resource field.
Use null for unavailable resources. Supply `promptHashes` and `configurationHash`;
missing provenance remains visibly incomplete. Failed, truncated and rejected
trials remain records with reasons. Do not quietly correct or replace their prose.

Use `appliedAblations` on P trials to record declared A1-A15 treatments and
`negativeControl` to record a declared control. These fields label supplied
outputs; the CLI does not disable production protection, alter code or generate
experimental outputs. Run ablations in separate, explicitly authorized experimental
copies. Never disable filesystem, credential, rights or spending safeguards.

## Offline commands

From the source checkout, with the documented Node runtime and installed peers:

```sh
npm run evaluate -- describe study.json trials.jsonl descriptive.json
npm run evaluate -- prepare study.json trials.jsonl new-reader-packets
npm run evaluate -- responses new-reader-packets/private/key.json responses.jsonl responses-report.json
```

All output paths must be new. `prepare` pairs complete trials matched by premise,
voice, tier, phase, generation seed, provider/model, and manuscript offset, while
counterbalancing each treatment pair across blocks. This is within-model pairing,
not an automatic cross-family or human-reference design. Singleton blocks and
failed trials remain in `private/unpaired-trials.json`; they are not paired by
inventing comparison outputs. Restrict workload through a predeclared assignment,
not outcome-dependent selection. Oversized inventories fail explicitly.

Distribute **only `readers/`**, and only to authorized participants. Keep `private/`,
full source inputs and pseudonymous decoding keys restricted. Word choice,
spelling, syntax and meaningful whitespace are not silently normalized. Reject
uncleared sources instead of silently excluding them. Mark potential blinding cues
already present in prose as design limitations rather than editing them away.

## Readers and interpretation

Use independent expert and general-reader panels, reporting their results
separately. Calibrate annotators on held-out passages. Preserve disagreements,
ties, uncertainty and missing responses. Voice comparisons must control proper
names and premise leakage using work/premise-held-out protocols, not random nearby
passages from one manuscript. Annotate pattern evidence, displaced function,
licensing and overcorrection; never produce an authorship detector score.

The supplied response schema supports task-tagged paired records. Separate scalar
rubrics, voice-clustering tasks and open continuous-reading notes need their own
study instruments. Packet preparation is not evidence that a reader participated.
Complete chapters/arcs/manuscripts must be read continuously in order for claims
about long-range effects; convenient excerpts alone are insufficient.

Plan sample size using pilot variance and power simulation. Analyze actual data
with the preregistered mixed-effects design, taking repeated readers, premises,
manuscripts and overlapping windows into account. Report effect sizes, uncertainty,
multiplicity decisions, exclusions, negative results and sensitivity analyses.
A nonsignificant comparison is not equivalence. No inferential test, confidence
interval, Krippendorff alpha or power calculation is fabricated by this CLI.

## Resource equality and release

`novel_literary_resources` reports isolated worker call records and reservations,
not a complete invoice. Add coordinator/compaction use and measured human editing
and selection time separately. Compare cost-matched and unconstrained runs as
different analyses. Counts include rejected candidates, failed calls and retries.
An interrupted call with missing usage is not free.

Only release texts, prompts, feature records and evaluation data for which release
is authorized. Remove identifiers, credentials and confidential project material.
Record model/provider snapshots, access dates, prompt/configuration hashes, all
candidate selection and human intervention. Do not describe this implementation
or its test fixtures as evidence that the full literary framework is superior.
