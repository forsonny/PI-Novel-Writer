import test from 'node:test';
import assert from 'node:assert/strict';
import { pipelineFixture, mockPipelineHost } from './pipeline-helpers.ts';
import { saveDesign } from '../extensions/llgf/registry-service.ts';
import { prepareScene, runScene } from '../extensions/llgf/pipeline.ts';
import { newId, proseHash } from '../extensions/llgf/version.ts';
import type { Affordance } from '../extensions/llgf/registries.ts';
import type { WorkerHost } from '../extensions/llgf/workers.ts';

test('M02: all outgoing requests and packet receipts exclude transmission-prohibited registry material', async () => {
  // Explicit synthetic store fixture, NOT evidence of public managed activation.
  const f = pipelineFixture();
  console.log(`Retained transmission fixture: ${f.root}`);
  const notes: Affordance[] = [];
  for (const restriction of ['prohibited', 'excluded', 'draft-only', 'allowed'] as const) {
    const affordance: Affordance = {
      schemaVersion: 1, id: newId(), description: `PRIVATE-MARKER-${restriction}`,
      sourceState: [], when: { focalizerIds: [], sceneFunctions: [], epochIds: [], pressures: [], distances: [] },
      holderId: null, sourceDomains: ['metalwork'], perceptualOptions: ['stress along a copper seam'],
      positiveAlternatives: ['the changed pitch under a hammer'], status: 'proposed',
      rights: { status: restriction === 'excluded' ? 'excluded' : 'author_owned', basis: 'Synthetic author fixture',
        permitted: restriction === 'draft-only' ? ['drafting'] : ['analysis'], livingAuthor: null, permissionRecorded: true },
      providerTransmissionAllowed: restriction !== 'prohibited',
      saturation: { windowWords: 1000, warningCount: null, basis: 'unconfigured', evidence: [] }, uses: [],
    };
    saveDesign(f.root, 'affordance', affordance, f.store.head().hash, 'human'); notes.push(affordance);
  }
  const mock = mockPipelineHost(f.address.id), complete = mock.host.modelRegistry!.complete.bind(mock.host.modelRegistry);
  const requests: string[] = [];
  const host: WorkerHost = { ...mock.host, modelRegistry: { complete: async (...args) => {
    requests.push(JSON.stringify(args[1]));
    return complete(...args);
  } } as WorkerHost['modelRegistry'] };
  const p = prepareScene(f.root, f.address, f.setup, proseHash(f.body));
  const result = await runScene(f.root, p.id, host, { projectId: f.store.projectId, runId: p.id, epoch: 1, provider: 'fixture', model: 'mock', active: () => true });
  assert.equal(result.stage, 'ready');
  assert.equal(requests.length, 4);
  const receipts = result.records.filter(r => r.key.startsWith('model_call:')).map(r => JSON.stringify(f.store.artifact(r.hash).payload));
  assert.equal(receipts.length, 4);
  for (const marker of ['prohibited', 'excluded', 'draft-only']) {
    for (const request of [...requests, ...receipts]) assert.equal(request.includes(`PRIVATE-MARKER-${marker}`), false, marker);
  }
  assert.equal(requests.filter(r => r.includes('PRIVATE-MARKER-allowed')).length, 2);
  const options = requests.map(r => JSON.parse(JSON.parse(r).messages[0].content))
    .filter(packet => packet.nextMove).map(packet => JSON.parse(packet.nextMove))
    .filter(instruction => instruction.registryOptions);
  assert.equal(options.length, 2);
  for (const instruction of options) {
    assert.equal(instruction.registryOptions.length, 1);
    assert.equal(instruction.registryOmissions.length, 3);
  }
  for (const note of notes) assert.equal((f.store.get(`affordance:${note.id}`)!.payload as Affordance).description, note.description);
});
