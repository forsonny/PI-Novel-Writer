import { Type, type Static } from 'typebox';
import { Strict, Id, Hash, Text, Nonempty, Sources, Span, checked } from './schema.ts';
import { validateContract, checkEvidence, type SceneContract, type TextResolver } from './narrative.ts';
import { revisionPasses, type RevisionPass } from './taxonomy.ts';
import type { DiagnosticReport, Finding } from './diagnostics.ts';
import { wordTokens } from './diagnostics.ts';
import { proseHash, objectHash } from './version.ts';

export const PatchSchema = Strict({ start: Type.Integer({ minimum: 0 }), end: Type.Integer({ minimum: 0 }), original: Text, replacement: Text });
export type Patch = Static<typeof PatchSchema>;
export const RevisionProposalSchema = Strict({ schemaVersion: Type.Literal(1), sceneId: Id, sourceHash: Hash,
  pass: Type.Enum(revisionPasses), diagnosisIds: Type.Array(Id, { minItems: 1, maxItems: 50 }),
  decision: Type.Enum(['keep_source', 'propose'] as const), patches: Type.Array(PatchSchema, { maxItems: 100 }), rationale: Nonempty });
export type RevisionProposal = Static<typeof RevisionProposalSchema>;
export interface RevisionTask { pass: RevisionPass; diagnosisIds: string[]; targets: { start: number; end: number }[]; maxChangedWordFraction: number; structural: boolean }
const structural = new Set<RevisionPass>(['state-repair', 'scene-function', 'focalization-distance']);
/** Stable ordering is a topological order of the source's dependencies. Unneeded
 * passes are absent, not run as eleven compulsory rewrites. */
const dependencies: Partial<Record<RevisionPass, RevisionPass[]>> = {
  'scene-function': ['state-repair'], 'focalization-distance': ['state-repair', 'scene-function'],
  'character-dialogue': ['focalization-distance'], 'exposition-inference': ['character-dialogue'],
  'imagery-sensory': ['focalization-distance'], 'rhythm-paragraph': ['scene-function', 'imagery-sensory'],
  'voice-fidelity': ['character-dialogue', 'exposition-inference', 'imagery-sensory', 'rhythm-paragraph'],
  'repetition-motif': ['voice-fidelity'], 'compression-ambiguity': ['character-dialogue', 'exposition-inference', 'repetition-motif'],
  'line-integrity': [...revisionPasses].filter(p => p !== 'line-integrity'),
};
function passFor(f: Finding): RevisionPass {
  if (f.cause.level === 'state' || ['E7', 'G6'].includes(f.patternId)) return 'state-repair';
  if (f.patternId === 'E8') return 'focalization-distance';
  if (f.patternId[0] === 'D') return 'scene-function';
  if (f.patternId[0] === 'E') return 'character-dialogue';
  if (['C2', 'H4', 'H5'].includes(f.patternId)) return 'compression-ambiguity';
  if (f.patternId[0] === 'C') return 'exposition-inference';
  if (f.patternId[0] === 'F') return 'imagery-sensory';
  if (f.patternId[0] === 'B' || f.patternId === 'H6') return 'rhythm-paragraph';
  if (['G1', 'G2', 'G3', 'G4', 'G5'].includes(f.patternId)) return 'repetition-motif';
  if (['G8', 'H1', 'H7', 'H8'].includes(f.patternId)) return 'voice-fidelity';
  return 'line-integrity';
}
export function planRevisions(report: DiagnosticReport): { tasks: RevisionTask[]; controlRepairs: Finding[] } {
  const chosen = new Map<RevisionPass, Finding[]>();
  const controlRepairs = report.findings.filter(f => ['repair_state', 'repair_context', 'repair_plan', 'human_review', 'branch'].includes(f.recommendation));
  for (const f of report.findings) {
    if (f.recommendation !== 'revise' || !['suspected', 'confirmed'].includes(f.status) || !['human', 'model_assisted'].includes(f.method) || (f.severity ?? 0) < 2) continue;
    const pass = passFor(f); chosen.set(pass, [...(chosen.get(pass) || []), f]);
  }
  const result: RevisionPass[] = [], seen = new Set<RevisionPass>();
  const visit = (p: RevisionPass) => { if (seen.has(p)) return; seen.add(p); for (const d of dependencies[p] || []) if (chosen.has(d)) visit(d); if (chosen.has(p)) result.push(p); };
  revisionPasses.forEach(visit);
  return { tasks: result.map(pass => ({ pass, diagnosisIds: chosen.get(pass)!.map(f => f.id),
    targets: chosen.get(pass)!.flatMap(f => f.evidence.filter(e => e.sceneId === report.sceneId && e.textHash === report.textHash).map(e => ({ start: e.start, end: e.end }))),
    maxChangedWordFraction: structural.has(pass) ? 1 : 0.35, structural: structural.has(pass) })), controlRepairs };
}
export interface AppliedRevision { body: string; hash: string; sourceHash: string; changedWords: number; changedFraction: number; proposalHash: string }
export function applyRevision(source: string, value: unknown, task: RevisionTask, contract: SceneContract, resolve: TextResolver): AppliedRevision {
  const proposal = checked(RevisionProposalSchema, value, 'revision proposal'); validateContract(contract);
  if (proposal.sceneId !== contract.sceneId || proposal.sourceHash !== proseHash(source)) throw new Error('Revision source is stale');
  if (proposal.pass !== task.pass || objectHash([...proposal.diagnosisIds].sort()) !== objectHash([...task.diagnosisIds].sort())) throw new Error('Revision does not match its diagnosis');
  if (proposal.decision === 'keep_source' && proposal.patches.length) throw new Error('Keep-source cannot contain edits');
  if (!Number.isFinite(task.maxChangedWordFraction) || task.maxChangedWordFraction < 0 || task.maxChangedWordFraction > 1) throw new Error('Invalid revision budget');
  const patches = [...proposal.patches].sort((a, b) => a.start - b.start || a.end - b.end);
  let lastEnd = -1, lastStart = -1, changedWords = 0;
  for (const p of patches) {
    if (p.end < p.start || p.end > source.length || (p.start < lastEnd || p.start === lastStart) || source.slice(p.start, p.end) !== p.original) throw new Error('Invalid, overlapping or stale patch');
    if (!task.targets.some(t => p.start >= t.start && p.end <= t.end)) throw new Error('Patch is outside diagnosed scope');
    if (p.original === p.replacement) throw new Error('No-op patch');
    // A replacement costs the larger side, not twice the same replaced words.
    changedWords += Math.max(wordTokens(p.original).length, wordTokens(p.replacement).length, 1);
    lastEnd = p.end; lastStart = p.start;
  }
  for (const property of contract.protected) {
    checkEvidence(property.spans, resolve);
    if (property.kind !== 'exact_text') continue;
    for (const span of property.spans.filter(s => s.sceneId === contract.sceneId)) {
      if (span.textHash !== proposal.sourceHash) throw new Error('Exact protection belongs to an older source; rebase it explicitly');
      if (patches.some(p => p.start < span.end && p.end > span.start || p.start === p.end && p.start > span.start && p.start < span.end)) throw new Error('Patch modifies protected text');
    }
  }
  const changedFraction = changedWords / Math.max(wordTokens(source).length, 1);
  if (changedFraction > task.maxChangedWordFraction) throw new Error('Revision exceeds its change budget');
  let body = source;
  for (const p of [...patches].reverse()) body = body.slice(0, p.start) + p.replacement + body.slice(p.end);
  return { body, hash: proseHash(body), sourceHash: proposal.sourceHash, changedWords, changedFraction, proposalHash: objectHash(proposal) };
}

