import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { projectPath } from './safety.ts';
import { pathsEqual } from './platform.ts';

const execute = promisify(execFile);
const hash = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');
export function redactGitOutput(text: string): string {
  return text.replace(/https:\/\/[^\s/@]+(?::[^\s/@]*)?@/g, 'https://[redacted]@')
    .replace(/\b(?:ghp_|github_pat_)[A-Za-z0-9_]+/g, '[redacted]');
}
export async function git(root: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execute('git', args, {
      cwd: root, windowsHide: true, timeout: 60_000, maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_LITERAL_PATHSPECS: '1' },
    });
    return stdout;
  } catch (error) {
    const e = error as Error & { stderr?: string };
    throw new Error(redactGitOutput(e.stderr?.trim() || e.message));
  }
}

export function githubUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.username || url.password || url.port || url.search || url.hash ||
      !/^\/[A-Za-z0-9][A-Za-z0-9_-]*\/[A-Za-z0-9_.-]+(?:\.git)?\/?$/.test(url.pathname)) throw new Error('Use a credential-free HTTPS github.com repository URL');
  const repo = url.pathname.replace(/\/$/, '').replace(/\.git$/, '');
  if (!repo.split('/').at(-1) || repo.split('/').some(x => x === '.' || x === '..')) throw new Error('Invalid repository URL');
  return `https://github.com${repo}.git`;
}
export function gitBranch(branch: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(branch) || branch.includes('..') || branch.includes('//') ||
      branch.split('/').some(s => !s || s.startsWith('.') || s.endsWith('.') || s.endsWith('.lock')) || branch === 'HEAD') throw new Error('Invalid branch name');
  return branch;
}
export async function requireRepositoryRoot(root: string): Promise<void> {
  const top = (await git(root, ['rev-parse', '--show-toplevel'])).trim();
  if (!pathsEqual(fs.realpathSync(root), fs.realpathSync(top))) throw new Error('The Git repository must be rooted at this novel, not a parent directory');
}
export function shareablePath(relative: string): boolean {
  const segments = relative.replace(/\\/g, '/').split('/');
  if (segments.some(s => !s || s === '.' || s === '..' || ['.git', '.pnw', '.pi', 'node_modules'].includes(s.toLowerCase()))) return false;
  const name = segments.at(-1)!.toLowerCase();
  return !name.startsWith('.env') && !/\.(pem|key|p12|pfx)$/.test(name) && !/^(id_rsa|id_ed25519|credentials)(\.|$)/.test(name)
    && !/^notes\/(revisions|deleted-scenes)\//i.test(relative.replace(/\\/g, '/'));
}
export interface GitPreview {
  hash: string;
  head: string;
  branch: string;
  paths: string[];
  excluded: string[];
  contentHashes: Record<string, string>;
  indexHashes: Record<string, string>;
}
export async function previewGit(root: string, requested?: string[]): Promise<GitPreview> {
  await requireRepositoryRoot(root);
  const changed = new Set([
    ...(await git(root, ['diff', '--name-only', '-z'])).split('\0'),
    ...(await git(root, ['diff', '--cached', '--name-only', '-z'])).split('\0'),
    ...(await git(root, ['ls-files', '--others', '--exclude-standard', '-z'])).split('\0'),
  ].filter(Boolean));
  const excluded = [...changed].filter(p => !shareablePath(p)).sort();
  const selected = [...new Set(requested ?? [...changed].filter(shareablePath))].sort();
  const contentHashes: Record<string, string> = Object.create(null);
  const indexHashes: Record<string, string> = Object.create(null);
  for (const relative of selected) {
    if (!shareablePath(relative) || !changed.has(relative)) throw new Error(`Not an eligible changed file: ${relative}`);
    const file = projectPath(root, relative);
    if (fs.existsSync(file)) {
      if (!fs.lstatSync(file).isFile()) throw new Error('Stage individual regular files, not directories or symlinks');
      const bytes = fs.readFileSync(file);
      if (/-----BEGIN [A-Z ]*PRIVATE KEY-----|\bghp_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}/.test(bytes.toString('utf8'))) throw new Error(`Secret-like content in selected file: ${relative}`);
      contentHashes[relative] = hash(bytes);
      indexHashes[relative] = (await git(root, ['hash-object', '--path', relative, '--', file])).trim();
    } else contentHashes[relative] = 'deleted';
  }
  let head: string;
  try { head = (await git(root, ['rev-parse', '--verify', 'HEAD'])).trim(); } catch { head = 'unborn'; }
  const branch = gitBranch((await git(root, ['symbolic-ref', '--short', 'HEAD'])).trim());
  const staged = (await git(root, ['diff', '--cached', '--name-only', '-z'])).split('\0').filter(Boolean).sort();
  const digest = hash(JSON.stringify({ head, branch, selected, contentHashes, indexHashes, staged }));
  return { hash: digest, head, branch, paths: selected, excluded, contentHashes, indexHashes };
}

/** Commit only the exact previewed content. Remote publication is a separate call. */
export async function commitPreview(root: string, message: string, paths: string[], expectedHash: string): Promise<string> {
  if (!message.trim() || message.includes('\0') || message.length > 1000) throw new Error('Invalid commit message');
  const preview = await previewGit(root, paths);
  if (preview.hash !== expectedHash) throw new Error('Files or staging changed. Review a fresh preview before committing');
  if (!paths.length) throw new Error('Select at least one changed file');
  const staged = (await git(root, ['diff', '--cached', '--name-only', '-z'])).split('\0').filter(Boolean);
  if (staged.some(p => !preview.paths.includes(p))) throw new Error('Unrelated files are already staged. They have been left untouched');
  await git(root, ['add', '--', ...preview.paths]);
  // Detect a write between preview and git-add; never commit unchecked bytes.
  for (const p of preview.paths) {
    const expected = preview.contentHashes[p];
    if (expected === 'deleted') {
      if ((await git(root, ['ls-files', '-z', '--', p])).trim()) throw new Error('Deleted file reappeared while staging');
    } else {
      const stagedHash = (await git(root, ['rev-parse', `:${p}`])).trim();
      if (stagedHash !== preview.indexHashes[p]) throw new Error('File content or Git clean filters changed staged bytes. Inspect the index before committing');
    }
  }
  const finalStaged = (await git(root, ['diff', '--cached', '--name-only', '-z'])).split('\0').filter(Boolean);
  if (finalStaged.some(p => !preview.paths.includes(p))) throw new Error('Unrelated files became staged; inspect the index before committing');
  const branch = (await git(root, ['symbolic-ref', '--short', 'HEAD'])).trim();
  let head = 'unborn';
  try { head = (await git(root, ['rev-parse', '--verify', 'HEAD'])).trim(); } catch { /* Initial commit. */ }
  if (branch !== preview.branch || head !== preview.head) throw new Error('Git HEAD changed while staging; review again');
  await git(root, ['commit', '-m', message]);
  return (await git(root, ['rev-parse', 'HEAD'])).trim();
}
