import test from 'node:test';
import assert from 'node:assert/strict';
import { newId, proseHash } from '../extensions/llgf/version.ts';
import { validateContract, validateProposition, characterEvidence, apparentConflicts, validateObligationGraph, type Proposition, type SceneContract } from '../extensions/llgf/narrative.ts';
const unknownTime = { earliest: null, latest: null, label: 'unknown' };
const day = (n: number) => ({ earliest: n, latest: n, label: `Day ${n}` });
const sceneId = newId(), holder = newId(), subject = newId(), body = 'He found the broken key.';
const evidence = [{ sceneId, textHash: proseHash(body), start: 0, end: body.length, quote: body, offsetUnit: 'utf16' as const }];
const resolve = (id: string, hash: string) => id === sceneId && hash === proseHash(body) ? body : undefined;
function proposition(changes: Partial<Proposition> = {}): Proposition {
  return { schemaVersion: 1, id: newId(), subjectId: subject, predicate: 'key.condition', value: 'broken', layer: 'world', status: 'hypothesis', holderId: null, acquisition: { eventId: null, at: unknownTime }, validTime: unknownTime, disclosedAt: 1, sourceType: 'narration', validation: 'proposed', confidence: 'medium', evidence, sourceRecords: [], review: null, supersedes: [], conflictsWith: [], ...changes };
}
export function contract(id = newId()): SceneContract {
  return { schemaVersion: 1, sceneId: id, status: 'provisional', condition: { focalizerId: holder, sceneFunction: 'aftermath', secondaryFunctions: [], pressure: 'quiet', distance: 'close', epochId: null, storyTime: day(2), narrativeIndex: 1 }, purpose: 'Rest after the failed trial', dramaticQuestion: '', entryState: [], obligations: [], prohibitions: ['No invented attack'], information: [{ statement: 'The mentor avoids the mark', mode: 'inferable', holderId: holder, evidenceRequired: 'An observable response' }], knowledgeDelta: [], pressureCurve: [], distanceTrajectory: [], subtext: [], sensoryAffordances: [], promiseActions: [], exitStateRange: ['Rest continues'], protected: [], riskForecast: [], openDiscoveries: ['A compatible new gesture'] };
}
test('quiet/discovery contracts preserve explicit, inferable, withheld and ambiguous information', () => {
  const c = contract(); assert.equal(validateContract(c).dramaticQuestion, '');
  c.information.push({ ...c.information[0], mode: 'withheld' }); validateContract(c);
  c.protected.push({ id: newId(), kind: 'ambiguity', requirement: 'Keep both readings', readings: ['fear'], spans: [], method: 'human' });
  assert.throws(() => validateContract(c), /two supported readings/);
  c.protected[0].readings.push('complicity'); validateContract(c);
});
test('metaphor, dialogue and unreviewed extraction cannot become canonical facts', () => {
  validateProposition(proposition(), resolve);
  assert.throws(() => validateProposition(proposition({ status: 'canon' }), resolve), /unreviewed/);
  const p = proposition({ status: 'canon', validation: 'verified', review: { actor: 'model', rationale: 'Direct narration establishes the physical condition.' } });
  validateProposition(p, resolve);
  for (const sourceType of ['metaphor', 'dialogue', 'free_indirect', 'hypothetical'] as const) assert.throws(() => validateProposition({ ...p, sourceType }, resolve), /promoted/);
  assert.throws(() => validateProposition({ ...p, sourceType: 'author_design' }, resolve), /author authority/);
  assert.throws(() => validateProposition({ ...p, evidence: [{ ...evidence[0], quote: 'Invented' }] }, resolve), /does not match/);
});
test('knowledge cuts use acquisition time, holder and reading order without flattening beliefs', () => {
  const p = proposition({ layer: 'character', holderId: holder, status: 'viewpoint_belief', validation: 'verified', review: { actor: 'model', rationale: 'Belief is reported, not established as world truth.' }, acquisition: { eventId: newId(), at: day(5) } });
  validateProposition(p, resolve);
  assert.equal(characterEvidence([p], holder, 4, 9).available.length, 0);
  assert.equal(characterEvidence([p], holder, 6, 0).available.length, 0);
  assert.equal(characterEvidence([p], newId(), 6, 9).available.length, 0);
  assert.equal(characterEvidence([p], holder, 6, 9).available[0].status, 'viewpoint_belief');
  assert.equal(characterEvidence([{ ...p, acquisition: { ...p.acquisition, at: unknownTime } }], holder, 6, 9).uncertainTime.length, 1);
});
test('conflicts preserve changed beliefs, temporal change and layer distinctions', () => {
  const a = proposition({ validTime: day(1) }), b = proposition({ value: 'whole', validTime: day(2) });
  assert.deepEqual(apparentConflicts([a, b]), []);
  assert.equal(apparentConflicts([a, { ...b, validTime: day(1) }])[0].status, 'apparent');
  assert.deepEqual(apparentConflicts([a, { ...b, validTime: day(1), supersedes: [a.id] }]), []);
  assert.deepEqual(apparentConflicts([a, { ...b, validTime: day(1), layer: 'character', holderId: holder }]), []);
});
test('causal prerequisite graphs reject missing, duplicate and cyclic obligations', () => {
  const a = { id: newId(), statement: 'The key is acquired', hardness: 'hard' as const, preconditions: [], dependsOn: [] as string[], acceptableOutcomes: ['Acquired'], deferralAllowed: false, completionEvidence: 'Prose acquisition' };
  const b = { ...a, id: newId(), dependsOn: [a.id] }; validateObligationGraph([a, b]);
  assert.throws(() => validateObligationGraph([b]), /Missing/); assert.throws(() => validateObligationGraph([a, a]), /Duplicate/);
  assert.throws(() => validateObligationGraph([{ ...a, dependsOn: [b.id] }, b]), /Cyclic/);
});

 test('a later belief change does not rewrite earlier knowledge cutoffs', () => {
  const a = proposition({ layer: 'character', holderId: holder, status: 'viewpoint_belief', validation: 'verified', review: { actor: 'model', rationale: 'Reported belief' }, acquisition: { eventId: newId(), at: day(2) } });
  const b = { ...a, id: newId(), value: 'whole', supersedes: [a.id], acquisition: { eventId: newId(), at: day(5) } };
  assert.deepEqual(characterEvidence([a, b], holder, 3, 9).available.map(p => p.id), [a.id]);
  assert.deepEqual(characterEvidence([a, b], holder, 6, 9).available.map(p => p.id), [b.id]);
});
