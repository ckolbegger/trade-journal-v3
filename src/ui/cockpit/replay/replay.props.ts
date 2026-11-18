import type { TradeReplayView } from '../../../app/types.ts';
import type { CalculationResult } from '../../../domain/calculation-result/index.ts';
import { instrumentKey, type Instrument, type OptionInstrument } from '../../../domain/instrument/index.ts';
import { formatDecimal, Rational } from '../../../domain/values/index.ts';
import { calculation, signed } from '../../figures.ts';
import { decimalMoney, decimalUnderlyingPrice, money, quantity, rMultiple, ratio, shortDate, summaryStrike, underlyingPrice } from '../../format.ts';
import { conditionDirection } from '../../screens/option-words.ts';
import type { LabelledFigure, PlotMarker, PlotSession, ReadoutGroup, ReadoutValue, ReplayFrameSession, ReplayPlotProps, ReplayProps, ReplayTone, TableRow } from './replay.types.ts';

// The adapter selects and formats finished values from the view; it works out no figure (ADR 0001, A256).

// The view a screen passes to the drawer or the card, so only this adapter names the view's type (A216).
export type ReplayView = TradeReplayView;
type ViewSession = TradeReplayView['sessions'][number];

// The part of `ReplayFrameSession` this module builds: the headline, how it is going, and what is at stake (W36 to W38).
export type SessionWords = Pick<ReplayFrameSession, 'headline' | 'howItIsGoing' | 'stake'>;

const ZERO = Rational.of(0n);
const HUNDRED = Rational.of(100n);

const toneOf = (pnl: Rational): ReplayTone => {
  const sign = pnl.compare(ZERO);
  if (sign > 0) return 'Profit';
  if (sign < 0) return 'Loss';
  return 'Even';
};

// A fraction as a whole percent: formatting a finished share, not working one out.
const percent = (share: Rational): string => `${formatDecimal(share.mul(HUNDRED), 0)}%`;

function headlineOf(session: ViewSession): SessionWords['headline'] {
  const { tradePnl } = session;
  if (tradePnl.kind !== 'Value') return { reason: calculation(tradePnl, money), tone: 'None' };
  const inR = session.figures?.currentMarkedPnlInPlanR;
  const figure = inR?.kind === 'Value' ? `${signed(money)(tradePnl.value)} · ${rMultiple(inR.value)}` : signed(money)(tradePnl.value);
  return { figure, tone: toneOf(tradePnl.value) };
}

// "Past the Stop's planned amount by $9.00, though DALE is still above $54.00.": the dollars are passed, the condition's price
// is not. The side the Underlying is still on is the opposite of the side its trigger lies on (conditionDirection).
function plannedAmountWords(role: 'Stop' | 'Target', dollars: Rational, session: ViewSession): string {
  const amount = `Past the ${role}'s planned amount by ${money(dollars)}`;
  const condition = session.figures?.conditions.find((c) => c.role === role && c.kind === 'UnderlyingPrice');
  const position = session.positions[0];
  if (!condition || !position) return `${amount}.`;
  const { instrument } = position;
  const leg = instrument.kind === 'Option' ? { right: instrument.right, side: position.quantity.compare(ZERO) < 0 ? 'Short' : 'Long' } as const : { right: 'Call', side: 'Long' } as const;
  const side = conditionDirection(role, 'UnderlyingPrice', leg) === 'below' ? 'above' : 'below';
  return `${amount}, though ${instrument.symbol} is still ${side} ${decimalMoney(condition.boundary)}.`;
}

type SessionCondition = NonNullable<ViewSession['figures']>['conditions'][number];

// F2: the session's own condition status (T9.4) says whether a line is crossed, whatever the dollars say: the condition's finished reading,
// or its Underlying reading while only the contract's Mark is missing (A110). The role's crossing is Breached for a Stop, Reached for a Target.
function crossedCondition(session: ViewSession, role: 'Stop' | 'Target'): { readonly condition: SessionCondition; readonly beyond: Rational | null } | undefined {
  for (const condition of session.figures?.conditions ?? []) {
    const reading = condition.result.kind === 'Value' ? condition.result.value : condition.underlyingReading;
    if (condition.role === role && reading && reading.status !== 'Active') return { condition, beyond: reading.trigger?.beyond ?? null };
  }
  return undefined;
}

