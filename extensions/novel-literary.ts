import fs from 'node:fs';
import path from 'node:path';
import { Type } from 'typebox';
import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import { getProject, refreshProject, orderedScenes } from './novel-core.ts';
import { projectPath } from './utils/safety.ts';
import { SessionAuthority, type Scope } from './llgf/authority.ts';
import { managedProject, previewMigration, applyMigration, recoverMigration, type MigrationPlan } from './llgf/migration.ts';
import { prepareScene, runScene, acceptScene, readPipeline, getPreparation, SceneSetupSchema, type SceneAddress } from './llgf/pipeline.ts';
import { LiteraryStore } from './llgf/store.ts';
import { JobStore } from './llgf/jobs.ts';
import { objectHash } from './llgf/version.ts';
import { Id, Hash, Strict, checked } from './llgf/schema.ts';
import { AVSSchema, AnchorSchema } from './llgf/voice.ts';
import { SceneContractSchema, PropositionSchema } from './llgf/narrative.ts';
import { PromiseSchema, MotifSchema, AffordanceSchema } from './llgf/registries.ts';
import { DiagnosticReportSchema } from './llgf/diagnostics.ts';

const schemas = { setup: SceneSetupSchema, voice: AVSSchema, anchor: AnchorSchema, contract: SceneContractSchema,
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
/** These adapters never infer permission from model text, saved jobs or loading.
 * The main agent may prepare work. Only a session-local author command enables
 * paid workers and delegated acceptance; human approval has no model-call tool.
 */
export default function literaryExtension(pi: ExtensionAPI) {
  const authority = new SessionAuthority(); let migration: MigrationPlan | null = null;
  const scope = (ctx: ExtensionContext): Scope | null => {
    const p = getProject(); if (!p || !ctx.model) return null;
    const settings = managedProject(p.rootPath); if (!settings?.enabled) return null;
    return { root: p.rootPath, projectId: settings.projectId, provider: ctx.model.provider, model: ctx.model.id };
  };
  const pause = () => authority.revoke();
  pi.on('session_shutdown', pause); pi.on('model_select', pause);
  pi.events.on('novel:project-loaded', pause);
  pi.on('input', event => { if (event.source !== 'extension') pause(); });
  const status = (id?: string) => {
    const p = project(), settings = managedProject(p.rootPath);
    if (!id) return { settings, authority: authority.status(), acceptedHead: LiteraryStore.exists(p.rootPath) ? LiteraryStore.open(p.rootPath).head().hash : null, note: 'Engineering and model checks are not human literary evaluation.' };
    checked(Id, id); const store = LiteraryStore.open(p.rootPath), state = readPipeline(p.rootPath, id), job = new JobStore(p.rootPath, store.projectId).read(id);
    return { id, stage: state.stage, reason: state.reason, units: state.units, job, candidateWords: state.body.trim().split(/\s+/).filter(Boolean).length, privateCheckpoint: `.pnw/jobs/${id}.pipeline.json`, evidenceRecords: state.records, gate: state.final ? (state.final as { gate?: unknown }).gate : null };
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
    description: 'Managed writing: status [job] | migrate [collaborative|delegated|research] | apply <digest> | authorize <calls> <tokens> | run <job> | accept <job> | inspect <job> <reason> | recover-migration <id> | pause',
    handler: async (args, ctx) => {
      const [action = 'status', ...rest] = args.trim().split(/\s+/).filter(Boolean);
      if (action === 'pause') { pause(); pi.sendMessage({ customType: 'novel-literary', content: 'Literary execution permission revoked. Saved candidates are retained.', display: true }); return; }
      const p = project(); let output: unknown;
      if (action === 'status') output = status(rest[0]);
      else if (action === 'migrate') {
        const governance = rest[0] ?? 'collaborative';
        if (!['collaborative', 'delegated', 'research'].includes(governance)) throw new Error('Unknown governance profile');
        if (authority.busy()) throw new Error('Pause active writing before migration');
        migration = previewMigration(p.rootPath, { sceneFiles: orderedScenes(p).map(s => path.relative(p.rootPath, s.filePath).replaceAll('\\', '/')), governance: governance as 'collaborative' | 'delegated' | 'research', enable: true });
        output = { digest: migration.digest, files: migration.files.map(f => ({ path: f.path, reason: f.reason })), conflicts: migration.conflicts, next: '/PNW-literary apply ' + migration.digest, note: 'Read-only preview. No prose has changed and no provider is authorized.' };
      } else if (action === 'apply') {
        if (!migration || migration.root !== fs.realpathSync(p.rootPath)) throw new Error('Create a migration preview in this session first');
        pause(); output = applyMigration(p.rootPath, migration, rest[0]); migration = null; refreshProject();
      } else if (action === 'authorize') {
        if (!ctx.isIdle()) throw new Error('Wait for the current response before authorizing a new allowance');
        const s = scope(ctx); if (!s) throw new Error('Enable managed writing and select a model first');
        if (rest.length !== 2 || !rest.every(x => /^\d+$/.test(x))) throw new Error('Supply maximum calls and reserved tokens');
        authority.authorize(s, { maxCalls: Number(rest[0]), maxReservedTokens: Number(rest[1]), maxCost: null, maxRevisions: 10 });
        output = { ...status(), note: 'Session-local authorization to transmit prepared project material to this selected model within these call/token limits. No billing amount or human approval is implied. Loading or resuming a session does not restore permission.' };
      } else if (action === 'run') output = await run(rest[0], ctx);
      else if (action === 'accept') {
        // The explicit author command is an acceptance action, not a human study.
        const s = scope(ctx); if (!s || authority.busy()) throw new Error('Enable managed writing and wait for active work');
        output = acceptScene(p.rootPath, checked(Id, rest[0]), { ...s, runId: rest[0], epoch: 0, active: () => scope(ctx)?.projectId === s.projectId }, 'human');
      } else if (action === 'inspect') {
        if (authority.busy()) throw new Error('Pause and wait for the active worker before inspecting an interrupted job');
        const store = LiteraryStore.open(p.rootPath); new JobStore(p.rootPath, store.projectId).inspectInterrupted(checked(Id, rest[0]), rest.slice(1).join(' ')); output = status(rest[0]);
      } else if (action === 'recover-migration') { pause(); recoverMigration(p.rootPath, rest[0]); output = { recovered: rest[0] }; }
      else throw new Error('Unknown literary command; use /PNW-literary status');
      pi.sendMessage({ customType: 'novel-literary', content: JSON.stringify(output, null, 2), display: true });
    }
  });
  pi.registerTool({ name: 'novel_literary_schema', label: 'Literary Data Schema', description: 'Read a versioned schema before preparing JSON. A schema is not a quality verdict.', parameters: Strict({ name: Type.Enum(Object.keys(schemas) as (keyof typeof schemas)[]) }),
    async execute(_id, params) { return result(schemas[params.name]); } });
  pi.registerTool({ name: 'novel_literary_prepare', label: 'Prepare Literary Scene', description: 'Validate a scene setup JSON against current source and state. Saves provisional work only; no model call, prose replacement, or execution permission.', parameters: Strict({ chapter: Type.Integer({ minimum: 1 }), scene: Type.Integer({ minimum: 1 }), setupPath: Type.String(), expectedSourceHash: Hash }),
    async execute(_id, params) { const p = project(), address = literaryAddress(params.chapter, params.scene), prepared = prepareScene(p.rootPath, address, jsonFile(p.rootPath, params.setupPath), params.expectedSourceHash); return result({ jobId: prepared.id, budget: prepared.setup.budget, sourceHash: prepared.originalHash, next: 'novel_literary_run after author session authorization' }); } });
  pi.registerTool({ name: 'novel_literary_status', label: 'Literary Status', description: 'Read actual managed state, remaining authorization or one job. Does not start paid work.', parameters: Strict({ jobId: Type.Optional(Id) }),
    async execute(_id, params) { return result(status(params.jobId)); } });
  pi.registerTool({ name: 'novel_literary_run', label: 'Run Literary Scene', description: 'Run bounded isolated workers for a prepared job within the author-granted session budget. Does not accept or publish the result.', parameters: Strict({ jobId: Id }),
    async execute(_id, params, signal, _update, ctx) { return result(await run(params.jobId, ctx, signal)); } });
  pi.registerTool({ name: 'novel_literary_accept', label: 'Accept Reviewed Scene', description: 'Commit current reviewed prose, state and evidence atomically under delegated authority. Human checkpoints cannot be manufactured by this tool.', parameters: Strict({ jobId: Id }),
    async execute(_id, params, _signal, _update, ctx) { return result(accept(params.jobId, ctx, 'model')); } });
}
