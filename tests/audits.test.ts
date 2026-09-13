import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import core, { getProject } from '../extensions/novel-core.ts';
import { buildAudit, auditSummary, auditPacket, runAudit, auditCurrent, validateAuditReview, auditDimensions, type AuditReview } from '../extensions/llgf/audits.ts';
import { prepareScene, runScene, acceptScene } from '../extensions/llgf/pipeline.ts';
import { JobStore } from '../extensions/llgf/jobs.ts';
import { newId, proseHash } from '../extensions/llgf/version.ts';
import { fakePi } from './helpers.ts';
import { pipelineFixture, mockPipelineHost } from './pipeline-helpers.ts';
import type { WorkerHost } from '../extensions/llgf/workers.ts';

async function acceptedFixture() {
  const f = pipelineFixture(), pi = fakePi(); core(pi.api);
  await pi.commands.get('PNW-load')!.handler(f.root, f.ctx);
  const p = prepareScene(f.root, f.address, f.setup, proseHash(f.body)), m = mockPipelineHost(f.address.id);
  const permit = { projectId: f.store.projectId, runId: p.id, epoch: 1, provider: 'fixture', model: 'mock', active: () => true };
  await runScene(f.root, p.id, m.host, permit); acceptScene(f.root, p.id, permit);
  return { ...f, project: getProject()!, host: m.host };
}
function review(f: Awaited<ReturnType<typeof acceptedFixture>>, inputHash: string): AuditReview {
  const evidence = [{ sceneId: f.address.id, textHash: proseHash(f.body), start: 0, end: f.body.length, quote: f.body, offsetUnit: 'utf16' as const }];
  return { schemaVersion: 1, inputHash, reconstruction: 'An unanswered wait', checks: auditDimensions.map(dimension => ({ dimension,
    outcome: 'supported', evidence, rationale: 'Explicitly synthetic model review', blocking: false, causeLevel: 'unknown', smallestRepair: '', pairedRisk: '' })),
    futureControlRecommendations: [], proposedPlanChanges: [], limitations: ['Fixture only'], humanLiteraryEvaluation: 'not_performed' };
}
test('sequence inspector is complete about coverage and never invents a semantic verdict', async () => {
  const f = await acceptedFixture();
  try {
    const at = f.store.head().hash, input = buildAudit(f.project, { level: 'chapter', chapter: 1 }), summary = auditSummary(input);
    assert.equal(summary.semanticAssessment, 'not_performed'); assert.equal(summary.words, 7);
    assert.deepEqual(summary.missing, []); assert.deepEqual(summary.stale, []);
    assert.equal(summary.drift.windows[0].assessment, 'uncalibrated');
    assert.equal(f.store.head().hash, at);
    assert.throws(() => buildAudit(f.project, { level: 'arc', planId: newId() }), /accepted arc plan/);
    assert.throws(() => buildAudit(f.project, { level: 'chapter' }), /parameters/);
  } finally { f.dispose(); }
});
test('one isolated sequence review is source-bound and does not change prose', async () => {
  const f = await acceptedFixture();
  try {
    const input = buildAudit(f.project, { level: 'manuscript' }), packet = auditPacket(input, f.host);
    let calls = 0;
    const host = { ...f.host, modelRegistry: { complete: async (_model: unknown, context: { messages: { content: string }[]; tools: unknown[] }) => {
      calls++; assert.equal(context.messages.length, 1); assert.deepEqual(context.tools, []);
      const data = JSON.parse(context.messages[0].content); assert.equal(data.scenes.length, 1);
      return { role: 'assistant', content: [{ type: 'text', text: JSON.stringify(review(f, data.inputHash)) }], model: 'mock', stopReason: 'stop', usage: { input: 10, output: 10, totalTokens: 20 } };
    } } } as unknown as WorkerHost;
    const jobs = new JobStore(f.root, f.store.projectId);
    jobs.create(input.id, packet.inputHash, { maxCalls: 1, maxReservedTokens: packet.reservedTokens, maxCost: null, maxRevisions: 0 }, input.id);
    const before = fs.readFileSync(f.file, 'utf8');
    const out = await runAudit(f.project, input, host, { projectId: f.store.projectId, runId: input.id, epoch: 1, provider: 'fixture', model: 'mock', active: () => true });
    assert.equal(calls, 1); assert.equal(out.coverageComplete, true); assert.equal(fs.readFileSync(f.file, 'utf8'), before);
    const record = f.store.get(out.audit.key)!.payload as { input: typeof input };
    assert.equal(auditCurrent(f.project, record), true); assert.equal(jobs.read(input.id).reservations.length, 1);
    fs.appendFileSync(f.file, '\nLater author edit.'); assert.equal(auditCurrent(f.project, record), false);
  } finally { f.dispose(); }
});
test('new working scenes invalidate sequence coverage even before the host reloads', async () => {
  const f = await acceptedFixture();
  try {
    const input = buildAudit(f.project, { level: 'manuscript' });
    const id = newId();
    fs.writeFileSync(path.join(f.root, 'manuscript/chapters/01/scene-02.md'), `---\nid: "${id}"\nchapter: 1\nscene: 2\nstatus: "outline"\n---\n`);
    assert.equal(auditCurrent(f.project, { input }), false);
    assert.deepEqual(buildAudit(f.project, { level: 'manuscript' }).missing, [id]);
  } finally { f.dispose(); }
});
test('audit findings need scoped evidence; full evidence cannot silently overflow a context', async () => {
  const f = await acceptedFixture();
  try {
    const input = buildAudit(f.project, { level: 'manuscript' }), packet = auditPacket(input, f.host), r = review(f, packet.inputHash);
    r.checks[0].evidence = []; assert.throws(() => validateAuditReview(r, input, packet.inputHash), /evidence inside/);
    assert.throws(() => auditPacket(input, { ...f.host, model: { ...f.host.model!, contextWindow: 100 } }), /does not fit/);
    input.selected[0].prose.transmissionApproved = false; assert.throws(() => auditPacket(input, f.host), /transmission approval/);
  } finally { f.dispose(); }
});
