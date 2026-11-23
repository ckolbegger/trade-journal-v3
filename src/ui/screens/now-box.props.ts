import type { DailyTradeReview, MeterReading } from '../../app/types.ts';
import { decimalMoney, shortDate } from '../format.ts';
import { calculation, signed } from '../figures.ts';
import { payoffSummary } from './payoff-text.ts';
import { money, plural, ratioToOne, rMultiple } from '../format.ts';
import { NO_MARK } from '../cockpit/replay/readout.props.ts';
import { meterProps } from '../cockpit/meter/meter.props.ts';
import type { MeterProps } from '../cockpit/meter/meter.types.ts';
import { Rational } from '../../domain/values/index.ts';
import { conditionDirection } from './option-words.ts';

type Evaluation = NonNullable<DailyTradeReview['evaluation']>;

export interface MarkPart {
  readonly label: string;
  // The Mark's price, or "No Mark" where the session has none (W61).
  readonly price: string;
  // The change since the Instrument's previous Mark, in dollars.
  readonly change?: string;
}

// The words under one arrow (W82, W83, W86): the move in price to the line, then what it does to the Trade; past the line, how far and what it has cost.
export interface Caption {
  readonly line: 'Stop' | 'Target';
  readonly tone: 'loss' | 'profit';
  readonly text: string;
  // Past its line: the caption stands in bold (W86).
  readonly past: boolean;
}

// A figure of the "Now" box below the drawing: its label, its finished value or the words for why it has none, and the canonical term behind a renamed label.
export interface NowRow {
  readonly label: string;
  readonly value: string;
  readonly term?: string;
  // The Plan's weight for an extreme (decision 6): a Remote one is smaller and grey.
  readonly weight?: 'Main' | 'Remote';
}

export interface NowBoxProps {
  readonly heading: string;
  readonly marks: readonly MarkPart[];
  // The shared meter's props for the session: the drawing's bar. Absent where a rail cannot be read.
  readonly meter?: MeterProps;
  // One under each arrow, Stop first; none while the standing has no reading.
  readonly captions: readonly Caption[];
  readonly rows: readonly NowRow[];
  // An option's expiration figures, held behind "More figures" (W92); absent for a Trade with none.
  readonly more?: string;
}

const ZERO = Rational.of(0n);
// A stock Trade is Long Stock, whose Stop is below and Target above.
const STOCK_SIDE = { Stop: 'below', Target: 'above' } as const;
// A sign flipped for the words ("lose another −$1,314.00"): the finished figure's magnitude, shown as a loss. Nothing is worked on.
const negated = (value: Rational): Rational => Rational.of(-value.numerator, value.denominator);


// "$4,510.00 more · 7.52R", the words for no bound, or the words for why there is no figure.
function moreWords(result: Evaluation['maximumIncrementalReward'], unbounded: string, inR: string, timeZone: string | undefined): string {
  if (result.kind === 'Unbounded') return unbounded;
  return calculation(result, (amount) => `${money(amount)} more${inR}`, timeZone);
}

// Worst case and Max reward (W87): what could still be lost or gained from here, with the words for no bound.
function extremeRows(evaluation: Evaluation, timeZone: string | undefined): readonly NowRow[] {
  const weight = evaluation.extremes ?? 'Main';
  const { worstCaseOngoingRisk: worst, worstCaseOngoingRiskInPlanR: worstR, maximumIncrementalReward: best } = evaluation;
  const inR = worstR.kind === 'Value' ? ` · ${rMultiple(worstR.value)}` : '';
  return [
    { label: 'Worst case', value: moreWords(worst, 'No limit', inR, timeZone), term: 'Worst-Case Ongoing Risk', weight },
    { label: 'Max reward', value: moreWords(best, 'No cap', '', timeZone), term: 'Maximum Incremental Reward', weight },
  ];
}

type Condition = Evaluation['conditions'][number];
// A condition's reading: its own, or its Underlying's while only the contract's Mark is missing (A110).
const readingOf = (c: Condition) => (c.result.kind === 'Value' ? c.result.value : c.underlyingReading);
// The condition's status says the line is crossed, whatever the dollars say (F2, as the replay reads it).
const isCrossed = (c: Condition): boolean => {
  const reading = readingOf(c);
  return reading !== undefined && reading.status !== 'Active';
};

