#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const destination = fs.mkdtempSync(path.join(os.tmpdir(), 'pnw-pack-check-'));
try {
  // Invoke npm's script through Node for portable Windows paths without a shell.
  const npm = process.env.npm_execpath;
  if (!npm) throw new Error('Run this check through npm run pack:check');
  const output = execFileSync(process.execPath, [npm, 'pack', '--json', '--ignore-scripts', '--pack-destination', destination], { encoding: 'utf8' });
  const info = JSON.parse(output)[0];
  const files = new Set(info.files.map(f => f.path));
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  for (const entry of [...pkg.pi.extensions, 'scripts/evaluate.mjs', 'scripts/export-schemas.mjs', 'rubrics/pattern-cards.json', 'schemas/scene_setup.schema.json',
    'system/SYSTEM.md', 'system/baselines/0.2.2.md', 'configs/example-scene-setup.json', 'configs/benchmark.json',
    'skills/literary-workflow/SKILL.md', 'protocols/evaluation.md', 'docs/implementation-status.md']) {
    if (!files.has(entry.replace(/^\.\//, ''))) throw new Error(`Required runtime/documentation file omitted: ${entry}`);
  }
  for (const file of files) {
    if (/^(?:node_modules|tests|\.git|\.github|\.pnw|\.pnw-dev|\.pi)\//.test(file) || /(?:\.log|\.patch|\.tgz|\.zip)$/.test(file)) throw new Error(`Development/private file included: ${file}`);
    if (!/\.(?:ts|mjs)$/.test(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(/\b(?:from\s+|import\s*)['"](\.[^'"]+)['"]/g)) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), m[1]));
      if (!files.has(target)) throw new Error(`Package omits relative import ${target} from ${file}`);
    }
  }
  console.log(`Verified ${files.size} package files, required entrypoints, local imports, and private-file exclusions (${pkg.version}).`);
} finally { fs.rmSync(destination, { recursive: true, force: true }); }
