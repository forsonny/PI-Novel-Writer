import { checked } from './schema.ts';
import { BudgetSchema, type SceneJob, type RunBudget } from './jobs.ts';
import type { WorkerPermit } from './workers.ts';

export interface Scope { root: string; projectId: string; provider: string; model: string }
const same = (a: Scope, b: Scope | null): boolean => b !== null && a.root === b.root && a.projectId === b.projectId && a.provider === b.provider && a.model === b.model;
interface Grant { scope: Scope; calls: number; tokens: number; epoch: number }
/** Only a host command can grant execution. Files and model output cannot.
 * Reserve a whole job's remaining allowance before its first call. Failed or
 * interrupted calls keep their durable reservation; unknown consumption is charged.
 */
export class SessionAuthority {
  private grant: Grant | null = null;
  private active: AbortController | null = null;
  private epoch = 0;
  authorize(scope: Scope, budget: RunBudget): void {
    checked(BudgetSchema, budget);
    if (this.active) throw new Error('Pause the active literary job before changing its allowance');
    if (budget.maxCost !== null) throw new Error('Reliable prices are unavailable; authorize call and token limits instead');
    this.grant = { scope: { ...scope }, calls: budget.maxCalls, tokens: budget.maxReservedTokens, epoch: ++this.epoch };
  }
  status(): { scope: Scope; calls: number; tokens: number; active: boolean } | null {
    return this.grant ? { scope: { ...this.grant.scope }, calls: this.grant.calls, tokens: this.grant.tokens, active: this.active !== null } : null;
  }
  busy(): boolean { return this.active !== null; }
  revoke(): void { this.grant = null; this.epoch++; this.active?.abort(); }
  permit(runId: string, current: () => Scope | null): WorkerPermit {
    const g = this.grant;
    if (!g || !same(g.scope, current())) throw new Error('Authorize this project and current model with /PNW-literary authorize <calls> <tokens>');
    return { projectId: g.scope.projectId, runId, epoch: g.epoch, provider: g.scope.provider, model: g.scope.model,
      active: () => this.grant === g && same(g.scope, current()) };
  }
  lease(job: SceneJob, current: () => Scope | null) {
    const permit = this.permit(job.id, current), g = this.grant!;
    if (this.active) throw new Error('A literary job is already executing');
    if (job.projectId !== g.scope.projectId) throw new Error('Job belongs to another project');
    const beforeCalls = job.reservations.length, beforeTokens = job.reservations.reduce((n, r) => n + r.reservedTokens, 0);
    const calls = Math.max(0, job.budget.maxCalls - beforeCalls), tokens = Math.max(0, job.budget.maxReservedTokens - beforeTokens);
    if (calls > g.calls || tokens > g.tokens) throw new Error('Job exceeds the remaining session allowance; no call was started');
    g.calls -= calls; g.tokens -= tokens;
    const controller = new AbortController(); this.active = controller;
    let closed = false;
    return { permit, signal: controller.signal, cancel: () => controller.abort(), close: (after?: SceneJob) => {
      if (closed) return; closed = true;
      if (this.active === controller) this.active = null;
      // Refund only demonstrably unused capacity in the same still-live grant.
      if (this.grant === g && after?.id === job.id && after.projectId === job.projectId) {
        const usedCalls = Math.max(0, after.reservations.length - beforeCalls);
        const usedTokens = Math.max(0, after.reservations.reduce((n, r) => n + r.reservedTokens, 0) - beforeTokens);
        g.calls += Math.max(0, calls - usedCalls); g.tokens += Math.max(0, tokens - usedTokens);
      }
    } };
  }
}