// Reward to risk (W88, U8): the ratio now and the Plan's own, with no odds; inside the lines only, since past one there is no ratio to show (W56).
function ratioRow(evaluation: Evaluation, timeZone: string | undefined): readonly NowRow[] {
  const { standing, rewardRiskNow: now, planBaseline } = evaluation;
  if ((standing?.kind === 'Value' && standing.value.zone !== 'Between') || evaluation.conditions.some(isCrossed)) return [];
  const plan = planBaseline.kind === 'Value' ? ` · Plan ${ratioToOne(planBaseline.value.rewardRiskRatio)}` : '';
  return [{ label: 'Reward to risk', value: `${calculation(now, ratioToOne, timeZone)}${plan}` }];
}

// "Realized, open" (W89, decision 120): what a sale banked and what the rest still shows, once a sale happened. The replay's Position Changes say so
// (a sale that nets to exactly zero banks nothing yet happened); a figure the replay does not show, such as a sale in the session not yet ended, still counts.
function realizedRow(trade: DailyTradeReview, evaluation: Evaluation, date: string, timeZone: string | undefined): readonly NowRow[] {
  const { realizedToDate: realized, remainingOpenPnl: open } = evaluation;
  const sold = trade.replay?.sessions.some((s) => s.date <= date && s.markers?.some((m) => m.effect === 'Reduced' || m.effect === 'Closed')) ?? false;
  if (realized.kind !== 'Value' || (!sold && realized.value.compare(ZERO) === 0)) return [];
  return [{ label: 'Realized, open', value: `${signed(money)(realized.value)} · ${calculation(open, signed(money), timeZone)}` }];
}

// "with DALE at $53.20 then: −$2,016.00", or the words for why the Underlying's Mark gives none; nothing where there is no contract to value.
function worthWords(underlying: string, atClose: Evaluation['expirationValueAtUnderlyingClose'], timeZone: string | undefined): readonly string[] {
  if (atClose.kind === 'Value') return [`with ${underlying} at ${money(atClose.value.underlyingPrice)} then: ${signed(money)(atClose.value.value)}`];
  if (atClose.kind === 'NotApplicable') return [];
  return [`with ${underlying} then: ${calculation(atClose, money, timeZone)}`];
}

// The Expiration row (W90): the date, the sessions left or "expired", and what the Position is worth at expiration with the Underlying where its latest Mark has it.
function expirationRow(trade: DailyTradeReview, evaluation: Evaluation, timeZone: string | undefined): readonly NowRow[] {
  const { expiration } = trade;
  if (!expiration) return [];
  const date = shortDate(expiration.date);
  if (trade.settlement.length > 0) return [{ label: 'Expiration', value: `${date} · expired` }];
  const { expirationValueAtUnderlyingClose: atClose } = evaluation;
  const sessions = expiration.sessionsLeft === undefined ? [] : [plural(expiration.sessionsLeft, 'session', 'sessions')];
  const worth = worthWords(trade.underlying, atClose, timeZone);
  return [{ label: 'Expiration', value: [date, ...sessions, ...worth].join(' · ') }];
}

