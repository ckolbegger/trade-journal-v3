import { Temporal } from 'temporal-polyfill';
import { instrumentKey, type Instrument } from '../../domain/instrument/index.ts';
import { measurePlanExit, type PlanExitCondition, type PlanExitHoldPast, type PlanExitMeasure } from '../../domain/plan-exit/index.ts';
import type { DerivedTradeState, TradeAnalysisRecord } from '../../domain/trade-analysis/index.ts';
import { formatDecimal, parseDecimal, Rational } from '../../domain/values/index.ts';
import type { AnswerInput, HistoryAction, ReflectionDisposition } from '../../modules/journal/index.ts';
import type { MarketDataReadSession } from '../../modules/market-data/index.ts';
import { assembleReplay } from '../replay/index.ts';
import { planExitConditionsOf, valueTrade } from '../valuation/index.ts';
import type { TradeWorkflowsDeps } from './types.ts';

// formatDecimal writes a minus sign the decimal parser does not read, so the sign is written here.
const decimalOf = (value: Rational): string => `${value.numerator < 0n ? '-' : ''}${formatDecimal(value.numerator < 0n ? Rational.of(0n).sub(value) : value, 6)}`;

// A309: each reached condition's Holds saved on an earlier Review Date while the replay of that session had it crossed: how many, and since when.
async function heldPastOf(
  deps: TradeWorkflowsDeps,
  analysis: TradeAnalysisRecord,
  whole: DerivedTradeState,
  session: MarketDataReadSession,
  conditions: readonly PlanExitCondition[],
  holds: readonly HistoryAction[],
): Promise<PlanExitHoldPast[]> {
  const replayed = await assembleReplay(deps, analysis, whole, session, { withJournal: false });
  if ('kind' in replayed) return [];
  return conditions.flatMap((condition) => {
    const role = condition.role === 'Stop' ? 'stop' : 'target';
    const crossed = holds.flatMap((hold) => {
      const since = replayed.sessions.find((s) => s.date === hold.reviewDate)?.crossings?.[role].conditions.find((c) => c.id === condition.id)?.since;
      return since ? [since.date] : [];
    });
    return crossed.length === 0 ? [] : [{ conditionId: condition.id, line: condition.role, since: crossed[0]!, sessions: crossed.length }];
  });
}

// What the measure reads of an Execution.
interface SaleMember {
  readonly action: 'Buy' | 'Sell';
  readonly instrument: Instrument;
  readonly quantity: string;
  readonly price: string;
  readonly economicTime: string;
}

export interface SaleMeasure {
  readonly measure: PlanExitMeasure;
  // A310, A312: whether the sale owes the Plan Departure Reason.
  readonly owesReason: boolean;
  // The Journal revision the Action history was read at; the caller binds it to the reflection's own snapshot.
  readonly journalRevision: number;
}

// A309: the measure of the Executions of one Position Change against the Plan Exit, from the Trade's facts, its latest Marks and its saved Actions.
// Nothing for a change that does not reduce the Position (a buy of a long one). The Executions share one Instrument and one action (any other mix
// is not installed), so their quantities add and a condition priced in the traded Instrument is reached when any Execution's own price reaches it.
export async function measureSale(
  deps: TradeWorkflowsDeps,
  analysis: TradeAnalysisRecord,
  before: DerivedTradeState | undefined,
  members: readonly SaleMember[],
): Promise<SaleMeasure | undefined> {
  const first = members[0];
  if (!first || !before) return undefined;
  const position = before.positions.find((p) => instrumentKey(p.instrument) === instrumentKey(first.instrument));
  if (!position) return undefined;
  const held = decimalOf(position.quantity);
  const quantities = members.map((m) => parseDecimal(m.quantity));
  if (quantities.some((q) => !q.ok)) return undefined;
  const quantity = decimalOf(quantities.reduce((sum, q) => (q.ok ? sum.add(q.value) : sum), Rational.of(0n)));
  const side = first.action;
  if (!measurePlanExit({ held, change: { side, quantity }, conditions: [], heldPast: [] })) return undefined;
  const session = await deps.marketData.openReadSession({ kind: 'Current', asOf: deps.clock.now() });
  const valuation = await valueTrade(session, analysis);
  const conditions = valuation.kind === 'Valued' ? planExitConditionsOf(valuation.evaluation, first.instrument) : [];
  const { actions, snapshot } = await deps.journal.queryActionHistory({ tradeId: analysis.tradeId });
  // A Hold counts when its Review Date is earlier than the sale's own exchange-local date, whatever session the latest Marks belong to.
  // The sale's moment is its earliest Execution's, as recordPositionChange takes it for the reflections, whatever order they arrive in.
  const earliest = members.reduce((a, m) => (Temporal.Instant.compare(m.economicTime, a.economicTime) < 0 ? m : a));
  const saleDate = Temporal.Instant.from(earliest.economicTime).toZonedDateTimeISO('America/New_York').toPlainDate().toString();
  const holds = actions.filter((a) => a.action === 'Hold' && a.reviewDate < saleDate);
  const heldPast = holds.length === 0 ? [] : await heldPastOf(deps, analysis, before, session, conditions, holds);
  const measures = members.map((m) => measurePlanExit({ held, change: { side, quantity, price: m.price }, conditions, heldPast })!);
  const measure = measures.find((m) => m.kind === 'Follows') ?? measures[0]!;
  // A310: a sale that closes the whole Position carries the reason of the Trade's most recent Action when that is an Exit with one.
  const latest = actions.at(-1);
  const carried = latest?.action === 'Exit' && (latest.reason ?? '').trim() !== '';
  const whole = measure.kind === 'Leaves' && !measure.reasons.some((r) => r.kind === 'PartOnly');
  return { measure, owesReason: measure.kind === 'Leaves' && !(whole && carried), journalRevision: snapshot.journalRevision };
}

// The id of the Plan Departure Reason prompt of a form revision, found by its role; none on a form that has no such prompt (a Workspace
// still on the earlier form, which a sale then records without asking for it).
export async function planDepartureReasonPromptOf(deps: TradeWorkflowsDeps, definitionId: string): Promise<string | undefined> {
  const found = await deps.journal.getDefinitions({ revision: definitionId });
  if (found.kind !== 'Found') return undefined;
  return found.definition.prompts.find((p) => p.kind === 'Text' && p.role === 'PlanDepartureReason')?.id;
}

// Only a non-blank Text answer holds the reason.
export const holdsReason = (answer: AnswerInput | undefined): boolean => answer?.kind === 'Text' && answer.text.trim() !== '';

// A312: a Defer for a sale that owes the reason names it as required, so the owed reflection cannot be answered without it; the form revision
// the Debt is owed under must have the prompt (an earlier form has none, and the Journal refuses a requirement it could never meet).
export async function deferNamingReason(deps: TradeWorkflowsDeps, disposition: ReflectionDisposition, owesReason: boolean): Promise<ReflectionDisposition> {
  if (!owesReason || disposition.kind !== 'Defer') return disposition;
  const latest = await deps.journal.getDefinitions({ latestFor: 'entry-type.position-change-reflection' });
  const hasPrompt = latest.kind === 'Found' && latest.definition.prompts.some((p) => p.kind === 'Text' && p.role === 'PlanDepartureReason');
  return hasPrompt ? { kind: 'Defer', requires: ['PlanDepartureReason'] } : disposition;
}
