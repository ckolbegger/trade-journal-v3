import type { ClosedTradeDetail, OpenTradeDetail, TradeDetailView } from '../../../app/types.ts';
import { expiredOn, instrumentKey, type Instrument } from '../../../domain/instrument/index.ts';
import { text, unavailableWords } from '../../calculation-words.ts';
import type { Rational } from '../../../domain/values/index.ts';
import { decimalMoney, decimalUnderlyingPrice, money, quantity, rMultiple, shortDate, underlyingPrice } from '../../format.ts';
import { toWorkspaceLocal } from '../../../domain/time/index.ts';
import { calculation, dollarsAndR, pnlText, signed } from '../../figures.ts';
import { contractCount, conditionDirection } from '../../screens/option-words.ts';
import { abs, type Evaluation } from '../../screens/trade-detail/words.ts';
import type { PriceTrackProps } from '../track.types.ts';
import type { TodayDrawerProps } from './today.types.ts';

// The adapter from the Detail view, and the replay when there is one, to the Today drawer's plain props (A216). The replay is absent until
// Trade Detail reads `replayTrade` (T8P.22); without it the drawer leaves the comparison and the earlier markers out.
export interface TodayInput {
  readonly view: TradeDetailView;
  readonly timeZone: string;
  readonly replay?: TodayReplay;
}

// What the drawer reads of `TradeReplayView` (`coordinators/trade-views/replay-view.ts`): the Instruments in row order, and per completed
// session, oldest first, each Instrument's Mark or gap with its change since its previous Mark. The UI reaches the replay only through the
// facade's types (lint:deps `ui-only-through-facade`), and the Trade Views index does not export that type yet, so this is its structural subset:
// a `TradeReplayView` is assignable to it, which T8P.22's wiring relies on.
export interface TodayReplay {
  readonly instruments: readonly Instrument[];
  readonly sessions: readonly Session[];
}

interface Session {
  readonly date: string;
  readonly marks: readonly ReplayedMark[];
}

interface ReplayedMark {
  readonly instrument: Instrument;
  readonly resolution:
    | { readonly kind: 'Available'; readonly mark: { readonly price: string; readonly source: string; readonly savedAt: string; readonly correctionReason?: string } }
    | { readonly kind: 'Missing' | 'AcknowledgedUnavailable' };
  readonly change: { readonly since: string; readonly dollars: Rational } | null;
}

const markOf = (session: Session | undefined, instrument: Instrument): ReplayedMark | undefined =>
  session?.marks.find((m) => instrumentKey(m.instrument) === instrumentKey(instrument));

const hasMarks = (session: Session): boolean => session.marks.some((m) => m.resolution.kind === 'Available');

// The latest session and the latest earlier one with Marks: the price tracks' "earlier" marker (T8R.8 gives the tracks their own design).
function comparisonOf(replay: TodayReplay | undefined): { readonly now: Session; readonly earlier: Session } | undefined {
  const now = replay?.sessions.at(-1);
  const earlier = replay?.sessions.slice(0, -1).findLast(hasMarks);
  return now && earlier ? { now, earlier } : undefined;
}

// "Put Mark" for an option, "MNO Mark" for a stock.
const rowLabel = (instrument: Instrument): string => (instrument.kind === 'Option' ? `${instrument.right} Mark` : `${instrument.symbol} Mark`);

const asNumber = (value: Rational): number => Number(value.numerator) / Number(value.denominator);

// An Underlying's price has no "$" on an option Trade (C3); a stock Trade's and an option's are money.
const priceTextOf = (optionTrade: boolean) => (instrument: Instrument, text: string): string =>
  instrument.kind === 'Option' || !optionTrade ? decimalMoney(text) : decimalUnderlyingPrice(text);

