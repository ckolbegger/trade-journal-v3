import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReferenceCatalog } from '../../catalog/reference-catalog';
import type { Journal } from '../../journal/journal';
import { formatSessionDateShort } from '../../market-data/session-calendar';
import type { CloseReasonRecord } from '../../persistence/idb';
import type { Clock } from '../../shared/clock';
import {
  ExactNumber,
  formatQuantityString,
  isPositive,
  sub,
  toDecimalString,
  toMoneyString,
} from '../../shared/exact-number';
import type {
  TradeDetailCockpitViewModel,
  TradeViewsAndReporting,
} from '../../trade-views/trade-views';
import type { TradeWorkflows } from '../../trade-workflows/trade-workflows';
import styles from '../shell/AppShell.module.css';
import cockpitStyles from './Cockpit.module.css';
import { PriceTrack } from './PriceTrack';
import { RecordEntryPanel } from './RecordEntryPanel';
import { RecordExitPanel } from './RecordExitPanel';

export type CockpitDrawer = 'today' | 'position' | 'plan' | 'history' | 'journal';

interface TradeDetailCockpitProps {
  readonly tradeId: string;
  readonly views: TradeViewsAndReporting;
  readonly catalog: ReferenceCatalog;
  readonly journal: Journal;
  readonly workflows: TradeWorkflows;
  readonly clock: Clock;
  readonly writable: boolean;
  readonly refreshKey: number;
  readonly requestedDrawer?: {
    readonly tradeId: string;
    readonly drawer: CockpitDrawer;
    readonly requestKey: number;
  } | null;
  readonly onBack: () => void;
  readonly onGoToReview: () => void;
  readonly onOpenReplay: (tradeId: string, triggerEl?: HTMLElement | null) => void;
  readonly onDrawerRequestConsumed?: (requestKey: number) => void;
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

function formatScalingLabel(scaling: string | null): string {
  if (!scaling) return '—';
  if (scaling === 'SingleEntrySingleExit') return 'Single entry, single exit';
  if (scaling === 'Scaled') return 'Scaled';
  return scaling;
}

export function TradeDetailCockpit({
  tradeId,
  views,
  catalog,
  journal,
  workflows,
  clock,
  writable,
  refreshKey,
  requestedDrawer,
  onBack,
  onGoToReview,
  onOpenReplay,
  onDrawerRequestConsumed,
  onTradeMutated,
  onDirtyChange,
}: TradeDetailCockpitProps) {
  const loadSeqRef = useRef(0);
  const lastAppliedDrawerKeyRef = useRef<number | null>(null);
  const pendingHistoryFocusRef = useRef(false);
  const historyHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const positionHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const [detail, setDetail] = useState<TradeDetailCockpitViewModel | null>(null);
  const [closeReasons, setCloseReasons] = useState<readonly CloseReasonRecord[]>([]);
  const [closeReasonsUnavailable, setCloseReasonsUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDrawer, setActiveDrawer] = useState<CockpitDrawer>('plan');
  const [showRecordEntry, setShowRecordEntry] = useState(false);
  const [showRecordExit, setShowRecordExit] = useState(false);

  const loadDetail = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    try {
      const [res, crRes] = await Promise.all([
        views.getTradeDetail(tradeId),
        catalog
          .query({ family: 'CloseReason', includeInactive: false })
          .then((r) => ({ ok: true as const, r }))
          .catch(() => ({ ok: false as const })),
      ]);
      if (seq !== loadSeqRef.current) return;
      setDetail(res);
      if (crRes.ok) {
        if (crRes.r.family === 'CloseReason') {
          setCloseReasons(crRes.r.items);
          setCloseReasonsUnavailable(false);
        }
      } else {
        setCloseReasonsUnavailable(true);
      }
      if (res?.trade.lifecycleState === 'Closed') {
        setActiveDrawer((prev) => (prev === 'today' ? 'position' : prev));
      }
      setError(res ? null : 'Trade not found.');
    } catch (err) {
      if (seq !== loadSeqRef.current) return;
      setError(err instanceof Error ? err.message : 'Unable to load trade detail.');
    } finally {
      if (seq === loadSeqRef.current) {
        setLoading(false);
      }
    }
  }, [tradeId, views, catalog]);

  useEffect(() => {
    pendingHistoryFocusRef.current = false;
    setLoading(true);
    setShowRecordEntry(false);
    setShowRecordExit(false);
    setActiveDrawer('plan');
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (
      requestedDrawer &&
      requestedDrawer.tradeId === tradeId &&
      requestedDrawer.requestKey !== lastAppliedDrawerKeyRef.current
    ) {
      lastAppliedDrawerKeyRef.current = requestedDrawer.requestKey;
      setActiveDrawer(requestedDrawer.drawer);
      if (requestedDrawer.drawer === 'history') {
        pendingHistoryFocusRef.current = true;
      }
      onDrawerRequestConsumed?.(requestedDrawer.requestKey);
    }
  }, [tradeId, requestedDrawer, onDrawerRequestConsumed]);

  useEffect(() => {
    if (loading || !detail || !pendingHistoryFocusRef.current) {
      return;
    }
    if (activeDrawer === 'history') {
      if (detail.priceHistory.length === 0) {
        const hasPos =
          detail.derived.openLots.length > 0 ||
          detail.derived.lotMatches.length > 0 ||
          detail.executions.length > 0 ||
          detail.trade.lifecycleState === 'Open' ||
          detail.trade.lifecycleState === 'Closed';
        if (hasPos) {
          setActiveDrawer('position');
        } else {
          pendingHistoryFocusRef.current = false;
        }
        return;
      }
      pendingHistoryFocusRef.current = false;
      const rafId = requestAnimationFrame(() => {
        historyHeadingRef.current?.focus();
      });
      return () => cancelAnimationFrame(rafId);
    }
    if (activeDrawer === 'position') {
      pendingHistoryFocusRef.current = false;
      const rafId = requestAnimationFrame(() => {
        positionHeadingRef.current?.focus();
      });
      return () => cancelAnimationFrame(rafId);
    }
    pendingHistoryFocusRef.current = false;
    return undefined;
  }, [loading, activeDrawer, detail]);

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
    executions,
    stopDisciplineDeviations,
    planVsActual,
  } = detail;
  const outstandingDebt = journalDebt.filter((d) => d.status === 'Outstanding');
  const isClosed = trade.lifecycleState === 'Closed';
  const hasPositionDrawer =
    derived.openLots.length > 0 ||
    derived.lotMatches.length > 0 ||
    executions.length > 0 ||
    trade.lifecycleState === 'Open' ||
    isClosed;
  const hasTodayDrawer = trade.lifecycleState === 'Open';
  const hasHistoryDrawer =
    (trade.lifecycleState === 'Open' || isClosed) && priceHistory.length > 0;
  const canRecordEntry =
    writable &&
    !derived.integrityDisagreement &&
    (trade.lifecycleState === 'Planned' || trade.lifecycleState === 'Open');
  const canRecordExit =
    writable && !derived.integrityDisagreement && trade.lifecycleState === 'Open';
  const canReplay =
    !derived.integrityDisagreement &&
    (trade.lifecycleState === 'Open' || isClosed);

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

      {showRecordExit && (
        <RecordExitPanel
          tradeId={trade.id}
          symbol={trade.symbol}
          expectedFactRevision={trade.factRevision}
          openSharesDisplay={derived.openSharesDisplay}
          openShares={derived.openShares}
          closeReasons={closeReasons}
          closeReasonsUnavailable={closeReasonsUnavailable}
          latestExecutionIso={executions[executions.length - 1]?.economicTime ?? null}
          workflows={workflows}
          journal={journal}
          clock={clock}
          writable={writable}
          stopPrice={ExactNumber.fromJSON(trade.stopPrice)}
          targetPrice={ExactNumber.fromJSON(trade.targetPrice)}
          stopPriceDisplay={detail.stopPriceDisplay}
          targetPriceDisplay={detail.targetPriceDisplay}
          onSuccess={() => {
            setShowRecordExit(false);
            setActiveDrawer('position');
            void loadDetail();
            onTradeMutated();
          }}
          onConflict={() => {
            void loadDetail();
          }}
          onCancel={() => setShowRecordExit(false)}
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
            {(canRecordEntry || canRecordExit || canReplay) &&
              !showRecordEntry &&
              !showRecordExit && (
                <div className={cockpitStyles.railActions}>
                  {canRecordEntry && (
                    <button
                      type="button"
                      className={styles.btnPrimary}
                      onClick={() => {
                        setShowRecordExit(false);
                        setShowRecordEntry(true);
                      }}
                    >
                      Record entry
                    </button>
                  )}
                  {canRecordExit && (
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      onClick={() => {
                        setShowRecordEntry(false);
                        setShowRecordExit(true);
                      }}
                    >
                      Record exit
                    </button>
                  )}
                  {canReplay && (
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      onClick={(e) => onOpenReplay(trade.id, e.currentTarget)}
                    >
                      Replay
                    </button>
                  )}
                </div>
              )}
          </div>

          {/* Card 2: P&L & Open Shares (Closed shows Final Realized P&L + R; Open shows live or prior-session fallback) */}
          <div className={cockpitStyles.railCard}>
            {isClosed ? (
              <>
                <div
                  className={`${cockpitStyles.railPnl} ${
                    derived.realizedPnl.num >= 0n ? cockpitStyles.up : cockpitStyles.down
                  }`}
                >
                  {derived.realizedPnlDisplay}
                </div>
                <div className={styles.muted} style={{ marginTop: 4 }}>
                  <strong
                    className={
                      derived.realizedPnl.num >= 0n ? cockpitStyles.up : cockpitStyles.down
                    }
                  >
                    {derived.realizedRDisplay ?? '—'}
                  </strong>{' '}
                  realized, final
                </div>
              </>
            ) : liveEval ? (
              <>
                <div
                  className={`${cockpitStyles.railPnl} ${
                    (derived.lotMatches.length > 0 ? liveEval.combinedPnl : liveEval.openPnl).num >=
                    0n
                      ? cockpitStyles.up
                      : cockpitStyles.down
                  }`}
                >
                  {derived.lotMatches.length > 0
                    ? liveEval.combinedPnlDisplay
                    : liveEval.openPnlDisplay}
                </div>
                <div className={styles.muted} style={{ marginTop: 4 }}>
                  <strong>
                    {derived.lotMatches.length > 0
                      ? liveEval.combinedPnlRDisplay
                      : liveEval.openPnlRDisplay}
                  </strong>
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
                {derived.lotMatches.length > 0 && (
                  <div className={styles.muted} style={{ marginTop: 4, fontSize: '0.84rem' }}>
                    Open {liveEval.openPnlDisplay} · Realized {derived.realizedPnlDisplay}
                  </div>
                )}
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
                {derived.lotMatches.length > 0 && (
                  <div className={styles.muted} style={{ marginTop: 4, fontSize: '0.84rem' }}>
                    Realized: {derived.realizedPnlDisplay}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className={cockpitStyles.railPnl}>—</div>
                <div className={styles.muted} style={{ marginTop: 4 }}>
                  {trade.lifecycleState === 'Planned'
                    ? 'Trade P&L once the entry is recorded and marked'
                    : 'No Marks yet — enter Marks in Review to compute P&L'}
                </div>
                {derived.lotMatches.length > 0 && (
                  <div className={styles.muted} style={{ marginTop: 4, fontSize: '0.84rem' }}>
                    Realized so far: {derived.realizedPnlDisplay}
                  </div>
                )}
              </>
            )}
            <div className={styles.mono} style={{ marginTop: 8, fontWeight: 600 }}>
              {derived.openSharesDisplay} of {detail.plannedQuantityDisplay} shares open
            </div>
          </div>

          {/* Card 2b: Result rail card when Closed */}
          {isClosed && (
            <section className={cockpitStyles.railCard} aria-labelledby="cockpit-result-heading">
              <h2 id="cockpit-result-heading" className={styles.cardTitle}>
                Result
              </h2>
              <dl className={cockpitStyles.kv}>
                <dt>Terminal Disposition</dt>
                <dd>{derived.terminalDisposition ?? 'Closed'}</dd>
                <dt>Close Reason</dt>
                <dd>{detail.closeReasonLabel ?? '—'}</dd>
                <dt>Closed</dt>
                <dd>{detail.closedAtShort ?? '—'}</dd>
                <dt>Entry / Exit Scaling</dt>
                <dd>{formatScalingLabel(derived.entryExitScaling)}</dd>
              </dl>
            </section>
          )}

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

          {/* Card 4: Conditions (Closed lists frozen conditions without live figures or extremes) */}
          <div className={cockpitStyles.railCard}>
            <div className={styles.spaceBetween} style={{ marginBottom: 8 }}>
              <h2 className={styles.cardTitle} style={{ margin: 0 }}>
                Conditions
              </h2>
              {!isClosed && !liveEval && priorFallback && (
                <span className={styles.muted} style={{ fontSize: '0.76rem' }}>
                  At {formatSessionDateShort(priorFallback.asOfSessionDate)}
                </span>
              )}
            </div>
            <ul
              className={`${cockpitStyles.conditionList} ${
                !isClosed && !liveEval && priorFallback ? cockpitStyles.faded : ''
              }`}
            >
              <li className={cockpitStyles.conditionItem}>
                <span>
                  <span className={`${styles.pill} ${styles.pillDanger}`}>
                    {!isClosed && displayEval?.stopCondition.status === 'Breached'
                      ? 'Stop Breached'
                      : 'Stop'}
                  </span>
                  {!isClosed && displayEval?.stopCondition.nearest && (
                    <span className={cockpitStyles.near}>nearest</span>
                  )}
                </span>
                {!isClosed && (
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
                )}
                <span className={cockpitStyles.condWhat}>
                  {trade.symbol} at or below {detail.stopPriceDisplay}
                </span>
                {!isClosed && displayEval?.stopCondition.overrunDisplay && (
                  <span
                    className={`${styles.muted} ${cockpitStyles.down}`}
                    style={{ gridColumn: '1 / -1' }}
                  >
                    Overrun past Stop: {displayEval.stopCondition.overrunDisplay}
                  </span>
                )}
              </li>

              <li className={cockpitStyles.conditionItem}>
                <span>
                  <span className={`${styles.pill} ${styles.pillSuccess}`}>
                    {!isClosed && displayEval?.targetCondition.status === 'Reached'
                      ? 'Target Reached'
                      : 'Target'}
                  </span>
                  {!isClosed && displayEval?.targetCondition.nearest && (
                    <span className={cockpitStyles.near}>nearest</span>
                  )}
                </span>
                {!isClosed && (
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
                )}
                <span className={cockpitStyles.condWhat}>
                  {trade.symbol} at or above {detail.targetPriceDisplay}
                </span>
              </li>
            </ul>

            {!isClosed && (
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
            )}
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
                {isClosed ? 'Position' : `Position (${derived.openLots.length})`}
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
                <h2
                  ref={positionHeadingRef}
                  tabIndex={-1}
                  className={styles.cardTitle}
                  style={{ margin: 0 }}
                >
                  {isClosed ? 'Lot Matches & Executions' : 'Open Lots & Executions'}
                </h2>
                {!isClosed && !liveEval && <span className={styles.pill}>No Marks yet</span>}
              </div>

              {derived.openLots.length > 0 && (
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
              )}

              <dl className={cockpitStyles.kv} style={{ marginTop: 14 }}>
                {!isClosed && liveEval && (
                  <>
                    <dt>Open P&amp;L</dt>
                    <dd className={liveEval.openPnl.num >= 0n ? cockpitStyles.up : cockpitStyles.down}>
                      {liveEval.openPnlDisplay}
                    </dd>
                  </>
                )}
                {derived.lotMatches.length > 0 && (
                  <>
                    <dt>Realized</dt>
                    <dd
                      className={
                        derived.realizedPnl.num >= 0n ? cockpitStyles.up : cockpitStyles.down
                      }
                    >
                      {derived.realizedPnlDisplay}
                      {derived.realizedRDisplay ? ` · ${derived.realizedRDisplay}` : ''}
                    </dd>
                  </>
                )}
                <dt>Fees paid</dt>
                <dd>{derived.feeReconciliation.incurredFeesDisplay}</dd>
                {derived.averageEntryPrice && (
                  <>
                    <dt>Average entry fill</dt>
                    <dd>{derived.averageEntryPriceDisplay}</dd>
                  </>
                )}
                <dt>Planned leg fulfillment</dt>
                <dd>{derived.fulfillment}</dd>
                {derived.entryExitScaling && (
                  <>
                    <dt>Entry / Exit Scaling</dt>
                    <dd>{formatScalingLabel(derived.entryExitScaling)}</dd>
                  </>
                )}
              </dl>

              {derived.lotMatches.length > 0 && (
                <>
                  <h3 className={cockpitStyles.cSub}>Lot Matches</h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table className={styles.table} aria-label="Lot Matches">
                      <thead>
                        <tr>
                          <th>Sold</th>
                          <th>Shares</th>
                          <th>Opened at</th>
                          <th>Closed at</th>
                          <th>Realized</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...derived.lotMatches].reverse().map((m, idx) => (
                          <tr key={`${m.openingExecutionId}-${m.disposalExecutionId}-${idx}`}>
                            <td className={styles.muted}>
                              {formatShortTimestamp(m.disposedAtEconomicTime)}
                            </td>
                            <td className={styles.mono}>{m.matchedQuantityDisplay}</td>
                            <td className={styles.mono}>
                              {m.openingPriceDisplay} (
                              {formatShortTimestamp(m.openedAtEconomicTime)})
                            </td>
                            <td className={styles.mono}>{m.disposalPriceDisplay}</td>
                            <td
                              className={`${styles.mono} ${
                                m.realizedPnl.num >= 0n ? cockpitStyles.up : cockpitStyles.down
                              }`}
                            >
                              {m.realizedPnlDisplay}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className={styles.muted} style={{ fontSize: '0.82rem', margin: '6px 0 0' }}>
                    Each match&apos;s amount is rounded to the cent for display.
                  </p>

                  <details className={cockpitStyles.cMore}>
                    <summary>Fee reconciliation</summary>
                    <dl className={cockpitStyles.kv}>
                      <dt>Incurred fees</dt>
                      <dd>{derived.feeReconciliation.incurredFeesDisplay}</dd>
                      <dt>Opening fees incurred</dt>
                      <dd>{derived.feeReconciliation.openingFeesIncurredDisplay}</dd>
                      <dt>Opening fees allocated to Lot Matches</dt>
                      <dd>{derived.feeReconciliation.openingFeesAllocatedDisplay}</dd>
                      <dt>Opening fees unconsumed</dt>
                      <dd>{derived.feeReconciliation.openingFeesUnconsumedDisplay}</dd>
                      <dt>Disposal fees incurred</dt>
                      <dd>{derived.feeReconciliation.disposalFeesIncurredDisplay}</dd>
                      <dt>Disposal fees allocated to Lot Matches</dt>
                      <dd>{derived.feeReconciliation.disposalFeesAllocatedDisplay}</dd>
                    </dl>
                  </details>
                </>
              )}

              {executions.length > 0 && (
                <>
                  <h3 className={cockpitStyles.cSub}>Executions</h3>
                  <ol className={cockpitStyles.journalList}>
                    {[...executions].reverse().map((ex) => (
                      <li key={ex.id}>
                        <span className={cockpitStyles.jWhen}>
                          {formatShortTimestamp(ex.economicTime)}
                        </span>
                        <div className={cockpitStyles.jBody}>
                          {ex.side === 'Buy' ? 'Buy to open' : 'Sell to close'}{' '}
                          <span className={styles.mono}>
                            {formatQuantityString(ExactNumber.fromJSON(ex.quantity))}
                          </span>{' '}
                          {trade.symbol} @{' '}
                          <span className={styles.mono}>
                            {toMoneyString(ExactNumber.fromJSON(ex.fillPrice))}
                          </span>
                          , fee{' '}
                          <span className={styles.mono}>
                            {toMoneyString(ExactNumber.fromJSON(ex.fee))}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </div>
          )}

          {activeDrawer === 'plan' && (
            <div className={styles.card} role="tabpanel" aria-label="Plan and Risk">
              {planVsActual && (
                <div className={cockpitStyles.kvGroup}>
                  <h2 className={cockpitStyles.kvGroupTitle}>Plan vs. What happened</h2>
                  <div style={{ overflowX: 'auto' }}>
                    <table className={styles.table} aria-label="Plan vs. What happened">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Plan</th>
                          <th>What happened</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>Entry</td>
                          <td className={styles.mono}>{planVsActual.plannedEntrySummary}</td>
                          <td className={styles.mono}>{planVsActual.actualEntrySummary}</td>
                        </tr>
                        <tr>
                          <td>Stop</td>
                          <td className={styles.mono}>
                            {trade.symbol} ≤ {detail.stopPriceDisplay}
                          </td>
                          <td className={planVsActual.stopFirstReachedShort ? cockpitStyles.down : ''}>
                            {planVsActual.stopFirstReachedShort
                              ? `Reached ${planVsActual.stopFirstReachedShort}`
                              : 'Never reached'}
                          </td>
                        </tr>
                        <tr>
                          <td>Target</td>
                          <td className={styles.mono}>
                            {trade.symbol} ≥ {detail.targetPriceDisplay}
                          </td>
                          <td className={planVsActual.targetFirstReachedShort ? cockpitStyles.up : ''}>
                            {planVsActual.targetFirstReachedShort
                              ? `Reached ${planVsActual.targetFirstReachedShort}`
                              : 'Never reached'}
                          </td>
                        </tr>
                        <tr>
                          <td>Exit</td>
                          <td>All at Stop or Target</td>
                          <td className={styles.mono}>{planVsActual.exitSummary}</td>
                        </tr>
                        <tr>
                          <td>Result</td>
                          <td className={styles.mono}>{planVsActual.plannedResultSummary}</td>
                          <td
                            className={`${styles.mono} ${
                              planVsActual.actualResultPositive
                                ? cockpitStyles.up
                                : cockpitStyles.down
                            }`}
                          >
                            <strong>{planVsActual.actualResultSummary}</strong>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

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

              {(derived.deviations.length > 0 || stopDisciplineDeviations.length > 0) && (
                <div className={styles.alertError} style={{ marginTop: 14 }}>
                  <strong>Fact-Only Deviations:</strong>
                  <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                    {derived.deviations.map((dev, idx) => (
                      <li key={`d-${idx}`}>
                        <strong>{dev.kind}:</strong> {dev.message}
                      </li>
                    ))}
                    {stopDisciplineDeviations.map((dev) => (
                      <li key={dev.id}>
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
                <h2 ref={historyHeadingRef} tabIndex={-1} className={styles.cardTitle} style={{ margin: 0 }}>
                  Price History (Completed Sessions)
                </h2>
                <div className={styles.row}>
                  {canReplay && (
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      onClick={(e) => onOpenReplay(trade.id, e.currentTarget)}
                    >
                      Replay
                    </button>
                  )}
                  <button type="button" className={styles.btnSecondary} onClick={onGoToReview}>
                    Enter Marks in the Review
                  </button>
                </div>
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
                        <span className={styles.pill}>
                          {entry.origin.kind === 'DailyReview'
                            ? `${entry.source} · ${formatSessionDateShort(entry.origin.reviewDate)}`
                            : entry.source}
                        </span>
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
