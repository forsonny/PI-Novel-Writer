import { Type, type Static } from 'typebox';
import { Strict, Id, Hash, Text, Nonempty, Short, Span, Sources, strings, checked } from './schema.ts';
import { ConfidenceSchema, checkEvidence, type TextResolver } from './narrative.ts';
import { pattern, validateSeverity, TAXONOMY_VERSION } from './taxonomy.ts';
import { proseHash } from './version.ts';

export const METHOD_VERSION = 'surface-observations-v1';
export const MethodSchema = Type.Enum(['direct', 'proxy', 'model_assisted', 'human'] as const);
export const FindingSchema = Strict({
  id: Id, patternId: Short, rubric: Type.Enum(['chapter5-0-4', 'appendixB-0-3'] as const),
  severity: Type.Union([Type.Integer({ minimum: 0, maximum: 4 }), Type.Null()]),
  status: Type.Enum(['unassessed', 'absent', 'licensed', 'uncertain', 'suspected', 'confirmed'] as const),
  scope: Type.Enum(['sentence', 'paragraph', 'scene', 'chapter', 'arc', 'manuscript'] as const),
  method: MethodSchema, methodVersion: Short, confidence: ConfidenceSchema,
  evidence: Type.Array(Span, { maxItems: 100 }), displacedFunction: Text, counterevidence: Text,
  cause: Strict({ level: Type.Enum(['state', 'plan', 'context', 'generation', 'revision', 'long_range', 'unknown'] as const),
    hypothesis: Text, basis: Sources }),
  pairedRisk: Text, recommendation: Type.Enum(['no_action', 'inspect', 'repair_state', 'repair_context', 'repair_plan', 'revise', 'branch', 'human_review'] as const),
  intervention: Text, successTest: Text, protectedIds: Type.Array(Id, { maxItems: 100 }),
});
export type Finding = Static<typeof FindingSchema>;
export const DiagnosticReportSchema = Strict({
  schemaVersion: Type.Literal(1), sceneId: Id, textHash: Hash, taxonomyVersion: Type.Literal(TAXONOMY_VERSION),
  assessedPatternIds: Type.Array(Short, { maxItems: 56 }), findings: Type.Array(FindingSchema, { maxItems: 200 }),
  limitations: strings(),
});
export type DiagnosticReport = Static<typeof DiagnosticReportSchema>;
/** Reports are interpretations of a specific source, not proof of provenance.
 * Actor is supplied by the host, never trusted from a model response. */
export function validateDiagnostics(value: unknown, body: string, sceneId: string, resolve: TextResolver,
  actor: 'model' | 'human' = 'model'): DiagnosticReport {
  const report = checked(DiagnosticReportSchema, value, 'diagnostic report');
  if (report.sceneId !== sceneId || report.textHash !== proseHash(body)) throw new Error('Diagnostic source is stale or belongs to another scene');
  if (new Set(report.assessedPatternIds).size !== report.assessedPatternIds.length || new Set(report.findings.map(f => f.id)).size !== report.findings.length) throw new Error('Duplicate diagnostic identity');
  report.assessedPatternIds.forEach(pattern);
  for (const f of report.findings) {
    pattern(f.patternId); validateSeverity(f.rubric, f.severity);
    if (!report.assessedPatternIds.includes(f.patternId)) throw new Error('Finding is outside recorded assessment coverage');
    if (f.method === 'human' && actor !== 'human') throw new Error('Model output cannot claim human evaluation');
    if (['licensed', 'uncertain', 'unassessed'].includes(f.status) && f.severity !== null) throw new Error('Licensed, uncertain and unassessed states are not numerical severities');
    if (f.status === 'absent' && f.severity !== 0) throw new Error('Absent findings have severity zero');
    if (['suspected', 'confirmed'].includes(f.status) && (!f.severity || !f.evidence.length || !f.displacedFunction.trim() || !f.pairedRisk.trim() || !f.successTest.trim())) throw new Error('Actionable diagnosis requires severity, evidence, function, paired risk and success test');
    if (['direct', 'proxy'].includes(f.method) && ['revise', 'branch'].includes(f.recommendation)) throw new Error('Surface observations cannot authorize a literary rewrite');
    if (['licensed', 'absent', 'unassessed'].includes(f.status) && f.recommendation !== 'no_action') throw new Error('Licensed or unassessed forms must not trigger editing');
    if (f.recommendation !== 'no_action' && !f.intervention.trim()) throw new Error('Recommended action needs an explanation');
    checkEvidence(f.evidence, resolve);
  }
  return report;
}

