import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { projectPath, sceneMetadata } from '../extensions/utils/safety.ts';
import { scanScenes, parseFrontmatter } from '../extensions/novel-core.ts';
import { validateFilename, pathsEqual, toSafeFilename } from '../extensions/utils/platform.ts';

function fixture(fn: (root: string, outside: string) => void) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pnw-safety-'));
  const root = path.join(dir, 'project'); fs.mkdirSync(root);
  try { fn(root, dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('rejects lexical escape, prefix tricks, NUL and escaping symlink ancestors', () => fixture((root, outside) => {
  assert.throws(() => projectPath(root, '../other/file.md'), /escapes/);
  assert.throws(() => projectPath(root, root + '-other/file.md'), /escapes/);
  assert.throws(() => projectPath(root, '\0'), /Invalid/);
  fs.symlinkSync(outside, path.join(root, 'escape'), 'dir');
  assert.throws(() => projectPath(root, 'escape/not-yet-created/file.md'), /Symlink/);
  fs.symlinkSync(path.join(outside, 'missing'), path.join(root, 'dangling'));
  assert.throws(() => projectPath(root, 'dangling/file.md'), /Dangling/);
  assert.equal(projectPath(root, 'notes/new.md'), path.join(root, 'notes/new.md'));
}));

test('metadata cannot override derived path, chapter or poison prototypes', () => {
  const { meta } = parseFrontmatter('---\n__proto__: {"polluted":true}\nfilePath: "/tmp/elsewhere"\nchapter: 99\n---\n');
  const safe = sceneMetadata(meta, { chapter: 1, scene: 2, filePath: '/project/real.md' });
  assert.equal(safe.filePath, '/project/real.md'); assert.equal(safe.chapter, 1);
  assert.equal(({} as any).polluted, undefined);
  assert.throws(() => sceneMetadata({ characters_present: 'someone' }, { chapter: 1, scene: 1, filePath: 'x' }), /array/);
});

test('scanner preserves actual paths and rejects duplicate addresses', () => fixture(root => {
  const dir = path.join(root, 'manuscript/scenes'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'scene-01.md'), '---\nscene: 1\nfilePath: "/tmp/elsewhere"\n---\nSnow.');
  assert.equal(scanScenes(root, 'short-story').get('01-01')?.filePath, path.join(dir, 'scene-01.md'));
  fs.copyFileSync(path.join(dir, 'scene-01.md'), path.join(dir, 'duplicate.md'));
  assert.throws(() => scanScenes(root, 'short-story'), /Duplicate/);
}));

test('scanner refuses outside prose before reading it', () => fixture((root, outside) => {
  fs.mkdirSync(path.join(root, 'manuscript'));
  fs.writeFileSync(path.join(outside, 'secret.md'), 'do not read');
  fs.symlinkSync(path.join(outside, 'secret.md'), path.join(root, 'manuscript/story.md'));
  assert.throws(() => scanScenes(root, 'flash-fiction'), /Symlink/);
}));

test('portable names and platform-correct case comparisons', () => {
  assert.equal(validateFilename('../escape').valid, false);
  assert.equal(validateFilename('con.md').valid, false);
  assert.equal(toSafeFilename('CON'), 'x-con');
  if (process.platform !== 'win32') assert.equal(pathsEqual('/A', '/a'), false);
});

// A project root itself may be a user-selected symlink. Returned canonical paths
// must remain acceptable on later calls. Interior escapes remain forbidden.
test('canonical paths work when the selected project root is a symlink', () => fixture((root, outside) => {
  const alias = path.join(outside, 'alias'); fs.symlinkSync(root, alias, 'dir');
  const resolved = projectPath(alias, 'scene.md');
  assert.equal(projectPath(alias, resolved), resolved);
}));
