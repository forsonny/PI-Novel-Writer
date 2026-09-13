import { Type, type Static } from 'typebox';
import { checked, Strict, Id, Text, Nonempty, Short, Sources, Span, strings, verifySpan, type EvidenceSpan } from './schema.ts';
import { canonicalJson, proseHash } from './version.ts';

export const ConfidenceSchema = Type.Union([Type.Literal('low'), Type.Literal('medium'), Type.Literal('high')]);
export const InformationModeSchema = Type.Enum(['explicit', 'inferable', 'withheld', 'ambiguous'] as const);
export const TimeRangeSchema = Strict({ earliest: Type.Union([Type.Number(), Type.Null()]), latest: Type.Union([Type.Number(), Type.Null()]), label: Text });
export type TimeRange = Static<typeof TimeRangeSchema>;
export const ConditionSchema = Strict({ focalizerId: Type.Union([Id, Type.Null()]), sceneFunction: Short, secondaryFunctions: strings(), pressure: Text, distance: Text, epochId: Type.Union([Id, Type.Null()]), storyTime: TimeRangeSchema, narrativeIndex: Type.Integer({ minimum: 0 }) });
export type SceneCondition = Static<typeof ConditionSchema>;
export const ProtectionSchema = Strict({ id: Id, kind: Type.Enum(['exact_text', 'fact', 'implication', 'ambiguity', 'silence', 'voice_feature'] as const), requirement: Nonempty, spans: Type.Array(Span, { maxItems: 100 }), readings: strings(), method: Type.Enum(['direct', 'model_assisted', 'human'] as const) });
export type Protection = Static<typeof ProtectionSchema>;
export const ObligationSchema = Strict({ id: Id, statement: Nonempty, hardness: Type.Enum(['hard', 'soft', 'open'] as const), preconditions: Sources, dependsOn: Type.Array(Id, { maxItems: 100 }), acceptableOutcomes: strings(), deferralAllowed: Type.Boolean(), completionEvidence: Text });
export type Obligation = Static<typeof ObligationSchema>;
export const InformationSchema = Strict({ statement: Nonempty, mode: InformationModeSchema, holderId: Type.Union([Id, Type.Null()]), evidenceRequired: Text });
export const SceneContractSchema = Strict({
  schemaVersion: Type.Literal(1), sceneId: Id, status: Type.Enum(['provisional', 'approved'] as const),
  condition: ConditionSchema, purpose: Nonempty, dramaticQuestion: Text, entryState: Sources,
  obligations: Type.Array(ObligationSchema, { maxItems: 100 }), prohibitions: strings(), information: Type.Array(InformationSchema, { maxItems: 100 }),
  knowledgeDelta: strings(), pressureCurve: strings(), distanceTrajectory: strings(), subtext: strings(),
  sensoryAffordances: strings(), promiseActions: strings(), exitStateRange: Type.Array(Nonempty, { minItems: 1, maxItems: 30 }),
  protected: Type.Array(ProtectionSchema, { maxItems: 100 }), riskForecast: strings(), openDiscoveries: strings(),
});
export type SceneContract = Static<typeof SceneContractSchema>;

export const PropositionSchema = Strict({
  schemaVersion: Type.Literal(1), id: Id, subjectId: Id, predicate: Short, value: Type.Unknown(),
  layer: Type.Enum(['world', 'character', 'narrator', 'reader'] as const),
  status: Type.Enum(['canon', 'viewpoint_belief', 'rumor', 'hypothesis', 'planned', 'retconned', 'unknown'] as const),
  holderId: Type.Union([Id, Type.Null()]), acquisition: Strict({ eventId: Type.Union([Id, Type.Null()]), at: TimeRangeSchema }),
  validTime: TimeRangeSchema, disclosedAt: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
  sourceType: Type.Enum(['narration', 'dialogue', 'free_indirect', 'metaphor', 'hypothetical', 'author_design'] as const),
  validation: Type.Enum(['proposed', 'verified', 'disputed'] as const), confidence: ConfidenceSchema,
  evidence: Type.Array(Span, { maxItems: 100 }), sourceRecords: Sources,
  review: Type.Union([Strict({ actor: Type.Enum(['author', 'model'] as const), rationale: Nonempty }), Type.Null()]),
  supersedes: Type.Array(Id, { maxItems: 100 }), conflictsWith: Type.Array(Id, { maxItems: 100 }),
});
export type Proposition = Static<typeof PropositionSchema>;
export interface SourceText { sceneId: string; body: string }
export type TextResolver = (sceneId: string, textHash: string) => string | undefined;

