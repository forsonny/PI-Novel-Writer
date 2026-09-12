import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import core, { getProject } from '../extensions/novel-core.ts';
import bible from '../extensions/novel-bible.ts';
import write from '../extensions/novel-write.ts';
import edit from '../extensions/novel-edit.ts';
import exp from '../extensions/novel-export.ts';
import progress from '../extensions/novel-progress.ts';
import github from '../extensions/novel-github.ts';
import auto from '../extensions/novel-auto.ts';
import { fakePi, projectFixture } from './helpers.ts';

for (const format of ['novel', 'novella', 'short-story', 'flash-fiction'] as const) {
  test(`real extension registration and scene/summary round trip: ${format}`, async () => {
    const fixture = projectFixture(format); const host = fakePi();
    try {
      for (const extension of [core, bible, write, edit, exp, progress, github, auto]) extension(host.api);
      await host.event('session_start', {}, fixture.ctx);
      assert.ok(getProject());
      await host.call('novel_scene_create', { chapter: 1, pov: 'Ilyen' }, fixture.ctx);
      await host.call('novel_scene_write', { chapter: 1, scene: 1, content: 'Snow collected on the empty chair.' }, fixture.ctx);
      await host.call('summary_generate', { chapter: 1, scene: 1, summaryText: 'Snow is on the chair.' }, fixture.ctx);
      const result = await host.call('summary_read', { chapter: 1, scene: 1 }, fixture.ctx);
      assert.match(result.content[0].text, /Freshness: current/);
      await host.call('novel_scene_write', { chapter: 1, scene: 1, content: 'The chair was gone.' }, fixture.ctx);
      const stale = await host.call('summary_read', { chapter: 1, scene: 1 }, fixture.ctx);
      assert.match(stale.content[0].text, /Freshness: stale/);
      assert.ok(fs.existsSync(getProject()!.scenes.get('01-01')!.filePath));
      assert.equal(host.messages.some(m => JSON.stringify(m).includes('Continue the authorized')), false);
    } finally { await host.event('session_shutdown', {}, fixture.ctx); fixture.dispose(); }
  });
}