// The table's cells are selected, never computed (A233): a Mark comes from the replay session dated the column's date, and a session that has
// not ended (so is not in the replay) or had no Mark reads "—". Change is the replay's, for Today's session, and only against Yesterday's column.
// Outside session-policy coverage the view names no dates (A232): the headings carry none and no cell is selected.
function marksOf({ replay }: TodayInput, { marksColumns: columns }: OpenTradeDetail, optionTrade: boolean): TodayDrawerProps['marks'] {
  if (!replay) return undefined;
  const sessionOn = (date: string | undefined): Session | undefined => replay.sessions.find((s) => s.date === date);
  const today = sessionOn(columns?.today.date);
  const yesterday = sessionOn(columns?.yesterday);
  const cell = markCellOf(optionTrade);
  const change = (instrument: Instrument): string => {
    const against = markOf(today, instrument)?.change;
    if (!against || against.since !== columns?.yesterday) return '—';
    return signed(instrument.kind === 'Option' || !optionTrade ? money : underlyingPrice)(against.dollars);
  };
  return {
    columns: [todayHeadingOf(columns), columns ? `Yesterday, ${shortDate(columns.yesterday)}` : 'Yesterday', 'Change'],
    rows: replay.instruments.map((instrument) => ({ label: rowLabel(instrument), today: cell(instrument, today), yesterday: cell(instrument, yesterday), change: change(instrument) })),
  };
}

// "Today, Thu Oct 15", or "Next session, Mon Oct 19" once the day's session has ended; no date outside session-policy coverage (A232).
const todayHeadingOf = (columns: OpenTradeDetail['marksColumns']): string => (columns ? `${columns.today.next ? 'Next session' : 'Today'}, ${shortDate(columns.today.date)}` : 'Today');

// A Mark cell: the replay session's Mark, or "—" for a session that has not ended or had none.
const markCellOf = (optionTrade: boolean) => (instrument: Instrument, session: Session | undefined): string => {
  const mark = markOf(session, instrument);
  return mark?.resolution.kind === 'Available' ? priceTextOf(optionTrade)(instrument, mark.resolution.mark.price) : '—';
};

// An expired option's cell reads "Expired" and a screen reader hears "Expired Fri Nov 20" (W25).
const expiredName = (instrument: Instrument): string => `Expired${instrument.kind === 'Option' ? ` ${shortDate(instrument.expiration)}` : ''}`;

// A Settlement Due Detail's table (A234): the option's cell is "Expired" for a column dated after its expiration, otherwise its replayed Mark;
// the Underlying's cells are the Detail's own, since the replay ends at the expiration session. Both of its cells and Change are selected, not computed.
function settlementMarksOf(input: TodayInput, view: OpenTradeDetail): TodayDrawerProps['marks'] {
  const { replay } = input;
  const columns = view.marksColumns;
  const base = marksOf(input, view, true);
  if (!base || !replay) return base;
  const { settlementUnderlying: underlying } = view;
  const pointText = (point: NonNullable<OpenTradeDetail['settlementUnderlying']>['today']): string => (point?.kind === 'Available' ? decimalUnderlyingPrice(point.price) : '—');
  return {
    ...base,
    rows: base.rows.map((row, index) => {
      const instrument = replay.instruments[index]!;
      if (instrument.kind === 'Stock') {
        return { ...row, today: pointText(underlying?.today), yesterday: pointText(underlying?.yesterday), change: underlying?.change ? signed(underlyingPrice)(underlying.change.dollars) : '—' };
      }
      const after = (date: string | undefined): boolean => date !== undefined && expiredOn(instrument, date);
      const name = expiredName(instrument);
      return {
        ...row,
        ...(after(columns?.today.date) && { today: 'Expired', todayName: name, change: '—' }),
        ...(after(columns?.yesterday) && { yesterday: 'Expired', yesterdayName: name }),
      };
    }),
  };
}

// A Closed Detail's table (A235): the second column is the exit session's, headed "Exit Fri Nov 13" (by sale) or "Expired Fri Nov 20" (by
// expiration) by the replay's last session. An Instrument's cell is its final exit Execution's price (an option that expired reads "Expired") and the
// Underlying's its Mark at that session. Today's column is headed by the view and empty.
function closedMarksOf({ replay }: TodayInput, view: ClosedTradeDetail, optionTrade: boolean): TodayDrawerProps['marks'] {
  if (!replay) return undefined;
  const byExpiration = view.terminalDisposition.kind === 'Value' && view.terminalDisposition.value.some(({ mechanism }) => mechanism === 'Expiration');
  const last = replay.sessions.at(-1);
  const cell = markCellOf(optionTrade);
  const exitPrice = (instrument: Instrument): string => {
    const final = view.positionChanges.flatMap((change) => change.executions).filter((e) => instrumentKey(e.instrument) === instrumentKey(instrument)).at(-1);
    return final ? priceTextOf(optionTrade)(instrument, final.price) : '—';
  };
  return {
    columns: [todayHeadingOf(view.marksColumns), `${byExpiration ? 'Expired' : 'Exit'}${last ? ` ${shortDate(last.date)}` : ''}`, 'Change'],
    rows: replay.instruments.map((instrument) => {
      const underlying = optionTrade && instrument.kind === 'Stock';
      // By expiration the option's cell is "Expired", not a price.
      const expired = byExpiration && !underlying;
      return {
        label: rowLabel(instrument),
        today: '',
        yesterday: expired ? 'Expired' : underlying ? cell(instrument, last) : exitPrice(instrument),
        ...(expired && { yesterdayName: expiredName(instrument) }),
        change: '—',
      };
    }),
  };
}

