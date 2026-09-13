import { PatternCardSchema } from './pattern-cards.ts';
import { AVSSchema, AnchorSchema, VoiceObservationSchema } from './voice.ts';
import { SceneContractSchema, PropositionSchema, ProtectionSchema, ConditionSchema } from './narrative.ts';
import { SceneSetupSchema } from './pipeline.ts';
import { PlanSchema } from './planning.ts';
import { PromiseSchema, MotifSchema, AffordanceSchema } from './registries.ts';
import { RegistryDeltaSchema } from './registry-service.ts';
import { MemorySchema } from './context.ts';
import { DiagnosticReportSchema } from './diagnostics.ts';
import { RevisionProposalSchema, ComparisonSchema } from './revision.ts';
import { ValidationSchema } from './gates.ts';
import { DriftBaselineSchema } from './drift.ts';
import { AuditReviewSchema, AuditScopeSchema } from './audits.ts';
import { ManagedProjectSchema } from './migration.ts';
import { BudgetSchema } from './jobs.ts';
import { StudySchema, TrialSchema, ReaderResponseSchema } from './evaluation.ts';
import { ArtifactSchema, SnapshotSchema } from './store.ts';

/** One runtime source for exported structural schemas. Semantic, temporal,
 * evidence and permission invariants still require the domain validators. */
export const schemaCatalogue = {
  pattern_card: PatternCardSchema,
  author_voice_spec: AVSSchema, anchor: AnchorSchema, voice_observation: VoiceObservationSchema,
  scene_contract: SceneContractSchema, scene_condition: ConditionSchema, scene_setup: SceneSetupSchema,
  proposition: PropositionSchema, protected_property: ProtectionSchema, narrative_plan: PlanSchema,
  promise: PromiseSchema, motif: MotifSchema, language_affordance: AffordanceSchema,
  registry_delta: RegistryDeltaSchema, memory_item: MemorySchema, diagnostic_report: DiagnosticReportSchema,
  revision_proposal: RevisionProposalSchema, revision_comparison: ComparisonSchema,
  scene_validation: ValidationSchema, drift_baseline: DriftBaselineSchema,
  sequence_audit: AuditReviewSchema, audit_scope: AuditScopeSchema, managed_project: ManagedProjectSchema,
  run_budget: BudgetSchema, study: StudySchema, trial: TrialSchema, reader_response: ReaderResponseSchema,
  artifact: ArtifactSchema, snapshot: SnapshotSchema,
};
