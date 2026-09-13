import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { git, githubUrl, gitBranch, previewGit, commitPreview, shareablePath, redactGitOutput } from '../extensions/utils/git.ts';

test('Git destinations cannot contain credentials, options, or other hosts', () => {
  assert.equal(githubUrl('https://github.com/owner/repo'), 'https://github.com/owner/repo.git');
  for (const url of ['https://token@github.com/a/b', 'https://example.com/a/b', 'https://github.com/a/b?x=1', 'file:///tmp/repo']) assert.throws(() => githubUrl(url));
  for (const branch of ['--all', 'a/../b', 'x$(touch file)', 'HEAD', 'a.lock', 'a//b']) assert.throws(() => gitBranch(branch));
  assert.equal(gitBranch('feature/voice-control'), 'feature/voice-control');
});
test('private artifacts cannot enter the publication selection', () => {
  for (const file of ['.pnw/objects/abc', '.pi/github.json', '.env.local', 'notes/revisions/a.md', 'key.pem', '../scene.md', '.git/config']) assert.equal(shareablePath(file), false, file);
  assert.equal(shareablePath('manuscript/chapters/01/scene-01.md'), true);
  assert.equal(redactGitOutput('https://ghp_ABC@github.com/a/b github_pat_SECRET'), 'https://[redacted]@github.com/a/b [redacted]');
});
test('commit is bound to reviewed bytes and refuses unrelated staged files', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pnw-git-'));
  try {
    await git(dir, ['init', '--initial-branch', 'main']);
    await git(dir, ['config', 'user.name', 'Test']); await git(dir, ['config', 'user.email', 'test@example.invalid']);
    fs.writeFileSync(path.join(dir, 'scene.md'), 'Original.');
    let preview = await previewGit(dir);
    fs.writeFileSync(path.join(dir, 'scene.md'), 'Changed.');
    await assert.rejects(commitPreview(dir, 'Update', ['scene.md'], preview.hash), /fresh preview/);
    preview = await previewGit(dir);
    const commit = await commitPreview(dir, 'literal $(not-a-command)', ['scene.md'], preview.hash);
    assert.match(commit, /^[a-f0-9]{40}$/);
    assert.equal((await git(dir, ['log', '-1', '--format=%s'])).trim(), 'literal $(not-a-command)');
    fs.writeFileSync(path.join(dir, 'scene.md'), 'Next.'); fs.writeFileSync(path.join(dir, 'other.md'), 'Unrelated.');
    await git(dir, ['add', '--', 'other.md']); preview = await previewGit(dir, ['scene.md']);
    await assert.rejects(commitPreview(dir, 'Update', ['scene.md'], preview.hash), /Unrelated/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('CRLF and declared Git line-ending filters are previewed correctly', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pnw-crlf-'));
  try {
    await git(dir, ['init', '--initial-branch', 'main']);
    await git(dir, ['config', 'user.name', 'Test']); await git(dir, ['config', 'user.email', 'test@example.invalid']);
    fs.writeFileSync(path.join(dir, '.gitattributes'), '*.md text eol=lf\n');
    fs.writeFileSync(path.join(dir, 'scene.md'), 'One.\r\nTwo.\r\n');
    const preview = await previewGit(dir);
    await commitPreview(dir, 'Review CRLF', preview.paths, preview.hash);
    assert.equal(await git(dir, ['show', 'HEAD:scene.md']), 'One.\nTwo.\n');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('selected secret-like content blocks publication and nested parent repositories are rejected', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pnw-secrets-'));
  try {
    await git(dir, ['init', '--initial-branch', 'main']);
    fs.writeFileSync(path.join(dir, 'notes.md'), '-----BEGIN PRIVATE KEY-----');
    await assert.rejects(previewGit(dir), /Secret-like/);
    const nested = path.join(dir, 'nested'); fs.mkdirSync(nested);
    await assert.rejects(previewGit(nested), /parent directory/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
