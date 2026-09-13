import fs from 'node:fs';
import { Type, type Static } from 'typebox';
import { orderedScenes, parseFrontmatter, readProjectSnapshot, type NovelProject } from '../novel-core.ts';
import { Strict, Id, Hash, Short, Nonempty, Span, strings, checked, type SourceRef } from './schema.ts';
import { acceptedScenes, type AcceptedScene } from './manuscript.ts';
import { PlanSchema, type NarrativePlan } from './planning.ts';
import { LiteraryStore, type SnapshotRef } from './store.ts';
import { conditionKey, monitorDrift, validateBaseline, type DriftBaseline } from './drift.ts';
import { PromiseSchema, MotifSchema, promiseStatus } from './registries.ts';
import { checkEvidence } from './narrative.ts';
import { newId, objectHash, proseHash } from './version.ts';
import { estimateTokens } from './voice.ts';
import { evidencePacket } from './context.ts';
import { workerPrompt, runWorker, WorkerFailure, type WorkerHost, type WorkerPermit } from './workers.ts';
import { JobStore } from './jobs.ts';
import { withExecution } from './execution.ts';

export const AuditScopeSchema = Strict({ level: Type.Enum(['chapter', 'arc', 'manuscript'] as const),
  chapter: Type.Optional(Type.Integer({ minimum: 1 })), planId: Type.Optional(Id) });
export type AuditScope = Static<typeof AuditScopeSchema>;
export const auditDimensions = ['continuity', 'causality', 'character_history', 'perspective', 'promises', 'motifs',
  'pacing_contrast', 'scene_and_paragraph_shapes', 'voice_evolution', 'revision_regression', 'originality_scope'] as const;
export const AuditReviewSchema = Strict({ schemaVersion: Type.Literal(1), inputHash: Hash,
  reconstruction: Nonempty,
  checks: Type.Array(Strict({ dimension: Type.Enum(auditDimensions), outcome: Type.Enum(['supported', 'concern', 'uncertain', 'licensed', 'not_assessed'] as const),
    evidence: Type.Array(Span, { maxItems: 30 }), rationale: Nonempty, blocking: Type.Boolean(),
    causeLevel: Type.Enum(['state', 'plan', 'context', 'generation', 'revision', 'long_range', 'unknown'] as const),
    smallestRepair: Type.String({ maxLength: 20000 }), pairedRisk: Type.String({ maxLength: 20000 }) }), { minItems: auditDimensions.length, maxItems: auditDimensions.length }),
  futureControlRecommendations: strings(), proposedPlanChanges: strings(), limitations: strings(),
  humanLiteraryEvaluation: Type.Literal('not_performed'),
});
export type AuditReview = Static<typeof AuditReviewSchema>;
export interface AuditInput {
  id: string; projectId: string; head: string; scope: AuditScope; sourceFingerprint: string;
  sources: SourceRef[]; selected: AcceptedScene[]; context: AcceptedScene[];
  missing: string[]; stale: string[]; workingDifferences: string[];
  plans: NarrativePlan[]; registries: { key: string; payload: unknown; stale: boolean }[];
  drift: ReturnType<typeof monitorDrift>; limitations: string[];
}
function scopeSelection(scope: AuditScope, scenes: AcceptedScene[], plans: NarrativePlan[], project: NovelProject) {
  checked(AuditScopeSchema, scope);
  if (scope.level === 'chapter' ? !scope.chapter || scope.planId : scope.level === 'arc' ? !scope.planId || scope.chapter : scope.chapter || scope.planId) throw new Error('Audit scope parameters do not match its level');
  let expected: string[];
  if (scope.level === 'arc') {
    const plan = plans.find(p => p.id === scope.planId && p.level === 'arc');
    if (!plan) throw new Error('Arc audit needs an accepted arc plan');
    expected = [...new Set([plan, ...plans.filter(p => p.parentId === plan.id)].flatMap(p => p.sceneIds))];
  } else expected = orderedScenes(project).filter(s => scope.level !== 'chapter' || s.chapter === scope.chapter).map(s => s.id ?? `unmigrated:${s.chapter}.${s.scene}`);
  const selected = scenes.filter(s => scope.level === 'arc' ? expected.includes(s.prose.address.id) : scope.level !== 'chapter' || s.prose.address.chapter === scope.chapter);
  return { selected, expected };
}

/** Deterministic preparation performs no provider calls and does not invent
 * semantic judgments. Neighboring/distal sources are explicit in the receipt. */
