import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import core, { getProject, scanScenes, parseFrontmatter, buildFrontmatter, orderedScenes } from '../extensions/novel-core.ts';
import bible from '../extensions/novel-bible.ts';
import { fakePi, projectFixture } from './helpers.ts';

// These tests exercise real move/rename paths. Use the retained-file audit
// launcher on restricted workstations; no native-cleanup pass is implied.
async function fixture(format: 'novel' | 'short-story' | 'flash-fiction' = 'novel') {
  const f = projectFixture(format), host = fakePi();
  console.log(`Retained layout fixture: ${f.root}`);
  core(host.api); bible(host.api);
  await host.event('session_start', {}, f.ctx);
  await host.call('novel_scene_create', { chapter: 1 }, f.ctx);
  const scene = getProject()!.scenes.get('01-01')!;
  const { meta } = parseFrontmatter(fs.readFileSync(scene.filePath, 'utf8'));
  fs.writeFileSync(scene.filePath, buildFrontmatter(meta) + 'First words.\nSecond words.');
  return { ...f, host, scene };
}
function snapshot(root: string) {
  const files: Record<string, string> = {};
  const visit = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, e.name);
      if (e.isDirectory()) visit(file);
      else files[path.relative(root, file)] = fs.readFileSync(file).toString('base64');
    }
  };
  visit(root); return files;
}
test('O-02: short/flash chapter moves and flash splits refuse without changing prose', async () => {
  for (const format of ['short-story', 'flash-fiction'] as const) {
    const f = await fixture(format), before = snapshot(f.root);
    await assert.rejects(f.host.call('novel_scene_move', { chapter: 1, scene: 1, targetChapter: 2 }), /format|chapter|support/i);
    if (format === 'flash-fiction') await assert.rejects(f.host.call('novel_scene_split', { chapter: 1, scene: 1, splitAtLine: 1 }), /flash|support/i);
    assert.deepEqual(snapshot(f.root), before);
    assert.equal(scanScenes(f.root, format).size, 1);
  }
});
test('O-02: invalid move destinations refuse before mutation; short splitting retains both halves', async () => {
  const f = await fixture(), before = snapshot(f.root);
  for (const targetChapter of [0, -1, 1.5]) await assert.rejects(f.host.call('novel_scene_move', { chapter: 1, scene: 1, targetChapter }));
  assert.deepEqual(snapshot(f.root), before);
  const short = await fixture('short-story');
  await short.host.call('novel_scene_split', { chapter: 1, scene: 1, splitAtLine: 1 });
  const parts = orderedScenes({ ...getProject()!, scenes: scanScenes(short.root, 'short-story') });
  assert.equal(parts.length, 2);
  assert.equal(parts.map(s => parseFrontmatter(fs.readFileSync(s.filePath, 'utf8')).body).join('\n'), 'First words.\nSecond words.');
  assert.equal(parts[0].id, short.scene.id);
});
test('O-03: occupied chapter reorder refuses before any outline or prose change', async () => {
  const f = await fixture();
  await f.host.call('novel_scene_create', { chapter: 2 });
  const dir = path.join(f.root, 'outline/chapters'); fs.mkdirSync(dir, { recursive: true });
  for (const chapter of [1, 2]) fs.writeFileSync(path.join(dir, `0${chapter}-same.md`), buildFrontmatter({ chapter, title: 'Same' }) + `Outline ${chapter}`);
  const before = snapshot(f.root);
  await assert.rejects(f.host.call('outline_chapter_reorder', { oldChapter: 1, newChapter: 2 }));
  assert.deepEqual(snapshot(f.root), before);
});
test('O-03: free chapter reorder keeps stable identities and immediate/current addresses', async () => {
  const f = await fixture();
  const dir = path.join(f.root, 'outline/chapters'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, '01-first.md'), buildFrontmatter({ chapter: 1, title: 'First' }) + 'Outline');
  await f.host.call('outline_chapter_reorder', { oldChapter: 1, newChapter: 3 });
  const scene = getProject()!.scenes.get('03-01');
  assert.ok(scene);
  assert.equal(scene.id, f.scene.id);
  assert.equal(getProject()!.scenes.has('01-01'), false);
  const current = parseFrontmatter(fs.readFileSync(scene.filePath, 'utf8'));
  assert.equal(current.meta.chapter, 3);
  assert.equal(current.body, 'First words.\nSecond words.');
  assert.equal(scanScenes(f.root, 'novel').get('03-01')!.id, f.scene.id);
  const result = await f.host.call('novel_scene_read', { chapter: 3, scene: 1 });
  assert.match(result.content[0].text, /First words/);
});
