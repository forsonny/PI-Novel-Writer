import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { projectFixture } from './helpers.ts';
import { mergeGuidance, previewMigration, applyMigration, managedProject } from '../extensions/llgf/migration.ts';
const base = 'Preamble\n\n## Voice\nOld voice.\n\n## Safety\nKeep work.\n';
const next = base.replace('Old voice.', 'Conditional voice.');
function fixture() { const f = projectFixture(); fs.mkdirSync(path.join(f.root, 'manuscript')); const rel = 'manuscript/story.md'; const original = '---\r\nchapter: 1\r\nscene: 1\r\ncustom_field: "Author value"\r\n---\r\nThe door was open.\r\n'; fs.writeFileSync(path.join(f.root, rel), original); return { ...f, rel, original }; }
test('guidance three-way merge preserves unrelated author additions and explicit conflicts', () => {
  const ours = base.replace('Keep work.', 'Keep my original spelling.');
  const merged = mergeGuidance(base, ours, next); assert.deepEqual(merged.conflicts, []); assert.match(merged.text, /Conditional voice/); assert.match(merged.text, /my original spelling/);
  const conflict = mergeGuidance(base, base.replace('Old voice.', 'My voice.'), next); assert.equal(conflict.conflicts.length, 1); assert.match(conflict.text, /My voice/); assert.doesNotMatch(conflict.text, /Conditional voice/);
  assert.equal(mergeGuidance(null, ours, next).text, ours);
});
test('migration preview is read-only and preserves prose, CRLF and unknown fields', () => {
  const f = fixture(); try {
    const plan = previewMigration(f.root, { sceneFiles: [f.rel] }); assert.equal(fs.existsSync(path.join(f.root, '.pnw')), false);
    assert.equal(fs.readFileSync(path.join(f.root, f.rel), 'utf8'), f.original);
    assert.throws(() => applyMigration(f.root, plan, 'not approved'), /approval/);
    applyMigration(f.root, plan, plan.digest);
    assert.equal(fs.readFileSync(path.join(f.root, f.rel), 'utf8').replace(/^id:.*\r\n/m, ''), f.original);
    assert.equal(managedProject(f.root)?.enabled, false); assert.equal(managedProject(f.root)?.importedState, 'unverified');
    assert.equal(previewMigration(f.root, { sceneFiles: [f.rel] }).files.length, 0);
    assert.equal(applyMigration(f.root, plan, plan.digest).replayed, true);
  } finally { f.dispose(); }
});
test('stale or altered migration previews never replace newer author work', () => {
  const f = fixture(); try { const plan = previewMigration(f.root, { sceneFiles: [f.rel] });
    fs.appendFileSync(path.join(f.root, f.rel), 'New ending.'); assert.throws(() => applyMigration(f.root, plan, plan.digest), /stale/);
    const modified = structuredClone(plan); modified.files[0].after = '{}'; assert.throws(() => applyMigration(f.root, modified, plan.digest), /modified/);
  } finally { f.dispose(); }
});
test('failed migration rolls back its own writes and retains a verifiable backup', () => {
  const f = fixture(); try { const plan = previewMigration(f.root, { sceneFiles: [f.rel] });
    assert.throws(() => applyMigration(f.root, plan, plan.digest, i => { if (i === 1) throw new Error('disk fault'); }), /disk fault/);
    assert.equal(fs.readFileSync(path.join(f.root, f.rel), 'utf8'), f.original); assert.equal(managedProject(f.root), null);
    assert.equal(JSON.parse(fs.readFileSync(path.join(f.root, '.pnw/migrations', plan.id, 'journal.json'), 'utf8')).status, 'rolled_back');
  } finally { f.dispose(); }
});
test('migration rejects cross-root files and duplicate scene identity', () => {
  const f = fixture(); try { assert.throws(() => previewMigration(f.root, { sceneFiles: ['../other.md'] }), /escapes/);
    assert.throws(() => previewMigration(f.root, { sceneFiles: [f.rel, f.rel] }), /Duplicate/);
  } finally { f.dispose(); }
});
