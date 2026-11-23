import { useEffect, useState } from 'react';
import type {
  TradeDetailCockpitViewModel,
  TradeViewsAndReporting,
} from '../../trade-views/trade-views';
import styles from '../shell/AppShell.module.css';
import cockpitStyles from './Cockpit.module.css';

type CockpitDrawer = 'plan' | 'journal';

interface TradeDetailCockpitProps {
  readonly tradeId: string;
  readonly views: TradeViewsAndReporting;
  readonly onBack: () => void;
}

export function TradeDetailCockpit({ tradeId, views, onBack }: TradeDetailCockpitProps) {
  const [detail, setDetail] = useState<TradeDetailCockpitViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDrawer, setActiveDrawer] = useState<CockpitDrawer>('plan');

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const res = await views.getTradeDetail(tradeId);
        if (active) {
          setDetail(res);
          setError(res ? null : 'Trade not found.');
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to load trade detail.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [tradeId, views]);

  if (loading) {
    return (
      <section className={styles.card} aria-busy="true">
        Loading Trade Cockpit…
      </section>
    );
  }

  if (error || !detail) {
    return (
      <section className={styles.card}>
        <div className={styles.alertError} role="alert">
          {error ?? 'Trade not found.'}
        </div>
        <button type="button" className={styles.btnSecondary} onClick={onBack}>
          Back to Trades
        </button>
      </section>
    );
  }

  const { trade, planFact, journalEntries } = detail;

  return (
    <section aria-labelledby="cockpit-symbol-heading">
      <div style={{ marginBottom: 14 }}>
        <button type="button" className={styles.btnSecondary} onClick={onBack}>
          ← Back to Trades
        </button>
      </div>

      <div className={cockpitStyles.cockpitGrid}>
        {/* Sticky left State-of-Play rail (C. Cockpit — OV-01) */}
        <aside className={cockpitStyles.rail} aria-label="Trade state of play">
          <div className={styles.spaceBetween}>
            <h1 id="cockpit-symbol-heading" className={cockpitStyles.railSymbol}>
              {trade.symbol}
            </h1>
            <span className={styles.pill}>{trade.lifecycleState}</span>
          </div>

          <div className={styles.muted}>
            <div>{detail.strategyLabel}</div>
            <div>
              {detail.institutionLabel} — {detail.accountLabel}
            </div>
          </div>

          <div className={styles.mono}>
            <strong>0 of {detail.plannedQuantityDisplay} shares open</strong>
          </div>

          <div>
            <div className={cockpitStyles.metricLabel} style={{ marginBottom: 6 }}>
              Planned Conditions
            </div>
            <ul className={cockpitStyles.conditionList}>
              <li className={cockpitStyles.conditionItem}>
                <span>
                  <strong>Stop</strong> · {detail.stopPriceDisplay}
                </span>
                <span className={styles.mono}>
                  -{planFact.baseline.originalPlannedRiskDisplay} (-1.00R)
                </span>
              </li>
              <li className={cockpitStyles.conditionItem}>
                <span>
                  <strong>Target</strong> · {detail.targetPriceDisplay}
                </span>
                <span className={styles.mono}>
                  +{planFact.baseline.originalPlannedRewardDisplay} (+
                  {planFact.baseline.plannedRewardToRiskDisplay})
                </span>
              </li>
            </ul>
          </div>
        </aside>

        {/* Right conditional tabbed drawers */}
        <div className={cockpitStyles.drawerColumn}>
          <div className={cockpitStyles.tabBar} role="tablist" aria-label="Trade detail drawers">
            <button
              type="button"
              role="tab"
              aria-selected={activeDrawer === 'plan'}
              className={`${cockpitStyles.tabButton} ${
                activeDrawer === 'plan' ? cockpitStyles.tabButtonActive : ''
              }`}
              onClick={() => setActiveDrawer('plan')}
            >
              Plan and Risk
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeDrawer === 'journal'}
              className={`${cockpitStyles.tabButton} ${
                activeDrawer === 'journal' ? cockpitStyles.tabButtonActive : ''
              }`}
              onClick={() => setActiveDrawer('journal')}
            >
              Journal ({journalEntries.length})
            </button>
          </div>

          {activeDrawer === 'plan' ? (
            <div className={styles.card} role="tabpanel" aria-label="Plan and Risk">
              <h2 className={styles.cardTitle}>Frozen Plan Baseline</h2>
              <div className={cockpitStyles.metricGrid}>
                <div className={cockpitStyles.metricBox}>
                  <div className={cockpitStyles.metricLabel}>Intended Entry</div>
                  <div className={cockpitStyles.metricValue}>{detail.intendedEntryDisplay}</div>
                </div>
                <div className={cockpitStyles.metricBox}>
                  <div className={cockpitStyles.metricLabel}>1R Planned Risk</div>
                  <div className={cockpitStyles.metricValue}>
                    {planFact.baseline.originalPlannedRiskDisplay}
                  </div>
                </div>
                <div className={cockpitStyles.metricBox}>
                  <div className={cockpitStyles.metricLabel}>Planned Reward</div>
                  <div className={cockpitStyles.metricValue}>
                    {planFact.baseline.originalPlannedRewardDisplay}
                  </div>
                </div>
                <div className={cockpitStyles.metricBox}>
                  <div className={cockpitStyles.metricLabel}>Planned R:R</div>
                  <div className={cockpitStyles.metricValue}>
                    {planFact.baseline.plannedRewardToRiskDisplay}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <div className={cockpitStyles.metricLabel}>Thesis</div>
                <p style={{ margin: '4px 0 14px' }}>{planFact.thesis}</p>

                <div className={cockpitStyles.metricLabel}>Invalidation</div>
                <p style={{ margin: '4px 0 0' }}>{planFact.invalidation}</p>
              </div>
            </div>
          ) : (
            <div role="tabpanel" aria-label="Journal">
              {journalEntries.map((entry) => (
                <article key={entry.id} className={styles.card}>
                  <div className={styles.spaceBetween} style={{ marginBottom: 10 }}>
                    <h2 className={styles.cardTitle} style={{ margin: 0 }}>
                      {entry.definitionSnapshot.label}
                    </h2>
                    <span className={styles.pill}>{entry.source}</span>
                  </div>
                  <dl style={{ margin: 0 }}>
                    {entry.definitionSnapshot.prompts.map((prompt) => {
                      const val = entry.responses[prompt.promptId];
                      return (
                        <div key={prompt.promptId} style={{ marginBottom: 10 }}>
                          <dt className={styles.muted} style={{ fontWeight: 600 }}>
                            {prompt.label}
                          </dt>
                          <dd style={{ margin: '2px 0 0' }}>
                            {val === undefined || val === '' ? (
                              <span className={styles.muted}>Unanswered</span>
                            ) : (
                              String(val)
                            )}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
