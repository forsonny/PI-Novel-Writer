import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : entry.name.endsWith('.ts') ? [path.join(dir, entry.name)] : []);
}
for (const file of [...walk('extensions'), ...walk('tests')]) {
  const result = spawnSync(process.execPath, ['--experimental-strip-types', '--check', file], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
