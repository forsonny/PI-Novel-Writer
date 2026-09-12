import { Type, type Static } from 'typebox';
import { Strict, Id, Text, Nonempty, Short, Hash, Sources, Span, strings, checked } from './schema.ts';
import { ConditionSchema, ConfidenceSchema, validateTime, type SceneCondition } from './narrative.ts';
import { objectHash } from './version.ts';
import { pattern } from './taxonomy.ts';

export const VoiceWhenSchema = Strict({ focalizerIds: Type.Array(Id, { maxItems: 100 }), sceneFunctions: strings(), epochIds: Type.Array(Id, { maxItems: 100 }), pressures: strings(), distances: strings() });
export type VoiceWhen = Static<typeof VoiceWhenSchema>;
export const FeatureSchema = Strict({
  id: Short, level: Type.Enum(['project', 'novel', 'arc', 'chapter', 'scene', 'paragraph', 'sentence', 'revision'] as const),
  dimension: Short, description: Nonempty, representation: Type.Enum(['categorical', 'distribution', 'range', 'preference', 'relational', 'transition', 'exemplar', 'anti_exemplar'] as const),
  target: Type.Unknown(), when: VoiceWhenSchema, exceptions: strings(), priority: Type.Integer({ minimum: 0, maximum: 3 }),
  hardness: Type.Enum(['hard', 'soft', 'open'] as const), evidenceMethod: Type.Enum(['direct', 'proxy', 'model_assisted', 'human'] as const),
  overuseRisk: Nonempty, underuseRisk: Nonempty, confidence: ConfidenceSchema,
});
export type VoiceFeature = Static<typeof FeatureSchema>;
export const RightsSchema = Strict({ status: Type.Enum(['author_owned', 'licensed', 'public_domain', 'analysis_only', 'excluded', 'unknown'] as const), basis: Nonempty, permitted: Type.Array(Type.Enum(['drafting', 'analysis', 'release'] as const), { maxItems: 3 }), livingAuthor: Type.Union([Type.Boolean(), Type.Null()]), permissionRecorded: Type.Boolean() });
export type Rights = Static<typeof RightsSchema>;
export const AnchorSchema = Strict({ schemaVersion: Type.Literal(1), id: Id, kind: Type.Enum(['anchor', 'anti_anchor'] as const), function: Nonempty, when: VoiceWhenSchema, excerpt: Type.String({ minLength: 1, maxLength: 8000 }), sourceSpan: Type.Union([Span, Type.Null()]), sourceRecords: Sources, narrativeIndex: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]), rights: RightsSchema, wordingPolicy: Type.Literal('function_only') });
export type Anchor = Static<typeof AnchorSchema>;
export const AVSSchema = Strict({
  schemaVersion: Type.Literal(1), id: Id, name: Short, rationale: Nonempty, nonImitationDeclaration: Nonempty,
  narrator: Strict({ person: Short, tense: Short, access: Nonempty, reliability: Nonempty }),
  invariants: Type.Array(FeatureSchema, { maxItems: 100 }),
  profiles: Type.Array(Strict({ id: Id, name: Short, when: VoiceWhenSchema, features: Type.Array(FeatureSchema, { maxItems: 100 }), notes: strings() }), { maxItems: 100 }),
  transitions: Type.Array(Strict({ id: Id, fromProfileIds: Type.Array(Id), toProfileIds: Type.Array(Id), trigger: Nonempty, returnRule: Nonempty, sourceRecords: Sources }), { maxItems: 100 }),
  variationBudgets: Type.Array(Strict({ featureId: Short, when: VoiceWhenSchema, lower: Type.Union([Type.Number(), Type.Null()]), upper: Type.Union([Type.Number(), Type.Null()]), unit: Short, scope: Short, interpretation: Nonempty, calibration: Type.Enum(['design', 'human_calibrated'] as const), sourceRecords: Sources }), { maxItems: 100 }),
  motifBehavior: strings(), negativeConstraints: Type.Array(Strict({ patternId: Short, when: VoiceWhenSchema, reason: Nonempty, positiveAffordance: Nonempty, priority: Type.Integer({ minimum: 0, maximum: 3 }) }), { maxItems: 100 }),
  anchorIds: Type.Array(Id, { maxItems: 200 }), uncertainty: strings(),
  epochs: Type.Array(Strict({ id: Id, name: Short, profileIds: Type.Array(Id), transitionEvidence: Sources, rationale: Nonempty, approved: Type.Boolean() }), { maxItems: 100 }),
  calibration: Strict({ status: Type.Enum(['not_performed', 'model_only', 'human_reviewed'] as const), sampleIds: Type.Array(Id, { maxItems: 100 }), reviewRecords: Sources }),
});
export type AuthorVoice = Static<typeof AVSSchema>;

