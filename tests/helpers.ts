import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Check } from 'typebox/value';
import type { TSchema } from 'typebox';
import type { ProjectConfig } from '../extensions/novel-core.ts';

// Tests simulate host dispatch and validate real tool schemas. They do not call models.
export function fakePi() {
  const tools = new Map<string, { parameters: TSchema; execute: (...args: any[]) => Promise<any> }>();
  const commands = new Map<string, { handler: (...args: any[]) => Promise<any> }>();
  const hooks = new Map<string, ((...args: any[]) => any)[]>();
  const messages: unknown[] = [];
  const api = {
    registerTool(tool: any) { if (tools.has(tool.name)) throw new Error(`Duplicate tool ${tool.name}`); tools.set(tool.name, tool); },
    registerCommand(name: string, command: any) { if (commands.has(name)) throw new Error(`Duplicate command ${name}`); commands.set(name, command); },
    registerMessageRenderer() {},
    on(event: string, callback: (...args: any[]) => any) { hooks.set(event, [...hooks.get(event) || [], callback]); },
    events: new EventEmitter(), sendMessage(m: unknown) { messages.push(m); }, sendUserMessage(m: unknown) { messages.push(m); },
    setSessionName() {}, getCommands() { return []; },
    exec() { throw new Error('Unexpected process invocation in test'); },
  } as unknown as ExtensionAPI;
  return { api, tools, commands, hooks, messages,
    async call(name: string, params: unknown, ctx: unknown = {}) {
      const tool = tools.get(name); if (!tool) throw new Error(`Missing tool ${name}`);
      if (!Check(tool.parameters, params)) throw new Error(`Invalid test parameters for ${name}`);
      return tool.execute('test-call', params, new AbortController().signal, () => {}, ctx);
    },
    async event(name: string, event: unknown, ctx: unknown) { for (const hook of hooks.get(name) || []) await hook(event, ctx); },
  };
}
export function projectFixture(format: ProjectConfig['format'] = 'novel') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pnw-project-'));
  const config: ProjectConfig = {
    title: 'Test project', author: 'Test', genre: 'fantasy', subgenre: [], format,
    pov: 'third-limited', tense: 'past', targetWordCount: 1000, dailyWordGoal: 100,
    comparableTitles: [], structuralFramework: '', workflow: 'discovery',
    settings: { autoSummary: false, summaryModel: '', draftModel: '', editModel: '', voiceProfilePath: 'bible/voice-profile.md', editor: 'auto', subscriptionMode: false,
      contextBudget: { system: 1000, bible: 1000, summaries: 1000, recentProse: 1000, currentScene: 1000, voiceProfile: 500 } },
  };
  fs.writeFileSync(path.join(root, 'project.json'), JSON.stringify(config));
  const ctx = { cwd: root, hasUI: false, isIdle: () => true, getContextUsage: () => null, sessionManager: { getEntries: () => [] } };
  return { root, config, ctx, dispose: () => fs.rmSync(root, { recursive: true, force: true }) };
}
