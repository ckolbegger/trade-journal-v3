import { useCallback, useEffect, useRef, useState } from 'react';
import type { Journal } from '../../journal/journal';
import type { Clock } from '../../shared/clock';
import { ExactNumber, isPositive, sub, toDecimalString } from '../../shared/exact-number';
import type {
  TradeDetailCockpitViewModel,
  TradeViewsAndReporting,
} from '../../trade-views/trade-views';
import type { TradeWorkflows } from '../../trade-workflows/trade-workflows';
import styles from '../shell/AppShell.module.css';
import cockpitStyles from './Cockpit.module.css';
import { RecordEntryPanel } from './RecordEntryPanel';

type CockpitDrawer = 'position' | 'plan' | 'journal';

interface TradeDetailCockpitProps {
  readonly tradeId: string;
  readonly views: TradeViewsAndReporting;
  readonly journal: Journal;
  readonly workflows: TradeWorkflows;
  readonly clock: Clock;
  readonly writable: boolean;
  readonly onBack: () => void;
  readonly onTradeMutated: () => void;
  readonly onDirtyChange: (dirty: boolean) => void;
}

export function TradeDetailCockpit({
  tradeId,
  views,
  journal,
  workflows,
  clock,
  writable,
  onBack,
  onTradeMutated,
  onDirtyChange,
}: TradeDetailCockpitProps) {
  const loadSeqRef = useRef(0);
  const [detail, setDetail] = useState<TradeDetailCockpitViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDrawer, setActiveDrawer] = useState<CockpitDrawer>('plan');
  const [showRecordEntry, setShowRecordEntry] = useState(false);

  const loadDetail = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    try {
      const res = await views.getTradeDetail(tradeId);
      if (seq !== loadSeqRef.current) return;
      setDetail(res);
      setError(res ? null : 'Trade not found.');
    } catch (err) {
      if (seq !== loadSeqRef.current) return;
      setError(err instanceof Error ? err.message : 'Unable to load trade detail.');
    } finally {
      if (seq === loadSeqRef.current) {
        setLoading(false);
      }
    }
  }, [tradeId, views]);

  useEffect(() => {
    setLoading(true);
    setShowRecordEntry(false);
    setActiveDrawer('plan');
    void loadDetail();
  }, [loadDetail]);

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

  const { trade, planFact, derived, journalEntries, journalDebt, journalDeclines } = detail;
  const outstandingDebt = journalDebt.filter((d) => d.status === 'Outstanding');
  const hasPositionDrawer = derived.openLots.length > 0 || trade.lifecycleState === 'Open';
  const canRecordEntry =
    writable &&
    !derived.integrityDisagreement &&
    (trade.lifecycleState === 'Planned' || trade.lifecycleState === 'Open');

  const defaultEntryPriceNumeric = toDecimalString(ExactNumber.fromJSON(trade.intendedEntryPrice), 2);
  const remainingPlanned = sub(ExactNumber.fromJSON(trade.plannedQuantity), derived.openShares);
  const defaultEntryQuantity = isPositive(remainingPlanned)
    ? remainingPlanned.den === 1n
      ? remainingPlanned.num.toString()
      : toDecimalString(remainingPlanned, 4).replace(/\.?0+$/, '')
    : '';

  return (
    <section aria-labelledby="cockpit-symbol-heading">
      <div className={styles.spaceBetween} style={{ marginBottom: 14 }}>
        <button type="button" className={styles.btnSecondary} onClick={onBack}>
          ← Back to Trades
        </button>
        {canRecordEntry && !showRecordEntry && (
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => setShowRecordEntry(true)}
          >
            Record entry
          </button>
        )}
      </div>

      {derived.integrityDisagreement && (
        <div className={styles.alertError} role="alert">
          <strong>Facts can&apos;t be replayed:</strong> Stored lifecycle state (
          {trade.lifecycleState}) disagrees with derived position facts (
          {derived.derivedLifecycleState}). This Trade is read-only until inspected; no automatic
          repair has been applied.
        </div>
      )}

      {showRecordEntry && (
        <RecordEntryPanel
          tradeId={trade.id}
          symbol={trade.symbol}
          expectedFactRevision={trade.factRevision}
          defaultQuantity={defaultEntryQuantity}
          defaultPrice={defaultEntryPriceNumeric}
          journal={journal}
          workflows={workflows}
          clock={clock}
          writable={writable}
          onRecorded={() => {
            setShowRecordEntry(false);
            setActiveDrawer('position');
            void loadDetail();
            onTradeMutated();
          }}
          onConflict={() => {
            void loadDetail();
          }}
          onCancel={() => setShowRecordEntry(false)}
          onDirtyChange={onDirtyChange}
        />
      )}

      <div className={cockpitStyles.cockpitGrid}>
        {/* Sticky left State-of-Play rail (C. Cockpit — OV-01) */}
        <aside className={cockpitStyles.rail} aria-label="Trade state of play">
          <div className={styles.spaceBetween}>
            <h1 id="cockpit-symbol-heading" className={cockpitStyles.railSymbol}>
              {trade.symbol}
            </h1>
            <span
              className={`${styles.pill} ${
                trade.lifecycleState === 'Open' ? styles.pillSuccess : ''
              }`}
            >
              {trade.lifecycleState}
            </span>
          </div>

          <div className={styles.muted}>
            <div>{detail.strategyLabel}</div>
            <div>
              {detail.institutionLabel} — {detail.accountLabel}
            </div>
          </div>

          <div className={styles.mono}>
            <strong>
              {derived.openSharesDisplay} of {detail.plannedQuantityDisplay} shares open
            </strong>
          </div>

          {outstandingDebt.length > 0 && (
            <div className={`${styles.pill} ${styles.pillWarning}`}>
              Needs you · {outstandingDebt.length} reflection deferred (due in next Review)
            </div>
          )}

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
            {hasPositionDrawer && (
              <button
                type="button"
                role="tab"
                aria-selected={activeDrawer === 'position'}
                className={`${cockpitStyles.tabButton} ${
                  activeDrawer === 'position' ? cockpitStyles.tabButtonActive : ''
                }`}
                onClick={() => setActiveDrawer('position')}
              >
                Position ({derived.openLots.length})
              </button>
            )}
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
              Journal ({journalEntries.length + outstandingDebt.length + journalDeclines.length})
            </button>
          </div>

          {activeDrawer === 'position' && hasPositionDrawer && (
            <div className={styles.card} role="tabpanel" aria-label="Position">
              <div className={styles.spaceBetween} style={{ marginBottom: 12 }}>
                <h2 className={styles.cardTitle} style={{ margin: 0 }}>
                  Open Lots &amp; Executions
                </h2>
                <span className={styles.pill}>No Marks yet</span>
              </div>

              <div className={cockpitStyles.metricGrid}>
                <div className={cockpitStyles.metricBox}>
                  <div className={cockpitStyles.metricLabel}>Avg Entry Fill</div>
                  <div className={cockpitStyles.metricValue}>
                    {derived.averageEntryPriceDisplay}
                  </div>
                </div>
                <div className={cockpitStyles.metricBox}>
                  <div className={cockpitStyles.metricLabel}>Opening Fees Paid</div>
                  <div className={cockpitStyles.metricValue}>
                    {derived.totalOpeningFeesDisplay}
                  </div>
                </div>
                <div className={cockpitStyles.metricBox}>
                  <div className={cockpitStyles.metricLabel}>Fulfillment</div>
                  <div className={cockpitStyles.metricValue} style={{ fontSize: '0.95rem' }}>
                    {derived.fulfillment}
                  </div>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className={styles.table} aria-label="Open lots">
                  <thead>
                    <tr>
                      <th>Shares</th>
                      <th>Fill Price</th>
                      <th>Opening Fee</th>
                      <th>Intent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {derived.openLots.map((lot) => (
                      <tr key={lot.executionId}>
                        <td className={styles.mono}>{lot.quantityDisplay}</td>
                        <td className={styles.mono}>{lot.fillPriceDisplay}</td>
                        <td className={styles.mono}>{lot.unconsumedOpeningFeeDisplay}</td>
                        <td>
                          <span className={styles.pill}>{lot.plannedLegIntent}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeDrawer === 'plan' && (
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

              {derived.entryQuality && (
                <div style={{ marginTop: 18 }}>
                  <h3 className={styles.cardTitle}>Entry Quality vs. Plan</h3>
                  <div className={cockpitStyles.metricGrid}>
                    <div className={cockpitStyles.metricBox}>
                      <div className={cockpitStyles.metricLabel}>Actual Avg Fill</div>
                      <div className={cockpitStyles.metricValue}>
                        {derived.entryQuality.averageEntryPriceDisplay}
                      </div>
                    </div>
                    <div className={cockpitStyles.metricBox}>
                      <div className={cockpitStyles.metricLabel}>Slippage / Share</div>
                      <div className={cockpitStyles.metricValue}>
                        {derived.entryQuality.slippagePerShareDisplay}
                      </div>
                    </div>
                    <div className={cockpitStyles.metricBox}>
                      <div className={cockpitStyles.metricLabel}>Actual Initial Risk</div>
                      <div className={cockpitStyles.metricValue}>
                        {derived.entryQuality.actualInitialRiskDisplay}
                      </div>
                    </div>
                    <div className={cockpitStyles.metricBox}>
                      <div className={cockpitStyles.metricLabel}>Size vs. Planned</div>
                      <div className={cockpitStyles.metricValue} style={{ fontSize: '0.95rem' }}>
                        {derived.entryQuality.sizeVsPlannedDisplay}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {derived.deviations.length > 0 && (
                <div className={styles.alertError} style={{ marginTop: 12 }}>
                  <strong>Fact-Only Deviations:</strong>
                  <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                    {derived.deviations.map((dev, idx) => (
                      <li key={idx}>
                        <strong>{dev.kind}:</strong> {dev.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div style={{ marginTop: 14 }}>
                <div className={cockpitStyles.metricLabel}>Thesis</div>
                <p style={{ margin: '4px 0 14px' }}>{planFact.thesis}</p>

                <div className={cockpitStyles.metricLabel}>Invalidation</div>
                <p style={{ margin: '4px 0 0' }}>{planFact.invalidation}</p>
              </div>
            </div>
          )}

          {activeDrawer === 'journal' && (
            <div role="tabpanel" aria-label="Journal">
              {outstandingDebt.map((debt) => (
                <article key={debt.id} className={styles.card}>
                  <div className={styles.spaceBetween}>
                    <h2 className={styles.cardTitle} style={{ margin: 0 }}>
                      {debt.definitionSnapshot.label}
                    </h2>
                    <span className={`${styles.pill} ${styles.pillWarning}`}>
                      Deferred · Due in next Review
                    </span>
                  </div>
                  <p className={styles.muted} style={{ marginBottom: 0 }}>
                    Reflection was deferred during market-hours capture. Original trigger-time
                    prompts are preserved for after-close Review.
                  </p>
                </article>
              ))}

              {journalDeclines.map((dec) => (
                <article key={dec.id} className={styles.card}>
                  <div className={styles.spaceBetween}>
                    <h2 className={styles.cardTitle} style={{ margin: 0 }}>
                      Position Change Reflection
                    </h2>
                    <span className={styles.pill}>Declined</span>
                  </div>
                  <p className={styles.muted} style={{ marginBottom: 0 }}>
                    {dec.reason ? `Reason: ${dec.reason}` : 'Explicitly declined with no reason.'}
                  </p>
                </article>
              ))}

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
