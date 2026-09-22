import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import core from '../extensions/novel-core.ts';
import literary from '../extensions/novel-literary.ts';
import * as migration from '../extensions/llgf/migration.ts';
import { LiteraryStore } from '../extensions/llgf/store.ts';
import { JobStore } from '../extensions/llgf/jobs.ts';
import { newId, hashText } from '../extensions/llgf/version.ts';
import { fakePi } from './helpers.ts';

async function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pnw-recovery-'));
  console.log(`Retained crash fixture: ${root}`);
  const host = fakePi(); core(host.api); literary(host.api);
  const ctx = { cwd: root, hasUI: false, isIdle: () => true, getContextUsage: () => null, sessionManager: { getEntries: () => [] } };
  await host.commands.get('PNW-init')!.handler('', ctx);
  const file = path.join(root, 'manuscript/chapters/01/scene-01.md');
  const original = fs.readFileSync(file, 'utf8') + 'Rin kept the copper seal. The water was not clear yet.\n';
  fs.writeFileSync(file, original);
  const command = (args: string) => host.commands.get('PNW-literary')!.handler(args, ctx);
  return { root, file, original, host, ctx, command };
}
function crash(mode: string, root: string, value: string) {
  const child = spawnSync(process.execPath, ['--experimental-strip-types', fileURLToPath(new URL('./recovery-child.mjs', import.meta.url)), mode, root, value], { encoding: 'utf8' });
  console.log(JSON.stringify({ mode, pid: child.pid, status: child.status, stderr: child.stderr }));
  assert.equal(child.status, 23, child.stderr);
  assert.throws(() => process.kill(child.pid!, 0), (e: any) => e.code === 'ESRCH');
  return child.pid;
}
test('M04: an abruptly exited migration owner can be inspected and explicitly recovered', async () => {
  const f = await fixture();
  const plan = migration.previewMigration(f.root, { sceneFiles: ['manuscript/chapters/01/scene-01.md'], enable: true });
  const planFile = path.join(f.root, 'migration-preview.json'); fs.writeFileSync(planFile, JSON.stringify(plan));
  const pid = crash('migration', f.root, planFile);
  const lockFile = path.join(f.root, '.pnw/migration.lock'), raw = fs.readFileSync(lockFile, 'utf8');
  assert.ok(raw.length, 'Interrupted migration left an ownerless lock');
  const lock = JSON.parse(raw); assert.equal(lock.pid, pid); assert.equal(lock.operationId, plan.id);
  await f.command('migration-lock');
  const shown = JSON.parse((f.host.messages.at(-1) as any).content);
  assert.equal(shown.lock.token, lock.token);
  await assert.rejects(f.command('recover-migration-lock ' + newId()), /changed/);
  assert.equal(fs.readFileSync(lockFile, 'utf8'), raw);
  await f.command('recover-migration-lock ' + lock.token);
  assert.equal(fs.existsSync(lockFile), false);
  await f.command('recover-migration ' + plan.id);
  assert.equal(fs.readFileSync(f.file, 'utf8'), f.original);
  assert.equal(migration.managedProject(f.root), null);
  const journal = path.join(f.root, `.pnw/migrations/${plan.id}/journal.json`);
  assert.equal(JSON.parse(fs.readFileSync(journal, 'utf8')).status, 'rolled_back');
});
test('M04: accounting crash recovery preserves pending reservations and their spent allowance', async () => {
  const f = await fixture();
  await f.command('migrate delegated');
  const preview = JSON.parse((f.host.messages.at(-1) as any).content); await f.command('apply ' + preview.digest);
  const store = LiteraryStore.open(f.root), jobs = new JobStore(f.root, store.projectId);
  const job = jobs.create(newId(), hashText('source'), { maxCalls: 2, maxReservedTokens: 100, maxCost: null, maxRevisions: 0 });
  const permit = { projectId: store.projectId, runId: job.id, epoch: 1, provider: 'fixture', model: 'mock', active: () => true };
  const reservation = jobs.reserve(job.id, hashText('pending call'), 60, permit);
  const original = fs.readFileSync(path.join(f.root, `.pnw/jobs/${job.id}.json`), 'utf8');
  const pid = crash('accounting', f.root, JSON.stringify({ projectId: store.projectId, jobId: job.id }));
  const lockFile = path.join(f.root, `.pnw/jobs/${job.id}.json.lock`), raw = fs.readFileSync(lockFile, 'utf8');
  assert.ok(raw.length, 'Interrupted accounting left an ownerless lock');
  const lock = JSON.parse(raw); assert.equal(lock.pid, pid); assert.equal(lock.operationId, job.id);
  await f.command('account-lock ' + job.id);
  await f.command(`recover-account-lock ${job.id} ${lock.token}`);
  assert.equal(fs.readFileSync(path.join(f.root, `.pnw/jobs/${job.id}.json`), 'utf8'), original);
  assert.equal(jobs.read(job.id).reservations[0].id, reservation);
  assert.equal(jobs.read(job.id).reservations[0].status, 'pending');
  jobs.inspectInterrupted(job.id, 'Inspected the stopped synthetic writer; usage remains charged');
  assert.equal(jobs.read(job.id).reservations[0].status, 'failed');
  assert.equal(jobs.read(job.id).reservations[0].reservedTokens, 60);
  assert.throws(() => jobs.reserve(job.id, hashText('too large'), 41, permit), /exhausted/);
  jobs.reserve(job.id, hashText('remaining allowance'), 40, permit);
  assert.equal(jobs.read(job.id).reservations.reduce((n, r) => n + r.reservedTokens, 0), 100);
  assert.equal(JSON.parse((await f.host.call('novel_literary_status', {}, f.ctx)).content[0].text).authority, null);
});

