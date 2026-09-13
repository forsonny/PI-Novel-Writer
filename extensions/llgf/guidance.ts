import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { hashText } from './version.ts';

/** A baseline is explicitly selected, never inferred from vaguely similar text.
 * Historical guidance is migration data and is not injected into model context. */
export function guidanceUpdate(baseline?: string) {
  if (baseline !== undefined && baseline !== '0.2.2') throw new Error('Unknown shipped guidance baseline; omit it to retain current text and inspect conflicts');
  const newGuidance = fs.readFileSync(fileURLToPath(new URL('../../system/SYSTEM.md', import.meta.url)), 'utf8');
  return { newGuidance, ...(baseline ? { oldGuidance: fs.readFileSync(fileURLToPath(new URL(`../../system/baselines/${baseline}.md`, import.meta.url)), 'utf8') } : {}),
    incomingHash: hashText(newGuidance) };
}