export function buildAudit(project: NovelProject, scope: AuditScope, atArg?: SnapshotRef): AuditInput {
  project = readProjectSnapshot(project.rootPath);
  const store = LiteraryStore.open(project.rootPath), at = atArg ?? store.head(), all = acceptedScenes(store, at);
  const plans = Object.entries(at.snapshot.versions).filter(([k]) => k.startsWith('plan:')).map(([, h]) => checked(PlanSchema, store.artifact(h).payload));
  const { selected, expected } = scopeSelection(scope, all, plans, project);
  if (!selected.length) throw new Error('No accepted scenes in this audit scope');
  const chosen = new Set(selected.map(s => s.prose.address.id));
  const first = selected[0].prose.address.narrativeIndex, last = selected.at(-1)!.prose.address.narrativeIndex;
  const before = all.filter(s => s.prose.address.narrativeIndex < first).at(-1), after = all.find(s => s.prose.address.narrativeIndex > last);
  const conditions = new Set(selected.map(s => conditionKey(s.prose.condition)));
  const distal = all.filter(s => !chosen.has(s.prose.address.id) && s !== before && s !== after && conditions.has(conditionKey(s.prose.condition)));
  const context = [...new Map([before, after, distal[0], distal.at(-1)].filter((s): s is AcceptedScene => !!s).map(s => [s.prose.address.id, s])).values()];
  const sources: SourceRef[] = [...selected, ...context].flatMap(s => s.acceptance ? [s.source, s.acceptance] : [s.source]);
  const baselineRecords: DriftBaseline[] = [], registries: AuditInput['registries'] = [];
  for (const [key, hash] of Object.entries(at.snapshot.versions)) {
    if (!/^(plan|drift_baseline|promise|motif):/.test(key)) continue;
    const ref = { key, hash }, payload = store.artifact(hash).payload, stale = store.stale([ref], at).length > 0;
    sources.push(ref);
    if (key.startsWith('drift_baseline:')) { if (!stale) baselineRecords.push(validateBaseline(payload)); }
    else if (!key.startsWith('plan:')) registries.push({ key, payload, stale });
  }
  // Hash current working sources as part of coverage, so a manual edit or new
  // scene makes a previous whole-work assessment stale even without a commit.
  const working = orderedScenes(project).filter(s => chosen.has(s.id ?? '') || expected.includes(s.id ?? `unmigrated:${s.chapter}.${s.scene}`));
  const workHashes = working.map(s => ({ id: s.id ?? `unmigrated:${s.chapter}.${s.scene}`, chapter: s.chapter, scene: s.scene, order: s.order ?? s.scene,
    hash: proseHash(parseFrontmatter(fs.readFileSync(s.filePath, 'utf8')).body) }));
  const workingDifferences = workHashes.filter(w => { const saved = selected.find(s => s.prose.address.id === w.id); return saved && (saved.prose.textHash !== w.hash || saved.prose.address.chapter !== w.chapter || saved.prose.address.order !== w.order); }).map(s => s.id);
  const unique = [...new Map(sources.map(s => [s.key, s])).values()];
  const missing = expected.filter(id => !chosen.has(id));
  const stale = store.stale(unique, at).map(s => s.key);
  const sourceFingerprint = objectHash({ scope, expected, selected: selected.map(s => s.source), context: context.map(s => s.source), sources: unique, workHashes });
  const limitations = ['Model sequence review is not a human continuous read. Automatic observations are proxies, not literary verdicts.',
    'Distal and adjacent evidence is included only when available; absent history remains unknown.',
    ...(missing.length ? ['Not all expected scenes have accepted prose.'] : []),
    ...(stale.length ? ['Some source assessments or registry records need reassessment.'] : []),
    ...(workingDifferences.length ? ['Working files differ from accepted prose or ordering. The audit reads accepted prose.'] : [])];
  return { id: newId(), projectId: store.projectId, head: at.hash, scope, sourceFingerprint, sources: unique, selected, context, missing, stale, workingDifferences, plans, registries,
    drift: monitorDrift(selected.map(s => ({ sceneId: s.prose.address.id, body: s.prose.body, condition: s.prose.condition, source: s.source })), baselineRecords), limitations };
}

