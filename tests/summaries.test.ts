import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import core, { getProject } from '../extensions/novel-core.ts';
import write from '../extensions/novel-write.ts';
import { hashText } from '../extensions/llgf/version.ts';
import { summaryCurrent } from '../extensions/llgf/summaries.ts';
import { projectFixture, fakePi } from './helpers.ts';
async function setup() {
  const f = projectFixture(); const h = fakePi(); core(h.api); write(h.api); await h.event('session_start', {}, f.ctx);
  await h.call('novel_scene_create', { chapter: 1 }, f.ctx);
  await h.call('novel_scene_write', { chapter: 1, scene: 1, content: 'The bridge had fallen.' }, f.ctx);
  const source = JSON.parse((await h.call('summary_source', { chapter: 1, scene: 1 }, f.ctx)).content[0].text);
  return { ...f, h, source };
}
test('summary cannot stamp an old reading with a new source hash', async () => {
  const f = await setup(); try {
    await f.h.call('novel_scene_write', { chapter: 1, scene: 1, content: 'The bridge remained intact.' }, f.ctx);
    await assert.rejects(f.h.call('summary_generate', { chapter: 1, scene: 1, expectedSourceHash: f.source.expectedSourceHash, summaryText: 'The bridge fell.' }, f.ctx), /source changed/);
    assert.equal(fs.existsSync(path.join(f.root, 'summaries/scenes/01-01.md')), false);
  } finally { f.dispose(); }
});
test('summary freshness follows upstream dependencies without changing its own prose', async () => {
  const f = await setup(); try {
    fs.mkdirSync(path.join(f.root, 'continuity')); fs.writeFileSync(path.join(f.root, 'continuity/facts.json'), '{}');
    await f.h.call('summary_generate', { chapter: 1, scene: 1, expectedSourceHash: f.source.expectedSourceHash, summaryText: 'The bridge fell.', dependencies: [{ path: 'continuity/facts.json', hash: hashText('{}') }] }, f.ctx);
    assert.match((await f.h.call('summary_read', { chapter: 1, scene: 1 }, f.ctx)).content[0].text, /Freshness: current/);
    fs.writeFileSync(path.join(f.root, 'continuity/facts.json'), '{"bridge":"disputed"}');
    assert.match((await f.h.call('summary_read', { chapter: 1, scene: 1 }, f.ctx)).content[0].text, /Freshness: stale/);
  } finally { f.dispose(); }
});
test('legacy hash-current summaries remain readable but malformed dependencies are not fresh', () => {
  const f = projectFixture(); try {
    assert.equal(summaryCurrent(f.root, { hash: hashText('Text') }, 'Text'), true);
    assert.equal(summaryCurrent(f.root, { hash: hashText('Text'), dependencies: 'invalid' }, 'Text'), false);
    assert.equal(summaryCurrent(f.root, { hash: hashText('Text'), dependencies: [{ path: '../secret.md', hash: hashText('') }] }, 'Text'), false);
  } finally { f.dispose(); }
});
test('chapter source binds actual reading order, not only individual body hashes', async () => {
  const f = await setup(); try {
    await f.h.call('novel_scene_status', { chapter: 1, scene: 1, status: 'draft' }, f.ctx);
    await f.h.call('novel_scene_create', { chapter: 1 }, f.ctx);
    await f.h.call('novel_scene_write', { chapter: 1, scene: 2, content: 'They crossed by boat.' }, f.ctx);
    await f.h.call('novel_scene_status', { chapter: 1, scene: 2, status: 'draft' }, f.ctx);
    const first = JSON.parse((await f.h.call('summary_source', { chapter: 1 }, f.ctx)).content[0].text);
    const scene = getProject()!.scenes.get('01-02')!;
    const raw = fs.readFileSync(scene.filePath, 'utf8');
    fs.writeFileSync(scene.filePath, raw.replace('---\n', '---\norder: 0\n'));
    await f.h.event('tool_call', {}, f.ctx);
    await assert.rejects(f.h.call('summary_generate', { chapter: 1, expectedSourceHash: first.expectedSourceHash, summaryText: 'The bridge fell, then they crossed.' }, f.ctx), /source changed/);
  } finally { f.dispose(); }
});
