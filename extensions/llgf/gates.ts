import { Type, type Static } from 'typebox';
import { Strict, Id, Hash, Text, Nonempty, Span, Sources, checked, strings } from './schema.ts';
import { validateContract, checkEvidence, type SceneContract, type TextResolver } from './narrative.ts';
import { PreservationCheckSchema } from './revision.ts';
import type { DiagnosticReport } from './diagnostics.ts';
import { proseHash } from './version.ts';

export const validationDimensions = ['facts', 'causality', 'knowledge', 'perspective', 'scene_function', 'voice', 'orientation', 'originality'] as const;
export const ValidationSchema = Strict({ schemaVersion: Type.Literal(1), sceneId: Id, textHash: Hash, reconstruction: Nonempty,
  checks: Type.Array(Strict({ dimension: Type.Enum(validationDimensions), outcome: Type.Enum(['pass', 'fail', 'uncertain', 'not_applicable'] as const),
    evidence: Type.Array(Span, { maxItems: 100 }), rationale: Nonempty,
    classification: Type.Enum(['none', 'confirmed_error', 'unreliable_narration', 'character_error', 'disputed_report', 'deliberate_mystery', 'retcon', 'ambiguity', 'extraction_uncertainty'] as const) }), { minItems: 8, maxItems: 8 }),
  obligations: Type.Array(Strict({ id: Id, outcome: Type.Enum(['satisfied', 'deferred', 'failed', 'uncertain'] as const), evidence: Type.Array(Span, { maxItems: 100 }), rationale: Nonempty }), { maxItems: 100 }),
  information: Type.Array(Strict({ index: Type.Integer({ minimum: 0 }), outcome: Type.Enum(['preserved', 'violated', 'uncertain'] as const), rationale: Nonempty }), { maxItems: 100 }),
  protections: Type.Array(PreservationCheckSchema, { maxItems: 100 }),
  stateDecisions: Type.Array(Strict({ id: Id, outcome: Type.Enum(['verified', 'rejected', 'uncertain'] as const), rationale: Nonempty }), { maxItems: 200 }),
  registryDecisions: Type.Optional(Type.Array(Strict({ id: Id, outcome: Type.Enum(['verified', 'rejected', 'uncertain'] as const), rationale: Nonempty }), { maxItems: 90 })),
  exitInRange: Type.Boolean(), exitRationale: Nonempty, limitations: strings(),
});
export type SceneValidation = Static<typeof ValidationSchema>;
export interface GateResult { decision: 'ACCEPT' | 'ACCEPT_WITH_FLAGS' | 'TARGETED_REVISE' | 'REPAIR_CONTROLS' | 'HUMAN_REVIEW'; reasons: string[]; flags: string[]; humanValidation: 'not_performed' | 'performed' }
export function validateSceneReview(value: unknown, body: string, contract: SceneContract, resolve: TextResolver, actor: 'model' | 'human' = 'model'): SceneValidation {
  const r = checked(ValidationSchema, value, 'scene validation'); validateContract(contract);
  if (r.sceneId !== contract.sceneId || r.textHash !== proseHash(body)) throw new Error('Scene validation is stale');
  if (new Set(r.checks.map(c => c.dimension)).size !== validationDimensions.length) throw new Error('Validation dimensions must occur exactly once');
  for (const c of r.checks) {
    checkEvidence(c.evidence, resolve);
    if (c.outcome === 'pass' && !c.evidence.some(e => e.sceneId === r.sceneId && e.textHash === r.textHash)) throw new Error('Positive validation needs prose evidence');
    if (c.outcome === 'pass' && ['confirmed_error', 'extraction_uncertainty'].includes(c.classification)) throw new Error('A positive check cannot conceal an unresolved error');
    if (c.outcome === 'fail' && c.classification === 'none') throw new Error('A failed check requires a conflict classification');
    if (c.outcome === 'not_applicable' && ['perspective', 'scene_function', 'orientation', 'voice'].includes(c.dimension)) throw new Error('Required literary checks cannot be marked not applicable');
  }
  if (new Set(r.obligations.map(c => c.id)).size !== r.obligations.length || r.obligations.length !== contract.obligations.length) throw new Error('Obligation coverage differs from the contract');
  for (const c of r.obligations) {
    const obligation = contract.obligations.find(o => o.id === c.id); if (!obligation) throw new Error('Unknown obligation');
    if (c.outcome === 'deferred' && !obligation.deferralAllowed) throw new Error('Obligation cannot be deferred');
    if (c.outcome === 'satisfied' && !c.evidence.some(e => e.sceneId === contract.sceneId && e.textHash === r.textHash)) throw new Error('Satisfied obligation needs current prose evidence');
    checkEvidence(c.evidence, resolve);
  }
  if (r.information.length !== contract.information.length || new Set(r.information.map(c => c.index)).size !== r.information.length || r.information.some(c => c.index >= contract.information.length)) throw new Error('Information-permission coverage is incomplete');
  if (new Set(r.protections.map(c => c.propertyId)).size !== r.protections.length || r.protections.some(c => !contract.protected.some(p => p.id === c.propertyId))) throw new Error('Invalid protected-property coverage');
  if (new Set(r.stateDecisions.map(d => d.id)).size !== r.stateDecisions.length) throw new Error('Duplicate state decision');
  for (const c of r.protections) { if (c.method === 'human' && actor !== 'human') throw new Error('Model cannot claim human validation'); checkEvidence(c.evidence, resolve); }
  return r;
}
export function sceneGate(body: string, contract: SceneContract, review: SceneValidation, diagnostics: DiagnosticReport, governance: 'collaborative' | 'delegated' | 'research', actor: 'model' | 'human' = 'model'): GateResult {
  const reasons: string[] = [], flags = [...review.limitations, ...diagnostics.limitations];
  if (!body.trim() || review.textHash !== proseHash(body) || diagnostics.textHash !== proseHash(body) || diagnostics.sceneId !== contract.sceneId || review.sceneId !== contract.sceneId) throw new Error('Gate inputs do not identify the same text');
  if (contract.status !== 'approved') reasons.push('Scene contract is provisional');
  if (!review.exitInRange) reasons.push('Exit state is outside the contract');
  for (const c of review.checks) {
    if (c.outcome === 'fail') reasons.push(`${c.dimension}: ${c.rationale}`);
    if (c.outcome === 'uncertain') {
      if (['facts', 'causality', 'knowledge', 'perspective', 'originality'].includes(c.dimension)) reasons.push(`Unresolved ${c.dimension}: ${c.rationale}`);
      else flags.push(`${c.dimension}: ${c.rationale}`);
    }
  }
  for (const c of review.obligations) {
    const o = contract.obligations.find(o => o.id === c.id)!;
    if (['failed', 'uncertain'].includes(c.outcome) && o.hardness === 'hard') reasons.push(`Unfulfilled obligation: ${o.statement}`);
    else if (c.outcome !== 'satisfied') flags.push(`Obligation ${c.outcome}: ${o.statement}`);
  }
  for (const c of review.information) if (c.outcome !== 'preserved') reasons.push(`Information permission ${c.index} ${c.outcome}: ${c.rationale}`);
  let needsHuman = governance !== 'delegated' && actor !== 'human';
  for (const p of contract.protected) {
    const c = review.protections.find(c => c.propertyId === p.id);
    if (!c || c.outcome !== 'preserved') reasons.push(`Protected property not established: ${p.requirement}`);
    else if (p.kind !== 'silence' && !c.evidence.some(e => e.sceneId === contract.sceneId && e.textHash === review.textHash)) reasons.push('Protected property requires current candidate evidence');
    else if (p.kind === 'ambiguity' && p.readings.some(reading => !c.readingsPreserved.includes(reading))) reasons.push('Protected interpretation lost');
    if (p.kind === 'exact_text' && p.spans.some(span => !body.includes(span.quote))) reasons.push('Protected exact wording is missing');
    if (p.method === 'human' && actor !== 'human') needsHuman = true;
  }
  const controls = diagnostics.findings.some(f => ['repair_state', 'repair_context', 'repair_plan'].includes(f.recommendation));
  const revise = diagnostics.findings.some(f => f.recommendation === 'revise' && ['suspected', 'confirmed'].includes(f.status) && (f.severity ?? 0) >= 2 && ['human', 'model_assisted'].includes(f.method));
  needsHuman ||= diagnostics.findings.some(f => f.recommendation === 'human_review' || f.recommendation === 'branch');
  for (const f of diagnostics.findings) if (['uncertain', 'suspected'].includes(f.status)) flags.push(`${f.patternId}: ${f.displacedFunction || f.intervention}`);
  const decision = controls ? 'REPAIR_CONTROLS' : reasons.length || revise ? 'TARGETED_REVISE' : needsHuman ? 'HUMAN_REVIEW' : flags.length ? 'ACCEPT_WITH_FLAGS' : 'ACCEPT';
  return { decision, reasons, flags, humanValidation: actor === 'human' ? 'performed' : 'not_performed' };
}
