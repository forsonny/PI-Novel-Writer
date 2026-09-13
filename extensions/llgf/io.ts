import fs from 'node:fs';
import path from 'node:path';
import { newId } from './version.ts';

/** Atomic exact-byte UTF-8 replacement. Unlike legacy writeText this preserves
 * CRLF. Callers must first resolve a contained, authorized path and check versions.
 */
export function writeExact(file: string, text: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${newId()}.tmp`;
  const fd = fs.openSync(temporary, 'wx', 0o600);
  try { fs.writeFileSync(fd, text, 'utf8'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  try {
    fs.renameSync(temporary, file);
  } catch (error) {
    // Preserve the complete temporary file if the destination cannot be replaced.
    throw new Error(`Atomic replacement failed; recoverable temporary file: ${temporary}`, { cause: error });
  }
  try { const dir = fs.openSync(path.dirname(file), 'r'); try { fs.fsyncSync(dir); } finally { fs.closeSync(dir); } }
  catch { /* Some filesystems do not support directory fsync; no durability guarantee is made there. */ }
}
