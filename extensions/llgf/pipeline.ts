import fs from 'node:fs';
import { Type, type Static, type TSchema } from 'typebox';
import { Strict, Id, Hash, Nonempty, Short, Span, Sources, strings, checked, type SourceRef } from './schema.ts';
import { SceneContractSchema, PropositionSchema, validateContract, validateProposition, checkEvidence, apparentConflicts, characterEvidence, validateStateLinks, type Proposition, type SceneContract, type TextResolver } from './narrative.ts';
import { AVSSchema, AnchorSchema, compileVoice, validateVoice, estimateTokens, type Anchor } from './voice.ts';
import { composeContext, evidencePacket, type ContextPacket, type MemoryItem } from './context.ts';
import { DiagnosticReportSchema, validateDiagnostics, observeSurface, anchorOverlaps, wordTokens, type DiagnosticReport } from './diagnostics.ts';
import { RevisionProposalSchema, ComparisonSchema, planRevisions, applyRevision, acceptRevision, recoveryLimit, type RevisionRecord } from './revision.ts';
import { ValidationSchema, validateSceneReview, sceneGate, type GateResult, type SceneValidation } from './gates.ts';
import { GenerationPolicySchema, defaultGeneration, validateGeneration, candidateStrategies, validateDraftUnit, SelectionSchema, selectCandidate } from './generation.ts';
import { RegistryDeltaSchema, emptyDelta, registryEventIds, applyRegistryDelta, registryMemory, type RegistryDelta } from './registry-service.ts';
import { withExecution } from './execution.ts';
import { JobStore, BudgetSchema } from './jobs.ts';
import { LiteraryStore, type SnapshotRef } from './store.ts';
import { runWorker, workerPrompt, roleFor, WorkerFailure, type WorkerHost, type WorkerPermit, type WorkerFunction } from './workers.ts';
import { managedProject } from './migration.ts';
import { projectPath } from '../utils/safety.ts';
import { writeExact } from './io.ts';
import { canonicalJson, newId, objectHash, proseHash, hashText } from './version.ts';
import { patterns } from './taxonomy.ts';
import { cardsFor } from './pattern-cards.ts';

export const SceneAddressSchema = Strict({ id: Id, path: Nonempty, chapter: Type.Integer({ minimum: 1 }), scene: Type.Integer({ minimum: 1 }), order: Type.Number(), narrativeIndex: Type.Integer({ minimum: 0 }) });
export type SceneAddress = Static<typeof SceneAddressSchema>;
export const SceneSetupSchema = Strict({ schemaVersion: Type.Literal(1), contract: SceneContractSchema, voice: AVSSchema,
  anchors: Type.Array(AnchorSchema, { maxItems: 100 }), required: Sources, participantIds: Type.Array(Id, { maxItems: 100 }),
  minWords: Type.Integer({ minimum: 1, maximum: 20000 }), maxWords: Type.Integer({ minimum: 1, maximum: 20000 }),
  unitMaxWords: Type.Integer({ minimum: 20, maximum: 2000 }), maxUnits: Type.Integer({ minimum: 1, maximum: 100 }),
  generation: Type.Optional(GenerationPolicySchema),
  mode: Type.Enum(['continue', 'review_existing'] as const), budget: BudgetSchema,
  transmissionApproved: Type.Boolean(), sourcePolicy: Nonempty,
});
export type SceneSetup = Static<typeof SceneSetupSchema>;
const PreparationSchema = Strict({ schemaVersion: Type.Literal(1), id: Id, projectId: Id, address: SceneAddressSchema, setup: SceneSetupSchema,
  originalRaw: Type.String({ maxLength: 500000 }), originalHash: Hash, expectedHead: Hash, settingsHash: Hash });
export type Preparation = Static<typeof PreparationSchema>;
const StateSchema = Strict({ schemaVersion: Type.Literal(1), jobId: Id, preparationHash: Hash, body: Type.String({ maxLength: 500000 }),
  activeContract: SceneContractSchema, stage: Type.Enum(['sketch', 'draft', 'review', 'ready', 'blocked', 'accepted'] as const), units: Type.Integer({ minimum: 0 }),
  sketch: Type.Union([Type.Unknown(), Type.Null()]), records: Sources, revisionHistory: Type.Array(Type.Unknown(), { maxItems: 100 }),
  final: Type.Union([Type.Unknown(), Type.Null()]), reason: Type.Union([Short, Type.Null()]) });
export type PipelineState = Static<typeof StateSchema>;
const ProseReadSchema = Strict({ reconstruction: Nonempty, questions: strings(), uncertainties: strings(), evidence: Type.Array(Span, { minItems: 1, maxItems: 20 }) });
const SketchSchema = Strict({ moves: Type.Array(Nonempty, { minItems: 1, maxItems: 20 }), rationale: Nonempty, riskPatternIds: Type.Array(Short, { maxItems: 5 }) });
const DraftSchema = Strict({ prose: Type.String({ minLength: 1, maxLength: 20000 }), done: Type.Boolean(), uncertainties: strings() });
// The extractor proposes records. Only the validator and commit gateway can promote them.
const DeltaSchema = Type.Omit(PropositionSchema, ['validation', 'review']);
const ExtractionSchema = Strict({ propositions: Type.Array(DeltaSchema, { maxItems: 30 }), registry: Type.Optional(RegistryDeltaSchema), uncertainties: strings() });
const BlindComparisonSchema = Strict({ ...Type.Omit(ComparisonSchema, ['sourceHash', 'candidateHash', 'preferred']).properties,
  preferred: Type.Enum(['A', 'B', 'tie'] as const) });
