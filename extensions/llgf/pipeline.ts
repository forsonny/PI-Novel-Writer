import fs from 'node:fs';
import { Type, type Static, type TSchema } from 'typebox';
import { Strict, Id, Hash, Nonempty, Short, Sources, strings, checked, type SourceRef } from './schema.ts';
import { SceneContractSchema, PropositionSchema, validateContract, validateProposition, checkEvidence, apparentConflicts, type Proposition, type SceneContract, type TextResolver } from './narrative.ts';
import { AVSSchema, AnchorSchema, compileVoice, validateVoice, estimateTokens, type Anchor } from './voice.ts';
import { composeContext, type ContextPacket, type MemoryItem } from './context.ts';
import { DiagnosticReportSchema, validateDiagnostics, observeSurface, anchorOverlaps, wordTokens, type DiagnosticReport } from './diagnostics.ts';
import { RevisionProposalSchema, ComparisonSchema, planRevisions, applyRevision, acceptRevision, recoveryLimit, type RevisionRecord } from './revision.ts';
import { ValidationSchema, validateSceneReview, sceneGate, type GateResult, type SceneValidation } from './gates.ts';
import { JobStore, BudgetSchema } from './jobs.ts';
import { LiteraryStore, type SnapshotRef } from './store.ts';
import { runWorker, workerPrompt, roleFor, WorkerFailure, type WorkerHost, type WorkerPermit, type WorkerFunction } from './workers.ts';
import { managedProject } from './migration.ts';
import { projectPath } from '../utils/safety.ts';
import { writeExact } from './io.ts';
import { canonicalJson, newId, objectHash, proseHash, hashText } from './version.ts';
import { patterns } from './taxonomy.ts';

