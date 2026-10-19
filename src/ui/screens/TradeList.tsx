import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { UiFacade } from '../../app/compose.ts';
import type { PlannedTradeItem } from '../../app/types.ts';
import { localTime, money, ratio } from '../format.ts';

export interface TradeListProps {
  readonly facade: UiFacade;
  readonly timeZone: string;
}

type ListState =
  | { readonly kind: 'Loading' }
  | { readonly kind: 'Ready'; readonly items: readonly PlannedTradeItem[] }
  | { readonly kind: 'Error' };

// The Planned Trade list, with Loading, Ready, Empty, and Error kept distinct: never a false
// Empty while loading or after a failure.
export function TradeList({ facade, timeZone }: TradeListProps) {
  const [state, setState] = useState<ListState>({ kind: 'Loading' });

  // State is set only when the read settles; Retry resets to Loading itself.
  const request = useCallback(() => {
    facade.TradeViewsAndReporting.browseTrades({ lifecycle: 'Planned' }).then(
      (result) => setState(result.kind === 'Ready' ? { kind: 'Ready', items: result.view.items } : { kind: 'Error' }),
      () => setState({ kind: 'Error' }),
    );
  }, [facade]);

  useEffect(request, [request]);
  const retry = () => {
    setState({ kind: 'Loading' });
    request();
  };

  if (state.kind === 'Loading') return <p role="status">Loading planned trades…</p>;
  if (state.kind === 'Error') {
    return (
      <section className="card">
        <p>We couldn’t load your planned trades. Nothing was changed.</p>
        <button type="button" className="pill secondary" onClick={retry}>
          Retry
        </button>
      </section>
    );
  }
  if (state.items.length === 0) {
    return (
      <section className="card empty">
        <p>No planned trades yet. Start by planning one before you enter it.</p>
        <Link className="pill primary" to="/plans/new">
          New Plan
        </Link>
      </section>
    );
  }
  return (
    <table className="trades">
      <caption>Planned Trades</caption>
      <thead>
        <tr>
          <th scope="col">Underlying</th>
          <th scope="col">Strategy</th>
          <th scope="col">Account</th>
          <th scope="col">Plan time</th>
          <th scope="col" className="number">
            1R
          </th>
          <th scope="col" className="number">
            Planned reward
          </th>
          <th scope="col" className="number">
            Reward : risk
          </th>
          <th scope="col">Entry</th>
        </tr>
      </thead>
      <tbody>
        {state.items.map((item) => (
          <tr key={item.tradeId}>
            <td>
              <Link to={`/trades/${item.tradeId}`}>{item.underlying}</Link>
            </td>
            <td>{item.strategy}</td>
            <td>{`${item.institution} — ${item.account}`}</td>
            <td>{localTime(item.planTime, timeZone)}</td>
            <td className="number">{money(item.oneR)}</td>
            <td className="number">{money(item.originalPlannedReward)}</td>
            <td className="number">{ratio(item.rewardRiskRatio)}</td>
            <td>{item.entryReadiness}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
