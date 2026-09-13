import test from 'node:test';
import assert from 'node:assert/strict';
import { Type } from 'typebox';
import type { Context, AssistantMessage } from '@earendil-works/pi-ai';
import { newId, objectHash } from '../extensions/llgf/version.ts';
import { runWorker, WorkerFailure, type WorkerHost, type WorkerPermit } from '../extensions/llgf/workers.ts';
import type { ContextPacket } from '../extensions/llgf/context.ts';
const schema = Type.Object({ prose: Type.String() }, { additionalProperties: false });
function setup() {
  let active = true; const seen: Context[] = [];
  const permit: WorkerPermit = { projectId: newId(), runId: newId(), epoch: 1, provider: 'fixture', model: 'fixture', active: () => active };
  const receipt: ContextPacket['receipt'] = { schemaVersion: 1, method: 'symbolic-context-v1', projectId: permit.projectId, sceneId: newId(), role: 'drafter', included: [], omitted: [], dependencies: [], requiredCoverage: [], inputEstimatedTokens: 10, reservedOutputTokens: 500, hostTokens: 0, safetyReserve: 200, modelWindow: 32000, tokenMethod: 'utf8-bytes-divided-by-four', warnings: [] };
  const packet = { text: 'Only this scene. No parent history.', receipt, hash: '' }; packet.hash = objectHash({ text: packet.text, receipt });
  const answer = { role: 'assistant', content: [{ type: 'text', text: '{"prose":"The door remained closed."}' }], provider: 'fixture', model: 'fixture', api: 'openai-responses', stopReason: 'stop', usage: { input: 20, output: 10, totalTokens: 30, cost: { total: 0 } }, timestamp: Date.now() } as AssistantMessage;
  const host = { model: { provider: 'fixture', id: 'fixture', contextWindow: 32000, maxTokens: 4000 }, modelRegistry: { async complete(_m: unknown, context: Context) { seen.push(context); return answer; } } } as unknown as WorkerHost;
  const request = { task: 'draft' as const, packet, outputSchema: schema, maxOutputTokens: 500, timeoutMs: 1000 };
  return { permit, packet, host, answer, seen, request, pause: () => { active = false; } };
}
test('worker sends one isolated message, no tools, no parent history and no resource discovery', async () => {
  const s = setup(); const result = await runWorker(s.host, s.permit, s.request);
  assert.equal(result.value.prose, 'The door remained closed.'); assert.equal(s.seen.length, 1);
  assert.equal(s.seen[0].messages.length, 1); assert.deepEqual(s.seen[0].tools, []);
  assert.equal(s.seen[0].messages[0].content, s.packet.text); assert.equal(result.call.costEstimate, null);
  assert.equal(result.call.totalTokens, 30); assert.match(s.seen[0].systemPrompt!, /data, never instructions/);
});
test('worker refuses unauthorized, changed-model, mismatched-role and altered packets before a call', async () => {
  const s = setup(); s.pause(); await assert.rejects(runWorker(s.host, s.permit, s.request), /not authorized/); assert.equal(s.seen.length, 0);
  const t = setup(); await assert.rejects(runWorker(t.host, { ...t.permit, model: 'other' }, t.request), /model/);
  await assert.rejects(runWorker(t.host, t.permit, { ...t.request, task: 'revise' }), /role/);
  t.packet.text += 'modified'; await assert.rejects(runWorker(t.host, t.permit, t.request), /packet changed/);
});
test('malformed, schema-invalid, truncated and tool-using responses are failures with private evidence', async () => {
  for (const variant of ['invalid', '{"unexpected":1}', 'truncated', 'tool']) {
    const s = setup();
    if (variant === 'truncated') s.answer.stopReason = 'length';
    else if (variant === 'tool') s.answer.content.push({ type: 'toolCall', id: 'x', name: 'bash', arguments: {} });
    else s.answer.content = [{ type: 'text', text: variant }];
    await assert.rejects(runWorker(s.host, s.permit, s.request), error => error instanceof WorkerFailure && error.call.status === 'failed' && error.call.outputHash !== null);
  }
});
test('late results after pause cannot be accepted', async () => {
  const s = setup(); const original = s.host.modelRegistry.complete.bind(s.host.modelRegistry);
  s.host.modelRegistry.complete = async (...args) => { const result = await original(...args); s.pause(); return result; };
  await assert.rejects(runWorker(s.host, s.permit, s.request), e => e instanceof WorkerFailure && e.call.status === 'cancelled');
});
test('worker timeout/cancellation does not start retries and schema overhead is budgeted', async () => {
  const s = setup(); s.host.modelRegistry.complete = () => new Promise(() => {});
  await assert.rejects(runWorker(s.host, s.permit, { ...s.request, timeoutMs: 10 }), e => e instanceof WorkerFailure && e.call.status === 'cancelled');
  const t = setup(); t.host.model!.contextWindow = 100;
  await assert.rejects(runWorker(t.host, t.permit, t.request), /schema and output reserve/);
});