export const SceneAddressSchema = Strict({ id: Id, path: Nonempty, chapter: Type.Integer({ minimum: 1 }), scene: Type.Integer({ minimum: 1 }), order: Type.Number(), narrativeIndex: Type.Integer({ minimum: 0 }) });
export type SceneAddress = Static<typeof SceneAddressSchema>;
export const SceneSetupSchema = Strict({ schemaVersion: Type.Literal(1), contract: SceneContractSchema, voice: AVSSchema,
  anchors: Type.Array(AnchorSchema, { maxItems: 100 }), required: Sources, participantIds: Type.Array(Id, { maxItems: 100 }),
  minWords: Type.Integer({ minimum: 1, maximum: 20000 }), maxWords: Type.Integer({ minimum: 1, maximum: 20000 }),
  unitMaxWords: Type.Integer({ minimum: 20, maximum: 2000 }), maxUnits: Type.Integer({ minimum: 1, maximum: 100 }),
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
const SketchSchema = Strict({ moves: Type.Array(Nonempty, { minItems: 1, maxItems: 20 }), rationale: Nonempty, riskPatternIds: Type.Array(Short, { maxItems: 5 }) });
const DraftSchema = Strict({ prose: Type.String({ minLength: 1, maxLength: 20000 }), done: Type.Boolean(), uncertainties: strings() });
// The extractor proposes records. Only the validator and commit gateway can promote them.
const DeltaSchema = Type.Omit(PropositionSchema, ['validation', 'review']);
const ExtractionSchema = Strict({ propositions: Type.Array(DeltaSchema, { maxItems: 30 }), uncertainties: strings() });
const BlindComparisonSchema = Strict({ ...Type.Omit(ComparisonSchema, ['sourceHash', 'candidateHash', 'preferred']).properties,
  preferred: Type.Enum(['A', 'B', 'tie'] as const) });
interface FinalReview { diagnostics: DiagnosticReport; validation: SceneValidation; propositions: Proposition[]; gate: GateResult }
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
  const supersededIds = new Set(records.filter(x => x.a.kind === 'proposition').flatMap(x => checked(PropositionSchema, x.a.payload).supersedes));
  for (const { key, hash, a } of records) {
    let text: string, holderId: string | null, availableFrom: number | null, kind: MemoryItem['kind'], visibility: MemoryItem['visibility'];
    if (a.kind === 'prose') {
      const p = a.payload as { body: string; condition: SceneContract['condition']; transmissionApproved: boolean };
      if (!p.transmissionApproved || typeof p.body !== 'string' || !p.condition) continue;
      if (a.id === contract.sceneId) continue;
      text = p.body; holderId = p.condition.focalizerId; availableFrom = p.condition.narrativeIndex;
      kind = 'prose'; visibility = holderId === null ? 'validator_only' : 'focalizer';
    } else {
      const p = checked(PropositionSchema, a.payload); if (p.validation !== 'verified') continue;
      // Superseded records are history, not current knowledge.
      if (supersededIds.has(p.id)) continue;
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
  return result;
}
/** Preparation is a disk checkpoint, not model-execution permission or acceptance. */
export function prepareScene(root: string, address: SceneAddress, rawSetup: unknown, expectedSourceHash: string): Preparation {
  const setup = checked(SceneSetupSchema, rawSetup, 'scene setup'), settings = managedProject(root);
  if (!settings?.enabled) throw new Error('Enable managed writing through an explicit migration first');
  if (!setup.transmissionApproved) throw new Error('Scene source transmission was not approved');
  validateContract(setup.contract); validateVoice(setup.voice);
  if (setup.contract.sceneId !== address.id || setup.contract.condition.narrativeIndex !== address.narrativeIndex) throw new Error('Contract scene identity or reading position differs');
  if (setup.minWords > setup.maxWords) throw new Error('Scene length range is reversed');
  const originalRaw = ensureScene(root, address), originalHash = proseHash(proseBody(originalRaw));
  if (originalHash !== checked(Hash, expectedSourceHash)) throw new Error('Source changed before preparation');
  const store = LiteraryStore.open(root), at = store.head();
  if (store.projectId !== settings.projectId) throw new Error('Project/store identity mismatch');
  if (store.stale([...setup.required, ...setup.contract.entryState], at).length) throw new Error('Required state is not current accepted evidence');
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
  const voice = compileVoice(p.setup.voice, contract.condition, p.setup.anchors, { maxTokens: 2400 });
  const memories = acceptedMemory(store, at, contract), allBodies = [proseBody(p.originalRaw), s.body];
  const call = async <S extends TSchema>(task: WorkerFunction, schema: S, body: string, instruction: unknown): Promise<Static<S>> => {
    fresh(); const model = host.model; if (!model) throw new Error('No model selected');
    const maxOutput = Math.min(model.maxTokens, 10000), prompt = workerPrompt(task, schema);
    const packet = composeContext({ projectId: p.projectId, role: roleFor(task), contract, voice, localProse: body, nextMove: canonicalJson(instruction), participantIds: p.setup.participantIds,
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
      s.sketch = await call('sketch', SketchSchema, s.body, { task: 'Plan the next scene without polished prose', lengthRange: [p.setup.minWords, p.setup.maxWords], patterns });
      s.stage = 'draft'; savePipeline(root, s);
    }
    while (s.stage === 'draft') {
      if (s.units >= p.setup.maxUnits || wordTokens(s.body).length >= p.setup.maxWords) throw new Error('Draft stopped without a completed bounded scene');
      const remaining = p.setup.maxWords - wordTokens(s.body).length;
      const out = await call('draft', DraftSchema, s.body, { sketch: s.sketch, appendOnly: true, maximumWords: Math.min(remaining, p.setup.unitMaxWords), minimumSceneWords: p.setup.minWords, unit: s.units, instruction: 'Return only NEW prose in prose. Do not repeat the supplied body. done=true only at a permitted scene exit.' });
      if (wordTokens(out.prose).length > Math.min(remaining, p.setup.unitMaxWords) || !wordTokens(out.prose).length) throw new Error('Draft unit exceeds its requested word allowance');
      if (out.prose === s.body || s.body.length > 100 && out.prose.startsWith(s.body)) throw new Error('Draft duplicated the existing scene');
      s.body = [s.body.trimEnd(), out.prose.trim()].filter(Boolean).join('\n\n'); s.units++; allBodies.push(s.body);
      s.records.push(store.put('candidate', newId(), { sceneId: p.address.id, body: s.body, uncertainty: out.uncertainties }, [], id));
      if (out.done) { if (wordTokens(s.body).length < p.setup.minWords) throw new Error('Scene completed below its requested range'); s.stage = 'review'; }
      savePipeline(root, s);
    }
    let final: FinalReview | undefined;
    while (s.stage === 'review') {
      const resolve = resolver(store, at, p.address.id, allBodies.concat(s.body));
      const extraction = await call('extract', ExtractionSchema, s.body, { textHash: proseHash(s.body), instruction: 'Propose only states established by THIS scene. No author_design records. Every proposal requires exact current-scene evidence. IDs must be new; supersedes identifies earlier records. Keep all epistemic distinctions.' });
      if (new Set(extraction.propositions.map(x => x.id)).size !== extraction.propositions.length) throw new Error('Extractor repeated a state ID');
      for (const delta of extraction.propositions) {
        if (delta.sourceType === 'author_design' || at.snapshot.versions[`proposition:${delta.id}`]) throw new Error('Extractor cannot claim author authority or overwrite an existing state ID');
        if (!delta.evidence.some(e => e.sceneId === p.address.id && e.textHash === proseHash(s.body))) throw new Error('Extracted state has no current prose evidence');
        if (store.stale(delta.sourceRecords, at).length) throw new Error('Extracted state uses stale dependencies');
        checkEvidence(delta.evidence, resolve);
      }
      const diagnostics = validateDiagnostics(await call('diagnose', DiagnosticReportSchema, s.body, { textHash: proseHash(s.body), patterns, observations: observeSurface(s.body), overlapScreen: anchorOverlaps(s.body, p.setup.anchors.map(a => ({ id: a.id, text: a.excerpt }))) }), s.body, p.address.id, resolve);
      if (!diagnostics.assessedPatternIds.length) throw new Error('Diagnostic assessment coverage is empty');
      const validation = validateSceneReview(await call('validate', ValidationSchema, s.body, { textHash: proseHash(s.body), stateProposals: extraction.propositions, extractionUncertainty: extraction.uncertainties, instruction: 'Review each state proposal exactly once. Interpret source evidence rather than trusting extractor labels. Originality is limited to available comparison sources; report that limitation.' }), s.body, contract, resolve);
      if (validation.stateDecisions.length !== extraction.propositions.length || validation.stateDecisions.some(d => !extraction.propositions.some(p => p.id === d.id))) throw new Error('State decision coverage is incomplete');
      if (validation.stateDecisions.some(d => d.outcome === 'uncertain')) throw new Error('Unresolved extracted state requires review');
      const propositions = extraction.propositions.filter(x => validation.stateDecisions.find(d => d.id === x.id)!.outcome === 'verified').map(delta => validateProposition({ ...delta, validation: 'verified', review: { actor: 'model', rationale: validation.stateDecisions.find(d => d.id === delta.id)!.rationale } }, resolve));
      const prior = Object.entries(at.snapshot.versions).filter(([k]) => k.startsWith('proposition:')).map(([, h]) => store.artifact(h).payload as Proposition);
      if (apparentConflicts([...prior, ...propositions]).some(c => propositions.some(p => p.id === c.left || p.id === c.right))) throw new Error('Apparent state conflict requires explicit control repair before acceptance');
      const gate = sceneGate(s.body, contract, validation, diagnostics, settings.governance);
      final = { diagnostics, validation, propositions, gate }; s.final = final;
      s.records.push(store.put('review', newId(), { bodyHash: proseHash(s.body), ...final }, [], id)); savePipeline(root, s);
      if (['ACCEPT', 'ACCEPT_WITH_FLAGS', 'HUMAN_REVIEW'].includes(gate.decision)) { s.stage = 'ready'; break; }
      const plan = planRevisions(diagnostics), history = s.revisionHistory as RevisionRecord[];
      if (plan.controlRepairs.length || !plan.tasks.length || history.length >= p.setup.budget.maxRevisions) { s.stage = 'blocked'; s.reason = 'Gate requires control repair or exhausted targeted revisions'; break; }
      const task = plan.tasks[0], cause = task.diagnosisIds.join(',');
      if (recoveryLimit(history, cause)) { s.stage = 'blocked'; s.reason = 'Revision oscillation or repeated failure'; break; }
      const proposal = await call('revise', RevisionProposalSchema, s.body, { task, findings: diagnostics.findings.filter(f => task.diagnosisIds.includes(f.id)), sourceHash: proseHash(s.body) });
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
  const diagnostics = validateDiagnostics(final.diagnostics, s.body, p.address.id, resolve);
  const review = validateSceneReview(final.validation, s.body, contract, resolve);
  const gate = sceneGate(s.body, contract, review, diagnostics, actor === 'human' ? 'delegated' : settings.governance);
  if (!['ACCEPT', 'ACCEPT_WITH_FLAGS'].includes(gate.decision) && !(actor === 'human' && gate.decision === 'HUMAN_REVIEW')) throw new Error(`Scene gate requires ${gate.decision}`);
  const count = wordTokens(s.body).length; if (count < p.setup.minWords || count > p.setup.maxWords) throw new Error('Accepted scene is outside the requested length range');
  const propositions = final.propositions.map(p => validateProposition(p, resolve));
  if (propositions.some(p => !review.stateDecisions.some(d => d.id === p.id && d.outcome === 'verified'))) throw new Error('State acceptance lacks validation');
  const prose = store.put('prose', p.address.id, { address: p.address, body: s.body, textHash: proseHash(s.body), condition: contract.condition, transmissionApproved: true }, [], id);
  const changes = [prose,
    store.put('contract', p.address.id, contract, p.setup.required, id),
    store.put('voice', p.setup.voice.id, p.setup.voice, [], id),
    store.put('summary', p.address.id, { body: review.reconstruction, sourceHash: proseHash(s.body), assessment: 'model_summary_not_factual_certification' }, [prose], id),
    store.put('validation', p.address.id, review, [prose, ...p.setup.required], id),
    store.put('diagnostics', p.address.id, diagnostics, [prose], id),
    store.put('observation', p.address.id, { condition: contract.condition, avsHash: objectHash(p.setup.voice), surface: observeSurface(s.body), runtime: process.version }, [prose], id),
    store.put('acceptance', p.address.id, { gate, actor, humanLiteraryEvaluation: 'not_performed', sourcePolicy: p.setup.sourcePolicy, preparationHash: s.preparationHash, recordRefs: s.records, revisionHistory: s.revisionHistory }, [prose], id),
    ...propositions.map(p => store.put('proposition', p.id, p, [prose, ...p.sourceRecords], id)),
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
