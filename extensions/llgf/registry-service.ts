import { Type, type Static } from 'typebox';
import { Strict, Id, Sources, checked, type SourceRef } from './schema.ts';
import { newId, objectHash, canonicalJson, proseHash } from './version.ts';
import { LiteraryStore, type SnapshotRef } from './store.ts';
import { type SceneContract, type TextResolver, checkEvidence } from './narrative.ts';
import { DriftBaselineSchema, validateBaseline } from './drift.ts';
import { PlanSchema, validatePlans, type NarrativePlan } from './planning.ts';
import { AVSSchema, AnchorSchema, validateVoice } from './voice.ts';
import { PromiseSchema, MotifSchema, AffordanceSchema, PromiseEventSchema, MotifEventSchema, UseSchema,
  validatePromise, validateMotif, validateAffordance, applyPromiseEvent, applyMotifEvent, promiseStatus, motifAvailability, selectAffordances,
  type NarrativePromise, type Motif, type Affordance } from './registries.ts';
import type { MemoryItem } from './context.ts';

export const designSchemas = { drift_baseline: DriftBaselineSchema, plan: PlanSchema, voice: AVSSchema, anchor: AnchorSchema, promise: PromiseSchema, motif: MotifSchema, affordance: AffordanceSchema };
export type DesignKind = keyof typeof designSchemas;
export const RegistryDeltaSchema = Strict({
  promises: Type.Array(Strict({ id: Id, event: PromiseEventSchema }), { maxItems: 30 }),
  motifs: Type.Array(Strict({ id: Id, event: MotifEventSchema }), { maxItems: 30 }),
  affordances: Type.Array(Strict({ id: Id, use: UseSchema }), { maxItems: 30 }),
});
export type RegistryDelta = Static<typeof RegistryDeltaSchema>;
export const emptyDelta = (): RegistryDelta => ({ promises: [], motifs: [], affordances: [] });
export function registryEventIds(delta: RegistryDelta): string[] { return [...delta.promises.map(x => x.event.id), ...delta.motifs.map(x => x.event.id), ...delta.affordances.map(x => x.use.id)]; }
export function acceptedResolver(store: LiteraryStore, at: SnapshotRef): TextResolver {
  return (id, hash) => { const p = store.get(`prose:${id}`, at)?.payload as { body?: string } | undefined; return p?.body !== undefined && proseHash(p.body) === hash ? p.body : undefined; };
}
const refs = (items: SourceRef[]): SourceRef[] => [...new Map(items.map(r => [r.key, r])).values()];
function assertFresh(store: LiteraryStore, sources: SourceRef[], at: SnapshotRef) { if (store.stale(sources, at).length) throw new Error('Design dependencies need reassessment'); }

/** Control changes have author/delegation provenance and may not rewrite event
 * history. History changes enter through independently validated scene deltas. */
