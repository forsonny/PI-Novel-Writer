import fs from 'node:fs';
import os from 'node:os';
import { Type } from 'typebox';
import { Id, Nonempty, Strict, Timestamp, checked } from './schema.ts';
import { newId, objectHash } from './version.ts';
import { projectPath } from '../utils/safety.ts';
import { retainProjectFile } from '../utils/retention.ts';

const OwnerSchema = Strict({ token: Id, operationId: Id, pid: Type.Integer({ minimum: 1 }), host: Nonempty, createdAt: Timestamp });

export function inspectOwnedLock(root: string, relative: string) {
  const file = projectPath(root, relative);
  if (!fs.existsSync(file)) return null;
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.size > 4096) throw new Error('Lock has no verifiable owner; automatic recovery refused');
  try { return checked(OwnerSchema, JSON.parse(fs.readFileSync(file, 'utf8')), 'lock owner'); }
  catch { throw new Error('Lock has no verifiable owner; automatic recovery refused'); }
}

/** Record ownership durably before any protected mutation. */
export function withOwnedLock<T>(root: string, relative: string, operationId: string, work: () => T): T {
  const owner = checked(OwnerSchema, { token: newId(), operationId, pid: process.pid, host: os.hostname(), createdAt: new Date().toISOString() });
  const file = projectPath(root, relative);
  let fd: number;
  try { fd = fs.openSync(file, 'wx', 0o600); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new Error('Operation locked; inspect its writer before recovery');
    throw error;
  }
  try {
    fs.writeFileSync(fd, JSON.stringify(owner)); fs.fsyncSync(fd);
    return work();
  } finally {
    fs.closeSync(fd);
    let sameOwner = false;
    try { sameOwner = objectHash(inspectOwnedLock(root, relative)) === objectHash(owner); } catch { /* Retain unknown/replaced owners. */ }
    if (sameOwner) retainProjectFile(root, file, 'Released owned operation lock');
  }
}

/** Explicit recovery only: no automatic stealing or guessed foreign ownership. */
export function recoverOwnedLock(root: string, relative: string, expectedToken: string, operationId?: string): void {
  checked(Id, expectedToken);
  const owner = inspectOwnedLock(root, relative);
  if (!owner || owner.token !== expectedToken) throw new Error('Lock changed; inspect it again');
  if (operationId !== undefined && owner.operationId !== checked(Id, operationId)) throw new Error('Lock belongs to another operation');
  if (owner.host !== os.hostname()) throw new Error('Lock belongs to another machine; do not guess its owner status');
  try { process.kill(owner.pid, 0); throw new Error('Lock owner is still running'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
  if (objectHash(inspectOwnedLock(root, relative)) !== objectHash(owner)) throw new Error('Lock changed; inspect it again');
  retainProjectFile(root, projectPath(root, relative), 'Explicitly recovered stopped operation owner');
}
