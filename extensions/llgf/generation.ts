import { Type, type Static } from 'typebox';
import { Strict, Short, Nonempty, strings, checked } from './schema.ts';
import { pattern } from './taxonomy.ts';
import { wordTokens } from './diagnostics.ts';
export const strategies = ['action', 'speech', 'silence', 'distance', 'compression', 'imagery'] as const;
export const GenerationPolicySchema = Strict({
  riskPatternIds: Type.Array(Short, { maxItems: 5 }),
  functionalStrategies: Type.Array(Type.Enum(strategies), { maxItems: 4 }),
  maximumCandidates: Type.Integer({ minimum: 1, maximum: 4 }),
});
export type GenerationPolicy = Static<typeof GenerationPolicySchema>;
export const SelectionSchema = Strict({ selectedIndex: Type.Union([Type.Integer({ minimum: 0, maximum: 3 }), Type.Null()]),
  rationale: Nonempty, evidence: Nonempty, risks: strings(), functionSatisfied: Type.Boolean() });
export const defaultGeneration = (): GenerationPolicy => ({ riskPatternIds: [], functionalStrategies: [], maximumCandidates: 1 });
export function validateGeneration(raw: unknown): GenerationPolicy {
  const p = checked(GenerationPolicySchema, raw, 'generation policy');
  p.riskPatternIds.forEach(pattern);
  if (new Set(p.riskPatternIds).size !== p.riskPatternIds.length || new Set(p.functionalStrategies).size !== p.functionalStrategies.length) throw new Error('Duplicate risk or candidate strategy');
  if (p.maximumCandidates > 1 && p.functionalStrategies.length < p.maximumCandidates) throw new Error('Multiple candidates require different functional strategies');
  return p;
}
export function candidateStrategies(policy: GenerationPolicy, risks: string[], unit: number): string[] {
  validateGeneration(policy);
  // Alternatives are expensive. The ordinary continuation path stays single-
  // candidate; explicit high-risk first moves can branch without synonym cycling.
  return risks.length && unit === 0 ? policy.functionalStrategies.slice(0, policy.maximumCandidates) : [];
}
export function validateDraftUnit(prose: string, existing: string, maximumWords: number): void {
  const tokens = wordTokens(prose);
  if (!tokens.length || tokens.length > maximumWords) throw new Error('Draft unit exceeds its requested word allowance');
  if (prose === existing || existing.length > 100 && prose.startsWith(existing)) throw new Error('Draft duplicated the existing scene');
}
export function selectCandidate(raw: unknown, candidates: { prose: string; strategy: string }[]): number {
  if (candidates.length > 1 && new Set(candidates.map(c => c.prose.trim())).size < 2) throw new Error('Candidates did not differ');
  const choice = checked(SelectionSchema, raw, 'functional selection');
  if (choice.selectedIndex === null || !choice.functionSatisfied) throw new Error('No functional candidate met the scene obligation');
  const selected = candidates[choice.selectedIndex];
  if (!selected || !selected.prose.includes(choice.evidence)) throw new Error('Selection lacks exact evidence from its chosen candidate');
  return choice.selectedIndex;
}
