import test from 'node:test';
import assert from 'node:assert/strict';
import { newId, objectHash, proseHash } from '../extensions/llgf/version.ts';
import { composeContext, type MemoryItem, type ContextRequest } from '../extensions/llgf/context.ts';
import type { SceneContract } from '../extensions/llgf/narrative.ts';
const projectId = newId(), focalizerId = newId();
const contract: SceneContract = { schemaVersion: 1, sceneId: newId(), status: 'provisional', purpose: 'aftermath of the trial', dramaticQuestion: '', condition: { focalizerId, sceneFunction: 'aftermath', secondaryFunctions: [], pressure: 'quiet', distance: 'close', epochId: null, storyTime: { earliest: 2, latest: 2, label: 'Day 2' }, narrativeIndex: 5 }, entryState: [], obligations: [], prohibitions: ['Do not reveal the mentor motive'], information: [], knowledgeDelta: [], pressureCurve: [], distanceTrajectory: [], subtext: [], sensoryAffordances: [], promiseActions: [], exitStateRange: ['Rest'], protected: [], riskForecast: [], openDiscoveries: [] };
function memory(text: string, changes: Partial<MemoryItem> = {}): MemoryItem {
  const id = newId(); return { schemaVersion: 1, id, projectId, source: { key: `state:${id}`, hash: objectHash(text) }, channel: 'narrative', kind: 'state', text, textHash: proseHash(text), status: 'accepted', authority: 'canonical', epistemicStatus: 'canon', roles: ['drafter', 'validator'], visibility: 'project', holderId: null, availableFrom: 1, when: { focalizerIds: [], sceneFunctions: [], epochIds: [], pressures: [], distances: [] }, dependencies: [], requiredContext: [], tags: ['aftermath'], salience: 1, rights: { status: 'author_owned', basis: 'Original fixture', permitted: ['drafting', 'analysis'], livingAuthor: true, permissionRecorded: true }, providerTransmissionAllowed: true, ...changes };
}
function request(items: MemoryItem[]): ContextRequest {
  return { projectId, role: 'drafter', contract, voice: { schemaVersion: 1, avsId: newId(), avsHash: objectHash('voice'), condition: contract.condition, text: 'An original close-third voice. Plain sentences are permitted.', estimatedTokens: 15, selectedFeatures: [], selectedProfiles: [], selectedAnchors: [], omitted: [], warnings: [], calibrationStatus: 'not_performed' }, localProse: 'He rested.', nextMove: 'Continue the quiet aftermath', participantIds: [focalizerId], required: [], controlSources: [], currentVersions: Object.fromEntries(items.map(m => [m.source.key, m.source.hash])), budget: { modelWindow: 8000, outputReserve: 1000, hostTokens: 1000, safetyReserve: 500, maxInputTokens: 5000 } };
}
test('future, wrong-holder, rejected, stale and critique memory cannot leak into drafting', () => {
  const items = [memory('future spoiler', { availableFrom: 7 }), memory('other mind', { visibility: 'focalizer', holderId: newId() }), memory('rejected candidate', { status: 'rejected' }), memory('critic says beautify', { kind: 'diagnosis', roles: ['critic'] }), memory('valid injury')];
  const r = request(items), p = composeContext(r, items);
  assert.equal(p.receipt.included.length, 1); for (const secret of ['future spoiler', 'other mind', 'rejected candidate', 'critic says beautify']) assert.ok(!p.text.includes(secret));
  r.currentVersions[items[4].source.key] = objectHash('changed'); assert.equal(composeContext(r, items).receipt.included.length, 0);
});
test('hard requirements bring distal dependencies and cannot lose to optional attractive prose', () => {
  const early = memory('The left hand was injured.'), cost = memory('The trial consumed the reserve.', { requiredContext: [early.source] }), decorative = memory('Pretty optional description');
  const items = [early, cost, decorative], r = request(items); r.required = [cost.source];
  const p = composeContext(r, items); assert.equal(p.receipt.requiredCoverage.length, 2); assert.ok(p.text.includes('left hand'));
  assert.throws(() => composeContext(r, [cost, decorative]), /Required context unavailable/);
  r.budget.maxInputTokens = 20; assert.throws(() => composeContext(r, items), /do not fit/);
});
test('full rendered input accounts for host and output reserves and never silently truncates', () => {
  const items = Array.from({ length: 20 }, (_, i) => memory(`${i} ` + 'description '.repeat(100))), r = request(items);
  const p = composeContext(r, items), c = p.receipt;
  assert.ok(c.inputEstimatedTokens + c.hostTokens + c.reservedOutputTokens + c.safetyReserve <= c.modelWindow);
  assert.ok(c.inputEstimatedTokens <= r.budget.maxInputTokens); assert.ok(c.omitted.length > 0);
});
test('summary contamination budget and duplicate content have explicit omission reasons', () => {
  const a = memory('Repeated reference'), b = memory('Repeated reference'), summary = memory('Summary of the aftermath', { kind: 'summary', authority: 'summary' });
  const r = request([a, b, summary]); r.summaryRatioMax = 0;
  const p = composeContext(r, [a, b, summary]); assert.ok(p.receipt.omitted.some(x => x.reason === 'duplicate content')); assert.ok(p.receipt.omitted.some(x => x.reason === 'summary-register budget'));
});
test('different project, stale dependent summary, and unauthorized transmission remain excluded', () => {
  const a = memory('foreign', { projectId: newId() }), b = memory('private', { providerTransmissionAllowed: false }), c = memory('stale summary', { kind: 'summary', dependencies: [{ key: `scene:${newId()}`, hash: objectHash('old') }] });
  const r = request([a, b, c]); assert.equal(composeContext(r, [a, b, c]).receipt.included.length, 0);
  r.required = [b.source]; assert.throws(() => composeContext(r, [a, b, c]), /not authorized/);
});
test('condition mismatch and corrupted content cannot masquerade as current evidence', () => {
  const a = memory('source'), r = request([a]);
  assert.throws(() => composeContext(r, [{ ...a, text: 'modified' }]), /content hash/);
  r.voice.condition = { ...contract.condition, sceneFunction: 'pursuit' }; assert.throws(() => composeContext(r, [a]), /another scene condition/);
});

test('provenance freshness does not dump entire source scenes into context', () => {
  const parent = { key: `scene:${newId()}`, hash: objectHash('a whole chapter') };
  const a = memory('A verified fact with its own evidence quote', { dependencies: [parent] }), r = request([a]);
  r.required = [a.source]; r.currentVersions[parent.key] = parent.hash;
  assert.equal(composeContext(r, [a]).receipt.included.length, 1);
  const control = { key: `avs:${newId()}`, hash: objectHash('voice spec') }; r.controlSources = [control];
  assert.throws(() => composeContext(r, [a]), /control source is stale/);
  r.currentVersions[control.key] = control.hash;
  assert.ok(composeContext(r, [a]).receipt.dependencies.some(d => d.key === control.key));
});
test('high priority alone does not admit unrelated lore', () => {
  const a = memory('Remote encyclopedia entry', { tags: ['unrelated'], salience: 3 }), r = request([a]);
  assert.equal(composeContext(r, [a]).receipt.included.length, 0);
});
