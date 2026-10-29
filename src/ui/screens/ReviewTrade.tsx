import { useCallback, useId, type ReactNode } from 'react';
import type { DailyTradeReview } from '../../app/types.ts';
import { Rational } from '../../domain/values/index.ts';
import { decimalMoney, money, rMultiple, shortDate } from '../format.ts';
import type { UiFacade } from '../../app/compose.ts';
import { ActionForm, type SavedAction } from './ActionForm.tsx';
import { reasonText } from './review-attention.ts';

type Evaluation = NonNullable<DailyTradeReview['evaluation']>;
type Calculation = Evaluation['currentMarkedPnl'];

const ZERO = Rational.of(0n);
// A gain carries a plus sign; a loss carries the minus the formats already give.
const signed = (format: (value: Rational) => string) => (value: Rational): string => (value.compare(ZERO) > 0 ? `+${format(value)}` : format(value));

// A figure that may lack its Mark says so in words, never as a number or a zero.
function calculation(result: Calculation, format: (value: Rational) => string): string {
  switch (result.kind) {
    case 'Value':
      return format(result.value);
    case 'Unbounded':
      return `Unbounded ${result.direction.toLowerCase()}`;
    case 'NotApplicable':
      return 'Not applicable';
    case 'Unavailable':
      return 'date' in result.detail ? `Mark missing: ${result.detail.instrument.symbol}, ${shortDate(result.detail.date)}` : 'Awaiting the next close';
  }
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
function Figures({ evaluation }: { readonly evaluation: Evaluation }) {
  const pnl = evaluation.currentMarkedPnl;
  const planR = evaluation.currentMarkedPnlInPlanR;
  return (
    <dl>
      <Figure term="Current Marked Trade P&L">
        {pnl.kind === 'Value' && planR.kind === 'Value' ? `${signed(money)(pnl.value)} · ${signed(rMultiple)(planR.value)}` : calculation(pnl, signed(money))}
      </Figure>
      <Figure term="Ongoing Risk to Stop">{calculation(evaluation.ongoingRiskToStop, money)}</Figure>
      <Figure term="Incremental Reward to Target">{calculation(evaluation.incrementalRewardToTarget, money)}</Figure>
    </dl>
  );
}

// One Trade of the walk: its figures at the Review Date, the dated close and at-entry lines when present, and why it needs attention.
export function ReviewTrade({ facade, trade, onSaved, onRefresh, onEntryDirty }: { readonly facade: UiFacade; readonly trade: DailyTradeReview; readonly onSaved: (saved: SavedAction) => void; readonly onRefresh: () => Promise<boolean>; readonly onEntryDirty: (id: string, dirty: boolean) => void }) {
  const uid = useId();
  // The Action form reports under its Trade, so the Review's unsaved state counts it with the Mark entries.
  const tradeId = trade.tradeId;
  const report = useCallback((dirty: boolean) => onEntryDirty(`action:${tradeId}`, dirty), [tradeId, onEntryDirty]);
  const { evaluation, datedLastClose } = trade;
  const mark = evaluation?.observation.mark;
  return (
    <section aria-label={`${trade.underlying} review`}>
      <h3>{trade.underlying}</h3>
      <p>
        {trade.labels.strategy} · {trade.labels.account} · {trade.labels.institution}
      </p>
      {trade.attention.reasons.map((reason, i) => (
        <p key={i}>{reasonText(reason, trade.attention.basis)}</p>
      ))}
      {evaluation && (
        <>
          {mark && (
            <p>
              Mark {decimalMoney(mark.price)} for {evaluation.observation.instrument.symbol}, {shortDate(evaluation.observation.tradingDate)}
            </p>
          )}
          <Figures evaluation={evaluation} />
        </>
      )}
      {datedLastClose && (
        <div role="group" aria-labelledby={`${uid}-dated`}>
          <h4 id={`${uid}-dated`}>{shortDate(datedLastClose.tradingDate)} close</h4>
          <Figures evaluation={datedLastClose.evaluation} />
        </div>
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
      <ActionForm facade={facade} form={trade.form} binding={trade.saveBinding} onSaved={onSaved} onRefresh={onRefresh} onDirtyChange={report} />
    </section>
  );
}
