import test from 'node:test';
import assert from 'node:assert/strict';
import { newId, objectHash } from '../extensions/llgf/version.ts';
import { validateVoice, compileVoice, recordVoiceObservation, type AuthorVoice, type VoiceFeature, type Anchor, type VoiceWhen } from '../extensions/llgf/voice.ts';
import type { SceneCondition } from '../extensions/llgf/narrative.ts';
const when: VoiceWhen = { focalizerIds: [], sceneFunctions: [], epochIds: [], pressures: [], distances: [] };
const condition: SceneCondition = { focalizerId: newId(), sceneFunction: 'aftermath', secondaryFunctions: [], pressure: 'quiet', distance: 'close', epochId: null, storyTime: { earliest: 2, latest: 2, label: 'Day 2' }, narrativeIndex: 10 };
const feature = (id: string): VoiceFeature => ({ id, level: 'scene', dimension: 'rhythm', description: 'Let attention determine cadence.', representation: 'relational', target: 'functional contrast', when, exceptions: ['Ritual repetition'], priority: 1, hardness: 'soft', evidenceMethod: 'human', overuseRisk: 'Conspicuous forced variance', underuseRisk: 'Uniform cadence', confidence: 'medium' });
const voice = (): AuthorVoice => ({ schemaVersion: 1, id: newId(), name: 'Original voice', rationale: 'Material attention without compulsory metaphor.', nonImitationDeclaration: 'An original project, not named-author imitation.', narrator: { person: 'third', tense: 'past', access: 'Focalizer knowledge only', reliability: 'Beliefs are not world facts' }, invariants: [feature('cadence')], profiles: [{ id: newId(), name: 'Danger', when: { ...when, sceneFunctions: ['pursuit'] }, features: [feature('pressure')], notes: [] }], transitions: [], variationBudgets: [], motifBehavior: [], negativeConstraints: [{ patternId: 'C2', when, reason: 'Do not explain an already legible implication.', positiveAffordance: 'Carry the implication into action or leave it.', priority: 2 }], anchorIds: [], uncertainty: ['No empirical voice envelope yet'], epochs: [], calibration: { status: 'not_performed', sampleIds: [], reviewRecords: [] } });
const anchor = (at: number): Anchor => ({ schemaVersion: 1, id: newId(), kind: 'anchor', function: 'An ordinary sentence retains pressure.', when, excerpt: 'She put the key down without asking.', sourceSpan: null, sourceRecords: [], narrativeIndex: at, rights: { status: 'author_owned', basis: 'Original fixture', permitted: ['drafting'], livingAuthor: true, permissionRecorded: true }, wordingPolicy: 'function_only' });
test('compiler selects conditional features and never treats ranges as quotas', () => {
  const v = voice(); const hash = objectHash(v);
  const quiet = compileVoice(v, condition, [], { maxTokens: 2000 });
  assert.deepEqual(quiet.selectedFeatures, ['cadence']); assert.ok(quiet.text.includes('not quotas'));
  const danger = compileVoice(v, { ...condition, sceneFunction: 'pursuit' }, [], { maxTokens: 2000, risks: ['C2'] });
  assert.ok(danger.selectedFeatures.includes('pressure')); assert.ok(danger.text.includes('Available alternative'));
  assert.equal(hash, objectHash(v)); assert.equal(quiet.calibrationStatus, 'not_performed');
});
test('oversized required voice controls fail visibly instead of disappearing', () => {
  const v = voice(); v.invariants[0].hardness = 'hard'; v.invariants[0].description = 'A'.repeat(10000);
  assert.throws(() => compileVoice(v, condition, [], { maxTokens: 500 }), /Required voice controls exceed budget/);
  v.invariants[0].hardness = 'soft'; const p = compileVoice(v, condition, [], { maxTokens: 500 });
  assert.ok(p.omitted.some(x => x.id === 'cadence' && x.reason === 'voice token budget')); assert.ok(p.estimatedTokens <= 500);
});
test('anchors require rights and condition fit, use local and distal contrast, and report omissions', () => {
  const v = voice(), old = anchor(1), recent = anchor(9), future = anchor(12), excluded = { ...anchor(4), rights: { ...old.rights, status: 'analysis_only' as const } }, wrong = { ...anchor(5), when: { ...when, sceneFunctions: ['pursuit'] } };
  v.anchorIds = [old.id, recent.id, future.id, excluded.id, wrong.id];
  const p = compileVoice(v, condition, [old, recent, future, excluded, wrong], { maxTokens: 2000, requireAnchor: true });
  assert.deepEqual(p.selectedAnchors, [recent.id, old.id]); assert.equal(p.omitted.filter(x => [future.id, excluded.id, wrong.id].includes(x.id)).length, 3);
  assert.throws(() => compileVoice(v, condition, [excluded], { maxTokens: 2000, requireAnchor: true }), /Required identity anchor/);
});
test('anti-anchors are risk-triggered and unapproved epochs cannot overwrite voice identity', () => {
  const v = voice(), a = { ...anchor(1), kind: 'anti_anchor' as const }; v.anchorIds = [a.id];
  assert.equal(compileVoice(v, condition, [a], { maxTokens: 2000 }).selectedAnchors.length, 0);
  assert.equal(compileVoice(v, condition, [a], { maxTokens: 2000, risks: ['C2'] }).selectedAnchors.length, 1);
  const id = newId(); v.epochs.push({ id, name: 'After loss', profileIds: [], transitionEvidence: [], rationale: 'New distance', approved: false });
  assert.throws(() => compileVoice(v, { ...condition, epochId: id }, [], { maxTokens: 2000 }), /unapproved/);
});
test('calibration claims need evidence and observed features never mutate AVS', () => {
  const v = voice(); v.calibration.status = 'human_reviewed'; assert.throws(() => validateVoice(v), /Human voice review needs evidence/);
  v.calibration.status = 'not_performed'; const before = objectHash(v);
  const o = recordVoiceObservation({ schemaVersion: 1, sceneId: newId(), textHash: before, avsHash: before, condition, features: { sentence_cv: null }, methodVersion: 'test-v1' });
  assert.equal(o.features.sentence_cv, null); assert.equal(objectHash(v), before);
});

test('duplicate and mismatched anchors cannot silently change the evidence bank', () => {
  const v = voice(), a = anchor(1); v.anchorIds = [a.id, a.id];
  assert.throws(() => validateVoice(v), /Duplicate anchor/);
  v.anchorIds = [a.id]; assert.throws(() => compileVoice(v, condition, [a, a], { maxTokens: 2000 }), /Duplicate supplied/);
  const bad = { ...a, sourceSpan: { sceneId: newId(), textHash: objectHash(v), start: 0, end: 4, quote: 'Fake', offsetUnit: 'utf16' as const } };
  assert.throws(() => compileVoice(v, condition, [bad], { maxTokens: 2000 }), /disagree/);
});
