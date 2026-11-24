import type { ConditionStatus, TradeEvaluation } from './evaluate.ts';
import { headlineBasisOf } from './plan.ts';

export interface PlanCallCondition {
  readonly id: string;
  readonly role: 'Stop' | 'Target';
  readonly boundary: string;
}

// A306: what the Plan Exit calls for on one session's Marks. `condition` is the headline condition that made an Out
// (the Stop when both are reached) or an Unknown (the first that cannot be read); a Hold names none.
export interface PlanCall {
  readonly call: 'Out' | 'Hold' | 'Unknown';
  readonly condition?: PlanCallCondition;
}

// A110: a condition's own reading, or while only the contract's Mark is missing its Underlying-only reading (the replay's `statusOf`).
const statusOf = (c: ConditionStatus) => (c.result.kind === 'Value' ? c.result.value.status : c.underlyingReading?.status);

const named = (c: ConditionStatus): PlanCallCondition => ({ id: c.id, role: c.role, boundary: c.boundary });

// The Stop and the Target the Plan Baseline names as headline (A197), as the evaluation reads them; none without a baseline.
export function headlineConditionsOf(evaluation: Pick<TradeEvaluation, 'conditions' | 'planBaseline'>): readonly ConditionStatus[] | undefined {
  if (evaluation.planBaseline.kind !== 'Value') return undefined;
  const { stopBasis, targetBasis } = evaluation.planBaseline.value;
  const headlineIdOf = (role: 'stop' | 'target', basis: typeof stopBasis) => `${role}-${basis.indexOf(headlineBasisOf(basis)) + 1}`;
  const headlines = [headlineIdOf('stop', stopBasis), headlineIdOf('target', targetBasis)];
  return evaluation.conditions.filter((c) => headlines.includes(c.id));
}

export function planCall(evaluation: Pick<TradeEvaluation, 'conditions' | 'planBaseline'>): PlanCall {
  const conditions = headlineConditionsOf(evaluation);
  if (!conditions) return { call: 'Unknown' };
  const crossed = conditions.find((c) => (statusOf(c) ?? 'Active') !== 'Active');
  if (crossed) return { call: 'Out', condition: named(crossed) };
  const unreadable = conditions.find((c) => statusOf(c) === undefined);
  if (unreadable) return { call: 'Unknown', condition: named(unreadable) };
  return { call: 'Hold' };
}
