import type { UiFacade } from '../../../app/compose.ts';
import type { TradeDetailView } from '../../../app/types.ts';
import { JournalSection, PlanReflectionSection } from './Journal.tsx';

// The Journal drawer's content (`src/ui/cockpit/drawers/journal.tsx` re-exports it): the Position Change Reflections and Debts, and the Plan
// Reflection. Every other section the old Detail composed here is rendered by its own cockpit card or drawer (D08P T8P.27).
export interface JournalBlockProps {
  readonly view: TradeDetailView;
  readonly timeZone: string;
  readonly facade: UiFacade;
  readonly onDirtyChange?: (dirty: boolean) => void;
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