export interface WordToken { text: string; start: number; end: number }
export function wordTokens(text: string): WordToken[] {
  return [...text.matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)].map(m => ({ text: m[0], start: m.index, end: m.index + m[0].length }));
}
export interface Distribution { n: number; mean: number | null; median: number | null; variance: number | null; cv: number | null; min: number | null; max: number | null }
export function distribution(values: number[]): Distribution {
  if (!values.every(Number.isFinite)) throw new Error('Distribution contains non-finite values');
  if (!values.length) return { n: 0, mean: null, median: null, variance: null, cv: null, min: null, max: null };
  const n = values.length, mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = n < 2 ? null : values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (n - 1), sorted = [...values].sort((a, b) => a - b);
  return { n, mean, median: (sorted[Math.floor((n - 1) / 2)] + sorted[Math.floor(n / 2)]) / 2, variance,
    cv: variance === null || mean === 0 ? null : Math.sqrt(variance) / mean, min: sorted[0], max: sorted[n - 1] };
}
export interface SurfaceObservations {
  methodVersion: string; textHash: string; words: number; sentences: Distribution; paragraphs: Distribution;
  mattr: { window: number; value: number | null }; repeatedFourgrams: { phrase: string; count: number; offsets: number[] }[];
  oneSentenceParagraphShare: number | null; limitations: string[];
}
const sentences = (text: string) => [...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(text)].map(s => s.segment).filter(s => wordTokens(s).length);
/** Descriptive English-language proxies. No universal target or literary score. */
export function observeSurface(body: string, window = 50): SurfaceObservations {
  checked(Type.String({ maxLength: 1000000 }), body);
  if (!Number.isSafeInteger(window) || window < 2 || window > 10000) throw new Error('Invalid lexical-diversity window');
  const tokens = wordTokens(body), words = tokens.map(t => t.text.toLocaleLowerCase('en'));
  const paragraphs = body.split(/\n\s*\n/u).filter(p => wordTokens(p).length);
  const counts = new Map<string, number>(); let sum = 0, windows = 0;
  for (let i = 0; i < words.length; i++) {
    counts.set(words[i], (counts.get(words[i]) || 0) + 1);
    if (i >= window) { const old = words[i - window], n = counts.get(old)! - 1; if (n) counts.set(old, n); else counts.delete(old); }
    if (i >= window - 1) { sum += counts.size / window; windows++; }
  }
  const grams = new Map<string, { count: number; offsets: number[] }>();
  for (let i = 0; i + 3 < words.length; i++) {
    const phrase = words.slice(i, i + 4).join(' '), entry = grams.get(phrase) || { count: 0, offsets: [] };
    entry.count++; if (entry.offsets.length < 20) entry.offsets.push(tokens[i].start); grams.set(phrase, entry);
  }
  return { methodVersion: METHOD_VERSION, textHash: proseHash(body), words: words.length,
    sentences: distribution(sentences(body).map(s => wordTokens(s).length)), paragraphs: distribution(paragraphs.map(p => wordTokens(p).length)),
    mattr: { window, value: windows ? sum / windows : null },
    repeatedFourgrams: [...grams].filter(([, e]) => e.count > 1).sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0])).slice(0, 100).map(([phrase, e]) => ({ phrase, ...e })),
    oneSentenceParagraphShare: paragraphs.length ? paragraphs.filter(p => sentences(p).length === 1).length / paragraphs.length : null,
    limitations: ['English ICU sentence segmentation and regex words are approximations; record the runtime version.', 'Repetition may be intentional. Lexical diversity, length variance and paragraph shape do not measure literary merit.', 'At most 100 repeated phrases and 20 offsets per phrase are shown. Missing semantic, pragmatic and human-only measures are unassessed.'] };
}
export interface Overlap { sourceId: string; phrase: string; outputStart: number; sourceStart: number; words: number }
/** Exact normalized lexical overlap only. Common phrases and legitimate callbacks
 * need interpretation. No claim of plagiarism, legal status, or global originality. */
export function anchorOverlaps(body: string, sources: { id: string; text: string }[], width = 8): Overlap[] {
  if (!Number.isSafeInteger(width) || width < 4 || width > 100) throw new Error('Invalid overlap width');
  checked(Type.String({ maxLength: 1000000 }), body);
  if (sources.length > 100) throw new Error('Too many comparison sources');
  const tokens = wordTokens(body), index = new Map<string, number>();
  for (let i = 0; i + width <= tokens.length; i++) index.set(tokens.slice(i, i + width).map(t => t.text.toLowerCase()).join(' '), tokens[i].start);
  const result: Overlap[] = [];
  for (const source of sources) {
    checked(Short, source.id); checked(Type.String({ maxLength: 500000 }), source.text);
    const st = wordTokens(source.text);
    for (let i = 0; i + width <= st.length; i++) {
      const phrase = st.slice(i, i + width).map(t => t.text.toLowerCase()).join(' '), start = index.get(phrase);
      if (start !== undefined) result.push({ sourceId: source.id, phrase, outputStart: start, sourceStart: st[i].start, words: width });
      if (result.length >= 200) return result;
    }
  }
  return result;
}
