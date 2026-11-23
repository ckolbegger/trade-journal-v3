import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  checkStockMarkSanity,
  type MarketData,
  type MarkSanityCheck,
} from '../../market-data/market-data';
import { formatSessionDateShort } from '../../market-data/session-calendar';
import type {
  ReviewMarksViewModel,
  ReviewMarkSymbolRow,
  TradeViewsAndReporting,
} from '../../trade-views/trade-views';
import styles from '../shell/AppShell.module.css';
import mkStyles from './ReviewMarks.module.css';

interface ReviewMarksViewProps {
  readonly views: TradeViewsAndReporting;
  readonly marketData: MarketData;
  readonly refreshKey: number;
  readonly writable: boolean;
  readonly onMarksChanged: () => void;
  readonly onInspectTrade: (tradeId: string) => void;
  readonly onDirtyChange: (dirty: boolean) => void;
}

export function ReviewMarksView({
  views,
  marketData,
  refreshKey,
  writable,
  onMarksChanged,
  onInspectTrade,
  onDirtyChange,
}: ReviewMarksViewProps) {
  const [model, setModel] = useState<ReviewMarksViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sanityBySymbol, setSanityBySymbol] = useState<Record<string, MarkSanityCheck>>({});
  const [confirmedOutlier, setConfirmedOutlier] = useState<Record<string, boolean>>({});
  const [editingCollapsed, setEditingCollapsed] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const loadView = useCallback(async () => {
    try {
      const res = await views.getReviewMarksView();
      setModel(res);
      setDrafts((prev) => {
        const next: Record<string, string> = {};
        for (const row of res.rows) {
          next[row.symbol] = prev[row.symbol] !== undefined ? prev[row.symbol]! : row.todayMarkRaw;
        }
        return next;
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Review Marks.');
    } finally {
      setLoading(false);
    }
  }, [views]);

  useEffect(() => {
    void loadView();
  }, [loadView, refreshKey]);

  useEffect(() => {
    if (!model) {
      onDirtyChange(false);
      return;
    }
    const dirty = model.rows.some((row) => (drafts[row.symbol] ?? '').trim() !== row.todayMarkRaw);
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [model, drafts, onDirtyChange]);

  const handleDraftChange = (row: ReviewMarkSymbolRow, value: string) => {
    setDrafts((prev) => ({ ...prev, [row.symbol]: value }));
    setConfirmedOutlier((prev) => ({ ...prev, [row.symbol]: false }));
    if (value.trim() === '') {
      setSanityBySymbol((prev) => {
        const next = { ...prev };
        delete next[row.symbol];
        return next;
      });
      return;
    }
    const check = checkStockMarkSanity(value, row.referencePrice);
    setSanityBySymbol((prev) => ({ ...prev, [row.symbol]: check }));
  };

  const saveOneSymbol = async (row: ReviewMarkSymbolRow, overrideValue?: string, bypassConfirm = false) => {
    if (!model || !writable || savingRef.current) return false;
    const raw = (overrideValue ?? drafts[row.symbol] ?? '').trim();
    if (!raw) return false;

    const check = checkStockMarkSanity(raw, row.referencePrice);
    setSanityBySymbol((prev) => ({ ...prev, [row.symbol]: check }));

    if (check.status === 'Error') {
      return false;
    }
    if (
      (check.status === 'ConfirmOutlier' || check.status === 'ConfirmDecimalSlip') &&
      !bypassConfirm &&
      !confirmedOutlier[row.symbol]
    ) {
      return false;
    }

    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const res = await marketData.save({
        kind: 'SaveManualMark',
        symbol: row.symbol,
        sessionDate: model.sessionDate,
        price: raw,
        intent: row.todayMarkRaw ? 'Correction' : 'Initial',
      });
      if (res.status === 'Saved') {
        setDrafts((prev) => {
          const next = { ...prev };
          delete next[row.symbol];
          return next;
        });
        setSanityBySymbol((prev) => {
          const next = { ...prev };
          delete next[row.symbol];
          return next;
        });
        setConfirmedOutlier((prev) => ({ ...prev, [row.symbol]: false }));
        await loadView();
        onMarksChanged();
        return true;
      }
      setConfirmedOutlier((prev) => ({ ...prev, [row.symbol]: false }));
      if (res.status === 'Rejected') {
        setError(res.message);
        return false;
      }
      setError(`Write blocked: runtime is ${res.reason}.`);
      return false;
    } catch (err) {
      setConfirmedOutlier((prev) => ({ ...prev, [row.symbol]: false }));
      setError(err instanceof Error ? err.message : 'Unable to save Mark.');
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleMarkUnavailable = async (row: ReviewMarkSymbolRow) => {
    if (!model || !writable || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const res = await marketData.save({
        kind: 'AssertUnavailable',
        symbol: row.symbol,
        sessionDate: model.sessionDate,
      });
      if (res.status === 'Saved') {
        setDrafts((prev) => ({ ...prev, [row.symbol]: '' }));
        setSanityBySymbol((prev) => {
          const next = { ...prev };
          delete next[row.symbol];
          return next;
        });
        await loadView();
        onMarksChanged();
      } else if (res.status === 'Rejected') {
        setError(res.message);
      } else {
        setError(`Write blocked: runtime is ${res.reason}.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to mark symbol unavailable.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleWithdrawUnavailable = async (row: ReviewMarkSymbolRow) => {
    if (!model || !writable || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const res = await marketData.save({
        kind: 'WithdrawAcknowledgment',
        symbol: row.symbol,
        sessionDate: model.sessionDate,
      });
      if (res.status === 'Saved') {
        await loadView();
        onMarksChanged();
      } else if (res.status === 'Rejected') {
        setError(res.message);
      } else {
        setError(`Write blocked: runtime is ${res.reason}.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to withdraw acknowledgment.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleSaveAll = async () => {
    if (!model || !writable || saving) return;
    for (const row of model.rows) {
      const raw = (drafts[row.symbol] ?? '').trim();
      if (raw && raw !== row.todayMarkRaw) {
        const ok = await saveOneSymbol(row, raw, false);
        if (!ok) return;
      }
    }
    setEditingCollapsed(false);
  };

  const handleKeyDown = async (
    e: KeyboardEvent<HTMLInputElement>,
    row: ReviewMarkSymbolRow,
    idx: number,
  ) => {
    if (!model) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      setDrafts((prev) => ({ ...prev, [row.symbol]: row.todayMarkRaw }));
      setConfirmedOutlier((prev) => ({ ...prev, [row.symbol]: false }));
      setSanityBySymbol((prev) => {
        const next = { ...prev };
        delete next[row.symbol];
        return next;
      });
      return;
    }
    if (e.key === 'ArrowDown' && idx + 1 < model.rows.length) {
      e.preventDefault();
      inputRefs.current[model.rows[idx + 1]!.symbol]?.focus();
      return;
    }
    if (e.key === 'ArrowUp' && idx > 0) {
      e.preventDefault();
      inputRefs.current[model.rows[idx - 1]!.symbol]?.focus();
      return;
    }
    if (
      (e.key === 'n' || e.key === 'N') &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      row.todayMarkRaw === '' &&
      (drafts[row.symbol] ?? '').trim() === ''
    ) {
      e.preventDefault();
      await handleMarkUnavailable(row);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const raw = (drafts[row.symbol] ?? '').trim();
      if (raw && raw !== row.todayMarkRaw) {
        const saved = await saveOneSymbol(row, raw, false);
        if (!saved) return;
      }
      if (idx + 1 < model.rows.length) {
        inputRefs.current[model.rows[idx + 1]!.symbol]?.focus();
      }
    }
  };

  if (loading) {
    return (
      <section className={styles.card} aria-busy="true">
        Loading Review Marks…
      </section>
    );
  }
  if (!model) {
    return (
      <div className={styles.alertError} role="alert">
        {error ?? 'Unable to load Review Marks.'}
      </div>
    );
  }

  const allResolved =
    model.rows.length > 0 &&
    model.rows.every((r) => r.todayMarkDisplay !== null || r.todayUnavailableAcknowledged);
  const showCollapsed = allResolved && !editingCollapsed;
  const hasUnsavedDrafts = model.rows.some((r) => (drafts[r.symbol] ?? '').trim() !== r.todayMarkRaw);

  return (
    <section aria-labelledby="review-heading">
      <div className={styles.spaceBetween} style={{ marginBottom: 14 }}>
        <div>
          <h1 id="review-heading" style={{ margin: 0, fontSize: '1.45rem' }}>
            Review · {model.sessionDateShort}
          </h1>
          <p className={styles.muted} style={{ margin: '4px 0 0' }}>
            Step 1: Enter closing Marks for the latest completed U.S. session ({model.sessionDate})
            to update P&amp;L and ongoing risk/reward.
          </p>
        </div>
        <span className={styles.pill}>Session {model.sessionDate}</span>
      </div>

      {error && (
        <div className={styles.alertError} role="alert">
          {error}
        </div>
      )}

      {model.rows.length === 0 ? (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>1 · Marks</h2>
          <p className={styles.muted} style={{ margin: 0 }}>
            No Open Trades need Marks yet. Record an opening entry on a Planned Trade first.
          </p>
        </div>
      ) : showCollapsed ? (
        <div className={styles.card}>
          <div className={styles.spaceBetween}>
            <div>
              <strong>1 · Marks saved for {model.sessionDateShort}</strong>
              <span className={styles.muted} style={{ marginLeft: 10 }}>
                {model.rows
                  .map((r) =>
                    r.todayMarkDisplay
                      ? `${r.symbol} ${r.todayMarkDisplay}`
                      : `${r.symbol} No price today`,
                  )
                  .join(' · ')}
              </span>
            </div>
            <button
              type="button"
              className={styles.btnSecondary}
              disabled={!writable}
              onClick={() => setEditingCollapsed(true)}
            >
              Edit
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.card}>
          <div className={mkStyles.mkTitle}>
            <h2 className={styles.cardTitle} style={{ margin: 0 }}>
              1 · Closing Marks ({model.sessionDateShort})
            </h2>
            {allResolved && (
              <button
                type="button"
                className={mkStyles.linkBtn}
                onClick={() => setEditingCollapsed(false)}
              >
                Done editing
              </button>
            )}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className={mkStyles.mkTable} aria-label="Closing marks grid">
              <thead>
                <tr>
                  <th>Instrument</th>
                  <th>Prior close</th>
                  <th>{model.sessionDateShort} close</th>
                  <th style={{ textAlign: 'left' }}>Status &amp; checks</th>
                </tr>
              </thead>
              <tbody>
                {model.rows.map((row, idx) => {
                  const raw = drafts[row.symbol] ?? '';
                  const sanity = sanityBySymbol[row.symbol];
                  const isSaved = row.todayMarkRaw !== '' && raw === row.todayMarkRaw;
                  let inputClass = mkStyles.mkInput;
                  if (sanity?.status === 'Error') {
                    inputClass = `${mkStyles.mkInput} ${mkStyles.mkInputBad}`;
                  } else if (
                    sanity?.status === 'ConfirmOutlier' ||
                    sanity?.status === 'ConfirmDecimalSlip'
                  ) {
                    inputClass = `${mkStyles.mkInput} ${mkStyles.mkInputWarn}`;
                  } else if (isSaved) {
                    inputClass = `${mkStyles.mkInput} ${mkStyles.mkInputSaved}`;
                  } else if (raw.trim() !== '') {
                    inputClass = `${mkStyles.mkInput} ${mkStyles.mkInputHas}`;
                  }

                  return (
                    <tr key={row.symbol}>
                      <td className={mkStyles.mkInst}>
                        {row.symbol}
                        <small>
                          {row.openTradeCount} open {row.openTradeCount === 1 ? 'trade' : 'trades'}
                        </small>
                      </td>
                      <td className={styles.muted}>
                        {row.priorMarkDisplay ? (
                          <>
                            {row.priorMarkDisplay}
                            {row.priorSessionDate ? (
                              <span style={{ marginLeft: 6, fontSize: '0.78rem' }}>
                                ({formatSessionDateShort(row.priorSessionDate)})
                              </span>
                            ) : null}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        {row.todayUnavailableAcknowledged ? (
                          <span className={`${styles.pill} ${styles.pillWarning}`}>
                            No price today
                          </span>
                        ) : (
                          <>
                            <label className="sr-only" htmlFor={`mark-${row.symbol}`}>
                              {row.symbol} closing mark
                            </label>
                            <input
                              id={`mark-${row.symbol}`}
                              ref={(el) => {
                                inputRefs.current[row.symbol] = el;
                              }}
                              className={inputClass}
                              type="text"
                              inputMode="decimal"
                              placeholder="0.00"
                              value={raw}
                              disabled={!writable}
                              onChange={(e) => handleDraftChange(row, e.target.value)}
                              onKeyDown={(e) => {
                                void handleKeyDown(e, row, idx);
                              }}
                            />
                          </>
                        )}
                      </td>
                      <td className={mkStyles.mkFeedback}>
                        {row.todayUnavailableAcknowledged ? (
                          <button
                            type="button"
                            className={mkStyles.linkBtn}
                            disabled={!writable || saving}
                            onClick={() => {
                              void handleWithdrawUnavailable(row);
                            }}
                          >
                            Undo
                          </button>
                        ) : sanity?.status === 'Error' ? (
                          <span className={mkStyles.down} role="alert">
                            {sanity.message}
                          </span>
                        ) : sanity?.status === 'ConfirmDecimalSlip' ? (
                          <span className={styles.row} role="alert">
                            <span>{sanity.message}</span>
                            <button
                              type="button"
                              className={styles.btnSecondary}
                              disabled={!writable || saving}
                              onClick={() => {
                                handleDraftChange(row, sanity.suggestedRaw);
                                void saveOneSymbol(row, sanity.suggestedRaw, true);
                              }}
                            >
                              Use {sanity.suggestedDisplay}
                            </button>
                            <button
                              type="button"
                              className={styles.btnSecondary}
                              disabled={!writable || saving}
                              onClick={() => {
                                setConfirmedOutlier((prev) => ({ ...prev, [row.symbol]: true }));
                                void saveOneSymbol(row, raw, true);
                              }}
                            >
                              Keep {sanity.enteredDisplay}
                            </button>
                          </span>
                        ) : sanity?.status === 'ConfirmOutlier' ? (
                          <span className={styles.row} role="alert">
                            <span>{sanity.message}</span>
                            <button
                              type="button"
                              className={styles.btnSecondary}
                              disabled={!writable || saving}
                              onClick={() => {
                                setConfirmedOutlier((prev) => ({ ...prev, [row.symbol]: true }));
                                void saveOneSymbol(row, raw, true);
                              }}
                            >
                              Confirm {raw}
                            </button>
                          </span>
                        ) : isSaved ? (
                          <span className={mkStyles.up}>Saved</span>
                        ) : (
                          <button
                            type="button"
                            className={`${mkStyles.linkBtn} ${mkStyles.linkBtnMuted}`}
                            disabled={!writable || saving}
                            onClick={() => {
                              void handleMarkUnavailable(row);
                            }}
                          >
                            Can&apos;t get a price
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className={mkStyles.mkFoot}>
            <button
              type="button"
              className={styles.btnPrimary}
              disabled={!writable || saving || !hasUnsavedDrafts}
              onClick={() => {
                void handleSaveAll();
              }}
            >
              {saving ? 'Saving…' : 'Save Marks'}
            </button>
            <span className={mkStyles.keys}>
              <kbd>Enter</kbd> save &amp; next · <kbd>↑</kbd>/<kbd>↓</kbd> rows · <kbd>N</kbd>{' '}
              can&apos;t get a price · <kbd>Esc</kbd> revert
            </span>
          </div>
        </div>
      )}

      {/* Live Marked Summary of Open Trades */}
      {model.openTrades.length > 0 && (
        <div className={styles.card} style={{ overflowX: 'auto' }}>
          <h2 className={styles.cardTitle}>Open Trades ({model.openTrades.length})</h2>
          <table className={styles.table} aria-label="Open trades marked summary">
            <thead>
              <tr>
                <th>Trade</th>
                <th>Mark</th>
                <th>Open P&amp;L</th>
                <th>Day</th>
                <th>Standing</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {model.openTrades.map((item) => {
                const ev = item.evaluation;
                const isAvail = ev?.availability === 'Available';
                const priorEv = ev?.availability === 'Unavailable' ? ev.priorContext : null;

                return (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.symbol}</strong>
                      <div className={styles.muted}>
                        {item.openSharesDisplay} / {item.plannedQuantityDisplay} sh ·{' '}
                        {item.accountLabel}
                      </div>
                    </td>
                    <td className={styles.mono}>
                      {isAvail ? (
                        ev.currentMarkDisplay
                      ) : ev?.acknowledgedUnavailable ? (
                        <span className={`${styles.pill} ${styles.pillWarning}`}>
                          No price today
                        </span>
                      ) : (
                        <span className={styles.pill}>Marks needed</span>
                      )}
                    </td>
                    <td className={styles.mono}>
                      {isAvail ? (
                        <span className={ev.openPnl.num >= 0n ? mkStyles.up : mkStyles.down}>
                          <strong>{ev.openPnlDisplay}</strong> ({ev.openPnlRDisplay})
                        </span>
                      ) : priorEv ? (
                        <span className={mkStyles.faded}>
                          {priorEv.evaluation.openPnlDisplay}{' '}
                          <small>
                            (At {formatSessionDateShort(priorEv.asOfSessionDate)} Marks)
                          </small>
                        </span>
                      ) : (
                        <span className={styles.muted}>Unavailable</span>
                      )}
                    </td>
                    <td className={styles.mono}>
                      {isAvail && ev.dailyChangeDisplay ? (
                        <span
                          className={
                            ev.dailyChange && ev.dailyChange.num >= 0n
                              ? mkStyles.up
                              : mkStyles.down
                          }
                        >
                          {ev.dailyChangeDisplay}
                        </span>
                      ) : (
                        <span className={styles.muted}>—</span>
                      )}
                    </td>
                    <td>
                      {isAvail ? (
                        ev.stopCondition.status === 'Breached' ? (
                          <span className={`${styles.pill} ${styles.pillDanger}`}>
                            Past Stop ({ev.stopCondition.overrunDisplay})
                          </span>
                        ) : ev.targetCondition.status === 'Reached' ? (
                          <span className={`${styles.pill} ${styles.pillSuccess}`}>
                            Target Reached
                          </span>
                        ) : (
                          <span className={`${styles.pill} ${styles.pillInfo}`}>Inside lines</span>
                        )
                      ) : (
                        <span className={styles.muted}>Unavailable</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        onClick={() => onInspectTrade(item.id)}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
