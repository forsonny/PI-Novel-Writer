import { Type, type Static } from 'typebox';
import { Strict, Id, Sources, Nonempty, Short, strings, checked } from './schema.ts';
import { ObligationSchema, validateObligationGraph } from './narrative.ts';

/** Plans constrain obligations, not exact wording. They are never event evidence. */
export const PlanSchema = Strict({ schemaVersion: Type.Literal(1), id: Id,
  level: Type.Enum(['novel', 'arc', 'chapter'] as const), parentId: Type.Union([Id, Type.Null()]),
  title: Short, purpose: Nonempty, order: Type.Integer({ minimum: 0 }),
  sceneIds: Type.Array(Id, { maxItems: 2000 }), obligations: Type.Array(ObligationSchema, { maxItems: 100 }),
  entryState: Sources, exitStateRange: strings(), openAlternatives: strings(),
  protectedUnknowns: strings(), endingConstraints: strings(), contrast: strings(),
  promiseIds: Type.Array(Id, { maxItems: 100 }), viewpointIds: Type.Array(Id, { maxItems: 100 }),
  informationBudget: Nonempty, dependencies: Sources, changeReason: Nonempty,
});
export type NarrativePlan = Static<typeof PlanSchema>;
export function validatePlans(plans: NarrativePlan[]): void {
  const index = new Map(plans.map(p => [p.id, p]));
  if (index.size !== plans.length) throw new Error('Duplicate plan ID');
  for (const p of plans) {
    checked(PlanSchema, p, 'narrative plan'); validateObligationGraph(p.obligations);
    if (!p.exitStateRange.length) throw new Error('Plan needs an acceptable exit range');
    if (new Set(p.sceneIds).size !== p.sceneIds.length) throw new Error('Duplicate scene in plan');
    if (p.level === 'novel') { if (p.parentId !== null) throw new Error('Novel plan cannot have a parent'); }
    else {
      const parent = p.parentId && index.get(p.parentId);
      if (!parent || (p.level === 'arc' ? parent.level !== 'novel' : !['novel', 'arc'].includes(parent.level))) throw new Error('Plan parent is missing or has an invalid level');
    }
  }
}
