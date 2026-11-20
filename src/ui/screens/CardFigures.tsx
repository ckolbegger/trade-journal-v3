import { useId, type ReactNode } from 'react';
import type { DailyTradeReview } from '../../app/types.ts';
import { instrumentLabel } from '../calculation-words.ts';
import { Rational } from '../../domain/values/index.ts';
import { pastLineWords, ratioWordsOf } from '../cockpit/replay/stake-words.props.ts';
import { decimalMoney, decimalUnderlyingPrice, money, ratioToOne, shortDate } from '../format.ts';
import { useRuntime } from '../runtime.tsx';
import { calculation,dollarsAndR, pnlText } from '../figures.ts';
import { conditionDirection } from './option-words.ts';
import { payoffSummary, valueAtCloseTerm, valueAtCloseText } from './payoff-text.ts';

type Evaluation = NonNullable<DailyTradeReview['evaluation']>;
type ExtremesWeight = NonNullable<Evaluation['extremes']>;

export interface CardFiguresProps {
  readonly trade: DailyTradeReview;
}

// `title` is the canonical term behind a renamed label: hover text and accessible description, nothing more to see (A287).
// `weight` is the Plan's weight for an extreme (decision 6): a Remote one is smaller and grey, as in the replay's readout.
function Figure({ term, title, weight, children }: { readonly term: string; readonly title?: string; readonly weight?: ExtremesWeight; readonly children: ReactNode }) {
  return (
    <div data-weight={weight} style={weight === 'Remote' ? { fontSize: '0.85em', color: 'var(--muted)' } : undefined}>
      <dt title={title}>{term}</dt>
      <dd className="number">{children}</dd>
    </div>
  );
}

// Trade P&L in dollars and R, then the Mark-dependent risk and reward.
function Figures({ evaluation, children }: { readonly evaluation: Evaluation; readonly children?: ReactNode }) {
  const { timeZone } = useRuntime();
  // Past a line one row says by how much, in place of the risk or the reward, which is zero there (W56).
  const standing = evaluation.standing?.kind === 'Value' ? evaluation.standing.value : undefined;
  const pastStop = standing?.zone === 'PastStop' ? standing.pastBy : undefined;
  const pastTarget = standing?.zone === 'PastTarget' ? standing.pastBy : undefined;
  return (
    <dl>
      <Figure term="Trade P&L">{pnlText(evaluation.currentMarkedPnl, evaluation.currentMarkedPnlInPlanR, timeZone)}</Figure>
      {pastStop ? (
        <Figure term="Current Risk" title="Stop Overrun">{pastLineWords('Stop', pastStop)}</Figure>
      ) : (
        <Figure term="Current Risk · At Stop" title="Ongoing Risk to Stop">{dollarsAndR(evaluation.ongoingRiskToStop, evaluation.ongoingRiskToStopInPlanR, undefined, timeZone)}</Figure>
      )}
      <Figure term="Current Risk · At Worst case" title="Worst-Case Ongoing Risk" weight={evaluation.extremes ?? 'Main'}>{dollarsAndR(evaluation.worstCaseOngoingRisk, evaluation.worstCaseOngoingRiskInPlanR, undefined, timeZone)}</Figure>
      {pastTarget ? (
        <Figure term="Remaining Reward" title="Target Overrun">{pastLineWords('Target', pastTarget)}</Figure>
      ) : (
        <Figure term="Remaining Reward · At Target" title="Incremental Reward to Target">{dollarsAndR(evaluation.incrementalRewardToTarget, evaluation.incrementalRewardToTargetInPlanR, undefined, timeZone)}</Figure>
      )}
      {children}
    </dl>
  );
}

// "Reward to risk" in the replay's words (W59, W60): the ratio, the estimated odds, and the Plan's own beside them. The odds part is
// read in full by a screen reader. A ratio with no value says why instead, as every figure does.
function RewardToRisk({ evaluation }: { readonly evaluation: Evaluation }) {
  const { timeZone } = useRuntime();
  const { rewardRiskNow, rewardRiskOdds, planOdds, planBaseline, standing } = evaluation;
  // Past a line there is no ratio to show (W56).
  if (standing?.kind === 'Value' && standing.value.pastBy) return null;
  // The Plan's ratio stays on the card when the ratio now has no value, as the old planned row did.
  if (rewardRiskNow.kind !== 'Value') return <Figure term="Reward to risk">{calculation(rewardRiskNow, ratioToOne, timeZone)}{planBaseline.kind === 'Value' && ` (Plan ${ratioToOne(planBaseline.value.rewardRiskRatio)})`}</Figure>;
  const plan = planBaseline.kind === 'Value' ? { rewardRisk: planBaseline.value.rewardRiskRatio, ...(planOdds?.kind === 'Value' && { odds: planOdds.value }) } : undefined;
  const words = ratioWordsOf(rewardRiskNow.value, rewardRiskOdds?.kind === 'Value' ? rewardRiskOdds.value : undefined, plan);
  const [ratioText, ...oddsMarks] = words.text.split(' · ');
  return (
    <Figure term="Reward to risk">
      {words.odds ? (
        <>
          {ratioText} · <span role="img" aria-label={words.odds.spoken}>{oddsMarks.join(' · ')}</span>
        </>
      ) : (
        words.text
      )}
      {words.plan && ` (Plan ${words.plan})`}
    </Figure>
  );
}

