import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { JobStore } from '../extensions/llgf/jobs.ts';
import { newId, hashText } from '../extensions/llgf/version.ts';
import type { WorkerPermit } from '../extensions/llgf/workers.ts';
test('call reservations survive interruption and consume budgets', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jobs-')), projectId = newId();
  try {
    const store = new JobStore(root, projectId), job = store.create(newId(), hashText('input'), { maxCalls: 2, maxReservedTokens: 100, maxCost: null, maxRevisions: 1 });
    const permit: WorkerPermit = { projectId, runId: job.id, epoch: 1, provider: 'fixture', model: 'fixture', active: () => true };
    store.reserve(job.id, hashText('call'), 60, permit);
    assert.throws(() => store.reserve(job.id, hashText('call2'), 30, permit), /Interrupted/);
    store.inspectInterrupted(job.id, 'Reviewed incomplete call; original allowance remains spent');
    assert.throws(() => store.reserve(job.id, hashText('call2'), 60, permit), /budget/);
    store.reserve(job.id, hashText('call2'), 30, permit); store.inspectInterrupted(job.id, 'Reviewed');
    assert.throws(() => store.reserve(job.id, hashText('call3'), 1, permit), /budget/);
    assert.equal(store.read(job.id).reservations.length, 2);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test('jobs do not infer permission from disk or treat unknown price as free', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jobs-')), projectId = newId();
  try {
    const store = new JobStore(root, projectId), job = store.create(newId(), hashText('input'), { maxCalls: 2, maxReservedTokens: 100, maxCost: 1, maxRevisions: 1 });
    const permit: WorkerPermit = { projectId, runId: job.id, epoch: 1, provider: 'fixture', model: 'fixture', active: () => false };
    assert.throws(() => store.reserve(job.id, hashText('call'), 10, permit), /authorized/);
    assert.throws(() => store.reserve(job.id, hashText('call'), 10, { ...permit, active: () => true }), /money cap/);
    assert.equal(store.read(job.id).reservations.length, 0);
    assert.throws(() => store.create(job.sceneId, hashText('different'), job.budget, job.id), /reused/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

import { validationDimensions, validateSceneReview, sceneGate, type SceneValidation } from '../extensions/llgf/gates.ts';
import { proseHash } from '../extensions/llgf/version.ts';
import type { SceneContract } from '../extensions/llgf/narrative.ts';
import type { DiagnosticReport } from '../extensions/llgf/diagnostics.ts';
import { TAXONOMY_VERSION } from '../extensions/llgf/taxonomy.ts';
const sid = newId(), prose = 'She sat beside the door. Nobody answered.', h = proseHash(prose);
const evidence = [{ sceneId: sid, textHash: h, start: 0, end: prose.length, quote: prose, offsetUnit: 'utf16' as const }];
const c: SceneContract = { schemaVersion: 1, sceneId: sid, status: 'approved', condition: { focalizerId: null, sceneFunction: 'aftermath', secondaryFunctions: [], pressure: 'quiet', distance: 'close', epochId: null, storyTime: { earliest: null, latest: null, label: '' }, narrativeIndex: 1 }, purpose: 'Wait', dramaticQuestion: '', entryState: [], obligations: [], prohibitions: [], information: [{ statement: 'Who is behind the door', mode: 'withheld', holderId: null, evidenceRequired: '' }], knowledgeDelta: [], pressureCurve: [], distanceTrajectory: [], subtext: [], sensoryAffordances: [], promiseActions: [], exitStateRange: ['Wait continues'], protected: [], riskForecast: [], openDiscoveries: [] };
const review = (): SceneValidation => ({ schemaVersion: 1, sceneId: sid, textHash: h, reconstruction: 'Waiting without an answer', checks: validationDimensions.map(dimension => ({ dimension, outcome: 'pass', evidence, rationale: 'Fixture evidence', classification: 'none' })), obligations: [], information: [{ index: 0, outcome: 'preserved', rationale: 'No identity is named' }], protections: [], stateDecisions: [], exitInRange: true, exitRationale: 'Waiting continues', limitations: [] });
const diagnostics: DiagnosticReport = { schemaVersion: 1 as const, sceneId: sid, textHash: h, taxonomyVersion: TAXONOMY_VERSION, assessedPatternIds: [], findings: [], limitations: [] };
test('scene gate separates delegated acceptance from human checkpoints', () => {
  const r = validateSceneReview(review(), prose, c, () => prose);
  assert.equal(sceneGate(prose, c, r, diagnostics, 'delegated').decision, 'ACCEPT');
  assert.equal(sceneGate(prose, c, r, diagnostics, 'collaborative').decision, 'HUMAN_REVIEW');
  assert.equal(sceneGate(prose, c, r, diagnostics, 'research').humanValidation, 'not_performed');
  r.checks[0].outcome = 'fail'; r.checks[0].classification = 'confirmed_error';
  assert.equal(sceneGate(prose, c, r, diagnostics, 'delegated').decision, 'TARGETED_REVISE');
});
test('withheld knowledge and unreviewed protected ambiguity cannot pass from fluency alone', () => {
  const r = review(); r.information[0].outcome = 'violated';
  assert.equal(sceneGate(prose, c, r, diagnostics, 'delegated').decision, 'TARGETED_REVISE');
  const p = { ...c, protected: [{ id: newId(), kind: 'ambiguity' as const, requirement: 'Two readings', readings: ['fear', 'complicity'], spans: [], method: 'model_assisted' as const }] };
  assert.equal(sceneGate(prose, p, review(), diagnostics, 'delegated').decision, 'TARGETED_REVISE');
  const missing = review(); missing.information = []; assert.throws(() => validateSceneReview(missing, prose, c, () => prose), /coverage/);
  const empty = review(); empty.checks[0].evidence = []; assert.throws(() => validateSceneReview(empty, prose, c, () => prose), /evidence/);
});