export function auditSummary(input: AuditInput) {
  const atIndex = input.selected.at(-1)!.prose.condition.narrativeIndex;
  return { scope: input.scope, snapshot: input.head, sourceFingerprint: input.sourceFingerprint,
    sceneIds: input.selected.map(s => s.prose.address.id), contextSceneIds: input.context.map(s => s.prose.address.id),
    missing: input.missing, stale: input.stale, workingDifferences: input.workingDifferences,
    words: input.selected.reduce((n, s) => n + s.prose.body.trim().split(/\s+/u).filter(Boolean).length, 0),
    promises: input.registries.filter(r => r.key.startsWith('promise:')).map(r => ({ key: r.key, stale: r.stale, ...promiseStatus(checked(PromiseSchema, r.payload), atIndex) })),
    motifEvents: input.registries.filter(r => r.key.startsWith('motif:')).map(r => ({ key: r.key, stale: r.stale, count: checked(MotifSchema, r.payload).history.filter(e => e.position.narrativeIndex <= atIndex).length })),
    drift: input.drift, semanticAssessment: 'not_performed', limitations: input.limitations };
}
export function validateAuditReview(value: unknown, input: AuditInput, inputHash: string): AuditReview {
  const review = checked(AuditReviewSchema, value, 'sequence review');
  if (review.inputHash !== inputHash) throw new Error('Sequence review refers to a different input');
  if (new Set(review.checks.map(c => c.dimension)).size !== auditDimensions.length) throw new Error('Sequence dimension coverage is incomplete');
  const scenes = [...input.selected, ...input.context];
  for (const c of review.checks) {
    checkEvidence(c.evidence, (id, h) => scenes.find(s => s.prose.address.id === id && s.prose.textHash === h)?.prose.body);
    if (['supported', 'licensed', 'concern'].includes(c.outcome) && !c.evidence.some(e => input.selected.some(s => s.prose.address.id === e.sceneId))) throw new Error('Sequence finding needs evidence inside its declared scope');
    if (c.blocking && (c.outcome !== 'concern' || !c.smallestRepair.trim() || !c.pairedRisk.trim())) throw new Error('Blocking sequence finding needs a concern, minimal repair and regression risk');
    if (c.outcome === 'licensed' && c.smallestRepair.trim()) throw new Error('Licensed variation is not an editing target');
  }
  return review;
}
export function auditCurrent(project: NovelProject, record: { input: AuditInput }): boolean {
  try { return buildAudit(project, record.input.scope).sourceFingerprint === record.input.sourceFingerprint; }
  catch { return false; }
}
export function auditPacket(input: AuditInput, host: WorkerHost) {
  const model = host.model; if (!model) throw new Error('Select an authorized model');
  if (input.stale.length) throw new Error('Reassess stale scene or control evidence before a paid sequence audit');
  if ([...input.selected, ...input.context].some(s => !s.prose.transmissionApproved)) throw new Error('Audit contains prose without transmission approval');
  const content = { scope: input.scope, coverage: auditSummary(input), scenes: input.selected.map(s => s.prose), adjacentAndDistal: input.context.map(s => s.prose), plans: input.plans, registries: input.registries };
  const inputHash = objectHash(content), outputReserve = Math.min(10000, model.maxTokens);
  const prompt = workerPrompt('audit', AuditReviewSchema);
  const packet = evidencePacket(input.projectId, input.id, 'critic', { role: 'critic', inputHash, ...content }, input.sources,
    { modelWindow: model.contextWindow, outputReserve, hostTokens: estimateTokens(prompt), safetyReserve: 1024, maxInputTokens: model.contextWindow });
  return { packet, inputHash, outputReserve, reservedTokens: estimateTokens(prompt + packet.text) + outputReserve };
}
/** The coordinator owns authorization and the session lease. The audit keeps its
 * call accounting and commits only the assessed input, never rewritten prose. */
export async function runAudit(project: NovelProject, input: AuditInput, host: WorkerHost, permit: WorkerPermit, signal?: AbortSignal) {
  const store = LiteraryStore.open(project.rootPath), jobs = new JobStore(project.rootPath, store.projectId);
  const packet = auditPacket(input, host);
  if (!permit.active() || permit.runId !== input.id || permit.projectId !== input.projectId) throw new Error('Audit is not authorized');
  return withExecution(project.rootPath, input.id, async () => {
    if (store.head().hash !== input.head || !auditCurrent(project, { input })) throw new Error('Audit sources changed');
    const reservation = jobs.reserve(input.id, packet.packet.hash, packet.reservedTokens, permit);
    try {
      const out = await runWorker(host, permit, { task: 'audit', packet: packet.packet, outputSchema: AuditReviewSchema, maxOutputTokens: packet.outputReserve, timeoutMs: 180000, ...(signal ? { signal } : {}) });
      const call = store.put('model_call', out.call.id, { call: out.call, packet: packet.packet, output: out.rawText }, [], input.id);
      jobs.settle(input.id, reservation, out.call, call.hash);
      const review = validateAuditReview(out.value, input, packet.inputHash);
      signal?.throwIfAborted();
      if (!permit.active() || store.head().hash !== input.head || !auditCurrent(project, { input })) throw new Error('Audit changed or was cancelled before acceptance');
      const coverageComplete = !input.missing.length && !input.stale.length && !input.workingDifferences.length;
      const accepted = store.put('audit', input.id, { input, review, modelCall: call, coverageComplete,
        semanticAssessment: 'model_review', independentHumanEvaluation: 'not_performed' }, input.sources, input.id);
      const committed = store.commit({ expectedHead: input.head, requestId: `audit-${input.id}`, changes: [accepted], dependencies: input.sources });
      jobs.update(input.id, j => { j.status = 'accepted'; j.acceptedHead = committed.hash; j.next = 'complete'; });
      return { audit: accepted, head: committed.hash, coverageComplete, blocking: review.checks.filter(c => c.blocking), review };
    } catch (error) {
      if (error instanceof WorkerFailure) {
        const call = store.put('model_call', error.call.id, { call: error.call, packet: packet.packet, output: error.rawText }, [], input.id);
        jobs.settle(input.id, reservation, error.call, call.hash);
      }
      jobs.update(input.id, j => { j.status = signal?.aborted || !permit.active() ? 'paused' : 'blocked'; j.reason = 'Sequence review incomplete; private evidence retained'; });
      throw error;
    }
  });
}
