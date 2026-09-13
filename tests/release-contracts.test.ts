import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { schemaCatalogue } from '../extensions/llgf/catalogue.ts';
import { LiteraryStore } from '../extensions/llgf/store.ts';
import { newId, proseHash } from '../extensions/llgf/version.ts';
import { exportManuscript } from '../extensions/llgf/manuscript.ts';
import { readProjectSnapshot, countWords } from '../extensions/novel-core.ts';
import { projectFixture, fakePi } from './helpers.ts';
import literaryExtension from '../extensions/novel-literary.ts';

test('all machine-readable schemas exactly match the installed runtime source', () => {
  assert.ok(Object.keys(schemaCatalogue).length >= 25);
  for (const [name, schema] of Object.entries(schemaCatalogue)) {
    const raw = fs.readFileSync(new URL(`../schemas/${name}.schema.json`, import.meta.url), 'utf8');
    assert.equal(raw, JSON.stringify(schema, null, 2) + '\n', name);
  }
});

test('a synthetic 100k-word snapshot exports unchanged after later prose updates without claiming literary review', () => {
  const f = projectFixture();
  try {
    const store = LiteraryStore.initialize(f.root), initial = store.head();
    const changes = [], bodies: string[] = [], ids: string[] = [];
    const condition = { focalizerId: null, sceneFunction: 'synthetic storage fixture', secondaryFunctions: [], pressure: 'none', distance: 'external', epochId: null, storyTime: { earliest: 0, latest: 0, label: 'fixture' }, narrativeIndex: 0 };
    for (let i = 0; i < 50; i++) {
      const id = newId(), chapter = Math.floor(i / 5) + 1, scene = i % 5 + 1;
      const relative = `manuscript/chapters/${String(chapter).padStart(2, '0')}/scene-${String(scene).padStart(2, '0')}.md`;
      const body = Array.from({ length: 400 }, () => `Passage${i} keeps five exact words.`).join('\n\n');
      assert.equal(countWords(body), 2000); bodies.push(body); ids.push(id);
      fs.mkdirSync(path.dirname(path.join(f.root, relative)), { recursive: true });
      fs.writeFileSync(path.join(f.root, relative), `---\nid: "${id}"\nchapter: ${chapter}\nscene: ${scene}\nstatus: "draft"\n---\n${body}`);
      changes.push(store.put('prose', id, { address: { id, path: relative, chapter, scene, order: scene, narrativeIndex: i }, body, textHash: proseHash(body), condition: { ...condition, narrativeIndex: i }, transmissionApproved: false }));
    }
    const frozen = store.commit({ expectedHead: initial.hash, requestId: 'synthetic-100k-storage', changes, dependencies: [] });
    const first = store.get(`prose:${ids[0]}`)!.payload as Record<string, unknown>;
    store.commit({ expectedHead: frozen.hash, requestId: 'later-edition', changes: [store.put('prose', ids[0], { ...first, body: 'Changed later.', textHash: proseHash('Changed later.') })], dependencies: [] });
    const p = readProjectSnapshot(f.root), out = exportManuscript(p, { mode: 'accepted', snapshotHash: frozen.hash });
    const text = fs.readFileSync(out.path, 'utf8'), manifest = JSON.parse(fs.readFileSync(out.manifestPath, 'utf8'));
    assert.equal(manifest.words, 100000); assert.equal(manifest.sceneCount, 50);
    assert.ok(bodies.every(body => text.includes(body))); assert.ok(!text.includes('Changed later.'));
    assert.equal(text.match(/^# Chapter /gm)?.length, 10); assert.equal(text.match(/^\* \* \*$/gm)?.length, 40);
    assert.ok(out.warnings.some(w => w.includes('50 accepted scenes need reassessment')));
    assert.throws(() => exportManuscript(p, { mode: 'accepted', snapshotHash: frozen.hash, requireComplete: true }), /current assessments/);
  } finally { f.dispose(); }
});


test('the Pi schema tool exposes catalogue names as well as compatibility aliases', async () => {
  const pi = fakePi(); literaryExtension(pi.api);
  const response = await pi.call('novel_literary_schema', { name: 'protected_property' });
  assert.deepEqual(JSON.parse(response.content[0].text), JSON.parse(JSON.stringify(schemaCatalogue.protected_property)));
  const alias = await pi.call('novel_literary_schema', { name: 'voice' });
  assert.deepEqual(JSON.parse(alias.content[0].text), JSON.parse(JSON.stringify(schemaCatalogue.author_voice_spec)));
});