export const PreservationCheckSchema = Strict({ propertyId: Id, outcome: Type.Enum(['preserved', 'violated', 'uncertain'] as const), rationale: Nonempty,
  method: Type.Enum(['model_assisted', 'human'] as const), evidence: Type.Array(Span, { maxItems: 50 }), readingsPreserved: Type.Array(Text, { maxItems: 100 }) });
export const ComparisonSchema = Strict({ schemaVersion: Type.Literal(1), sourceHash: Hash, candidateHash: Hash,
  preferred: Type.Enum(['source', 'candidate', 'tie'] as const), targetImproved: Type.Boolean(),
  semanticChanges: Type.Array(Text, { maxItems: 100 }), regressions: Type.Array(Text, { maxItems: 100 }),
  pairedRiskAcceptable: Type.Boolean(), checks: Type.Array(PreservationCheckSchema, { maxItems: 100 }), rationale: Nonempty, dependencies: Sources });
export type Comparison = Static<typeof ComparisonSchema>;
/** String preservation is checked locally; semantic preservation remains a
 * separately evidenced assessment of the whole candidate, including added gloss. */
export function acceptRevision(comparisonValue: unknown, applied: AppliedRevision, contract: SceneContract, resolve: TextResolver,
  actor: 'model' | 'human' = 'model'): { accept: boolean; reasons: string[] } {
  const c = checked(ComparisonSchema, comparisonValue, 'revision comparison'); validateContract(contract);
  if (applied.hash !== proseHash(applied.body)) throw new Error('Candidate body was modified after revision');
  if (c.sourceHash !== applied.sourceHash || c.candidateHash !== applied.hash) throw new Error('Comparison is stale');
  if (new Set(c.checks.map(p => p.propertyId)).size !== c.checks.length) throw new Error('Duplicate preservation checks');
  const reasons: string[] = [];
  if (c.preferred !== 'candidate' || !c.targetImproved) reasons.push('No demonstrated improvement over source');
  if (!c.pairedRiskAcceptable || c.regressions.length) reasons.push('Paired risk or regression remains');
  for (const check of c.checks) {
    if (!contract.protected.some(p => p.id === check.propertyId)) throw new Error('Comparison checks an unknown property');
    if (check.method === 'human' && actor !== 'human') throw new Error('Model output cannot claim a human comparison');
    checkEvidence(check.evidence, resolve);
  }
  for (const p of contract.protected) {
    const check = c.checks.find(c => c.propertyId === p.id);
    if (!check || check.outcome !== 'preserved') { reasons.push(`Protection not established: ${p.id}`); continue; }
    if (p.method === 'human' && check.method !== 'human') reasons.push(`Human assessment required: ${p.id}`);
    if (p.kind === 'ambiguity' && p.readings.some(r => !check.readingsPreserved.includes(r))) reasons.push(`A protected reading was lost: ${p.id}`);
    if (p.kind !== 'silence' && !check.evidence.some(e => e.sceneId === contract.sceneId && e.textHash === applied.hash)) reasons.push(`Candidate evidence missing: ${p.id}`);
  }
  return { accept: reasons.length === 0, reasons };
}
export interface RevisionRecord { sourceHash: string; candidateHash: string; cause: string; pass: RevisionPass; accepted: boolean }
/** Repeated failure or A -> B -> A oscillation returns to the controller, never an
 * unbounded polish loop. The whole rejected history stays available for review. */
export function recoveryLimit(history: RevisionRecord[], nextCause: string): boolean {
  return history.filter(r => r.cause === nextCause && !r.accepted).length >= 2 || history.some((r, i) => history.slice(i + 1).some(s => r.sourceHash === s.candidateHash && r.candidateHash === s.sourceHash));
}
