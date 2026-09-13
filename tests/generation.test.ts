import test from 'node:test';
import assert from 'node:assert/strict';
import { candidateStrategies, validateGeneration, defaultGeneration, selectCandidate } from '../extensions/llgf/generation.ts';
import { pipelineFixture, mockPipelineHost } from './pipeline-helpers.ts';
import { prepareScene, runScene } from '../extensions/llgf/pipeline.ts';
import { proseHash } from '../extensions/llgf/version.ts';
import type { WorkerHost } from '../extensions/llgf/workers.ts';

test('functional alternatives are explicitly risk-adaptive, never compulsory in ordinary prose', () => {
  const p = { riskPatternIds: ['C2'], functionalStrategies: ['action', 'silence'] as ('action' | 'silence')[], maximumCandidates: 2 };
  validateGeneration(p); assert.deepEqual(candidateStrategies(p, [], 0), []); assert.deepEqual(candidateStrategies(p, ['C2'], 1), []);
  assert.deepEqual(candidateStrategies(p, ['C2'], 0), ['action', 'silence']); assert.equal(defaultGeneration().maximumCandidates, 1);
  assert.throws(() => validateGeneration({ ...p, functionalStrategies: ['action', 'action'] }), /Duplicate/);
  assert.throws(() => validateGeneration({ ...p, riskPatternIds: ['FAKE'] }), /Unknown/);
});
test('candidate selection must cite its chosen wording and can reject every alternative', () => {
  const choices = [{ prose: 'She shut the door.', strategy: 'action' }, { prose: 'She said nothing.', strategy: 'silence' }];
  const vote = { selectedIndex: 1, rationale: 'Maintains refusal without explanation', evidence: 'said nothing', risks: [], functionSatisfied: true };
  assert.equal(selectCandidate(vote, choices), 1);
  assert.throws(() => selectCandidate({ ...vote, selectedIndex: 0 }, choices), /exact evidence/);
  assert.throws(() => selectCandidate({ ...vote, selectedIndex: null }, choices), /No functional/);
  assert.throws(() => selectCandidate(vote, [choices[0], choices[0]]), /did not differ/);
});
test('bounded scene alternatives retain rejected text and all paid call records', async () => {
  const f = pipelineFixture(); try {
    f.setup.mode = 'continue'; f.setup.generation = { riskPatternIds: ['C2'], functionalStrategies: ['action', 'silence'], maximumCandidates: 2 };
    const mock = mockPipelineHost(f.address.id), complete = mock.host.modelRegistry!.complete.bind(mock.host.modelRegistry);
    const host: WorkerHost = { ...mock.host, modelRegistry: { complete: async (...args) => {
      const response = await complete(...args), input = JSON.parse(args[1].messages[0].content as string), move = JSON.parse(input.nextMove ?? '{}');
      const c = response.content[0]; if (c.type !== 'text') throw new Error('Fixture text expected'); let out = JSON.parse(c.text);
      if (input.role === 'drafter') out.prose = move.strategy === 'action' ? 'She tapped the latch.' : 'Still she said nothing.';
      if (args[1].systemPrompt?.includes('Select among functionally different')) out = { selectedIndex: 1, rationale: 'Silence continues the wait without an explanatory seal', evidence: 'said nothing', risks: ['May be too reticent'], functionSatisfied: true };
      return { ...response, content: [{ type: 'text', text: JSON.stringify(out) }] };
    } } as WorkerHost['modelRegistry'] };
    const p = prepareScene(f.root, f.address, f.setup, proseHash(f.body)), permit = { projectId: f.store.projectId, runId: p.id, epoch: 1, provider: 'fixture', model: 'mock', active: () => true };
    const s = await runScene(f.root, p.id, host, permit); assert.equal(s.stage, 'ready'); assert.ok(s.body.endsWith('Still she said nothing.'));
    assert.equal(s.records.filter(r => r.key.startsWith('alternative:')).length, 2); assert.equal(s.records.filter(r => r.key.startsWith('selection:')).length, 1);
    assert.equal(mock.calls(), 8);
  } finally { f.dispose(); }
});
