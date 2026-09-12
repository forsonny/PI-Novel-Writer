import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { LiteraryStore } from '../extensions/llgf/store.ts';
import { newId } from '../extensions/llgf/version.ts';
import { checked, Span, verifySpan } from '../extensions/llgf/schema.ts';
import { proseHash } from '../extensions/llgf/version.ts';
import { projectFixture } from './helpers.ts';

test('prose and state commit together; candidates alone never change HEAD', () => {
  const f = projectFixture();
  try {
    const store = LiteraryStore.initialize(f.root); const before = store.head();
    const scene = store.put('scene', newId(), { body: 'A silence.' }); const state = store.put('state', newId(), { knows: false });
    assert.equal(store.head().hash, before.hash); assert.equal(store.get(scene.key), null);
    const result = store.commit({ expectedHead: before.hash, requestId: 'scene-one', changes: [scene, state], dependencies: [] });
    assert.equal(Object.keys(result.snapshot.versions).length, 2); assert.deepEqual(store.get(state.key)?.payload, { knows: false });
    assert.equal(store.snapshot(before.hash).versions[scene.key], undefined);
  } finally { f.dispose(); }
});
test('failed acceptance leaves the old accepted snapshot and permits safe retry', () => {
  const f = projectFixture();
  try {
    const normal = LiteraryStore.initialize(f.root); const before = normal.head(); const ref = normal.put('scene', newId(), { body: 'Candidate' });
    const failing = LiteraryStore.open(f.root, { beforeHeadSwap: () => { throw new Error('simulated crash'); } });
    const req = { expectedHead: before.hash, requestId: 'crash', changes: [ref], dependencies: [] };
    assert.throws(() => failing.commit(req), /simulated/); assert.equal(normal.head().hash, before.hash);
    const accepted = normal.commit(req); assert.equal(normal.commit(req).hash, accepted.hash); assert.equal(normal.commit(req).replayed, true);
    assert.throws(() => normal.commit({ ...req, changes: [normal.put('scene', newId(), { body: 'Other' })] }), /Idempotency/);
  } finally { f.dispose(); }
});
test('stale heads, dependencies, cross-project objects and corrupt objects fail closed', () => {
  const f = projectFixture(); const other = projectFixture();
  try {
    const a = LiteraryStore.initialize(f.root); const b = LiteraryStore.initialize(other.root); const before = a.head();
    const x = a.put('state', newId(), { rumor: true }); a.commit({ expectedHead: before.hash, requestId: 'first', changes: [x], dependencies: [] });
    assert.throws(() => a.commit({ expectedHead: before.hash, requestId: 'stale', changes: [x], dependencies: [] }), /snapshot changed/);
    const newer = a.put('state', x.key.split(':')[1], { rumor: false });
    assert.throws(() => a.commit({ expectedHead: a.head().hash, requestId: 'dep', changes: [newer], dependencies: [{ ...x, hash: newer.hash }] }), /dependencies/);
    const foreign = b.put('state', newId(), { private: true });
    fs.copyFileSync(path.join(other.root, '.pnw/objects', foreign.hash + '.json'), path.join(f.root, '.pnw/objects', foreign.hash + '.json'));
    assert.throws(() => a.commit({ expectedHead: a.head().hash, requestId: 'foreign', changes: [foreign], dependencies: [] }), /another project/);
    fs.writeFileSync(path.join(f.root, '.pnw/objects', newer.hash + '.json'), '{}'); assert.throws(() => a.artifact(newer.hash), /hash mismatch/);
  } finally { f.dispose(); other.dispose(); }
});
test('outstanding lock is not silently stolen and artifact key identity is checked', () => {
  const f = projectFixture();
  try {
    const s = LiteraryStore.initialize(f.root); const ref = s.put('state', newId(), {});
    fs.writeFileSync(path.join(f.root, '.pnw/write.lock'), '{}');
    assert.throws(() => s.commit({ expectedHead: s.head().hash, requestId: 'lock', changes: [ref], dependencies: [] }), /locked/);
    fs.unlinkSync(path.join(f.root, '.pnw/write.lock'));
    assert.throws(() => s.commit({ expectedHead: s.head().hash, requestId: 'identity', changes: [{ ...ref, key: 'scene:' + newId() }], dependencies: [] }), /wrong identity/);
  } finally { f.dispose(); }
});
test('evidence offsets are explicit UTF-16 and bound to the complete text hash', () => {
  const text = '雪 🐦 waits.'; const hash = proseHash(text);
  const span = checked(Span, { sceneId: newId(), textHash: hash, start: 2, end: 4, quote: '🐦', offsetUnit: 'utf16' });
  verifySpan(span, text, hash); assert.throws(() => verifySpan({ ...span, end: 3 }, text, hash), /does not match/);
  assert.throws(() => verifySpan(span, text + '!', proseHash(text + '!')), /does not match/);
  assert.throws(() => verifySpan({ ...span, end: 100, quote: text.slice(2) }, text, hash), /does not match/);
  assert.throws(() => verifySpan(span, text + '!', hash), /does not match/);
});

test('retrying an old successful request cannot roll back later acceptance', () => {
  const f = projectFixture();
  try {
    const s = LiteraryStore.initialize(f.root); const x = s.put('state', newId(), { value: 1 });
    const first = { expectedHead: s.head().hash, requestId: 'one', changes: [x], dependencies: [] };
    s.commit(first); const y = s.put('state', x.key.split(':')[1], { value: 2 });
    const latest = s.commit({ expectedHead: s.head().hash, requestId: 'two', changes: [y], dependencies: [x] });
    assert.equal(s.commit(first).replayed, true); assert.equal(s.head().hash, latest.hash);
    assert.deepEqual(s.get(x.key)?.payload, { value: 2 }); assert.deepEqual(s.stale([x]), [x]);
  } finally { f.dispose(); }
});
