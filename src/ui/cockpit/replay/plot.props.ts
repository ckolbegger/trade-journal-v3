import type { TradeReplayView } from '../../../app/types.ts';
import type { CalculationResult } from '../../../domain/calculation-result/index.ts';
import { instrumentKey, type OptionInstrument } from '../../../domain/instrument/index.ts';
import { Rational } from '../../../domain/values/index.ts';
import { signed } from '../../figures.ts';
import { decimalMoney, money, quantity, shortDate, summaryStrike } from '../../format.ts';
import type { LabelledFigure, PlotKeyEntry, PlotMarker, PlotSession, ReplayProps, ReplayPlotProps } from './replay.types.ts';
import { FILL_VERBS, markerWords } from './session-words.props.ts';

// What the plot draws (W39 to W41, W44): finished values turned into the numbers it places, beside their finished labels.
// Drawing, not calculating (A256).
type ViewSession = TradeReplayView['sessions'][number];

const ZERO = Rational.of(0n);
const signedMoney = signed(money);

// The Underlying and the contract the Trade holds: the view lists the Underlying beside the contract, so a stock Trade has no contract.
export function instrumentsOf(view: TradeReplayView): { readonly underlying: string; readonly contract?: OptionInstrument } {
  const contract = view.instruments.find((i): i is OptionInstrument => i.kind === 'Option');
  const stock = view.instruments.find((i) => i.kind === 'Stock');
  return { underlying: stock?.symbol ?? contract?.root ?? '', ...(contract && { contract }) };
}

// A finished figure turned into the number the plot places: drawing, not calculating (A256).
const asNumber = (value: Rational): number => Number(value.numerator) / Number(value.denominator);
// The chart's figures drop the cents only where there are none ("Stop −$324"); a figure with cents keeps them.
const chartMoney = (value: Rational): string => money(value).replace(/\.00$/, '');
const chartSigned = (value: Rational): string => signedMoney(value).replace(/\.00$/, '');

const labelledValue = (value: Rational, name: string): LabelledFigure => ({ value: asNumber(value), label: `${name} ${chartSigned(value)}` });
const labelled = (result: CalculationResult<Rational> | undefined, name: string): LabelledFigure | null => (result?.kind === 'Value' ? labelledValue(result.value, name) : null);

type Marker = NonNullable<ViewSession['markers']>[number];

// "Sold 2" on a phone: the fills without their prices; an Expiration has no shorter form.
const markerShortWords = (marker: Marker): string | undefined =>
  marker.fills.every((fill) => fill.price) ? marker.fills.map((fill) => `${FILL_VERBS[fill.action]} ${quantity(fill.quantity)}`).join(', ') : undefined;

function plotMarkerOf(marker: Marker): PlotMarker {
  const short = markerShortWords(marker);
  return { id: marker.id, kind: marker.kind, effect: marker.effect, label: markerWords(marker), ...(short !== undefined && { shortLabel: short }), isEntry: marker.effect === 'Opened' };
}