// "Stop breached: DALE $0.30 past $54.00.": the Underlying, how far past the condition's price it is, and the price.
function stopBreachedWords(crossed: NonNullable<ReturnType<typeof crossedCondition>>, session: ViewSession): string {
  const symbol = session.positions[0]?.instrument.symbol;
  if (!crossed.beyond || !symbol) return 'Stop breached.';
  return `Stop breached: ${symbol} ${money(crossed.beyond)} past ${decimalMoney(crossed.condition.boundary)}.`;
}

function howItIsGoingOf(session: ViewSession): string {
  const { tradePnl, final } = session;
  if (final) {
    const ending = final.kind === 'Sold' ? 'sold out' : `the ${final.contract.right.toLowerCase()} expired`;
    return `Final result: ${ending} ${shortDate(session.date)}.`;
  }
  const standing = session.figures?.standing;
  if (tradePnl.kind !== 'Value' || standing?.kind !== 'Value') return 'No Mark.';
  const { zone, pastBy, share } = standing.value;
  const stopCrossed = crossedCondition(session, 'Stop');
  if (zone === 'PastStop' && pastBy?.crossed) return `Past the Stop by ${money(pastBy.dollars)} (${rMultiple(pastBy.r)}).`;
  if (stopCrossed) return stopBreachedWords(stopCrossed, session);
  if (zone === 'PastStop' && pastBy) return plannedAmountWords('Stop', pastBy.dollars, session);
  if (zone !== 'PastTarget' && crossedCondition(session, 'Target')) return 'Target reached.';
  if (zone === 'PastTarget' && pastBy) {
    if (!pastBy.crossed) return plannedAmountWords('Target', pastBy.dollars, session);
    return pastBy.dollars.compare(ZERO) === 0 ? 'Target reached.' : `Target reached, ${money(pastBy.dollars)} past it.`;
  }
  if (share === undefined) return '';
  if (tradePnl.value.compare(ZERO) > 0) return `Ahead: ${percent(share)} of the way to the Target.`;
  return `Behind: ${percent(share)} of the way to the Stop.`;
}

// "Even at the Stop this Trade would end $316.00 ahead.", said only when the result at the Stop is above break-even.
function evenAtStopWords(session: ViewSession): string {
  const atStop = session.figures?.outcomes?.atStop;
  return atStop?.kind === 'Value' && atStop.value.compare(ZERO) > 0 ? ` Even at the Stop this Trade would end ${money(atStop.value)} ahead.` : '';
}

// A final session: nothing is at risk, and what was realized in the sessions before it was banked before the end.
function finalStakeWords(view: TradeReplayView, index: number): string {
  const banked = view.sessions[index - 1]?.realizedPnl;
  const bankedWords = banked && banked.compare(ZERO) !== 0 ? ` ${signed(money)(banked)} of the result was banked before the end.` : '';
  return `Nothing is at risk and nothing is left to gain.${bankedWords}`;
}

function stakeOf(view: TradeReplayView, index: number, session: ViewSession): string | null {
  if (session.final) return finalStakeWords(view, index);
  const sentence = stakeSentence(view, session);
  return sentence === null ? null : `${sentence}${evenAtStopWords(session)}`;
}

function stakeSentence(view: TradeReplayView, session: ViewSession): string | null {
  const figures = session.figures;
  const { standing, ongoingRiskToStop: risk, incrementalRewardToTarget: reward, rewardRiskNow } = figures ?? {};
  if (standing?.kind !== 'Value') return null;
  if (standing.value.zone === 'PastStop') {
    const worst = figures?.worstCaseOngoingRisk;
    const parts = [worst?.kind === 'Value' && `Worst case ${money(worst.value)} more`, reward?.kind === 'Value' && `${money(reward.value)} back up to the Target`].filter(Boolean);
    return parts.length === 0 ? null : `From here: ${parts.join(' · ')}.`;
  }
  if (risk?.kind !== 'Value' || reward?.kind !== 'Value') return null;
  if (standing.value.zone === 'PastTarget') {
    const { openProfitAtRisk } = standing.value;
    const max = figures?.maximumIncrementalReward;
    let cap = '';
    if (max?.kind === 'Unbounded') cap = ' · no cap above';
    else if (max?.kind === 'Value') cap = ` · at most ${money(max.value)} more`;
    const open = openProfitAtRisk ? ` (${money(openProfitAtRisk)} of it open profit)` : '';
    return `From here: ${money(risk.value)} at risk back to the Stop${open}${cap}.`;
  }
  const plan = view.planColumn ? ` (the Plan was ${ratio(view.planColumn.rewardRisk)} to 1)` : '';
  const rr = rewardRiskNow?.kind === 'Value' ? ` · ${ratio(rewardRiskNow.value)} to 1${plan}` : '';
  return `From here: ${money(risk.value)} at risk to the Stop · ${money(reward.value)} more to the Target${rr}.`;
}

