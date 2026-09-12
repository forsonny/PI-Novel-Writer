import { test } from 'node:test';
import assert from 'node:assert/strict';
import { observeSurface, anchorOverlaps, validateDiagnostics, distribution, type DiagnosticReport } from '../extensions/llgf/diagnostics.ts';
import { TAXONOMY_VERSION } from '../extensions/llgf/taxonomy.ts';
import { newId, proseHash } from '../extensions/llgf/version.ts';
const sceneId = newId(), body = 'The door remained shut. She waited. The door remained shut.';
function report(): DiagnosticReport { return { schemaVersion: 1, sceneId, textHash: proseHash(body), taxonomyVersion: TAXONOMY_VERSION, assessedPatternIds: ['C1'], limitations: ['Model assessment'], findings: [{ id: newId(), patternId: 'C1', rubric: 'appendixB-0-3', severity: 2, status: 'suspected', scope: 'scene', method: 'model_assisted', methodVersion: 'test', confidence: 'medium', evidence: [{ sceneId, textHash: proseHash(body), start: 0, end: 23, quote: body.slice(0, 23), offsetUnit: 'utf16' }], displacedFunction: 'Possible redundant information', counterevidence: 'Repetition may portray waiting', cause: { level: 'unknown', hypothesis: '', basis: [] }, pairedRisk: 'Loss of purposeful recurrence', recommendation: 'inspect', intervention: 'Inspect the dramatic function', successTest: 'Preserve the time effect', protectedIds: [] }] }; }
const resolve = (id: string, hash: string) => id === sceneId && hash === proseHash(body) ? body : undefined;
test('diagnostics bind source, coverage and separate licensing from severity', () => {
  assert.equal(validateDiagnostics(report(), body, sceneId, resolve).findings.length, 1);
  assert.throws(() => validateDiagnostics(report(), body + ' Later.', sceneId, resolve), /stale/);
  const r = report(); r.findings[0].status = 'licensed'; assert.throws(() => validateDiagnostics(r, body, sceneId, resolve), /numerical/);
  r.findings[0].severity = null; r.findings[0].recommendation = 'no_action'; assert.doesNotThrow(() => validateDiagnostics(r, body, sceneId, resolve));
});
test('diagnostics reject invented quotes, forged human reviews and proxy rewrites', () => {
  const r = report(); r.findings[0].evidence[0].quote = 'Invented'; assert.throws(() => validateDiagnostics(r, body, sceneId, resolve), /source/);
  const h = report(); h.findings[0].method = 'human'; assert.throws(() => validateDiagnostics(h, body, sceneId, resolve), /human/);
  const p = report(); p.findings[0].method = 'proxy'; p.findings[0].recommendation = 'revise'; assert.throws(() => validateDiagnostics(p, body, sceneId, resolve), /Surface/);
  const s = report(); s.findings[0].severity = 4; assert.throws(() => validateDiagnostics(s, body, sceneId, resolve), /Severity/);
});
test('observations give null for insufficient samples and do not reward roughness', () => {
  const empty = observeSurface(''); assert.equal(empty.mattr.value, null); assert.equal(empty.sentences.mean, null);
  const one = distribution([3]); assert.equal(one.variance, null);
  const regular = observeSurface('One two three four. One two three four.', 4);
  assert.equal(regular.words, 8); assert.equal(regular.mattr.value, 1); assert.equal(regular.repeatedFourgrams[0].count, 2);
  assert.equal(observeSurface('Élan isn’t fatigue.').words, 3);
  assert.ok(!('quality' in regular));
});
test('overlap screen is bounded and does not silently substitute semantic similarity', () => {
  const text = 'One two three four five six seven eight nine.';
  assert.ok(anchorOverlaps(text, [{ id: 'original-anchor', text }]).length);
  assert.deepEqual(anchorOverlaps(text, [{ id: 'different', text: 'A different sequence of ordinary words.' }]), []);
  assert.throws(() => anchorOverlaps(text, [], 1), /width/);
});
