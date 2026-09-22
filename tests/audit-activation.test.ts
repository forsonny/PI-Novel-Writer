import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import core, { getProject, parseFrontmatter } from '../extensions/novel-core.ts';
import literary from '../extensions/novel-literary.ts';
import { fakePi } from './helpers.ts';
import { LiteraryStore } from '../extensions/llgf/store.ts';
import { previewMigration, applyMigration, managedProject } from '../extensions/llgf/migration.ts';
import { newId, proseHash } from '../extensions/llgf/version.ts';
import type { SceneSetup } from '../extensions/llgf/pipeline.ts';
import { mockPipelineHost } from './pipeline-helpers.ts';
import type { WorkerHost } from '../extensions/llgf/workers.ts';

async function freshProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pnw-activation-'));
  console.log(`Retained activation fixture: ${root}`);
  const host = fakePi(); core(host.api); literary(host.api);
  const ctx = { cwd: root, hasUI: false, isIdle: () => true, getContextUsage: () => null, sessionManager: { getEntries: () => [] } };
  await host.commands.get('PNW-init')!.handler('', ctx);
  const relative = 'manuscript/chapters/01/scene-01.md';
  const body = 'Rin set three copper seals beside the sluice. Only one still carried her name. She offered it to the keeper, who refused payment until the water ran clear. Rin pocketed the seal and picked up the clogged basket instead.';
  const original = `---\r\nchapter: 1\r\nscene: 1\r\nstatus: "draft"\r\ncustom_field: "Author 雨"\r\n---\r\n${body}\r\n`;
  fs.writeFileSync(path.join(root, relative), original);
  const notes = JSON.stringify({ characters: { Rin: { note: 'Unverified imported note; not accepted canon.' } } });
  fs.writeFileSync(path.join(root, 'continuity/facts.json'), notes);
  const command = (args: string) => host.commands.get('PNW-literary')!.handler(args, ctx);
  const status = async () => JSON.parse((await host.call('novel_literary_status', {}, ctx)).content[0].text);
  const preview = async () => {
    await command('migrate delegated');
    return JSON.parse((host.messages.at(-1) as { content: string }).content);
  };
  return { root, host, ctx, relative, body: body + '\n', original, notes, command, status, preview };
}