// The card's Conditions (W8), one line per Stop or Target in Plan order: what it is on, its boundary, then its status, or the
// reason's figure when it has no reading. A zero Overrun says nothing beyond the status. An option Trade's sides come from its
// summary; a stock Trade is Long Stock, whose Stop is below and Target above.
function Conditions({ trade, evaluation }: { readonly trade: DailyTradeReview; readonly evaluation: Evaluation }) {
  const uid = useId();
  const { timeZone } = useRuntime();
  const { summary } = trade;
  if (evaluation.conditions.length === 0) return null;
  const option = summary?.kind === 'Option' ? { right: summary.right, side: summary.direction } : undefined;
  if (evaluation.observation.instrument.kind === 'Option' && !option) return null;
  return (
    <div>
      <h4 id={`${uid}-conditions`}>Conditions</h4>
      <ul aria-labelledby={`${uid}-conditions`}>
        {evaluation.conditions.map((condition) => {
          const optionPrice = condition.kind === 'StructureValue';
          const direction = option ? conditionDirection(condition.role, condition.kind, option) : condition.role === 'Stop' ? 'below' : 'above';
          const on = option ? `${condition.role} on ${optionPrice ? 'the option price' : trade.underlying}` : condition.role;
          const boundary = option && !optionPrice ? decimalUnderlyingPrice(condition.boundary) : decimalMoney(condition.boundary);
          const status = calculation(condition.result, ({ status: word, overrun }) => (overrun && overrun.dollars.compare(Rational.of(0n)) > 0 ? `${word}, ${money(overrun.dollars)} beyond` : word), timeZone);
          return <li key={condition.id}>{`${on} at or ${direction} ${boundary}: ${status}`}</li>;
        })}
      </ul>
    </div>
  );
}

// The open card's figures, read from a getTrade result (A158): the Review-date figures with Reward : risk now and planned (P40),
// then the dated last close (D4 P12, P13) and the at-entry lots, each in its own group. A figure that is not a Value reads in words.
export function CardFigures({ trade }: CardFiguresProps) {
  const uid = useId();
  const { timeZone } = useRuntime();
  const { evaluation, datedLastClose } = trade;
  const mark = evaluation?.observation.mark;
  const atClose = evaluation?.expirationValueAtUnderlyingClose;
  return (
    <>
      {evaluation && (
        <>
          {mark && (
            <p>
              Mark {decimalMoney(mark.price)} for {instrumentLabel(evaluation.observation.instrument, timeZone)}, {shortDate(evaluation.observation.tradingDate)}
            </p>
          )}
          <Figures evaluation={evaluation}>
            <RewardToRisk evaluation={evaluation} />
          </Figures>
          <Conditions trade={trade} evaluation={evaluation} />
        </>
      )}
      {/* An option's Current payoff in one line; a Trade with no option, or no position left, has none to show. */}
      {trade.payoff?.current.kind === 'Value' && <p>{payoffSummary(trade.payoff.current.value)}</p>}
      {/* The value at expiration at the Underlying's latest close, or the module's words for why it has none (row 23.11, A122);
          a flat or stock Trade shows none. */}
      {atClose?.kind === 'Value' && <p>{valueAtCloseText(trade.underlying, atClose.value)}</p>}
      {atClose?.kind === 'Unavailable' && (
        <dl>
          <Figure term={valueAtCloseTerm(trade.underlying)}>{calculation(atClose, () => '', timeZone)}</Figure>
        </dl>
      )}
      {evaluation?.atEntry && (
        <div role="group" aria-labelledby={`${uid}-entry`}>
          <h4 id={`${uid}-entry`}>At entry</h4>
          <dl>
            <Figure term="Risk to stop">{money(evaluation.atEntry.riskFromEntry)}</Figure>
            <Figure term="Reward to target">{money(evaluation.atEntry.rewardFromEntry)}</Figure>
          </dl>
        </div>
      )}
      {datedLastClose && (
        <div role="group" aria-labelledby={`${uid}-dated`}>
          <h4 id={`${uid}-dated`}>At the {shortDate(datedLastClose.tradingDate)} Marks</h4>
          <Figures evaluation={datedLastClose.evaluation} />
        </div>
      )}
    </>
  );
}
