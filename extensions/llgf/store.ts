import fs from 'node:fs';
import path from 'node:path';
import { Type, type Static } from 'typebox';
import { projectPath } from '../utils/safety.ts';
import { canonicalJson, hashText, newId, requireHash, requireId } from './version.ts';
import { checked, Strict, Id, Hash, Kind, Key, Sources, Timestamp, Short, type SourceRef } from './schema.ts';

export const ArtifactSchema = Strict({ schemaVersion: Type.Literal(1), id: Id, kind: Kind, projectId: Id, runId: Type.Union([Id, Type.Null()]), createdAt: Timestamp, sources: Sources, payload: Type.Unknown() });
export type Artifact = Static<typeof ArtifactSchema>;
export const SnapshotSchema = Strict({ schemaVersion: Type.Literal(1), projectId: Id, parent: Type.Union([Hash, Type.Null()]), sequence: Type.Integer({ minimum: 0 }), createdAt: Timestamp, requestId: Short, requestHash: Hash, versions: Type.Record(Key, Hash), requests: Type.Record(Hash, Hash) });
export type Snapshot = Static<typeof SnapshotSchema>;
export interface SnapshotRef { hash: string; snapshot: Snapshot }
export interface CommitRequest { expectedHead: string; requestId: string; changes: SourceRef[]; dependencies: SourceRef[] }
export interface CommitResult extends SnapshotRef { replayed: boolean; durabilityWarning?: string }
export interface StoreFaults { beforeHeadSwap?: () => void }

/** Local content-addressed store. HEAD alone chooses the accepted snapshot.
 * The working Markdown tree is not canonical state. No model call runs in a lock.
 */