test('M04: public recovery refuses live, foreign, changed and unverifiable owners without mutation', async () => {
  const f = await fixture();
  await f.command('migrate delegated');
  await f.command('apply ' + JSON.parse((f.host.messages.at(-1) as any).content).digest);
  const store = LiteraryStore.open(f.root), jobs = new JobStore(f.root, store.projectId);
  const job = jobs.create(newId(), hashText('negative cases'), { maxCalls: 1, maxReservedTokens: 100, maxCost: null, maxRevisions: 0 });
  for (const kind of ['migration', 'accounting']) {
    const owner = { token: newId(), operationId: kind === 'migration' ? newId() : job.id, pid: process.pid, host: os.hostname(), createdAt: new Date().toISOString() };
    const file = path.join(f.root, kind === 'migration' ? '.pnw/migration.lock' : `.pnw/jobs/${job.id}.json.lock`);
    const action = kind === 'migration' ? 'recover-migration-lock' : `recover-account-lock ${job.id}`;
    const cases = [
      { raw: JSON.stringify(owner), token: owner.token, error: /still running/ },
      { raw: JSON.stringify({ ...owner, host: 'another-machine' }), token: owner.token, error: /another machine/ },
      { raw: JSON.stringify({ ...owner, token: newId() }), token: owner.token, error: /changed/ },
      { raw: '', token: owner.token, error: /verifiable/ },
      { raw: '{', token: owner.token, error: /verifiable/ },
      { raw: JSON.stringify({ ...owner, pid: 0 }), token: owner.token, error: /verifiable/ },
    ];
    if (kind === 'accounting') cases.push({ raw: JSON.stringify({ ...owner, operationId: newId() }), token: owner.token, error: /another operation/ });
    for (const c of cases) {
      fs.writeFileSync(file, c.raw);
      const before = JSON.stringify(jobs.read(job.id));
      await assert.rejects(f.command(`${action} ${c.token}`), c.error);
      assert.equal(fs.readFileSync(file, 'utf8'), c.raw);
      assert.equal(JSON.stringify(jobs.read(job.id)), before);
    }
  }
});

test('M04: normal release never removes a replacement owner', async () => {
  const f = await fixture();
  const plan = migration.previewMigration(f.root, { sceneFiles: ['manuscript/chapters/01/scene-01.md'], enable: false });
  const migrationFile = path.join(f.root, '.pnw/migration.lock');
  const replacementToken = newId();
  migration.applyMigration(f.root, plan, plan.digest, index => {
    if (index === 0) {
      const owner = JSON.parse(fs.readFileSync(migrationFile, 'utf8'));
      fs.writeFileSync(migrationFile, JSON.stringify({ ...owner, token: replacementToken }));
    }
  });
  assert.equal(JSON.parse(fs.readFileSync(migrationFile, 'utf8')).token, replacementToken);
  const jobs = new JobStore(f.root, newId());
  const job = jobs.create(newId(), hashText('replacement test'), { maxCalls: 1, maxReservedTokens: 100, maxCost: null, maxRevisions: 0 });
  const accountFile = path.join(f.root, `.pnw/jobs/${job.id}.json.lock`);
  jobs.update(job.id, () => {
    const owner = JSON.parse(fs.readFileSync(accountFile, 'utf8'));
    fs.writeFileSync(accountFile, JSON.stringify({ ...owner, token: replacementToken }));
  });
  assert.equal(JSON.parse(fs.readFileSync(accountFile, 'utf8')).token, replacementToken);
});
