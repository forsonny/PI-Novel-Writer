import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import core from '../extensions/novel-core.ts';
import literary from '../extensions/novel-literary.ts';
import { guidanceUpdate } from '../extensions/llgf/guidance.ts';
import { checked } from '../extensions/llgf/schema.ts';
import { SceneSetupSchema } from '../extensions/llgf/pipeline.ts';
import { validateVoice } from '../extensions/llgf/voice.ts';
import { validateContract } from '../extensions/llgf/narrative.ts';
import { fakePi, projectFixture } from './helpers.ts';

test('shipped setup illustration validates but cannot be mistaken for an execution grant', () => {
  const value = checked(SceneSetupSchema, JSON.parse(fs.readFileSync(new URL('../configs/example-scene-setup.json', import.meta.url), 'utf8')));
  validateVoice(value.voice); validateContract(value.contract);
  assert.match(value.sourcePolicy, /ILLUSTRATION/); assert.equal(value.voice.calibration.status, 'not_performed');
  assert.equal(value.mode, 'review_existing');
});
test('explicit guidance upgrade preserves author additions and does not rewrite the loaded project on read', async () => {
  const f = projectFixture(), pi = fakePi(); core(pi.api); literary(pi.api);
  try {
    const update = guidanceUpdate('0.2.2'); fs.mkdirSync(path.join(f.root, '.pi'));
    const original = update.oldGuidance + '\n## Author addition\nKeep my dry humor.\n';
    const file = path.join(f.root, '.pi/APPEND_SYSTEM.md'); fs.writeFileSync(file, original);
    await pi.commands.get('PNW-load')!.handler(f.root, f.ctx);
    assert.equal(fs.readFileSync(file, 'utf8'), original);
    await pi.commands.get('PNW-literary')!.handler('upgrade-guidance 0.2.2', f.ctx);
    const preview = JSON.parse((pi.messages.at(-1) as { content: string }).content);
    assert.deepEqual(preview.conflicts, []); assert.equal(fs.readFileSync(file, 'utf8'), original);
    await pi.commands.get('PNW-literary')!.handler('apply ' + preview.digest, f.ctx);
    const after = fs.readFileSync(file, 'utf8'); assert.match(after, /Keep my dry humor/); assert.match(after, /Managed Literary Workflow/);
    assert.doesNotMatch(after, /Never generate purple prose/);
    const status = JSON.parse((await pi.call('novel_literary_status', {})).content[0].text); assert.equal(status.authority, null); assert.equal(status.settings.enabled, false);
  } finally { f.dispose(); }
});
test('unknown baseline retains author text and exposes incoming guidance, never guessing a merge', async () => {
  const f = projectFixture(), pi = fakePi(); core(pi.api); literary(pi.api);
  try {
    fs.mkdirSync(path.join(f.root, '.pi')); fs.writeFileSync(path.join(f.root, '.pi/APPEND_SYSTEM.md'), 'Custom authored policy.');
    await pi.commands.get('PNW-load')!.handler(f.root, f.ctx);
    await pi.commands.get('PNW-literary')!.handler('upgrade-guidance', f.ctx);
    const preview = JSON.parse((pi.messages.at(-1) as { content: string }).content); assert.ok(preview.conflicts.length);
    await pi.commands.get('PNW-literary')!.handler('apply ' + preview.digest, f.ctx);
    assert.equal(fs.readFileSync(path.join(f.root, '.pi/APPEND_SYSTEM.md'), 'utf8'), 'Custom authored policy.');
    assert.match(fs.readFileSync(path.join(f.root, '.pi/APPEND_SYSTEM.incoming.md'), 'utf8'), /Managed Literary Workflow/);
    assert.throws(() => guidanceUpdate('../secret'), /Unknown/);
  } finally { f.dispose(); }
});