interface FinalReview { proseRead: Static<typeof ProseReadSchema>; diagnostics: DiagnosticReport; validation: SceneValidation; propositions: Proposition[]; registry?: RegistryDelta; gate: GateResult }
export function proseBody(raw: string): string { return raw.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, ''); }
function ensureScene(root: string, a: SceneAddress): string {
  checked(SceneAddressSchema, a); const file = projectPath(root, a.path);
  if (!a.path.startsWith('manuscript/') || !a.path.endsWith('.md')) throw new Error('Expected a manuscript scene path');
  const raw = fs.readFileSync(file, 'utf8');
  const fm = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(raw);
  if (!fm || !new RegExp(`^id: *["']?${a.id}["']? *$`, 'm').test(fm[1])) throw new Error('Scene identity changed or migration is required');
  return raw;
}
function stateFile(root: string, id: string): string { checked(Id, id); return projectPath(root, `.pnw/jobs/${id}.pipeline.json`); }
export function readPipeline(root: string, id: string): PipelineState {
  const file = stateFile(root, id); if (fs.statSync(file).size > 2 * 1024 * 1024) throw new Error('Pipeline state exceeds limit');
  const s = checked(StateSchema, JSON.parse(fs.readFileSync(file, 'utf8')), 'pipeline checkpoint');
  if (s.jobId !== id) throw new Error('Pipeline identity mismatch'); return s;
}
function savePipeline(root: string, s: PipelineState): void { checked(StateSchema, s); writeExact(stateFile(root, s.jobId), canonicalJson(s)); }
function resolver(store: LiteraryStore, at: SnapshotRef, sceneId: string, bodies: string[]): TextResolver {
  const local = new Map(bodies.map(b => [proseHash(b), b]));
  return (id, hash) => {
    if (id === sceneId && local.has(hash)) return local.get(hash);
    const a = store.get(`prose:${id}`, at); if (!a) return undefined;
    const p = a.payload as { body?: unknown }; return typeof p.body === 'string' && proseHash(p.body) === hash ? p.body : undefined;
  };
}
/** Derive retrieval text from accepted records, never from a caller-supplied
 * authority label. Character knowledge is not inferred from mere presence. */
