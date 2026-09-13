import { Type, type Static } from 'typebox';
import { Strict, Id, Short, Sources, Nonempty, checked, type SourceRef } from './schema.ts';
import { ConditionSchema, type SceneCondition } from './narrative.ts';
import { observeSurface, wordTokens, METHOD_VERSION, type SurfaceObservations } from './diagnostics.ts';
import { objectHash, proseHash } from './version.ts';

export const driftMetrics = ['sentence_mean', 'sentence_cv', 'paragraph_mean', 'paragraph_cv', 'mattr50', 'one_sentence_paragraph_share'] as const;
export type DriftMetric = typeof driftMetrics[number];
export const DriftBaselineSchema = Strict({ schemaVersion: Type.Literal(1), id: Id,
  condition: ConditionSchema, scope: Type.Enum(['scene', 'rolling'] as const),
  methodVersion: Type.Literal(METHOD_VERSION),
  minimumWords: Type.Integer({ minimum: 50, maximum: 20000 }),
  windowWords: Type.Integer({ minimum: 50, maximum: 5000 }),
  stepWords: Type.Integer({ minimum: 1, maximum: 5000 }),
  calibration: Type.Enum(['heuristic', 'pilot', 'human_calibrated'] as const),
  rationale: Nonempty, sourceRecords: Sources,
  ranges: Type.Array(Strict({ metric: Type.Enum(driftMetrics), min: Type.Number(), max: Type.Number() }), { minItems: 1, maxItems: 6 }),
});
export type DriftBaseline = Static<typeof DriftBaselineSchema>;
export interface DriftInput { sceneId: string; body: string; source: SourceRef; condition: SceneCondition }
export interface DriftWindow {
  sceneId: string; textHash: string; start: number; end: number;
  wordStart: number; wordEnd: number; scope: 'scene' | 'rolling';
  conditionKey: string; values: Record<DriftMetric, number | null>;
  assessment: 'uncalibrated' | 'insufficient_evidence' | 'within_reference' | 'outside_reference' | 'licensed';
  outside: DriftMetric[]; baselineId: string | null; license: string | null;
}
export interface DriftReport {
  methodVersion: string; windows: DriftWindow[];
  firstOutside: { sceneId: string; wordPosition: number } | null;
  alerts: { sceneId: string; wordPosition: number; metrics: DriftMetric[]; reason: string }[];
  unassessedDimensions: string[]; limitations: string[];
}
/** Time and position vary within a voice condition. The identity key deliberately
 * excludes them; it retains focalizer, function, pressure, distance and epoch. */
export function conditionKey(c: SceneCondition): string {
  checked(ConditionSchema, c);
  return objectHash({ focalizerId: c.focalizerId, sceneFunction: c.sceneFunction,
    secondaryFunctions: [...c.secondaryFunctions].sort(), pressure: c.pressure,
    distance: c.distance, epochId: c.epochId });
}
export function validateBaseline(raw: unknown): DriftBaseline {
  const b = checked(DriftBaselineSchema, raw, 'drift baseline');
  if (b.stepWords > b.windowWords) throw new Error('Drift step cannot leave gaps between windows');
  if (b.scope === 'rolling' && b.minimumWords > b.windowWords) throw new Error('Rolling minimum exceeds its window');
  if (new Set(b.ranges.map(r => r.metric)).size !== b.ranges.length) throw new Error('Duplicate drift metric');
  for (const r of b.ranges) {
    if (r.min < 0 || r.min > r.max) throw new Error('Invalid drift reference range');
    if (['mattr50', 'one_sentence_paragraph_share'].includes(r.metric) && r.max > 1) throw new Error('Proportion range exceeds one');
  }
  if (b.calibration !== 'heuristic' && !b.sourceRecords.length) throw new Error('Calibration needs traceable evidence');
  return b;
}
function values(s: SurfaceObservations): Record<DriftMetric, number | null> {
  return { sentence_mean: s.sentences.mean, sentence_cv: s.sentences.cv,
    paragraph_mean: s.paragraphs.mean, paragraph_cv: s.paragraphs.cv,
    mattr50: s.mattr.value, one_sentence_paragraph_share: s.oneSentenceParagraphShare };
}
/** Report-only monitoring. It never rewrites prose, updates a baseline from the
 * output it is judging, or treats overlapping windows as independent evidence.
 * Numeric reference ranges describe a project, not literary quality. */
