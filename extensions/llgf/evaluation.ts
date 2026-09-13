import fs from 'node:fs';
import path from 'node:path';
import { createHmac } from 'node:crypto';
import { Type, type Static } from 'typebox';
import { Strict, Hash, Nonempty, Short, checked, strings } from './schema.ts';
import { proseHash, hashText, canonicalJson } from './version.ts';
import { observeSurface, METHOD_VERSION } from './diagnostics.ts';

export const studyConditions = ['extension_022', 'B0', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'P'] as const;
export const lengthTiers = [1000, 5000, 20000, 50000, 100000] as const;
export const ablations = [
  ['A1', 'conditional_profiles'], ['A2', 'transition_rules'], ['A3', 'variation_budgets'], ['A4', 'stylistic_memory'], ['A5', 'narrative_memory'],
  ['A6', 'selected_context'], ['A7', 'scene_contracts'], ['A8', 'anti_pattern_diagnostics'], ['A9', 'drift_monitor'], ['A10', 'protected_spans'],
  ['A11', 'revision_ledger'], ['A12', 'multiple_candidates'], ['A13', 'chapter_audit'], ['A14', 'language_affordances'], ['A15', 'calibrated_thresholds'],
] as const;
const AblationIds = Type.Array(Type.Enum(ablations.map(a => a[0])), { maxItems: 15 });
const NegativeControl = Type.Enum(['none', 'sentence_length_noise', 'synonym_substitution', 'roughness_noise'] as const);
const TrialId = Type.String({ pattern: '^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$' });
export const StudySchema = Strict({ schemaVersion: Type.Literal(1), studyId: TrialId, seed: Nonempty,
  baselineCommit: Type.String({ pattern: '^(?:[0-9a-f]{40}|[0-9a-f]{64})$' }), registeredProtocol: Type.Union([Nonempty, Type.Null()]),
  primaryOutcomes: strings(), secondaryOutcomes: strings(), exclusions: strings(), stoppingRule: Nonempty,
  conditionIds: Type.Array(Type.Enum(studyConditions), { minItems: 2, maxItems: 9 }),
  lengthTiers: Type.Array(Type.Enum(lengthTiers), { minItems: 1, maxItems: 5 }),
  selectedAblations: Type.Array(Type.Enum(ablations.map(a => a[0])), { maxItems: 15 }),
  negativeControls: Type.Array(Type.Enum(['sentence_length_noise', 'synonym_substitution', 'roughness_noise'] as const), { maxItems: 3 }),
  resourcePolicy: Type.Enum(['cost_matched', 'unconstrained_reported'] as const),
  generationAuthorized: Type.Literal(false), humanEvaluationStatus: Type.Literal('not_performed'),
});
export type Study = Static<typeof StudySchema>;
const NullableCount = Type.Union([Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }), Type.Null()]);
export const TrialSchema = Strict({ schemaVersion: Type.Literal(1), id: TrialId, manuscriptId: TrialId,
  premiseId: TrialId, voiceId: TrialId, conditionId: Type.Enum(studyConditions), tier: Type.Enum(lengthTiers), seed: Short,
  provider: Type.Union([Short, Type.Null()]), model: Type.Union([Short, Type.Null()]), accessDate: Nonempty,
  appliedAblations: Type.Optional(AblationIds), negativeControl: Type.Optional(NegativeControl),
  promptHashes: Type.Optional(Type.Array(Hash, { maxItems: 10000 })), configurationHash: Type.Optional(Hash),
  phase: Type.Enum(['raw', 'accepted_scene', 'chapter', 'arc', 'final'] as const),
  status: Type.Enum(['complete', 'failed', 'truncated', 'rejected'] as const), failureReason: Type.String({ maxLength: 20000 }),
  body: Type.String({ maxLength: 1000000 }), textHash: Hash,
  rights: Type.Enum(['project_owned', 'public_domain', 'licensed', 'analysis_only', 'excluded'] as const),
  readerDistributionAllowed: Type.Boolean(), sourceNote: Nonempty, manuscriptWordOffset: Type.Integer({ minimum: 0 }),
  resources: Strict({ inputTokens: NullableCount, outputTokens: NullableCount, calls: NullableCount, rejectedCandidates: NullableCount,
    revisionCalls: NullableCount, humanEditingSeconds: NullableCount, humanSelectionSeconds: NullableCount,
    costEstimate: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]) }),
});
export type Trial = Static<typeof TrialSchema>;
export function validateStudy(value: unknown): Study {
  const s = checked(StudySchema, value, 'study preparation');
  for (const a of [s.conditionIds, s.lengthTiers, s.selectedAblations, s.negativeControls]) if (new Set<string | number>(a).size !== a.length) throw new Error('Duplicate study condition, tier or treatment');
  if (!s.primaryOutcomes.length) throw new Error('Predeclare at least one primary outcome');
  return s;
}
export function validateTrials(values: unknown[], study: Study): Trial[] {
  validateStudy(study); if (values.length > 10000) throw new Error('Split the trial inventory into documented batches');
  const rows = values.map(v => checked(TrialSchema, v, 'trial'));
  if (rows.reduce((n, r) => n + Buffer.byteLength(r.body, 'utf8'), 0) > 128 * 1024 * 1024) throw new Error('Trial text exceeds the 128 MiB batch limit');
  if (new Set(rows.map(r => r.id)).size !== rows.length) throw new Error('Duplicate trial identity');
  for (const r of rows) {
    if (proseHash(r.body) !== r.textHash) throw new Error('Trial text version changed');
    if (!study.conditionIds.includes(r.conditionId) || !study.lengthTiers.includes(r.tier)) throw new Error('Trial is outside declared study conditions');
    const applied = r.appliedAblations ?? [];
    if (new Set(applied).size !== applied.length || applied.some(a => !study.selectedAblations.includes(a))) throw new Error('Trial has duplicate or undeclared ablations');
    if (applied.length && r.conditionId !== 'P') throw new Error('Architecture ablations must be recorded under condition P');
    if (r.negativeControl && r.negativeControl !== 'none' && !study.negativeControls.includes(r.negativeControl)) throw new Error('Trial has an undeclared negative control');
    if (r.status === 'complete' && !r.body.trim()) throw new Error('Completed trial has no prose');
    if (r.status !== 'complete' && !r.failureReason.trim()) throw new Error('Failed, truncated or rejected trials need a retained reason');
    if (r.readerDistributionAllowed && !['project_owned', 'public_domain', 'licensed'].includes(r.rights)) throw new Error('This source is not cleared for reader distribution');
  }
  return rows;
}
export const ReaderResponseSchema = Strict({ schemaVersion: Type.Literal(1), packetId: Hash, pairId: TrialId,
  readerIdHash: Hash, task: Type.Enum(['literary_preference', 'voice_matching', 'continuity', 'ambiguity', 'continuous_reading'] as const),
  preference: Type.Enum(['left', 'right', 'tie', 'cannot_judge'] as const), evidence: Type.String({ maxLength: 20000 }),
  confidence: Type.Enum(['low', 'medium', 'high'] as const), completedAt: Nonempty,
  suppliedBy: Type.Literal('external_reader_record'),
});
export type ReaderResponse = Static<typeof ReaderResponseSchema>;
export function treatmentKey(r: Trial): string {
  return canonicalJson([r.conditionId, [...r.appliedAblations ?? []].sort(), r.negativeControl ?? 'none']);
}
const PairKeySchema = Strict({ pairId: TrialId, leftTrial: TrialId, rightTrial: TrialId, premiseId: TrialId, tier: Type.Enum(lengthTiers), phase: Type.Enum(['raw', 'accepted_scene', 'chapter', 'arc', 'final'] as const) });
const EvaluationKeySchema = Strict({ schemaVersion: Type.Literal(1), packetId: Hash, studyHash: Hash, textVersions: Type.Array(Strict({ id: TrialId, hash: Hash }), { maxItems: 10000 }), pairs: Type.Array(PairKeySchema, { maxItems: 5000 }) });
export type PairKey = Static<typeof PairKeySchema>;
export type EvaluationKey = Static<typeof EvaluationKeySchema>;
const rank = (seed: string, text: string) => createHmac('sha256', seed).update(text).digest('hex');

