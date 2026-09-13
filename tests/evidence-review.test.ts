import test from 'node:test';
import assert from 'node:assert/strict';
import { pipelineFixture, mockPipelineHost } from './pipeline-helpers.ts';
import { prepareScene, runScene, acceptScene, acceptedMemory } from '../extensions/llgf/pipeline.ts';
import { newId, proseHash } from '../extensions/llgf/version.ts';
import { saveDesign } from '../extensions/llgf/registry-service.ts';

test('cold reconstruction cannot see withheld contract details, voice or planning notes', async () => {
  const f = pipelineFixture(); try {
    f.setup.contract.prohibitions.push('Do not expose SECRET_FROM_PLAN_9417');
    const p = prepareScene(f.root, f.address, f.setup, proseHash(f.body)), mock = mockPipelineHost(f.address.id), permit = { projectId: f.store.projectId, runId: p.id, epoch: 1, provider: 'fixture', model: 'mock', active: () => true };
    const state = await runScene(f.root, p.id, mock.host, permit);
    const read = state.records.filter(r => r.key.startsWith('model_call:')).map(r => f.store.artifact(r.hash).payload as any).find(r => r.call.function === 'read');
    assert.ok(read); assert.equal(read.packet.text.includes('SECRET_FROM_PLAN_9417'), false);
    assert.equal(read.packet.text.includes('Unanswered waiting'), false);
    assert.equal(JSON.parse(read.packet.text).localProse, f.body);
  } finally { f.dispose(); }
});
test('changing accepted voice controls invalidates old acceptance without modifying prose', async () => {
  const f = pipelineFixture(); try {
    const p = prepareScene(f.root, f.address, f.setup, proseHash(f.body)), mock = mockPipelineHost(f.address.id), permit = { projectId: f.store.projectId, runId: p.id, epoch: 1, provider: 'fixture', model: 'mock', active: () => true };
    await runScene(f.root, p.id, mock.host, permit); acceptScene(f.root, p.id, permit);
    const key = `acceptance:${f.address.id}`, ref = { key, hash: f.store.head().snapshot.versions[key] };
    assert.deepEqual(f.store.stale([ref]), []);
    saveDesign(f.root, 'voice', { ...f.setup.voice, rationale: 'An author-approved revised target' }, f.store.head().hash, 'human');
    assert.deepEqual(f.store.stale([ref]), [ref]);
    assert.equal((f.store.get(`prose:${f.address.id}`)!.payload as { body: string }).body, f.body);
    const next = structuredClone(f.setup.contract); next.sceneId = newId(); next.condition.narrativeIndex = 1;
    assert.equal(acceptedMemory(f.store, f.store.head(), next).some(m => m.id === f.address.id && m.kind === 'prose'), false);
  } finally { f.dispose(); }
});
test('append-only drafting rebases exact protected offsets without losing previous wording', async () => {
  const f = pipelineFixture(); try {
    f.setup.mode = 'continue'; f.setup.contract.protected.push({ id: newId(), kind: 'exact_text', requirement: 'Keep the opening', readings: [], method: 'model_assisted', spans: [{ sceneId: f.address.id, textHash: proseHash(f.body), start: 0, end: 10, quote: f.body.slice(0, 10), offsetUnit: 'utf16' }] });
    const p = prepareScene(f.root, f.address, f.setup, proseHash(f.body)), mock = mockPipelineHost(f.address.id), permit = { projectId: f.store.projectId, runId: p.id, epoch: 1, provider: 'fixture', model: 'mock', active: () => true };
    const s = await runScene(f.root, p.id, mock.host, permit);
    // The simple mock does not attest protection, so the gate may block; the
    // mechanical append transform still must retain and accurately locate it.
    assert.ok(s.body.startsWith(f.body)); assert.equal(s.activeContract.protected[0].spans[0].textHash, proseHash(s.body));
    assert.equal(s.activeContract.protected[0].spans[0].start, 0);
  } finally { f.dispose(); }
});
test('accepted reviews retain the evidence dependencies of selected voice anchors', async () => {
  const f = pipelineFixture(); try {
    const source = f.store.put('design', newId(), { rationale: 'Reference provenance' });
    f.store.commit({ expectedHead: f.store.head().hash, requestId: 'anchor-source', changes: [source], dependencies: [] });
    const anchorId = newId();
    f.setup.voice.anchorIds = [anchorId];
    f.setup.anchors = [{ schemaVersion: 1, id: anchorId, kind: 'anchor', function: 'Unresolved quiet',
      when: { focalizerIds: [], sceneFunctions: [], epochIds: [], pressures: [], distances: [] },
      excerpt: 'Only the dust moved.', sourceSpan: null, sourceRecords: [source], narrativeIndex: null,
      rights: { status: 'author_owned', basis: 'Test fixture', permitted: ['drafting', 'analysis'], livingAuthor: false, permissionRecorded: true },
      wordingPolicy: 'function_only' }];
    const p = prepareScene(f.root, f.address, f.setup, proseHash(f.body)), mock = mockPipelineHost(f.address.id);
    const permit = { projectId: f.store.projectId, runId: p.id, epoch: 1, provider: 'fixture', model: 'mock', active: () => true };
    const state = await runScene(f.root, p.id, mock.host, permit);
    assert.ok(state.records.filter(r => r.key.startsWith('model_call:')).some(r => JSON.stringify(f.store.artifact(r.hash).payload).includes('Only the dust moved.')));
    acceptScene(f.root, p.id, permit);
    const key = `acceptance:${f.address.id}`, ref = { key, hash: f.store.head().snapshot.versions[key] };
    assert.deepEqual(f.store.stale([ref]), []);
    const changed = f.store.put('design', source.key.split(':')[1], { rationale: 'Changed provenance' });
    f.store.commit({ expectedHead: f.store.head().hash, requestId: 'changed-anchor-source', changes: [changed], dependencies: [] });
    assert.deepEqual(f.store.stale([ref]), [ref]);
  } finally { f.dispose(); }
});
