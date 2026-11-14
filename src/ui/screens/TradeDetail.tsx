import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import type { UiFacade } from '../../app/compose.ts';
import type { TradeDetailView, ViewBinding } from '../../app/types.ts';
import { PageTitle } from '../PageTitle.tsx';
import { clearHandedOver, handedOverConfirmed } from './confirmed-handoff.ts';
import { Cockpit, type ReplayRead } from './trade-detail/Cockpit.tsx';
import { BackToTrades } from './trade-detail/Identity.tsx';

export interface TradeDetailProps {
  readonly facade: UiFacade;
  readonly timeZone: string;
  // The page holds an unsaved reflection (only one form is open at a time).
  readonly onDirtyChange?: (dirty: boolean) => void;
}

// How many times both reads are tried while the Workspace keeps moving between them.
const READS = 3;

// Only an Open or Closed Detail whose facts are coherent has a history to replay: a Planned Trade was never exposed, and an incoherent one
// cannot be replayed (P95). A Settlement Due Detail is Open, so it is read like one.
const replayable = (view: TradeDetailView): boolean => 'positionChanges' in view;

// The replay as the screen has it: not wanted (or not available, so the cockpit shows what the Detail alone holds), pending, or read.
async function readReplay(facade: UiFacade, tradeId: string, binding: ViewBinding): Promise<ReplayRead | 'Moved'> {
  try {
    const replay = await facade.TradeViewsAndReporting.replayTrade({ tradeId, binding });
    if (replay.kind === 'ChangedDuringAssembly') return 'Moved';
    return replay.kind === 'Ready' ? { kind: 'Ready', replay: replay.view } : { kind: 'None' };
  } catch {
    return { kind: 'None' };
  }
}

type DetailState =
  | { readonly kind: 'Loading' }
  | { readonly kind: 'Ready'; readonly view: TradeDetailView; readonly replay: ReplayRead }
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
  const [state, setState] = useState<DetailState>(confirmed?.tradeId === tradeId ? { kind: 'Ready', view: confirmed, replay: { kind: 'None' } } : { kind: 'Loading' });

  // The Detail shows as soon as it is read; the replay is read with its binding and fills in when it arrives (P95, W20). Retry resets to
  // Loading itself.
  const request = useCallback(() => {
    const read = async (): Promise<void> => {
      for (let attempt = 0; attempt < READS; attempt += 1) {
        const result = await facade.TradeViewsAndReporting.getTradeDetail({ tradeId });
        if (result.kind !== 'Ready') {
          setState({ kind: result.kind === 'NotFound' ? 'NotFound' : 'Error' });
          return;
        }
        const { view, binding } = result;
        if (!replayable(view)) {
          setState({ kind: 'Ready', view, replay: { kind: 'None' } });
          return;
        }
        setState({ kind: 'Ready', view, replay: { kind: 'Pending' } });
        const replay = await readReplay(facade, tradeId, binding);
        // The Workspace moved since the Detail's binding: both are read again, so the screen shows one snapshot.
        if (replay !== 'Moved') {
          setState({ kind: 'Ready', view, replay });
          return;
        }
      }
      // A Workspace that keeps moving ends as the read error, with Retry.
      setState({ kind: 'Error' });
    };
    read().catch(() => setState({ kind: 'Error' }));
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

  return (
    <article className="trade-detail">
      <Cockpit facade={facade} view={state.view} replay={state.replay} timeZone={timeZone} {...(onDirtyChange && { onDirtyChange })} />
    </article>
  );
}