export function matchesVoice(when: VoiceWhen, condition: SceneCondition): boolean {
  const inList = (values: string[], value: string | null) => !values.length || (value !== null && values.includes(value));
  return inList(when.focalizerIds, condition.focalizerId) && inList(when.sceneFunctions, condition.sceneFunction) && inList(when.epochIds, condition.epochId) && inList(when.pressures, condition.pressure) && inList(when.distances, condition.distance);
}
export function validateVoice(value: unknown): AuthorVoice {
  const avs = checked(AVSSchema, value, 'Author Voice Specification');
  const features = [...avs.invariants, ...avs.profiles.flatMap(p => p.features)];
  const featureIds = new Set(features.map(f => f.id)), profileIds = new Set(avs.profiles.map(p => p.id));
  if (featureIds.size !== features.length || profileIds.size !== avs.profiles.length || new Set(avs.epochs.map(e => e.id)).size !== avs.epochs.length) throw new Error('Duplicate voice feature, profile or epoch ID');
  if (new Set(avs.anchorIds).size !== avs.anchorIds.length || new Set(avs.transitions.map(t => t.id)).size !== avs.transitions.length) throw new Error('Duplicate anchor or transition ID');
  for (const b of avs.variationBudgets) {
    if (!featureIds.has(b.featureId)) throw new Error('Variation budget references an unknown feature');
    if (b.lower !== null && b.upper !== null && b.lower > b.upper) throw new Error('Voice range is reversed');
    if (b.calibration === 'human_calibrated' && !b.sourceRecords.length) throw new Error('Human calibration needs recorded evidence');
  }
  for (const t of avs.transitions) for (const id of [...t.fromProfileIds, ...t.toProfileIds]) if (!profileIds.has(id)) throw new Error('Transition references an unknown profile');
  for (const e of avs.epochs) {
    e.profileIds.forEach(id => { if (!profileIds.has(id)) throw new Error('Epoch references an unknown profile'); });
    if (e.approved && !e.transitionEvidence.length) throw new Error('Approved voice evolution needs transition evidence');
  }
  for (const n of avs.negativeConstraints) pattern(n.patternId);
  if (avs.calibration.status === 'human_reviewed' && !avs.calibration.reviewRecords.length) throw new Error('Human voice review needs evidence');
  return avs;
}
export function usableAnchor(anchor: Anchor, condition: SceneCondition, highRisk: boolean): string | null {
  checked(AnchorSchema, anchor, 'voice anchor');
  if (anchor.sourceSpan && (anchor.sourceSpan.quote !== anchor.excerpt || anchor.sourceSpan.end - anchor.sourceSpan.start !== anchor.excerpt.length)) throw new Error('Anchor excerpt and source span disagree');
  if (!['author_owned', 'licensed', 'public_domain'].includes(anchor.rights.status) || !anchor.rights.permitted.includes('drafting')) return 'rights do not permit drafting';
  if (anchor.rights.livingAuthor !== false && !anchor.rights.permissionRecorded) return 'permission required for a living or unknown-status author';
  if (!matchesVoice(anchor.when, condition)) return 'different narrative condition';
  if (anchor.narrativeIndex !== null && anchor.narrativeIndex > condition.narrativeIndex) return 'future manuscript evidence';
  if (anchor.kind === 'anti_anchor' && !highRisk) return 'anti-anchor not needed for current risk';
  return null;
}
/** Deliberately labeled rough estimate. A provider tokenizer can replace it at the call boundary. */
export const estimateTokens = (text: string) => Math.ceil(Buffer.byteLength(text, 'utf8') / 4);
export interface VoicePacket { schemaVersion: 1; avsId: string; avsHash: string; condition: SceneCondition; text: string; estimatedTokens: number; selectedFeatures: string[]; selectedProfiles: string[]; selectedAnchors: string[]; omitted: { id: string; reason: string }[]; warnings: string[]; calibrationStatus: AuthorVoice['calibration']['status'] }
export interface VoiceOptions { maxTokens: number; risks?: string[]; recentWarnings?: string[]; previousProfileIds?: string[]; requireAnchor?: boolean }

