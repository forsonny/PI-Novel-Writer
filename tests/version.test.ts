import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { canonicalJson, objectHash, proseHash, expectVersion, newId } from '../extensions/llgf/version.ts';
import core, { getProject, scanScenes } from '../extensions/novel-core.ts';
import { fakePi, projectFixture } from './helpers.ts';

test('canonical hashes reject lossy JSON and preserve Unicode', () => {
  assert.equal(objectHash({ b: 2, a: '雪' }), objectHash({ a: '雪', b: 2 }));
  for (const v of [undefined, NaN, Infinity, { a: undefined }, new Date(), Array(2), JSON.parse('{"__proto__":{}}')]) assert.throws(() => canonicalJson(v));
  const cycle: unknown[] = []; cycle.push(cycle); assert.throws(() => canonicalJson(cycle), /Cyclic/);
  assert.equal(proseHash('A\r\n雪'), proseHash('A\n雪'));
  assert.throws(() => expectVersion('new', proseHash('old')), /changed/);
});
test('new scenes have stable IDs through moves and unique split lineage', async () => {
  const f = projectFixture(); const h = fakePi(); core(h.api);
  try {
    await h.event('session_start', {}, f.ctx);
    await h.call('novel_scene_create', { chapter: 1 }, f.ctx);
    const id = getProject()!.scenes.get('01-01')!.id; assert.ok(id);
    await h.call('novel_scene_write', { chapter: 1, scene: 1, content: 'First.\nSecond.', expectedSourceHash: proseHash('\n') }, f.ctx);
    await assert.rejects(h.call('novel_scene_write', { chapter: 1, scene: 1, content: 'Wrong.', expectedSourceHash: proseHash('old') }, f.ctx), /changed/);
    await h.call('novel_scene_move', { chapter: 1, scene: 1, targetChapter: 2 }, f.ctx);
    assert.equal(getProject()!.scenes.get('02-01')!.id, id);
    await h.call('novel_scene_split', { chapter: 2, scene: 1, splitAtLine: 1 }, f.ctx);
    const split = scanScenes(f.root, 'novel'); assert.equal(split.get('02-01')!.id, id);
    assert.notEqual(split.get('02-02')!.id, id);
    assert.match(fs.readFileSync(split.get('02-02')!.filePath, 'utf8'), new RegExp(id!));
    await assert.rejects(h.call('novel_scene_merge', { chapter: 2, scene1: 1, scene2: 1 }, f.ctx), /itself/);
  } finally { f.dispose(); }
});
test('read-only legacy scan does not migrate files and duplicate IDs fail', () => {
  const f = projectFixture('short-story');
  try {
    const dir = path.join(f.root, 'manuscript/scenes'); fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'scene-01.md'); const original = '---\nscene: 1\n---\nOriginal.';
    fs.writeFileSync(file, original); assert.equal(scanScenes(f.root, 'short-story').get('01-01')!.id, undefined);
    assert.equal(fs.readFileSync(file, 'utf8'), original);
    const id = newId(); fs.writeFileSync(file, `---\nid: "${id}"\nscene: 1\n---\nA`);
    fs.writeFileSync(path.join(dir, 'scene-02.md'), `---\nid: "${id}"\nscene: 2\n---\nB`);
    assert.throws(() => scanScenes(f.root, 'short-story'), /Duplicate stable/);
  } finally { f.dispose(); }
});
