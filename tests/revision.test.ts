import test from 'node:test';
import assert from 'node:assert/strict';
import { applyRevision, acceptRevision, recoveryLimit, planRevisions, type Comparison, type RevisionTask } from '../extensions/llgf/revision.ts';
import { newId, proseHash } from '../extensions/llgf/version.ts';
import type { SceneContract } from '../extensions/llgf/narrative.ts';
import type { DiagnosticReport } from '../extensions/llgf/diagnostics.ts';
import { TAXONOMY_VERSION } from '../extensions/llgf/taxonomy.ts';
const body = 'She shut the door. He said nothing. It was quiet.', sceneId = newId(), diagnosisId = newId();
const hash = proseHash(body);
const contract: SceneContract = { schemaVersion: 1, sceneId, status: 'approved', condition: { focalizerId: null, sceneFunction: 'quiet', secondaryFunctions: [], pressure: '', distance: '', epochId: null, storyTime: { earliest: null, latest: null, label: '' }, narrativeIndex: 1 }, purpose: 'A silence', dramaticQuestion: '', entryState: [], obligations: [], prohibitions: [], information: [], knowledgeDelta: [], pressureCurve: [], distanceTrajectory: [], subtext: [], sensoryAffordances: [], promiseActions: [], exitStateRange: ['Silence remains'], protected: [], riskForecast: [], openDiscoveries: [] };
const task: RevisionTask = { pass: 'compression-ambiguity', diagnosisIds: [diagnosisId], targets: [{ start: 34, end: body.length }], maxChangedWordFraction: 0.35, structural: false };
const proposal = () => ({ schemaVersion: 1, sceneId, sourceHash: hash, pass: task.pass, diagnosisIds: [diagnosisId], decision: 'propose', patches: [{ start: 34, end: body.length, original: body.slice(34), replacement: '' }], rationale: 'Remove redundant gloss' });
const resolve = (_id: string, h: string) => h === hash ? body : undefined;
test('minimal revisions bind source, target scope and change budget', () => {
  const result = applyRevision(body, proposal(), task, contract, resolve); assert.equal(result.body, body.slice(0, 34));
  assert.throws(() => applyRevision(body + ' Later.', proposal(), task, contract, resolve), /stale/);
  assert.throws(() => applyRevision(body, proposal(), { ...task, targets: [{ start: 0, end: 3 }] }, contract, resolve), /scope/);
  assert.throws(() => applyRevision(body, proposal(), { ...task, maxChangedWordFraction: 0.01 }, contract, resolve), /budget/);
});
test('exact spans cannot be edited or implicitly rebased', () => {
  const c = structuredClone(contract); c.protected.push({ id: newId(), kind: 'exact_text', requirement: 'Keep wording', spans: [{ sceneId, textHash: hash, start: 34, end: body.length, quote: body.slice(34), offsetUnit: 'utf16' }], readings: [], method: 'direct' });
  assert.throws(() => applyRevision(body, proposal(), task, c, resolve), /protected/);
});
test('keeping a sentence does not authorize adding an explanation that destroys its ambiguity', () => {
  const c = structuredClone(contract), propertyId = newId();
  c.protected.push({ id: propertyId, kind: 'ambiguity', requirement: 'Silence may be fear or complicity', spans: [], readings: ['fear', 'complicity'], method: 'model_assisted' });
  const result = applyRevision(body, proposal(), task, c, resolve);
  const cmp: Comparison = { schemaVersion: 1, sourceHash: hash, candidateHash: result.hash, preferred: 'candidate', targetImproved: true, semanticChanges: [], regressions: [], pairedRiskAcceptable: true, checks: [{ propertyId, outcome: 'preserved', rationale: 'Unresolved', method: 'model_assisted', evidence: [{ sceneId, textHash: result.hash, start: 0, end: result.body.length, quote: result.body, offsetUnit: 'utf16' }], readingsPreserved: ['fear'] }], rationale: 'Less gloss', dependencies: [] };
  const resolver = (_id: string, h: string) => h === hash ? body : h === result.hash ? result.body : undefined;
  assert.equal(acceptRevision(cmp, result, c, resolver).accept, false);
  cmp.checks[0].readingsPreserved.push('complicity'); assert.equal(acceptRevision(cmp, result, c, resolver).accept, true);
  cmp.checks[0].outcome = 'violated'; assert.equal(acceptRevision(cmp, result, c, resolver).accept, false);
  cmp.checks = []; assert.equal(acceptRevision(cmp, result, c, resolver).accept, false);
});
test('no supported diagnosis means no revision pass; oscillation stops recovery', () => {
  const report: DiagnosticReport = { schemaVersion: 1, sceneId, textHash: hash, taxonomyVersion: TAXONOMY_VERSION, assessedPatternIds: [], findings: [], limitations: [] };
  assert.deepEqual(planRevisions(report), { tasks: [], controlRepairs: [] });
  const r = { sourceHash: 'a', candidateHash: 'b', cause: 'gloss', pass: task.pass, accepted: false };
  assert.equal(recoveryLimit([r], 'gloss'), false); assert.equal(recoveryLimit([r, r], 'gloss'), true);
  assert.equal(recoveryLimit([r, { ...r, sourceHash: 'b', candidateHash: 'a', accepted: true }], 'other'), true);
});
