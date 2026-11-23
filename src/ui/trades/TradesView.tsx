import { useEffect, useState } from 'react';
import { formatSessionDateShort } from '../../market-data/session-calendar';
import type { TradeLifecycleState } from '../../persistence/idb';
import type { TradeBrowseItem, TradeViewsAndReporting } from '../../trade-views/trade-views';
import styles from '../shell/AppShell.module.css';

type LifecycleFilter = 'All' | 'Planned' | 'Open';

interface TradesViewProps {
  readonly views: TradeViewsAndReporting;
  readonly refreshKey: number;
  readonly onSelectTrade: (tradeId: string) => void;
  readonly onNewPlan: () => void;
}

function renderOpenPnlCell(item: TradeBrowseItem) {
  if (item.evaluation?.availability === 'Available') {
    return (
      <>
        <strong>{item.evaluation.openPnlDisplay}</strong>
        <div className={styles.muted}>{item.evaluation.openPnlRDisplay}</div>
      </>
    );
  }
  if (item.evaluation?.availability === 'Unavailable' && item.evaluation.priorContext) {
    const prior = item.evaluation.priorContext;
    return (
      <span className={styles.muted}>
        {prior.evaluation.openPnlDisplay} (at {formatSessionDateShort(prior.asOfSessionDate)})
      </span>
    );
  }
  return <span className={styles.muted}>—</span>;
}

export function TradesView({ views, refreshKey, onSelectTrade, onNewPlan }: TradesViewProps) {
  const [filter, setFilter] = useState<LifecycleFilter>('All');
  const [items, setItems] = useState<readonly TradeBrowseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const lifecycleState: TradeLifecycleState | undefined =
          filter === 'All' ? undefined : filter;
        const res = await views.browseTrades({ lifecycleState });
        if (active) {
          setItems(res.items);
          setError(null);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to load trades.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [views, refreshKey, filter]);

  return (
    <section aria-labelledby="trades-heading">
      <div className={styles.spaceBetween} style={{ marginBottom: 16 }}>
        <div>
          <h1 id="trades-heading" style={{ margin: 0, fontSize: '1.45rem' }}>
            Trades
          </h1>
          <p className={styles.muted} style={{ margin: '4px 0 0' }}>
            Browse Planned and Open Trades from your local journal.
          </p>
        </div>
        <button type="button" className={styles.btnPrimary} onClick={onNewPlan}>
          New Plan
        </button>
      </div>

      <div className={styles.row} style={{ marginBottom: 14 }} role="group" aria-label="Filter by lifecycle state">
        {(['All', 'Open', 'Planned'] as const).map((option) => (
          <button
            key={option}
            type="button"
            className={filter === option ? styles.btnPrimary : styles.btnSecondary}
            aria-pressed={filter === option}
            onClick={() => setFilter(option)}
          >
            {option}
          </button>
        ))}
      </div>

      {error && (
        <div className={styles.alertError} role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className={styles.card} aria-busy="true">
          Loading trades…
        </div>
      ) : items.length === 0 ? (
        <div className={styles.card}>
          <p className={styles.muted} style={{ margin: 0 }}>
            {filter === 'All'
              ? 'No Trades yet. Create your first Long Stock Plan to freeze your 1R baseline and Thesis.'
              : `No ${filter} Trades yet.`}
          </p>
        </div>
      ) : (
        <div className={styles.card} style={{ overflowX: 'auto' }}>
          <table className={styles.table} aria-label="Trades list">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>State</th>
                <th>Account</th>
                <th>Position</th>
                <th>Open P&amp;L</th>
                <th>1R Risk</th>
                <th>Planned R:R</th>
                <th>Open</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.symbol}</strong>
                    <div className={styles.muted}>{item.strategyLabel}</div>
                  </td>
                  <td>
                    <span
                      className={`${styles.pill} ${
                        item.lifecycleState === 'Open' ? styles.pillSuccess : ''
                      }`}
                    >
                      {item.lifecycleState}
                    </span>
                  </td>
                  <td>
                    {item.accountLabel}
                    <div className={styles.muted}>{item.institutionLabel}</div>
                  </td>
                  <td className={styles.mono}>
                    {item.openSharesDisplay} / {item.plannedQuantityDisplay} sh @{' '}
                    {item.intendedEntryDisplay}
                  </td>
                  <td className={styles.mono}>{renderOpenPnlCell(item)}</td>
                  <td className={styles.mono}>{item.oneRDisplay}</td>
                  <td className={styles.mono}>{item.plannedRRDisplay}</td>
                  <td>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      onClick={() => onSelectTrade(item.id)}
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
