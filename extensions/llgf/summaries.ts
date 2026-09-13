import fs from 'node:fs';
import { Type, type Static } from 'typebox';
import { readText } from '../utils/platform.ts';
import { projectPath } from '../utils/safety.ts';
import { checked, Strict, Hash, Nonempty, Sources, Span, Text, Id } from './schema.ts';
import { hashText } from './version.ts';

export const FileDependencySchema = Strict({ path: Nonempty, hash: Hash });
export const FileDependenciesSchema = Type.Array(FileDependencySchema, { maxItems: 256 });
export type FileDependency = Static<typeof FileDependencySchema>;
/** Dependency hashes use the same LF-normalized text representation as legacy reads. */
export function validateFileDependencies(root: string, value: unknown): FileDependency[] {
  const dependencies = checked(FileDependenciesSchema, value, 'summary dependencies');
  const seen = new Set<string>();
  for (const item of dependencies) {
    if (!/^(?:manuscript|bible|outline|continuity|timeline|summaries)\/.+\.(?:md|json)$/.test(item.path) && item.path !== 'project.json') throw new Error('Summary dependency is not an allowed project document');
    const resolved = projectPath(root, item.path);
    if (seen.has(resolved)) throw new Error('Duplicate summary dependency');
    seen.add(resolved);
  }
  return dependencies;
}
export function staleFileDependencies(root: string, value: unknown): string[] {
  return validateFileDependencies(root, value).filter(item => {
    const file = projectPath(root, item.path);
    return !fs.existsSync(file) || !fs.statSync(file).isFile() || hashText(readText(file)) !== item.hash;
  }).map(item => item.path);
}
export function summaryCurrent(root: string, metadata: Record<string, unknown>, source: string): boolean {
  if (!source || metadata.hash !== hashText(source)) return false;
  try { return staleFileDependencies(root, metadata.dependencies ?? []).length === 0; }
  catch { return false; }
}
/** Canonical-engine summaries are derived views, never an automatic fact verdict. */
export const SummaryRecordSchema = Strict({
  schemaVersion: Type.Literal(1), id: Id, sceneIds: Type.Array(Id, { minItems: 1, maxItems: 2000 }),
  sourceHash: Hash, dependencies: Sources, evidence: Type.Array(Span, { maxItems: 256 }),
  text: Nonempty, review: Type.Enum(['unreviewed', 'model_reviewed', 'human_reviewed'] as const),
  reviewEvidence: Text, methodVersion: Nonempty,
});