export function sessionWords(view: TradeReplayView, index: number): SessionWords {
  const session = view.sessions[index];
  if (!session) throw new Error(`No session at ${index}`);
  return { headline: headlineOf(session), howItIsGoing: howItIsGoingOf(session), stake: stakeOf(view, index, session) };
}

// What a screen adds to the view's own words: the plot component (Corridor in the app, a double in a test), the session to open on, and
// the call that keeps the slider's session.
export interface ReplayOptions {
  readonly Plot: ReplayProps['Plot'];
  readonly initialSession?: string;
  readonly onSessionChange?: (date: string) => void;
}

// The Underlying and the contract the Trade holds: the view lists the Underlying beside the contract, so a stock Trade has no contract.
function instrumentsOf(view: TradeReplayView): { readonly underlying: string; readonly contract?: OptionInstrument } {
  const contract = view.instruments.find((i): i is OptionInstrument => i.kind === 'Option');
  const stock = view.instruments.find((i) => i.kind === 'Stock');
  return { underlying: stock?.symbol ?? contract?.root ?? '', ...(contract && { contract }) };
}

const signedMoney = signed(money);
// A sign taken off for the words ("down $150.00"): the figure is only shown without its sign, not worked on.
const unsigned = (value: Rational): Rational => (value.numerator < 0n ? Rational.of(-value.numerator, value.denominator) : value);
const figure = (text: string): ReadoutValue => ({ kind: 'Figure', text });

// "up $190.00 since Tue Nov 10": a change the view measured from an earlier session, in the figure's own format.
function changeWords(change: ViewSession['change'] | undefined, format: (value: Rational) => string = money): string | undefined {
  if (!change) return undefined;
  const sign = change.dollars.compare(ZERO);
  return `${sign < 0 ? 'down' : 'up'} ${format(unsigned(change.dollars))} since ${shortDate(change.since)}`;
}

// A Calculation Result as a readout value: its finished figure (with the R beside it when given), or the words for why it has none.
function valueOf(result: CalculationResult<Rational> | undefined, format: (value: Rational) => string, inR?: CalculationResult<Rational>): ReadoutValue {
  if (!result) return { kind: 'NotApplicable', text: '' };
  if (result.kind === 'Value') return figure(inR?.kind === 'Value' ? `${format(result.value)} · ${rMultiple(inR.value)}` : format(result.value));
  return { kind: result.kind, text: calculation(result, format) };
}

type Row = ReadoutGroup['rows'][number];
const row = (label: string, value: ReadoutValue, change?: string): Row => ({ label, value, ...(change !== undefined && { change }) });

// How it is going (W43): the Trade P&L as the headline words it.
function goingGroup(session: ViewSession): ReadoutGroup {
  const { figure: text, reason } = headlineOf(session);
  const rows = [row('Trade P&L', text !== undefined ? figure(text) : { kind: 'Unavailable', text: reason ?? '' }, changeWords(session.change))];
  if (session.realizedPnl.compare(ZERO) !== 0) rows.push(row('Banked', figure(signedMoney(session.realizedPnl))));
  return { title: session.final ? 'Final result' : 'How it is going', rows };
}