// One price track from the conditions it draws (A215): the zones reach the track's ends, which sit a tenth of the span beyond the prices.
function trackOf(
  title: string,
  conditions: readonly { readonly role: 'Stop' | 'Target'; readonly boundary: string; readonly below: boolean }[],
  markers: { readonly entry?: number; readonly earlier?: { readonly label: string; readonly price: number }; readonly now?: number },
  format: (text: string) => string,
  nowText: string | undefined,
  zeroBased: boolean,
): PriceTrackProps | undefined {
  const prices = [...conditions.map((c) => Number(c.boundary)), ...[markers.entry, markers.earlier?.price, markers.now].filter((p): p is number => p !== undefined)];
  // A track with nothing to place on it is not drawn.
  if (prices.length === 0) return undefined;
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const margin = ((high - low) || high || 1) / 10;
  const min = zeroBased ? 0 : Math.max(0, low - margin);
  const max = high + margin;
  const names = [...conditions.map((c) => `${c.role} ${format(c.boundary)}`), ...(nowText === undefined ? [] : [`now ${format(nowText)}`])];
  return {
    title,
    accessibleName: `${title}: ${names.join(', ')}`,
    min,
    max,
    zones: conditions.map((c) => ({ role: c.role, from: c.below ? min : Number(c.boundary), to: c.below ? Number(c.boundary) : max })),
    markers: [
      ...(markers.entry === undefined ? [] : [{ kind: 'entry' as const, label: 'entry', price: markers.entry }]),
      ...(markers.earlier ? [{ kind: 'earlier' as const, label: markers.earlier.label, price: markers.earlier.price }] : []),
      ...(markers.now === undefined ? [] : [{ kind: 'now' as const, label: 'now', price: markers.now }]),
    ],
    conditionLines: [],
  };
}

// An Underlying condition's line under its track (A223): the contract's value at expiration at the boundary and the distance on the
// Underlying, in the words the Conditions table gave them (row 23.17).
function conditionLineOf(view: OpenTradeDetail, condition: OpenTradeDetail['current']['evaluation']['conditions'][number], timeZone: string): PriceTrackProps['conditionLines'][number] {
  const symbol = view.plan.underlying;
  const basis = (condition.role === 'Stop' ? view.baseline.stopBasis : view.baseline.targetBasis)[Number(condition.id.split('-')[1]) - 1];
  // A result with no reading says why at the figure length (A222); only a reading without an Underlying distance keeps the dash.
  const distance = calculation(condition.result, (reading) => (reading.underlying ? underlyingPrice(reading.underlying.distance) : '—'), timeZone);
  return {
    label: `${condition.role} on ${symbol}`,
    figures: [
      { term: 'Value at expiration', value: basis?.valueAtExpiration ? money(basis.valueAtExpiration) : '—' },
      { term: `Distance on ${symbol}`, value: distance },
    ],
  };
}

