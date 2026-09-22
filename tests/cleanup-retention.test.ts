import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import core, { getProject, parseFrontmatter, buildFrontmatter } from '../extensions/novel-core.ts';
import literary from '../extensions/novel-literary.ts';
import { fakePi } from './helpers.ts';
import { LiteraryStore } from '../extensions/llgf/store.ts';
import { JobStore } from '../extensions/llgf/jobs.ts';
import { withExecution } from '../extensions/llgf/execution.ts';
import { exportManuscript } from '../extensions/llgf/manuscript.ts';
import { newId, hashText } from '../extensions/llgf/version.ts';
import { retainProjectFile } from '../extensions/utils/retention.ts';
import { shareablePath } from '../extensions/utils/git.ts';

async function fixture() {
  const base = process.env.PNW_CLEANUP_FIXTURES || os.tmpdir();
  const root = fs.mkdtempSync(path.join(base, 'pnw-retention-'));
  console.log(`Retained native-cleanup fixture: ${root}`);
  const host = fakePi(); core(host.api); literary(host.api);
  const ctx = { cwd: root, hasUI: false, isIdle: () => true, getContextUsage: () => null, sessionManager: { getEntries: () => [] } };
  await host.commands.get('PNW-init')!.handler('', ctx);
  const scene = getProject()!.scenes.get('01-01')!;
  const { meta } = parseFrontmatter(fs.readFileSync(scene.filePath, 'utf8'));
  const prose = 'Rin kept the copper seal until the water ran clear.';
  fs.writeFileSync(scene.filePath, buildFrontmatter(meta) + prose);
  return { root, host, ctx, scene, prose, command: (args: string) => host.commands.get('PNW-literary')!.handler(args, ctx) };
}
async function withoutDeletion(work: () => Promise<void>) {
  const originals: [any, string, any][] = [];
  let attempts = 0;
  for (const [object, names] of [[fs, ['unlinkSync', 'rmSync', 'rmdirSync', 'unlink', 'rm', 'rmdir']], [fs.promises, ['unlink', 'rm', 'rmdir']]] as const) {
    for (const name of names) {
      originals.push([object, name, (object as any)[name]]);
      (object as any)[name] = () => { attempts++; throw new Error(`Blocked permanent cleanup: ${name}`); };
    }
  }
  try { await work(); assert.equal(attempts, 0); }
  finally { for (const [object, name, value] of originals) object[name] = value; }
}
test('cleanup: managed activation, accepted storage, accounting and execution need no deletion', async () => {
  const f = await fixture();
  await withoutDeletion(async () => {
    await f.command('migrate delegated');
    await f.command('apply ' + JSON.parse((f.host.messages.at(-1) as any).content).digest);
    const store = LiteraryStore.open(f.root), before = store.head();
    const record = store.put('note', newId(), { text: 'Retain this exact test record.' });
    store.commit({ expectedHead: before.hash, requestId: 'retention-test', changes: [record], dependencies: [] });
    assert.equal((store.get(record.key)!.payload as any).text, 'Retain this exact test record.');
    const jobs = new JobStore(f.root, store.projectId);
    const job = jobs.create(newId(), hashText('test job'), { maxCalls: 1, maxReservedTokens: 100, maxCost: null, maxRevisions: 0 });
    jobs.reserve(job.id, hashText('test call'), 60, { projectId: store.projectId, runId: job.id, epoch: 1, provider: 'fixture', model: 'mock', active: () => true });
    jobs.inspectInterrupted(job.id, 'Synthetic call; retain its charge');
    await withExecution(f.root, job.id, async () => assert.equal(jobs.read(job.id).reservations[0].reservedTokens, 60));
    assert.equal(fs.existsSync(path.join(f.root, '.pnw/write.lock')), false);
    assert.equal(fs.existsSync(path.join(f.root, `.pnw/jobs/${job.id}.json.lock`)), false);
    assert.equal(fs.existsSync(path.join(f.root, `.pnw/jobs/${job.id}.execution.lock`)), false);
    assert.equal(parseFrontmatter(fs.readFileSync(f.scene.filePath, 'utf8')).body, f.prose);
  });
});
test('cleanup: failed export retains its manifest and ordinary export still works', async () => {
  const f = await fixture(), original = fs.writeFileSync;
  await withoutDeletion(async () => {
    fs.writeFileSync = ((file: any, ...args: any[]) => {
      if (typeof file === 'string' && path.dirname(file) === path.join(f.root, 'exports') && file.endsWith('.md')) throw new Error('Induced manuscript write failure');
      return (original as any)(file, ...args);
    }) as typeof fs.writeFileSync;
    try { assert.throws(() => exportManuscript(getProject()!), /manifest retained/i); }
    finally { fs.writeFileSync = original; }
    const manifests = fs.readdirSync(path.join(f.root, 'exports')).filter(n => n.endsWith('.manifest.json'));
    assert.equal(manifests.length, 1);
    assert.equal(JSON.parse(fs.readFileSync(path.join(f.root, 'exports', manifests[0]), 'utf8')).sceneCount, 1);
    const success = exportManuscript(getProject()!);
    assert.match(fs.readFileSync(success.path, 'utf8'), /Rin kept the copper seal/);
  });
});

test('cleanup: retention keeps exact bytes and receipts without replacing earlier archives', async () => {
  const f = await fixture();
  const source = path.join(f.root, 'notes/retirement-test.md');
  const bytes = Buffer.from('Original 雨\r\nKeep exact bytes.\r\n');
  fs.writeFileSync(source, bytes);
  await withoutDeletion(async () => {
    const first = retainProjectFile(f.root, source, 'Synthetic completed operation');
    assert.equal(fs.existsSync(source), false);
    assert.deepEqual(fs.readFileSync(first), bytes);
    const receipt = JSON.parse(fs.readFileSync(path.join(path.dirname(first), 'receipt.json'), 'utf8'));
    assert.equal(receipt.originalPath, source);
    assert.equal(receipt.retainedPath, first);
    assert.equal(shareablePath(path.relative(f.root, first)), false);
    fs.writeFileSync(source, 'Second version');
    const second = retainProjectFile(f.root, source, 'Second synthetic completed operation');
    assert.notEqual(first, second);
    assert.deepEqual(fs.readFileSync(first), bytes);
    assert.equal(fs.readFileSync(second, 'utf8'), 'Second version');
  });
});

test('cleanup: directories, history metadata and redirected retention destinations refuse without loss', async () => {
  const f = await fixture(), outside = await fixture();
  const source = path.join(f.root, 'notes/source.md');
  fs.writeFileSync(source, 'Keep me');
  fs.mkdirSync(path.join(f.root, '.git'));
  const history = path.join(f.root, '.git/test-marker');
  fs.writeFileSync(history, 'Protected history marker');
  await withoutDeletion(async () => {
    assert.throws(() => retainProjectFile(f.root, f.root, 'Invalid directory'), /regular file/);
    assert.throws(() => retainProjectFile(f.root, history, 'Invalid history'), /protected/i);
    fs.symlinkSync(outside.root, path.join(f.root, '.pnw'), 'junction');
    assert.throws(() => retainProjectFile(f.root, source, 'Invalid redirected archive'), /escape|redirect/i);
    assert.equal(fs.readFileSync(source, 'utf8'), 'Keep me');
    assert.equal(fs.readFileSync(history, 'utf8'), 'Protected history marker');
    assert.equal(fs.existsSync(path.join(outside.root, 'retained')), false);
  });
});
