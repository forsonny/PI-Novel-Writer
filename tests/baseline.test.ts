import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readText, writeText, normalizeKey } from '../extensions/utils/platform.ts';

test('text round trip preserves Unicode and normalizes CRLF', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pnw-test-'));
  try {
    const file = path.join(dir, 'scene.md');
    writeText(file, 'A snowbird.\r\n\u96ea\r\n');
    assert.equal(readText(file), 'A snowbird.\n\u96ea\n');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('entity lookup normalizes spaces and case', () => {
  assert.equal(normalizeKey('  Ilyen  '), 'ilyen');
});

test('all declared extension entrypoints exist', () => {
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  for (const entry of pkg.pi.extensions) assert.ok(fs.existsSync(new URL('../' + entry, import.meta.url)), entry);
});
