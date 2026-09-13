import fs from 'node:fs';
import { Type, type Static } from 'typebox';
import { Strict, Short, Nonempty, strings, checked } from './schema.ts';
import { patterns, pattern } from './taxonomy.ts';
export const PatternCardSchema = Strict({ id: Short, family: Short, title: Nonempty,
  definition: Nonempty, evidenceNeeded: Nonempty, firstIntervention: Nonempty,
  pairedOvercorrection: Nonempty, routes: strings(),
  familyCauseCandidates: Type.Array(Type.String({ pattern: '^CF[1-8]$' }), { minItems: 1, maxItems: 8 }),
  causeStatus: Type.Literal('hypotheses_not_observed_causes'), noActionRule: Nonempty,
  automaticRejection: Type.Literal(false),
});
export type PatternCard = Static<typeof PatternCardSchema>;
const cards = checked(Type.Array(PatternCardSchema, { minItems: 56, maxItems: 56 }),
  JSON.parse(fs.readFileSync(new URL('../../rubrics/pattern-cards.json', import.meta.url), 'utf8')), 'pattern cards');
if (new Set(cards.map(c => c.id)).size !== patterns.length || cards.some(c => {
  const source = pattern(c.id); return c.family !== source.family || c.title !== source.title;
})) throw new Error('Pattern cards differ from the versioned source crosswalk');
/** These are contextual diagnostic questions, not fixed feature thresholds or
 * authorship labels. Return independent copies so callers cannot alter the bank. */
export function cardsFor(ids: readonly string[] = patterns.map(p => p.id)): PatternCard[] {
  return [...new Set(ids.map(id => pattern(id).id))].map(id => structuredClone(cards.find(c => c.id === id)!));
}
