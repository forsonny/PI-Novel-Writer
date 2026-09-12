// Temporary branch-only transport for reviewed patches; removed before release.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const file = '.pnw-dev/queued.patch';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
if (process.env.GITHUB_EVENT_NAME !== 'push' || process.env.GITHUB_REF !== 'refs/heads/feat/beyond-fluency-reviewed') throw new Error('Development branch only');
if (fs.existsSync(file)) {
  const source = fs.readFileSync(file, 'utf8');
  const match = /^PNW-BASE: ([a-f0-9]{40})\nPNW-MESSAGE: ([^\r\n]{1,160})\n\n/.exec(source);
  if (!match || git('rev-parse', 'HEAD^') !== match[1]) throw new Error('Patch base changed');
  if (!source.slice(match[0].length).startsWith('diff --git ')) throw new Error('Not a Git patch');
  fs.writeFileSync('/tmp/pnw-reviewed.patch', source.slice(match[0].length));
  git('apply', '--check', '--index', '/tmp/pnw-reviewed.patch');
  git('apply', '--index', '/tmp/pnw-reviewed.patch');
  git('rm', '--', file);
  fs.writeFileSync('/tmp/pnw-reviewed-message', match[2]);
  git('diff', '--cached', '--check');
  console.log(git('diff', '--cached', '--stat'));
}