test('M01: public init/preview/apply creates empty history, then design and prepare work without model authority', async () => {
  const f = await freshProject();
  const p = await f.preview();
  assert.equal(LiteraryStore.exists(f.root), false);
  await assert.rejects(f.command('apply ' + '0'.repeat(64)), /approval/);
  assert.equal(LiteraryStore.exists(f.root), false);
  await f.command('apply ' + p.digest);
  const state = await f.status();
  assert.ok(state.acceptedHead, 'Approved activation must create the accepted-history pointer');
  assert.equal(state.authority, null);
  assert.equal(state.settings.importedState, 'unverified');
  const store = LiteraryStore.open(f.root);
  assert.equal(store.projectId, state.settings.projectId);
  assert.deepEqual(store.head().snapshot.versions, {});
  assert.equal(fs.readFileSync(path.join(f.root, f.relative), 'utf8').replace(/^id:.*\r\n/m, ''), f.original);
  assert.equal(fs.readFileSync(path.join(f.root, 'continuity/facts.json'), 'utf8'), f.notes);
  await f.host.call('novel_literary_memory', {}, f.ctx);
  const scene = getProject()!.scenes.get('01-01')!;
  const setup: SceneSetup = {
    schemaVersion: 1,
    contract: { schemaVersion: 1, sceneId: scene.id!, status: 'approved',
      condition: { focalizerId: null, sceneFunction: 'decision', secondaryFunctions: [], pressure: 'quiet', distance: 'close', epochId: null, storyTime: { earliest: null, latest: null, label: '' }, narrativeIndex: 0 },
      purpose: 'Rin chooses work rather than premature payment.', dramaticQuestion: 'Will the keeper accept payment?',
      entryState: [], obligations: [], prohibitions: [], information: [], knowledgeDelta: [], pressureCurve: [], distanceTrajectory: [],
      subtext: [], sensoryAffordances: [], promiseActions: [], exitStateRange: ['Rin starts clearing the basket.'], protected: [], riskForecast: [], openDiscoveries: [] },
    voice: { schemaVersion: 1, id: newId(), name: 'Copper sluice', rationale: 'Concrete actions, limited certainty.', nonImitationDeclaration: 'Original synthetic test voice.',
      narrator: { person: 'third', tense: 'past', access: 'limited', reliability: 'limited' }, invariants: [], profiles: [], transitions: [],
      variationBudgets: [], motifBehavior: [], negativeConstraints: [], anchorIds: [], uncertainty: ['Not human calibrated'], epochs: [],
      calibration: { status: 'not_performed', sampleIds: [], reviewRecords: [] } },
    anchors: [], required: [], participantIds: [], minWords: 20, maxWords: 100, unitMaxWords: 40, maxUnits: 2, mode: 'review_existing',
    budget: { maxCalls: 12, maxReservedTokens: 300000, maxCost: null, maxRevisions: 1 }, transmissionApproved: true, sourcePolicy: 'Original synthetic test prose',
  };
  fs.writeFileSync(path.join(f.root, 'voice.json'), JSON.stringify(setup.voice));
  await f.command(`design voice voice.json ${state.acceptedHead}`);
  const headWithDesign = store.head().hash;
  fs.writeFileSync(path.join(f.root, 'setup.json'), JSON.stringify(setup));
  const source = parseFrontmatter(fs.readFileSync(path.join(f.root, f.relative), 'utf8').replaceAll('\r\n', '\n')).body;
  const prepared = await f.host.call('novel_literary_prepare', { chapter: 1, scene: 1, setupPath: 'setup.json', expectedSourceHash: proseHash(source) }, f.ctx);
  const jobId = JSON.parse(prepared.content[0].text).jobId;
  const job = JSON.parse((await f.host.call('novel_literary_status', { jobId }, f.ctx)).content[0].text);
  assert.equal(job.stage, 'review');
  assert.deepEqual(job.job.reservations, []);
  assert.equal(job.job.acceptedHead, null);
  assert.equal((await f.status()).authority, null);
  const repeat = await f.preview();
  await f.command('apply ' + repeat.digest);
  assert.equal(store.head().hash, headWithDesign, 'Repeat activation must not reset existing design history');
  assert.equal(fs.readFileSync(path.join(f.root, 'continuity/facts.json'), 'utf8'), f.notes);
});

test('M01: failed initial history creation remains retryable with the same approval or a fresh empty preview', async () => {
  for (const freshPreview of [false, true]) {
  const f = await freshProject();
  const p = await f.preview();
  fs.mkdirSync(path.join(f.root, '.pnw'), { recursive: true });
  const lock = path.join(f.root, '.pnw/write.lock');
  fs.writeFileSync(lock, 'synthetic competing writer', { flag: 'wx' });
  await assert.rejects(f.command('apply ' + p.digest), /lock/i);
  assert.equal(LiteraryStore.exists(f.root), false);
  assert.equal(managedProject(f.root)?.enabled, true);
  assert.equal((await f.status()).authority, null);
  // Release only this synthetic contention fixture. Restricted runs use the
  // audited exact-target retention guard, never native removal or lock recovery.
  fs.unlinkSync(lock);
  const retry = freshPreview ? await f.preview() : p;
  if (freshPreview) assert.deepEqual(retry.files, []);
  await f.command('apply ' + retry.digest);
  assert.ok((await f.status()).acceptedHead);
  assert.equal((await f.status()).authority, null);
  assert.equal(fs.readFileSync(path.join(f.root, f.relative), 'utf8').replace(/^id:.*\r\n/m, ''), f.original);
  }
});