/** Prepare blinded pairs from supplied frozen outputs. No generation, implicit
 * permission, editorial normalization or fabricated human response occurs. */
export function prepareReaderPackets(value: unknown, values: unknown[], outputDirectory: string): EvaluationKey {
  const study = validateStudy(value), rows = validateTrials(values, study);
  if (fs.existsSync(outputDirectory)) throw new Error('Evaluation output directory already exists; select a new frozen version');
  const eligible = rows.filter(r => r.status === 'complete');
  if (eligible.some(r => !r.readerDistributionAllowed)) throw new Error('A completed trial lacks permission for reader distribution; do not silently drop it');
  const pairs: PairKey[] = [];
  const groups = new Map<string, Trial[]>();
  for (const r of eligible) {
    const key = canonicalJson([r.premiseId, r.voiceId, r.tier, r.phase, r.seed, r.provider, r.model, r.manuscriptWordOffset]);
    groups.set(key, [...groups.get(key) ?? [], r]);
  }
  const initial: { a: Trial; b: Trial }[] = [];
  for (const group of groups.values()) {
    const sorted = group.sort((a, b) => treatmentKey(a).localeCompare(treatmentKey(b)) || a.id.localeCompare(b.id));
    if (new Set(sorted.map(t => treatmentKey(t))).size !== sorted.length) throw new Error('Ambiguous duplicate treatment within a matched comparison block');
    for (let i = 0; i < sorted.length; i++) for (let j = i + 1; j < sorted.length; j++) initial.push({ a: sorted[i], b: sorted[j] });
  }
  if (!initial.length) throw new Error('No matched complete comparison blocks; preserve the inventory and report missing outputs');
  if (initial.length > 5000) throw new Error('Predeclare a smaller balanced reader assignment');
  initial.sort((a, b) => rank(study.seed, a.a.id + '\0' + a.b.id).localeCompare(rank(study.seed, b.a.id + '\0' + b.b.id)));
  // Counterbalance each condition pair across blocks, not just a coin flip in
  // every pair that can accidentally put the same system on the left throughout.
  const pairCounts = new Map<string, number>();
  for (const { a, b } of initial) {
    const group = canonicalJson([treatmentKey(a), treatmentKey(b)]), n = pairCounts.get(group) ?? 0; pairCounts.set(group, n + 1);
    const flip = (parseInt(rank(study.seed, group).slice(0, 2), 16) + n) % 2 === 1;
    pairs.push({ pairId: `P${String(pairs.length + 1).padStart(4, '0')}`, leftTrial: flip ? b.id : a.id, rightTrial: flip ? a.id : b.id,
      premiseId: a.premiseId, tier: a.tier, phase: a.phase });
  }
  const textVersions = rows.map(t => ({ id: t.id, hash: t.textHash }));
  const base = { schemaVersion: 1 as const, studyHash: hashText(canonicalJson(study)), textVersions, pairs };
  const key: EvaluationKey = { ...base, packetId: hashText(canonicalJson(base)) };
  fs.mkdirSync(outputDirectory, { recursive: false, mode: 0o700 });
  const readers = path.join(outputDirectory, 'readers'), privateDir = path.join(outputDirectory, 'private');
  fs.mkdirSync(readers, { mode: 0o700 }); fs.mkdirSync(privateDir, { mode: 0o700 });
  const save = (file: string, text: string) => fs.writeFileSync(file, text, { flag: 'wx', mode: 0o600 });
  save(path.join(privateDir, 'key.json'), canonicalJson(key));
  save(path.join(privateDir, 'study.json'), canonicalJson(study));
  save(path.join(privateDir, 'frozen-trials.jsonl'), rows.map(r => canonicalJson(r)).join('\n') + '\n');
  save(path.join(privateDir, 'trial-inventory.json'), canonicalJson(rows.map(({ body: _body, ...r }) => r)));
  const paired = new Set(pairs.flatMap(p => [p.leftTrial, p.rightTrial]));
  save(path.join(privateDir, 'unpaired-trials.json'), canonicalJson(rows.filter(r => !paired.has(r.id)).map(r => ({ id: r.id, status: r.status, reason: r.status === 'complete' ? 'No matched treatment in this comparison block' : r.failureReason }))));
  const index = new Map(rows.map(r => [r.id, r]));
  for (const pair of pairs) {
    const left = index.get(pair.leftTrial)!, right = index.get(pair.rightTrial)!;
    save(path.join(readers, pair.pairId + '.md'), `# ${pair.pairId}\n\nRead both texts without inferring authorship. Record the assigned dimension, a preference or tie, and evidence. Difficult or quiet prose is not automatically defective.\n\n## Left\n\n${left.body}\n\n## Right\n\n${right.body}\n`);
  }
  save(path.join(readers, 'instructions.json'), canonicalJson({ packetId: key.packetId, pairs: pairs.map(p => p.pairId),
    tasks: ['literary_preference', 'voice_matching', 'continuity', 'ambiguity', 'continuous_reading'],
    instructions: 'Keep tasks separate. Preserve ties, uncertainty and disagreement. For continuous reading, use complete sequences in their original order; a passage-pair packet alone is not a full-manuscript panel.',
    humanResponses: 'not_collected' }));
  return key;
}
/** Descriptive only: nested readers, premises and manuscripts are not treated as
 * independent observations for significance tests. All failed trials stay visible. */
