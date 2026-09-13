import test from 'node:test';
import assert from 'node:assert/strict';
import { monitorDrift, validateBaseline, conditionKey, type DriftBaseline } from '../extensions/llgf/drift.ts';
import { METHOD_VERSION } from '../extensions/llgf/diagnostics.ts';
import { newId, proseHash } from '../extensions/llgf/version.ts';
import { pipelineFixture } from './pipeline-helpers.ts';

function fixture() {
  const f = pipelineFixture();
  const baseline: DriftBaseline = { schemaVersion: 1, id: newId(), condition: f.setup.contract.condition,
    scope: 'scene', methodVersion: METHOD_VERSION, minimumWords: 50, windowWords: 50, stepWords: 25,
    calibration: 'heuristic', rationale: 'Deliberate synthetic reference, not a human band', sourceRecords: [],
    ranges: [{ metric: 'sentence_mean', min: 30, max: 40 }, { metric: 'mattr50', min: 0.9, max: 1 }] };
  const body = 'She waited beside the door. '.repeat(30);
  const input = { sceneId: f.address.id, body, source: { key: `prose:${f.address.id}`, hash: proseHash(body) }, condition: f.setup.contract.condition };
  return { f, baseline, input };
}
test('drift is uncalibrated without a matched frozen reference and insufficient for short samples', () => {
  const { f, baseline, input } = fixture();
  try {
    assert.equal(monitorDrift([input]).windows[0].assessment, 'uncalibrated');
    assert.equal(monitorDrift([{ ...input, body: 'She waited.' }], [baseline]).windows[0].assessment, 'insufficient_evidence');
    const other = structuredClone(baseline); other.condition.epochId = newId();
    assert.equal(monitorDrift([input], [other]).windows[0].assessment, 'uncalibrated');
  } finally { f.dispose(); }
});
test('multiple proxy families trigger only inspection; licensing preserves the deviation and baseline', () => {
  const { f, baseline, input } = fixture();
  try {
    const before = JSON.stringify(baseline), report = monitorDrift([input], [baseline]);
    assert.equal(report.alerts.length, 1); assert.equal(report.windows[0].assessment, 'outside_reference');
    const licensed = monitorDrift([input], [baseline], [{ sceneId: input.sceneId, rationale: 'Deliberate ritual repetition' }]);
    assert.equal(licensed.windows[0].assessment, 'licensed'); assert.equal(licensed.alerts.length, 0);
    assert.equal(JSON.stringify(baseline), before);
    baseline.ranges = [baseline.ranges[0]];
    assert.equal(monitorDrift([input], [baseline]).alerts.length, 0);
  } finally { f.dispose(); }
});
test('rolling windows retain source offsets, word positions and correlated-window caveat', () => {
  const { f, baseline, input } = fixture();
  try {
    baseline.scope = 'rolling';
    const report = monitorDrift([input], [baseline]), rolling = report.windows.filter(w => w.scope === 'rolling');
    assert.equal(rolling.length, 5); assert.equal(rolling[1].wordStart, 25);
    assert.ok(rolling.every(w => input.body.slice(w.start, w.end).length > 0 && w.textHash === proseHash(input.body)));
    assert.ok(report.limitations.some(s => s.includes('correlated')));
    assert.equal(conditionKey(input.condition), conditionKey({ ...input.condition, narrativeIndex: 40 }));
  } finally { f.dispose(); }
});
test('calibration metadata, bounded proportions and reference conflicts fail closed', () => {
  const { f, baseline, input } = fixture();
  try {
    assert.throws(() => validateBaseline({ ...baseline, calibration: 'human_calibrated' }), /traceable/);
    assert.throws(() => validateBaseline({ ...baseline, ranges: [{ metric: 'mattr50', min: 0, max: 2 }] }), /Proportion/);
    assert.throws(() => monitorDrift([input], [baseline, { ...baseline, id: newId() }]), /Ambiguous/);
    assert.throws(() => validateBaseline({ ...baseline, stepWords: 51 }), /gaps/);
  } finally { f.dispose(); }
});
