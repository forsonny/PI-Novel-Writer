import fs from 'node:fs';
import path from 'node:path';
import { Type } from 'typebox';
import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import { getProject, refreshProject, orderedScenes } from './novel-core.ts';
import { projectPath } from './utils/safety.ts';
import { SessionAuthority, type Scope } from './llgf/authority.ts';
import { managedProject, previewMigration, applyMigration, recoverMigration, inspectMigrationLock, recoverMigrationLock, type MigrationPlan } from './llgf/migration.ts';
import { prepareScene, runScene, acceptScene, readPipeline, getPreparation, SceneSetupSchema, type SceneAddress } from './llgf/pipeline.ts';
import { LiteraryStore, inspectStoreLock, recoverStoreLock, type RestorePreview } from './llgf/store.ts';
import { executionLock, recoverExecution } from './llgf/execution.ts';
import { JobStore } from './llgf/jobs.ts';
import { AuditScopeSchema, AuditReviewSchema, buildAudit, auditSummary, auditPacket, runAudit } from './llgf/audits.ts';
import { workerResources } from './llgf/resources.ts';
import { schemaCatalogue } from './llgf/catalogue.ts';
import { cardsFor } from './llgf/pattern-cards.ts';
import { patterns, causeFamilies, TAXONOMY_VERSION } from './llgf/taxonomy.ts';
import { StudySchema, TrialSchema, ReaderResponseSchema } from './llgf/evaluation.ts';
import { guidanceUpdate } from './llgf/guidance.ts';
import { DriftBaselineSchema } from './llgf/drift.ts';
import { designSchemas, saveDesign, type DesignKind } from './llgf/registry-service.ts';
import { PlanSchema } from './llgf/planning.ts';
import { objectHash, newId, proseHash } from './llgf/version.ts';
import { Id, Hash, Strict, checked } from './llgf/schema.ts';
import { AVSSchema, AnchorSchema } from './llgf/voice.ts';
import { SceneContractSchema, PropositionSchema } from './llgf/narrative.ts';
import { PromiseSchema, MotifSchema, AffordanceSchema } from './llgf/registries.ts';
import { DiagnosticReportSchema } from './llgf/diagnostics.ts';

const schemas = { ...schemaCatalogue, study: StudySchema, evaluation_trial: TrialSchema, reader_response: ReaderResponseSchema, audit: AuditReviewSchema, drift_baseline: DriftBaselineSchema, plan: PlanSchema, setup: SceneSetupSchema, voice: AVSSchema, anchor: AnchorSchema, contract: SceneContractSchema,
  proposition: PropositionSchema, promise: PromiseSchema, motif: MotifSchema, affordance: AffordanceSchema, diagnostics: DiagnosticReportSchema };
function project() { const p = refreshProject(); if (!p) throw new Error('Load a novel project first'); return p; }
function jsonFile(root: string, relative: string): unknown {
  const file = projectPath(root, relative);
  if (!relative.endsWith('.json') || !fs.statSync(file).isFile() || fs.statSync(file).size > 2 * 1024 * 1024) throw new Error('Expected a project JSON file no larger than 2 MiB');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
export function literaryAddress(chapter: number, scene: number): SceneAddress {
  const p = project(), scenes = orderedScenes(p), index = scenes.findIndex(s => s.chapter === chapter && s.scene === scene), s = scenes[index];
  if (!s?.id) throw new Error('Scene is missing or needs explicit stable-ID migration');
  return { id: s.id, path: path.relative(p.rootPath, s.filePath).replaceAll('\\', '/'), chapter, scene, order: s.order ?? s.scene, narrativeIndex: index };
}
function result(value: unknown) { return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }], details: {} }; }
const jobBudgetPolicy = 'Scene-job budgets are fixed. A renewed session allowance does not refill an exhausted job. Reuse its saved candidate only through an explicit source-bound working edit and fresh preparation; prior reservations remain charged.';
/** These adapters never infer permission from model text, saved jobs or loading.
 * The main agent may prepare work. Only a session-local author command enables
 * paid workers and delegated acceptance; human approval has no model-call tool.
 */
