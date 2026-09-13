import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const tests = fs.readdirSync('tests').filter(file => file.endsWith('.test.ts')).sort().map(file => `tests/${file}`);
if (!tests.length) throw new Error('No regression tests found');
const result = spawnSync(process.execPath, ['--experimental-strip-types', '--test', ...tests], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