export function describeTrials(value: unknown, values: unknown[]) {
  const study = validateStudy(value), rows = validateTrials(values, study);
  return { schemaVersion: 1, studyHash: hashText(canonicalJson(study)), methodVersion: METHOD_VERSION,
    trialCount: rows.length, statusCounts: Object.fromEntries(['complete', 'failed', 'truncated', 'rejected'].map(s => [s, rows.filter(t => t.status === s).length])),
    trials: rows.map(r => { const observed = observeSurface(r.body); return { id: r.id, conditionId: r.conditionId, premiseId: r.premiseId, manuscriptId: r.manuscriptId, voiceId: r.voiceId, tier: r.tier, phase: r.phase,
      status: r.status, failureReason: r.failureReason, treatment: treatmentKey(r), textHash: r.textHash,
      provenanceCompleteness: r.promptHashes?.length && r.configurationHash ? 'supplied' : 'incomplete', resources: r.resources, observed,
      lengthDifference: observed.words - r.tier }; }),
    statisticalInference: 'not_performed', comparativeLiteraryEfficacy: 'not_established',
    notes: ['Resource totals with missing fields are incomplete, never zero-filled.', 'Failures, truncations, rejected candidates and human selection/editing time must remain in the study inventory.',
      'Preregistration references and provenance are supplied metadata, not externally verified by this tool.', 'Use work/premise-held-out evaluation, continuous reader panels and the declared mixed-effects analysis; do not infer equivalence from a nonsignificant difference.'] };
}
export function describeResponses(value: unknown, values: unknown[]) {
  const key = checked(EvaluationKeySchema, value, 'evaluation decoding key');
  if (values.length > 100000) throw new Error('Split external reader records into documented batches');
  const trials = new Set(key.textVersions.map(t => t.id));
  if (trials.size !== key.textVersions.length || new Set(key.pairs.map(p => p.pairId)).size !== key.pairs.length) throw new Error('Duplicate decoding identity');
  if (key.pairs.some(p => p.leftTrial === p.rightTrial || !trials.has(p.leftTrial) || !trials.has(p.rightTrial))) throw new Error('Invalid paired trial reference');
  const { packetId, ...base } = key;
  if (hashText(canonicalJson(base)) !== packetId) throw new Error('Evaluation decoding key changed');
  const responses = values.map(v => checked(ReaderResponseSchema, v, 'external reader response'));
  const seen = new Set<string>(), pairIds = new Set(key.pairs.map(p => p.pairId));
  for (const r of responses) {
    if (r.packetId !== packetId || !pairIds.has(r.pairId)) throw new Error('Response refers to another packet or unknown pair');
    const identity = canonicalJson([r.readerIdHash, r.pairId, r.task]); if (seen.has(identity)) throw new Error('Duplicate reader-task response'); seen.add(identity);
  }
  const pairs = key.pairs.map(p => ({ ...p, responses: responses.filter(r => r.pairId === p.pairId).map(r => ({ ...r,
    preferredTrial: r.preference === 'left' ? p.leftTrial : r.preference === 'right' ? p.rightTrial : null })) }));
  return { packetId, suppliedResponses: responses.length, pairs,
    missingPairs: key.pairs.filter(p => !responses.some(r => r.pairId === p.pairId)).map(p => p.pairId),
    statisticalInference: 'not_performed', provenance: 'Externally supplied reader records; identities and actual reading are not verified by software.' };
}