function tracksOf({ replay, timeZone }: TodayInput, view: OpenTradeDetail, optionTrade: boolean): readonly PriceTrackProps[] {
  const leg = view.plan.legs[0];
  if (!leg) return [];
  const comparison = comparisonOf(replay);
  const earlierOf = (instrument: Instrument) => {
    const mark = markOf(comparison?.earlier, instrument);
    return comparison && mark?.resolution.kind === 'Available' ? { label: shortDate(comparison.earlier.date), price: Number(mark.resolution.mark.price) } : undefined;
  };
  const quality = view.entryQuality;
  const entryPrice = quality.kind === 'Value' && quality.value.averageEntry.kind === 'Value' ? asNumber(quality.value.averageEntry.value) : undefined;
  const { mark, underlyingMark, evaluation } = view.current;
  const symbol = view.plan.underlying;
  const below = (condition: (typeof evaluation.conditions)[number]) =>
    leg.instrument.kind === 'Option'
      ? conditionDirection(condition.role, condition.kind, { right: leg.instrument.right, side: leg.side }) === 'below'
      : (leg.side === 'Long') === (condition.role === 'Stop');
  const conditionsOf = (kind: 'UnderlyingPrice' | 'StructureValue') =>
    evaluation.conditions.filter((c) => c.kind === kind).map((c) => ({ role: c.role, boundary: c.boundary, below: below(c) }));
  const earlierMarker = (instrument: Instrument) => {
    const earlier = earlierOf(instrument);
    return earlier && { earlier };
  };
  if (!optionTrade) {
    const stock: Instrument = { kind: 'Stock', symbol };
    return drawn([trackOf(symbol, conditionsOf('UnderlyingPrice'), { ...(entryPrice !== undefined && { entry: entryPrice }), ...earlierMarker(stock), ...(mark && { now: Number(mark.price) }) }, decimalMoney, mark?.price, false)]);
  }
  const underlying: Instrument = { kind: 'Stock', symbol };
  const underlyingTrack = trackOf(symbol, conditionsOf('UnderlyingPrice'), { ...earlierMarker(underlying), ...(underlyingMark && { now: Number(underlyingMark.price) }) }, decimalUnderlyingPrice, underlyingMark?.price, false);
  return drawn([
    trackOf('Option price', conditionsOf('StructureValue'), { ...(entryPrice !== undefined && { entry: entryPrice }), ...earlierMarker(leg.instrument), ...(mark && { now: Number(mark.price) }) }, decimalMoney, mark?.price, true),
    underlyingTrack && { ...underlyingTrack, conditionLines: evaluation.conditions.filter((c) => c.kind === 'UnderlyingPrice').map((condition) => conditionLineOf(view, condition, timeZone)) },
  ]);
}

const drawn = (tracks: readonly (PriceTrackProps | undefined)[]): readonly PriceTrackProps[] => tracks.filter((track): track is PriceTrackProps => track !== undefined);

type Row = { readonly label: string; readonly value: string };

// The Position held at an earlier session's Marks, valued with that session's own Mark: the figures the dated line has always shown (P12, P13).
function valuedAtOf(line: NonNullable<OpenTradeDetail['current']['datedLine']>, timeZone: string): NonNullable<TodayDrawerProps['valuedAt']> {
  const { evaluation } = line;
  const { mark } = evaluation.observation;
  const rows: Row[] = [
    ...(mark ? [{ label: 'Mark', value: decimalMoney(mark.price) }] : []),
    { label: 'Realized to date', value: calculation(evaluation.realizedToDate, signed(money)) },
    { label: 'Open P&L', value: calculation(evaluation.remainingOpenPnl, signed(money), timeZone) },
    { label: 'Current Marked Trade P&L', value: pnlText(evaluation.currentMarkedPnl, evaluation.currentMarkedPnlInPlanR, timeZone) },
    { label: 'Incurred fees', value: calculation(evaluation.incurredFees, money) },
    { label: 'Risk to stop', value: dollarsAndR(evaluation.ongoingRiskToStop, evaluation.ongoingRiskToStopInPlanR, undefined, timeZone) },
    { label: 'Worst case', value: dollarsAndR(evaluation.worstCaseOngoingRisk, evaluation.worstCaseOngoingRiskInPlanR, undefined, timeZone) },
    { label: 'Reward to target', value: dollarsAndR(evaluation.incrementalRewardToTarget, evaluation.incrementalRewardToTargetInPlanR, undefined, timeZone) },
  ];
  return { heading: `At the ${shortDate(line.tradingDate)} Marks`, rows };
}

// Lots bought after the last Marks: risk and reward measured from their prices, never a P&L (A54).
function atEntryOf(atEntry: NonNullable<Evaluation['atEntry']>, optionTrade: boolean): NonNullable<TodayDrawerProps['atEntry']> {
  const inR = (dollars: Rational, planR: Rational) => `${money(dollars)} · ${rMultiple(planR)}`;
  return {
    heading: 'At entry',
    rows: [
      { label: 'Quantity', value: optionTrade ? contractCount(quantity(abs(atEntry.quantity))) : `${quantity(atEntry.quantity)} shares` },
      { label: 'Average entry', value: money(atEntry.averageEntry) },
      { label: 'Risk from entry', value: inR(atEntry.riskFromEntry, atEntry.riskFromEntryInPlanR) },
      { label: 'Reward from entry', value: inR(atEntry.rewardFromEntry, atEntry.rewardFromEntryInPlanR) },
    ],
  };
}