export function compileVoice(value: unknown, conditionValue: unknown, anchorValues: Anchor[], options: VoiceOptions): VoicePacket {
  const avs = validateVoice(value), condition = checked(ConditionSchema, conditionValue, 'voice condition');
  validateTime(condition.storyTime);
  if (new Set(anchorValues.map(a => a.id)).size !== anchorValues.length) throw new Error('Duplicate supplied anchor ID');
  if (!Number.isSafeInteger(options.maxTokens) || options.maxTokens < 1) throw new Error('Voice budget must be a positive integer');
  const risks = [...new Set(options.risks || [])].slice(0, 5); risks.forEach(id => pattern(id));
  const epoch = condition.epochId === null ? undefined : avs.epochs.find(e => e.id === condition.epochId);
  if (condition.epochId !== null && (!epoch || !epoch.approved)) throw new Error('Active voice epoch is unknown or unapproved');
  const profiles = avs.profiles.filter(p => matchesVoice(p.when, condition) && (!epoch || epoch.profileIds.includes(p.id)));
  const selectedProfiles = profiles.map(p => p.id), selectedFeatures: string[] = [], selectedAnchors: string[] = [];
  const warnings = [...new Set(options.recentWarnings || [])].slice(0, 5), omitted: VoicePacket['omitted'] = [];
  const previous = options.previousProfileIds || [];
  if (previous.length && selectedProfiles.some(id => !previous.includes(id)) && !avs.transitions.some(t => previous.every(id => t.fromProfileIds.includes(id)) && selectedProfiles.every(id => t.toProfileIds.includes(id)))) warnings.push('Profile change has no recorded transition rule; review whether it is licensed.');
  const sections = [`VOICE ${avs.name}\nNon-imitation policy: ${avs.nonImitationDeclaration}\nNarrator: ${avs.narrator.person}; ${avs.narrator.tense}. Access: ${avs.narrator.access}. Reliability: ${avs.narrator.reliability}.\nScene function: ${condition.sceneFunction}. Pressure: ${condition.pressure}. Distance: ${condition.distance}.\nPlain sentences and licensed variation are permitted. Ranges are not quotas. Examples demonstrate function, never wording to copy.`, `Uncertainty: ${avs.uncertainty.join('; ') || 'Unmeasured features remain unmeasured.'}`];
  if (epoch) sections.push(`Voice epoch ${epoch.name}: ${epoch.rationale}`);
  const activeTransitions = avs.transitions.filter(t => previous.length > 0 && previous.every(id => t.fromProfileIds.includes(id)) && selectedProfiles.every(id => t.toProfileIds.includes(id)));
  for (const t of activeTransitions) sections.push(`Permitted transition, not an instruction to perform it: ${t.trigger}. Return: ${t.returnRule}`);
  const featureText = (f: VoiceFeature) => `${f.id} [${f.hardness}; ${f.dimension}]: ${f.description}\nTarget (${f.representation}): ${JSON.stringify(f.target)}\nExceptions: ${f.exceptions.join('; ') || 'none specified'}. Overuse: ${f.overuseRisk}. Underuse: ${f.underuseRisk}.`;
  const eligible = [...avs.invariants, ...profiles.flatMap(p => p.features)].filter(f => matchesVoice(f.when, condition)).sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  for (const f of eligible.filter(f => f.hardness === 'hard')) { sections.push(featureText(f)); selectedFeatures.push(f.id); }
  const measure = (extra = '') => estimateTokens([...sections, ...(extra ? [extra] : [])].join('\n\n'));
  if (measure() > options.maxTokens) throw new Error(`Required voice controls exceed budget (${measure()} estimated tokens). Nothing was silently omitted.`);
  const include = (id: string, text: string) => { if (measure(text) > options.maxTokens) { omitted.push({ id, reason: 'voice token budget' }); return false; } sections.push(text); return true; };
  // Short active risks precede optional texture. Warnings do not become universal prohibitions.
  for (const warning of warnings) include('warning', `WATCH: ${warning}`);
  for (const n of avs.negativeConstraints.filter(n => risks.includes(n.patternId) && matchesVoice(n.when, condition)).sort((a, b) => b.priority - a.priority).slice(0, 5)) include(`risk:${n.patternId}`, `RISK ${n.patternId}: ${n.reason}\nAvailable alternative: ${n.positiveAffordance}`);
  const candidates = anchorValues.filter(a => avs.anchorIds.includes(a.id)).filter(a => { const reason = usableAnchor(a, condition, risks.length > 0); if (reason) omitted.push({ id: a.id, reason }); return !reason; });
  const positive = candidates.filter(a => a.kind === 'anchor').sort((a, b) => (a.narrativeIndex ?? -1) - (b.narrativeIndex ?? -1) || a.id.localeCompare(b.id));
  const chosen = [...new Map([positive.at(-1), positive[0], candidates.find(a => a.kind === 'anti_anchor')].filter((a): a is Anchor => !!a).map(a => [a.id, a])).values()];
  for (const a of chosen) if (include(a.id, `${a.kind === 'anchor' ? 'ANCHOR' : 'ANTI-ANCHOR'}: ${a.function}\n${a.excerpt}\nDo not reuse wording or promote this example to story canon.`)) selectedAnchors.push(a.id);
  if (options.requireAnchor && !selectedAnchors.some(id => positive.some(a => a.id === id))) throw new Error('Required identity anchor could not be admitted; adjust rights, condition or budget');
  for (const f of eligible.filter(f => f.hardness !== 'hard')) if (include(f.id, featureText(f))) selectedFeatures.push(f.id);
  for (const b of avs.variationBudgets.filter(b => matchesVoice(b.when, condition) && selectedFeatures.includes(b.featureId))) include(`budget:${b.featureId}`, `Variation for ${b.featureId}: ${b.interpretation}; ${b.lower ?? 'open'} to ${b.upper ?? 'open'} ${b.unit}, ${b.scope}. Calibration: ${b.calibration}.`);
  for (const p of profiles) include(`profile:${p.id}`, p.notes.join('\n'));
  for (const policy of avs.motifBehavior) include('motif-policy', `Motif behavior: ${policy}. Eligibility is not a recurrence quota.`);
  for (const id of avs.anchorIds) if (!selectedAnchors.includes(id) && !omitted.some(x => x.id === id)) omitted.push({ id, reason: anchorValues.some(a => a.id === id) ? 'contrastive anchor selection' : 'anchor unavailable' });
  for (const f of [...avs.invariants, ...avs.profiles.flatMap(p => p.features)]) if (!selectedFeatures.includes(f.id) && !omitted.some(x => x.id === f.id)) omitted.push({ id: f.id, reason: 'inactive condition or profile' });
  const text = sections.join('\n\n');
  return { schemaVersion: 1, avsId: avs.id, avsHash: objectHash(avs), condition, text, estimatedTokens: estimateTokens(text), selectedFeatures, selectedProfiles, selectedAnchors, omitted, warnings, calibrationStatus: avs.calibration.status };
}

export const VoiceObservationSchema = Strict({ schemaVersion: Type.Literal(1), sceneId: Id, textHash: Hash, avsHash: Hash, condition: ConditionSchema, features: Type.Record(Type.String({ pattern: '^[a-zA-Z][a-zA-Z0-9_.-]{0,79}$' }), Type.Union([Type.Number(), Type.Null()])), methodVersion: Short });
/** Observations never mutate the declared AVS or freeze a later epoch to the opening. */
export function recordVoiceObservation(value: unknown) { return checked(VoiceObservationSchema, value, 'voice observation'); }
