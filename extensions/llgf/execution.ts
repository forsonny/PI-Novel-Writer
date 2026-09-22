import fs from 'node:fs';
import os from 'node:os';
import { Type } from 'typebox';
import { Id, Nonempty, Strict, checked } from './schema.ts';
import { newId } from './version.ts';
import { projectPath } from '../utils/safety.ts';
import { retainProjectFile } from '../utils/retention.ts';
const LockSchema = Strict({ token: Id, pid: Type.Integer({ minimum: 1 }), host: Nonempty, createdAt: Nonempty });
function lockFile(root: string, id: string): string { checked(Id, id); return projectPath(root, `.pnw/jobs/${id}.execution.lock`); }
export function executionLock(root: string, id: string) {
  const file = lockFile(root, id); if (!fs.existsSync(file)) return null;
  if (fs.statSync(file).size > 4096) throw new Error('Invalid execution lock');
  return checked(LockSchema, JSON.parse(fs.readFileSync(file, 'utf8')), 'execution lock');
}
/** A per-job lease spans all asynchronous calls. It does not hold the canonical
 * store write lock while a model runs. Interrupted leases require inspection. */
export async function withExecution<T>(root: string, id: string, work: () => Promise<T>): Promise<T> {
  const file = lockFile(root, id); let fd: number;
  try { fd = fs.openSync(file, 'wx', 0o600); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new Error('Job already executing or interrupted; inspect its execution lock'); throw error; }
  const token = newId();
  try { fs.writeFileSync(fd, JSON.stringify({ token, pid: process.pid, host: os.hostname(), createdAt: new Date().toISOString() })); fs.fsyncSync(fd); return await work(); }
  finally { fs.closeSync(fd); if (executionLock(root, id)?.token === token) retainProjectFile(root, file, 'Released execution lock'); }
}
/** Called only by an explicit author recovery command. Never steal a live local
 * process's lock or guess about a lock from another machine. */
export function recoverExecution(root: string, id: string, expectedToken: string): void {
  checked(Id, expectedToken); const lock = executionLock(root, id);
  if (!lock || lock.token !== expectedToken) throw new Error('Execution lock changed; inspect it again');
  if (lock.host !== os.hostname()) throw new Error('Lock belongs to another machine; stop its writer before manual recovery');
  try { process.kill(lock.pid, 0); throw new Error('Execution owner is still running; stop it before recovery'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
  if (executionLock(root, id)?.token !== expectedToken) throw new Error('Execution lock changed');
  retainProjectFile(root, lockFile(root, id), 'Explicitly recovered stopped execution owner');
}
