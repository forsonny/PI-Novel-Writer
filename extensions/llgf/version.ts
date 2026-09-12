import { createHash, randomUUID } from 'node:crypto';

export const UUID_PATTERN = '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
export const HASH_PATTERN = '^[0-9a-f]{64}$';
export const newId = () => randomUUID();
export const hashText = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
export const proseHash = (text: string) => hashText(text.replace(/\r\n/g, '\n'));
export function requireHash(value: string): string {
  if (!new RegExp(HASH_PATTERN).test(value)) throw new Error('Invalid SHA-256 hash');
  return value;
}
export function requireId(value: string): string {
  if (!new RegExp(UUID_PATTERN).test(value)) throw new Error('Invalid stable identifier');
  return value;
}
export function expectVersion(text: string, expected?: string): void {
  if (expected !== undefined && proseHash(text) !== requireHash(expected)) throw new Error('Source version changed. Read the current scene before editing.');
}

/** Stable JSON, with unsupported values rejected instead of silently omitted. */
export function canonicalJson(value: unknown): string {
  const ancestors = new Set<object>();
  function encode(v: unknown): string {
    if (v === null || typeof v === 'string' || typeof v === 'boolean') return JSON.stringify(v);
    if (typeof v === 'number' && Number.isFinite(v)) return JSON.stringify(v);
    if (typeof v !== 'object' || !v) throw new Error('Not a JSON value');
    if (ancestors.has(v)) throw new Error('Cyclic JSON value');
    const proto = Object.getPrototypeOf(v);
    if (!Array.isArray(v) && proto !== Object.prototype && proto !== null) throw new Error('Not a plain JSON object');
    ancestors.add(v);
    try {
      if (Array.isArray(v)) {
        if (Object.keys(v).length !== v.length) throw new Error('Sparse or decorated JSON array');
        return '[' + v.map(encode).join(',') + ']';
      }
      return '{' + Object.keys(v).sort().map(key => {
        if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Reserved JSON key');
        return JSON.stringify(key) + ':' + encode((v as Record<string, unknown>)[key]);
      }).join(',') + '}';
    } finally { ancestors.delete(v); }
  }
  return encode(value);
}
export const objectHash = (value: unknown) => hashText(canonicalJson(value));
