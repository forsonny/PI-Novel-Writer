import fs from 'node:fs';
import { Type, type Static } from 'typebox';
import { countWords, orderedScenes, parseFrontmatter, type NovelProject } from '../novel-core.ts';
import { projectPath } from '../utils/safety.ts';
import { LiteraryStore, type SnapshotRef } from './store.ts';
import { Strict, Hash, checked, type SourceRef } from './schema.ts';
import { SceneAddressSchema } from './pipeline.ts';
import { ConditionSchema } from './narrative.ts';
import { proseHash, newId, canonicalJson } from './version.ts';

export const AcceptedProseSchema = Strict({ address: SceneAddressSchema, body: Type.String({ maxLength: 500000 }),
  textHash: Hash, condition: ConditionSchema, transmissionApproved: Type.Boolean() });
export type AcceptedProse = Static<typeof AcceptedProseSchema>;
export interface AcceptedScene { source: SourceRef; prose: AcceptedProse; acceptance: SourceRef | null; stale: boolean }

/** Capture HEAD once. Every scene, dependency and audit is read from that same
 * immutable snapshot. Staleness never deletes preserved prose. */
export function acceptedScenes(store: LiteraryStore, at: SnapshotRef = store.head()): AcceptedScene[] {
  const scenes: AcceptedScene[] = [];
  for (const [key, hash] of Object.entries(at.snapshot.versions)) {
    if (!key.startsWith('prose:')) continue;
    const artifact = store.get(key, at)!;
    const prose = checked(AcceptedProseSchema, artifact.payload, 'accepted scene');
    if (artifact.id !== prose.address.id || proseHash(prose.body) !== prose.textHash || prose.condition.narrativeIndex !== prose.address.narrativeIndex) throw new Error('Accepted prose identity or hash differs');
    const reviewKey = `acceptance:${artifact.id}`;
    const acceptance = at.snapshot.versions[reviewKey] ? { key: reviewKey, hash: at.snapshot.versions[reviewKey] } : null;
    scenes.push({ source: { key, hash }, prose, acceptance,
      stale: !acceptance || store.stale([{ key, hash }, acceptance], at).length > 0 });
  }
  scenes.sort((a, b) => a.prose.address.narrativeIndex - b.prose.address.narrativeIndex);
  if (new Set(scenes.map(s => s.prose.address.narrativeIndex)).size !== scenes.length) throw new Error('Accepted reading positions conflict; reconcile the order before compiling');
  return scenes;
}

export function manuscriptCoverage(project: NovelProject) {
  const working = orderedScenes(project);
  const words = working.reduce((n, s) => n + countWords(parseFrontmatter(fs.readFileSync(projectPath(project.rootPath, s.filePath), 'utf8')).body), 0);
  if (!LiteraryStore.exists(project.rootPath)) return { managed: false, workingWords: words, acceptedWords: 0, acceptedScenes: 0, unaccepted: working.map(s => s.id ?? `${s.chapter}.${s.scene}`), stale: [] as string[], head: null as string | null };
  const store = LiteraryStore.open(project.rootPath), at = store.head(), accepted = acceptedScenes(store, at);
  const ids = new Set(accepted.map(s => s.prose.address.id));
  return { managed: true, workingWords: words, acceptedWords: accepted.reduce((n, s) => n + countWords(s.prose.body), 0), acceptedScenes: accepted.length,
    unaccepted: working.filter(s => !s.id || !ids.has(s.id)).map(s => s.id ?? `${s.chapter}.${s.scene}`),
    stale: accepted.filter(s => s.stale).map(s => s.prose.address.id), head: at.hash };
}

export interface ExportOptions { mode?: 'working' | 'accepted'; requireComplete?: boolean; snapshotHash?: string }
export interface ManuscriptExport { path: string; manifestPath: string; mode: 'working' | 'accepted'; head: string | null; warnings: string[] }
/** Export is a local operation, not publication or proof of literary approval.
 * A working draft and an accepted snapshot are deliberately different products. */
