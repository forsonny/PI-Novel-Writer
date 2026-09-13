// Temporary completion-branch transport; removed before release.
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
const file = '.pnw-dev/queued.patch';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
if (process.env.GITHUB_EVENT_NAME !== 'push' || process.env.GITHUB_REF !== 'refs/heads/feat/beyond-fluency-completion') throw new Error('Completion branch only');
if (fs.existsSync(file)) {
  const source = fs.readFileSync(file, 'utf8');
  const match = /^PNW-BASE: ([a-f0-9]{40})\nPNW-MESSAGE: ([^\r\n]{1,160})\n(?:PNW-ENCODING: (gzip-base64)\n)?\n/.exec(source);
  if (!match || git('rev-parse', 'HEAD^') !== match[1]) throw new Error('Patch base changed');
  const body = source.slice(match[0].length);
  const patch = match[3] ? gunzipSync(Buffer.from(body.trim(), 'base64'), { maxOutputLength: 4 * 1024 * 1024 }).toString('utf8') : body;
  if (!patch.startsWith('diff --git ')) throw new Error('Not a Git patch');
  fs.writeFileSync('/tmp/pnw-reviewed.patch', patch);
  git('apply', '--check', '--index', '/tmp/pnw-reviewed.patch');
  git('apply', '--index', '/tmp/pnw-reviewed.patch');
  git('rm', '--', file);
  if (git('diff', '--cached', '--name-only').split('\n').includes('package.json')) {
    execFileSync('npm', ['install', '--package-lock-only', '--ignore-scripts'], { stdio: 'inherit' });
    git('add', '--', 'package-lock.json');
  }
  fs.writeFileSync('/tmp/pnw-reviewed-message', match[2]);
  git('diff', '--cached', '--check');
  console.log(git('diff', '--cached', '--stat'));
}
