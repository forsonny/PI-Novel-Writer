import fs from 'node:fs';
import path from 'node:path';
import { Type, type Static } from 'typebox';
import { projectPath } from '../utils/safety.ts';
import { writeExact } from './io.ts';
import { LiteraryStore } from './store.ts';
import { checked, Strict, Id, Hash, Text, Nonempty, Short, Timestamp } from './schema.ts';
import { hashText, newId, objectHash, requireId } from './version.ts';

export const ManagedProjectSchema = Strict({
  schemaVersion: Type.Literal(1), projectId: Id, enabled: Type.Boolean(),
  governance: Type.Enum(['collaborative', 'delegated', 'research'] as const),
  compute: Type.Enum(['minimal', 'standard', 'experimental'] as const),
  createdAt: Timestamp, importedState: Type.Literal('unverified'),
  contentPolicy: Text, sourcePolicy: Text, disclosurePolicy: Text,
});
export type ManagedProject = Static<typeof ManagedProjectSchema>;
export function managedProject(root: string): ManagedProject | null {
  const file = projectPath(root, '.pnw/project.json');
  if (!fs.existsSync(file)) return null;
  return checked(ManagedProjectSchema, JSON.parse(fs.readFileSync(file, 'utf8')), 'managed project');
}
export interface GuidanceMerge { text: string; conflicts: string[] }
/** Three-way merge at Markdown section granularity. Conflicts retain author text.
 * No guessed baseline or silent resolution of author edits is permitted.
 */
