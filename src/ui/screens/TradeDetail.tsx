import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import type { UiFacade } from '../../app/compose.ts';
import type { ClosedTradeDetail, OpenTradeDetail, TradeDetailView } from '../../app/types.ts';
import { PageTitle } from '../PageTitle.tsx';
import { clearHandedOver, handedOverConfirmed } from './confirmed-handoff.ts';
import { IncoherentPanel, IntegrityPanel } from './trade-detail/Banner.tsx';
import { DeviationsSection, FulfillmentSection } from './trade-detail/Footer.tsx';
import { BackToTrades, IdentityHeader } from './trade-detail/Identity.tsx';
import { JournalSection, PlanReflectionSection } from './trade-detail/Journal.tsx';
import { PayoffSections } from './trade-detail/Payoff.tsx';
import { BaselineSection, EntryQualitySection, PlanSection } from './trade-detail/Plan.tsx';
import { ExecutionsSection, FeeReconciliationSection, LotMatchesSection, outcomesOnly, PositionSection, SettlementSection } from './trade-detail/Position.tsx';
import { ClosedResultSection } from './trade-detail/Result.tsx';
import { RiskRewardSection } from './trade-detail/RiskReward.tsx';
import { SettlementDuePanel } from './trade-detail/SettlementDue.tsx';
import { SummaryCard } from './trade-detail/Summary.tsx';
import { AtEntrySection, DatedSection } from './trade-detail/Today.tsx';
import { ValuationSection } from './trade-detail/Valuation.tsx';

export interface TradeDetailProps {
  readonly facade: UiFacade;
  readonly timeZone: string;
  // The page holds an unsaved reflection (only one form is open at a time).
  readonly onDirtyChange?: (dirty: boolean) => void;
}

type DetailState =
  | { readonly kind: 'Loading' }
  | { readonly kind: 'Ready'; readonly view: TradeDetailView }
  | { readonly kind: 'NotFound' }
  | { readonly kind: 'Error' };

export function TradeDetail({ facade, timeZone, onDirtyChange }: TradeDetailProps) {
  const { tradeId = '' } = useParams();
  // A Plan just confirmed arrives with its post-commit view, so it is shown without a read.
  // It is handed over in memory (not in history state, which the browser structured-clones and strips the Rational
  // values of), taken once; a reload, a back/forward or a later visit takes the normal read.
  const [confirmed] = useState(() => handedOverConfirmed(tradeId));
  useEffect(() => {
    clearHandedOver();
  }, []);
  const [state, setState] = useState<DetailState>(confirmed?.tradeId === tradeId ? { kind: 'Ready', view: confirmed } : { kind: 'Loading' });

  // State is set only when the read settles; Retry resets to Loading itself.
  const request = useCallback(() => {
    facade.TradeViewsAndReporting.getTradeDetail({ tradeId }).then(
      (result) =>
        setState(
          result.kind === 'Ready' ? { kind: 'Ready', view: result.view } : result.kind === 'NotFound' ? { kind: 'NotFound' } : { kind: 'Error' },
        ),
      () => setState({ kind: 'Error' }),
    );
  }, [facade, tradeId]);

  const retry = () => {
    setState({ kind: 'Loading' });
    request();
  };

  const alreadyShown = confirmed?.tradeId === tradeId;
  useEffect(() => {
    if (!alreadyShown) request();
  }, [alreadyShown, request]);

  if (state.kind === 'Loading') {
    return (
      <>
        <BackToTrades />
        <p role="status">Loading the Trade…</p>
      </>
    );
  }
  if (state.kind === 'NotFound') {
    return (
      <section className="card">
        <BackToTrades />
        <PageTitle>Trade not found</PageTitle>
        <p>No Trade with this identity exists in this journal.</p>
      </section>
    );
  }
  if (state.kind === 'Error') {
    return (
      <section className="card">
        <BackToTrades />
        <p>We couldn’t load this trade. Nothing was changed.</p>
        <button type="button" className="pill secondary" onClick={retry}>
          Retry
        </button>
      </section>
    );
  }

  const { view } = state;
  const entry = view.journal[0];
  return (
    <article className="trade-detail">
      <IdentityHeader view={view} />
      {!('recordedPositionChanges' in view) && <SummaryCard view={view} timeZone={timeZone} />}
      {'settlement' in view && view.settlement.length > 0 && <SettlementDuePanel tradeId={view.tradeId} items={view.settlement} timeZone={timeZone} />}
      {!('recordedPositionChanges' in view) && <PayoffSections view={view} />}
      {'positionChanges' in view && view.findings.length > 0 && <IntegrityPanel view={view} timeZone={timeZone} />}
      {'recordedPositionChanges' in view && <IncoherentPanel view={view} timeZone={timeZone} />}
      <PlanSection view={view} timeZone={timeZone} />
      {'baseline' in view && <BaselineSection baseline={view.baseline} />}
      {'positionChanges' in view &&
        ('terminalDisposition' in view ? (
          <ClosedSections facade={facade} view={view} timeZone={timeZone} onDirtyChange={onDirtyChange} />
        ) : (
          <OpenSections facade={facade} view={view} timeZone={timeZone} onDirtyChange={onDirtyChange} />
        ))}
      {'recordedPositionChanges' in view && (
        <>
          <ExecutionsSection positionChanges={view.recordedPositionChanges} journal={outcomesOnly(view.journal)} legs={view.plan.legs} timeZone={timeZone} />
          <SettlementSection positionChanges={view.recordedPositionChanges} timeZone={timeZone} />
          <JournalSection facade={facade} journal={view.journal} symbol={view.plan.underlying} timeZone={timeZone} onDirtyChange={onDirtyChange} />
        </>
      )}
      {!('findings' in view) && entry && 'responses' in entry && <PlanReflectionSection entry={entry} />}
    </article>
  );
}

