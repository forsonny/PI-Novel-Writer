import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import core, { getProject } from '../extensions/novel-core.ts';
import literary from '../extensions/novel-literary.ts';
import { fakePi } from './helpers.ts';
import { mockPipelineHost } from './pipeline-helpers.ts';
import { newId, proseHash } from '../extensions/llgf/version.ts';
import { auditDimensions } from '../extensions/llgf/audits.ts';
import { LiteraryStore } from '../extensions/llgf/store.ts';
import type { WorkerHost } from '../extensions/llgf/workers.ts';

/** Synthetic review responses, but public activation/preparation/acceptance.
 * Never use this fixture as evidence of real model or human literary approval.
 */
export async function reviewStatusFixture() {
  const root = fs.mkdtempSync(path.join(process.env.PNW_STATUS_FIXTURE_BASE || os.tmpdir(), 'pnw-review-status-'));
  console.log(`Retained synthetic review-status project: ${root}`);
  const pi = fakePi(); core(pi.api); literary(pi.api);
  const ctx: any = { cwd: root, hasUI: false, isIdle: () => true, getContextUsage: () => null, sessionManager: { getEntries: () => [] } };
  const command = (args: string) => pi.commands.get('PNW-literary')!.handler(args, ctx);
  await pi.commands.get('PNW-init')!.handler('', ctx);
  const body = 'Iona set the sealed letter beside the door. Footsteps stopped beyond it, but nobody answered her knock. She left her hand on the latch and waited.';
  const initial = JSON.parse((await pi.call('novel_scene_read', { chapter: 1, scene: 1 }, ctx)).content[0].text);
  await pi.call('novel_scene_write', { chapter: 1, scene: 1, content: body, expectedSourceHash: initial.sourceHash }, ctx);
  await command('migrate delegated');
  await command('apply ' + JSON.parse((pi.messages.at(-1) as any).content).digest);
  const sceneId = getProject()!.scenes.get('01-01')!.id!;
  const setup = JSON.parse(fs.readFileSync(new URL('../configs/example-scene-setup.json', import.meta.url), 'utf8'));
  setup.contract.sceneId = sceneId; setup.voice.id = newId();
  setup.sourcePolicy = 'Original synthetic test source; all review responses in this fixture are simulated.';
  fs.writeFileSync(path.join(root, 'setup.json'), JSON.stringify(setup));
  const worker = mockPipelineHost(sceneId); Object.assign(ctx, worker.host);
  const prepared = JSON.parse((await pi.call('novel_literary_prepare', { chapter: 1, scene: 1, setupPath: 'setup.json', expectedSourceHash: proseHash(body) }, ctx)).content[0].text);
  await command('authorize 12 300000');
  await command('run ' + prepared.jobId);
  await command('accept ' + prepared.jobId);
  await command('pause');
  const store = LiteraryStore.open(root);
  const status = async (jobId: string) => JSON.parse((await pi.call('novel_literary_status', { jobId }, ctx)).content[0].text);
  const auditWorker: WorkerHost = { ...worker.host, modelRegistry: { complete: async (_model: unknown, context: any) => {
    const input = JSON.parse(context.messages[0].content), s = input.scenes[0];
    const evidence = [{ sceneId: s.address.id, textHash: s.textHash, start: 0, end: s.body.length, quote: s.body, offsetUnit: 'utf16' }];
    const review = { schemaVersion: 1, inputHash: input.inputHash, reconstruction: 'An unanswered wait outside the door.',
      checks: auditDimensions.map(dimension => ({ dimension, outcome: 'supported', evidence, rationale: 'Explicitly simulated review for status testing only.', blocking: false, causeLevel: 'unknown', smallestRepair: '', pairedRisk: '' })),
      futureControlRecommendations: [], proposedPlanChanges: [], limitations: ['Synthetic fixture, not a real model or human review.'], humanLiteraryEvaluation: 'not_performed' };
    return { role: 'assistant', content: [{ type: 'text', text: JSON.stringify(review) }], api: 'mock', provider: 'fixture', model: 'mock', stopReason: 'stop', timestamp: Date.now(),
      usage: { input: 10, output: 10, totalTokens: 20, cacheRead: 0, cacheWrite: 0, cost: { total: 0 } } };
  } } as unknown as WorkerHost['modelRegistry'] };
  return { root, pi, ctx, command, status, store, sceneId, sceneJob: prepared.jobId, body, auditWorker };
}
