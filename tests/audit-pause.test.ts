import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { AgentSession } from '@earendil-works/pi-coding-agent';
import core from '../extensions/novel-core.ts';
import auto from '../extensions/novel-auto.ts';
import progress from '../extensions/novel-progress.ts';
import { fakePi, projectFixture } from './helpers.ts';

test('Live F1: status/sprint notices cannot restart pause; acknowledgment waits for idle', async () => {
  const f = projectFixture(), pi = fakePi(), controller = new AbortController();
  console.log(`Retained pause fixture: ${f.root}`);
  const queued: any[] = [], displayed: any[] = [];
  let starts = 0, waiting = false, settle!: () => void;
  const idle = new Promise<void>(resolve => { settle = resolve; });
  // Exercise the installed host's actual message routing, not a guessed queue rule.
  const delivery: any = {
    isStreaming: false, _pendingCustomMessages: [], _pendingNextTurnMessages: [],
    agent: { steer: (m: any) => queued.push(m), followUp: (m: any) => queued.push(m) },
    _appendCustomMessage: (m: any) => displayed.push(m),
    _runAgentPrompt: async () => { starts++; delivery.isStreaming = true; },
  };
  pi.api.sendMessage = (message, options) => { void AgentSession.prototype.sendCustomMessage.call(delivery, message, options); };
  core(pi.api); auto(pi.api); progress(pi.api);
  const ctx = {
    ...f.ctx,
    get signal() { return delivery.isStreaming ? controller.signal : undefined; },
    isIdle: () => !delivery.isStreaming,
    abort: () => { queued.length = 0; controller.abort(); },
    waitForIdle: async () => { waiting = true; await idle; delivery.isStreaming = false; },
  };
  try {
    await pi.event('session_start', {}, ctx);
    await pi.commands.get('PNW-auto')!.handler('start --turns 2 Test rain-gauge planning only.', ctx);
    assert.equal(starts, 1);
    await pi.commands.get('PNW-status')!.handler('', ctx);
    await pi.commands.get('PNW-progress')!.handler('', ctx);
    await pi.commands.get('PNW-auto')!.handler('status', ctx);
    await pi.commands.get('PNW-sprint')!.handler('1', ctx);
    assert.equal(queued.length, 0, 'Passive status/sprint messages must not request another response');
    const paused = pi.commands.get('PNW-auto')!.handler('pause', ctx);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(waiting, true, 'abort is void; wait for actual idle separately');
    assert.equal(queued.length, 0, 'Synchronous sprint abort notification must not repopulate the cleared queue');
    assert.equal(displayed.some(m => String(m.content).startsWith('Writing paused.')), false);
    settle(); await paused;
    assert.equal(displayed.some(m => String(m.content).startsWith('Writing paused.')), true);
    assert.equal(JSON.parse(fs.readFileSync(path.join(f.root, '.pi/novel-run.json'), 'utf8')).status, 'paused');
    await pi.event('agent_settled', {}, ctx);
    assert.equal(starts, 1, 'No autonomous restart while paused');
    await pi.commands.get('PNW-auto')!.handler('resume --turns 2', ctx);
    assert.equal(starts, 2, 'Explicit resume still starts work');
  } finally {
    settle();
    await pi.event('session_shutdown', {}, ctx);
  }
});
