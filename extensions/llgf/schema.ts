import { Type, type Static, type TSchema, type TProperties } from 'typebox';
import { Check } from 'typebox/value';
import { canonicalJson, proseHash, UUID_PATTERN, HASH_PATTERN } from './version.ts';

export const Id = Type.String({ pattern: UUID_PATTERN });
export const Hash = Type.String({ pattern: HASH_PATTERN });
export const Text = Type.String({ maxLength: 20000 });
export const Nonempty = Type.String({ minLength: 1, maxLength: 20000 });
export const Short = Type.String({ minLength: 1, maxLength: 160 });
export const Kind = Type.String({ pattern: '^[a-z][a-z0-9_-]{0,31}$' });
export const Key = Type.String({ pattern: '^[a-z][a-z0-9_-]{0,31}:' + UUID_PATTERN.slice(1) });
export const Timestamp = Type.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$' });
export const Strict = <T extends TProperties>(properties: T) => Type.Object(properties, { additionalProperties: false });
export const strings = () => Type.Array(Text, { maxItems: 256 });
export const Source = Strict({ key: Key, hash: Hash });
export type SourceRef = Static<typeof Source>;
export const Sources = Type.Array(Source, { maxItems: 2000 });
export const Span = Strict({ sceneId: Id, textHash: Hash, start: Type.Integer({ minimum: 0 }), end: Type.Integer({ minimum: 0 }), quote: Nonempty, offsetUnit: Type.Literal('utf16') });
export type EvidenceSpan = Static<typeof Span>;

/** Validates boundary data, including JSON size, before it reaches typed services. */
export function checked<T extends TSchema>(schema: T, value: unknown, label = 'record'): Static<T> {
  if (Buffer.byteLength(canonicalJson(value), 'utf8') > 2 * 1024 * 1024) throw new Error(`${label} exceeds the 2 MiB record limit`);
  if (!Check(schema, value)) throw new Error(`Invalid ${label}; data does not match its versioned schema`);
  return value as Static<T>;
}
export function verifySpan(span: EvidenceSpan, text: string, textHash: string): void {
  checked(Span, span, 'evidence span');
  if (proseHash(text) !== textHash || span.textHash !== textHash || span.end > text.length || span.end <= span.start || text.slice(span.start, span.end) !== span.quote) throw new Error('Evidence span does not match its source version');
}