export class LiteraryStore {
  readonly root: string;
  readonly projectId: string;
  private readonly faults: StoreFaults;
  private constructor(root: string, projectId: string, faults: StoreFaults = {}) {
    this.root = fs.realpathSync(root); this.projectId = requireId(projectId); this.faults = faults;
  }
  static exists(root: string): boolean { return fs.existsSync(projectPath(root, '.pnw/HEAD')); }
  static open(root: string, faults: StoreFaults = {}): LiteraryStore {
    const hash = requireHash(fs.readFileSync(projectPath(root, '.pnw/HEAD'), 'utf8').trim());
    const raw = readObject(root, hash);
    return new LiteraryStore(root, checked(SnapshotSchema, raw, 'snapshot').projectId, faults);
  }
  static initialize(root: string, projectId = newId()): LiteraryStore {
    const store = new LiteraryStore(root, projectId);
    fs.mkdirSync(projectPath(root, '.pnw/objects'), { recursive: true, mode: 0o700 });
    store.lock(() => {
      if (LiteraryStore.exists(root)) {
        if (store.head().snapshot.projectId !== projectId) throw new Error('A different project already owns this store');
        return;
      }
      const snapshot: Snapshot = { schemaVersion: 1, projectId, parent: null, sequence: 0, createdAt: new Date().toISOString(), requestId: 'initialize', requestHash: hashText(projectId), versions: {}, requests: {} };
      store.swapHead(store.putObject(checked(SnapshotSchema, snapshot)));
    });
    return store;
  }
  head(): SnapshotRef {
    const hash = requireHash(fs.readFileSync(projectPath(this.root, '.pnw/HEAD'), 'utf8').trim());
    return { hash, snapshot: this.snapshot(hash) };
  }
  snapshot(hash: string): Snapshot {
    const snapshot = checked(SnapshotSchema, readObject(this.root, hash), 'snapshot');
    if (snapshot.projectId !== this.projectId) throw new Error('Snapshot belongs to another project');
    return snapshot;
  }
  artifact(hash: string): Artifact {
    const record = checked(ArtifactSchema, readObject(this.root, hash), 'artifact');
    if (record.projectId !== this.projectId) throw new Error('Artifact belongs to another project');
    return record;
  }
  get(key: string, at: SnapshotRef = this.head()): Artifact | null {
    checked(Key, key, 'artifact key');
    if (at.snapshot.projectId !== this.projectId) throw new Error('Snapshot belongs to another project');
    const hash = at.snapshot.versions[key];
    if (!hash) return null;
    const record = this.artifact(hash);
    if (`${record.kind}:${record.id}` !== key) throw new Error('Artifact identity differs from its snapshot key');
    return record;
  }
  put(kind: string, id: string, payload: unknown, sources: SourceRef[] = [], runId: string | null = null): SourceRef {
    const artifact = checked(ArtifactSchema, { schemaVersion: 1, kind, id, projectId: this.projectId, runId, createdAt: new Date().toISOString(), sources, payload }, 'artifact');
    return { key: `${kind}:${id}`, hash: this.putObject(artifact) };
  }
  stale(sources: SourceRef[], at: SnapshotRef = this.head()): SourceRef[] {
    checked(Sources, sources, 'dependencies');
    return sources.filter(ref => at.snapshot.versions[ref.key] !== ref.hash);
  }
  commit(request: CommitRequest): CommitResult {
    checked(Strict({ expectedHead: Hash, requestId: Short, changes: Sources, dependencies: Sources }), request, 'commit request');
    if (!request.changes.length || new Set(request.changes.map(x => x.key)).size !== request.changes.length) throw new Error('Commit needs distinct changed artifact keys');
    const requestHash = hashText(canonicalJson(request));
    return this.lock(() => {
      const current = this.head();
      // The accepted snapshot carries the idempotency index. A retry returns
      // current state, not an old snapshot, and must not replay file projections.
      const previous = current.snapshot.requests[hashText(request.requestId)];
      if (previous) {
        if (previous !== requestHash) throw new Error('Idempotency key reused for a different request');
        return { ...current, replayed: true };
      }
      if (current.hash !== request.expectedHead) throw new Error('Accepted snapshot changed; revalidate the candidate');
      if (this.stale(request.dependencies, current).length) throw new Error('Accepted dependencies changed');
      const versions = { ...current.snapshot.versions };
      for (const ref of request.changes) {
        const record = this.artifact(ref.hash);
        if (`${record.kind}:${record.id}` !== ref.key) throw new Error('Changed artifact has the wrong identity');
        versions[ref.key] = ref.hash;
      }
      const snapshot: Snapshot = { schemaVersion: 1, projectId: this.projectId, parent: current.hash, sequence: current.snapshot.sequence + 1, createdAt: new Date().toISOString(), requestId: request.requestId, requestHash, versions, requests: { ...current.snapshot.requests, [hashText(request.requestId)]: requestHash } };
      const hash = this.putObject(checked(SnapshotSchema, snapshot, 'snapshot'));
      this.faults.beforeHeadSwap?.();
      const durabilityWarning = this.swapHead(hash);
      return { hash, snapshot, replayed: false, ...(durabilityWarning ? { durabilityWarning } : {}) };
    });
  }
  private putObject(value: unknown): string {
    const content = canonicalJson(value); if (Buffer.byteLength(content) > 2 * 1024 * 1024) throw new Error('Object exceeds size limit');
    const hash = hashText(content); const file = projectPath(this.root, `.pnw/objects/${hash}.json`);
    const tmp = projectPath(this.root, `.pnw/objects/${newId()}.tmp`);
    const fd = fs.openSync(tmp, 'wx', 0o600);
    try { fs.writeFileSync(fd, content); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    try {
      // Atomic, no-clobber publication: an interrupted write cannot leave a
      // partial object at its authoritative hash name.
      fs.linkSync(tmp, file);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      if (fs.readFileSync(file, 'utf8') !== content) throw new Error('Corrupt content-addressed object');
    } finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
    return hash;
  }
  private swapHead(hash: string): string | undefined {
    let warning: string | undefined;
    // Persist the object directory before publishing a pointer into it.
    try { syncDirectory(projectPath(this.root, '.pnw/objects')); }
    catch (error) {
      if (!['EINVAL', 'EPERM', 'EISDIR', 'ENOTSUP'].includes((error as NodeJS.ErrnoException).code || '')) throw error;
      warning = 'Directory fsync unavailable; power-loss durability is not established on this filesystem';
    }
    const head = projectPath(this.root, '.pnw/HEAD'); const tmp = projectPath(this.root, `.pnw/HEAD.${newId()}.tmp`);
    const fd = fs.openSync(tmp, 'wx', 0o600);
    try { fs.writeFileSync(fd, hash + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    try { fs.renameSync(tmp, head); } finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
    try { syncDirectory(projectPath(this.root, '.pnw')); }
    catch { warning = 'Accepted pointer updated; directory fsync failed, so power-loss durability is uncertain'; }
    return warning;
  }
  private lock<T>(fn: () => T): T {
    const file = projectPath(this.root, '.pnw/write.lock'); let fd: number;
    try { fd = fs.openSync(file, 'wx', 0o600); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new Error('Literary store is locked; inspect any interrupted writer before recovery');
      throw error;
    }
    const token = newId();
    try {
      fs.writeFileSync(fd, canonicalJson({ pid: process.pid, token, createdAt: new Date().toISOString() })); fs.fsyncSync(fd);
      const result = fn();
      if (result instanceof Promise) throw new Error('Asynchronous work is not allowed inside a store lock');
      return result;
    } finally {
      fs.closeSync(fd);
      let ownsLock = false;
      try { ownsLock = JSON.parse(fs.readFileSync(file, 'utf8')).token === token; } catch { /* Do not remove a lock whose owner is unknown. */ }
      if (ownsLock) fs.unlinkSync(file);
    }
  }
}
function readObject(root: string, hash: string): unknown {
  const file = projectPath(root, `.pnw/objects/${requireHash(hash)}.json`);
  if (fs.statSync(file).size > 2 * 1024 * 1024) throw new Error('Object exceeds size limit');
  const text = fs.readFileSync(file, 'utf8');
  if (hashText(text) !== hash) throw new Error('Object hash mismatch; content is corrupt');
  return JSON.parse(text);
}

function syncDirectory(dir: string): void {
  const fd = fs.openSync(dir, 'r');
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
