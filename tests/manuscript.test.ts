import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import core, { getProject, countWords, parseFrontmatter } from '../extensions/novel-core.ts';
import progress from '../extensions/novel-progress.ts';
import { acceptedScenes, exportManuscript, manuscriptCoverage } from '../extensions/llgf/manuscript.ts';
import { prepareScene, runScene, acceptScene } from '../extensions/llgf/pipeline.ts';
import { newId, proseHash } from '../extensions/llgf/version.ts';
import { fakePi, projectFixture } from './helpers.ts';
import { pipelineFixture, mockPipelineHost } from './pipeline-helpers.ts';

for (const format of ['novel', 'novella', 'short-story', 'flash-fiction'] as const) {
  test(`working export and progress share the ${format} scene resolver and word count`, async () => {
    const f = projectFixture(format), pi = fakePi();
    try {
      core(pi.api); progress(pi.api);
      await pi.commands.get('PNW-load')!.handler(f.root, f.ctx);
      await pi.call('novel_scene_create', { chapter: 1, title: 'Sparse address' });
      await pi.call('novel_scene_write', { chapter: 1, scene: 1, content: 'A quiet word.\n\nAnother.' });
      await pi.call('novel_scene_status', { chapter: 1, scene: 1, status: 'draft' });
      const p = getProject()!, output = exportManuscript(p);
      const text = fs.readFileSync(output.path, 'utf8');
      assert.equal(text.includes('# Chapter 1'), ['novel', 'novella'].includes(format));
      assert.ok(!text.includes('* * *'));
      const manifest = JSON.parse(fs.readFileSync(output.manifestPath, 'utf8'));
      assert.equal(manifest.words, 4); assert.equal(manuscriptCoverage(p).workingWords, 4);
      await pi.commands.get('PNW-next')!.handler('', f.ctx);
      const next = pi.messages.at(-1) as { details: { stats: { estimatedWordCount: number } } };
      assert.equal(next.details.stats.estimatedWordCount, 4);
      assert.equal(manifest.mode, 'working'); assert.equal(manifest.manuscriptHash, proseHash(text));
    } finally { f.dispose(); }
  });
}

test('scene gaps never create a leading break and accepted export is independent of later working edits', async () => {
  const f = pipelineFixture(), pi = fakePi();
  try {
    core(pi.api); await pi.commands.get('PNW-load')!.handler(f.root, f.ctx);
    const p = prepareScene(f.root, f.address, f.setup, proseHash(f.body)), { host } = mockPipelineHost(f.address.id);
    const permit = { projectId: f.store.projectId, runId: p.id, epoch: 1, provider: 'fixture', model: 'mock', active: () => true };
    await runScene(f.root, p.id, host, permit); const accepted = acceptScene(f.root, p.id, permit);
    const original = acceptedScenes(f.store)[0]; assert.equal(original.stale, false);
    fs.appendFileSync(f.file, '\nA later manual change.');
    const exported = exportManuscript(getProject()!, { mode: 'accepted', snapshotHash: accepted.head, requireComplete: true });
    assert.equal(exported.head, accepted.head);
    assert.ok(!fs.readFileSync(exported.path, 'utf8').includes('manual change'));
    assert.equal(JSON.parse(fs.readFileSync(exported.manifestPath, 'utf8')).words, countWords(f.body));
    const empty = f.store.put('voice', f.setup.voice.id, { ...f.setup.voice, name: 'Changed controls' });
    f.store.commit({ expectedHead: f.store.head().hash, requestId: 'change-voice', changes: [empty], dependencies: [] });
    assert.equal(acceptedScenes(f.store)[0].stale, true);
    assert.throws(() => exportManuscript(getProject()!, { mode: 'accepted', requireComplete: true }), /current assessments/);
    assert.ok(exportManuscript(getProject()!, { mode: 'accepted' }).warnings.some(x => x.includes('reassessment')));
    // A sparse numeric first scene still receives no leading scene separator.
    const working = getProject()!;
    for (const scene of working.scenes.values()) scene.scene = 7;
    const text = fs.readFileSync(exportManuscript(working).path, 'utf8');
    assert.ok(!text.includes('* * *'));
    assert.ok(parseFrontmatter(text).body.includes('manual change'));
  } finally { f.dispose(); }
});

test('accepted export refuses duplicate reading positions instead of silently choosing an order', () => {
  const f = pipelineFixture();
  try {
    const ids = [newId(), newId()];
    const refs = ids.map(id => f.store.put('prose', id, { address: { ...f.address, id }, condition: f.setup.contract.condition, body: f.body, textHash: proseHash(f.body), transmissionApproved: true }));
    f.store.commit({ expectedHead: f.store.head().hash, requestId: 'conflicting-positions', changes: refs, dependencies: [] });
    assert.throws(() => acceptedScenes(f.store), /positions conflict/);
  } finally { f.dispose(); }
});
