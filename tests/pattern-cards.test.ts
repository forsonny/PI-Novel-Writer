import test from 'node:test';
import assert from 'node:assert/strict';
import { cardsFor } from '../extensions/llgf/pattern-cards.ts';
import { patterns } from '../extensions/llgf/taxonomy.ts';
import literary from '../extensions/novel-literary.ts';
import { fakePi } from './helpers.ts';
import { pipelineFixture, mockPipelineHost } from './pipeline-helpers.ts';
import { prepareScene, runScene } from '../extensions/llgf/pipeline.ts';
import { proseHash } from '../extensions/llgf/version.ts';

test('all fine-grained pattern cards preserve source families, functional evidence and paired risks', () => {
  const cards = cardsFor(); assert.equal(cards.length, 56); assert.equal(new Set(cards.map(c => c.family)).size, 48);
  for (const c of cards) { assert.ok(c.definition.length > 30); assert.ok(c.evidenceNeeded && c.pairedOvercorrection && c.noActionRule); assert.equal(c.automaticRejection, false); }
  assert.notEqual(cardsFor(['E7'])[0].definition, cardsFor(['E8'])[0].definition);
  assert.deepEqual(cards.map(c => c.id), patterns.map(p => p.id));
  cards[0].definition = 'Changed copy'; assert.notEqual(cardsFor(['A1'])[0].definition, 'Changed copy');
  assert.throws(() => cardsFor(['invented']), /Unknown/);
});
test('the read-only card tool returns a compact index or requested complete cards', async () => {
  const pi = fakePi(); literary(pi.api);
  const index = JSON.parse((await pi.call('novel_literary_patterns', {})).content[0].text);
  assert.equal(index.index.length, 56); assert.equal(index.cards, undefined);
  const out = JSON.parse((await pi.call('novel_literary_patterns', { ids: ['C2', 'H5'] })).content[0].text);
  assert.equal(out.cards.length, 2); assert.match(out.cards[0].definition, /explains/); assert.equal(out.taxonomyVersion, index.taxonomyVersion);
});
test('the isolated diagnostic call receives functional cards, not just pattern titles', async () => {
  const f = pipelineFixture();
  try {
    const p = prepareScene(f.root, f.address, f.setup, proseHash(f.body)), mock = mockPipelineHost(f.address.id);
    const original = mock.host.modelRegistry.complete.bind(mock.host.modelRegistry); let checkedCards = false;
    mock.host.modelRegistry.complete = (async (model, context, options) => {
      if (context.systemPrompt?.includes('Diagnose only supported literary-quality risks.')) {
        const packet = JSON.parse(context.messages[0].content as string), next = JSON.parse(packet.nextMove);
        assert.equal(next.patterns.length, 56); assert.ok(next.patterns.every((c: { evidenceNeeded?: string; pairedOvercorrection?: string }) => c.evidenceNeeded && c.pairedOvercorrection)); checkedCards = true;
      }
      return original(model, context, options);
    }) as typeof mock.host.modelRegistry.complete;
    await runScene(f.root, p.id, mock.host, { projectId: f.store.projectId, runId: p.id, epoch: 1, provider: 'fixture', model: 'mock', active: () => true });
    assert.equal(checkedCards, true);
  } finally { f.dispose(); }
});
