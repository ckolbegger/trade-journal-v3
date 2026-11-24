import type { Instrument } from '../../domain/instrument/index.ts';
import type { PlanExitCondition, PlanExitHoldPast } from '../../domain/plan-exit/index.ts';
import { headlineConditionsOf, type DerivedTradeState, type TradeEvaluation } from '../../domain/trade-analysis/index.ts';
import { formatDecimal, Rational } from '../../domain/values/index.ts';

// formatDecimal writes a minus sign the decimal parser does not read, so the sign is written here.
export const signedDecimalOf = (value: Rational): string => `${value.numerator < 0n ? '-' : ''}${formatDecimal(value.numerator < 0n ? Rational.of(0n).sub(value) : value, 6)}`;

// The part of a replayed session a Hold's crossing is read from: its date and each condition's current run (A271).
export interface CrossingSession {
  readonly date: string;
  readonly crossings?: { readonly [role in 'stop' | 'target']: { readonly conditions: readonly { readonly id: string; readonly since?: { readonly date: string } }[] } };
}

// The part of a saved Action the Plan Exit facts read.
export interface SavedAction {
  readonly reviewDate: string;
  readonly action: string;
  readonly reason?: string;
}

// A309: each condition's Holds saved on a Review Date while the replay of that session had it crossed: how many, and since when. The caller gives
// the Holds that count (those before the sale's or the page's date) and the replay; the form's check and the save read the facts the same way.
export function heldPastOf(sessions: readonly CrossingSession[], conditions: readonly Pick<PlanExitCondition, 'id' | 'role'>[], holds: readonly Pick<SavedAction, 'reviewDate'>[]): PlanExitHoldPast[] {
  return conditions.flatMap((condition) => {
    const role = condition.role === 'Stop' ? 'stop' : 'target';
    const crossed = holds.flatMap((hold) => {
      const since = sessions.find((s) => s.date === hold.reviewDate)?.crossings?.[role].conditions.find((c) => c.id === condition.id)?.since;
      return since ? [since.date] : [];
    });
    return crossed.length === 0 ? [] : [{ conditionId: condition.id, line: condition.role, since: crossed[0]!, sessions: crossed.length }];
  });
}

// A Hold counts when its Review Date is before `date`: the sale's exchange-local date, or the date of the page the facts are read for.
export const holdsBefore = <A extends SavedAction>(history: readonly A[], date: string): A[] => history.filter((a) => a.action === 'Hold' && a.reviewDate < date);

// A310: the Trade's most recent Action (the last of a history in Review Date order), when it is an Exit; its reason only when one was given.
export function latestExitOf(history: readonly SavedAction[]): { readonly reviewDate: string; readonly reason?: string } | undefined {
  const latest = history.at(-1);
  if (latest?.action !== 'Exit') return undefined;
  return { reviewDate: latest.reviewDate, ...((latest.reason ?? '').trim() !== '' && { reason: latest.reason! }) };
}

// What the exit form states and measures a sale with (A309): per Position held, its signed quantity and the Plan's headline conditions as that
// Position's price reads them; the Holds saved past a line; and the most recent Exit with its reason.
export interface PlanExitFacts {
  readonly positions: readonly { readonly instrument: Instrument; readonly quantity: string; readonly conditions: readonly PlanExitCondition[] }[];
  readonly heldPast: readonly PlanExitHoldPast[];
  readonly exit?: { readonly reviewDate: string; readonly reason?: string };
}

// `history` is the Trade's Actions in Review Date order; a Hold counts when its Review Date is before `before`. Without the replay no Hold is known to
// have been past a line.
export function planExitFactsOf(input: { readonly state: Pick<DerivedTradeState, 'positions'>; readonly evaluation: Pick<TradeEvaluation, 'conditions' | 'planBaseline'>; readonly sessions: readonly CrossingSession[] | undefined; readonly history: readonly SavedAction[]; readonly before: string }): PlanExitFacts {
  const positions = input.state.positions
    .filter((p) => p.quantity.numerator !== 0n)
    .map((p) => ({ instrument: p.instrument, quantity: signedDecimalOf(p.quantity), conditions: planExitConditionsOf(input.evaluation, p.instrument) }));
  const conditions = [...new Map(positions.flatMap((p) => p.conditions).map((c) => [c.id, c])).values()];
  const holds = holdsBefore(input.history, input.before);
  const exit = latestExitOf(input.history);
  return { positions, heldPast: input.sessions && holds.length > 0 ? heldPastOf(input.sessions, conditions, holds) : [], ...(exit && { exit }) };
}

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
