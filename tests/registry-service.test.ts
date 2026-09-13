import test from 'node:test';
import assert from 'node:assert/strict';
import { saveDesign, applyRegistryDelta, emptyDelta, registryMemory } from '../extensions/llgf/registry-service.ts';
import { validatePlans, type NarrativePlan } from '../extensions/llgf/planning.ts';
import { newId, proseHash } from '../extensions/llgf/version.ts';
import { prepareScene, runScene, acceptScene } from '../extensions/llgf/pipeline.ts';
import { pipelineFixture, mockPipelineHost } from './pipeline-helpers.ts';
import type { NarrativePromise } from '../extensions/llgf/registries.ts';
import type { WorkerHost } from '../extensions/llgf/workers.ts';
const promise = (): NarrativePromise => ({ schemaVersion: 1, id: newId(), type: 'mystery', statement: 'Who waits behind the door?', salience: 2, characters: [], themes: [], eligibleCallbacks: [], transformations: [], resolutionWindow: { earliestIndex: null, latestIndex: null }, acceptableNonresolution: 'May remain unresolved.', dependencies: [], history: [] });
const plan = (): NarrativePlan => ({ schemaVersion: 1, id: newId(), level: 'novel', parentId: null, title: 'Waiting', purpose: 'Quiet uncertainty', order: 0, sceneIds: [], obligations: [], entryState: [], exitStateRange: ['Waiting continues'], openAlternatives: ['Leave', 'Wait'], protectedUnknowns: ['Identity'], endingConstraints: ['Identity remains unknown'], contrast: [], promiseIds: [], viewpointIds: [], informationBudget: 'Release only the lack of an answer', dependencies: [], changeReason: 'Initial author design' });

test('hierarchical plans retain alternatives and validate parents without forced conflict', () => {
  const a = plan(), b = { ...plan(), level: 'arc' as const, parentId: a.id };
  validatePlans([a, b]); assert.throws(() => validatePlans([b]), /parent/);
  assert.throws(() => validatePlans([{ ...a, sceneIds: [a.id, a.id] }]), /Duplicate scene/);
});

test('design edits retain immutable history and cannot masquerade as human calibration', () => {
  const f = pipelineFixture(); try {
    const p = promise(); const ref = saveDesign(f.root, 'promise', p, f.store.head().hash, 'model');
    assert.equal(f.store.get(ref.key)?.kind, 'promise');
    assert.equal(registryMemory(f.store, f.store.head(), f.setup.contract, 0).length, 0);
    const bad = { ...p, history: [{ id: newId(), action: 'abandon', position: { sceneId: f.address.id, narrativeIndex: 0, wordPosition: 0, ordinal: 0 }, rationale: 'Invented event', evidence: [], meaning: '' }] };
    assert.throws(() => saveDesign(f.root, 'promise', bad, f.store.head().hash, 'model'), /precedes|history/);
    const voice = structuredClone(f.setup.voice); voice.calibration = { status: 'human_reviewed', sampleIds: [], reviewRecords: [ref] };
    assert.throws(() => saveDesign(f.root, 'voice', voice, f.store.head().hash, 'model'), /human calibration/);
  } finally { f.dispose(); }
});

test('delegation cannot silently change an existing novel ending constraint', () => {
  const f = pipelineFixture(); try {
    const p = plan(); saveDesign(f.root, 'plan', p, f.store.head().hash, 'human');
    assert.throws(() => saveDesign(f.root, 'plan', { ...p, endingConstraints: ['Expose identity'] }, f.store.head().hash, 'model'), /author approval/);
    saveDesign(f.root, 'plan', { ...p, contrast: ['Allow quiet aftermath'] }, f.store.head().hash, 'model');
  } finally { f.dispose(); }
});