export function saveDesign(root: string, kind: DesignKind, value: unknown, expectedHead: string, actor: 'human' | 'model'): SourceRef {
  const store = LiteraryStore.open(root), at = store.head();
  if (at.hash !== expectedHead) throw new Error('Accepted state changed before design update');
  const p = checked(designSchemas[kind], value, kind), resolve = acceptedResolver(store, at), id = p.id;
  const old = store.get(`${kind}:${id}`, at), previous = old?.payload as { history?: unknown[]; uses?: unknown[] } | undefined;
  let dependencies: SourceRef[] = [];
  if (kind === 'drift_baseline') {
    const baseline = validateBaseline(p); dependencies = baseline.sourceRecords;
    if (actor === 'model' && baseline.calibration === 'human_calibrated') throw new Error('Model cannot claim human calibration');
  } else if (kind === 'plan') {
    const plan = checked(PlanSchema, p), others = Object.entries(at.snapshot.versions).filter(([k]) => k.startsWith('plan:') && k !== `plan:${id}`).map(([, h]) => store.artifact(h).payload as NarrativePlan);
    validatePlans([...others, plan]); dependencies = [...plan.dependencies, ...plan.entryState, ...plan.obligations.flatMap(o => o.preconditions)];
    if (actor === 'model' && old && (plan.level === 'novel' && objectHash((old.payload as NarrativePlan).endingConstraints) !== objectHash(plan.endingConstraints))) throw new Error('Changing ending constraints requires author approval');
  } else if (kind === 'voice') {
    const voice = validateVoice(p);
    if (actor === 'model' && old) { const prior = checked(AVSSchema, old.payload); if (objectHash(prior.invariants) !== objectHash(voice.invariants) || objectHash(prior.epochs.filter(e => e.approved)) !== objectHash(voice.epochs.filter(e => e.approved))) throw new Error('Frozen invariants and approved epochs require author changes'); }
    dependencies = [...voice.calibration.reviewRecords, ...voice.epochs.flatMap(e => e.transitionEvidence), ...voice.transitions.flatMap(t => t.sourceRecords), ...voice.variationBudgets.flatMap(b => b.sourceRecords)];
    if (actor === 'model' && (voice.calibration.status === 'human_reviewed' || voice.variationBudgets.some(b => b.calibration === 'human_calibrated'))) throw new Error('Model cannot claim human calibration');
  } else if (kind === 'anchor') {
    const anchor = checked(AnchorSchema, p); if (anchor.sourceSpan) { checkEvidence([anchor.sourceSpan], resolve); if (anchor.sourceSpan.quote !== anchor.excerpt) throw new Error('Anchor excerpt differs from source'); } dependencies = anchor.sourceRecords;
  } else if (kind === 'promise') { dependencies = validatePromise(p, resolve).dependencies; }
  else if (kind === 'motif') { const motif = validateMotif(p, resolve); dependencies = [...motif.dependencies, ...motif.saturation.evidence]; }
  else { const a = validateAffordance(p, resolve); dependencies = [...a.sourceState, ...a.saturation.evidence]; }
  if (['promise', 'motif', 'affordance'].includes(kind)) {
    const record = p as { history?: unknown[]; uses?: unknown[] };
    if (objectHash(record.history ?? record.uses ?? []) !== objectHash(previous?.history ?? previous?.uses ?? [])) throw new Error('Design update cannot invent, remove or rewrite accepted event history');
    // Preserve evidence dependencies of retained history, not a self-reference.
    dependencies.push(...(old?.sources ?? []));
    if (actor === 'model' && 'saturation' in p && (p.saturation as { basis: string }).basis === 'human_calibrated') throw new Error('Model cannot claim human calibration');
  }
  dependencies = refs(dependencies).filter(r => r.key !== `${kind}:${id}`); assertFresh(store, dependencies, at);
  const change = store.put(kind, id, p, dependencies);
  const action = store.put('design_action', newId(), { kind, id, actor, humanStudy: 'not_performed', designHash: change.hash }, [change]);
  store.commit({ expectedHead, requestId: `design-${action.key}`, changes: [change, action], dependencies }); return change;
}

/** Only current-scene evidence can add an occurrence. No automatic reminders,
 * quotas, forced payoff or promotion of an unaccepted candidate is performed. */
export function applyRegistryDelta(store: LiteraryStore, at: SnapshotRef, deltaValue: unknown, contract: SceneContract, body: string) {
  const delta = checked(RegistryDeltaSchema, deltaValue, 'registry delta'), eventIds = registryEventIds(delta);
  if (new Set(eventIds).size !== eventIds.length) throw new Error('Duplicate registry delta event');
  const resolve: TextResolver = (id, hash) => id === contract.sceneId && hash === proseHash(body) ? body : acceptedResolver(store, at)(id, hash);
  const wordBase = Object.entries(at.snapshot.versions).filter(([k]) => k.startsWith('prose:')).reduce((sum, [, hash]) => { const p = store.artifact(hash).payload as { body: string; condition: SceneContract['condition'] }; return sum + (p.condition?.narrativeIndex < contract.condition.narrativeIndex ? p.body.trim().split(/\s+/).filter(Boolean).length : 0); }, 0);
  const updates = new Map<string, { kind: 'promise' | 'motif' | 'affordance'; id: string; payload: NarrativePromise | Motif | Affordance; dependencies: SourceRef[] }>();
  const entry = (kind: 'promise' | 'motif' | 'affordance', id: string) => {
    const key = `${kind}:${id}`; if (updates.has(key)) return updates.get(key)!;
    const a = store.get(key, at); if (!a) throw new Error('Registry delta names an unregistered design');
    assertFresh(store, [{ key, hash: at.snapshot.versions[key] }], at);
    const value = { kind, id, payload: structuredClone(a.payload) as NarrativePromise | Motif | Affordance, dependencies: a.sources }; updates.set(key, value); return value;
  };
  const evidence = (e: Static<typeof UseSchema>) => {
    if (e.position.sceneId !== contract.sceneId || e.position.narrativeIndex !== contract.condition.narrativeIndex) throw new Error('Registry occurrence has the wrong scene position');
    if (e.position.wordPosition < wordBase || e.position.wordPosition > wordBase + body.trim().split(/\s+/).filter(Boolean).length) throw new Error('Registry word position is outside this scene');
    if (e.evidence.some(s => s.sceneId !== contract.sceneId || s.textHash !== proseHash(body))) throw new Error('Registry proposal must cite the current scene');
    checkEvidence(e.evidence, resolve);
  };
  for (const x of delta.promises) { evidence(x.event); const u = entry('promise', x.id); u.payload = applyPromiseEvent(u.payload as NarrativePromise, x.event, resolve); }
  for (const x of delta.motifs) { evidence(x.event); const u = entry('motif', x.id); u.payload = applyMotifEvent(u.payload as Motif, x.event, resolve); }
  for (const x of delta.affordances) { evidence(x.use); const u = entry('affordance', x.id), a = u.payload as Affordance;
    if (a.uses.some(e => e.id === x.use.id)) throw new Error('Affordance use already recorded');
    u.payload = validateAffordance({ ...a, uses: [...a.uses, x.use] }, resolve);
  }
  return [...updates.values()];
}

