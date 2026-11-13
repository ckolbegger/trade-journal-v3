import { Link } from 'react-router';
import type { TradeDetailView } from '../../../app/types.ts';
import { Badge } from '../../Badge.tsx';
import { BackIcon } from '../../icons.tsx';
import { PageTitle } from '../../PageTitle.tsx';
import { useRuntime } from '../../runtime.tsx';
import { EXIT_ACTION } from './words.ts';

// Returns to the Trades tab the Trade is listed under; where the lifecycle is unknown, the default tab.
export function BackToTrades({ lifecycle }: { readonly lifecycle?: string }) {
  return (
    <Link className="back-link" to={lifecycle === 'Planned' ? '/?lifecycle=Planned' : '/'}>
      <BackIcon />
      Back to Trades
    </Link>
  );
}

// The Trade's identity: the way back, its name and Strategy, its lifecycle, and the entry and exit actions.
export function IdentityHeader({ view }: { readonly view: TradeDetailView }) {
  const { writable } = useRuntime();
  const closed = 'terminalDisposition' in view;
  return (
    <header>
      <BackToTrades lifecycle={view.lifecycle.stored} />
      <PageTitle>{view.plan.underlying}</PageTitle>
      <p>
        {view.labels.strategy} · <Badge tone="info">{view.lifecycle.stored}</Badge>
      </p>
      {/* Recording an entry is an authoritative write, offered only while the runtime is Writable and
          the Trade's facts can be replayed; on incoherent facts it could only fail. */}
      {writable && !('recordedPositionChanges' in view) && !closed && (
        <Link className="pill primary" to={`/trades/${view.tradeId}/record-entry`}>
          Record entry
        </Link>
      )}
      {/* An exit needs a Position to sell: the Open form only (the Closed form has none to record against). */}
      {writable && 'positionChanges' in view && !closed && (
        <Link className="pill secondary" to={`/trades/${view.tradeId}/record-entry?action=${EXIT_ACTION}`}>
          Record exit
        </Link>
      )}
    </header>
  );
}
