import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { LiteraryStore, recoverStoreLock, inspectStoreLock } from '../extensions/llgf/store.ts';
import { newId } from '../extensions/llgf/version.ts';
import { projectFixture } from './helpers.ts';

test('restoration switches all accepted representations while retaining working files and history', () => {
  const f = projectFixture(); try {
    const store = LiteraryStore.initialize(f.root), id = newId(); fs.writeFileSync(path.join(f.root, 'author.md'), 'New manual wording');
    const old = store.put('prose', id, 'old'), state = store.put('proposition', newId(), 'old fact'), voice = store.put('voice', newId(), 'old voice');
    const first = store.commit({ expectedHead: store.head().hash, requestId: 'first', changes: [old, state, voice], dependencies: [] });
    const revised = store.put('prose', id, 'new'), added = store.put('proposition', newId(), 'new fact');
    const second = store.commit({ expectedHead: first.hash, requestId: 'second', changes: [revised, added], dependencies: [] });
    const preview = store.previewRestore(first.hash); assert.equal(store.head().hash, second.hash);
    const restored = store.restore(preview, preview.digest); assert.equal(restored.snapshot.parent, second.hash);
    assert.equal(store.get(old.key)!.payload, 'old'); assert.equal(store.get(state.key)!.payload, 'old fact'); assert.equal(store.get(voice.key)!.payload, 'old voice');
    assert.equal(store.get(added.key), null); assert.equal(store.artifact(added.hash).payload, 'new fact');
    assert.equal(fs.readFileSync(path.join(f.root, 'author.md'), 'utf8'), 'New manual wording');
    assert.throws(() => store.restore(preview, preview.digest), /stale/);
    assert.throws(() => store.restore(store.previewRestore(second.hash), 'wrong'), /approval/);
  } finally { f.dispose(); }
});
test('stale and edited restoration previews cannot overwrite later acceptance', () => {
  const f = projectFixture(); try {
    const store = LiteraryStore.initialize(f.root), first = store.head(), ref = store.put('voice', newId(), 'voice');
    store.commit({ expectedHead: first.hash, requestId: 'one', changes: [ref], dependencies: [] });
    const preview = store.previewRestore(first.hash), modified = structuredClone(preview); modified.changes = [];
    assert.throws(() => store.restore(modified, modified.digest), /modified/);
    const newRef = store.put('voice', newId(), 'another'); store.commit({ expectedHead: store.head().hash, requestId: 'two', changes: [newRef], dependencies: [] });
    assert.throws(() => store.restore(preview, preview.digest), /stale/);
  } finally { f.dispose(); }
});
test('failed restoration publication leaves the entire prior accepted snapshot in place', () => {
  const f = projectFixture(); try {
    const store = LiteraryStore.initialize(f.root), first = store.head(), ref = store.put('voice', newId(), 'voice');
    const second = store.commit({ expectedHead: first.hash, requestId: 'one', changes: [ref], dependencies: [] });
    const faulty = LiteraryStore.open(f.root, { beforeHeadSwap: () => { throw new Error('fault'); } });
    const preview = faulty.previewRestore(first.hash); assert.throws(() => faulty.restore(preview, preview.digest), /fault/);
    assert.equal(store.head().hash, second.hash); assert.equal(store.get(ref.key)!.payload, 'voice');
  } finally { f.dispose(); }
});
test('live, foreign or unidentifiable store locks are never stolen', () => {
  const f = projectFixture(); try {
    LiteraryStore.initialize(f.root); const token = newId(), file = path.join(f.root, '.pnw/write.lock');
    const lock = { token, pid: process.pid, host: os.hostname(), createdAt: new Date().toISOString() };
    fs.writeFileSync(file, JSON.stringify(lock)); assert.equal(inspectStoreLock(f.root)!.token, token);
    assert.throws(() => recoverStoreLock(f.root, token), /still running/);
    fs.writeFileSync(file, JSON.stringify({ ...lock, host: 'another-machine' })); assert.throws(() => recoverStoreLock(f.root, token), /another machine/);
    fs.writeFileSync(file, JSON.stringify({ pid: 999999, token })); assert.throws(() => recoverStoreLock(f.root, token), /Invalid/);
    assert.equal(fs.existsSync(file), true);
  } finally { f.dispose(); }
});
