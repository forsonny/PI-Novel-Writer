import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { AssistantMessage } from '@earendil-works/pi-ai';
import { projectFixture } from './helpers.ts';
import { prepareScene, runScene, acceptScene, readPipeline, type SceneSetup, type SceneAddress } from '../extensions/llgf/pipeline.ts';
import { newId, proseHash } from '../extensions/llgf/version.ts';
import { LiteraryStore } from '../extensions/llgf/store.ts';
import { validationDimensions } from '../extensions/llgf/gates.ts';
import { TAXONOMY_VERSION } from '../extensions/llgf/taxonomy.ts';
import type { WorkerHost, WorkerPermit } from '../extensions/llgf/workers.ts';

import { pipelineFixture, mockPipelineHost } from './pipeline-helpers.ts';

function permit(projectId: string, runId: string): WorkerPermit { return { projectId, runId, epoch: 1, model: 'mock', provider: 'fixture', active: () => true }; }

test('complete scene review commits prose, state evidence and provenance as one snapshot', async () => {
  const f = pipelineFixture(); try {
    const original = fs.readFileSync(f.file, 'utf8'), p = prepareScene(f.root, f.address, f.setup, proseHash(f.body)), worker = mockPipelineHost(f.address.id), auth = permit(f.store.projectId, p.id);
    const before = f.store.head().hash, s = await runScene(f.root, p.id, worker.host, auth);
    assert.equal(s.stage, 'ready'); assert.equal(worker.calls(), 4); assert.equal(f.store.head().hash, before); assert.equal(fs.readFileSync(f.file, 'utf8'), original);
    const result = acceptScene(f.root, p.id, auth); assert.equal(result.projected, true); assert.notEqual(result.head, before);
    for (const kind of ['prose', 'summary', 'validation', 'diagnostics', 'observation', 'acceptance']) assert.ok(f.store.get(`${kind}:${f.address.id}`));
    assert.equal(readPipeline(f.root, p.id).stage, 'accepted'); assert.equal(acceptScene(f.root, p.id, auth).projected, false);
    assert.ok(fs.readFileSync(f.file, 'utf8').includes('custom: "Keep this"'));
  } finally { f.dispose(); }
});
test('bounded continuation appends without replacing previous prose', async () => {
  const f = pipelineFixture(); try {
    f.setup.mode = 'continue'; const p = prepareScene(f.root, f.address, f.setup, proseHash(f.body)), worker = mockPipelineHost(f.address.id), auth = permit(f.store.projectId, p.id);
    const s = await runScene(f.root, p.id, worker.host, auth); assert.equal(s.stage, 'ready'); assert.ok(s.body.startsWith(f.body)); assert.equal(worker.calls(), 6);
    acceptScene(f.root, p.id, auth); assert.ok(fs.readFileSync(f.file, 'utf8').endsWith('A hinge creaked. She stayed.'));
  } finally { f.dispose(); }
});
test('failed information permission cannot be accepted and original working text survives', async () => {
  const f = pipelineFixture(); try {
    const original = fs.readFileSync(f.file, 'utf8'), p = prepareScene(f.root, f.address, f.setup, proseHash(f.body)), worker = mockPipelineHost(f.address.id, true), auth = permit(f.store.projectId, p.id), head = f.store.head().hash;
    const s = await runScene(f.root, p.id, worker.host, auth); assert.equal(s.stage, 'blocked'); assert.throws(() => acceptScene(f.root, p.id, auth), /not ready/);
    assert.equal(f.store.head().hash, head); assert.equal(fs.readFileSync(f.file, 'utf8'), original); assert.ok(s.records.length >= 3);
  } finally { f.dispose(); }
});
test('stale source, changed permissions and missing transmission approval deny execution', async () => {
  const f = pipelineFixture(); try {
    f.setup.transmissionApproved = false; assert.throws(() => prepareScene(f.root, f.address, f.setup, proseHash(f.body)), /transmission/); f.setup.transmissionApproved = true;
    const p = prepareScene(f.root, f.address, f.setup, proseHash(f.body)), worker = mockPipelineHost(f.address.id), auth = permit(f.store.projectId, p.id);
    await assert.rejects(runScene(f.root, p.id, worker.host, { ...auth, active: () => false }), /not authorized/); assert.equal(worker.calls(), 0);
    fs.appendFileSync(f.file, '\nAuthor edit'); await assert.rejects(runScene(f.root, p.id, worker.host, auth), /changed/); assert.equal(worker.calls(), 0);
  } finally { f.dispose(); }
});
test('commit recovery does not replay old prose over an author edit', async () => {
  const f = pipelineFixture(); try {
    const p = prepareScene(f.root, f.address, f.setup, proseHash(f.body)), worker = mockPipelineHost(f.address.id), auth = permit(f.store.projectId, p.id);
    await runScene(f.root, p.id, worker.host, auth); acceptScene(f.root, p.id, auth);
    const file = path.join(f.root, '.pnw/jobs', `${p.id}.pipeline.json`), s = JSON.parse(fs.readFileSync(file, 'utf8')); s.stage = 'ready'; fs.writeFileSync(file, JSON.stringify(s));
    fs.appendFileSync(f.file, '\nAuthor edit after commit'); const result = acceptScene(f.root, p.id, auth); assert.equal(result.projected, false); assert.ok(fs.readFileSync(f.file, 'utf8').endsWith('Author edit after commit'));
  } finally { f.dispose(); }
});