export default function literaryExtension(pi: ExtensionAPI) {
  const authority = new SessionAuthority(); let migration: MigrationPlan | null = null; let restorePreview: RestorePreview | null = null;
  const scope = (ctx: ExtensionContext): Scope | null => {
    const p = getProject(); if (!p || !ctx.model) return null;
    const settings = managedProject(p.rootPath); if (!settings?.enabled) return null;
    return { root: p.rootPath, projectId: settings.projectId, provider: ctx.model.provider, model: ctx.model.id };
  };
  const pause = () => authority.revoke();
  pi.events.on('novel:literary-revoke', (data: unknown) => { if (typeof data === 'object' && data !== null && 'root' in data && authority.status()?.scope.root === data.root) pause(); });
  pi.events.on('novel:literary-authorize', (data: unknown) => {
    if (typeof data !== 'object' || data === null || !('ctx' in data) || !('root' in data) || !('reply' in data) || typeof data.reply !== 'function') throw new Error('Invalid host authorization request');
    const request = data as { root: string; ctx: ExtensionContext; calls: number; tokens: number; reply: () => void };
    const s = scope(request.ctx);
    if (!request.ctx.isIdle() || !s || s.root !== request.root) throw new Error('Cannot authorize this project/model during an active response');
    authority.authorize(s, { maxCalls: request.calls, maxReservedTokens: request.tokens, maxCost: null, maxRevisions: 10 }); request.reply();
  });
  pi.on('session_shutdown', pause); pi.on('model_select', pause);
  pi.events.on('novel:project-loaded', pause);
  pi.on('input', event => { if (event.source !== 'extension') pause(); });
  const status = (id?: string) => {
    const p = project(), settings = managedProject(p.rootPath);
    if (!id) return { settings, authority: authority.status(), acceptedHead: LiteraryStore.exists(p.rootPath) ? LiteraryStore.open(p.rootPath).head().hash : null, budgetPolicy: jobBudgetPolicy, note: 'Engineering and model checks are not human literary evaluation.' };
    checked(Id, id); const store = LiteraryStore.open(p.rootPath), job = new JobStore(p.rootPath, store.projectId).read(id);
    // Sequence audits use their own scope ID as job.sceneId, including older
    // records. Scene preparations have a separate stable manuscript scene ID.
    // Do not infer job kind merely because a scene checkpoint is missing.
    if (job.sceneId === id) {
      const key = `audit:${id}`;
      const at = job.acceptedHead ? { hash: job.acceptedHead, snapshot: store.snapshot(job.acceptedHead) } : null;
      const record = at ? store.get(key, at) : null;
      if (at && !record) throw new Error('Accepted audit evidence is missing');
      return { kind: 'sequence-audit', id, stage: job.status, reason: job.reason, job,
        executionLock: executionLock(p.rootPath, id), privateJob: `.pnw/jobs/${id}.json`,
        auditRecord: record && at ? { key, hash: at.snapshot.versions[key] } : null,
        note: 'Saved audit-job accounting and history, not proof of current assessment. There is no scene candidate or pipeline checkpoint. Recovery retains charges and does not complete the review. Request a new scoped audit for another attempt, not a scene run.' };
    }
    const state = readPipeline(p.rootPath, id);
    return { kind: 'scene', executionLock: executionLock(p.rootPath, id), id, stage: state.stage, reason: state.reason, units: state.units, job, budgetPolicy: jobBudgetPolicy, originalSourceHash: getPreparation(p.rootPath, id).originalHash, candidateHash: proseHash(state.body), candidateWords: state.body.trim().split(/\s+/).filter(Boolean).length, privateCheckpoint: `.pnw/jobs/${id}.pipeline.json`, evidenceRecords: state.records, gate: state.final ? (state.final as { gate?: unknown }).gate : null };
  };
  const accept = (id: string, ctx: ExtensionContext, actor: 'model' | 'human') => {
    const p = project(); checked(Id, id);
    if (authority.busy()) throw new Error('Wait for the literary worker to finish before accepting');
    return acceptScene(p.rootPath, id, authority.permit(id, () => scope(ctx)), actor);
  };
  const run = async (id: string, ctx: ExtensionContext, signal?: AbortSignal) => {
    checked(Id, id); const p = project(), store = LiteraryStore.open(p.rootPath), jobs = new JobStore(p.rootPath, store.projectId);
    const prepared = getPreparation(p.rootPath, id), actual = literaryAddress(prepared.address.chapter, prepared.address.scene);
    if (objectHash(actual) !== objectHash(prepared.address)) throw new Error('Scene address or reading order changed; prepare again');
    const lease = authority.lease(jobs.read(id), () => scope(ctx));
    if (signal?.aborted) lease.cancel(); signal?.addEventListener('abort', lease.cancel, { once: true });
    try { await runScene(p.rootPath, id, ctx, lease.permit, lease.signal); return status(id); }
    finally { signal?.removeEventListener('abort', lease.cancel); let after; try { after = jobs.read(id); } catch { /* Unknown consumption is charged. */ } lease.close(after); }
  };
  pi.registerCommand('PNW-literary', {
    description: 'Managed writing: status [job] | upgrade-guidance [0.2.2] | migrate [collaborative|delegated|research] | apply <digest> | authorize <calls> <tokens> | run <job> | accept <job> | inspect <job> <reason> | recover-job <id> <token> | migration-lock | recover-migration-lock <token> | recover-migration <id> | account-lock <job> | recover-account-lock <job> <token> | pause',
    handler: async (args, ctx) => {
      const [action = 'status', ...rest] = args.trim().split(/\s+/).filter(Boolean);
      if (action === 'pause') { pause(); pi.sendMessage({ customType: 'novel-literary', content: 'Literary execution permission revoked. Saved candidates are retained.', display: true }); return; }
      const p = project(); let output: unknown;
      if (action === 'status') output = status(rest[0]);
      else if (action === 'store-lock') output = { lock: inspectStoreLock(p.rootPath), note: 'Do not remove a live or unidentifiable owner lock.' };
      else if (action === 'recover-store') { if (authority.busy()) throw new Error('Wait for active workers'); pause(); recoverStoreLock(p.rootPath, rest[0]); output = { recovered: 'store lock' }; }
      else if (action === 'migration-lock') output = { lock: inspectMigrationLock(p.rootPath), note: 'operationId identifies the migration journal. Empty legacy locks have no verifiable owner.' };
      else if (action === 'recover-migration-lock') {
        if (authority.busy()) throw new Error('Wait for active workers'); pause();
        recoverMigrationLock(p.rootPath, rest[0]);
        output = { recovered: 'migration lock', next: 'Inspect the recorded journal: recover an incomplete migration before a fresh preview. If the journal is complete or absent, obtain a fresh preview without rollback.', note: 'No source rollback or provider authorization occurred.' };
      } else if (action === 'account-lock' || action === 'recover-account-lock') {
        const id = checked(Id, rest[0]), store = LiteraryStore.open(p.rootPath), jobs = new JobStore(p.rootPath, store.projectId);
        jobs.read(id);
        if (action === 'account-lock') output = { jobId: id, lock: jobs.inspectLock(id) };
        else {
          if (authority.busy()) throw new Error('Wait for active workers'); pause();
          jobs.recoverLock(id, rest[1]);
          output = { recovered: 'accounting lock', job: jobs.read(id), note: 'Reservations and spent allowance are unchanged. Inspect interrupted calls before resuming; no new permission was granted.' };
        }
      }
      else if (action === 'restore') {
        if (authority.busy()) throw new Error('Pause and wait for active work before restoration');
        restorePreview = LiteraryStore.open(p.rootPath).previewRestore(rest[0]);
        output = { ...restorePreview, next: '/PNW-literary apply-restore ' + restorePreview.digest, note: 'Read-only preview. Restores prose, state and voice history together; keeps current working files untouched.' };
      } else if (action === 'apply-restore') {
        if (authority.busy() || !restorePreview) throw new Error('Create a restore preview with no active worker first');
        pause(); output = { ...LiteraryStore.open(p.rootPath).restore(restorePreview, rest[0]), note: 'Accepted snapshot restored. Working files are untouched. Export accepted prose before reconciling any working-file differences.' }; restorePreview = null;
      }
      else if (action === 'design') {
        const kind = rest[0] as DesignKind; if (!(kind in designSchemas)) throw new Error('Unknown design kind');
        if (authority.busy()) throw new Error('Wait for active writing before changing controls');
        output = saveDesign(p.rootPath, kind, jsonFile(p.rootPath, rest[1]), checked(Hash, rest[2]), 'human');
      } else if (action === 'migrate') {
        const governance = rest[0] ?? 'collaborative';
        if (!['collaborative', 'delegated', 'research'].includes(governance)) throw new Error('Unknown governance profile');
        if (authority.busy()) throw new Error('Pause active writing before migration');
        migration = previewMigration(p.rootPath, { sceneFiles: orderedScenes(p).map(s => path.relative(p.rootPath, s.filePath).replaceAll('\\', '/')), governance: governance as 'collaborative' | 'delegated' | 'research', enable: true });
        output = { digest: migration.digest, files: migration.files.map(f => ({ path: f.path, reason: f.reason })), conflicts: migration.conflicts, next: '/PNW-literary apply ' + migration.digest, note: 'Read-only preview. Approval also establishes matching empty accepted history if absent; existing history is retained. Imported prose and facts remain unverified, and no provider is authorized.' };
      } else if (action === 'upgrade-guidance') {
        if (authority.busy()) throw new Error('Pause active workers before changing guidance');
        if (rest.length > 1) throw new Error('Supply at most one known baseline version');
        const update = guidanceUpdate(rest[0]);
        migration = previewMigration(p.rootPath, { sceneFiles: [], ...update });
        output = { digest: migration.digest, incomingHash: update.incomingHash, files: migration.files.map(f => ({ path: f.path, reason: f.reason })), conflicts: migration.conflicts,
          next: '/PNW-literary apply ' + migration.digest, note: 'Read-only three-way merge. Conflicts retain current author text and save incoming guidance for inspection. This does not authorize model calls.' };
      } else if (action === 'apply') {
        if (!migration || migration.root !== fs.realpathSync(p.rootPath)) throw new Error('Create a migration preview in this session first');
        pause(); output = applyMigration(p.rootPath, migration, rest[0]); migration = null; refreshProject();
      } else if (action === 'authorize') {
        if (!ctx.isIdle()) throw new Error('Wait for the current response before authorizing a new allowance');
        const s = scope(ctx); if (!s) throw new Error('Enable managed writing and select a model first');
        if (rest.length !== 2 || !rest.every(x => /^\d+$/.test(x))) throw new Error('Supply maximum calls and reserved tokens');
        authority.authorize(s, { maxCalls: Number(rest[0]), maxReservedTokens: Number(rest[1]), maxCost: null, maxRevisions: 10 });
        output = { ...status(), note: 'Session-local authorization to transmit prepared project material to this selected model within these call/token limits. Enter /PNW-literary run <jobId> directly; a new ordinary message revokes this allowance. No billing amount or human approval is implied. Loading or resuming a session does not restore permission.' };
      } else if (action === 'run') output = await run(rest[0], ctx);
      else if (action === 'accept') {
        // The explicit author command is an acceptance action, not a human study.
        const s = scope(ctx); if (!s || authority.busy()) throw new Error('Enable managed writing and wait for active work');
        output = acceptScene(p.rootPath, checked(Id, rest[0]), { ...s, runId: rest[0], epoch: 0, active: () => scope(ctx)?.projectId === s.projectId }, 'human');
      } else if (action === 'inspect') {
        if (authority.busy()) throw new Error('Pause and wait for the active worker before inspecting an interrupted job');
        if (executionLock(p.rootPath, checked(Id, rest[0]))) throw new Error('Recover the execution lock before inspecting reservations');
        const store = LiteraryStore.open(p.rootPath); new JobStore(p.rootPath, store.projectId).inspectInterrupted(checked(Id, rest[0]), rest.slice(1).join(' ')); output = status(rest[0]);
      } else if (action === 'recover-job') {
        if (authority.busy()) throw new Error('Wait for active cancellation before recovery');
        recoverExecution(p.rootPath, rest[0], rest[1]); output = status(rest[0]);
      } else if (action === 'recover-migration') { pause(); recoverMigration(p.rootPath, rest[0]); output = { recovered: rest[0] }; }
      else throw new Error('Unknown literary command; use /PNW-literary status');
      pi.sendMessage({ customType: 'novel-literary', content: JSON.stringify(output, null, 2), display: true });
    }
  });
  pi.registerTool({ name: 'novel_literary_patterns', label: 'Inspect Literary Pattern Cards', description: 'Read the versioned pattern index or explicit contextual cards. Not a provenance detector or automatic rewrite rule.', parameters: Strict({ ids: Type.Optional(Type.Array(Type.String(), { minItems: 1, maxItems: 56 })) }),
    async execute(_id, params) { return result({ taxonomyVersion: TAXONOMY_VERSION, causeFamilies, ...(params.ids ? { cards: cardsFor(params.ids) } : { index: patterns }), note: 'Evidence, context, licensing and paired overcorrection are required. Cause families remain hypotheses.' }); } });
  pi.registerTool({ name: 'novel_literary_resources', label: 'Worker Resource Accounting', description: 'Read durable worker reservations, failures, actual reported token fields and unknown costs. Excludes coordinator and human work.', parameters: Strict({ jobId: Type.Optional(Id) }),
    async execute(_id, params) { return result(workerResources(project().rootPath, params.jobId)); } });
  pi.registerTool({ name: 'novel_literary_audit', label: 'Audit Narrative Sequence',
    description: 'Inspect accepted chapter, arc or manuscript coverage and conditional drift. review=true requests one isolated, budgeted model audit, not a human read. Oversized scopes fail instead of silently sampling.',
    parameters: Strict({ scope: AuditScopeSchema, review: Type.Optional(Type.Boolean()) }),
    async execute(_id, params, signal, _update, ctx) {
      const p = project(), input = buildAudit(p, params.scope);
      if (!params.review) return result(auditSummary(input));
      const packet = auditPacket(input, ctx), jobs = new JobStore(p.rootPath, input.projectId);
      const job = jobs.create(input.id, packet.inputHash, { maxCalls: 1, maxReservedTokens: packet.reservedTokens, maxCost: null, maxRevisions: 0 }, input.id);
      const lease = authority.lease(job, () => scope(ctx));
      if (signal?.aborted) lease.cancel(); signal?.addEventListener('abort', lease.cancel, { once: true });
      try { return result(await runAudit(p, input, ctx, lease.permit, lease.signal)); }
      finally { signal?.removeEventListener('abort', lease.cancel); lease.close(jobs.read(input.id)); }
    }
  });
  pi.registerTool({ name: 'novel_literary_design', label: 'Save Literary Design', description: 'Under delegated authority, save versioned plans, voice, or registry designs. Cannot invent event history, human calibration or change ending constraints.', parameters: Strict({ kind: Type.Enum(Object.keys(designSchemas) as DesignKind[]), path: Type.String(), expectedHead: Hash }),
    async execute(_id, params, _signal, _update, ctx) { const p = project(); if (authority.busy() || managedProject(p.rootPath)?.governance !== 'delegated' || !authority.permit(newId(), () => scope(ctx)).active()) throw new Error('Design mutation needs idle delegated authority'); return result(saveDesign(p.rootPath, params.kind, jsonFile(p.rootPath, params.path), params.expectedHead, 'model')); } });
  pi.registerTool({ name: 'novel_literary_memory', label: 'Accepted Literary Records', description: 'Read accepted design/state records for the coordinator, never a proof that every character knows them. A key reads one record; otherwise returns a compact index.', parameters: Strict({ key: Type.Optional(Type.String()) }),
    async execute(_id, params) { const p = project(), store = LiteraryStore.open(p.rootPath), at = store.head(); return result(params.key ? { head: at.hash, record: store.get(params.key, at), stale: store.stale([{ key: params.key, hash: at.snapshot.versions[params.key] }], at) } : { head: at.hash, records: Object.entries(at.snapshot.versions).map(([key, hash]) => ({ key, hash })) }); } });
  pi.registerTool({ name: 'novel_literary_schema', label: 'Literary Data Schema', description: 'Read a versioned schema before preparing JSON. A schema is not a quality verdict.', parameters: Strict({ name: Type.Enum(Object.keys(schemas) as (keyof typeof schemas)[]) }),
    async execute(_id, params) { return result(schemas[params.name]); } });
  pi.registerTool({ name: 'novel_literary_prepare', label: 'Prepare Literary Scene', description: 'Validate a scene setup JSON against current source and state. Saves provisional work only; no model call, prose replacement, or execution permission.', parameters: Strict({ chapter: Type.Integer({ minimum: 1 }), scene: Type.Integer({ minimum: 1 }), setupPath: Type.String(), expectedSourceHash: Hash }),
    async execute(_id, params) { const p = project(), address = literaryAddress(params.chapter, params.scene), prepared = prepareScene(p.rootPath, address, jsonFile(p.rootPath, params.setupPath), params.expectedSourceHash); return result({ jobId: prepared.id, budget: prepared.setup.budget, budgetPolicy: jobBudgetPolicy, sourceHash: prepared.originalHash, next: `/PNW-literary authorize <calls> <tokens>, then /PNW-literary run ${prepared.id} directly. Ordinary chat revokes permission.` }); } });
  pi.registerTool({ name: 'novel_literary_status', label: 'Literary Status', description: 'Read actual managed state, remaining authorization or one job. Does not start paid work.', parameters: Strict({ jobId: Type.Optional(Id) }),
    async execute(_id, params) { return result(status(params.jobId)); } });
  pi.registerTool({ name: 'novel_literary_run', label: 'Run Literary Scene', description: 'Run bounded isolated workers for a prepared job within the author-granted session budget. Does not accept or publish the result.', parameters: Strict({ jobId: Id }),
    async execute(_id, params, signal, _update, ctx) { return result(await run(params.jobId, ctx, signal)); } });
  pi.registerTool({ name: 'novel_literary_accept', label: 'Accept Reviewed Scene', description: 'Commit current reviewed prose, state and evidence atomically under delegated authority. Human checkpoints cannot be manufactured by this tool.', parameters: Strict({ jobId: Id }),
    async execute(_id, params, _signal, _update, ctx) { return result(accept(params.jobId, ctx, 'model')); } });
}