// "10:20 am" in the Workspace zone.
const clockTime = (instant: string, timeZone: string): string =>
  new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone }).format(new Date(instant)).replace(/\s?([AP])M$/, (_, half: string) => ` ${half.toLowerCase()}m`);

// "Fri Oct 9" in the Workspace zone.
const openedDate = (instant: string, timeZone: string): string => shortDate(toWorkspaceLocal(instant, timeZone).split('T')[0] ?? '');

// Before any Marks Trade Views names the session whose close brings them (`firstMarksDue`, revision 90); the drawer infers nothing. The
// opening is the opening Position Change's, in the Workspace zone.
function noMarksTextOf(view: OpenTradeDetail, timeZone: string): string | undefined {
  const { firstMarksDue } = view.current;
  if (firstMarksDue === undefined) return undefined;
  const resolved = view.entryResolution.kind === 'Resolved' ? view.entryResolution.positionChangeId : undefined;
  const opened = view.positionChanges.find((c) => c.factId === resolved) ?? view.positionChanges[0];
  const when = opened ? ` ${openedDate(opened.economicTime, timeZone)} at ${clockTime(opened.economicTime, timeZone)}` : '';
  return `No Marks yet. This Trade opened${when}. Its first Marks, and every figure that needs them, are due once the ${shortDate(firstMarksDue)} session ends.`;
}

// Under the table (W29): an acknowledged Mark as the trader's acknowledgment, not a price, and the older Stale context. Each only where it applies.
function notesOf({ timeZone }: TodayInput, { current }: OpenTradeDetail): TodayDrawerProps['notes'] {
  const { markResolution, evaluation } = current;
  const stale = evaluation.staleContext;
  const acknowledged =
    markResolution?.kind === 'AcknowledgedUnavailable'
      ? `${text(unavailableWords({ reason: 'AcknowledgedUnavailable', instrument: evaluation.observation.instrument, date: evaluation.valuationDate }, 'sentence', timeZone), timeZone)}: your acknowledgment, not a price`
      : undefined;
  if (!stale && !acknowledged) return undefined;
  return {
    ...(acknowledged && { acknowledged }),
    ...(stale && { stale: `Stale context: ${decimalMoney(stale.price)} from ${shortDate(stale.tradingDate)} close (stale, not used in any current figure)` }),
  };
}

export function todayProps(input: TodayInput): TodayDrawerProps {
  const { view } = input;
  if (!('current' in view)) return { tracks: [] };
  const optionTrade = view.plan.legs[0]?.instrument.kind === 'Option';
  if ('terminalDisposition' in view) {
    const closedMarks = closedMarksOf(input, view, optionTrade);
    return { ...(closedMarks && { marks: closedMarks }), stamp: 'Closed', tracks: [] };
  }
  // A Settlement Due Detail has the Marks table and its notes alone (revision 96): no price tracks, dated card or At entry.
  if (view.settlement.length > 0) {
    const settlementMarks = settlementMarksOf(input, view);
    const settlementNotes = notesOf(input, view);
    return { ...(settlementMarks && { marks: settlementMarks }), ...(settlementNotes && { notes: settlementNotes }), tracks: [] };
  }
  const marks = marksOf(input, view, optionTrade);
  const noMarksText = noMarksTextOf(view, input.timeZone);
  const notes = notesOf(input, view);
  return {
    ...(marks && { marks }),
    ...(notes && { notes }),
    ...(noMarksText && { noMarksText }),
    tracksHeading: optionTrade ? 'Where the prices sit' : 'Where the price sits',
    tracks: tracksOf(input, view, optionTrade),
    ...(view.current.datedLine && { valuedAt: valuedAtOf(view.current.datedLine, input.timeZone) }),
    ...(view.current.evaluation.atEntry && { atEntry: atEntryOf(view.current.evaluation.atEntry, optionTrade) }),
  };
}