test('registry delta validation is provisional and bound to current-scene evidence', () => {
  const f = pipelineFixture(); try {
    const p = promise(); saveDesign(f.root, 'promise', p, f.store.head().hash, 'human');
    const delta = emptyDelta(); delta.promises.push({ id: p.id, event: { id: newId(), action: 'introduce', position: { sceneId: f.address.id, narrativeIndex: 0, wordPosition: 0, ordinal: 0 }, rationale: 'Unanswered door creates a question', evidence: [{ sceneId: f.address.id, textHash: proseHash(f.body), start: 0, end: f.body.length, quote: f.body, offsetUnit: 'utf16' }], meaning: '' } });
    const at = f.store.head(), updates = applyRegistryDelta(f.store, at, delta, f.setup.contract, f.body);
    assert.equal(updates.length, 1); assert.equal((f.store.get(`promise:${p.id}`)!.payload as NarrativePromise).history.length, 0);
    delta.promises[0].event.position.narrativeIndex = 9;
    assert.throws(() => applyRegistryDelta(f.store, at, delta, f.setup.contract, f.body), /wrong scene/);
  } finally { f.dispose(); }
});

test('scene extraction and independent validation commit a promise event with its prose', async () => {
  const f = pipelineFixture(); try {
    const p = promise(); saveDesign(f.root, 'promise', p, f.store.head().hash, 'human');
    const delta = emptyDelta(), eventId = newId();
    delta.promises.push({ id: p.id, event: { id: eventId, action: 'introduce', position: { sceneId: f.address.id, narrativeIndex: 0, wordPosition: 0, ordinal: 0 }, rationale: 'The unanswered door poses a question', evidence: [{ sceneId: f.address.id, textHash: proseHash(f.body), start: 0, end: f.body.length, quote: f.body, offsetUnit: 'utf16' }], meaning: '' } });
    const mock = mockPipelineHost(f.address.id), complete = mock.host.modelRegistry!.complete.bind(mock.host.modelRegistry);
    const host: WorkerHost = { ...mock.host, modelRegistry: { complete: async (...args) => {
      const response = await complete(...args), c = response.content[0];
      if (c.type !== 'text') throw new Error('Fixture text expected');
      const out = JSON.parse(c.text);
      if (args[1].systemPrompt?.includes('Extract proposed epistemic')) out.registry = delta;
      else if ('stateDecisions' in out) out.registryDecisions = [{ id: eventId, outcome: 'verified', rationale: 'Current evidence supports introduction, not resolution' }];
      return { ...response, content: [{ type: 'text', text: JSON.stringify(out) }] };
    } } as WorkerHost['modelRegistry'] };
    const preparation = prepareScene(f.root, f.address, f.setup, proseHash(f.body)), auth = { projectId: f.store.projectId, runId: preparation.id, epoch: 1, provider: 'fixture', model: 'mock', active: () => true };
    await runScene(f.root, preparation.id, host, auth); acceptScene(f.root, preparation.id, auth);
    const accepted = f.store.get(`promise:${p.id}`)!; assert.equal((accepted.payload as NarrativePromise).history[0].id, eventId);
    assert.ok(accepted.sources.some(r => r.key === `prose:${f.address.id}`));
    const later = structuredClone(f.setup.contract); later.condition.narrativeIndex = 1;
    assert.ok(registryMemory(f.store, f.store.head(), later, 10).some(m => m.id === p.id));
  } finally { f.dispose(); }
});

test('raw scene setup cannot bypass an accepted voice or fabricate approved calibration', () => {
  const f = pipelineFixture(); try {
    saveDesign(f.root, 'voice', f.setup.voice, f.store.head().hash, 'human');
    const changed = structuredClone(f.setup); changed.voice.rationale = 'Unrecorded replacement';
    assert.throws(() => prepareScene(f.root, f.address, changed, proseHash(f.body)), /design change/);
    changed.voice.id = newId(); changed.voice.calibration.status = 'human_reviewed'; changed.voice.calibration.reviewRecords = [{ key: `voice:${f.setup.voice.id}`, hash: f.store.head().snapshot.versions[`voice:${f.setup.voice.id}`] }];
    assert.throws(() => prepareScene(f.root, f.address, changed, proseHash(f.body)), /accepted design record/);
  } finally { f.dispose(); }
});