// The Closed form: how the Trade ended and what it realized, and its record. It shows no valuation, Mark,
// Expected Mark Date, risk, or Open Lot, since none remains to value (A92).
function ClosedSections({ facade, view, timeZone, onDirtyChange }: { readonly facade: UiFacade; readonly view: ClosedTradeDetail; readonly timeZone: string; readonly onDirtyChange?: (dirty: boolean) => void }) {
  return (
    <>
      <ClosedResultSection view={view} />
      <LotMatchesSection view={view} timeZone={timeZone} />
      <FeeReconciliationSection view={view} />
      <ExecutionsSection positionChanges={view.positionChanges} journal={outcomesOnly(view.journal)} legs={view.plan.legs} timeZone={timeZone} />
      <SettlementSection positionChanges={view.positionChanges} timeZone={timeZone} />
      <EntryQualitySection view={view} timeZone={timeZone} />
      <FulfillmentSection view={view} />
      <DeviationsSection view={view} timeZone={timeZone} />
      <JournalSection facade={facade} journal={view.journal} symbol={view.plan.underlying} timeZone={timeZone} onDirtyChange={onDirtyChange} />
    </>
  );
}

// The Open form's derived Position and its recorded Position Changes (D2).
function OpenSections({ facade, view, timeZone, onDirtyChange }: { readonly facade: UiFacade; readonly view: OpenTradeDetail; readonly timeZone: string; readonly onDirtyChange?: (dirty: boolean) => void }) {
  return (
    <>
      <ValuationSection tradeId={view.tradeId} current={view.current} timeZone={timeZone} />
      {view.current.datedLine && <DatedSection line={view.current.datedLine} />}
      {view.current.evaluation.atEntry && <AtEntrySection atEntry={view.current.evaluation.atEntry} option={view.plan.legs[0]?.instrument.kind === 'Option'} />}
      <RiskRewardSection evaluation={view.current.evaluation} baseline={view.baseline} option={view.plan.legs[0]?.instrument.kind === 'Option'} symbol={view.plan.underlying} />
      <PositionSection view={view} timeZone={timeZone} />
      <LotMatchesSection view={view} timeZone={timeZone} />
      <FeeReconciliationSection view={view} />
      <ExecutionsSection positionChanges={view.positionChanges} journal={outcomesOnly(view.journal)} legs={view.plan.legs} timeZone={timeZone} />
      <SettlementSection positionChanges={view.positionChanges} timeZone={timeZone} />
      <EntryQualitySection view={view} timeZone={timeZone} />
      <FulfillmentSection view={view} />
      <DeviationsSection view={view} timeZone={timeZone} />
      <JournalSection facade={facade} journal={view.journal} symbol={view.plan.underlying} timeZone={timeZone} onDirtyChange={onDirtyChange} />
    </>
  );
}
