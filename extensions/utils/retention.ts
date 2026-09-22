import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { projectPath } from './safety.ts';
import { pathsEqual } from './platform.ts';

/** Retire one exact file without deleting its bytes or overwriting an archive.
 * Callers must establish that their operation owns/releases this source.
 */
export function retainProjectFile(root: string, requested: string, reason: string): string {
  const file = projectPath(root, requested), relative = path.relative(fs.realpathSync(root), file);
  if (relative.split(path.sep).some(p => p.toLowerCase() === '.git')) throw new Error('Cannot retain protected version-control metadata');
  const before = fs.lstatSync(file, { bigint: true });
  if (!before.isFile() || !pathsEqual(fs.realpathSync(file), file)) throw new Error('Retention requires an unredirected regular file');
  const identity = { dev: String(before.dev), ino: String(before.ino), birthtimeNs: String(before.birthtimeNs) };
  const digest = (target: string) => createHash('sha256').update(fs.readFileSync(target)).digest('hex');
  const sourceHash = digest(file);
  for (const relativeDir of ['.pnw', '.pnw/retained']) {
    const dir = projectPath(root, relativeDir);
    if (fs.existsSync(dir) && !pathsEqual(fs.realpathSync(dir), dir)) throw new Error('Retention directory is redirected');
  }
  const base = projectPath(root, '.pnw/retained');
  fs.mkdirSync(base, { recursive: true, mode: 0o700 });
  const directory = path.join(base, randomUUID());
  fs.mkdirSync(directory, { mode: 0o700 }); // Exclusive new directory: never replace an existing archive.
  const retained = path.join(directory, 'content' + path.extname(file));
  fs.writeFileSync(path.join(directory, 'receipt.json'), JSON.stringify({
    version: 1, originalPath: file, retainedPath: retained, reason, retainedAt: new Date().toISOString(), identity, sha256: sourceHash,
  }, null, 2), { flag: 'wx', mode: 0o600 });
  fs.renameSync(file, retained);
  const after = fs.lstatSync(retained, { bigint: true });
  if (after.dev !== before.dev || after.ino !== before.ino || after.birthtimeNs !== before.birthtimeNs || digest(retained) !== sourceHash) {
    throw new Error(`Retention verification failed; inspect ${directory}`);
  }
  // A released lock name may already belong to a new writer; that is not the
  // original file. Never remove or overwrite that replacement.
  if (fs.existsSync(file)) {
    const current = fs.lstatSync(file, { bigint: true });
    if (current.dev === before.dev && current.ino === before.ino && current.birthtimeNs === before.birthtimeNs) {
      throw new Error(`Original file still occupies its released name; inspect ${directory}`);
    }
  }
  return retained;
}
