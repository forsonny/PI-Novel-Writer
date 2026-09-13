// Temporary branch-only transport for reviewed patches; removed before release.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
const file = '.pnw-dev/queued.patch';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const digest = value => createHash('sha256').update(value).digest('hex');
if (process.env.GITHUB_EVENT_NAME !== 'push' || process.env.GITHUB_REF !== 'refs/heads/feat/beyond-fluency-reviewed') throw new Error('Development branch only');
if (fs.existsSync(file)) {
  let source = fs.readFileSync(file, 'utf8');
  let expectedPatch;
  // Repair only the identified corrupted transport. The intended bytes and
  // decompressed patch are independently checked; gzip CRC remains mandatory.
  if (digest(source) === '7071a211498300d19876839280f26819a8475e908ad013f9cd0b7858b1cc4185') {
    source = source.replace('CmMB+EI d/DCm82', 'CmMB+Id/DCm82')
      .replace('UHEye09ZZPAsrx', 'UHEye09ZPAsrx')
      .replace('dtbIz8a3K5P2qMn', 'dtbIz8a3K7P2qMn')
      .replace('8HdGu5yF3t+XV', '8HdGu5yF/t+XV');
    if (digest(source) !== '8118109572a5fd49148caa110bb4a31e2d85c2da7989c7123d462fcc5890a09b') throw new Error('Transport repair mismatch');
    expectedPatch = 'e98ba6954734693afd7ee78fe131e9e1693f6186e74294d47b6a7b1e89048b65';
  }
  const match = /^PNW-BASE: ([a-f0-9]{40})\nPNW-MESSAGE: ([^\r\n]{1,160})\n(?:PNW-ENCODING: (gzip-base64)\n)?\n/.exec(source);
  if (!match) throw new Error('Invalid patch envelope');
  if (git('rev-parse', 'HEAD^') !== match[1]) {
    if (!expectedPatch) throw new Error('Patch base changed');
    git('fetch', '--no-tags', 'origin', match[1]);
    const changed = git('diff', '--name-only', match[1], 'HEAD').split('\n').filter(Boolean);
    if (changed.some(p => ![file, 'scripts/apply-reviewed-change.mjs'].includes(p))) throw new Error('Source changed since reviewed patch');
  }
  const body = source.slice(match[0].length);
  const patch = match[3] ? gunzipSync(Buffer.from(body.trim(), 'base64'), { maxOutputLength: 4 * 1024 * 1024 }).toString('utf8') : body;
  if (expectedPatch && digest(patch) !== expectedPatch) throw new Error('Reviewed patch checksum mismatch');
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