export function plotSessionOf(view: TradeReplayView, index: number): PlotSession {
  const session = view.sessions[index]!;
  const f = session.figures;
  const underlying = view.instruments.find((i) => i.kind === 'Stock');
  const found = underlying && session.marks.find((m) => instrumentKey(m.instrument) === instrumentKey(underlying));
  const price = found?.resolution.kind === 'Available' ? found.resolution.mark.price : undefined;
  const banked = session.realizedPnl.compare(ZERO) !== 0;
  const risk = f?.ongoingRiskToStop;
  const reward = f?.incrementalRewardToTarget;
  const standing = f?.standing?.kind === 'Value' ? f.standing.value : undefined;
  const zone = standing?.zone;
  const past = zone === 'PastStop' || zone === 'PastTarget' ? (standing?.pastBy && { line: zone === 'PastStop' ? ('Stop' as const) : ('Target' as const), dollars: standing.pastBy.dollars }) : undefined;
  const tradePnl = session.tradePnl.kind === 'Value' ? session.tradePnl.value : undefined;
  const worstCase = f?.outcomes?.atWorstCase?.kind === 'Value' ? f.outcomes.atWorstCase.value : undefined;
  const hasStrike = instrumentsOf(view).contract !== undefined;
  // A271, W64: the flag is on the session a role was first crossed in; the plot keeps it on later sessions. The view says which session.
  const crossings = [
    ...(session.crossings?.stop.first?.date === session.date ? [{ line: 'Stop' as const, label: 'Stop breached' }] : []),
    ...(session.crossings?.target.first?.date === session.date ? [{ line: 'Target' as const, label: 'Target reached' }] : []),
  ];
  const keyEntries: PlotKeyEntry[] = [
    ...(price === undefined ? [{ kind: 'NoMark' as const, label: 'No Mark' }] : [{ kind: 'Mark' as const, label: 'Mark' }]),
    ...(tradePnl && tradePnl.compare(ZERO) !== 0 ? [{ kind: 'TradePnl' as const, label: tradePnl.compare(ZERO) > 0 ? 'Open profit' : 'Open loss' }] : []),
    ...(banked ? [{ kind: 'Banked' as const, label: session.realizedPnl.compare(ZERO) > 0 ? 'Banked' : 'Realized loss' }] : []),
    { kind: 'BreakEven', label: 'Break-even' },
    ...(f?.outcomes?.atStop?.kind === 'Value' ? [{ kind: 'Stop' as const, label: 'At Stop' }] : []),
    ...(f?.outcomes?.atTarget?.kind === 'Value' ? [{ kind: 'Target' as const, label: 'At Target' }] : []),
    ...(f?.outcomes?.atWorstCase?.kind === 'Value' ? [{ kind: 'WorstCase' as const, label: 'At Worst case' }] : []),
    ...(f?.outcomes?.atMaxReward?.kind === 'Value' ? [{ kind: 'MaxReward' as const, label: 'At Max reward' }] : []),
    ...(hasStrike ? [{ kind: 'Strike' as const, label: 'Strike' }] : []),
    ...((session.markers ?? []).some((m) => m.effect !== 'Opened') ? [{ kind: 'Execution' as const, label: 'Execution' }] : []),
    ...crossings.map((c) => ({ kind: 'FirstCrossing' as const, label: c.label })),
  ];
  return {
    keyEntries,
    // A weekday count from the first session, so a holiday's slot stays blank (A256).
    slot: weekdaysThrough(view.sessions[0]!.date, session.date) - 1,
    dateLabel: shortDate(session.date),
    underlyingMark: price === undefined ? null : Number(price),
    ...(price !== undefined && { underlyingLabel: decimalMoney(price) }),
    tradePnl: session.tradePnl.kind === 'Value' ? asNumber(session.tradePnl.value) : null,
    banked: asNumber(session.realizedPnl),
    ...(banked && { bankedLabel: `${session.realizedPnl.compare(ZERO) > 0 ? 'Banked' : 'Realized'} ${chartSigned(session.realizedPnl)}` }),
    resultAtStop: labelled(f?.outcomes?.atStop, 'Stop'),
    resultAtTarget: labelled(f?.outcomes?.atTarget, 'Target'),
    worstCase: labelled(f?.outcomes?.atWorstCase, 'Worst case'),
    maxReward: labelled(f?.outcomes?.atMaxReward, 'Max reward'),
    // A losing Worst case's tag for the bottom edge (W68); the chart draws it only when the line is below its range. A figure with no weight is Main.
    ...(worstCase && worstCase.compare(ZERO) < 0 && { worstCaseTag: { label: `Worst case ${chartSigned(worstCase)} ↓`, weight: f?.extremes ?? 'Main' } }),
    ...(crossings.length > 0 && { firstCrossing: crossings }),
    ...(past && { past: { line: past.line, label: `${chartMoney(past.dollars)} past the ${past.line}` } }),
    // What is at stake from here, tagged at the slider's session: the risk unless the Stop is breached, the reward unless the Target is reached.
    ...(risk?.kind === 'Value' && (zone !== 'PastStop' || reward?.kind === 'Value') && {
      stake: {
        ...(zone !== 'PastStop' && { riskLabel: `Current Risk ${chartMoney(risk.value)}`, riskShortLabel: `Risk ${chartMoney(risk.value)}` }),
        ...(reward?.kind === 'Value' && zone !== 'PastTarget' && { rewardLabel: `Remaining Reward ${chartMoney(reward.value)}`, rewardShortLabel: `Reward ${chartMoney(reward.value)}` }),
      },
    }),
    markers: (session.markers ?? []).map(plotMarkerOf),
  };
}

// The trading days from the first date to the last, both counted: the weekdays. The time axis is drawing (A256); the UI holds no holiday
// calendar, so a holiday leaves one slot blank.
function weekdaysThrough(first: string, last: string): number {
  let count = 0;
  for (let at = Date.parse(`${first}T00:00:00Z`); at <= Date.parse(`${last}T00:00:00Z`); at += 86_400_000) {
    const day = new Date(at).getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
  }
  return count;
}

// The price chart's lines (W40): the contract's strike, and each Stop or Target that is a price on the Underlying.
function priceLinesOf(view: TradeReplayView, contract: OptionInstrument | undefined): ReplayPlotProps['anchors']['priceLines'] {
  const conditions = view.sessions.findLast((s) => s.figures)?.figures?.conditions ?? [];
  return [
    ...(contract ? [{ kind: 'Strike' as const, price: Number(contract.strike), label: `Strike ${summaryStrike(contract.strike)}` }] : []),
    ...conditions.filter((c) => c.kind === 'UnderlyingPrice').map((c) => ({ kind: c.role, price: Number(c.boundary), label: `${c.role} ${decimalMoney(c.boundary)}` })),
  ];
}

export function plotBaseOf(view: TradeReplayView): ReplayProps['plotBase'] {
  const { underlying, contract } = instrumentsOf(view);
  const plan = view.planColumn;
  const first = view.sessions[0]?.date;
  const last = view.sessions.at(-1)?.date;
  // A stock Trade's entry on its own price: what the Position Change that opened it paid per share. An option's Underlying has none.
  const entry = contract ? undefined : view.sessions.flatMap((s) => s.markers ?? []).find((m) => m.effect === 'Opened')?.fills[0]?.price;
  return {
    priceTitle: `${underlying} price · one Mark per session`,
    priceShortTitle: `${underlying} price`,
    pnlTitle: 'Trade P&L',
    accessibleName: `${underlying} Marks and Trade P&L by session`,
    describedBy: `replay-table-${view.tradeId}`,
    anchors: {
      ...(entry !== undefined && { entryPrice: asNumber(entry) }),
      priceLines: priceLinesOf(view, contract),
      planAtStop: plan ? labelledValue(plan.atStop, 'Stop') : null,
      planAtTarget: plan ? labelledValue(plan.atTarget, 'Target') : null,
    },
    // To the contract's expiration; a stock Trade's axis ends at its last session.
    axis: contract && first ? { slots: weekdaysThrough(first, contract.expiration), startLabel: shortDate(first), endLabel: `Expires ${shortDate(contract.expiration)}` } : { slots: last ? weekdaysThrough(first!, last) : 0, ...(first && { startLabel: shortDate(first) }) },
  };
}