export function mergeGuidance(base: string | null, current: string, incoming: string): GuidanceMerge {
  if (current === incoming || incoming === base) return { text: current, conflicts: [] };
  if (current === base || !current) return { text: incoming, conflicts: [] };
  if (base === null) return { text: current, conflicts: ['Baseline unknown: current guidance retained; inspect incoming guidance.'] };
  const sections = (text: string) => {
    const parts = text.split(/(?=^#{1,6} )/m), seen = new Map<string, number>();
    return new Map(parts.map(part => {
      const heading = part.match(/^#{1,6} .*/)?.[0] || '<preamble>';
      const count = seen.get(heading) || 0; seen.set(heading, count + 1);
      return [`${heading} [${count}]`, part] as const;
    }));
  };
  const b = sections(base), c = sections(current), n = sections(incoming), conflicts: string[] = [];
  const order = [...c.keys(), ...n.keys()].filter((key, i, all) => all.indexOf(key) === i);
  // Boundary blank lines and platform newlines do not constitute an authored
  // section edit. Compare them canonically, but preserve the selected raw text.
  const equalSection = (a: string | undefined, b: string | undefined) => a === b || (a !== undefined && b !== undefined && a.replaceAll('\r\n', '\n').replace(/\n+$/, '\n') === b.replaceAll('\r\n', '\n').replace(/\n+$/, '\n'));
  const merged: string[] = [];
  for (const key of order) {
    const old = b.get(key), ours = c.get(key), theirs = n.get(key);
    if (equalSection(ours, theirs) || equalSection(theirs, old)) { if (ours !== undefined) merged.push(ours); }
    else if (equalSection(ours, old)) { if (theirs !== undefined) merged.push(theirs); }
    else { conflicts.push(key); if (ours !== undefined) merged.push(ours); }
  }
  return { text: merged.join(''), conflicts };
}
const FileText = Type.String({ maxLength: 500000 });
const FileChange = Strict({ path: Nonempty, before: Type.Union([FileText, Type.Null()]), beforeHash: Type.Union([Hash, Type.Null()]), after: FileText, reason: Short });
const PlanSchema = Strict({ schemaVersion: Type.Literal(1), id: Id, root: Nonempty, projectId: Id, files: Type.Array(FileChange, { maxItems: 2000 }), conflicts: Type.Array(Text), digest: Hash });
export type MigrationPlan = Static<typeof PlanSchema>;
export interface MigrationOptions {
  sceneFiles: string[]; oldGuidance?: string; newGuidance?: string;
  governance?: ManagedProject['governance']; compute?: ManagedProject['compute']; enable?: boolean;
}
function readOptional(root: string, relative: string): string | null {
  const file = projectPath(root, relative);
  if (!fs.existsSync(file)) return null;
  if (!fs.statSync(file).isFile() || fs.statSync(file).size > 20000) throw new Error(`Migration requires a smaller plain-text file: ${relative}`);
  return fs.readFileSync(file, 'utf8');
}
/** Read-only preview. Byte-exact source copies are retained in a private journal.
 * Only identity frontmatter and selected guidance/settings are changed.
 */
export function previewMigration(root: string, options: MigrationOptions): MigrationPlan {
  const canonicalRoot = fs.realpathSync(root), existing = managedProject(root);
  const storedId = LiteraryStore.exists(root) ? LiteraryStore.open(root).projectId : null;
  if (storedId && existing && storedId !== existing.projectId) throw new Error('Managed settings and store belong to different projects');
  const projectId = existing?.projectId || storedId || newId(), files: MigrationPlan['files'] = [], conflicts: string[] = [];
  const propose = (relative: string, after: string, reason: string) => {
    const before = readOptional(root, relative); if (before !== after) files.push({ path: relative, before, beforeHash: before === null ? null : hashText(before), after, reason });
  };
  const settings: ManagedProject = existing || { schemaVersion: 1, projectId, enabled: options.enable ?? false, governance: options.governance ?? 'collaborative', compute: options.compute ?? 'minimal', createdAt: new Date().toISOString(), importedState: 'unverified', contentPolicy: '', sourcePolicy: 'Imported material is unverified; transmission permission is explicit per source.', disclosurePolicy: 'Retain model and human contribution records; no human evaluation is implied.' };
  if (existing) {
    if (options.enable !== undefined) settings.enabled = options.enable;
    if (options.governance) settings.governance = options.governance;
    if (options.compute) settings.compute = options.compute;
  }
  checked(ManagedProjectSchema, settings);
  propose('.pnw/project.json', JSON.stringify(settings, null, 2) + '\n', 'Versioned managed-project settings');
  const ids = new Set<string>(), seen = new Set<string>();
  for (const requested of options.sceneFiles) {
    const file = projectPath(root, requested), relative = path.relative(canonicalRoot, file).replaceAll('\\', '/');
    if (!relative.startsWith('manuscript/') || !relative.endsWith('.md')) throw new Error('Migration accepts only resolved manuscript Markdown paths');
    if (seen.has(file)) throw new Error('Duplicate scene path'); seen.add(file);
    // Migration is intentionally not a manuscript parser or canonical-state extractor.
    const before = fs.readFileSync(file, 'utf8');
    const fm = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(before);
    if (!fm) throw new Error(`Scene has no valid frontmatter: ${relative}`);
    const idLine = /^id:\s*["']?([0-9a-f-]+)["']?\s*$/m.exec(fm[1]);
    if (/^id:/m.test(fm[1]) && !idLine) throw new Error('Invalid existing scene identity');
    const id = idLine ? requireId(idLine[1]) : newId();
    if (ids.has(id)) throw new Error('Duplicate scene identity'); ids.add(id);
    if (!idLine) {
      const newline = before.startsWith('---\r\n') ? '\r\n' : '\n';
      const after = before.replace(/^---\r?\n/, `---${newline}id: "${id}"${newline}`);
      // FileChange text fields are bounded below by an explicit 2 MiB plan cap.
      files.push({ path: relative, before, beforeHash: hashText(before), after, reason: 'Stable identity; prose and unknown metadata preserved byte-for-byte' });
    }
  }
  if (options.newGuidance !== undefined) {
    const current = readOptional(root, '.pi/APPEND_SYSTEM.md') || '';
    const merged = mergeGuidance(options.oldGuidance ?? null, current, options.newGuidance);
    conflicts.push(...merged.conflicts);
    propose('.pi/APPEND_SYSTEM.md', merged.text, 'Three-way guidance merge; author conflicts retained');
    if (merged.conflicts.length) propose('.pi/APPEND_SYSTEM.incoming.md', options.newGuidance, 'Incoming guidance for manual conflict resolution');
  }
  const value = { schemaVersion: 1 as const, id: newId(), root: canonicalRoot, projectId, files, conflicts };
  return validatePlan({ ...value, digest: objectHash(value) });
}
function validatePlan(value: unknown): MigrationPlan {
  const plan = checked(PlanSchema, value, 'migration plan');
  const { digest, ...rest } = plan;
  if (objectHash(rest) !== digest || new Set(plan.files.map(f => f.path)).size !== plan.files.length) throw new Error('Migration plan was modified');
  for (const f of plan.files) {
    if (!(f.path.startsWith('manuscript/') && f.path.endsWith('.md')) && !['.pnw/project.json', '.pi/APPEND_SYSTEM.md', '.pi/APPEND_SYSTEM.incoming.md'].includes(f.path)) throw new Error('Migration target is not allowed');
    if ((f.before === null ? null : hashText(f.before)) !== f.beforeHash) throw new Error('Invalid migration source hash');
  }
  return plan;
}
const JournalSchema = Strict({ plan: PlanSchema, status: Type.Enum(['prepared', 'applying', 'complete', 'rolled_back'] as const), applied: Type.Array(Nonempty, { maxItems: 2000 }) });
type Journal = Static<typeof JournalSchema>;
function withLock<T>(root: string, fn: () => T): T {
  fs.mkdirSync(projectPath(root, '.pnw'), { recursive: true, mode: 0o700 });
  const lock = projectPath(root, '.pnw/migration.lock'); let fd: number;
  try { fd = fs.openSync(lock, 'wx', 0o600); } catch { throw new Error('Migration locked; inspect the interrupted process before retrying'); }
  try { return fn(); } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}
/** Apply a preview only after its digest has been explicitly selected by the caller.
 * A journal enables explicit recovery after interruption. Does not canonize old ledgers.
 */
export function applyMigration(root: string, raw: MigrationPlan, approvedDigest: string, afterWrite?: (index: number) => void): { changed: number; conflicts: string[]; replayed: boolean } {
  const plan = validatePlan(raw);
  if (fs.realpathSync(root) !== plan.root || approvedDigest !== plan.digest) throw new Error('Migration approval or project mismatch');
  if (!plan.files.length) return { changed: 0, conflicts: plan.conflicts, replayed: false };
  return withLock(root, () => {
    const dir = projectPath(root, `.pnw/migrations/${plan.id}`), journalPath = path.join(dir, 'journal.json');
    if (fs.existsSync(journalPath)) {
      const saved = checked(JournalSchema, JSON.parse(fs.readFileSync(journalPath, 'utf8')), 'migration journal');
      validatePlan(saved.plan);
      if (saved.plan.digest !== plan.digest) throw new Error('Migration ID reused');
      if (saved.status === 'complete') return { changed: plan.files.length, conflicts: plan.conflicts, replayed: true };
      throw new Error('Interrupted migration requires explicit recovery');
    }
    for (const f of plan.files) {
      const file = projectPath(root, f.path), now = fs.existsSync(file) ? hashText(fs.readFileSync(file, 'utf8')) : null;
      if (now !== f.beforeHash) throw new Error(`Migration preview is stale: ${f.path}`);
    }
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const journal: Journal = { plan, status: 'prepared', applied: [] };
    writeExact(journalPath, JSON.stringify(journal)); fs.chmodSync(journalPath, 0o600);
    journal.status = 'applying'; writeExact(journalPath, JSON.stringify(journal));
    try {
      for (const [i, f] of plan.files.entries()) {
        const file = projectPath(root, f.path), now = fs.existsSync(file) ? hashText(fs.readFileSync(file, 'utf8')) : null;
        if (now !== f.beforeHash) throw new Error(`Migration source changed during apply: ${f.path}`);
        // Record intent before the write so crash recovery covers the write/journal gap.
        journal.applied.push(f.path); writeExact(journalPath, JSON.stringify(journal));
        writeExact(file, f.after); afterWrite?.(i);
      }
      journal.status = 'complete'; writeExact(journalPath, JSON.stringify(journal));
    } catch (error) { rollback(root, journal, journalPath); throw error; }
    return { changed: plan.files.length, conflicts: plan.conflicts, replayed: false };
  });
}
function rollback(root: string, journal: Journal, file: string): void {
  validatePlan(journal.plan);
  for (const relative of [...journal.applied].reverse()) {
    const f = journal.plan.files.find(f => f.path === relative); if (!f) throw new Error('Corrupt migration journal');
    const target = projectPath(root, relative), now = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
    if (now === f.before) continue;
    if (now !== f.after) throw new Error(`Recovery conflict: ${relative} changed outside migration; backup retained`);
    if (f.before === null) fs.unlinkSync(target); else writeExact(target, f.before);
  }
  journal.status = 'rolled_back'; writeExact(file, JSON.stringify(journal));
}
export function recoverMigration(root: string, id: string): void {
  requireId(id);
  withLock(root, () => {
    const file = projectPath(root, `.pnw/migrations/${id}/journal.json`);
    const journal = checked(JournalSchema, JSON.parse(fs.readFileSync(file, 'utf8')), 'migration journal');
    if (journal.plan.root !== fs.realpathSync(root)) throw new Error('Migration belongs to another project');
    if (journal.status === 'complete') throw new Error('Completed migrations are not automatically undone');
    rollback(root, journal, file);
  });
}
