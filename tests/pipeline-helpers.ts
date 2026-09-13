import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { AssistantMessage } from '@earendil-works/pi-ai';
import { projectFixture } from './helpers.ts';
import { prepareScene, runScene, acceptScene, readPipeline, type SceneSetup, type SceneAddress } from '../extensions/llgf/pipeline.ts';
import { newId, proseHash } from '../extensions/llgf/version.ts';
import { LiteraryStore } from '../extensions/llgf/store.ts';
import { validationDimensions } from '../extensions/llgf/gates.ts';
import { TAXONOMY_VERSION } from '../extensions/llgf/taxonomy.ts';
import type { WorkerHost, WorkerPermit } from '../extensions/llgf/workers.ts';

const body = 'She waited beside the door. Nobody answered.';
export function pipelineFixture() {
  const f = projectFixture(), store = LiteraryStore.initialize(f.root), sceneId = newId();
  fs.writeFileSync(path.join(f.root, '.pnw/project.json'), JSON.stringify({ schemaVersion: 1, projectId: store.projectId, enabled: true, governance: 'delegated', compute: 'minimal', createdAt: new Date().toISOString(), importedState: 'unverified', contentPolicy: '', sourcePolicy: '', disclosurePolicy: '' }));
  const address: SceneAddress = { id: sceneId, path: 'manuscript/chapters/01/scene-01.md', chapter: 1, scene: 1, order: 1, narrativeIndex: 0 };
  const file = path.join(f.root, address.path); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `---\nid: "${sceneId}"\nchapter: 1\nscene: 1\nstatus: "draft"\ncustom: "Keep this"\n---\n${body}`);
  const setup: SceneSetup = { schemaVersion: 1, contract: { schemaVersion: 1, sceneId, status: 'approved', condition: { focalizerId: null, sceneFunction: 'aftermath', secondaryFunctions: [], pressure: 'quiet', distance: 'close', epochId: null, storyTime: { earliest: null, latest: null, label: '' }, narrativeIndex: 0 }, purpose: 'Unanswered waiting', dramaticQuestion: '', entryState: [], obligations: [], prohibitions: [], information: [{ statement: 'Who is behind the door', mode: 'withheld', holderId: null, evidenceRequired: '' }], knowledgeDelta: [], pressureCurve: [], distanceTrajectory: [], subtext: [], sensoryAffordances: [], promiseActions: [], exitStateRange: ['Wait continues'], protected: [], riskForecast: [], openDiscoveries: [] },
    voice: { schemaVersion: 1, id: newId(), name: 'Original voice', rationale: 'Quiet attention', nonImitationDeclaration: 'Original work', narrator: { person: 'third', tense: 'past', access: 'focalizer only', reliability: 'limited' }, invariants: [], profiles: [], transitions: [], variationBudgets: [], motifBehavior: [], negativeConstraints: [], anchorIds: [], uncertainty: ['No calibrated thresholds'], epochs: [], calibration: { status: 'not_performed', sampleIds: [], reviewRecords: [] } }, anchors: [], required: [], participantIds: [], minWords: 5, maxWords: 100, unitMaxWords: 30, maxUnits: 2, mode: 'review_existing', budget: { maxCalls: 12, maxReservedTokens: 300000, maxCost: null, maxRevisions: 1 }, transmissionApproved: true, sourcePolicy: 'Original fixture' };
  return { ...f, store, address, setup, file, body };
}
export function mockPipelineHost(id: string, violate = false, beforeResponse?: () => void) {
  let calls = 0;
  const model = { id: 'mock', provider: 'fixture', maxTokens: 20000, contextWindow: 100000 };
  const host = { model, modelRegistry: { complete: async (_m: unknown, context: { systemPrompt: string; messages: { content: string }[]; tools: unknown[] }) => {
    calls++; assert.equal(context.messages.length, 1); assert.deepEqual(context.tools, []);
    const input = JSON.parse(context.messages[0].content), h = proseHash(input.localProse);
    const evidence = [{ sceneId: id, textHash: h, start: 0, end: input.localProse.length, quote: input.localProse, offsetUnit: 'utf16' }];
    const role = input.role;
    let out: unknown;
    if (role === 'planner') out = { moves: ['Wait'], rationale: 'Quiet continuation', riskPatternIds: [] };
    else if (role === 'drafter') out = { prose: 'A hinge creaked. She stayed.', done: true, uncertainties: [] };
    else if (role === 'critic') out = { schemaVersion: 1, sceneId: id, textHash: h, taxonomyVersion: TAXONOMY_VERSION, assessedPatternIds: ['C2'], findings: [], limitations: ['Fixture model assessment only'] };
    else if (context.systemPrompt.includes('Extract proposed epistemic')) out = { propositions: [], uncertainties: [] };
    else out = { schemaVersion: 1, sceneId: id, textHash: h, reconstruction: 'A wait without an answer', checks: validationDimensions.map(dimension => ({ dimension, outcome: 'pass', evidence, rationale: 'Fixture current text', classification: 'none' })), obligations: [], information: [{ index: 0, outcome: violate ? 'violated' : 'preserved', rationale: 'Identity stays unknown' }], protections: [], stateDecisions: [], exitInRange: true, exitRationale: 'Wait continues', limitations: ['Not human evaluation'] };
    beforeResponse?.();
    return { role: 'assistant', content: [{ type: 'text', text: JSON.stringify(out) }], api: 'mock', model: 'mock', provider: 'fixture', stopReason: 'stop', timestamp: Date.now(), usage: { input: 100, output: 100, totalTokens: 200, cacheRead: 0, cacheWrite: 0, cost: { total: 0 } } } as unknown as AssistantMessage;
  } } } as unknown as WorkerHost;
  return { host, calls: () => calls };
}
