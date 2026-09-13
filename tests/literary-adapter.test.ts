import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import literary from '../extensions/novel-literary.ts';
import { setProject, refreshProject } from '../extensions/novel-core.ts';
import { fakePi } from './helpers.ts';
import { pipelineFixture, mockPipelineHost } from './pipeline-helpers.ts';
import { SessionAuthority } from '../extensions/llgf/authority.ts';
import { JobStore } from '../extensions/llgf/jobs.ts';
import { newId, proseHash } from '../extensions/llgf/version.ts';

function adapterFixture() {
  const f = pipelineFixture(), pi = fakePi(), worker = mockPipelineHost(f.address.id);
  setProject({ config: f.config, rootPath: f.root, scenes: new Map() }); refreshProject(); literary(pi.api);
  const ctx = { ...f.ctx, ...worker.host };
  const command = (text: string) => pi.commands.get('PNW-literary')!.handler(text, ctx);
  fs.writeFileSync(path.join(f.root, 'setup.json'), JSON.stringify(f.setup));
  const prepare = async () => {
    const r = await pi.call('novel_literary_prepare', { chapter: 1, scene: 1, setupPath: 'setup.json', expectedSourceHash: proseHash(f.body) }, ctx);
    return JSON.parse(r.content[0].text).jobId as string;
  };
  return { ...f, pi, worker, ctx, command, prepare };
}
test('Pi tools expose prepared bounded pipeline without granting permission on load', async () => {
  const f = adapterFixture(); try {
    const id = await f.prepare(); assert.equal(f.worker.calls(), 0);
    await assert.rejects(f.pi.call('novel_literary_run', { jobId: id }, f.ctx), /Authorize/);
    await f.command('authorize 12 300000');
    const r = await f.pi.call('novel_literary_run', { jobId: id }, f.ctx);
    assert.equal(JSON.parse(r.content[0].text).stage, 'ready'); assert.equal(f.worker.calls(), 4);
    await f.pi.call('novel_literary_accept', { jobId: id }, f.ctx);
    assert.ok(f.store.get(`acceptance:${f.address.id}`));
    const status = JSON.parse((await f.pi.call('novel_literary_status', {}, f.ctx)).content[0].text);
    assert.equal(status.authority.calls, 8); assert.ok(status.authority.tokens > 0);
  } finally { f.dispose(); }
});
test('pause, model change and new user instructions revoke worker authority', async () => {
  const f = adapterFixture(); try {
    const id = await f.prepare();
    for (const event of ['input', 'model_select', 'session_shutdown']) {
      await f.command('authorize 12 300000'); await f.pi.event(event, { source: 'interactive' }, f.ctx);
      await assert.rejects(f.pi.call('novel_literary_run', { jobId: id }, f.ctx), /Authorize/);
    }
    assert.equal(f.worker.calls(), 0);
  } finally { f.dispose(); }
});
test('session budget refuses oversize jobs before the first call', async () => {
  const f = adapterFixture(); try {
    const id = await f.prepare(); await f.command('authorize 2 100');
    await assert.rejects(f.pi.call('novel_literary_run', { jobId: id }, f.ctx), /allowance/); assert.equal(f.worker.calls(), 0);
  } finally { f.dispose(); }
});
test('session authority reserves failed calls and prevents concurrent leases', () => {
  const f = pipelineFixture(); try {
    const auth = new SessionAuthority(), scope = { root: f.root, projectId: f.store.projectId, provider: 'fixture', model: 'mock' };
    const budget = { maxCalls: 4, maxReservedTokens: 1000, maxCost: null, maxRevisions: 0 }, jobs = new JobStore(f.root, f.store.projectId), job = jobs.create(f.address.id, 'a'.repeat(64), budget);
    auth.authorize(scope, budget); const lease = auth.lease(job, () => scope);
    assert.throws(() => auth.lease(job, () => scope), /already executing/);
    jobs.reserve(job.id, 'b'.repeat(64), 100, lease.permit); lease.close(jobs.read(job.id));
    assert.equal(auth.status()?.calls, 3); assert.equal(auth.status()?.tokens, 900);
    const second = auth.lease(jobs.read(job.id), () => scope); auth.revoke();
    assert.equal(second.signal.aborted, true); assert.equal(auth.busy(), true); assert.equal(second.permit.active(), false);
    assert.throws(() => auth.authorize(scope, budget), /Pause/); second.close(); assert.equal(auth.busy(), false);
    auth.authorize(scope, budget); assert.throws(() => auth.lease(jobs.read(job.id), () => ({ ...scope, projectId: newId() })), /Authorize/);
  } finally { f.dispose(); }
});
test('explicit migration preview preserves prose and user metadata', async () => {
  const f = adapterFixture(); try {
    const before = fs.readFileSync(f.file, 'utf8'); await f.command('migrate collaborative');
    const message = f.pi.messages.at(-1) as { content: string }, preview = JSON.parse(message.content);
    assert.equal(fs.readFileSync(f.file, 'utf8'), before); await assert.rejects(f.command('apply ' + 'b'.repeat(64)), /digest|approval/i);
    await f.command('apply ' + preview.digest); assert.equal(fs.readFileSync(f.file, 'utf8'), before);
  } finally { f.dispose(); }
});
test('acceptance rejects reading-order changes after review through either authority path', async () => {
  for (const human of [false, true]) {
    const f = adapterFixture(); try {
      const id = await f.prepare(); await f.command('authorize 12 300000');
      await f.pi.call('novel_literary_run', { jobId: id }, f.ctx);
      const head = f.store.head().hash, before = fs.readFileSync(f.file, 'utf8');
      fs.writeFileSync(path.join(path.dirname(f.file), 'scene-02.md'), `---\nid: "${newId()}"\nscene: 2\norder: 0.5\n---\nAn earlier scene.`);
      await assert.rejects(human ? f.command(`accept ${id}`) : f.pi.call('novel_literary_accept', { jobId: id }, f.ctx), /reading order/i);
      assert.equal(f.store.head().hash, head);
      assert.equal(fs.readFileSync(f.file, 'utf8'), before);
    } finally { f.dispose(); }
  }
});
