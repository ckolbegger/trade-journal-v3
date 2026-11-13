import type { OpenTradeDetail, TradeDetailView } from '../../../app/types.ts';
import { instrumentKey, type Instrument } from '../../../domain/instrument/index.ts';
import type { Rational } from '../../../domain/values/index.ts';
import { decimalMoney, decimalUnderlyingPrice, localTime, money, quantity, rMultiple, shortDate, underlyingPrice } from '../../format.ts';
import { isMarkLacking } from '../../calculation-words.ts';
import { calculation, dollarsAndR, pnlText, signed } from '../../figures.ts';
import { contractCount, conditionDirection } from '../../screens/option-words.ts';
import { abs, type Evaluation } from '../../screens/trade-detail/words.ts';
import type { PriceTrackProps } from '../track.types.ts';
import type { MarkCell, TodayDrawerProps } from './today.types.ts';

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

// The latest session, the latest earlier one with Marks, and the session just before the latest when it had none and was passed over.
function comparisonOf(replay: TodayReplay | undefined): { readonly now: Session; readonly earlier: Session; readonly passedOver?: Session } | undefined {
  const now = replay?.sessions.at(-1);
  const before = replay?.sessions.slice(0, -1) ?? [];
  const earlier = before.findLast(hasMarks);
  if (!now || !earlier) return undefined;
  const last = before.at(-1);
  return { now, earlier, ...(last !== earlier && last && { passedOver: last }) };
}

// "Put Mark" for an option, "MNO Mark" for a stock.
const rowLabel = (instrument: Instrument): string => (instrument.kind === 'Option' ? `${instrument.right} Mark` : `${instrument.symbol} Mark`);

const asNumber = (value: Rational): number => Number(value.numerator) / Number(value.denominator);

// An Underlying's price has no "$" on an option Trade (C3); a stock Trade's and an option's are money.
const priceTextOf = (optionTrade: boolean) => (instrument: Instrument, text: string): string =>
  instrument.kind === 'Option' || !optionTrade ? decimalMoney(text) : decimalUnderlyingPrice(text);

function marksOf({ timeZone, replay }: TodayInput, optionTrade: boolean): TodayDrawerProps['marks'] {
  const comparison = comparisonOf(replay);
  if (!replay || !comparison) return undefined;
  const { now, earlier, passedOver } = comparison;
  const price = priceTextOf(optionTrade);
  const cell = (instrument: Instrument, mark: ReplayedMark | undefined): MarkCell => {
    if (mark?.resolution.kind !== 'Available') return { price: '—' };
    const { price: text, source, savedAt, correctionReason } = mark.resolution.mark;
    return { price: price(instrument, text), provenance: `${source} · ${localTime(savedAt, timeZone)}`, ...(correctionReason !== undefined && { correction: correctionReason }) };
  };
  const change = (instrument: Instrument, mark: ReplayedMark | undefined): string => {
    // Only a change against the compared session: an Instrument with no Mark then has its change against an older one.
    const against = mark?.change;
    if (!against || against.since !== earlier.date) return '—';
    return signed(instrument.kind === 'Option' || !optionTrade ? money : underlyingPrice)(against.dollars);
  };
  return {
    heading: `Marks: ${shortDate(now.date)} against ${shortDate(earlier.date)}`,
    columns: [shortDate(earlier.date), shortDate(now.date), 'Change'],
    rows: replay.instruments.map((instrument) => ({
      label: rowLabel(instrument),
      earlier: cell(instrument, markOf(earlier, instrument)),
      current: cell(instrument, markOf(now, instrument)),
      change: change(instrument, markOf(now, instrument)),
    })),
    ...(passedOver && { note: `${shortDate(passedOver.date)} has no Marks, so ${shortDate(now.date)} is compared with ${shortDate(earlier.date)}.` }),
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
function conditionLineOf(view: OpenTradeDetail, condition: OpenTradeDetail['current']['evaluation']['conditions'][number]): PriceTrackProps['conditionLines'][number] {
  const symbol = view.plan.underlying;
  const basis = (condition.role === 'Stop' ? view.baseline.stopBasis : view.baseline.targetBasis)[Number(condition.id.split('-')[1]) - 1];
  const reading = condition.result.kind === 'Value' ? condition.result.value : undefined;
  return {
    label: `${condition.role} on ${symbol}`,
    figures: [
      { term: 'Value at expiration', value: basis?.valueAtExpiration ? money(basis.valueAtExpiration) : '—' },
      { term: `Distance on ${symbol}`, value: reading?.underlying ? underlyingPrice(reading.underlying.distance) : '—' },
    ],
  };
}

function tracksOf({ replay }: TodayInput, view: OpenTradeDetail, optionTrade: boolean): readonly PriceTrackProps[] {
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
    underlyingTrack && { ...underlyingTrack, conditionLines: evaluation.conditions.filter((c) => c.kind === 'UnderlyingPrice').map((condition) => conditionLineOf(view, condition)) },
  ]);
}

