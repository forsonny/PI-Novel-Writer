/** Source crosswalk, not a text-origin detector. Beyond Fluency, Ch.5 / App.B. */
export const TAXONOMY_VERSION = 'beyond-fluency-2026-09-11/v1';
export interface Pattern { id: string; family: string; title: string }
const rows = `A1|A1|Generic affect lexicon
A2|A2|Adjectival varnish
A3|A3|Synonym cycling
A4|A4|Connective defaulting
A5|A5|Faux-archaic register
A6|A6|Cliché image pool
B1|B1|Sentence-band compression
B2|B2|Tricolon habit
B3|B3|Balanced-clause compulsion
B4|B4|Participial tail habit
B5|B5|Uniform sentence closure
B6|B6|Pseudo-literary fragmentation
C1|C1|Semantic restatement
C2|C2|Interpretive aftercare
C3|C3|Motivation accounting
C4|C4|Expository packetization
C5|C5|Reader-orientation surplus
C6|C6|Paragraph thesis-and-closure template
D1|D1|Mini-arc compulsion
D2|D2|Teleological visibility
D3|D3|Stakes inflation
D4|D4|Atmosphere substitution
D5|D5|Pacing homogeneity
D6|D6|Neat moral or thematic closure
E1|E1|Dialogue voice collapse
E2|E2|Symmetrical banter
E3|E3|Nonresponse intolerance
E4|E4|Explicit affect accounting
E5|E4|Thought paraphrase
E6|E5|Universal self-awareness
E7|E6|Character reset
E8|E6|Focalization leakage
F1|F1|Sensory checklist
F2|F2|Cinematic default
F3|F3|Metaphor stacking
F4|F4|Image-family incoherence
F5|F5|Decorative specificity
F6|F6|Mood mirroring
F7|F6|Wonder inflation
F8|F6|Metaphor explanation
G1|G1|Context echo
G2|G1|Keyphrase accumulation
G3|G2|Motif overannouncement
G4|G2|Motif evaporation
G5|G3|Promise evaporation
G6|G4|Continuity amnesia
G7|G5|Escalatory ratchet
G8|G6|Default-prose convergence
H1|H1|Varnish without structural repair
H2|H2|Thesaurus scar
H3|H3|Local optimization, global regression
H4|H4|Ambiguity deletion
H5|H5|Overcompression
H6|H6|Artificial roughness
H7|H6|Voice caricature
H8|H6|Anchor copying`;
export const patterns: readonly Pattern[] = Object.freeze(rows.split('\n').map(row => {
  const [id, family, title] = row.split('|');
  return Object.freeze({ id, family, title });
}));
export function pattern(id: string): Pattern {
  const result = patterns.find(p => p.id === id.toUpperCase());
  if (!result) throw new Error(`Unknown Chapter 5 pattern: ${id}`);
  return result;
}
export function familyMembers(family: string): readonly Pattern[] {
  const members = patterns.filter(p => p.family === family.toUpperCase());
  if (!members.length) throw new Error(`Unknown Appendix B family: ${family}`);
  return members;
}
export type Rubric = 'chapter5-0-4' | 'appendixB-0-3';
export type AssessmentStatus = 'unassessed' | 'absent' | 'licensed' | 'uncertain' | 'suspected' | 'confirmed';
export type EvidenceMethod = 'direct' | 'proxy' | 'model_assisted' | 'human';
export type Scope = 'sentence' | 'paragraph' | 'scene' | 'chapter' | 'arc' | 'manuscript';

/** No rescaling or L/U-to-number coercion. Status and severity are independent. */
export function validateSeverity(rubric: Rubric, severity: number | null): void {
  if (!['chapter5-0-4', 'appendixB-0-3'].includes(rubric)) throw new Error('Unknown rubric');
  if (severity === null) return;
  const max = rubric === 'chapter5-0-4' ? 4 : 3;
  if (!Number.isInteger(severity) || severity < 0 || severity > max) throw new Error(`Severity outside ${rubric}`);
}
export const causeFamilies = Object.freeze({
  chapter5: ['Probability-default pressure', 'Objective underspecification', 'Local-coherence optimization', 'Context compression and loss', 'Context contamination', 'Revision smoothing', 'Control overfitting', 'Scale neglect'],
  appendixB: ['Preference-shaped explicitness', 'High-probability continuation', 'Underspecified state', 'Plan leakage', 'Context echo', 'Global-instruction overload', 'Undirected revision', 'Long-range state loss'],
});
export const revisionPasses = Object.freeze([
  'state-repair', 'scene-function', 'focalization-distance', 'character-dialogue',
  'exposition-inference', 'imagery-sensory', 'rhythm-paragraph', 'voice-fidelity',
  'repetition-motif', 'compression-ambiguity', 'line-integrity',
] as const);
export type RevisionPass = typeof revisionPasses[number];