export function validateTime(range: TimeRange): void {
  checked(TimeRangeSchema, range, 'story time');
  if (range.earliest !== null && range.latest !== null && range.earliest > range.latest) throw new Error('Story-time interval is reversed');
}
export function checkEvidence(spans: EvidenceSpan[], resolve: TextResolver): void {
  for (const span of spans) {
    const body = resolve(span.sceneId, span.textHash);
    if (body === undefined) throw new Error('Evidence source version is unavailable');
    verifySpan(span, body, proseHash(body));
  }
}
export function validateContract(value: unknown): SceneContract {
  const c = checked(SceneContractSchema, value, 'Scene Intent Contract'); validateTime(c.condition.storyTime);
  if (c.condition.secondaryFunctions.length > 2) throw new Error('A scene has at most two secondary functions');
  if (new Set(c.obligations.map(x => x.id)).size !== c.obligations.length) throw new Error('Duplicate scene obligation');
  if (new Set(c.protected.map(x => x.id)).size !== c.protected.length) throw new Error('Duplicate protected property');
  for (const p of c.protected) {
    if (p.kind === 'exact_text' && !p.spans.length) throw new Error('Exact-text protection requires source spans');
    if (p.kind === 'ambiguity' && new Set(p.readings.map(x => x.trim()).filter(Boolean)).size < 2) throw new Error('Protected ambiguity needs at least two supported readings');
  }
  // Quiet and discovery scenes need no fabricated conflict, fixed ending, or sensory quota.
  return c;
}
export function validateProposition(value: unknown, resolve: TextResolver): Proposition {
  const p = checked(PropositionSchema, value, 'epistemic proposition'); validateTime(p.validTime); validateTime(p.acquisition.at);
  if (p.layer === 'character' && p.holderId === null) throw new Error('Character knowledge needs its holder');
  if (p.layer === 'world' && p.holderId !== null) throw new Error('World facts and character beliefs are separate records');
  if (p.status === 'viewpoint_belief' && p.layer !== 'character') throw new Error('Viewpoint belief belongs to a character');
  if (p.supersedes.includes(p.id) || p.conflictsWith.includes(p.id)) throw new Error('A proposition cannot supersede or conflict with itself');
  if (p.validation === 'verified' && p.review === null) throw new Error('Verified state needs an explicit review');
  if (p.status === 'canon') {
    if (p.validation !== 'verified' || p.review === null) throw new Error('Canonical state cannot be an unreviewed extraction');
    if (['metaphor', 'hypothetical', 'dialogue', 'free_indirect'].includes(p.sourceType)) throw new Error('Figurative, hypothetical or attributed language cannot be directly promoted to canon');
    if (p.sourceType === 'author_design' && p.review.actor !== 'author') throw new Error('Author-designed canon needs author authority');
  }
  if (p.validation === 'verified' && !p.evidence.length && !p.sourceRecords.length && p.sourceType !== 'author_design') throw new Error('Verified state needs source evidence');
  if (p.layer === 'character' && p.status === 'canon' && p.acquisition.eventId === null) throw new Error('Character knowledge requires an acquisition event');
  checkEvidence(p.evidence, resolve);
  return p;
}
export interface KnowledgeResult { available: Proposition[]; uncertainTime: Proposition[]; note: string }
/** Returns epistemically typed evidence, never an omniscient list of world facts. */
export function characterEvidence(records: Proposition[], holderId: string, storyAt: number, narrativeIndex: number): KnowledgeResult {
  checked(Id, holderId); if (!Number.isFinite(storyAt) || !Number.isSafeInteger(narrativeIndex) || narrativeIndex < 0) throw new Error('Invalid knowledge cutoff');
  const available: Proposition[] = []; const uncertainTime: Proposition[] = [];
  for (const raw of records) {
    const p = checked(PropositionSchema, raw); validateTime(p.validTime); validateTime(p.acquisition.at);
    if (p.layer !== 'character' || p.holderId !== holderId || ['planned', 'retconned'].includes(p.status)) continue;
    if (p.disclosedAt !== null && p.disclosedAt > narrativeIndex) continue;
    if (p.validTime.earliest !== null && p.validTime.earliest > storyAt) continue;
    if (p.validTime.latest !== null && p.validTime.latest < storyAt) continue;
    if (p.acquisition.at.earliest !== null && p.acquisition.at.earliest > storyAt) continue;
    if (p.acquisition.at.latest === null || p.acquisition.at.latest > storyAt || p.validation !== 'verified') uncertainTime.push(p);
    else available.push(p);
  }
  const superseded = new Set(available.flatMap(p => p.supersedes));
  return { available: available.filter(p => !superseded.has(p.id)), uncertainTime: uncertainTime.filter(p => !superseded.has(p.id)), note: 'These records retain belief, rumor and uncertainty. Absence is not proof of ignorance; reading order and story time are distinct.' };
}
export interface ApparentConflict { left: string; right: string; status: 'apparent'; reason: string }
export function apparentConflicts(records: Proposition[]): ApparentConflict[] {
  records.forEach(p => { checked(PropositionSchema, p); validateTime(p.validTime); });
  const result: ApparentConflict[] = [];
  for (let i = 0; i < records.length; i++) for (let j = i + 1; j < records.length; j++) {
    const a = records[i], b = records[j];
    if ([a.status, b.status].some(x => ['planned', 'retconned', 'unknown'].includes(x))) continue;
    if (a.subjectId !== b.subjectId || a.predicate !== b.predicate || a.layer !== b.layer || a.holderId !== b.holderId) continue;
    if (a.supersedes.includes(b.id) || b.supersedes.includes(a.id)) continue;
    if ((a.validTime.latest !== null && b.validTime.earliest !== null && a.validTime.latest < b.validTime.earliest) || (b.validTime.latest !== null && a.validTime.earliest !== null && b.validTime.latest < a.validTime.earliest)) continue;
    if (canonicalJson(a.value) !== canonicalJson(b.value)) result.push({ left: a.id, right: b.id, status: 'apparent', reason: 'Different values in possibly overlapping conditions. Review temporal change, unreliability, plural values and extraction uncertainty before calling this a contradiction.' });
  }
  return result;
}
export function validateObligationGraph(nodes: Obligation[]): void {
  nodes.forEach(n => checked(ObligationSchema, n));
  const index = new Map(nodes.map(n => [n.id, n])); if (index.size !== nodes.length) throw new Error('Duplicate obligation ID');
  const visiting = new Set<string>(), done = new Set<string>();
  const visit = (id: string) => {
    if (done.has(id)) return; if (visiting.has(id)) throw new Error('Cyclic prerequisite graph');
    const node = index.get(id); if (!node) throw new Error('Missing prerequisite obligation');
    visiting.add(id); node.dependsOn.forEach(visit); visiting.delete(id); done.add(id);
  };
  nodes.forEach(n => visit(n.id));
}

