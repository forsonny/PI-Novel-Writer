import fs from 'node:fs';
import { requireId } from '../llgf/version.ts';
import path from 'node:path';

function inside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

/** Check both lexical containment and every existing ancestor, including symlinks.
 * Not an OS sandbox against a process concurrently replacing directory entries.
 */
export function projectPath(rootPath: string, requested: string): string {
  if (typeof requested !== 'string' || !requested || requested.includes('\0')) throw new Error('Invalid project path');
  const root = fs.realpathSync(rootPath);
  const candidate = path.resolve(rootPath, requested);
  const lexicalRoot = path.resolve(rootPath);
  if (!inside(lexicalRoot, candidate) && !inside(root, candidate)) throw new Error('Path escapes the project root');
  const relative = path.relative(inside(lexicalRoot, candidate) ? lexicalRoot : root, candidate);
  let current = root;
  for (const part of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try {
      fs.lstatSync(current); // Also detects dangling symlinks.
      if (!inside(root, fs.realpathSync(current))) throw new Error('Symlink escapes the project root');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      // A dangling symlink must not be interpreted as an ordinary missing path.
      try { if (fs.lstatSync(current).isSymbolicLink()) throw new Error('Dangling project symlink'); }
      catch (nested) { if ((nested as NodeJS.ErrnoException).code !== 'ENOENT') throw nested; }
    }
  }
  return path.join(root, relative);
}

export function positiveInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) throw new Error(`${label} must be a positive safe integer`);
  return value as number;
}

/** Only known scene fields enter executable state. Unknown author fields remain on disk. */
export function sceneMetadata(meta: Record<string, unknown>, derived: { chapter: number; scene: number; filePath: string }) {
  const text = (key: string) => {
    if (meta[key] === undefined) return '';
    if (typeof meta[key] !== 'string') throw new Error(`Scene ${key} must be text`);
    return meta[key] as string;
  };
  const list = (key: string): string[] => {
    if (meta[key] === undefined) return [];
    if (!Array.isArray(meta[key]) || !(meta[key] as unknown[]).every(v => typeof v === 'string')) throw new Error(`Scene ${key} must be a text array`);
    return [...meta[key] as string[]];
  };
  const status = meta.status ?? 'outline';
  if (!['outline', 'draft', 'revised', 'polished', 'final'].includes(status as string)) throw new Error('Invalid scene status');
  if (meta.order !== undefined && (typeof meta.order !== 'number' || !Number.isFinite(meta.order))) throw new Error('Invalid scene order');
  return {
    ...(meta.id === undefined ? {} : { id: requireId(text('id')) }),
    title: text('title'), pov: text('pov'), location: text('location'), timeline: text('timeline'), summary: text('summary'),
    characters_present: list('characters_present'), plot_threads: list('plot_threads'), tags: list('tags'),
    status: status as 'outline' | 'draft' | 'revised' | 'polished' | 'final', order: meta.order as number | undefined,
    chapter: positiveInteger(derived.chapter, 'Chapter'), scene: positiveInteger(derived.scene, 'Scene'), filePath: derived.filePath,
  };
}
