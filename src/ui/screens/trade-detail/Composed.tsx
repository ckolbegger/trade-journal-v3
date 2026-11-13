import type { UiFacade } from '../../../app/compose.ts';
import type { TradeDetailView } from '../../../app/types.ts';
import { IdentityHeader } from './Identity.tsx';
import { JournalSection, PlanReflectionSection } from './Journal.tsx';
import { PayoffSections } from './Payoff.tsx';
import { BaselineSection, EntryQualitySection, PlanSection } from './Plan.tsx';
import { ExecutionsSection, FeeReconciliationSection, LotMatchesSection, outcomesOnly, PositionSection, SettlementSection } from './Position.tsx';
import { ClosedResultSection } from './Result.tsx';
import { SettlementDuePanel } from './SettlementDue.tsx';
import { AtEntrySection, DatedSection } from './Today.tsx';
import { DeviationsSection, FulfillmentSection } from './Footer.tsx';

// The current sections composed under their future cockpit names (D08P T8P.5, plan section 4.2). `src/ui/cockpit/**` re-exports each, and the
// shell (`Cockpit.tsx`) renders through those paths, so a wave-1 lane replaces the content behind a path and never edits the shell. Every
// component takes the view and the zone, as the old sections did; the Summary, Valuation and Risk and reward are the shell's legacy blocks.
export interface DetailBlockProps {
  readonly view: TradeDetailView;
  readonly timeZone: string;
}

export interface JournalBlockProps extends DetailBlockProps {
  readonly facade: UiFacade;
  readonly onDirtyChange?: (dirty: boolean) => void;
}

export const IdentityCardBlock = ({ view }: DetailBlockProps) => <IdentityHeader view={view} />;

// The Settlement Due panel stands in the rail's Needs you card (A224).
export const NeedsYouBlock = ({ view, timeZone }: DetailBlockProps) =>
  'settlement' in view && view.settlement.length > 0 ? <SettlementDuePanel tradeId={view.tradeId} items={view.settlement} timeZone={timeZone} /> : null;

// Today: the dated close and the shares or contracts bought after it. An Open Trade only.
export const TodayBlock = ({ view }: DetailBlockProps) =>
  'current' in view ? (
    <>
      {view.current.datedLine && <DatedSection line={view.current.datedLine} />}
      {view.current.evaluation.atEntry && <AtEntrySection atEntry={view.current.evaluation.atEntry} option={view.plan.legs[0]?.instrument.kind === 'Option'} />}
    </>
  ) : null;

export function PositionBlock({ view, timeZone }: DetailBlockProps) {
  if ('recordedPositionChanges' in view) {
    return (
      <>
        <ExecutionsSection positionChanges={view.recordedPositionChanges} journal={outcomesOnly(view.journal)} legs={view.plan.legs} timeZone={timeZone} />
        <SettlementSection positionChanges={view.recordedPositionChanges} timeZone={timeZone} />
      </>
    );
  }
  if (!('positionChanges' in view)) return null;
  return (
    <>
      {'terminalDisposition' in view ? <ClosedResultSection view={view} /> : <PositionSection view={view} timeZone={timeZone} />}
      <LotMatchesSection view={view} timeZone={timeZone} />
      <FeeReconciliationSection view={view} />
      <ExecutionsSection positionChanges={view.positionChanges} journal={outcomesOnly(view.journal)} legs={view.plan.legs} timeZone={timeZone} />
      <SettlementSection positionChanges={view.positionChanges} timeZone={timeZone} />
    </>
  );
}

export const PlanRiskBlock = ({ view, timeZone }: DetailBlockProps) => (
  <>
    <PlanSection view={view} timeZone={timeZone} />
    {'baseline' in view && <BaselineSection baseline={view.baseline} />}
    {'positionChanges' in view && <EntryQualitySection view={view} timeZone={timeZone} />}
  </>
);

export const FooterBlock = ({ view, timeZone }: DetailBlockProps) =>
  'positionChanges' in view ? (
    <>
      <FulfillmentSection view={view} />
      <DeviationsSection view={view} timeZone={timeZone} />
    </>
  ) : null;

export function PayoffBlock({ view }: DetailBlockProps) {
  return 'recordedPositionChanges' in view ? null : <PayoffSections view={view} />;
}

export function JournalBlock({ facade, view, timeZone, onDirtyChange }: JournalBlockProps) {
  const entry = view.journal[0];
  return (
    <>
      {('positionChanges' in view || 'recordedPositionChanges' in view) && (
        <JournalSection facade={facade} journal={view.journal} symbol={view.plan.underlying} timeZone={timeZone} onDirtyChange={onDirtyChange} />
      )}
      {!('findings' in view) && entry && 'responses' in entry && <PlanReflectionSection entry={entry} />}
    </>
  );
}
