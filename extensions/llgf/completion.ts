import fs from 'node:fs';
import { orderedScenes, parseFrontmatter, readProjectSnapshot, countWords, sceneKey, type NovelProject } from '../novel-core.ts';
import { acceptedScenes } from './manuscript.ts';
import { managedProject } from './migration.ts';
import { LiteraryStore } from './store.ts';
import { PlanSchema } from './planning.ts';
import { AuditReviewSchema, auditCurrent, type AuditInput, type AuditScope } from './audits.ts';
import { checked } from './schema.ts';
import { proseHash, objectHash } from './version.ts';

export interface CompletionPlan { plan: { chapter: number; scene: number }[]; minWords: number; maxWords: number }
/** Completion is coverage of current evidence, not a literary-quality score.
 * Source status labels cannot substitute for a managed acceptance or audit. */
export function managedCompletionIssues(project: NovelProject, run: CompletionPlan, reviewed: boolean): string[] {
  project = readProjectSnapshot(project.rootPath);
  const issues: string[] = [], settings = managedProject(project.rootPath);
  if (!settings?.enabled) throw new Error('Managed completion needs an enabled project');
  const store = LiteraryStore.open(project.rootPath), at = store.head();
  const accepted = acceptedScenes(store, at), working = orderedScenes(project);
  const expected = new Set(run.plan.map(s => sceneKey(s.chapter, s.scene)));
  if (!expected.size) issues.push('No scene plan recorded.');
  const expectedIds = new Set<string>(); let words = 0;
  for (const key of expected) {
    const index = working.findIndex(s => sceneKey(s.chapter, s.scene) === key), scene = working[index];
    if (!scene?.id) { issues.push(`${key}: planned scene missing or unmigrated`); continue; }
    expectedIds.add(scene.id);
    const saved = accepted.find(s => s.prose.address.id === scene.id);
    if (!saved) { issues.push(`${key}: prose has not passed managed acceptance`); continue; }
    const body = parseFrontmatter(fs.readFileSync(scene.filePath, 'utf8')).body;
    if (proseHash(body) !== saved.prose.textHash) issues.push(`${key}: working prose differs from the accepted version`);
    const address = saved.prose.address;
    if (address.chapter !== scene.chapter || address.scene !== scene.scene || address.order !== (scene.order ?? scene.scene) || address.narrativeIndex !== index) issues.push(`${key}: accepted reading order needs reassessment`);
    words += countWords(saved.prose.body);
    if (!saved.prose.body.trim()) issues.push(`${key}: accepted prose is empty`);
    if (saved.stale) issues.push(`${key}: managed review dependencies are stale`);
    const summaryKey = `summary:${scene.id}`, hash = at.snapshot.versions[summaryKey];
    if (!hash || store.stale([{ key: summaryKey, hash }], at).length) issues.push(`${key}: accepted summary is missing or stale`);
  }
  for (const s of working) if (!expected.has(sceneKey(s.chapter, s.scene))) issues.push(`${s.chapter}.${s.scene}: scene is absent from the recorded plan`);
  for (const s of accepted) if (!expectedIds.has(s.prose.address.id)) issues.push(`${s.prose.address.id}: accepted scene is outside the current plan`);
  if (words < run.minWords || words > run.maxWords) issues.push(`Accepted manuscript has ${words} words; the recorded range is ${run.minWords}-${run.maxWords}.`);
  if (!reviewed) return issues;
  const scopes: AuditScope[] = [...new Set(working.map(s => s.chapter))].map(chapter => ({ level: 'chapter', chapter }));
  for (const [key] of Object.entries(at.snapshot.versions)) if (key.startsWith('plan:')) {
    const p = checked(PlanSchema, store.get(key, at)!.payload);
    if (p.level === 'arc') scopes.push({ level: 'arc', planId: p.id });
  }
  scopes.push({ level: 'manuscript' });
  const audits = Object.keys(at.snapshot.versions).filter(k => k.startsWith('audit:')).map(k => store.get(k, at)!);
  for (const scope of scopes) {
    const matching = audits.filter(a => {
      const record = a.payload as { input?: AuditInput; coverageComplete?: boolean; review?: unknown };
      try {
        if (!record.input || objectHash(record.input.scope) !== objectHash(scope) || !record.coverageComplete || !auditCurrent(project, { input: record.input })) return false;
        const review = checked(AuditReviewSchema, record.review);
        return !review.checks.some(c => c.blocking);
      } catch { return false; }
    });
    if (!matching.length) issues.push(`${scope.level}${scope.chapter ? ` ${scope.chapter}` : scope.planId ? ` ${scope.planId}` : ''}: current complete sequence audit is missing or blocking`);
  }
  // The writing extension cannot turn model reviews into a completed research
  // study. Reader responses are exported and evaluated separately.
  if (settings.governance === 'research') issues.push('Research profile: independent human evaluation and final author adjudication remain external to automatic completion. Export the assessed snapshot with its limitations.');
  return issues;
}