// At stake from here (W43): each row is a figure the view finished; the Plan's reward to risk stands beside the session's.
function stakeGroup(view: TradeReplayView, session: ViewSession): ReadoutGroup | undefined {
  const f = session.figures;
  if (!f) return undefined;
  const ratioWords = (v: Rational) => `${ratio(v)} to 1`;
  // Past a line the overrun stands in place of the risk or the reward, which is zero there, and the ratio says so.
  const standing = f.standing?.kind === 'Value' ? f.standing.value : undefined;
  const pastBy = standing?.pastBy;
  const overrun = (past: boolean) => (past && pastBy ? figure(`${money(pastBy.dollars)} · ${rMultiple(pastBy.r)}`) : undefined);
  const stopOverrun = overrun(standing?.zone === 'PastStop');
  const targetOverrun = overrun(standing?.zone === 'PastTarget');
  // Past a line by its planned amount with the condition not triggered is no breach (W37): shorter words say so.
  const triggered = pastBy?.crossed ?? true;
  // The condition status says the same as the headline (F2): a crossed condition ends the ratio whatever the dollars.
  const stopCrossed = crossedCondition(session, 'Stop') !== undefined;
  const targetCrossed = crossedCondition(session, 'Target') !== undefined;
  const stopBreached = triggered || stopCrossed;
  const targetReached = triggered || targetCrossed;
  let ending: string | undefined;
  if (stopOverrun) ending = stopBreached ? 'Stop breached' : 'Not triggered';
  else if (targetOverrun) ending = targetReached ? 'Target reached' : 'Not triggered';
  else if (stopCrossed) ending = 'Stop breached';
  else if (targetCrossed) ending = 'Target reached';
  const stopOverrunLabel = triggered ? 'Stop Overrun' : "Past Stop's amount";
  const targetOverrunLabel = triggered ? 'Target Overrun' : "Past Target's amount";
  const rows = [
    stopOverrun ? row(stopOverrunLabel, stopOverrun) : row('Risk to stop', valueOf(f.ongoingRiskToStop, money, f.ongoingRiskToStopInPlanR), changeWords(session.riskChange)),
    row('Result at the Stop', valueOf(f.outcomes?.atStop, signedMoney)),
    row('Worst case', valueOf(f.worstCaseOngoingRisk, money, f.worstCaseOngoingRiskInPlanR)),
    targetOverrun ? row(targetOverrunLabel, targetOverrun) : row('Reward to target', valueOf(f.incrementalRewardToTarget, money, f.incrementalRewardToTargetInPlanR), changeWords(session.rewardChange)),
    row('Result at the Target', valueOf(f.outcomes?.atTarget, signedMoney)),
    row('Max reward', f.maximumIncrementalReward.kind === 'Unbounded' ? { kind: 'Unbounded', text: 'No cap above' } : valueOf(f.maximumIncrementalReward, money, f.maximumIncrementalRewardInPlanR)),
    ending ? row('Reward to risk', figure(ending)) : row('Reward to risk', valueOf(f.rewardRiskNow, ratioWords), view.planColumn ? `(Plan ${ratioWords(view.planColumn.rewardRisk)})` : undefined),
  ];
  return { title: 'At stake from here, whole Position', rows };
}

// "Call Mark" for a contract, "BREN Mark" for an Underlying or a stock.
const markLabel = (instrument: Instrument): string => `${instrument.kind === 'Option' ? instrument.right : instrument.symbol} Mark`;

// Marks (W43): each Instrument's Mark in the session, "No Mark" where it has none. An Underlying's price has no "$" on an option Trade (C3).
function marksGroup(view: TradeReplayView, session: ViewSession): ReadoutGroup {
  const optionTrade = view.instruments.some((i) => i.kind === 'Option');
  return {
    title: 'Marks',
    rows: view.instruments.map((instrument) => {
      const found = session.marks.find((m) => instrumentKey(m.instrument) === instrumentKey(instrument));
      if (found?.resolution.kind !== 'Available') return row(markLabel(instrument), { kind: 'Unavailable', text: 'No Mark' });
      const bare = instrument.kind === 'Stock' && optionTrade;
      const { price } = found.resolution.mark;
      return row(markLabel(instrument), figure(bare ? decimalUnderlyingPrice(price) : decimalMoney(price)), changeWords(found.change, bare ? underlyingPrice : money));
    }),
  };
}

// "4 contracts", "short 2 contracts", "100 shares".
function heldWords(session: ViewSession): string {
  const unit = session.positions[0]?.instrument.kind === 'Option' ? 'contract' : 'share';
  const held = unsigned(session.heldQuantity);
  return `${session.heldQuantity.numerator < 0n ? 'short ' : ''}${quantity(held)} ${unit}${held.equals(Rational.of(1n)) ? '' : 's'}`;
}

// The Plan (W43): the results at the Stop and at the Target as planned, which the charts draw in the Plan column. The Plan's reward to risk
// stands in the session's own Reward to risk row.
function planGroup(view: TradeReplayView): ReadoutGroup | undefined {
  const plan = view.planColumn;
  if (!plan) return undefined;
  return { title: 'The Plan', rows: [row('At the Stop', figure(signedMoney(plan.atStop))), row('At the Target', figure(signedMoney(plan.atTarget)))] };
}

type Marker = NonNullable<ViewSession['markers']>[number];
const FILL_VERBS = { Buy: 'Bought', Sell: 'Sold', Expire: 'Expired' } as const;

