import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { validateStudy, prepareReaderPackets, describeTrials, describeResponses, type Study, type Trial, type ReaderResponse } from '../extensions/llgf/evaluation.ts';
import { workerResources } from '../extensions/llgf/resources.ts';
import { JobStore } from '../extensions/llgf/jobs.ts';
import { newId, proseHash, hashText } from '../extensions/llgf/version.ts';
import { LiteraryStore } from '../extensions/llgf/store.ts';
import { projectFixture } from './helpers.ts';
const study = validateStudy(JSON.parse(fs.readFileSync(new URL('../configs/benchmark.json', import.meta.url), 'utf8')));
const trial = (id: string, conditionId: Trial['conditionId']): Trial => ({ schemaVersion: 1, id, manuscriptId: id, premiseId: 'premise', voiceId: 'voice', conditionId, tier: 1000, seed: 'one', provider: 'fixture', model: 'mock', accessDate: '2026-09-13', phase: 'raw', status: 'complete', failureReason: '', body: 'An exact line.\n\n  Deliberate spacing.  ', textHash: proseHash('An exact line.\n\n  Deliberate spacing.  '), rights: 'project_owned', readerDistributionAllowed: true, sourceNote: 'Synthetic test, not a model experiment', manuscriptWordOffset: 0,
  resources: { inputTokens: null, outputTokens: null, calls: null, rejectedCandidates: null, revisionCalls: null, humanEditingSeconds: null, humanSelectionSeconds: null, costEstimate: null } });
