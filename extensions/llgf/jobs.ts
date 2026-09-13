import fs from 'node:fs';
import { Type, type Static } from 'typebox';
import { Strict, Id, Hash, Short, Nonempty, checked } from './schema.ts';
import { projectPath } from '../utils/safety.ts';
import { writeExact } from './io.ts';
import { newId, objectHash } from './version.ts';
import type { WorkerCall, WorkerPermit } from './workers.ts';
export const BudgetSchema = Strict({ maxCalls: Type.Integer({ minimum: 1, maximum: 10000 }), maxReservedTokens: Type.Integer({ minimum: 1 }), maxCost: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]), maxRevisions: Type.Integer({ minimum: 0, maximum: 10 }) });
export type RunBudget = Static<typeof BudgetSchema>;
const JobSchema = Strict({ schemaVersion: Type.Literal(1), id: Id, projectId: Id, sceneId: Id, inputHash: Hash,
  status: Type.Enum(['prepared', 'running', 'paused', 'blocked', 'accepted'] as const), next: Nonempty, budget: BudgetSchema,
  reservations: Type.Array(Strict({ id: Id, signature: Hash, reservedTokens: Type.Integer({ minimum: 1 }), status: Type.Enum(['pending', 'completed', 'failed'] as const), recordHash: Type.Union([Hash, Type.Null()]), cost: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]) }), { maxItems: 10000 }),
  acceptedHead: Type.Union([Hash, Type.Null()]), reason: Type.Union([Short, Type.Null()]),
});
export type SceneJob = Static<typeof JobSchema>;
/** Durable accounting: reservation happens before a call. Unknown/failed calls
 * consume allowance and are never silently free. Permission is session-local. */
export class JobStore {
  readonly root: string; readonly projectId: string;
  constructor(root: string, projectId: string) { checked(Id, projectId); this.root = root; this.projectId = projectId; }
  private file(id: string) { checked(Id, id); return projectPath(this.root, `.pnw/jobs/${id}.json`); }
  create(sceneId: string, inputHash: string, budget: RunBudget, id: string = newId()): SceneJob {
    const job = checked(JobSchema, { schemaVersion: 1, id, projectId: this.projectId, sceneId, inputHash, status: 'prepared', next: 'sketch', budget, reservations: [], acceptedHead: null, reason: null });
    fs.mkdirSync(projectPath(this.root, '.pnw/jobs'), { recursive: true, mode: 0o700 });
    const file = this.file(id); if (fs.existsSync(file)) { const old = this.read(id); if (old.inputHash !== inputHash || objectHash(old.budget) !== objectHash(budget) || old.sceneId !== sceneId) throw new Error('Job ID reused'); return old; }
    fs.writeFileSync(file, JSON.stringify(job), { flag: 'wx', mode: 0o600 }); return job;
  }
  read(id: string): SceneJob {
    const file = this.file(id); if (fs.statSync(file).size > 2 * 1024 * 1024) throw new Error('Job exceeds size limit');
    const job = checked(JobSchema, JSON.parse(fs.readFileSync(file, 'utf8')), 'scene job');
    if (job.projectId !== this.projectId || job.id !== id) throw new Error('Job belongs to another project'); return job;
  }
  update(id: string, fn: (job: SceneJob) => void): SceneJob {
    const file = this.file(id), lock = `${file}.lock`; const fd = fs.openSync(lock, 'wx', 0o600);
    try { const job = this.read(id); fn(job); checked(JobSchema, job); writeExact(file, JSON.stringify(job)); return job; }
    finally { fs.closeSync(fd); fs.unlinkSync(lock); }
  }
  reserve(id: string, signature: string, tokens: number, permit: WorkerPermit): string {
    if (!permit.active() || permit.projectId !== this.projectId) throw new Error('Run is not authorized');
    const reservationId = newId();
    this.update(id, job => {
      if (job.id !== permit.runId || job.status === 'accepted') throw new Error('Job is not writable by this run');
      if (job.reservations.some(r => r.status === 'pending')) throw new Error('Interrupted or active call requires inspection before resuming');
      const spent = job.reservations.reduce((n, r) => n + r.reservedTokens, 0);
      if (!Number.isSafeInteger(tokens) || tokens < 1 || job.reservations.length >= job.budget.maxCalls || spent + tokens > job.budget.maxReservedTokens) throw new Error('Authorized call/token budget exhausted');
      // Without reliable provider pricing, a monetary ceiling cannot be enforced.
      if (job.budget.maxCost !== null) throw new Error('A hard money cap requires reliable provider prices; authorize a token/call budget instead');
      job.reservations.push({ id: reservationId, signature, reservedTokens: tokens, status: 'pending', recordHash: null, cost: null }); job.status = 'running';
    });
    return reservationId;
  }
  settle(id: string, reservationId: string, call: WorkerCall, recordHash: string): void {
    this.update(id, job => {
      const r = job.reservations.find(r => r.id === reservationId); if (!r || r.status !== 'pending') throw new Error('No pending reservation');
      if (call.runId !== job.id || call.projectId !== job.projectId) throw new Error('Call belongs to another run');
      r.status = call.status === 'completed' ? 'completed' : 'failed'; r.recordHash = recordHash; r.cost = call.costEstimate;
      if (call.status !== 'completed') { job.status = call.status === 'cancelled' ? 'paused' : 'blocked'; job.reason = 'Worker failed; inspect the private call record'; }
    });
  }
  inspectInterrupted(id: string, reason: string): void {
    checked(Nonempty, reason);
    this.update(id, job => { for (const r of job.reservations) if (r.status === 'pending') r.status = 'failed'; job.status = 'paused'; job.reason = reason.slice(0, 160); });
  }
}
