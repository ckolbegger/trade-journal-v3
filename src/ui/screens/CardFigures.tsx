import { useId, type ReactNode } from 'react';
import type { DailyTradeReview } from '../../app/types.ts';
import { instrumentLabel } from '../calculation-words.ts';
import { Rational } from '../../domain/values/index.ts';
import { decimalMoney, decimalUnderlyingPrice, money, ratio, shortDate } from '../format.ts';
import { calculation, dollarsAndR, pnlText } from '../figures.ts';
import { conditionDirection } from './option-words.ts';
import { payoffSummary, valueAtCloseTerm, valueAtCloseText } from './payoff-text.ts';

type Evaluation = NonNullable<DailyTradeReview['evaluation']>;

export interface CardFiguresProps {
  readonly trade: DailyTradeReview;
}

function Figure({ term, children }: { readonly term: string; readonly children: ReactNode }) {
  return (
    <div>
      <dt>{term}</dt>
      <dd className="number">{children}</dd>
    </div>
  );
}

// Current Marked Trade P&L in dollars and R, then the Mark-dependent risk and reward.
function Figures({ evaluation, children }: { readonly evaluation: Evaluation; readonly children?: ReactNode }) {
  return (
    <dl>
      <Figure term="Current Marked Trade P&L">{pnlText(evaluation.currentMarkedPnl, evaluation.currentMarkedPnlInPlanR)}</Figure>
      <Figure term="Ongoing Risk to Stop">{dollarsAndR(evaluation.ongoingRiskToStop, evaluation.ongoingRiskToStopInPlanR)}</Figure>
      <Figure term="Worst-Case Ongoing Risk">{dollarsAndR(evaluation.worstCaseOngoingRisk, evaluation.worstCaseOngoingRiskInPlanR)}</Figure>
      <Figure term="Incremental Reward to Target">{dollarsAndR(evaluation.incrementalRewardToTarget, evaluation.incrementalRewardToTargetInPlanR)}</Figure>
      {children}
    </dl>
  );
}

// The card's Conditions (W8), one line per Stop or Target in Plan order: what it is on, its boundary, then its status, or the
// reason's figure when it has no reading. A zero Overrun says nothing beyond the status. An option Trade's sides come from its
// summary; a stock Trade is Long Stock, whose Stop is below and Target above.
function Conditions({ trade, evaluation }: { readonly trade: DailyTradeReview; readonly evaluation: Evaluation }) {
  const uid = useId();
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
          const status = calculation(condition.result, ({ status: word, overrun }) => (overrun && overrun.dollars.compare(Rational.of(0n)) > 0 ? `${word}, ${money(overrun.dollars)} beyond` : word));
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
  const { evaluation, datedLastClose } = trade;
  const mark = evaluation?.observation.mark;
  const atClose = evaluation?.expirationValueAtUnderlyingClose;
  return (
    <>
      {evaluation && (
        <>
          {mark && (
            <p>
              Mark {decimalMoney(mark.price)} for {instrumentLabel(evaluation.observation.instrument)}, {shortDate(evaluation.observation.tradingDate)}
            </p>
          )}
          <Figures evaluation={evaluation}>
            <Figure term="Reward : risk now">{calculation(evaluation.rewardRiskNow, ratio)}</Figure>
            <Figure term="Reward : risk planned">{calculation(evaluation.planBaseline, (baseline) => ratio(baseline.rewardRiskRatio))}</Figure>
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
          <Figure term={valueAtCloseTerm(trade.underlying)}>{calculation(atClose, () => '')}</Figure>
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
          <h4 id={`${uid}-dated`}>{shortDate(datedLastClose.tradingDate)} close</h4>
          <Figures evaluation={datedLastClose.evaluation} />
        </div>
      )}
    </>
  );
}
