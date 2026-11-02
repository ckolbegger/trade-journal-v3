import { useCallback, useState } from 'react';
import type { UiFacade } from '../../app/compose.ts';
import type { ExitRoute } from '../../app/types.ts';
import { useRuntime } from '../runtime.tsx';
import { PositionChangeForm } from './PositionChangeForm.tsx';

export interface RecordExitProps {
  readonly facade: UiFacade;
  readonly tradeId: string;
  // Present only while the Trade still holds an open quantity (A94).
  readonly route: ExitRoute | undefined;
  readonly now: () => string;
  // The entries holding a value, so the Review counts the exit form with its other drafts (A156).
  readonly onEntryDirty: (id: string, dirty: boolean) => void;
  // Asks for the Review and this Trade again (Refresh Review calls `open`, D4 A48); true once the Trade carries a fresh binding.
  readonly onRefresh: () => Promise<boolean>;
}

// Record the exit, in the card's Action panel once an Exit Action is saved (A94). The exit form opens in place over the Review,
// with nothing prefilled but the Trade; after its Save the recorded exit shows from the result, and Refresh Review reads the
// Review again, because the exit is a Trade Workflows save, not a Review save.
export function RecordExit({ facade, tradeId, route, now, onEntryDirty, onRefresh }: RecordExitProps) {
  const { writable, timeZone = 'UTC' } = useRuntime();
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const dirty = useCallback((isDirty: boolean) => onEntryDirty(`exit:${tradeId}`, isDirty), [tradeId, onEntryDirty]);
  const refresh = async () => {
    setRefreshing(true);
    setFailed(false);
    try {
      if (await onRefresh()) setOpen(false);
      else setFailed(true);
    } finally {
      setRefreshing(false);
    }
  };
  if (open) {
    const afterRecorded = (
      <>
        {failed && (
          <p role="alert" className="field-error">
            We couldn’t refresh the Review. Nothing was changed.
          </p>
        )}
        <button type="button" className="pill primary" disabled={refreshing} onClick={() => void refresh()}>
          Refresh Review
        </button>
      </>
    );
    return <PositionChangeForm facade={facade} timeZone={timeZone} now={now} onDirtyChange={dirty} host={{ tradeId, onLeave: () => setOpen(false), afterRecorded }} />;
  }
  if (route === undefined || !writable) return null;
  return (
    <button type="button" className="pill secondary" onClick={() => setOpen(true)}>
      Record the exit
    </button>
  );
}
