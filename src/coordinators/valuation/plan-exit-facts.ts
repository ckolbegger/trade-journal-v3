import type { Instrument } from '../../domain/instrument/index.ts';
import type { PlanExitCondition } from '../../domain/plan-exit/index.ts';
import { headlineConditionsOf, type TradeEvaluation } from '../../domain/trade-analysis/index.ts';

// A309: the Plan's headline Stop and Target as the sale measure reads them, each with its status at the evaluation's Marks. A condition is priced
// in the traded Instrument when a Stock is traded and the condition is on the Underlying's price, or an option is traded and it is on the option's.
export function planExitConditionsOf(evaluation: Pick<TradeEvaluation, 'conditions' | 'planBaseline'>, traded: Instrument): PlanExitCondition[] {
  return (headlineConditionsOf(evaluation) ?? []).map((c) => {
    const status = c.result.kind === 'Value' ? c.result.value.status : c.underlyingReading?.status;
    return {
      id: c.id,
      role: c.role,
      boundary: c.boundary,
      ...(status !== undefined && { status }),
      pricedInTradedInstrument: traded.kind === 'Stock' ? c.kind === 'UnderlyingPrice' : c.kind === 'StructureValue',
    };
  });
}