export function acceptedMemory(store: LiteraryStore, at: SnapshotRef, contract: SceneContract): MemoryItem[] {
  const result: MemoryItem[] = [];
  const records = Object.entries(at.snapshot.versions).filter(([key]) => /^(prose|proposition):/.test(key)).map(([key, hash]) => ({ key, hash, a: store.artifact(hash) }));
  const stale = new Set(store.stale(records.map(({ key, hash }) => ({ key, hash })), at).map(r => r.key));
  const propositions = records.filter(x => x.a.kind === 'proposition' && !stale.has(x.key)).map(x => checked(PropositionSchema, x.a.payload));
  const time = contract.condition.storyTime.earliest;
  const holder = contract.condition.focalizerId;
  const availableKnowledge = new Set(holder !== null && time !== null ? characterEvidence(propositions, holder, time, contract.condition.narrativeIndex).available.map(p => p.id) : []);
  const availableState = propositions.filter(p => p.layer !== 'character' && p.validation === 'verified' && !['planned', 'retconned'].includes(p.status)
    && (p.disclosedAt === null || p.disclosedAt <= contract.condition.narrativeIndex)
    && (time === null ? p.validTime.earliest === null && p.validTime.latest === null : (p.validTime.earliest === null || p.validTime.earliest <= time) && (p.validTime.latest === null || p.validTime.latest >= time)));
  const supersededState = new Set(availableState.flatMap(p => p.supersedes));
  const stateIds = new Set(availableState.filter(p => !supersededState.has(p.id)).map(p => p.id));
  for (const { key, hash, a } of records) {
    if (stale.has(key)) continue;
    if (a.kind === 'prose' && at.snapshot.versions[`acceptance:${a.id}`] && store.stale([{ key: `acceptance:${a.id}`, hash: at.snapshot.versions[`acceptance:${a.id}`] }], at).length) continue;
    let text: string, holderId: string | null, availableFrom: number | null, kind: MemoryItem['kind'], visibility: MemoryItem['visibility'];
    if (a.kind === 'prose') {
      const p = a.payload as { body: string; condition: SceneContract['condition']; transmissionApproved: boolean };
      if (!p.transmissionApproved || typeof p.body !== 'string' || !p.condition) continue;
      if (a.id === contract.sceneId || p.condition.narrativeIndex >= contract.condition.narrativeIndex) continue;
      text = p.body; holderId = p.condition.focalizerId; availableFrom = p.condition.narrativeIndex;
      kind = 'prose'; visibility = holderId === null ? 'validator_only' : 'focalizer';
    } else {
      const p = checked(PropositionSchema, a.payload); if (p.validation !== 'verified') continue;
      // Superseded records are history, not current knowledge.
      if (!(p.layer === 'character' ? availableKnowledge : stateIds).has(p.id)) continue;
      text = canonicalJson(p); holderId = p.holderId; availableFrom = p.disclosedAt;
      kind = p.layer === 'character' ? 'knowledge' : 'state'; visibility = p.layer === 'character' ? 'focalizer' : 'validator_only';
      if (p.layer === 'character') {
        const atTime = contract.condition.storyTime.earliest;
        if (atTime === null || p.acquisition.at.latest === null || p.acquisition.at.latest > atTime || p.validTime.earliest !== null && p.validTime.earliest > atTime || p.validTime.latest !== null && p.validTime.latest < atTime) continue;
      }
    }
    result.push({ schemaVersion: 1, id: a.id, projectId: store.projectId, source: { key, hash }, channel: 'narrative', kind, text, textHash: proseHash(text), status: 'accepted', authority: a.kind === 'prose' ? 'interpretation' : 'canonical', epistemicStatus: a.kind === 'prose' ? 'Accepted narration may contain beliefs and metaphor' : (a.payload as Proposition).status,
      roles: ['planner', 'drafter', 'critic', 'validator', 'reviser'], visibility, holderId, availableFrom,
      when: { focalizerIds: [], sceneFunctions: [], epochIds: [], pressures: [], distances: [] }, dependencies: a.sources, requiredContext: [],
      tags: a.kind === 'prose' ? [(a.payload as { condition: SceneContract['condition'] }).condition.sceneFunction] : [(a.payload as Proposition).predicate], salience: 1,
      rights: { status: 'author_owned', basis: 'Project candidate accepted under recorded transmission permission', permitted: ['analysis', 'drafting'], livingAuthor: null, permissionRecorded: true }, providerTransmissionAllowed: true });
  }
  const wordBase = records.filter(x => x.a.kind === 'prose').reduce((n, x) => { const p = x.a.payload as { body: string; condition: SceneContract['condition'] }; return n + (p.condition?.narrativeIndex < contract.condition.narrativeIndex ? wordTokens(p.body).length : 0); }, 0);
  return [...result, ...registryMemory(store, at, contract, wordBase, result.filter(m => ['state', 'knowledge'].includes(m.kind) && m.visibility !== 'validator_only').map(m => m.source.key))];
}
/** Preparation is a disk checkpoint, not model-execution permission or acceptance. */
export function prepareScene(root: string, address: SceneAddress, rawSetup: unknown, expectedSourceHash: string): Preparation {
  const setup = checked(SceneSetupSchema, rawSetup, 'scene setup'), settings = managedProject(root);
  if (!settings?.enabled) throw new Error('Enable managed writing through an explicit migration first');
  if (!setup.transmissionApproved) throw new Error('Scene source transmission was not approved');
  validateContract(setup.contract); validateVoice(setup.voice); validateGeneration(setup.generation ?? defaultGeneration());
  if (setup.contract.sceneId !== address.id || setup.contract.condition.narrativeIndex !== address.narrativeIndex) throw new Error('Contract scene identity or reading position differs');
  if (setup.minWords > setup.maxWords) throw new Error('Scene length range is reversed');
  const originalRaw = ensureScene(root, address), originalHash = proseHash(proseBody(originalRaw));
  if (originalHash !== checked(Hash, expectedSourceHash)) throw new Error('Source changed before preparation');
  const store = LiteraryStore.open(root), at = store.head();
  if (store.projectId !== settings.projectId) throw new Error('Project/store identity mismatch');
  if (store.stale([...setup.required, ...setup.contract.entryState], at).length) throw new Error('Required state is not current accepted evidence');
  const acceptedVoice = store.get(`voice:${setup.voice.id}`, at);
  if (acceptedVoice && objectHash(acceptedVoice.payload) !== objectHash(setup.voice)) throw new Error('Voice differs from accepted controls; record its design change first');
  if (!acceptedVoice && (setup.voice.calibration.status === 'human_reviewed' || setup.voice.variationBudgets.some(b => b.calibration === 'human_calibrated') || setup.voice.epochs.some(e => e.approved))) throw new Error('Human calibration and approved evolution require an accepted design record');
  if (acceptedVoice && store.stale([{ key: `voice:${setup.voice.id}`, hash: at.snapshot.versions[`voice:${setup.voice.id}`] }], at).length) throw new Error('Voice evidence requires reassessment');
  const resolve = resolver(store, at, address.id, [proseBody(originalRaw)]);
  checkEvidence(setup.contract.protected.flatMap(p => p.spans), resolve);
  for (const a of setup.anchors) { if (a.sourceSpan) checkEvidence([a.sourceSpan], resolve); if (store.stale(a.sourceRecords, at).length) throw new Error('Anchor evidence is stale'); }
  const p: Preparation = { schemaVersion: 1, id: newId(), projectId: store.projectId, address, setup, originalRaw, originalHash, expectedHead: at.hash, settingsHash: objectHash(settings) };
  const ref = store.put('preparation', p.id, checked(PreparationSchema, p));
  new JobStore(root, store.projectId).create(address.id, ref.hash, setup.budget, p.id);
  savePipeline(root, { schemaVersion: 1, jobId: p.id, preparationHash: ref.hash, body: proseBody(originalRaw), activeContract: structuredClone(setup.contract), stage: setup.mode === 'review_existing' ? 'review' : 'sketch', units: 0, sketch: null, records: [], revisionHistory: [], final: null, reason: null });
  return p;
}
export function getPreparation(root: string, id: string): Preparation {
  const s = readPipeline(root, id), store = LiteraryStore.open(root), artifact = store.artifact(s.preparationHash);
  if (artifact.id !== id || artifact.kind !== 'preparation') throw new Error('Wrong preparation identity');
  const p = checked(PreparationSchema, artifact.payload);
  if (p.projectId !== store.projectId || p.id !== id) throw new Error('Preparation project mismatch'); return p;
}
export async function runScene(root: string, id: string, host: WorkerHost, permit: WorkerPermit, signal?: AbortSignal): Promise<PipelineState> {
  return withExecution(root, id, () => runSceneUnlocked(root, id, host, permit, signal));
}
async function runSceneUnlocked(root: string, id: string, host: WorkerHost, permit: WorkerPermit, signal?: AbortSignal): Promise<PipelineState> {
  const store = LiteraryStore.open(root), jobs = new JobStore(root, store.projectId), p = getPreparation(root, id), s = readPipeline(root, id);
  const settings = managedProject(root)!;
  if (permit.runId !== id || permit.projectId !== p.projectId || !permit.active()) throw new Error('Scene execution is not authorized');
  if (s.stage === 'accepted' || s.stage === 'ready') return s;
  if (s.stage === 'blocked') throw new Error('Inspect the failed candidate and prepare a new branch after repairing its controls');
  const at = store.head();
  const fresh = () => {
    signal?.throwIfAborted();
    if (!permit.active() || objectHash(managedProject(root)) !== p.settingsHash) throw new Error('Scene authority or project settings changed');
    if (store.head().hash !== p.expectedHead || ensureScene(root, p.address) !== p.originalRaw) throw new Error('Source or accepted dependencies changed; prepare a new scene job');
  };
  fresh();
  if (jobs.read(id).reservations.some(r => r.status === 'pending')) throw new Error('Interrupted reservation requires explicit inspection');
  let contract = validateContract(structuredClone(s.activeContract));
  const generation = validateGeneration(p.setup.generation ?? defaultGeneration());
  let risks = generation.riskPatternIds;
  let voice = compileVoice(p.setup.voice, contract.condition, p.setup.anchors, { maxTokens: 2400, risks });
  const memories = acceptedMemory(store, at, contract), allBodies = [proseBody(p.originalRaw), s.body];
  const call = async <S extends TSchema>(task: WorkerFunction, schema: S, body: string, instruction: unknown): Promise<Static<S>> => {
    fresh(); const model = host.model; if (!model) throw new Error('No model selected');
    const maxOutput = Math.min(model.maxTokens, 10000), prompt = workerPrompt(task, schema);
    const packet = task === 'read' ? evidencePacket(p.projectId, p.address.id, 'critic', { role: 'critic', sceneId: p.address.id, localProse: body, textHash: proseHash(body), task: 'prose_first_reconstruction' }, [], { modelWindow: model.contextWindow, outputReserve: maxOutput, hostTokens: estimateTokens(prompt), safetyReserve: 1024, maxInputTokens: 48000 }) : composeContext({ projectId: p.projectId, role: roleFor(task), contract, voice, localProse: body, nextMove: canonicalJson(instruction), participantIds: p.setup.participantIds,
      required: p.setup.required, controlSources: [], currentVersions: at.snapshot.versions,
      budget: { modelWindow: model.contextWindow, outputReserve: maxOutput, hostTokens: estimateTokens(prompt), safetyReserve: 1024, maxInputTokens: 48000 } }, memories);
    const reserved = jobs.reserve(id, packet.hash, estimateTokens(prompt + packet.text) + maxOutput, permit);
    let record: SourceRef;
    try {
      const result = await runWorker(host, permit, { task, packet, outputSchema: schema, maxOutputTokens: maxOutput, timeoutMs: 180000, ...(signal ? { signal } : {}) });
      record = store.put('model_call', result.call.id, { call: result.call, packet, output: result.rawText }, [], id);
      jobs.settle(id, reserved, result.call, record.hash); s.records.push(record); savePipeline(root, s); fresh();
      return result.value;
    } catch (e) {
      if (e instanceof WorkerFailure) { record = store.put('model_call', e.call.id, { call: e.call, packet, output: e.rawText }, [], id); jobs.settle(id, reserved, e.call, record.hash); s.records.push(record); savePipeline(root, s); }
      throw e;
    }
  };
  try {
    if (s.stage === 'sketch') {
      s.sketch = await call('sketch', SketchSchema, s.body, { task: 'Plan the next scene without polished prose', lengthRange: [p.setup.minWords, p.setup.maxWords], riskWatch: risks, instruction: 'Forecast up to five relevant risk IDs, not a blacklist. Do not write polished prose.' });
      const forecast = checked(SketchSchema, s.sketch);
      forecast.riskPatternIds.forEach(id => { if (!patterns.some(p => p.id === id)) throw new Error('Unknown forecast pattern'); });
      risks = [...new Set([...risks, ...forecast.riskPatternIds])].slice(0, 5);
      voice = compileVoice(p.setup.voice, contract.condition, p.setup.anchors, { maxTokens: 2400, risks });
      s.stage = 'draft'; savePipeline(root, s);
    }
    if (s.stage === 'draft' && s.sketch) { const forecast = checked(SketchSchema, s.sketch); risks = [...new Set([...generation.riskPatternIds, ...forecast.riskPatternIds])].slice(0, 5); voice = compileVoice(p.setup.voice, contract.condition, p.setup.anchors, { maxTokens: 2400, risks }); }
    while (s.stage === 'draft') {
      if (s.units >= p.setup.maxUnits || wordTokens(s.body).length >= p.setup.maxWords) throw new Error('Draft stopped without a completed bounded scene');
      const remaining = p.setup.maxWords - wordTokens(s.body).length;
      const requested = candidateStrategies(generation, risks, s.units);
      const strategies = requested.length ? requested : ['scene-appropriate continuation'];
      const candidates: { prose: string; done: boolean; uncertainties: string[]; strategy: string }[] = [];
      for (const strategy of strategies) {
        const candidate = await call('draft', DraftSchema, s.body, { sketch: s.sketch, riskWatch: risks, strategy, appendOnly: true, maximumWords: Math.min(remaining, p.setup.unitMaxWords), minimumSceneWords: p.setup.minWords, unit: s.units, instruction: 'Return only NEW prose. Strategy is a functional option, not a demand for an unnatural device. Do not repeat existing prose. done=true only at a permitted exit.' });
        validateDraftUnit(candidate.prose, s.body, Math.min(remaining, p.setup.unitMaxWords));
        candidates.push({ ...candidate, strategy });
        s.records.push(store.put('alternative', newId(), { sceneId: p.address.id, unit: s.units, ...candidate, strategy }, [], id)); savePipeline(root, s);
      }
      let selected = 0;
      if (candidates.length > 1) {
        const choice = await call('select', SelectionSchema, s.body, { candidates, instruction: 'Compare function, voice, information permissions and risk. Do not combine alternatives or reward polish for its own sake.' });
        selected = selectCandidate(choice, candidates);
        s.records.push(store.put('selection', newId(), { unit: s.units, choice, candidates }, [], id));
      }
      const out = candidates[selected];
      const beforeAppendHash = proseHash(s.body);
      s.body = s.body + (s.body && !s.body.endsWith('\n\n') ? '\n\n' : '') + out.prose.trim(); s.units++; allBodies.push(s.body);
      for (const property of contract.protected) if (property.kind === 'exact_text') for (const span of property.spans) if (span.sceneId === p.address.id && span.textHash === beforeAppendHash) span.textHash = proseHash(s.body);
      s.activeContract = contract;
      s.records.push(store.put('candidate', newId(), { sceneId: p.address.id, body: s.body, uncertainty: out.uncertainties }, [], id));
      if (out.done) { if (wordTokens(s.body).length < p.setup.minWords) throw new Error('Scene completed below its requested range'); s.stage = 'review'; }
      savePipeline(root, s);
    }
    let final: FinalReview | undefined;
    while (s.stage === 'review') {
      const resolve = resolver(store, at, p.address.id, allBodies.concat(s.body));
      const proseRead = await call('read', ProseReadSchema, s.body, {});
      checkEvidence(proseRead.evidence, resolve);
      if (proseRead.evidence.some(e => e.sceneId !== p.address.id || e.textHash !== proseHash(s.body))) throw new Error('Cold reconstruction must cite only this prose');
      const registryOptions = Object.entries(at.snapshot.versions).filter(([key]) => /^(promise|motif|affordance):/.test(key) && !store.stale([{ key, hash: at.snapshot.versions[key] }], at).length).map(([key, hash]) => ({ key, payload: store.artifact(hash).payload }));
      const extraction = await call('extract', ExtractionSchema, s.body, { registryOptions, textHash: proseHash(s.body), instruction: 'Propose only states established by THIS scene. No author_design records. Every proposal requires exact current-scene evidence. IDs must be new; supersedes identifies earlier records. Keep all epistemic distinctions.' });
      if (new Set(extraction.propositions.map(x => x.id)).size !== extraction.propositions.length) throw new Error('Extractor repeated a state ID');
      for (const delta of extraction.propositions) {
        if (delta.sourceType === 'author_design' || at.snapshot.versions[`proposition:${delta.id}`]) throw new Error('Extractor cannot claim author authority or overwrite an existing state ID');
        if (!delta.evidence.some(e => e.sceneId === p.address.id && e.textHash === proseHash(s.body))) throw new Error('Extracted state has no current prose evidence');
        if (store.stale(delta.sourceRecords, at).length) throw new Error('Extracted state uses stale dependencies');
        checkEvidence(delta.evidence, resolve);
      }
      const registry = checked(RegistryDeltaSchema, extraction.registry ?? emptyDelta());
      applyRegistryDelta(store, at, registry, contract, s.body);
      const diagnostics = validateDiagnostics(await call('diagnose', DiagnosticReportSchema, s.body, { textHash: proseHash(s.body), patterns: cardsFor(), assessmentRules: 'Cards require context and displaced work. Long-range claims require available history; report missing coverage. Never diagnose by title alone or treat a cause candidate as established.', observations: observeSurface(s.body), overlapScreen: anchorOverlaps(s.body, p.setup.anchors.map(a => ({ id: a.id, text: a.excerpt }))) }), s.body, p.address.id, resolve);
      if (!diagnostics.assessedPatternIds.length) throw new Error('Diagnostic assessment coverage is empty');
      const validation = validateSceneReview(await call('validate', ValidationSchema, s.body, { textHash: proseHash(s.body), proseFirstReconstruction: proseRead, registryProposals: registry, registryOptions, stateProposals: extraction.propositions, extractionUncertainty: extraction.uncertainties, instruction: 'Review each state proposal exactly once. Interpret source evidence rather than trusting extractor labels. Originality is limited to available comparison sources; report that limitation.' }), s.body, contract, resolve);
      const registryIds = registryEventIds(registry), registryDecisions = validation.registryDecisions ?? [];
      if (new Set(registryDecisions.map(d => d.id)).size !== registryIds.length || registryDecisions.length !== registryIds.length || registryDecisions.some(d => !registryIds.includes(d.id) || d.outcome === 'uncertain')) throw new Error('Registry decision coverage is incomplete or uncertain');
      const verifiedRegistry: RegistryDelta = { promises: registry.promises.filter(x => registryDecisions.some(d => d.id === x.event.id && d.outcome === 'verified')), motifs: registry.motifs.filter(x => registryDecisions.some(d => d.id === x.event.id && d.outcome === 'verified')), affordances: registry.affordances.filter(x => registryDecisions.some(d => d.id === x.use.id && d.outcome === 'verified')) };
      if (validation.stateDecisions.length !== extraction.propositions.length || validation.stateDecisions.some(d => !extraction.propositions.some(p => p.id === d.id))) throw new Error('State decision coverage is incomplete');
      if (validation.stateDecisions.some(d => d.outcome === 'uncertain')) throw new Error('Unresolved extracted state requires review');
      const propositions = extraction.propositions.filter(x => validation.stateDecisions.find(d => d.id === x.id)!.outcome === 'verified').map(delta => validateProposition({ ...delta, validation: 'verified', review: { actor: 'model', rationale: validation.stateDecisions.find(d => d.id === delta.id)!.rationale } }, resolve));
      const prior = Object.entries(at.snapshot.versions).filter(([k]) => k.startsWith('proposition:')).map(([, h]) => store.artifact(h).payload as Proposition);
      validateStateLinks([...prior, ...propositions]);
      if (apparentConflicts([...prior, ...propositions]).some(c => propositions.some(p => p.id === c.left || p.id === c.right))) throw new Error('Apparent state conflict requires explicit control repair before acceptance');
      const gate = sceneGate(s.body, contract, validation, diagnostics, settings.governance);
      final = { proseRead, diagnostics, validation, propositions, registry: verifiedRegistry, gate }; s.final = final;
      s.records.push(store.put('review', newId(), { bodyHash: proseHash(s.body), ...final }, [], id)); savePipeline(root, s);
      if (['ACCEPT', 'ACCEPT_WITH_FLAGS', 'HUMAN_REVIEW'].includes(gate.decision)) { s.stage = 'ready'; break; }
      const plan = planRevisions(diagnostics), history = s.revisionHistory as RevisionRecord[];
      if (plan.controlRepairs.length || !plan.tasks.length || history.length >= p.setup.budget.maxRevisions) { s.stage = 'blocked'; s.reason = 'Gate requires control repair or exhausted targeted revisions'; break; }
      const task = plan.tasks[0], cause = diagnostics.findings.filter(f => task.diagnosisIds.includes(f.id)).map(f => f.patternId + ':' + f.cause.level).sort().join(',');
      if (recoveryLimit(history, cause)) { s.stage = 'blocked'; s.reason = 'Revision oscillation or repeated failure'; break; }
      const proposal = await call('revise', RevisionProposalSchema, s.body, { task, findings: diagnostics.findings.filter(f => task.diagnosisIds.includes(f.id)), patternCards: cardsFor(diagnostics.findings.filter(f => task.diagnosisIds.includes(f.id)).map(f => f.patternId)), sourceHash: proseHash(s.body) });
      const applied = applyRevision(s.body, proposal, task, contract, resolve);
      if (applied.body === s.body) { s.stage = 'blocked'; s.reason = 'Editor kept the source; gate still needs repair'; break; }
      const candidateFirst = Number.parseInt(hashText(newId()).slice(0, 2), 16) % 2 === 0;
      const choices = candidateFirst ? [applied.body, s.body] : [s.body, applied.body];
      const blind = await call('compare', BlindComparisonSchema, '', { versions: choices.map((body, i) => ({ label: i === 0 ? 'A' : 'B', body, textHash: proseHash(body) })), diagnosis: diagnostics.findings.filter(f => task.diagnosisIds.includes(f.id)), instruction: 'Version order is randomized. Return preference by A/B, not assumptions about which is revised.' });
      const preferred = blind.preferred === 'tie' ? 'tie' : (blind.preferred === 'A') === candidateFirst ? 'candidate' : 'source';
      const comparison = { ...blind, sourceHash: applied.sourceHash, candidateHash: applied.hash, preferred };
      if (store.stale(comparison.dependencies, at).length) throw new Error('Revision comparison has stale dependencies');
      const accept = acceptRevision(comparison, applied, contract, resolver(store, at, p.address.id, [...allBodies, s.body, applied.body]));
      s.revisionHistory.push({ sourceHash: applied.sourceHash, candidateHash: applied.hash, cause, pass: task.pass, accepted: accept.accept });
      s.records.push(store.put('revision', newId(), { proposal, comparison, source: s.body, candidate: applied.body, accept }, [], id));
      if (!accept.accept) { s.stage = 'blocked'; s.reason = 'Revision did not preserve all required properties or improve the target'; break; }
      // Exact span locations are carried through the verified patch transform,
      // never relocated by a fuzzy search. The rebase is retained in the ledger.
      const patches = [...proposal.patches].sort((a, b) => a.start - b.start);
      contract = structuredClone(contract);
      for (const property of contract.protected) for (const span of property.spans) if (property.kind === 'exact_text' && span.sceneId === p.address.id && span.textHash === applied.sourceHash) {
        const shift = patches.filter(x => x.end <= span.start).reduce((n, x) => n + x.replacement.length - (x.end - x.start), 0);
        span.start += shift; span.end += shift; span.textHash = applied.hash;
      }
      s.body = applied.body; s.activeContract = contract; allBodies.push(s.body); savePipeline(root, s);
    }
    // Save the final contract alongside the assessment, including logged exact-span rebases.
    if (final) s.final = { ...final, contract };
    jobs.update(id, j => { j.next = s.stage; j.status = s.stage === 'blocked' ? 'blocked' : 'paused'; j.reason = s.reason; });
    savePipeline(root, s); return s;
  } catch (error) {
    s.reason = (error instanceof Error ? error.message : 'Scene pipeline failed').slice(0, 160);
    // On provider cancellation, preserve the last completed stage for an explicit resume.
    if (!(error instanceof WorkerFailure) || error.call.status !== 'cancelled') s.stage = 'blocked';
    jobs.update(id, j => { j.status = signal?.aborted || !permit.active() ? 'paused' : 'blocked'; j.reason = s.reason; });
    savePipeline(root, s); throw error;
  }
}
/** Revalidate persisted evidence at the commit boundary. The caller supplies
 * human authority only following an explicit UI/command action, never model JSON. */