/** Supersession links are scoped to one proposition chain. A model cannot hide
 * a conflict by superseding an unrelated belief or nonexistent state record. */
export function validateStateLinks(records: Proposition[]): void {
  const byId = new Map(records.map(p => [p.id, p]));
  if (byId.size !== records.length) throw new Error('Duplicate state identity');
  const visited = new Set<string>(), active = new Set<string>();
  const visit = (id: string) => {
    if (visited.has(id)) return;
    if (active.has(id)) throw new Error('Cyclic state supersession');
    if (active.size >= 512) throw new Error('State supersession exceeds traversal limit');
    const p = byId.get(id)!; checked(PropositionSchema, p); active.add(id);
    if (new Set(p.supersedes).size !== p.supersedes.length) throw new Error('Duplicate state supersession');
    for (const targetId of p.supersedes) {
      const target = byId.get(targetId);
      if (!target) throw new Error('Superseded state is unavailable');
      if (target.subjectId !== p.subjectId || target.predicate !== p.predicate || target.layer !== p.layer || target.holderId !== p.holderId) throw new Error('Supersession crosses state or knowledge-holder boundaries');
      visit(targetId);
    }
    if (p.conflictsWith.some(target => target === id || !byId.has(target))) throw new Error('Conflict references unavailable state');
    active.delete(id); visited.add(id);
  };
  records.forEach(p => visit(p.id));
}