test('M01: disabled migration does not create accepted history', async () => {
  const f = await freshProject();
  const p = previewMigration(f.root, { sceneFiles: [f.relative], enable: false });
  applyMigration(f.root, p, p.digest);
  assert.equal(managedProject(f.root)?.enabled, false);
  assert.equal(LiteraryStore.exists(f.root), false);
});

test('M10/RES-03: documented direct commands run prepared work while ordinary input still revokes', async () => {
  const f = await freshProject();
  const preview = await f.preview(); await f.command('apply ' + preview.digest);
  const sceneId = getProject()!.scenes.get('01-01')!.id!;
  // Adapt the shipped illustration to this real synthetic source; do not use
  // pipelineFixture or initialize private history outside public activation.
  const setup: SceneSetup = JSON.parse(fs.readFileSync(new URL('../configs/example-scene-setup.json', import.meta.url), 'utf8'));
  setup.contract.sceneId = sceneId;
  setup.contract.purpose = 'Rin chooses work rather than premature payment.';
  setup.contract.dramaticQuestion = 'Will the keeper accept payment?';
  setup.contract.information = [];
  setup.contract.exitStateRange = ['Rin starts clearing the basket.'];
  setup.voice.id = newId();
  setup.voice.name = 'Copper sluice test voice';
  setup.minWords = 20;
  setup.sourcePolicy = 'Original synthetic Rin scene; permitted for this simulated test only.';
  fs.writeFileSync(path.join(f.root, 'voice.json'), JSON.stringify(setup.voice));
  await f.command(`design voice voice.json ${(await f.status()).acceptedHead}`);
  fs.writeFileSync(path.join(f.root, 'setup.json'), JSON.stringify(setup));
  await f.host.event('input', { source: 'interactive', text: 'Prepare this scene without running it.' }, f.ctx);
  const prepared = JSON.parse((await f.host.call('novel_literary_prepare', {
    chapter: 1, scene: 1, setupPath: 'setup.json', expectedSourceHash: proseHash(f.body),
  }, f.ctx)).content[0].text);
  const mock = mockPipelineHost(sceneId), complete = mock.host.modelRegistry!.complete.bind(mock.host.modelRegistry);
  const worker: WorkerHost = { ...mock.host, modelRegistry: { complete: async (...args) => {
    const response = await complete(...args), block = response.content[0];
    if (block.type !== 'text') throw new Error('Expected simulated review text');
    const out = JSON.parse(block.text);
    if ('reconstruction' in out) out.reconstruction = 'Rin offers payment, is refused, and chooses to clear the basket.';
    if ('questions' in out) out.questions = ['Will the water run clear?'];
    if ('stateDecisions' in out) { out.information = []; out.exitRationale = 'Rin picks up the clogged basket.'; }
    return { ...response, content: [{ type: 'text', text: JSON.stringify(out) }] };
  } } as WorkerHost['modelRegistry'] };
  Object.assign(f.ctx, worker);
  assert.equal((await f.status()).authority, null);
  assert.equal(mock.calls(), 0);
  const grant = `authorize ${prepared.budget.maxCalls} ${prepared.budget.maxReservedTokens}`;
  // Reproduce the formerly documented order without weakening revocation.
  await f.command(grant);
  await f.host.event('input', { source: 'interactive', text: 'Now run the prepared scene.' }, f.ctx);
  assert.equal((await f.status()).authority, null);
  await assert.rejects(f.command('run ' + prepared.jobId), /Authorize/);
  assert.equal(mock.calls(), 0);
  console.log('M10 reproduced: authorize → ordinary request revokes authority; run refused before any worker call.');

  const docs = ['../README.md', '../help/literary/walkthrough.md'];
  const commandBlocks = docs.map(file => {
    const text = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
    const block = /```text\r?\n(\/PNW-literary authorize <calls> <tokens>[\s\S]*?)```/.exec(text);
    assert.ok(block, `${file}: missing direct authorize/run/status sequence`);
    const lines = block[1].trim().split(/\r?\n/);
    assert.deepEqual(lines, ['/PNW-literary authorize <calls> <tokens>', '/PNW-literary run <jobId>', '/PNW-literary status <jobId>']);
    return lines;
  });
  assert.deepEqual(commandBlocks[0], commandBlocks[1]);
  const before = fs.readFileSync(path.join(f.root, f.relative), 'utf8');
  for (const line of commandBlocks[0]) {
    const actual = line.replace('<calls>', String(prepared.budget.maxCalls))
      .replace('<tokens>', String(prepared.budget.maxReservedTokens)).replace('<jobId>', prepared.jobId);
    await f.command(actual.slice('/PNW-literary '.length));
  }
  const ready = JSON.parse((f.host.messages.at(-1) as { content: string }).content);
  assert.equal(ready.stage, 'ready');
  assert.equal(mock.calls(), 4);
  assert.equal((await f.status()).authority.calls, prepared.budget.maxCalls - 4);
  assert.equal(fs.readFileSync(path.join(f.root, f.relative), 'utf8'), before, 'Running does not accept or replace source');
  await f.command('accept ' + prepared.jobId);
  assert.ok(LiteraryStore.open(f.root).get(`acceptance:${sceneId}`));
  await f.host.event('input', { source: 'interactive', text: 'Change the scene direction.' }, f.ctx);
  assert.equal((await f.status()).authority, null);
});

