import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react';
import type { DailyTradeReview, PostSaveReview, SliderEvaluation, WalkedTrade } from '../../app/types.ts';
import { Badge } from '../Badge.tsx';
import { decimalMoney, money, ratio, shortDate } from '../format.ts';
import { calculation, dollarsAndR, pnlText, signed } from '../figures.ts';
import type { UiFacade } from '../../app/compose.ts';
import { ActionForm, type SavedAction } from './ActionForm.tsx';
import { CardMarks, type CardMarkRows, type EntryDirty } from './CardMarks.tsx';
import { ReviewReflections } from './ReviewReflections.tsx';
import { BAND_TEXT, reasonText } from './review-attention.ts';
import { StopTargetSlider } from './StopTargetSlider.tsx';

type Evaluation = NonNullable<DailyTradeReview['evaluation']>;

// What a card still owes, from the Review's completion: Marks and reflections by count, the Action by presence.
export interface Remaining {
  readonly marks: number;
  readonly reflections: number;
  readonly action: boolean;
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

// "2 Marks · 1 reflection due · Action", or Done once nothing remains (A150).
function remainsText({ marks, reflections, action }: Remaining): string {
  const parts = [...(marks > 0 ? [plural(marks, 'Mark', 'Marks')] : []), ...(reflections > 0 ? [plural(reflections, 'reflection', 'reflections') + ' due'] : []), ...(action ? ['Action'] : [])];
  return parts.length > 0 ? parts.join(' · ') : 'Done · Action saved';
}

// The slider's description speaks these figures in the app's own words (figures.ts), never as zero when missing.
function sliderFigures(figures: SliderEvaluation | undefined): { readonly riskToStop: string; readonly pnl: string; readonly rewardToRisk: string } {
  if (!figures) return { riskToStop: 'Not available', pnl: 'Not available', rewardToRisk: 'Not available' };
  return { riskToStop: calculation(figures.riskToStop, money), pnl: calculation(figures.pnl, signed(money)), rewardToRisk: calculation(figures.rewardRiskNow, ratio) };
}

// What the open card shows while its Trade is read, or when it could not be.
export type CardDetail = 'Loading' | 'Unavailable' | { readonly trade: DailyTradeReview };

export interface ReviewCardProps {
  readonly facade: UiFacade;
  readonly trade: WalkedTrade;
  readonly remaining: Remaining;
  readonly expanded: boolean;
  readonly detail: CardDetail | undefined;
  // A count that grows each time the trader asks for this card: it scrolls into view and takes focus on its header.
  readonly reveal: number;
  readonly marks: CardMarkRows;
  readonly underlying: (tradeId: string) => string;
  readonly onToggle: () => void;
  readonly onSaved: (saved: SavedAction) => void;
  readonly onReflectionResolved: (review: PostSaveReview) => void;
  readonly onRefresh: () => Promise<boolean>;
  readonly onMarkSaved: () => void;
  // The trader tried to leave while the card holds an entered value (A156).
  readonly holdMessage: boolean;
  // The Review is being read again after a Mark save, so the Action cannot be saved yet.
  readonly pending: boolean;
  readonly onEntryDirty: EntryDirty;
}

// One position of the Review: a collapsed header (Underlying, what remains, band, slider) over its content.
export function ReviewCard({ facade, trade, remaining, expanded, detail, reveal, marks, underlying, onToggle, onSaved, onReflectionResolved, onRefresh, onMarkSaved, holdMessage, pending, onEntryDirty }: ReviewCardProps) {
  const item = useRef<HTMLLIElement>(null);
  const header = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (reveal === 0) return;
    item.current?.scrollIntoView?.({ block: 'start' });
    header.current?.focus({ preventScroll: true });
  }, [reveal]);
  return (
    <li className="review-card" ref={item}>
      <div className="review-card-head">
        <h3>
          <button type="button" ref={header} aria-expanded={expanded} onClick={onToggle}>
            <span className="visually-hidden">Review</span> <span className="review-card-name">{trade.underlying}</span> <span className="review-card-remains">{remainsText(remaining)}</span>{' '}
            <Badge tone="neutral">{BAND_TEXT[trade.band]}</Badge>
          </button>
        </h3>
        <StopTargetSlider position={trade.rangePosition} figures={sliderFigures(trade.figures)} />
      </div>
      {expanded && holdMessage && <p role="status">Save or discard what you entered for {trade.underlying} to leave it.</p>}
      {expanded && detail === 'Loading' && <p role="status">Loading the Trade…</p>}
      {expanded && detail === 'Unavailable' && (
        <div role="alert" className="banner warning">
          <p>We couldn’t load this Trade. Nothing was changed.</p>
        </div>
      )}
      {expanded && typeof detail === 'object' && (
        <CardBody
          key={`${detail.trade.tradeId}:${detail.trade.saveBinding.reviewDate}`}
          facade={facade}
          trade={detail.trade}
          marks={marks}
          underlying={underlying}
          onSaved={onSaved}
          onReflectionResolved={onReflectionResolved}
          onRefresh={onRefresh}
          onMarkSaved={onMarkSaved}
          pending={pending}
          onEntryDirty={onEntryDirty}
        />
      )}
    </li>
  );
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
        {pnlText(pnl, planR)}
      </Figure>
      <Figure term="Ongoing Risk to Stop">{dollarsAndR(evaluation.ongoingRiskToStop, evaluation.ongoingRiskToStopInPlanR)}</Figure>
      <Figure term="Worst-Case Ongoing Risk">{dollarsAndR(evaluation.worstCaseOngoingRisk, evaluation.worstCaseOngoingRiskInPlanR)}</Figure>
      <Figure term="Incremental Reward to Target">{dollarsAndR(evaluation.incrementalRewardToTarget, evaluation.incrementalRewardToTargetInPlanR)}</Figure>
    </dl>
  );
}