// W41: "Sold 2 at $4.00", "Bought 100 at $50.00", "Expired"; each fill of a Position Change in turn.
const markerWords = (marker: Marker): string =>
  marker.fills.map((fill) => (fill.price ? `${FILL_VERBS[fill.action]} ${quantity(fill.quantity)} at ${money(fill.price)}` : FILL_VERBS[fill.action])).join(', ');

// The Position (W43): what is held, and each Execution of the session.
function positionGroup(session: ViewSession): ReadoutGroup {
  const held = session.heldQuantity.compare(ZERO) !== 0 ? [row('Held', figure(heldWords(session)))] : [];
  return { title: 'Position', rows: [...held, ...(session.markers ?? []).map((marker) => row(`Execution, ${shortDate(session.date)}`, figure(markerWords(marker))))] };
}

function readoutOf(view: TradeReplayView, session: ViewSession): ReadoutGroup[] {
  // A final session has nothing at stake, and a session without a Mark has no figures to stake; each is said once, in the words above.
  const staked = !session.final && session.tradePnl.kind === 'Value' ? stakeGroup(view, session) : undefined;
  const groups = [goingGroup(session), staked, marksGroup(view, session), positionGroup(session), planGroup(view)];
  return groups.filter((group): group is ReadoutGroup => group !== undefined && group.rows.length > 0);
}

// A table cell (W45): the figure alone, or "No Mark" for a session without one; never a value carried over from another session.
const cellOf = (result: CalculationResult<Rational> | undefined, format: (value: Rational) => string, marked: boolean): string => (marked ? (result ? calculation(result, format) : '') : 'No Mark');

// The trigger of a session's Stop or Target; an Underlying's price has no "$" on an option Trade (C3).
function triggerOf(view: TradeReplayView, session: ViewSession, role: 'Stop' | 'Target'): string {
  const condition = session.figures?.conditions.find((c) => c.role === role);
  if (!condition) return '';
  const bare = condition.kind === 'UnderlyingPrice' && view.instruments.some((i) => i.kind === 'Option');
  return bare ? decimalUnderlyingPrice(condition.boundary) : decimalMoney(condition.boundary);
}

function tableRowOf(view: TradeReplayView, session: ViewSession, marks: ReadoutGroup): TableRow {
  const f = session.figures;
  const marked = session.tradePnl.kind === 'Value';
  return {
    dateLabel: shortDate(session.date),
    cells: [
      ...marks.rows.map((r) => r.value.text),
      cellOf(session.tradePnl, signedMoney, marked),
      session.realizedPnl.compare(ZERO) !== 0 ? signedMoney(session.realizedPnl) : '',
      cellOf(f?.ongoingRiskToStop, money, marked),
      cellOf(f?.incrementalRewardToTarget, money, marked),
      cellOf(f?.outcomes?.atStop, signedMoney, marked),
      cellOf(f?.outcomes?.atTarget, signedMoney, marked),
      triggerOf(view, session, 'Stop'),
      triggerOf(view, session, 'Target'),
    ],
    events: (session.markers ?? []).map(markerWords),
  };
}

// A finished figure turned into the number the plot places: drawing, not calculating (A256).
const asNumber = (value: Rational): number => Number(value.numerator) / Number(value.denominator);
// The chart's figures drop the cents only where there are none ("Stop −$324"); a figure with cents keeps them.
const chartMoney = (value: Rational): string => money(value).replace(/\.00$/, '');
const chartSigned = (value: Rational): string => signedMoney(value).replace(/\.00$/, '');

const labelledValue = (value: Rational, name: string): LabelledFigure => ({ value: asNumber(value), label: `${name} ${chartSigned(value)}` });
const labelled = (result: CalculationResult<Rational> | undefined, name: string): LabelledFigure | null => (result?.kind === 'Value' ? labelledValue(result.value, name) : null);

// "Sold 2" on a phone: the fills without their prices; an Expiration has no shorter form.
const markerShortWords = (marker: Marker): string | undefined =>
  marker.fills.every((fill) => fill.price) ? marker.fills.map((fill) => `${FILL_VERBS[fill.action]} ${quantity(fill.quantity)}`).join(', ') : undefined;

function plotMarkerOf(marker: Marker): PlotMarker {
  const short = markerShortWords(marker);
  return { id: marker.id, kind: marker.kind, effect: marker.effect, label: markerWords(marker), ...(short !== undefined && { shortLabel: short }), isEntry: marker.effect === 'Opened' };
}

