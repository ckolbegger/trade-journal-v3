import { useCallback, useEffect, useRef, useState } from 'react';
import type { Journal } from '../../journal/journal';
import { formatSessionDateShort } from '../../market-data/session-calendar';
import type { Clock } from '../../shared/clock';
import { ExactNumber, isPositive, sub, toDecimalString } from '../../shared/exact-number';
import type {
  TradeDetailCockpitViewModel,
  TradeViewsAndReporting,
} from '../../trade-views/trade-views';
import type { TradeWorkflows } from '../../trade-workflows/trade-workflows';
import styles from '../shell/AppShell.module.css';
import cockpitStyles from './Cockpit.module.css';
import { PriceTrack } from './PriceTrack';
import { RecordEntryPanel } from './RecordEntryPanel';

type CockpitDrawer = 'today' | 'position' | 'plan' | 'history' | 'journal';

interface TradeDetailCockpitProps {
  readonly tradeId: string;
  readonly views: TradeViewsAndReporting;
  readonly journal: Journal;
  readonly workflows: TradeWorkflows;
  readonly clock: Clock;
  readonly writable: boolean;
  readonly refreshKey: number;
  readonly onBack: () => void;
  readonly onGoToReview: () => void;
  readonly onTradeMutated: () => void;
  readonly onDirtyChange: (dirty: boolean) => void;
}

function formatShortTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function TradeDetailCockpit({
  tradeId,
  views,
  journal,
  workflows,
  clock,
  writable,
  refreshKey,
  onBack,
  onGoToReview,
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

  useEffect(() => {
    if (refreshKey > 0) {
      void loadDetail();
    }
  }, [refreshKey, loadDetail]);

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

  const {
    trade,
    planFact,
    derived,
    evaluation,
    priceHistory,
    journalEntries,
    journalDebt,
    journalDeclines,
  } = detail;
  const outstandingDebt = journalDebt.filter((d) => d.status === 'Outstanding');
  const hasPositionDrawer = derived.openLots.length > 0 || trade.lifecycleState === 'Open';
  const hasTodayDrawer = trade.lifecycleState === 'Open';
  const hasHistoryDrawer = trade.lifecycleState === 'Open' && priceHistory.length > 0;
  const canRecordEntry =
    writable &&
    !derived.integrityDisagreement &&
    (trade.lifecycleState === 'Planned' || trade.lifecycleState === 'Open');

  const defaultEntryPriceNumeric = toDecimalString(
    ExactNumber.fromJSON(trade.intendedEntryPrice),
    2,
  );
  const remainingPlanned = sub(ExactNumber.fromJSON(trade.plannedQuantity), derived.openShares);
  const defaultEntryQuantity = isPositive(remainingPlanned)
    ? remainingPlanned.den === 1n
      ? remainingPlanned.num.toString()
      : toDecimalString(remainingPlanned, 4).replace(/\.?0+$/, '')
    : '';

  const liveEval = evaluation?.availability === 'Available' ? evaluation : null;
  const priorFallback =
    evaluation?.availability === 'Unavailable' ? evaluation.priorContext : null;
  const displayEval = liveEval ?? priorFallback?.evaluation ?? null;

  return (
    <section aria-labelledby="cockpit-symbol-heading">
      <div style={{ marginBottom: 12 }}>
        <button type="button" className={styles.btnSecondary} onClick={onBack}>
          ← Back to Trades
        </button>
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
        {/* Sticky left State-of-Play rail — stacked white cards matching prototypes/trade-detail/index.html C. Cockpit */}
        <aside className={cockpitStyles.rail} aria-label="Trade state of play">
          {/* Card 1: Identity & Primary Actions */}
          <div className={cockpitStyles.railCard}>
            <div className={styles.spaceBetween}>
              <h1 id="cockpit-symbol-heading" className={cockpitStyles.railSymbol}>
                {trade.symbol}
              </h1>
              <span
                className={`${styles.pill} ${
                  trade.lifecycleState === 'Open' ? styles.pillInfo : ''
                }`}
              >
                {trade.lifecycleState}
              </span>
            </div>
            <div className={styles.muted} style={{ marginTop: 4 }}>
              <div>
                {detail.strategyLabel}, {trade.lifecycleState}
              </div>
              <div>
                {detail.institutionLabel}, {detail.accountLabel}
              </div>
            </div>
            {canRecordEntry && !showRecordEntry && (
              <div className={cockpitStyles.railActions}>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={() => setShowRecordEntry(true)}
                >
                  Record entry
                </button>
              </div>
            )}
          </div>

          {/* Card 2: P&L & Open Shares (with OV-04 dated prior-session fallback when today's Mark is missing) */}
          <div className={cockpitStyles.railCard}>
            {liveEval ? (
              <>
                <div
                  className={`${cockpitStyles.railPnl} ${
                    liveEval.openPnl.num >= 0n ? cockpitStyles.up : cockpitStyles.down
                  }`}
                >
                  {liveEval.openPnlDisplay}
                </div>
                <div className={styles.muted} style={{ marginTop: 4 }}>
                  <strong>{liveEval.openPnlRDisplay}</strong>
                  {liveEval.dailyChangeDisplay && liveEval.priorSessionDate ? (
                    <span
                      className={
                        liveEval.dailyChange && liveEval.dailyChange.num >= 0n
                          ? cockpitStyles.up
                          : cockpitStyles.down
                      }
                      style={{ marginLeft: 8 }}
                    >
                      {liveEval.dailyChangeDisplay} since{' '}
                      {formatSessionDateShort(liveEval.priorSessionDate)}
                    </span>
                  ) : (
                    <span style={{ marginLeft: 8 }}>
                      Mark {liveEval.currentMarkDisplay} ({detail.expectedSessionDateShort})
                    </span>
                  )}
                </div>
              </>
            ) : priorFallback ? (
              <>
                <div className={`${cockpitStyles.railPnl} ${cockpitStyles.faded}`}>
                  {priorFallback.evaluation.openPnlDisplay}
                </div>
                <div style={{ marginTop: 6 }}>
                  <span className={`${styles.pill} ${styles.pillWarning}`}>
                    {evaluation?.availability === 'Unavailable' &&
                    evaluation.acknowledgedUnavailable
                      ? 'No price today'
                      : 'Marks needed'}
                  </span>
                </div>
                <div className={styles.muted} style={{ marginTop: 4 }}>
                  At the {formatSessionDateShort(priorFallback.asOfSessionDate)} Marks (today
                  Unavailable)
                </div>
              </>
            ) : (
              <>
                <div className={cockpitStyles.railPnl}>—</div>
                <div className={styles.muted} style={{ marginTop: 4 }}>
                  {trade.lifecycleState === 'Planned'
                    ? 'Trade P&L once the entry is recorded and marked'
                    : 'No Marks yet — enter Marks in Review to compute P&L'}
                </div>
              </>
            )}
            <div className={styles.mono} style={{ marginTop: 8, fontWeight: 600 }}>
              {derived.openSharesDisplay} of {detail.plannedQuantityDisplay} shares open
            </div>
          </div>

          {/* Card 3: Needs you (only when Outstanding Debt exists) */}
          {outstandingDebt.length > 0 && (
            <div className={cockpitStyles.railCard}>
              <h2 className={styles.cardTitle}>Needs you</h2>
              <ul className={cockpitStyles.todoList}>
                <li className={cockpitStyles.todoDue}>
                  Needs you · {outstandingDebt.length} reflection deferred (due in next Review)
                </li>
              </ul>
            </div>
          )}

          {/* Card 4: Conditions */}
          <div className={cockpitStyles.railCard}>
            <div className={styles.spaceBetween} style={{ marginBottom: 8 }}>
              <h2 className={styles.cardTitle} style={{ margin: 0 }}>
                Conditions
              </h2>
              {!liveEval && priorFallback && (
                <span className={styles.muted} style={{ fontSize: '0.76rem' }}>
                  At {formatSessionDateShort(priorFallback.asOfSessionDate)}
                </span>
              )}
            </div>
            <ul
              className={`${cockpitStyles.conditionList} ${
                !liveEval && priorFallback ? cockpitStyles.faded : ''
              }`}
            >
              <li className={cockpitStyles.conditionItem}>
                <span>
                  <span className={`${styles.pill} ${styles.pillDanger}`}>
                    {displayEval?.stopCondition.status === 'Breached' ? 'Stop Breached' : 'Stop'}
                  </span>
                  {displayEval?.stopCondition.nearest && (
                    <span className={cockpitStyles.near}>nearest</span>
                  )}
                </span>
                <span
                  className={`${cockpitStyles.condFig} ${
                    !displayEval || displayEval.stopCondition.impactDollars.num < 0n
                      ? cockpitStyles.down
                      : cockpitStyles.up
                  }`}
                >
                  {displayEval
                    ? `${displayEval.stopCondition.impactDisplay} (${displayEval.stopCondition.impactRDisplay})`
                    : `-${planFact.baseline.originalPlannedRiskDisplay} (-1.00R)`}
                </span>
                <span className={cockpitStyles.condWhat}>
                  {trade.symbol} at or below {detail.stopPriceDisplay}
                </span>
                {displayEval?.stopCondition.overrunDisplay && (
                  <span className={`${styles.muted} ${cockpitStyles.down}`} style={{ gridColumn: '1 / -1' }}>
                    Overrun past Stop: {displayEval.stopCondition.overrunDisplay}
                  </span>
                )}
              </li>

              <li className={cockpitStyles.conditionItem}>
                <span>
                  <span className={`${styles.pill} ${styles.pillSuccess}`}>
                    {displayEval?.targetCondition.status === 'Reached'
                      ? 'Target Reached'
                      : 'Target'}
                  </span>
                  {displayEval?.targetCondition.nearest && (
                    <span className={cockpitStyles.near}>nearest</span>
                  )}
                </span>
                <span
                  className={`${cockpitStyles.condFig} ${
                    !displayEval || displayEval.targetCondition.impactDollars.num >= 0n
                      ? cockpitStyles.up
                      : cockpitStyles.down
                  }`}
                >
                  {displayEval
                    ? `${displayEval.targetCondition.impactDisplay} (${displayEval.targetCondition.impactRDisplay})`
                    : `+${planFact.baseline.originalPlannedRewardDisplay} (+${planFact.baseline.plannedRewardToRiskDisplay})`}
                </span>
                <span className={cockpitStyles.condWhat}>
                  {trade.symbol} at or above {detail.targetPriceDisplay}
                </span>
              </li>
            </ul>

            <div className={cockpitStyles.extremes}>
              {displayEval ? (
                <>
                  <div>
                    <strong>Worst case:</strong> {displayEval.worstCaseRiskDisplay} ·{' '}
                    {displayEval.worstCaseRiskRDisplay} if {trade.symbol} goes to zero
                  </div>
                  <div>
                    <strong>Max reward:</strong> no cap above
                  </div>
                </>
              ) : (
                'Distances to each condition arrive with the first Marks after entry.'
              )}
            </div>
          </div>
        </aside>

        {/* Right conditional tabbed drawers */}
        <div className={cockpitStyles.drawerColumn}>
          <div className={cockpitStyles.tabBar} role="tablist" aria-label="Trade detail drawers">
            {hasTodayDrawer && (
              <button
                type="button"
                role="tab"
                aria-selected={activeDrawer === 'today'}
                className={`${cockpitStyles.tabButton} ${
                  activeDrawer === 'today' ? cockpitStyles.tabButtonActive : ''
                }`}
                onClick={() => setActiveDrawer('today')}
              >
                Today
              </button>
            )}
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
            {hasHistoryDrawer && (
              <button
                type="button"
                role="tab"
                aria-selected={activeDrawer === 'history'}
                className={`${cockpitStyles.tabButton} ${
                  activeDrawer === 'history' ? cockpitStyles.tabButtonActive : ''
                }`}
                onClick={() => setActiveDrawer('history')}
              >
                Price History
              </button>
            )}
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

          {activeDrawer === 'today' && hasTodayDrawer && (
            <div className={styles.card} role="tabpanel" aria-label="Today">
              {liveEval ? (
                <>
                  <h2 className={styles.cardTitle}>
                    Marks: {detail.expectedSessionDateShort}
                    {liveEval.priorSessionDate
                      ? ` against ${formatSessionDateShort(liveEval.priorSessionDate)}`
                      : ''}
                  </h2>
                  <table className={styles.table} aria-label="Today mark comparison">
                    <thead>
                      <tr>
                        <th>Instrument</th>
                        <th>
                          {liveEval.priorSessionDate
                            ? formatSessionDateShort(liveEval.priorSessionDate)
                            : 'Prior'}
                        </th>
                        <th>{detail.expectedSessionDateShort}</th>
                        <th>Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          <strong>{trade.symbol} Mark</strong>
                        </td>
                        <td className={styles.mono}>{liveEval.priorMarkDisplay ?? '—'}</td>
                        <td className={styles.mono}>
                          <strong>{liveEval.currentMarkDisplay}</strong>
                        </td>
                        <td className={styles.mono}>{liveEval.markChangeDisplay ?? '—'}</td>
                      </tr>
                    </tbody>
                  </table>

                  {derived.averageEntryPrice && (
                    <div style={{ marginTop: 20 }}>
                      <h3 className={styles.cardTitle}>Where the price sits</h3>
                      <PriceTrack
                        symbol={trade.symbol}
                        stopPrice={ExactNumber.fromJSON(trade.stopPrice)}
                        targetPrice={ExactNumber.fromJSON(trade.targetPrice)}
                        entryPrice={derived.averageEntryPrice}
                        currentMark={liveEval.currentMark}
                        priorMark={liveEval.priorMark}
                        priorLabel={
                          liveEval.priorSessionDate
                            ? formatSessionDateShort(liveEval.priorSessionDate)
                            : null
                        }
                      />
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <h2 className={styles.cardTitle}>
                    Marks needed for {detail.expectedSessionDateShort}
                  </h2>
                  <p className={styles.muted} style={{ marginBottom: 12 }}>
                    Today&apos;s authoritative valuation is Unavailable until a closing Mark is
                    entered in Review.
                  </p>
                  <button type="button" className={styles.btnPrimary} onClick={onGoToReview}>
                    Enter Marks in the Review
                  </button>
                </div>
              )}
            </div>
          )}

          {activeDrawer === 'position' && hasPositionDrawer && (
            <div className={styles.card} role="tabpanel" aria-label="Position">
              <div className={styles.spaceBetween} style={{ marginBottom: 12 }}>
                <h2 className={styles.cardTitle} style={{ margin: 0 }}>
                  Open Lots &amp; Executions
                </h2>
                {!liveEval && <span className={styles.pill}>No Marks yet</span>}
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className={styles.table} aria-label="Open lots">
                  <thead>
                    <tr>
                      <th>Open lot</th>
                      <th>Shares</th>
                      <th>Price</th>
                      <th>Fee left</th>
                      <th>Intent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {derived.openLots.map((lot) => (
                      <tr key={lot.executionId}>
                        <td className={styles.muted}>{formatShortTimestamp(lot.economicTime)}</td>
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

              <dl className={cockpitStyles.kv} style={{ marginTop: 14 }}>
                <dt>Average entry fill</dt>
                <dd>{derived.averageEntryPriceDisplay}</dd>
                <dt>Opening fees paid</dt>
                <dd>{derived.totalOpeningFeesDisplay}</dd>
                <dt>Planned leg fulfillment</dt>
                <dd>{derived.fulfillment}</dd>
              </dl>
            </div>
          )}

          {activeDrawer === 'plan' && (
            <div className={styles.card} role="tabpanel" aria-label="Plan and Risk">
              <div className={cockpitStyles.kvGroup}>
                <h2 className={cockpitStyles.kvGroupTitle}>Frozen Plan Baseline</h2>
                <dl className={cockpitStyles.kv}>
                  <dt>Intended entry</dt>
                  <dd>
                    {detail.plannedQuantityDisplay} shares @ {detail.intendedEntryDisplay}
                  </dd>
                  <dt>1R (original risk)</dt>
                  <dd>{planFact.baseline.originalPlannedRiskDisplay}</dd>
                  <dt>Original reward</dt>
                  <dd>{planFact.baseline.originalPlannedRewardDisplay}</dd>
                  <dt>Planned reward : risk</dt>
                  <dd>{planFact.baseline.plannedRewardToRiskDisplay}</dd>
                </dl>
              </div>

              {derived.entryQuality ? (
                <div className={cockpitStyles.kvGroup}>
                  <h3 className={cockpitStyles.kvGroupTitle}>Entry Quality vs. Plan</h3>
                  <dl className={cockpitStyles.kv}>
                    <dt>Average fill</dt>
                    <dd>{derived.entryQuality.averageEntryPriceDisplay}</dd>
                    <dt>Slippage / share</dt>
                    <dd>{derived.entryQuality.slippagePerShareDisplay}</dd>
                    <dt>Actual initial risk</dt>
                    <dd>{derived.entryQuality.actualInitialRiskDisplay}</dd>
                    <dt>Actual initial reward</dt>
                    <dd>{derived.entryQuality.actualInitialRewardDisplay}</dd>
                    <dt>Actual reward : risk</dt>
                    <dd>{derived.entryQuality.actualInitialRRDisplay}</dd>
                    <dt>Size vs. planned</dt>
                    <dd>{derived.entryQuality.sizeVsPlannedDisplay}</dd>
                  </dl>
                </div>
              ) : (
                <div className={cockpitStyles.kvGroup}>
                  <h3 className={cockpitStyles.kvGroupTitle}>Entry</h3>
                  <dl className={cockpitStyles.kv}>
                    <dt>Status</dt>
                    <dd>Not entered</dd>
                  </dl>
                </div>
              )}

              {derived.deviations.length > 0 && (
                <div className={styles.alertError} style={{ marginTop: 14 }}>
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

              <div className={cockpitStyles.kvGroup}>
                <h3 className={cockpitStyles.kvGroupTitle}>Thesis &amp; Invalidation</h3>
                <div className={styles.muted} style={{ fontWeight: 600 }}>
                  Why this trade, why now?
                </div>
                <p style={{ margin: '3px 0 12px' }}>{planFact.thesis}</p>

                <div className={styles.muted} style={{ fontWeight: 600 }}>
                  What would invalidate the thesis?
                </div>
                <p style={{ margin: '3px 0 0' }}>{planFact.invalidation}</p>
              </div>
            </div>
          )}

          {activeDrawer === 'history' && hasHistoryDrawer && (
            <div className={styles.card} role="tabpanel" aria-label="Price History">
              <div className={styles.spaceBetween} style={{ marginBottom: 12 }}>
                <h2 className={styles.cardTitle} style={{ margin: 0 }}>
                  Price History (Completed Sessions)
                </h2>
                <button type="button" className={styles.btnSecondary} onClick={onGoToReview}>
                  Enter Marks in the Review
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className={styles.table} aria-label="Price history">
                  <thead>
                    <tr>
                      <th>Session</th>
                      <th>{trade.symbol} Mark</th>
                      <th>Trade P&amp;L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {priceHistory.map((row) => (
                      <tr key={row.sessionDate}>
                        <td>{row.sessionDateShort}</td>
                        <td className={styles.mono}>
                          {row.markDisplay ?? (
                            <span className={styles.muted}>
                              {row.unavailableAcknowledged ? 'No price' : '—'}
                            </span>
                          )}
                        </td>
                        <td className={styles.mono}>
                          {row.tradePnlDisplay ? (
                            <span
                              className={
                                row.tradePnlPositive ? cockpitStyles.up : cockpitStyles.down
                              }
                            >
                              {row.tradePnlDisplay}
                            </span>
                          ) : (
                            <span className={styles.muted}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeDrawer === 'journal' && (
            <div className={styles.card} role="tabpanel" aria-label="Journal">
              <ol className={cockpitStyles.journalList}>
                {outstandingDebt.map((debt) => (
                  <li key={debt.id}>
                    <span className={cockpitStyles.jWhen}>
                      {formatShortTimestamp(debt.createdAt)}
                    </span>
                    <div className={cockpitStyles.jBody}>
                      <div className={styles.spaceBetween}>
                        <span className={cockpitStyles.jType}>{debt.definitionSnapshot.label}</span>
                        <span className={`${styles.pill} ${styles.pillWarning}`}>
                          Deferred · Due in next Review
                        </span>
                      </div>
                      <p className={styles.muted} style={{ margin: '4px 0 0' }}>
                        Reflection deferred during market hours; original trigger-time prompts are
                        preserved for after-close Review.
                      </p>
                    </div>
                  </li>
                ))}

                {journalDeclines.map((dec) => (
                  <li key={dec.id}>
                    <span className={cockpitStyles.jWhen}>
                      {formatShortTimestamp(dec.recordedAt)}
                    </span>
                    <div className={cockpitStyles.jBody}>
                      <div className={styles.spaceBetween}>
                        <span className={cockpitStyles.jType}>Position Change Reflection</span>
                        <span className={styles.pill}>Declined</span>
                      </div>
                      <p className={styles.muted} style={{ margin: '4px 0 0' }}>
                        {dec.reason
                          ? `Reason: ${dec.reason}`
                          : 'Explicitly declined with no reason.'}
                      </p>
                    </div>
                  </li>
                ))}

                {journalEntries.map((entry) => (
                  <li key={entry.id}>
                    <span className={cockpitStyles.jWhen}>
                      {formatShortTimestamp(entry.recordedAt)}
                    </span>
                    <div className={cockpitStyles.jBody}>
                      <div className={styles.spaceBetween} style={{ marginBottom: 6 }}>
                        <span className={cockpitStyles.jType}>{entry.definitionSnapshot.label}</span>
                        <span className={styles.pill}>{entry.source}</span>
                      </div>
                      <dl style={{ margin: 0 }}>
                        {entry.definitionSnapshot.prompts.map((prompt) => {
                          const val = entry.responses[prompt.promptId];
                          return (
                            <div key={prompt.promptId} style={{ marginBottom: 6 }}>
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
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
