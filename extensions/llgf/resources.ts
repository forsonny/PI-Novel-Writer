import fs from 'node:fs';
import { projectPath } from '../utils/safety.ts';
import { JobStore } from './jobs.ts';
import { LiteraryStore } from './store.ts';
import { requireId } from './version.ts';
import type { WorkerCall } from './workers.ts';

/** Counts durable reservations, including failed and interrupted calls. Known
 * subtotals remain separate from totals whose missing components are unknown. */
export function workerResources(root: string, jobId?: string) {
  const store = LiteraryStore.open(root), jobs = new JobStore(root, store.projectId), dir = projectPath(root, '.pnw/jobs');
  const ids = jobId ? [requireId(jobId)] : fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => /^[0-9a-f-]{36}\.json$/.test(f)).map(f => requireId(f.slice(0, -5))) : [];
  let reservedTokens = 0, inputTokens = 0, outputTokens = 0, knownCost = 0, missingInput = 0, missingOutput = 0, missingCost = 0;
  const records = ids.map(id => jobs.read(id));
  const roles: Record<string, number> = {}, statuses: Record<string, number> = {};
  for (const j of records) for (const r of j.reservations) {
    reservedTokens += r.reservedTokens; statuses[r.status] = (statuses[r.status] ?? 0) + 1;
    let call: WorkerCall | undefined;
    if (r.recordHash) {
      const a = store.artifact(r.recordHash);
      if (a.kind !== 'model_call' || a.runId !== j.id) throw new Error('Reservation refers to an unrelated call');
      call = (a.payload as { call: WorkerCall }).call;
      if (!call || call.id !== a.id || call.projectId !== j.projectId || call.runId !== j.id) throw new Error('Call provenance does not match its reservation');
      for (const count of [call.inputTokens, call.outputTokens]) if (count !== null && count !== undefined && (!Number.isSafeInteger(count) || count < 0)) throw new Error('Invalid call token count');
      roles[call.function] = (roles[call.function] ?? 0) + 1;
    }
    if (call?.inputTokens == null) missingInput++; else inputTokens += call.inputTokens;
    if (call?.outputTokens == null) missingOutput++; else outputTokens += call.outputTokens;
    if (r.cost == null) missingCost++; else knownCost += r.cost;
  }
  if (!Number.isFinite(knownCost)) throw new Error('Cost subtotal exceeds finite precision');
  if (![reservedTokens, inputTokens, outputTokens].every(Number.isSafeInteger)) throw new Error('Resource counts exceed safe integer precision');
  return { projectId: store.projectId, jobs: records.length, callsReserved: records.reduce((n, j) => n + j.reservations.length, 0), reservedTokens, roles, statuses,
    inputTokens: { knownSubtotal: inputTokens, unknownCalls: missingInput, total: missingInput ? null : inputTokens },
    outputTokens: { knownSubtotal: outputTokens, unknownCalls: missingOutput, total: missingOutput ? null : outputTokens },
    costEstimate: { knownSubtotal: knownCost, unknownCalls: missingCost, total: missingCost ? null : knownCost },
    scope: 'Isolated worker calls only. Coordinator, compaction and external human work are not included. Provider cost fields are estimates, not invoices.' };
}