function plotSessionOf(view: TradeReplayView, index: number): PlotSession {
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
  return {
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
    ...(past && { past: { line: past.line, label: `${chartMoney(past.dollars)} past the ${past.line}` } }),
    // What is at stake from here, tagged at the slider's session: the risk unless the Stop is breached, the reward unless the Target is reached.
    ...(risk?.kind === 'Value' && (zone !== 'PastStop' || reward?.kind === 'Value') && {
      stake: {
        ...(zone !== 'PastStop' && { riskLabel: `Risk to stop ${chartMoney(risk.value)}`, riskShortLabel: `Risk ${chartMoney(risk.value)}` }),
        ...(reward?.kind === 'Value' && zone !== 'PastTarget' && { rewardLabel: `Reward to target ${chartMoney(reward.value)}`, rewardShortLabel: `Reward ${chartMoney(reward.value)}` }),
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

function plotBaseOf(view: TradeReplayView): ReplayProps['plotBase'] {
  const { underlying, contract } = instrumentsOf(view);
  const plan = view.planColumn;
  const first = view.sessions[0]?.date;
  const last = view.sessions.at(-1)?.date;
  // A stock Trade's entry on its own price: what the Position Change that opened it paid per share. An option's Underlying has none.
  const entry = contract ? undefined : view.sessions.flatMap((s) => s.markers ?? []).find((m) => m.effect === 'Opened')?.fills[0]?.price;
  return {
    priceTitle: `${underlying} price · one Mark per session`,
    priceShortTitle: `${underlying} price`,
    pnlTitle: 'Trade P&L · dollars for the whole Position, between the result at the Stop and at the Target',
    pnlShortTitle: 'Trade P&L',
    accessibleName: `${underlying} Marks and Trade P&L by session`,
    describedBy: `replay-table-${view.tradeId}`,
    anchors: {
      ...(entry !== undefined && { entryPrice: asNumber(entry) }),
      priceLines: priceLinesOf(view, contract),
      planAtStop: plan ? labelledValue(plan.atStop, 'Stop') : null,
      planAtTarget: plan ? labelledValue(plan.atTarget, 'Target') : null,
    },
    // To the contract's expiration; a stock Trade's axis ends at its last session.
    axis: contract && first ? { slots: weekdaysThrough(first, contract.expiration), endLabel: shortDate(contract.expiration) } : { slots: last ? weekdaysThrough(first!, last) : 0, endLabel: last ? shortDate(last) : '' },
  };
}

// What the hover and focus show (a short card): the date, each Mark, each Execution and the Trade P&L.
function hoverOf(session: ViewSession, marks: ReadoutGroup, pnl: string | undefined): string[] {
  return [shortDate(session.date), ...marks.rows.map((r) => `${r.label}: ${r.value.text}`), ...(session.markers ?? []).map(markerWords), `Trade P&L: ${pnl ?? 'No Mark'}`];
}

function frameSessionOf(view: TradeReplayView, index: number): ReplayFrameSession {
  const session = view.sessions[index]!;
  const dateLabel = shortDate(session.date);
  const words = sessionWords(view, index);
  const marks = marksGroup(view, session);
  return {
    date: session.date,
    dateLabel,
    sliderValue: `${dateLabel} · ${index + 1} of ${view.sessions.length}`,
    ...words,
    isFinal: session.final !== undefined,
    readout: readoutOf(view, session),
    tableRow: tableRowOf(view, session, marks),
    plot: plotSessionOf(view, index),
    hover: hoverOf(session, marks, words.headline.figure),
    hasMarker: (session.markers ?? []).length > 0,
  };
}

// A255: the whole view as the frame's props, from finished values only; no figure is worked out here (ADR 0001, A256).
export function replayProps(view: TradeReplayView, { Plot, initialSession, onSessionChange }: ReplayOptions): ReplayProps {
  const { underlying, contract } = instrumentsOf(view);
  return {
    tradeKey: view.tradeId,
    sessions: view.sessions.map((_, index) => frameSessionOf(view, index)),
    ...(initialSession !== undefined && { initialSession }),
    sliderLabel: 'Session',
    previousLabel: 'Previous session',
    nextLabel: 'Next session',
    tableTitle: 'Session by session',
    tableColumns: [`${underlying} Mark`, ...(contract ? [`${contract.right} Mark`] : []), 'Trade P&L', 'Banked', 'Risk to stop', 'Reward to target', 'Result at the Stop', 'Result at the Target', 'Stop', 'Target'],
    plotBase: plotBaseOf(view),
    Plot,
    ...(onSessionChange && { onSessionChange }),
  };
}