test('study catalog preserves all five lengths, fifteen ablations and three negative controls without authorizing generation', () => {
  assert.equal(study.lengthTiers.length, 5); assert.equal(study.selectedAblations.length, 15); assert.equal(study.negativeControls.length, 3);
  assert.equal(study.generationAuthorized, false); assert.equal(study.registeredProtocol, null);
  assert.throws(() => validateStudy({ ...study, generationAuthorized: true }), /Invalid/);
});
test('reader packets preserve wording, hide condition metadata and counterbalance repeated comparison blocks', () => {
  const f = projectFixture(); try {
    const rows = [trial('baseline-private-name', 'B0'), trial('proposed-private-name', 'P')];
    rows.push(...rows.map(t => ({ ...t, id: t.id + '-second', premiseId: 'another-premise' })));
    const one = path.join(f.root, 'one'), two = path.join(f.root, 'two');
    const a = prepareReaderPackets(study, rows, one), b = prepareReaderPackets(study, rows, two); assert.deepEqual(a, b);
    const sides = a.pairs.map(p => rows.find(r => r.id === p.leftTrial)!.conditionId); assert.deepEqual(new Set(sides), new Set(['B0', 'P']));
    const text = fs.readFileSync(path.join(one, 'readers', a.pairs[0].pairId + '.md'), 'utf8');
    assert.ok(text.includes(rows[0].body)); assert.doesNotMatch(text, /baseline-private-name|proposed-private-name|mock|fixture/);
    assert.ok(fs.existsSync(path.join(one, 'private/key.json')));
    assert.throws(() => prepareReaderPackets(study, rows, one), /already exists/);
  } finally { f.dispose(); }
});
test('incomplete or uncleared trial data is reported or rejected, not silently improved or dropped', () => {
  const f = projectFixture(); try {
    const rows = [trial('base', 'B0'), trial('full', 'P'), { ...trial('failure', 'B1'), status: 'failed' as const, body: '', textHash: proseHash(''), failureReason: 'Provider interruption' }];
    const d = describeTrials(study, rows); assert.equal(d.statusCounts.failed, 1); assert.equal(d.trials.length, 3); assert.equal(d.statisticalInference, 'not_performed');
    assert.equal(d.trials[0].resources.costEstimate, null); assert.ok(d.trials[0].lengthDifference < 0);
    rows[0].readerDistributionAllowed = false; assert.throws(() => prepareReaderPackets(study, rows, path.join(f.root, 'out')), /permission/);
    rows[0].body += ' Changed.'; assert.throws(() => describeTrials(study, rows), /version changed/);
  } finally { f.dispose(); }
});
test('reader responses retain ties and uncertainty, reject duplicates, and require the unchanged decoding key', () => {
  const f = projectFixture(); try {
    const key = prepareReaderPackets(study, [trial('base', 'B0'), trial('full', 'P')], path.join(f.root, 'out'));
    const r: ReaderResponse = { schemaVersion: 1, packetId: key.packetId, pairId: key.pairs[0].pairId, readerIdHash: hashText('pseudonymous-reader'), task: 'literary_preference', preference: 'tie', evidence: '', confidence: 'low', completedAt: '2026-09-13', suppliedBy: 'external_reader_record' };
    const d = describeResponses(key, [r]); assert.equal(d.pairs[0].responses[0].preferredTrial, null); assert.equal(d.suppliedResponses, 1);
    assert.throws(() => describeResponses(key, [r, r]), /Duplicate/);
    const changed = structuredClone(key); changed.pairs[0].leftTrial = 'another'; assert.throws(() => describeResponses(changed, [r]), /key changed|paired trial reference/);
  } finally { f.dispose(); }
});
test('durable resource summary counts interrupted calls and does not invent zero cost', () => {
  const f = projectFixture(); try {
    const store = LiteraryStore.initialize(f.root), jobs = new JobStore(f.root, store.projectId), id = newId();
    jobs.create(id, hashText('input'), { maxCalls: 2, maxReservedTokens: 1000, maxCost: null, maxRevisions: 0 }, id);
    jobs.reserve(id, hashText('request'), 400, { projectId: store.projectId, runId: id, epoch: 1, provider: 'fixture', model: 'mock', active: () => true });
    const r = workerResources(f.root); assert.equal(r.callsReserved, 1); assert.equal(r.reservedTokens, 400); assert.equal(r.costEstimate.total, null); assert.equal(r.inputTokens.total, null);
    jobs.inspectInterrupted(id, 'Inspected failed test call'); assert.equal(workerResources(f.root).statuses.failed, 1);
  } finally { f.dispose(); }
});
test('offline evaluation command consumes JSONL and creates a new descriptive output without provider calls', () => {
  const f = projectFixture(); try {
    const config = path.join(f.root, 'study.json'), records = path.join(f.root, 'trials.jsonl'), out = path.join(f.root, 'report.json');
    fs.writeFileSync(config, JSON.stringify(study)); fs.writeFileSync(records, JSON.stringify(trial('base', 'B0')) + '\n');
    const cmd = spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/evaluate.mjs', 'describe', config, records, out], { encoding: 'utf8' });
    assert.equal(cmd.status, 0, cmd.stderr); assert.equal(JSON.parse(fs.readFileSync(out, 'utf8')).comparativeLiteraryEfficacy, 'not_established');
  } finally { f.dispose(); }
});
test('declared ablations form separate matched treatments and preserve unpaired and failed records', () => {
  const f = projectFixture(); try {
    const a = trial('full', 'P'), b = { ...trial('noStyle', 'P'), appliedAblations: ['A4' as const] };
    const unpaired = { ...trial('other', 'B0'), premiseId: 'unpaired' };
    const configured = { ...study, selectedAblations: ['A4' as const] };
    const out = path.join(f.root, 'out');
    const key = prepareReaderPackets(configured, [a, b, unpaired], out);
    assert.equal(key.pairs.length, 1);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out, 'private/unpaired-trials.json'), 'utf8')).map((r: { id: string }) => r.id), ['other']);
    assert.throws(() => describeTrials({ ...study, selectedAblations: [] }, [b]), /undeclared ablations/);
    assert.throws(() => describeTrials(configured, [{ ...b, conditionId: 'B0' }]), /condition P/);
  } finally { f.dispose(); }
});