export function registryMemory(store: LiteraryStore, at: SnapshotRef, contract: SceneContract, wordPosition: number, availableStateKeys: string[] = []): MemoryItem[] {
  const items: MemoryItem[] = [], condition = contract.condition;
  for (const [key, hash] of Object.entries(at.snapshot.versions)) {
    if (!/^(promise|motif|affordance):/.test(key) || store.stale([{ key, hash }], at).length) continue;
    const a = store.artifact(hash); let text: string, availableFrom: number | null = null, holderId: string | null = null;
    let visibility: MemoryItem['visibility'] = 'project', when: MemoryItem['when'] = { focalizerIds: [], sceneFunctions: [], epochIds: [], pressures: [], distances: [] };
    let rights: MemoryItem['rights'] = { status: 'author_owned', basis: 'Project design accepted under author or delegated authority', permitted: ['analysis', 'drafting'], livingAuthor: null, permissionRecorded: true };
    if (a.kind === 'promise') {
      const p = checked(PromiseSchema, a.payload), past = p.history.filter(e => e.position.narrativeIndex < condition.narrativeIndex);
      if (!past.length) continue; availableFrom = past[0].position.narrativeIndex;
      text = canonicalJson({ statement: p.statement, events: past, status: promiseStatus({ ...p, history: past }, condition.narrativeIndex), policy: 'Eligible context, not a compulsory callback or explanation.' });
    } else if (a.kind === 'motif') {
      const m = checked(MotifSchema, a.payload), past = m.history.filter(e => e.position.narrativeIndex < condition.narrativeIndex);
      if (!past.length) continue; when = m.when; availableFrom = past[0].position.narrativeIndex;
      text = canonicalJson({ name: m.name, materialForms: m.materialForms, availability: motifAvailability({ ...m, history: past }, condition, wordPosition), forbiddenGlosses: m.forbiddenGlosses, policy: 'Omission and dormancy are valid; no motif quotas.' });
    } else {
      const f = checked(AffordanceSchema, a.payload); if (!selectAffordances([f], condition, wordPosition, at.snapshot.versions, availableStateKeys).selected.length) continue;
      holderId = f.holderId; visibility = holderId ? 'focalizer' : 'project'; when = f.when; rights = f.rights;
      text = canonicalJson({ description: f.description, options: f.perceptualOptions, alternatives: f.positiveAlternatives, sourceDomains: f.sourceDomains, policy: 'Optional available perception, not a mandatory detail.' });
    }
    items.push({ schemaVersion: 1, id: a.id, projectId: store.projectId, source: { key, hash }, channel: a.kind === 'promise' ? 'narrative' : 'stylistic', kind: a.kind as MemoryItem['kind'], text, textHash: proseHash(text), status: 'accepted', authority: 'interpretation', epistemicStatus: 'Designed narrative relation, not a world fact', roles: ['planner', 'drafter', 'critic', 'validator', 'reviser'], visibility, holderId, availableFrom, when, dependencies: a.sources, requiredContext: [], tags: [], salience: 1, rights, providerTransmissionAllowed: true });
  }
  return items;
}