interface CardBodyProps {
  readonly facade: UiFacade;
  readonly trade: DailyTradeReview;
  readonly marks: CardMarkRows;
  readonly underlying: (tradeId: string) => string;
  readonly onSaved: (saved: SavedAction) => void;
  readonly onReflectionResolved: (review: PostSaveReview) => void;
  readonly onRefresh: () => Promise<boolean>;
  readonly onMarkSaved: () => void;
  readonly pending: boolean;
  readonly onEntryDirty: EntryDirty;
}

// The open card, in the spec's work order (P36): the Marks, then the reflections, then the figures, then the Action.
function CardBody({ facade, trade, marks, underlying, onSaved, onReflectionResolved, onRefresh, onMarkSaved, pending, onEntryDirty }: CardBodyProps) {
  const uid = useId();
  // Resolving the last reflection moves focus to the Action form.
  const actionRef = useRef<HTMLElement>(null);
  const focusAction = useCallback(() => actionRef.current?.focus(), []);
  // The Action form reports under its Trade, so the Review's unsaved state counts it with the Mark entries.
  const tradeId = trade.tradeId;
  const report = useCallback((dirty: boolean) => onEntryDirty(`action:${tradeId}`, dirty), [tradeId, onEntryDirty]);
  const { evaluation, datedLastClose } = trade;
  const mark = evaluation?.observation.mark;
  return (
    <section aria-label={`${trade.underlying} review`}>
      <p>
        {trade.labels.strategy} · {trade.labels.account} · {trade.labels.institution}
      </p>
      {trade.attention.reasons.map((reason, i) => (
        <p key={i}>{reasonText(reason, trade.attention.basis)}</p>
      ))}
      <CardMarks facade={facade} marks={marks} underlying={underlying} onEntryDirty={onEntryDirty} onMarkSaved={onMarkSaved} />
      <ReviewReflections facade={facade} reviewDate={trade.saveBinding.reviewDate} reflections={trade.reflections} onReview={onReflectionResolved} onNoneRemaining={focusAction} onEntryDirty={onEntryDirty} />
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
      <section aria-label="Action" ref={actionRef} tabIndex={-1}>
        <ActionForm facade={facade} form={trade.form} binding={trade.saveBinding} onSaved={onSaved} onRefresh={onRefresh} onDirtyChange={report} pending={pending} />
      </section>
    </section>
  );
}
