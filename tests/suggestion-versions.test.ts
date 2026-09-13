import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import core, { parseFrontmatter } from '../extensions/novel-core.ts';
import edit from '../extensions/novel-edit.ts';
import { proseHash } from '../extensions/llgf/version.ts';
import { fakePi } from './helpers.ts';
import { pipelineFixture } from './pipeline-helpers.ts';
async function fixture() {
  const f = pipelineFixture(), pi = fakePi(); core(pi.api); edit(pi.api); await pi.commands.get('PNW-load')!.handler(f.root, f.ctx);
  const make = () => pi.call('edit_suggest', { chapter: 1, scene: 1, original_text: 'Nobody answered.', suggested_text: 'No one answered.', rationale: 'Author choice', expectedSourceHash: proseHash(f.body) });
  const pending = () => JSON.parse(fs.readFileSync(path.join(f.root, '.pi/edit-suggestions.json'), 'utf8'));
  return { ...f, pi, make, pending };
}
test('suggestion acceptance rejects changed context even when the original phrase remains', async () => {
  const f = await fixture(); try {
    await f.make(); const id = f.pending().pending[0].id;
    fs.appendFileSync(f.file, '\nSomeone else arrived.'); const before = fs.readFileSync(f.file, 'utf8');
    await assert.rejects(f.pi.call('edit_accept', { id }), /Source version changed/);
    assert.equal(fs.readFileSync(f.file, 'utf8'), before); assert.equal(f.pending().pending.length, 1);
    await assert.rejects(f.make(), /Source version changed/);
  } finally { f.dispose(); }
});
test('versioned suggestions follow stable identities across a scene move', async () => {
  const f = await fixture(); try {
    await f.make(); const id = f.pending().pending[0].id;
    await f.pi.call('novel_scene_move', { chapter: 1, scene: 1, targetChapter: 2 });
    await f.pi.call('edit_accept', { id });
    const moved = path.join(f.root, 'manuscript/chapters/02/scene-01.md');
    assert.equal(parseFrontmatter(fs.readFileSync(moved, 'utf8')).body, f.body.replace('Nobody answered.', 'No one answered.'));
    assert.equal(f.pending().accepted.length, 1); assert.equal(f.pending().pending.length, 0);
  } finally { f.dispose(); }
});
test('unversioned legacy suggestions and stale line addresses require new source evidence', async () => {
  const f = await fixture(); try {
    await f.make(); const data = f.pending(); delete data.pending[0].sourceHash;
    fs.writeFileSync(path.join(f.root, '.pi/edit-suggestions.json'), JSON.stringify(data));
    await assert.rejects(f.pi.call('edit_accept', { id: data.pending[0].id }), /no source version/);
    fs.appendFileSync(f.file, '\nSecond line.');
    await assert.rejects(f.pi.call('edit_line', { chapter: 1, scene: 1, line_start: 1, line_end: 1, new_content: 'Replacement.', expectedSourceHash: proseHash(f.body) }), /Source version changed/);
    assert.ok(fs.readFileSync(f.file, 'utf8').includes(f.body));
  } finally { f.dispose(); }
});