export function exportManuscript(project: NovelProject, options: ExportOptions = {}): ManuscriptExport {
  const mode = options.mode ?? 'working';
  if (!['working', 'accepted'].includes(mode)) throw new Error('Unknown manuscript export mode');
  if (options.snapshotHash && mode !== 'accepted') throw new Error('A snapshot is only valid for accepted export');
  let head: string | null = null;
  const warnings: string[] = [], working = orderedScenes(project);
  let scenes: { chapter: number; id: string | null; body: string; textHash: string }[], sourceRefs: SourceRef[] = [];
  if (mode === 'accepted') {
    const store = LiteraryStore.open(project.rootPath);
    const at = options.snapshotHash ? { hash: options.snapshotHash, snapshot: store.snapshot(options.snapshotHash) } : store.head();
    head = at.hash;
    const accepted = acceptedScenes(store, at), ids = new Set(accepted.map(s => s.prose.address.id));
    const missing = working.filter(s => !s.id || !ids.has(s.id));
    const stale = accepted.filter(s => s.stale);
    if (!accepted.length) throw new Error('No accepted scenes exist in this snapshot');
    if (options.requireComplete && (missing.length || stale.length)) throw new Error('Complete accepted export requires coverage and current assessments');
    if (missing.length) warnings.push(`${missing.length} working scenes are not accepted in this snapshot and are not exported.`);
    if (stale.length) warnings.push(`${stale.length} accepted scenes need reassessment. Their prose is retained, not certified current.`);
    warnings.push('Reading order is the captured accepted order, not later manual working-file moves.');
    scenes = accepted.map(s => ({ chapter: s.prose.address.chapter, id: s.prose.address.id, body: s.prose.body, textHash: s.prose.textHash }));
    sourceRefs = accepted.flatMap(s => s.acceptance ? [s.source, s.acceptance] : [s.source]);
  } else {
    if (options.requireComplete) throw new Error('Working export cannot certify accepted completion');
    scenes = working.map(s => { const body = parseFrontmatter(fs.readFileSync(projectPath(project.rootPath, s.filePath), 'utf8')).body;
      return { chapter: s.chapter, id: s.id ?? null, body, textHash: proseHash(body) }; });
    warnings.push('Working draft: includes current files regardless of managed acceptance.');
  }
  if (!scenes.length) throw new Error('No scenes to export');
  const now = new Date().toISOString(), label = mode === 'accepted' ? 'accepted_snapshot' : 'working_draft';
  const lines = ['---', `title: ${JSON.stringify(project.config.title)}`, `author: ${JSON.stringify(project.config.author || 'Unknown')}`,
    `date: ${JSON.stringify(now.slice(0, 10))}`, `pnw_export: ${label}`, ...(head ? [`pnw_snapshot: ${JSON.stringify(head)}`] : []), '---', ''];
  let previousChapter: number | null = null;
  for (const s of scenes) {
    if (s.chapter !== previousChapter) {
      if (['novel', 'novella'].includes(project.config.format)) lines.push(`# Chapter ${s.chapter}`, '');
      else if (previousChapter !== null) lines.push('* * *', '');
    } else lines.push('* * *', '');
    // Keep authored wording, including whitespace inside each scene.
    lines.push(s.body, ''); previousChapter = s.chapter;
  }
  const stem = `exports/manuscript-${mode}-${now.replace(/[:.]/g, '-')}-${newId().slice(0, 8)}`;
  const file = projectPath(project.rootPath, stem + '.md'), manifestPath = projectPath(project.rootPath, stem + '.manifest.json');
  fs.mkdirSync(projectPath(project.rootPath, 'exports'), { recursive: true });
  const text = lines.join('\n');
  const manifest = { schemaVersion: 1, mode, head, exportedAt: now, manuscriptHash: proseHash(text),
    sceneCount: scenes.length, words: scenes.reduce((n, s) => n + countWords(s.body), 0),
    scenes: scenes.map(({ body: _body, ...s }) => s), sources: sourceRefs, warnings,
    evaluation: 'Export does not establish literary merit or independent human evaluation.' };
  // Retain the intended-source manifest on failure. Only a successful return
  // claims a completed export; neither file is overwritten on repeated calls.
  fs.writeFileSync(manifestPath, canonicalJson(manifest), { flag: 'wx', mode: 0o600 });
  try { fs.writeFileSync(file, text, { flag: 'wx', mode: 0o600 }); }
  catch (error) { throw new Error(`Export incomplete: ${error instanceof Error ? error.message : String(error)}; manifest retained at ${manifestPath}`, { cause: error }); }
  return { path: file, manifestPath, mode, head, warnings };
}