export function acceptScene(root: string, id: string, permit: WorkerPermit, actor: 'model' | 'human' = 'model'): { head: string; projected: boolean; warning: string | null } {
  const store = LiteraryStore.open(root), p = getPreparation(root, id), s = readPipeline(root, id), settings = managedProject(root)!;
  if (!permit.active() || permit.projectId !== store.projectId || permit.runId !== id) throw new Error('Scene acceptance is not authorized');
  const accepted = store.get(`acceptance:${p.address.id}`);
  if (s.stage === 'accepted' || accepted && (accepted.payload as { preparationHash?: string }).preparationHash === s.preparationHash) {
    s.stage = 'accepted'; savePipeline(root, s);
    new JobStore(root, store.projectId).update(id, j => { j.status = 'accepted'; j.acceptedHead = store.head().hash; j.next = 'complete'; });
    return { head: store.head().hash, projected: false, warning: 'Already accepted; no working-file replay' };
  }
  if (s.stage !== 'ready' || !s.final) throw new Error('Scene is not ready for acceptance');
  const at = store.head();
  if (at.hash !== p.expectedHead || ensureScene(root, p.address) !== p.originalRaw || objectHash(settings) !== p.settingsHash) throw new Error('Source, accepted state or governance changed');
  const final = s.final as FinalReview & { contract: SceneContract }, contract = validateContract(final.contract);
  const resolve = resolver(store, at, p.address.id, [s.body, proseBody(p.originalRaw)]);
  checked(ProseReadSchema, final.proseRead, 'prose-first reconstruction'); checkEvidence(final.proseRead.evidence, resolve);
  const diagnostics = validateDiagnostics(final.diagnostics, s.body, p.address.id, resolve);
  const review = validateSceneReview(final.validation, s.body, contract, resolve);
  const gate = sceneGate(s.body, contract, review, diagnostics, actor === 'human' ? 'delegated' : settings.governance);
  if (!['ACCEPT', 'ACCEPT_WITH_FLAGS'].includes(gate.decision) && !(actor === 'human' && gate.decision === 'HUMAN_REVIEW')) throw new Error(`Scene gate requires ${gate.decision}`);
  const count = wordTokens(s.body).length; if (count < p.setup.minWords || count > p.setup.maxWords) throw new Error('Accepted scene is outside the requested length range');
  const propositions = final.propositions.map(p => validateProposition(p, resolve));
  if (propositions.some(p => !review.stateDecisions.some(d => d.id === p.id && d.outcome === 'verified'))) throw new Error('State acceptance lacks validation');
  const prior = Object.entries(at.snapshot.versions).filter(([k]) => k.startsWith('proposition:')).map(([, h]) => store.artifact(h).payload as Proposition);
  validateStateLinks([...prior, ...propositions]);
  if (propositions.some(p => store.stale(p.sourceRecords, at).length)) throw new Error('State source dependencies changed');
  if (apparentConflicts([...prior, ...propositions]).some(c => propositions.some(p => p.id === c.left || p.id === c.right))) throw new Error('State conflict requires repair');
  const prose = store.put('prose', p.address.id, { address: p.address, body: s.body, textHash: proseHash(s.body), condition: contract.condition, transmissionApproved: true }, [], id);
  const registry = checked(RegistryDeltaSchema, final.registry ?? emptyDelta());
  if (registryEventIds(registry).some(id => !(review.registryDecisions ?? []).some(d => d.id === id && d.outcome === 'verified'))) throw new Error('Registry acceptance lacks validation');
  // Dependency binding uses the actual read set. Mutable registry aggregates
  // are expanded to their evidence instead of making every new occurrence
  // invalidate earlier scenes merely because the aggregate grew.
  const consumed = new Map<string, SourceRef>();
  const remember = (r: SourceRef, depth = 0) => {
    if (depth > 512) throw new Error('Evidence dependency depth exceeded');
    if (r.key === prose.key) return;
    if (/^(promise|motif|affordance):/.test(r.key)) { store.artifact(r.hash).sources.forEach(s => remember(s, depth + 1)); return; }
    consumed.set(r.key, r);
  };
  [...p.setup.required, ...contract.entryState].forEach(r => remember(r));
  for (const ref of s.records.filter(r => r.key.startsWith('model_call:'))) {
    const record = store.artifact(ref.hash).payload as { packet: ContextPacket };
    record.packet.receipt.dependencies.forEach(r => remember(r));
  }
  const controls = store.get(`voice:${p.setup.voice.id}`, at);
  const voiceRef = controls ? { key: `voice:${p.setup.voice.id}`, hash: at.snapshot.versions[`voice:${p.setup.voice.id}`] } : store.put('voice', p.setup.voice.id, p.setup.voice, [], id);
  consumed.set(voiceRef.key, voiceRef);
  const dependencies = [...consumed.values()];
  const validationRef = store.put('validation', p.address.id, { ...review, proseFirstRead: final.proseRead }, [prose, ...dependencies], id);
  const diagnosticsRef = store.put('diagnostics', p.address.id, diagnostics, [prose, ...dependencies], id);
  const registryChanges = applyRegistryDelta(store, at, registry, contract, s.body).map(u => store.put(u.kind, u.id, u.payload, [...u.dependencies.filter(r => ![prose.key, validationRef.key].includes(r.key)), prose, validationRef], id));
  const changes = [prose, ...registryChanges, validationRef, diagnosticsRef,
    store.put('contract', p.address.id, contract, dependencies.filter(r => r.key !== `voice:${p.setup.voice.id}`), id),
    // Existing accepted voice versions remain frozen instead of being silently
    // rewritten by every scene. First-use uncalibrated designs are recorded.
    ...(!controls ? [voiceRef] : []),
    store.put('summary', p.address.id, { body: final.proseRead.reconstruction, sourceHash: proseHash(s.body), assessment: 'model_summary_not_factual_certification' }, [prose, validationRef], id),
    store.put('observation', p.address.id, { condition: contract.condition, avsHash: objectHash(p.setup.voice), surface: observeSurface(s.body), runtime: process.version }, [prose], id),
    store.put('acceptance', p.address.id, { gate, actor, humanLiteraryEvaluation: 'not_performed', sourcePolicy: p.setup.sourcePolicy, preparationHash: s.preparationHash, recordRefs: s.records, revisionHistory: s.revisionHistory }, [prose, validationRef, diagnosticsRef], id),
    ...propositions.map(p => store.put('proposition', p.id, p, [prose, validationRef, ...p.sourceRecords], id)),
  ];
  const committed = store.commit({ expectedHead: p.expectedHead, requestId: `scene-${id}`, changes, dependencies: [...p.setup.required, ...p.setup.contract.entryState] });
  // Accepted snapshot is authoritative; Markdown is a recoverable projection.
  // Recheck exact source bytes so an external edit is never silently replaced.
  let projected = false, warning: string | null = committed.durabilityWarning || null;
  if (!committed.replayed && fs.readFileSync(projectPath(root, p.address.path), 'utf8') === p.originalRaw) {
    const prefix = p.originalRaw.slice(0, p.originalRaw.length - proseBody(p.originalRaw).length);
    try { writeExact(projectPath(root, p.address.path), prefix + s.body); projected = true; }
    catch { warning = 'Accepted snapshot saved; Markdown projection failed. Export the accepted snapshot before repairing the working file.'; }
  } else warning = 'Accepted snapshot saved; working file changed and was not overwritten';
  s.stage = 'accepted'; savePipeline(root, s);
  new JobStore(root, store.projectId).update(id, j => { j.status = 'accepted'; j.acceptedHead = committed.hash; j.next = 'complete'; });
  return { head: committed.hash, projected, warning };
}
