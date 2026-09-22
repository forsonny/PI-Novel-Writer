import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import core, { buildFrontmatter, parseFrontmatter } from '../extensions/novel-core.ts';
import { fakePi } from './helpers.ts';
import { shareablePath } from '../extensions/utils/git.ts';
import writing from '../extensions/novel-write.ts';

// Retain synthetic material, including failed reproductions; no cleanup.
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pnw-repair-preservation-'));
  console.log(`Retained repair fixture: ${root}`);
  const host = fakePi();
  core(host.api);
  return { root, host };
}
const save = (root: string, file: string, text: string) => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), text);
};
const read = (root: string, file: string) => fs.readFileSync(path.join(root, file), 'utf8');

test('O-01: setup refuses every occupied placeholder before writing anything', async () => {
  for (const file of ['premise.md', 'outline/beat-sheet.md', 'bible/voice-profile.md', 'timeline/timeline.json', 'continuity/facts.json', 'continuity/character-states.json', 'continuity/report.json']) {
    const { root, host } = fixture();
    const original = 'Existing author material: 雨\r\nKeep every byte.\r\n';
    save(root, file, original);
    await host.commands.get('PNW-init')!.handler('', { cwd: root });
    assert.equal(read(root, file), original, file);
    assert.equal(fs.existsSync(path.join(root, 'project.json')), false);
    assert.equal(fs.existsSync(path.join(root, '.pi')), false);
  }
});

test('O-01: empty full/quick setup works and existing guidance survives', async () => {
  for (const args of ['', '--quick']) {
    const { root, host } = fixture();
    for (const file of ['.pi/AGENTS.md', '.pi/APPEND_SYSTEM.md', '.gitattributes']) save(root, file, 'Author rule\r\n');
    await host.commands.get('PNW-init')!.handler(args, { cwd: root });
    assert.ok(fs.existsSync(path.join(root, 'manuscript/chapters/01/scene-01.md')));
    for (const file of ['.pi/AGENTS.md', '.pi/APPEND_SYSTEM.md', '.gitattributes']) assert.equal(read(root, file), 'Author rule\r\n');
    assert.equal(fs.existsSync(path.join(root, 'premise.md')), args === '');
  }
});

test('O-06/O-12: rename preserves literal structured names and remains exact-case', async () => {
  const { root, host } = fixture();
  await host.commands.get('PNW-init')!.handler('', { cwd: root });
  const name = 'Mara "Ash" \\ 雨 $&';
  const original = JSON.stringify({ characters: { Mara: { name: 'Mara', variants: 'MARA mara' } }, escaped: 'M\\ara' });
  save(root, 'continuity/facts.json', original);
  save(root, 'bible/characters/mara.md', buildFrontmatter({ name: 'Mara', aliases: ['Mara'] }) + '# Mara\n');
  await host.call('novel_rename_entity', { oldName: 'Mara', newName: name });
  assert.equal(read(root, 'continuity/facts.json'), original);
  await host.call('novel_rename_entity', { oldName: 'Mara', newName: name, preview: false });
  const facts = JSON.parse(read(root, 'continuity/facts.json'));
  assert.equal(facts.characters[name].name, name);
  assert.equal(facts.characters[name].variants, 'MARA mara');
  assert.equal(facts.escaped, 'M\\ara');
  const bible = parseFrontmatter(read(root, 'bible/characters/mara.md'));
  assert.equal(bible.meta.name, name);
  assert.deepEqual(bible.meta.aliases, [name]);
  assert.equal(bible.body, `# ${name}\n`);
});

test('O-06: invalid structured data or conflicting renamed keys refuse before any write', async () => {
  for (const invalid of ['{"Mara":', '{"Mara":1,"Neri":2}']) {
    const { root, host } = fixture();
    await host.commands.get('PNW-init')!.handler('', { cwd: root });
    save(root, 'bible/characters/mara.md', '# Mara\n');
    save(root, 'continuity/facts.json', invalid);
    await assert.rejects(host.call('novel_rename_entity', { oldName: 'Mara', newName: 'Neri', preview: false }));
    assert.equal(read(root, 'bible/characters/mara.md'), '# Mara\n');
    assert.equal(read(root, 'continuity/facts.json'), invalid);
  }
});

test('M12: private packets and manifests are ineligible; reader/manuscript outputs remain eligible', () => {
  for (const file of ['evaluation/private/key.json', 'custom-packets/private/study.json', 'custom-packets/private/frozen-trials.jsonl', 'Private/trial-inventory.json', 'evaluation\\PRIVATE\\unpaired-trials.json', 'exports/manuscript-accepted-audit.manifest.json', 'custom/manuscript-working-audit.manifest.json', '.pi/github.json', '.pnw/HEAD']) assert.equal(shareablePath(file), false, file);
  for (const file of ['evaluation/readers/pair.md', 'evaluation/readers/instructions.json', 'exports/manuscript-working-audit.md', 'exports/manuscript-accepted-audit.docx']) assert.equal(shareablePath(file), true, file);
});

test('O-05: automatic context refuses external voice, bible and summary links before reading', async () => {
  for (const kind of ['voice-path', 'bible-file', 'bible-root', 'summary-file', 'summary-root']) {
    const { root: parent, host } = fixture();
    const root = path.join(parent, 'novel'), outside = path.join(parent, 'outside');
    fs.mkdirSync(root);
    fs.mkdirSync(outside);
    save(outside, 'marker.md', '# EXTERNAL-CONTEXT-MARKER\n');
    await host.commands.get('PNW-init')!.handler('--quick', { cwd: root });
    if (kind === 'voice-path') {
      const config = JSON.parse(read(root, 'project.json'));
      config.settings.voiceProfilePath = path.join(outside, 'marker.md');
      save(root, 'project.json', JSON.stringify(config));
    } else if (kind === 'bible-root') {
      fs.symlinkSync(outside, path.join(root, 'bible'), 'junction');
    } else if (kind === 'summary-root') {
      fs.symlinkSync(outside, path.join(root, 'summaries'), 'junction');
    } else {
      const target = kind === 'bible-file' ? 'bible/characters/marker.md' : 'summaries/scenes/01-01.md';
      fs.mkdirSync(path.dirname(path.join(root, target)), { recursive: true });
      fs.symlinkSync(path.join(outside, 'marker.md'), path.join(root, target), 'file');
    }
    await host.commands.get('PNW-load')!.handler('', { cwd: root });
    writing(host.api);
    const hook = host.hooks.get('context')![0];
    let reads = 0;
    const original = fs.readFileSync;
    fs.readFileSync = ((file: any, ...args: any[]) => {
      if (typeof file === 'string' && fs.existsSync(file) && fs.realpathSync(file).startsWith(outside + path.sep)) reads++;
      return (original as any)(file, ...args);
    }) as typeof fs.readFileSync;
    try {
      await assert.rejects(hook({ messages: [] }, {}), /escapes|outside/i, kind);
      assert.equal(reads, 0, kind);
    } finally { fs.readFileSync = original; }
  }
});

test('O-05: intended in-project voice and bible context still load', async () => {
  const { root, host } = fixture();
  await host.commands.get('PNW-init')!.handler('', { cwd: root });
  save(root, 'bible/voice-profile.md', '# INTERNAL-VOICE-MARKER\n');
  save(root, 'bible/characters/character.md', '# INTERNAL-BIBLE-MARKER\n');
  writing(host.api);
  const result = await host.hooks.get('context')![0]({ messages: [] }, {});
  assert.match(result.messages[0].content, /INTERNAL-VOICE-MARKER/);
  assert.match(result.messages[0].content, /INTERNAL-BIBLE-MARKER/);
});