const drawn = (tracks: readonly (PriceTrackProps | undefined)[]): readonly PriceTrackProps[] => tracks.filter((track): track is PriceTrackProps => track !== undefined);

type Row = { readonly label: string; readonly value: string };

// The Position held at an earlier session's Marks, valued with that session's own Mark: the figures the dated line has always shown (P12, P13).
function valuedAtOf(line: NonNullable<OpenTradeDetail['current']['datedLine']>): NonNullable<TodayDrawerProps['valuedAt']> {
  const { evaluation } = line;
  const { mark } = evaluation.observation;
  const rows: Row[] = [
    ...(mark ? [{ label: 'Mark', value: decimalMoney(mark.price) }] : []),
    { label: 'Realized to date', value: calculation(evaluation.realizedToDate, signed(money)) },
    { label: 'Open P&L', value: calculation(evaluation.remainingOpenPnl, signed(money)) },
    { label: 'Current Marked Trade P&L', value: pnlText(evaluation.currentMarkedPnl, evaluation.currentMarkedPnlInPlanR) },
    { label: 'Incurred fees', value: calculation(evaluation.incurredFees, money) },
    { label: 'Risk to stop', value: dollarsAndR(evaluation.ongoingRiskToStop, evaluation.ongoingRiskToStopInPlanR) },
    { label: 'Worst case', value: dollarsAndR(evaluation.worstCaseOngoingRisk, evaluation.worstCaseOngoingRiskInPlanR) },
    { label: 'Reward to target', value: dollarsAndR(evaluation.incrementalRewardToTarget, evaluation.incrementalRewardToTargetInPlanR) },
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

// Before any Marks: nothing was held at an earlier session's Marks, and every lot is at entry. The figure is then unavailable because it
// awaits the close, which is what is left once a missing Mark, the calendar and the Settlement Due are set aside (words stay in calculation-words).
function noMarksTextOf(view: OpenTradeDetail, timeZone: string): string | undefined {
  const { evaluation, datedLine, expectedMarkDate } = view.current;
  const { currentMarkedPnl } = evaluation;
  if (datedLine || !evaluation.atEntry || expectedMarkDate === undefined || view.settlement.length > 0) return undefined;
  if (currentMarkedPnl.kind !== 'Unavailable' || isMarkLacking(currentMarkedPnl)) return undefined;
  const resolved = view.entryResolution.kind === 'Resolved' ? view.entryResolution.positionChangeId : undefined;
  const opened = view.positionChanges.find((c) => c.factId === resolved) ?? view.positionChanges[0];
  return `No Marks yet. This Trade opened today${opened ? ` at ${clockTime(opened.economicTime, timeZone)}` : ''}. Its first Marks, and every figure that needs them, are due once today's session ends.`;
}

export function todayProps(input: TodayInput): TodayDrawerProps {
  const { view } = input;
  if (!('current' in view) || 'terminalDisposition' in view) return { tracks: [] };
  const optionTrade = view.plan.legs[0]?.instrument.kind === 'Option';
  const marks = marksOf(input, optionTrade);
  const noMarksText = noMarksTextOf(view, input.timeZone);
  return {
    ...(marks && { marks }),
    ...(noMarksText && { noMarksText }),
    tracksHeading: optionTrade ? 'Where the prices sit' : 'Where the price sits',
    tracks: tracksOf(input, view, optionTrade),
    ...(view.current.datedLine && { valuedAt: valuedAtOf(view.current.datedLine) }),
    ...(view.current.evaluation.atEntry && { atEntry: atEntryOf(view.current.evaluation.atEntry, optionTrade) }),
  };
}