test('M05: exhausted candidate is reused through a source-bound working edit and fresh job, without resetting charges', async () => {
  const f = await freshProject(), preview = await f.preview();
  await f.command('apply ' + preview.digest);
  const sceneId = getProject()!.scenes.get('01-01')!.id!;
  const setup: SceneSetup = JSON.parse(fs.readFileSync(new URL('../configs/example-scene-setup.json', import.meta.url), 'utf8'));
  setup.contract.sceneId = sceneId;
  setup.contract.purpose = 'Rin clears the basket instead of paying early.';
  setup.contract.information = [];
  setup.contract.exitStateRange = ['Water runs through the basket.'];
  setup.voice.id = newId();
  setup.voice.name = 'Copper sluice test voice';
  setup.mode = 'continue'; setup.budget.maxCalls = 2;
  setup.sourcePolicy = 'Original synthetic source; simulated workers only.';
  fs.writeFileSync(path.join(f.root, 'setup.json'), JSON.stringify(setup));
  const prepared = JSON.parse((await f.host.call('novel_literary_prepare', {
    chapter: 1, scene: 1, setupPath: 'setup.json', expectedSourceHash: proseHash(f.body),
  }, f.ctx)).content[0].text);
  const mock = mockPipelineHost(sceneId), complete = mock.host.modelRegistry!.complete.bind(mock.host.modelRegistry);
  Object.assign(f.ctx, { ...mock.host, modelRegistry: { complete: async (...args: Parameters<typeof complete>) => {
    const response = await complete(...args), block = response.content[0];
    if (block.type !== 'text') throw new Error('Expected simulated text');
    const out = JSON.parse(block.text), input = JSON.parse(args[1].messages[0].content as string);
    if (input.role === 'planner') out.moves = ['Clear the clogged basket'];
    if (input.role === 'drafter') out.prose = 'Rin lifted the basket. Clear water threaded between the reeds.';
    if ('reconstruction' in out) out.reconstruction = 'Rin clears the basket after payment is refused.';
    if ('stateDecisions' in out) { out.information = []; out.exitRationale = 'Water runs through the basket.'; }
    return { ...response, content: [{ type: 'text', text: JSON.stringify(out) }] };
  } } });
  await f.command('authorize 2 300000');
  await assert.rejects(f.command('run ' + prepared.jobId), /budget exhausted/i);
  const status = JSON.parse((await f.host.call('novel_literary_status', { jobId: prepared.jobId }, f.ctx)).content[0].text);
  const checkpointPath = path.join(f.root, status.privateCheckpoint);
  const checkpoint = fs.readFileSync(checkpointPath, 'utf8'), candidate = JSON.parse(checkpoint).body;
  const jobPath = path.join(f.root, `.pnw/jobs/${prepared.jobId}.json`), oldJob = fs.readFileSync(jobPath, 'utf8');
  assert.equal(status.stage, 'blocked');
  assert.ok(candidate.endsWith('Clear water threaded between the reeds.'));
  assert.equal(mock.calls(), 2);
  assert.equal(parseFrontmatter(fs.readFileSync(path.join(f.root, f.relative), 'utf8')).body.replaceAll('\r\n', '\n'), f.body);
  await f.command('authorize 12 300000');
  await assert.rejects(f.command('run ' + prepared.jobId), /blocked|failed candidate/i);
  assert.equal(mock.calls(), 2);
  console.log('M05 reproduced: two calls consumed; candidate retained; renewed session grant cannot restart the fixed-budget job.');
  assert.match(prepared.budgetPolicy || '', /fixed/i, 'Preparation must disclose the fixed-budget limit before work');
  const guide = fs.readFileSync(new URL('../help/literary/walkthrough.md', import.meta.url), 'utf8');
  assert.match(guide, /## When a job exhausts its allowance/);

  await f.host.event('input', { source: 'interactive', text: 'Use the saved candidate as my working draft, not accepted prose.' }, f.ctx);
  const oldRead = JSON.parse((await f.host.call('novel_scene_read', { chapter: 1, scene: 1 }, f.ctx)).content[0].text);
  assert.equal(status.originalSourceHash, oldRead.sourceHash);
  await f.host.call('novel_scene_write', { chapter: 1, scene: 1, content: candidate, expectedSourceHash: oldRead.sourceHash }, f.ctx);
  await assert.rejects(f.host.call('novel_scene_write', { chapter: 1, scene: 1, content: 'Do not overwrite.', expectedSourceHash: oldRead.sourceHash }, f.ctx), /changed/i);
  setup.mode = 'review_existing'; setup.budget.maxCalls = 12;
  fs.writeFileSync(path.join(f.root, 'recovery-setup.json'), JSON.stringify(setup));
  await assert.rejects(f.host.call('novel_literary_prepare', { chapter: 1, scene: 1, setupPath: 'recovery-setup.json', expectedSourceHash: oldRead.sourceHash }, f.ctx), /changed/i);
  const current = JSON.parse((await f.host.call('novel_scene_read', { chapter: 1, scene: 1 }, f.ctx)).content[0].text);
  assert.equal(current.content, candidate.replaceAll('\r\n', '\n'));
  assert.equal(current.sourceHash, status.candidateHash);
  const next = JSON.parse((await f.host.call('novel_literary_prepare', { chapter: 1, scene: 1, setupPath: 'recovery-setup.json', expectedSourceHash: current.sourceHash }, f.ctx)).content[0].text);
  assert.notEqual(next.jobId, prepared.jobId);
  await assert.rejects(f.command('run ' + next.jobId), /Authorize/);
  await f.command('authorize 12 300000');
  await f.command('run ' + next.jobId);
  const ready = JSON.parse((f.host.messages.at(-1) as any).content);
  assert.equal(ready.stage, 'ready');
  assert.equal(mock.calls(), 6);
  assert.equal(fs.readFileSync(jobPath, 'utf8'), oldJob);
  assert.equal(fs.readFileSync(checkpointPath, 'utf8'), checkpoint);
  assert.equal(ready.job.reservations.length, 4);
  assert.equal(LiteraryStore.open(f.root).get(`acceptance:${sceneId}`), null);
});
