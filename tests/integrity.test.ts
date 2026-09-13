import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LiteraryStore } from '../extensions/llgf/store.ts';
import { newId, proseHash } from '../extensions/llgf/version.ts';
import { validateStateLinks, type Proposition } from '../extensions/llgf/narrative.ts';
import { acceptedMemory, prepareScene, runScene } from '../extensions/llgf/pipeline.ts';
import { executionLock, withExecution, recoverExecution } from '../extensions/llgf/execution.ts';
import { pipelineFixture, mockPipelineHost } from './pipeline-helpers.ts';
import { projectFixture } from './helpers.ts';

test('source dependency changes invalidate derived facts and reviews transitively', () => {
  const f = projectFixture(); try {
    const s = LiteraryStore.initialize(f.root), p = s.put('prose', newId(), { body: 'Before' });
    const fact = s.put('proposition', newId(), { value: 'belief' }, [p]);
    const review = s.put('review', newId(), { result: 'reviewed' }, [fact]);
    s.commit({ expectedHead: s.head().hash, requestId: 'initial', changes: [review, fact, p], dependencies: [] });
    assert.deepEqual(s.stale([review]), []);
    const changed = s.put('prose', p.key.split(':')[1], { body: 'After' });
    s.commit({ expectedHead: s.head().hash, requestId: 'edit', changes: [changed], dependencies: [] });
    assert.deepEqual(s.stale([review]), [review]);
    const bad = s.put('review', newId(), { result: 'new review citing stale fact' }, [fact]);
    assert.throws(() => s.commit({ expectedHead: s.head().hash, requestId: 'bad', changes: [bad], dependencies: [] }), /stale source/);
    assert.deepEqual(s.stale([changed]), []);
  } finally { f.dispose(); }
});

test('state supersession cannot hide unrelated, missing or cyclic propositions', () => {
  const f = pipelineFixture(); try {
    const unknown = { earliest: null, latest: null, label: '' };
    const a: Proposition = { schemaVersion: 1, id: newId(), subjectId: newId(), predicate: 'door', value: 'closed', layer: 'world', status: 'hypothesis', holderId: null, acquisition: { eventId: null, at: unknown }, validTime: unknown, disclosedAt: 0, sourceType: 'narration', validation: 'proposed', confidence: 'low', evidence: [], sourceRecords: [], review: null, supersedes: [], conflictsWith: [] };
    const b = { ...a, id: newId(), supersedes: [a.id] };
    validateStateLinks([a, b]);
    assert.throws(() => validateStateLinks([b]), /unavailable/);
    assert.throws(() => validateStateLinks([a, { ...b, subjectId: newId() }]), /boundaries/);
    assert.throws(() => validateStateLinks([{ ...a, supersedes: [b.id] }, b]), /Cyclic/);
  } finally { f.dispose(); }
});

test('retrieval keeps an earlier belief when its supersession lies after the scene cutoff', () => {
  const f = pipelineFixture(); try {
    const holder = newId(), unknown = { earliest: null, latest: null, label: '' };
    const a: Proposition = { schemaVersion: 1, id: newId(), subjectId: newId(), predicate: 'door', value: 'closed', layer: 'character', status: 'viewpoint_belief', holderId: holder, acquisition: { eventId: newId(), at: { earliest: 1, latest: 1, label: '' } }, validTime: unknown, disclosedAt: 1, sourceType: 'dialogue', validation: 'verified', confidence: 'medium', evidence: [], sourceRecords: [], review: { actor: 'model', rationale: 'Belief record only' }, supersedes: [], conflictsWith: [] };
    const b = { ...a, id: newId(), value: 'open', acquisition: { eventId: newId(), at: { earliest: 8, latest: 8, label: '' } }, disclosedAt: 8, supersedes: [a.id] };
    const refs = [f.store.put('proposition', a.id, a), f.store.put('proposition', b.id, b)];
    f.store.commit({ expectedHead: f.store.head().hash, requestId: 'beliefs', changes: refs, dependencies: [] });
    const contract = structuredClone(f.setup.contract); contract.condition.focalizerId = holder; contract.condition.narrativeIndex = 3; contract.condition.storyTime = { earliest: 3, latest: 3, label: '' };
    const items = acceptedMemory(f.store, f.store.head(), contract);
    assert.deepEqual(items.map(x => x.id), [a.id]);
    const future = f.store.put('prose', newId(), { body: 'Future reveal', transmissionApproved: true, condition: { ...contract.condition, narrativeIndex: 9 } });
    f.store.commit({ expectedHead: f.store.head().hash, requestId: 'future', changes: [future], dependencies: [] });
    assert.equal(acceptedMemory(f.store, f.store.head(), contract).some(x => x.text.includes('Future reveal')), false);
  } finally { f.dispose(); }
});

test('per-job execution lease blocks overlap and refuses to steal live locks', async () => {
  const f = pipelineFixture(); try {
    const p = prepareScene(f.root, f.address, f.setup, proseHash(f.body));
    let release!: () => void; const wait = new Promise<void>(resolve => { release = resolve; });
    const running = withExecution(f.root, p.id, async () => { await wait; return 'done'; });
    const lock = executionLock(f.root, p.id)!; assert.equal(lock.pid, process.pid);
    await assert.rejects(withExecution(f.root, p.id, async () => 'overlap'), /already executing/);
    assert.throws(() => recoverExecution(f.root, p.id, newId()), /changed/);
    assert.throws(() => recoverExecution(f.root, p.id, lock.token), /still running/);
    release(); assert.equal(await running, 'done'); assert.equal(executionLock(f.root, p.id), null);
    await assert.rejects(withExecution(f.root, p.id, async () => { throw new Error('mock failure'); }), /mock failure/);
    assert.equal(executionLock(f.root, p.id), null);
  } finally { f.dispose(); }
});

test('continuation preserves the exact existing whitespace and consumes only one job lease', async () => {
  const f = pipelineFixture(); try {
    fs.appendFileSync(f.file, '  \n'); const original = f.body + '  \n'; f.setup.mode = 'continue';
    const p = prepareScene(f.root, f.address, f.setup, proseHash(original)), worker = mockPipelineHost(f.address.id);
    const auth = { projectId: f.store.projectId, runId: p.id, epoch: 1, model: 'mock', provider: 'fixture', active: () => true };
    const s = await runScene(f.root, p.id, worker.host, auth);
    assert.ok(s.body.startsWith(original)); assert.equal(s.stage, 'ready'); assert.equal(executionLock(f.root, p.id), null);
  } finally { f.dispose(); }
});