// The caption under each arrow, from the finished figures: the condition's price distance and the Trade's dollars at the line. An option Trade's
// sides come from its summary; a stock Trade is Long Stock, whose Stop is below and Target above.
function captionsOf(trade: DailyTradeReview, evaluation: Evaluation): readonly Caption[] {
  const standing = evaluation.standing?.kind === 'Value' ? evaluation.standing.value : undefined;
  if (!standing) return [];
  const { summary } = trade;
  const losing = evaluation.currentMarkedPnl.kind === 'Value' && evaluation.currentMarkedPnl.value.compare(ZERO) < 0;
  const option = summary?.kind === 'Option' ? { right: summary.right, side: summary.direction } : undefined;
  const captionOf = (line: 'Stop' | 'Target'): Caption | undefined => {
    // The line's headline condition: the one that is crossed when a Plan has several, else the first (as the replay's F2 reads them). While only the
    // contract's Mark is missing an option's Underlying condition still reads (A110).
    const ofLine = evaluation.conditions.filter((c) => c.role === line && readingOf(c) !== undefined);
    const condition = ofLine.find((c) => isCrossed(c)) ?? ofLine[0];
    const trigger = condition && readingOf(condition)?.trigger;
    // The side of its price a line is on matters only for a move to it, which needs a condition.
    const below = (option && condition ? conditionDirection(line, condition.kind, option) : STOCK_SIDE[line]) === 'below';
    const tone = line === 'Stop' ? 'loss' : 'profit';
    const past = standing.zone === (line === 'Stop' ? 'PastStop' : 'PastTarget') ? standing.pastBy : undefined;
    const soFar = past && `(${line === 'Stop' ? signed(money)(negated(past.dollars)) : signed(money)(past.dollars)} so far)`;
    // A crossed condition says the line is passed whatever the dollars say (F2): the dollars so far are said only where the result has passed it.
    if (past?.crossed || (condition && isCrossed(condition))) return { line, tone, past: true, text: `${trigger?.beyond ? `${money(trigger.beyond)} past` : 'Past'} ${line}${soFar ? ` ${soFar}` : ''}` };
    const distance = trigger?.distance;
    const moved = distance ? `${below ? money(negated(distance)) : signed(money)(distance)} to ` : 'To ';
    // Only the planned amount is passed (B7): the move to the line stands, with what the amount has cost so far.
    if (soFar) return { line, tone, past: false, text: `${moved}${line} ${soFar}` };
    if (line === 'Stop') {
      const { ongoingRiskToStop: risk } = evaluation;
      return risk.kind === 'Value' ? { line, tone, past: false, text: `${moved}Stop (lose ${losing ? 'another ' : ''}${money(negated(risk.value))})` } : undefined;
    }
    const { incrementalRewardToTarget: reward } = evaluation;
    return reward.kind === 'Value' ? { line, tone, past: false, text: `${moved}Target (gain ${money(reward.value)})` } : undefined;
  };
  return [captionOf('Stop'), captionOf('Target')].filter((caption): caption is Caption => caption !== undefined);
}

// The box reads one session. Before the Review Date's Marks are saved it is the dated close the card carries (W92), else the Review Date's own.
function sessionOf(trade: DailyTradeReview, walked: MeterReading | undefined): { readonly date: string; readonly dated: boolean; readonly evaluation: Evaluation; readonly reading: MeterReading | undefined } | undefined {
  const { evaluation, datedLastClose } = trade;
  if (!evaluation) return undefined;
  const dated = datedLastClose !== undefined && evaluation.currentMarkedPnl.kind !== 'Value';
  return dated
    ? { date: datedLastClose.tradingDate, dated, evaluation: datedLastClose.evaluation, reading: datedLastClose.meter }
    : { date: evaluation.observation.tradingDate, dated, evaluation, reading: walked };
}

// The Marks line (U3): each Instrument's Mark in the session, with its change since the Instrument's previous Mark.
function marksOf(trade: DailyTradeReview, date: string): readonly MarkPart[] {
  const session = trade.replay?.sessions.find((s) => s.date === date);
  return (session?.marks ?? []).map(({ instrument, resolution, change }) => ({
    label: instrument.kind === 'Option' ? instrument.right : instrument.symbol,
    price: resolution.kind === 'Available' ? decimalMoney(resolution.mark.price) : NO_MARK.text,
    ...(change && { change: signed(money)(change.dollars) }),
  }));
}

// The "Now" box's props, from a getTrade result: finished figures selected and worded; nothing is worked out here (ADR 0001).
export function nowBoxOf(trade: DailyTradeReview, meter: MeterReading | undefined, timeZone: string | undefined): NowBoxProps | undefined {
  const session = sessionOf(trade, meter);
  if (!session) return undefined;
  const bar = session.reading && meterProps(session.reading, 'detail', timeZone);
  return {
    heading: session.dated ? `At the ${shortDate(session.date)} Marks` : `Now · ${shortDate(session.date)}`,
    marks: marksOf(trade, session.date),
    ...(bar && { meter: bar }),
    captions: captionsOf(trade, session.evaluation),
    ...(trade.payoff?.current.kind === 'Value' && { more: payoffSummary(trade.payoff.current.value) }),
    rows: [...extremeRows(session.evaluation, timeZone), ...ratioRow(session.evaluation, timeZone), ...realizedRow(trade, session.evaluation, session.date, timeZone), ...expirationRow(trade, session.evaluation, timeZone)],
  };
}
