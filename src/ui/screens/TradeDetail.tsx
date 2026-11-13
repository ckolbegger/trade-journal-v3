import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import type { UiFacade } from '../../app/compose.ts';
import type { TradeDetailView } from '../../app/types.ts';
import { PageTitle } from '../PageTitle.tsx';
import { clearHandedOver, handedOverConfirmed } from './confirmed-handoff.ts';
import { Cockpit } from './trade-detail/Cockpit.tsx';
import { BackToTrades } from './trade-detail/Identity.tsx';

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

  return (
    <article className="trade-detail">
      <Cockpit facade={facade} view={state.view} timeZone={timeZone} {...(onDirtyChange && { onDirtyChange })} />
    </article>
  );
}
