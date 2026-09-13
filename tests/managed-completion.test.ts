import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import core, { getProject } from '../extensions/novel-core.ts';
import literary from '../extensions/novel-literary.ts';
import auto, { readRun, manuscriptIssues } from '../extensions/novel-auto.ts';
import { managedCompletionIssues } from '../extensions/llgf/completion.ts';
import { buildAudit, auditPacket, runAudit, auditDimensions } from '../extensions/llgf/audits.ts';
import { JobStore } from '../extensions/llgf/jobs.ts';
import { prepareScene, runScene, acceptScene } from '../extensions/llgf/pipeline.ts';
import { proseHash } from '../extensions/llgf/version.ts';
import type { WorkerHost } from '../extensions/llgf/workers.ts';
import { fakePi } from './helpers.ts';
import { pipelineFixture, mockPipelineHost } from './pipeline-helpers.ts';
const run = { plan: [{ chapter: 1, scene: 1 }], minWords: 5, maxWords: 100 };
async function accepted() {
  const f = pipelineFixture(), pi = fakePi(); core(pi.api); await pi.commands.get('PNW-load')!.handler(f.root, f.ctx);
  const p = prepareScene(f.root, f.address, f.setup, proseHash(f.body)), m = mockPipelineHost(f.address.id);
  const permit = { projectId: f.store.projectId, runId: p.id, epoch: 1, provider: 'fixture', model: 'mock', active: () => true };
  await runScene(f.root, p.id, m.host, permit); acceptScene(f.root, p.id, permit);
  return { ...f, pi, project: getProject()!, host: m.host };
}
test('managed completion requires accepted current sources, not final labels or legacy approvals', async () => {
  const f = await accepted();
  try {
    assert.deepEqual(managedCompletionIssues(f.project, run, false), []);
    const issues = managedCompletionIssues(f.project, run, true);
    assert.ok(issues.some(s => s.startsWith('chapter 1:'))); assert.ok(issues.some(s => s.startsWith('manuscript:')));
    fs.appendFileSync(f.file, '\nChanged despite final label.');
    assert.ok(managedCompletionIssues(f.project, run, false).some(s => s.includes('working prose differs')));
    const emptyRun = { ...run, version: 1 as const, brief: 'x', phase: 'complete' as const, status: 'complete' as const, revision: 1, next: '', evidence: {}, reviews: {} };
    assert.deepEqual(manuscriptIssues(f.project, emptyRun, true), managedCompletionIssues(f.project, run, true));
  } finally { f.dispose(); }
});
test('current complete chapter and manuscript assessments satisfy managed review coverage', async () => {
  const f = await accepted();
  try {
    const host = { ...f.host, modelRegistry: { complete: async (_model: unknown, context: { messages: { content: string }[] }) => {
      const data = JSON.parse(context.messages[0].content);
      return { role: 'assistant', content: [{ type: 'text', text: JSON.stringify({ schemaVersion: 1, inputHash: data.inputHash, reconstruction: 'Synthetic reading',
        checks: auditDimensions.map(dimension => ({ dimension, outcome: 'supported', evidence: [{ sceneId: f.address.id, textHash: proseHash(f.body), start: 0, end: f.body.length, quote: f.body, offsetUnit: 'utf16' }], rationale: 'Fixture', blocking: false, causeLevel: 'unknown', smallestRepair: '', pairedRisk: '' })),
        futureControlRecommendations: [], proposedPlanChanges: [], limitations: ['Not empirical evaluation'], humanLiteraryEvaluation: 'not_performed' }) }], model: 'mock', stopReason: 'stop' };
    } } } as unknown as WorkerHost;
    for (const scope of [{ level: 'chapter' as const, chapter: 1 }, { level: 'manuscript' as const }]) {
      const input = buildAudit(f.project, scope), packet = auditPacket(input, host), jobs = new JobStore(f.root, f.store.projectId);
      jobs.create(input.id, packet.inputHash, { maxCalls: 1, maxReservedTokens: packet.reservedTokens, maxCost: null, maxRevisions: 0 }, input.id);
      await runAudit(f.project, input, host, { projectId: f.store.projectId, runId: input.id, epoch: 1, provider: 'fixture', model: 'mock', active: () => true });
    }
    assert.deepEqual(managedCompletionIssues(f.project, run, true), []);
    assert.equal(fs.readFileSync(f.file, 'utf8').includes('Synthetic reading'), false);
  } finally { f.dispose(); }
});
test('managed auto author command grants bounded workers; loading, missing budgets and pause do not', async () => {
  const f = pipelineFixture(), pi = fakePi(); core(pi.api); literary(pi.api); auto(pi.api);
  const ctx = { ...f.ctx, ...mockPipelineHost(f.address.id).host, abort: async () => {} };
  try {
    await pi.commands.get('PNW-load')!.handler(f.root, ctx);
    const status = async () => JSON.parse((await pi.call('novel_literary_status', {}, ctx)).content[0].text);
    assert.equal((await status()).authority, null);
    await assert.rejects(pi.commands.get('PNW-auto')!.handler('start An unanswered wait', ctx), /explicit --calls/);
    assert.equal(readRun(f.root), null);
    await pi.commands.get('PNW-auto')!.handler('start --calls 20 --tokens 400000 --turns 4 An unanswered wait', ctx);
    assert.equal((await status()).authority.calls, 20); assert.equal(readRun(f.root)!.brief, 'An unanswered wait');
    assert.equal(readRun(f.root)!.continuations, 1);
    const blockers = pi.hooks.get('tool_call')!.map(h => h({ toolName: 'novel_scene_write' }, ctx));
    assert.ok(blockers.some(x => x?.block));
    for (const event of [{ toolName: 'write', input: { path: f.file } }, { toolName: 'write', input: { path: path.join(f.root, '.pnw/project.json') } }, { toolName: 'bash', input: {} },
      { toolName: 'export_docx', input: { inputPath: f.file, outputPath: f.file } },
      { toolName: 'export_docx', input: { inputPath: f.file, outputPath: path.join(f.root, '..', 'outside.docx') } }]) {
      assert.ok(pi.hooks.get('tool_call')!.map(h => h(event, ctx)).some(x => x?.block));
    }
    assert.equal(pi.hooks.get('tool_call')!.map(h => h({ toolName: 'write', input: { path: path.join(f.root, 'notes/concept.md') } }, ctx)).some(x => x?.block), false);
    await pi.commands.get('PNW-auto')!.handler('pause', ctx); assert.equal((await status()).authority, null);
    assert.equal(readRun(f.root)!.status, 'paused');
  } finally { f.dispose(); }
});