export function monitorDrift(inputs: DriftInput[], baselines: DriftBaseline[] = [],
  licenses: { sceneId: string; rationale: string }[] = []): DriftReport {
  baselines.forEach(validateBaseline);
  if (new Set(inputs.map(s => s.sceneId)).size !== inputs.length) throw new Error('Duplicate drift scene');
  if (new Set(baselines.map(b => `${conditionKey(b.condition)}:${b.scope}`)).size !== baselines.length) throw new Error('Ambiguous drift baselines');
  for (const l of licenses) { checked(Id, l.sceneId); checked(Nonempty, l.rationale); if (!inputs.some(s => s.sceneId === l.sceneId)) throw new Error('License is outside this sequence'); }
  const windows: DriftWindow[] = []; let wordBase = 0;
  for (const input of inputs) {
    checked(Id, input.sceneId); const key = conditionKey(input.condition), tokens = wordTokens(input.body);
    const create = (scope: DriftWindow['scope'], first: number, last: number, baseline?: DriftBaseline) => {
      const start = tokens[first]?.start ?? 0, end = tokens[last - 1]?.end ?? input.body.length;
      const sample = scope === 'scene' ? input.body : input.body.slice(start, end);
      const measured = values(observeSurface(sample)), license = licenses.find(l => l.sceneId === input.sceneId)?.rationale ?? null;
      const outside: DriftMetric[] = [];
      const enough = baseline !== undefined && last - first >= baseline.minimumWords && baseline.ranges.every(r => measured[r.metric] !== null);
      if (enough) for (const r of baseline!.ranges) if (measured[r.metric]! < r.min || measured[r.metric]! > r.max) outside.push(r.metric);
      windows.push({ sceneId: input.sceneId, textHash: proseHash(input.body), start, end, wordStart: wordBase + first, wordEnd: wordBase + last,
        scope, conditionKey: key, values: measured, outside, baselineId: baseline?.id ?? null, license,
        assessment: !baseline ? 'uncalibrated' : !enough ? 'insufficient_evidence' : outside.length ? license ? 'licensed' : 'outside_reference' : 'within_reference' });
    };
    const sceneBaseline = baselines.find(b => b.scope === 'scene' && conditionKey(b.condition) === key);
    create('scene', 0, tokens.length, sceneBaseline);
    const rolling = baselines.find(b => b.scope === 'rolling' && conditionKey(b.condition) === key);
    if (rolling) {
      if (tokens.length < rolling.windowWords) create('rolling', 0, tokens.length, rolling);
      else for (let first = 0; first + rolling.windowWords <= tokens.length; first += rolling.stepWords) create('rolling', first, first + rolling.windowWords, rolling);
    }
    wordBase += tokens.length;
  }
  const outside = windows.filter(w => w.assessment === 'outside_reference');
  // Require more than one feature family for a triage alert. Even then this is a
  // suggestion to inspect controls, not statistical confirmation or a rewrite.
  const alerts = outside.filter(w => new Set(w.outside.map(m => m.startsWith('sentence') || m.startsWith('paragraph') || m === 'one_sentence_paragraph_share' ? 'form' : 'lexical')).size > 1)
    .map(w => ({ sceneId: w.sceneId, wordPosition: w.wordStart, metrics: w.outside,
      reason: 'Multiple proxy families differ from the declared reference. Check scene licensing and future context before editing.' }));
  return { methodVersion: METHOD_VERSION, windows,
    firstOutside: outside.length ? { sceneId: outside[0].sceneId, wordPosition: outside[0].wordStart } : null, alerts,
    unassessedDimensions: ['semantic voice', 'narrative distance interpretation', 'character voice leakage', 'image coherence', 'motif transformation', 'human literary effect', 'statistical change-point significance'],
    limitations: ['Report only. No universal literary threshold, probability, or provenance score is computed.',
      'Windows stay inside scene and voice-condition boundaries. Whole-scene observations are also retained; paragraph boundaries at rolling cuts are approximate.',
      'Overlapping windows are correlated and are not independent confirmations.',
      'Baselines remain frozen; approved voice epochs use separate conditions. More vocabulary variety or sentence variance is not necessarily better.',
      'First outside-reference position is descriptive, not a confirmed onset of literary drift.'] };
}
