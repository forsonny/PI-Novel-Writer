import { Type, type Static } from 'typebox';
import { checked, Strict, Id, Text, Nonempty, Short, Sources, Span, strings, type SourceRef } from './schema.ts';
import { checkEvidence, type SceneCondition, type TextResolver } from './narrative.ts';
import { matchesVoice, VoiceWhenSchema, RightsSchema } from './voice.ts';
import { objectHash } from './version.ts';

const Position = Strict({ sceneId: Id, narrativeIndex: Type.Integer({ minimum: 0 }), wordPosition: Type.Integer({ minimum: 0 }), ordinal: Type.Integer({ minimum: 0 }) });
const eventFields = { id: Id, position: Position, rationale: Nonempty, evidence: Type.Array(Span, { maxItems: 100 }), meaning: Text };
export const PromiseEventSchema = Strict({ ...eventFields, action: Type.Enum(['introduce', 'sustain', 'transform', 'misdirect', 'defer', 'resolve', 'abandon', 'intentional_nonresolution', 'reopen'] as const) });
export type PromiseEvent = Static<typeof PromiseEventSchema>;
export const PromiseSchema = Strict({
  schemaVersion: Type.Literal(1), id: Id, type: Short, statement: Nonempty,
  salience: Type.Integer({ minimum: 0, maximum: 3 }), characters: Type.Array(Id, { maxItems: 100 }),
  themes: strings(), eligibleCallbacks: strings(), transformations: strings(),
  resolutionWindow: Strict({ earliestIndex: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]), latestIndex: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]) }),
  acceptableNonresolution: Text, dependencies: Sources,
  history: Type.Array(PromiseEventSchema, { maxItems: 1000 }),
});
export type NarrativePromise = Static<typeof PromiseSchema>;
export const MotifEventSchema = Strict({ ...eventFields, action: Type.Enum(['introduce', 'recur', 'transform', 'omit', 'dormant', 'retire', 'reactivate'] as const) });
export type MotifEvent = Static<typeof MotifEventSchema>;
export const SaturationSchema = Strict({ windowWords: Type.Integer({ minimum: 1 }), warningCount: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]), basis: Type.Enum(['unconfigured', 'design_heuristic', 'human_calibrated'] as const), evidence: Sources });
export const MotifSchema = Strict({
  schemaVersion: Type.Literal(1), id: Id, name: Short, materialForms: strings(), thematicQuestions: strings(),
  initialMeaning: Nonempty, viewpointMeanings: Type.Array(Strict({ holderId: Id, meaning: Nonempty }), { maxItems: 100 }),
  transformations: strings(), forbiddenGlosses: strings(), when: VoiceWhenSchema, dependencies: Sources,
  saturation: SaturationSchema, history: Type.Array(MotifEventSchema, { maxItems: 1000 }),
});
export type Motif = Static<typeof MotifSchema>;
export const UseSchema = Strict({ id: Id, position: Position, evidence: Type.Array(Span, { minItems: 1, maxItems: 100 }) });
export const AffordanceSchema = Strict({
  schemaVersion: Type.Literal(1), id: Id, description: Nonempty, sourceState: Sources,
  when: VoiceWhenSchema, holderId: Type.Union([Id, Type.Null()]), sourceDomains: strings(),
  perceptualOptions: strings(), positiveAlternatives: strings(), status: Type.Enum(['proposed', 'approved', 'retired'] as const),
  rights: RightsSchema, providerTransmissionAllowed: Type.Boolean(), saturation: SaturationSchema,
  uses: Type.Array(UseSchema, { maxItems: 1000 }),
});
export type Affordance = Static<typeof AffordanceSchema>;
type Positioned = { id: string; position: Static<typeof Position> };
const ordered = <T extends Positioned>(events: T[]) => [...events].sort((a, b) => a.position.narrativeIndex - b.position.narrativeIndex || a.position.ordinal - b.position.ordinal || a.id.localeCompare(b.id));
function unique<T extends Positioned>(events: T[]): void {
  if (new Set(events.map(e => e.id)).size !== events.length) throw new Error('Duplicate registry event');
  if (new Set(events.map(e => `${e.position.narrativeIndex}:${e.position.ordinal}`)).size !== events.length) throw new Error('Registry events need distinct reading positions');
  const sequence = ordered(events);
  if (sequence.some((event, i) => i > 0 && event.position.wordPosition < sequence[i - 1].position.wordPosition)) throw new Error('Registry word positions disagree with reading order');
}
function saturationValid(value: Static<typeof SaturationSchema>): void {
  if (value.basis === 'human_calibrated' && !value.evidence.length) throw new Error('Human-calibrated saturation requires calibration evidence');
  if (value.basis === 'unconfigured' && value.warningCount !== null) throw new Error('Unconfigured saturation cannot contain an effective threshold');
}
function eventEvidence(event: { position: Static<typeof Position>; evidence: Static<typeof Span>[] }, resolve: TextResolver): void {
  if (event.evidence.some(e => e.sceneId !== event.position.sceneId)) throw new Error('Registry evidence belongs to another scene');
  checkEvidence(event.evidence, resolve);
}
export function validatePromise(value: unknown, resolve: TextResolver): NarrativePromise {
  const p = checked(PromiseSchema, value, 'promise'); unique(p.history);
  const { earliestIndex: lo, latestIndex: hi } = p.resolutionWindow;
  if (lo !== null && hi !== null && lo > hi) throw new Error('Promise resolution window is reversed');
  let live = false, introduced = false;
  for (const event of ordered(p.history)) {
    eventEvidence(event, resolve);
    if (!event.evidence.length && !['defer', 'abandon', 'intentional_nonresolution'].includes(event.action)) throw new Error('Promise action requires prose evidence');
    if (event.action === 'introduce') {
      if (introduced) throw new Error('Promise introduced twice; transform or reopen instead');
      live = true; introduced = true;
    } else if (!introduced) throw new Error('Promise action precedes introduction');
    else if (event.action === 'reopen') { if (live) throw new Error('Only a closed promise can reopen'); live = true; }
    else {
      if (!live) throw new Error('Closed promise requires explicit reopening');
      if (event.action === 'transform' && !event.meaning.trim()) throw new Error('Promise transformation needs its changed meaning');
      if (['resolve', 'abandon', 'intentional_nonresolution'].includes(event.action)) live = false;
    }
  }
  return p;
}
export function applyPromiseEvent(promise: NarrativePromise, value: unknown, resolve: TextResolver): NarrativePromise {
  const event = checked(PromiseEventSchema, value, 'promise event');
  const found = promise.history.find(e => e.id === event.id);
  if (found) { if (objectHash(found) !== objectHash(event)) throw new Error('Registry event ID reused'); return validatePromise(promise, resolve); }
  return validatePromise({ ...promise, history: ordered([...promise.history, event]) }, resolve);
}
export function promiseStatus(promise: NarrativePromise, atIndex: number) {
  checked(PromiseSchema, promise);
  if (!Number.isSafeInteger(atIndex) || atIndex < 0) throw new Error('Invalid promise cutoff');
  const events = ordered(promise.history).filter(e => e.position.narrativeIndex <= atIndex);
  const last = events.at(-1), first = events[0];
  const status = !last ? 'planned' : ({ resolve: 'resolved', abandon: 'abandoned', intentional_nonresolution: 'intentional_nonresolution', defer: 'deferred' } as Record<string, string>)[last.action] || 'open';
  const overdue = ['open', 'deferred'].includes(status) && promise.resolutionWindow.latestIndex !== null && atIndex > promise.resolutionWindow.latestIndex;
  return { status, ageInScenes: first ? atIndex - first.position.narrativeIndex : null, overdueReview: overdue, reminderRequired: false, note: 'Age and windows request review, never compulsory callbacks or automatic payoff.' };
}
export function validateMotif(value: unknown, resolve: TextResolver): Motif {
  const m = checked(MotifSchema, value, 'motif'); unique(m.history); saturationValid(m.saturation);
  if (new Set(m.viewpointMeanings.map(v => v.holderId)).size !== m.viewpointMeanings.length) throw new Error('Duplicate motif viewpoint meaning');
  let state = 'planned';
  for (const event of ordered(m.history)) {
    eventEvidence(event, resolve);
    if (['introduce', 'recur', 'transform', 'reactivate'].includes(event.action) && !event.evidence.length) throw new Error('Motif occurrence needs prose evidence');
    if (event.action === 'introduce') { if (state !== 'planned') throw new Error('Motif introduced twice'); state = 'active'; }
    else if (event.action === 'omit') { /* Omission is a documented choice, not a recurrence. */ }
    else if (state === 'planned') throw new Error('Motif action precedes introduction');
    else if (event.action === 'dormant' || event.action === 'retire') state = event.action;
    else if (event.action === 'reactivate') { if (state === 'active') throw new Error('Active motif does not require reactivation'); state = 'active'; }
    else if (state !== 'active') throw new Error('Dormant or retired motif requires explicit reactivation');
    if (event.action === 'transform' && !event.meaning.trim()) throw new Error('Motif transformation needs changed meaning');
  }
  return m;
}
export function applyMotifEvent(motif: Motif, value: unknown, resolve: TextResolver): Motif {
  const event = checked(MotifEventSchema, value, 'motif event');
  const found = motif.history.find(e => e.id === event.id);
  if (found) { if (objectHash(found) !== objectHash(event)) throw new Error('Registry event ID reused'); return validateMotif(motif, resolve); }
  return validateMotif({ ...motif, history: ordered([...motif.history, event]) }, resolve);
}
export function motifAvailability(motif: Motif, condition: SceneCondition, wordPosition: number) {
  const history = ordered(motif.history).filter(e => e.position.narrativeIndex <= condition.narrativeIndex && e.position.wordPosition <= wordPosition);
  let state = 'planned', meaning = motif.viewpointMeanings.find(v => v.holderId === condition.focalizerId)?.meaning || motif.initialMeaning;
  for (const e of history) {
    if (['introduce', 'reactivate'].includes(e.action)) state = 'active';
    if (e.action === 'dormant' || e.action === 'retire') state = e.action;
    if (e.action === 'transform') meaning = e.meaning;
  }
  const count = history.filter(e => ['introduce', 'recur', 'transform', 'reactivate'].includes(e.action) && wordPosition - e.position.wordPosition < motif.saturation.windowWords).length;
  const saturated = motif.saturation.warningCount !== null && count >= motif.saturation.warningCount;
  return { eligible: matchesVoice(motif.when, condition) && state === 'active' && !saturated, state, meaning, recentOccurrences: count, saturationWarning: saturated, insertionRequired: false };
}
export function validateAffordance(value: unknown, resolve: TextResolver): Affordance {
  const a = checked(AffordanceSchema, value, 'language affordance'); unique(a.uses); saturationValid(a.saturation);
  if (a.status === 'approved' && !a.sourceState.length) throw new Error('Approved language affordance needs grounded state');
  a.uses.forEach(e => eventEvidence(e, resolve));
  return a;
}
export function selectAffordances(affordances: Affordance[], condition: SceneCondition, wordPosition: number, currentVersions: Record<string, string>, availableStateKeys: readonly string[]): { selected: Affordance[]; omitted: { id: string; reason: string }[]; dependencies: SourceRef[] } {
  const selected: Affordance[] = [], omitted: { id: string; reason: string }[] = [];
  for (const a of affordances) {
    checked(AffordanceSchema, a); saturationValid(a.saturation);
    if (!Number.isSafeInteger(wordPosition) || wordPosition < 0) throw new Error('Invalid word position');
    const count = a.uses.filter(u => u.position.narrativeIndex <= condition.narrativeIndex && u.position.wordPosition <= wordPosition && wordPosition - u.position.wordPosition < a.saturation.windowWords).length;
    const reason = a.status !== 'approved' ? 'not approved' : !a.providerTransmissionAllowed ? 'transmission not authorized' : !['author_owned', 'public_domain', 'licensed'].includes(a.rights.status) || !a.rights.permitted.includes('drafting') || (a.rights.livingAuthor !== false && !a.rights.permissionRecorded) ? 'rights exclude drafting' : !matchesVoice(a.when, condition) || (a.holderId !== null && a.holderId !== condition.focalizerId) ? 'unavailable to this viewpoint or scene' : a.sourceState.some(s => currentVersions[s.key] !== s.hash) ? 'state dependency stale' : a.sourceState.some(s => !availableStateKeys.includes(s.key)) ? 'grounding state unavailable at this viewpoint cutoff' : a.saturation.warningCount !== null && count >= a.saturation.warningCount ? 'saturation warning' : '';
    if (reason) omitted.push({ id: a.id, reason }); else selected.push(a);
  }
  return { selected, omitted, dependencies: selected.flatMap(a => a.sourceState) };
}
