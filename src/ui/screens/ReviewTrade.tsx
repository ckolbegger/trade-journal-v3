import { useCallback, useId, useRef, type ReactNode } from 'react';
import type { DailyTradeReview, PostSaveReview } from '../../app/types.ts';
import { decimalMoney, money, shortDate } from '../format.ts';
import { dollarsAndR, pnlText } from '../figures.ts';
import type { UiFacade } from '../../app/compose.ts';
import { ActionForm, type SavedAction } from './ActionForm.tsx';
import { ReviewReflections } from './ReviewReflections.tsx';
import { reasonText } from './review-attention.ts';

type Evaluation = NonNullable<DailyTradeReview['evaluation']>;

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
        {pnlText(pnl, planR)}
      </Figure>
      <Figure term="Ongoing Risk to Stop">{dollarsAndR(evaluation.ongoingRiskToStop, evaluation.ongoingRiskToStopInPlanR)}</Figure>
      <Figure term="Worst-Case Ongoing Risk">{dollarsAndR(evaluation.worstCaseOngoingRisk, evaluation.worstCaseOngoingRiskInPlanR)}</Figure>
      <Figure term="Incremental Reward to Target">{dollarsAndR(evaluation.incrementalRewardToTarget, evaluation.incrementalRewardToTargetInPlanR)}</Figure>
    </dl>
  );
}

// One Trade of the walk: its figures at the Review Date, the dated close and at-entry lines when present, and why it needs attention.
export function ReviewTrade({ facade, trade, onSaved, onReflectionResolved, onRefresh, onEntryDirty }: { readonly facade: UiFacade; readonly trade: DailyTradeReview; readonly onSaved: (saved: SavedAction) => void; readonly onReflectionResolved: (review: PostSaveReview) => void; readonly onRefresh: () => Promise<boolean>; readonly onEntryDirty: (id: string, dirty: boolean) => void }) {
  const uid = useId();
  // Resolving the last reflection moves focus to the Action form.
  const actionRef = useRef<HTMLDivElement>(null);
  const focusAction = useCallback(() => actionRef.current?.focus(), []);
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
      <ReviewReflections facade={facade} reviewDate={trade.saveBinding.reviewDate} reflections={trade.reflections} onReview={onReflectionResolved} onNoneRemaining={focusAction} onEntryDirty={onEntryDirty} />
      <div ref={actionRef} tabIndex={-1}>
        <ActionForm facade={facade} form={trade.form} binding={trade.saveBinding} onSaved={onSaved} onRefresh={onRefresh} onDirtyChange={report} />
      </div>
    </section>
  );
}
