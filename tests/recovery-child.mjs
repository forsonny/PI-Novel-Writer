// Deliberate child-process exit inside actual production critical sections.
// No finally runs; only new test material under the recorded fixture is used.
import fs from 'node:fs';
import { applyMigration } from '../extensions/llgf/migration.ts';
import { JobStore } from '../extensions/llgf/jobs.ts';
import core from '../extensions/novel-core.ts';
import literary from '../extensions/novel-literary.ts';
import { fakePi } from './helpers.ts';
const [mode, root, value] = process.argv.slice(2);
if (mode === 'migration') {
  const plan = JSON.parse(fs.readFileSync(value, 'utf8'));
  applyMigration(root, plan, plan.digest, index => {
    if (index === 1) process.exit(23);
  });
} else if (mode === 'accounting') {
  const { projectId, jobId } = JSON.parse(value);
  new JobStore(root, projectId).update(jobId, job => {
    job.reason = 'This interrupted update must not be persisted';
    process.exit(23);
  });
} else if (mode === 'audit') {
  const host = fakePi(); core(host.api); literary(host.api);
  const ctx = { cwd: root, hasUI: false, isIdle: () => true, getContextUsage: () => null, sessionManager: { getEntries: () => [] },
    model: { id: 'mock', provider: 'fixture', maxTokens: 20000, contextWindow: 100000 },
    modelRegistry: { complete: async () => process.exit(23) } };
  await host.commands.get('PNW-load').handler('', ctx);
  await host.commands.get('PNW-literary').handler('authorize 1 300000', ctx);
  await host.call('novel_literary_audit', { scope: JSON.parse(value), review: true }, ctx);
} else throw new Error('Unknown crash fixture');
throw new Error('Crash point was not reached');
