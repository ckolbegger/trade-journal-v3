import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type {
  DailyReview,
  DailyReviewDebtItem,
  DailyReviewMarkRow,
  DailyReviewTradeItem,
  DailyReviewViewModel,
  TradeStanding,
} from '../../daily-review/daily-review';
import {
  DECISION_MODE_OPTIONS,
  PRIMARY_EMOTION_OPTIONS,
  type DailyReviewAction,
  type DecisionMode,
  type PrimaryEmotion,
} from '../../journal/journal';
import {
  checkStockMarkSanity,
  type MarketData,
  type MarkSanityCheck,
} from '../../market-data/market-data';
import { formatSessionDateShort } from '../../market-data/session-calendar';
import styles from '../shell/AppShell.module.css';
import drStyles from './DailyReview.module.css';
import { GaugeMeter } from './GaugeMeter';
import mkStyles from './ReviewMarks.module.css';

interface DailyReviewViewProps {
  readonly dailyReview: DailyReview;
  readonly marketData: MarketData;
  readonly refreshKey: number;
  readonly writable: boolean;
  readonly onReviewMutated: () => void;
  readonly onInspectTrade: (tradeId: string) => void;
  readonly onDirtyChange: (dirty: boolean) => void;
}

interface ActionDraft {
  action: DailyReviewAction | null;
  reason: string;
  conviction: number;
  consideredAgainst: string;
  note: string;
  error: string | null;
}

interface DebtFormState {
  mode: 'Answer' | 'Decline';
  decisionMode: DecisionMode;
  primaryEmotion: PrimaryEmotion;
  confidence: number;
  note: string;
  declineReason: string;
  error: string | null;
}

function renderStandingChip(standing: TradeStanding, muted = false, asOfShort?: string) {
  const suffix = muted && asOfShort ? ` (${asOfShort})` : '';
  switch (standing.kind) {
    case 'PastStop':
      return <span className={`${drStyles.chip} ${drStyles.chipStop}`}>Past Stop{suffix}</span>;
    case 'AtTarget':
      return <span className={`${drStyles.chip} ${drStyles.chipTarget}`}>At Target{suffix}</span>;
    case 'Inside': {
      const cls =
        standing.towards === 'Stop'
          ? standing.pct >= 50
            ? drStyles.chipAmber
            : drStyles.chipQuiet
          : drStyles.chipToward;
      return (
        <span className={`${drStyles.chip} ${cls}`}>
          {standing.pct}% to {standing.towards}
          {suffix}
        </span>
      );
    }
    case 'Unmarked':
      return <span className={`${drStyles.chip} ${drStyles.chipQuiet}`}>Marks needed</span>;
  }
}

function buildDefaultDraft(trade: DailyReviewTradeItem): ActionDraft {
  if (trade.todayAction) {
    return {
      action: trade.todayAction.action,
      reason: trade.todayAction.reason ?? '',
      conviction: trade.todayAction.conviction ?? 0,
      consideredAgainst: trade.todayAction.consideredAgainst ?? '',
      note: trade.todayAction.note ?? '',
      error: null,
    };
  }
  return {
    action: trade.strict ? null : 'Hold',
    reason: '',
    conviction: 0,
    consideredAgainst: '',
    note: '',
    error: null,
  };
}

function isActionDraftDirty(draft: ActionDraft | undefined, trade: DailyReviewTradeItem): boolean {
  if (!draft) return false;
  if (trade.todayAction) {
    return (
      draft.reason.trim() !== (trade.todayAction.reason ?? '') ||
      draft.conviction !== (trade.todayAction.conviction ?? 0) ||
      draft.consideredAgainst.trim() !== (trade.todayAction.consideredAgainst ?? '') ||
      draft.note.trim() !== (trade.todayAction.note ?? '')
    );
  }
  return (
    (trade.strict && draft.action !== null) ||
    draft.reason.trim().length > 0 ||
    draft.conviction > 0 ||
    draft.consideredAgainst.trim().length > 0 ||
    draft.note.trim().length > 0
  );
}

export function DailyReviewView({
  dailyReview,
  marketData,
  refreshKey,
  writable,
  onReviewMutated,
  onInspectTrade,
  onDirtyChange,
}: DailyReviewViewProps) {
  const [model, setModel] = useState<DailyReviewViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Marks grid state
  const [markDrafts, setMarkDrafts] = useState<Record<string, string>>({});
  const [skippedDrafts, setSkippedDrafts] = useState<Record<string, string>>({});
  const [showSkippedCols, setShowSkippedCols] = useState(false);
  const [sanityBySymbol, setSanityBySymbol] = useState<Record<string, MarkSanityCheck>>({});
  const [confirmedOutlier, setConfirmedOutlier] = useState<Record<string, boolean>>({});
  const [editingMarks, setEditingMarks] = useState(false);

  // Trade accordion & action form state
  const [openTradeId, setOpenTradeId] = useState<string | null>(null);
  const [changingTradeId, setChangingTradeId] = useState<string | null>(null);
  const [actionDrafts, setActionDrafts] = useState<Record<string, ActionDraft>>({});
  const [refuseSwitch, setRefuseSwitch] = useState<{
    fromId: string;
    fromSymbol: string;
    targetId: string | null;
  } | null>(null);

  // Due Debt state
  const [debtForms, setDebtForms] = useState<Record<string, DebtFormState>>({});

  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const loadSeqRef = useRef(0);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const loadView = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    try {
      const res = await dailyReview.open();
      if (seq !== loadSeqRef.current) return;
      setModel(res);
      setMarkDrafts((prev) => {
        const next: Record<string, string> = {};
        for (const row of res.marks) {
          next[row.symbol] = prev[row.symbol] !== undefined ? prev[row.symbol]! : row.todayMarkRaw;
        }
        return next;
      });
      setSkippedDrafts((prev) => {
        const next = { ...prev };
        for (const row of res.marks) {
          for (const [d, raw] of Object.entries(row.skippedMarksByDate)) {
            const key = `${row.symbol}::${d}`;
            if (next[key] === undefined) {
              next[key] = raw;
            }
          }
        }
        return next;
      });
      setError(null);
    } catch (err) {
      if (seq !== loadSeqRef.current) return;
      setError(err instanceof Error ? err.message : 'Unable to load Daily Review.');
    } finally {
      if (seq === loadSeqRef.current) {
        setLoading(false);
      }
    }
  }, [dailyReview]);

  useEffect(() => {
    void loadView();
  }, [loadView, refreshKey]);

  // Track unsaved edits for App navigation / SW update deferral guardrails
  useEffect(() => {
    if (!model) {
      onDirtyChange(false);
      return;
    }
    const marksDirty = model.marks.some(
      (row) => (markDrafts[row.symbol] ?? '').trim() !== row.todayMarkRaw,
    );
    const skippedDirty =
      showSkippedCols &&
      model.marks.some((row) =>
        model.skippedSessions.some(
          (sk) =>
            (skippedDrafts[`${row.symbol}::${sk.date}`] ?? '').trim() !==
            (row.skippedMarksByDate[sk.date] ?? ''),
        ),
      );
    const actionsDirty = model.trades.some((t) => isActionDraftDirty(actionDrafts[t.tradeId], t));
    const debtDirty = Object.values(debtForms).some(
      (f) => f.note.trim().length > 0 || f.declineReason.trim().length > 0 || f.mode === 'Decline',
    );
    onDirtyChange(marksDirty || skippedDirty || actionsDirty || debtDirty);
    return () => onDirtyChange(false);
  }, [model, markDrafts, skippedDrafts, showSkippedCols, actionDrafts, debtForms, onDirtyChange]);

  const handleMarkDraftChange = (row: DailyReviewMarkRow, value: string) => {
    setMarkDrafts((prev) => ({ ...prev, [row.symbol]: value }));
    setConfirmedOutlier((prev) => ({ ...prev, [row.symbol]: false }));
    if (value.trim() === '') {
      setSanityBySymbol((prev) => {
        const next = { ...prev };
        delete next[row.symbol];
        return next;
      });
      return;
    }
    setSanityBySymbol((prev) => ({
      ...prev,
      [row.symbol]: checkStockMarkSanity(value, row.referencePrice),
    }));
  };

  const saveOneMark = async (
    row: DailyReviewMarkRow,
    overrideValue?: string,
    bypassConfirm = false,
  ): Promise<boolean> => {
    if (!model || !writable || savingRef.current) return false;
    const raw = (overrideValue ?? markDrafts[row.symbol] ?? '').trim();
    if (!raw) return false;

    const check = checkStockMarkSanity(raw, row.referencePrice);
    setSanityBySymbol((prev) => ({ ...prev, [row.symbol]: check }));
    if (check.status === 'Error') return false;
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
        sessionDate: model.reviewDate,
        price: raw,
        intent: row.todayMarkRaw ? 'Correction' : 'Initial',
      });
      if (res.status === 'Saved') {
        setMarkDrafts((prev) => {
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
        onReviewMutated();
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

  const handleSaveAllMarks = async () => {
    if (!model || !writable || savingRef.current) return;
    setError(null);
    let savedAnySkipped = false;
    // Save any optional skipped-session marks first
    if (showSkippedCols) {
      for (const row of model.marks) {
        for (const sk of model.skippedSessions) {
          const key = `${row.symbol}::${sk.date}`;
          const raw = (skippedDrafts[key] ?? '').trim();
          const saved = row.skippedMarksByDate[sk.date] ?? '';
          if (raw && raw !== saved) {
            savingRef.current = true;
            setSaving(true);
            try {
              const res = await marketData.save({
                kind: 'SaveManualMark',
                symbol: row.symbol,
                sessionDate: sk.date,
                price: raw,
                intent: saved ? 'Correction' : 'Initial',
              });
              if (res.status === 'Saved') {
                savedAnySkipped = true;
                setSkippedDrafts((prev) => {
                  const next = { ...prev };
                  delete next[key];
                  return next;
                });
              } else if (res.status === 'Rejected') {
                setError(res.message);
                return;
              } else {
                setError(`Write blocked: runtime is ${res.reason}.`);
                return;
              }
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Unable to save skipped-session Mark.');
              return;
            } finally {
              savingRef.current = false;
              setSaving(false);
            }
          }
        }
      }
    }

    let savedAnyToday = false;
    for (const row of model.marks) {
      const raw = (markDrafts[row.symbol] ?? '').trim();
      if (raw && raw !== row.todayMarkRaw) {
        const ok = await saveOneMark(row, raw, false);
        if (!ok) return;
        savedAnyToday = true;
      }
    }
    if (savedAnySkipped && !savedAnyToday) {
      await loadView();
      onReviewMutated();
    }
    setEditingMarks(false);
  };

  const handleMarkUnavailable = async (row: DailyReviewMarkRow) => {
    if (!model || !writable || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const res = await marketData.save({
        kind: 'AssertUnavailable',
        symbol: row.symbol,
        sessionDate: model.reviewDate,
      });
      if (res.status === 'Saved') {
        setMarkDrafts((prev) => ({ ...prev, [row.symbol]: '' }));
        setSanityBySymbol((prev) => {
          const next = { ...prev };
          delete next[row.symbol];
          return next;
        });
        await loadView();
        onReviewMutated();
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

  const handleWithdrawUnavailable = async (row: DailyReviewMarkRow) => {
    if (!model || !writable || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const res = await marketData.save({
        kind: 'WithdrawAcknowledgment',
        symbol: row.symbol,
        sessionDate: model.reviewDate,
      });
      if (res.status === 'Saved') {
        await loadView();
        onReviewMutated();
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

  const handleMarkKeyDown = async (
    e: KeyboardEvent<HTMLInputElement>,
    row: DailyReviewMarkRow,
    idx: number,
  ) => {
    if (!model) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      setMarkDrafts((prev) => ({ ...prev, [row.symbol]: row.todayMarkRaw }));
      setConfirmedOutlier((prev) => ({ ...prev, [row.symbol]: false }));
      setSanityBySymbol((prev) => {
        const next = { ...prev };
        delete next[row.symbol];
        return next;
      });
      return;
    }
    if (e.key === 'ArrowDown' && idx + 1 < model.marks.length) {
      e.preventDefault();
      inputRefs.current[model.marks[idx + 1]!.symbol]?.focus();
      return;
    }
    if (e.key === 'ArrowUp' && idx > 0) {
      e.preventDefault();
      inputRefs.current[model.marks[idx - 1]!.symbol]?.focus();
      return;
    }
    if (
      (e.key === 'n' || e.key === 'N') &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      row.todayMarkRaw === '' &&
      (markDrafts[row.symbol] ?? '').trim() === ''
    ) {
      e.preventDefault();
      await handleMarkUnavailable(row);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const raw = (markDrafts[row.symbol] ?? '').trim();
      if (raw && raw !== row.todayMarkRaw) {
        const ok = await saveOneMark(row, raw, false);
        if (!ok) return;
      }
      if (idx + 1 < model.marks.length) {
        inputRefs.current[model.marks[idx + 1]!.symbol]?.focus();
      }
    }
  };

  const getDraftFor = (trade: DailyReviewTradeItem): ActionDraft =>
    actionDrafts[trade.tradeId] ?? buildDefaultDraft(trade);

  const updateDraft = (trade: DailyReviewTradeItem, patch: Partial<ActionDraft>) => {
    setActionDrafts((prev) => ({
      ...prev,
      [trade.tradeId]: { ...(prev[trade.tradeId] ?? buildDefaultDraft(trade)), ...patch },
    }));
  };

  const requestOpenTrade = (targetId: string | null) => {
    if (!model) return;
    if (openTradeId && openTradeId !== targetId) {
      const current = model.trades.find((t) => t.tradeId === openTradeId);
      if (current && isActionDraftDirty(actionDrafts[openTradeId], current)) {
        setRefuseSwitch({
          fromId: current.tradeId,
          fromSymbol: current.symbol,
          targetId,
        });
        return;
      }
    }
    setRefuseSwitch(null);
    setOpenTradeId(targetId);
  };

  const handleSaveAction = async (trade: DailyReviewTradeItem): Promise<boolean> => {
    if (!model || !writable || savingRef.current) return false;
    const draft = getDraftFor(trade);
    if (!draft.action) {
      updateDraft(trade, { error: 'Choose an Action.' });
      return false;
    }
    if (trade.strict && draft.reason.trim().length === 0) {
      updateDraft(trade, { error: 'Say why you are holding past your Plan line.' });
      return false;
    }

    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const res = await dailyReview.save({
        kind: 'SaveTradeAction',
        tradeId: trade.tradeId,
        reviewDate: model.reviewDate,
        action: draft.action,
        reason: draft.reason.trim() || undefined,
        conviction: draft.conviction > 0 ? draft.conviction : undefined,
        consideredAgainst: draft.consideredAgainst.trim() || undefined,
        note: draft.note.trim() || undefined,
        expectedSnapshot: model.expectedSnapshot,
      });

      if (res.status === 'Saved') {
        setActionDrafts((prev) => {
          const next = { ...prev };
          delete next[trade.tradeId];
          return next;
        });
        setChangingTradeId(null);
        setRefuseSwitch(null);
        await loadView();
        onReviewMutated();
        return true;
      }
      if (res.status === 'ReviewChanged' || res.status === 'Conflict') {
        setError(res.reason);
        await loadView();
        return false;
      }
      if (res.status === 'Rejected') {
        updateDraft(trade, { error: res.message });
        return false;
      }
      setError(`Write blocked: runtime is ${res.reason}.`);
      return false;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save Review Action.');
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const getDebtForm = (debtId: string): DebtFormState =>
    debtForms[debtId] ?? {
      mode: 'Answer',
      decisionMode: 'As Planned',
      primaryEmotion: 'Calm',
      confidence: 3,
      note: '',
      declineReason: '',
      error: null,
    };

  const updateDebtForm = (debtId: string, patch: Partial<DebtFormState>) => {
    setDebtForms((prev) => ({
      ...prev,
      [debtId]: { ...getDebtForm(debtId), ...patch },
    }));
  };

  const handleResolveDebt = async (item: DailyReviewDebtItem, mode: 'Complete' | 'Decline') => {
    if (!model || !writable || savingRef.current) return;
    const form = getDebtForm(item.debt.id);
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const res =
        mode === 'Complete'
          ? await dailyReview.save({
              kind: 'ResolveReviewDebt',
              debtId: item.debt.id,
              reviewDate: model.reviewDate,
              mode: 'Complete',
              decisionMode: form.decisionMode,
              primaryEmotion: form.primaryEmotion,
              confidence: form.confidence,
              note: form.note.trim() || undefined,
              expectedSnapshot: model.expectedSnapshot,
            })
          : await dailyReview.save({
              kind: 'ResolveReviewDebt',
              debtId: item.debt.id,
              reviewDate: model.reviewDate,
              mode: 'Decline',
              declineReason: form.declineReason.trim() || undefined,
              expectedSnapshot: model.expectedSnapshot,
            });

      if (res.status === 'Saved') {
        setDebtForms((prev) => {
          const next = { ...prev };
          delete next[item.debt.id];
          return next;
        });
        await loadView();
        onReviewMutated();
        return;
      }
      if (res.status === 'Conflict' || res.status === 'ReviewChanged') {
        setError(res.reason);
        await loadView();
        return;
      }
      if (res.status === 'Rejected') {
        updateDebtForm(item.debt.id, { error: res.message });
        return;
      }
      setError(`Write blocked: runtime is ${res.reason}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to resolve deferred reflection.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className={styles.card} aria-busy="true">
        Loading Daily Review…
      </section>
    );
  }
  if (!model) {
    return (
      <div className={styles.alertError} role="alert">
        {error ?? 'Unable to load Daily Review.'}
      </div>
    );
  }

  const missingMarksCount = model.marks.filter(
    (m) => m.todayMarkDisplay === null && !m.todayUnavailableAcknowledged,
  ).length;
  const remainingActionsCount = model.trades.filter((t) => t.todayAction === null).length;
  const dueDebtCount = model.dueDebt.length;
  const allMarksResolved = model.marks.length > 0 && missingMarksCount === 0;
  const showMarksCollapsed = allMarksResolved && !editingMarks;
  const isComplete = model.completionState !== 'Incomplete';
  const hasUnsavedMarkDrafts =
    model.marks.some((row) => (markDrafts[row.symbol] ?? '').trim() !== row.todayMarkRaw) ||
    (showSkippedCols &&
      model.marks.some((row) =>
        model.skippedSessions.some(
          (sk) =>
            (skippedDrafts[`${row.symbol}::${sk.date}`] ?? '').trim() !==
            (row.skippedMarksByDate[sk.date] ?? ''),
        ),
      ));

  const nextActionableTrade = model.trades.find(
    (t) => t.isResolvedForToday && t.todayAction === null,
  );

  const todoParts: string[] = [];
  if (missingMarksCount > 0) {
    todoParts.push(`${missingMarksCount} ${missingMarksCount === 1 ? 'Mark' : 'Marks'}`);
  }
  if (dueDebtCount > 0) {
    todoParts.push(`${dueDebtCount} deferred ${dueDebtCount === 1 ? 'reflection' : 'reflections'}`);
  }
  if (remainingActionsCount > 0) {
    todoParts.push(
      `${remainingActionsCount} ${remainingActionsCount === 1 ? 'Action' : 'Actions'}`,
    );
  }

  const renderProgressPills = () => (
    <div className={drStyles.steps} aria-label="Daily Review steps">
      <span
        className={`${drStyles.stepPill} ${
          missingMarksCount > 0 ? drStyles.stepNow : drStyles.stepOk
        }`}
      >
        1 Marks
      </span>
      <span
        className={`${drStyles.stepPill} ${
          missingMarksCount > 0
            ? ''
            : remainingActionsCount + dueDebtCount > 0
              ? drStyles.stepNow
              : drStyles.stepOk
        }`}
      >
        2 Trades
      </span>
      <span className={`${drStyles.stepPill} ${isComplete ? drStyles.stepOk : ''}`}>
        3 The day
      </span>
    </div>
  );

  return (
    <section aria-labelledby="review-heading">
      <div className={styles.spaceBetween} style={{ marginBottom: 12 }}>
        <h1 id="review-heading" style={{ margin: 0, fontSize: '1.45rem' }}>
          Review · {model.reviewDateShort}
        </h1>
        <span className={styles.pill}>Session {model.reviewDate}</span>
      </div>

      {error && (
        <div className={styles.alertError} role="alert">
          {error}
        </div>
      )}

      {/* THE DAY CARD */}
      {model.trades.length === 0 && model.dueDebt.length === 0 ? (
        <section className={styles.card} aria-label="The day">
          <div className={drStyles.dayTop}>
            <div>
              <p className={drStyles.dayDate}>{model.reviewDateShort}</p>
              <p className={drStyles.dayCount}>No Open Trades to review yet</p>
            </div>
            {renderProgressPills()}
          </div>
          <p className={styles.muted} style={{ margin: 0 }}>
            Record an opening entry on a Planned Trade first, then return here after the close.
          </p>
        </section>
      ) : isComplete ? (
        <section className={styles.card} aria-label="The day, complete">
          <div className={drStyles.dayTop}>
            <div className={drStyles.doneHead}>
              <span
                className={`${drStyles.chip} ${
                  model.completionState === 'CompleteWithUnavailableMarks'
                    ? drStyles.chipAmber
                    : drStyles.chipTarget
                }`}
              >
                {model.completionState === 'CompleteWithUnavailableMarks'
                  ? 'Complete with Unavailable Marks'
                  : 'Complete'}
              </span>
              <h2 style={{ margin: 0, fontSize: '1.2rem' }}>{model.reviewDateShort}</h2>
            </div>
            {renderProgressPills()}
          </div>
          <dl className={drStyles.sum}>
            {model.daySummary.totalOpenPnlDisplay && (
              <>
                <dt>The day</dt>
                <dd className={styles.mono}>
                  {model.daySummary.dayPnlChangeDisplay ? (
                    <>
                      Trade P&amp;L{' '}
                      <strong
                        className={
                          model.daySummary.dayPnlChangePositive ? drStyles.up : drStyles.down
                        }
                      >
                        {model.daySummary.dayPnlChangeDisplay}
                      </strong>{' '}
                      on the day ·{' '}
                    </>
                  ) : null}
                  open Trades{' '}
                  <strong
                    className={
                      model.daySummary.totalOpenPnlPositive ? drStyles.up : drStyles.down
                    }
                  >
                    {model.daySummary.totalOpenPnlDisplay}
                  </strong>{' '}
                  in all
                </dd>
              </>
            )}
            {(model.daySummary.pastStopSymbols.length > 0 ||
              model.daySummary.atTargetSymbols.length > 0) && (
              <>
                <dt>Past a line</dt>
                <dd>
                  {model.daySummary.pastStopSymbols.length > 0 && (
                    <span>
                      <strong className={drStyles.down}>Past Stop:</strong>{' '}
                      {model.daySummary.pastStopSymbols.join(', ')}
                    </span>
                  )}
                  {model.daySummary.pastStopSymbols.length > 0 &&
                    model.daySummary.atTargetSymbols.length > 0 &&
                    ' · '}
                  {model.daySummary.atTargetSymbols.length > 0 && (
                    <span>
                      <strong className={drStyles.up}>At Target:</strong>{' '}
                      {model.daySummary.atTargetSymbols.join(', ')}
                    </span>
                  )}
                </dd>
              </>
            )}
            {model.daySummary.chosenHoldSymbols.length > 0 && (
              <>
                <dt>You chose</dt>
                <dd>
                  <strong>Hold</strong> {model.daySummary.chosenHoldSymbols.join(', ')}
                </dd>
              </>
            )}
            <dt>Tomorrow</dt>
            <dd>
              <ul>
                {model.daySummary.tomorrowItems.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </dd>
            <dt>Next Review</dt>
            <dd>{model.daySummary.nextSessionDateShort}, after the close.</dd>
          </dl>
        </section>
      ) : (
        <section className={styles.card} aria-label="The day">
          <div className={drStyles.dayTop}>
            <div>
              <p className={drStyles.dayDate}>{model.reviewDateShort}</p>
              <p className={drStyles.dayCount}>
                {model.trades.length} {model.trades.length === 1 ? 'Trade' : 'Trades'} ·{' '}
                {todoParts.join(', ')} to go
              </p>
            </div>
            {renderProgressPills()}
          </div>

          <div className={styles.row}>
            {missingMarksCount > 0 ? (
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => {
                  setEditingMarks(true);
                  const firstMissing = model.marks.find(
                    (m) => m.todayMarkDisplay === null && !m.todayUnavailableAcknowledged,
                  );
                  if (firstMissing) {
                    inputRefs.current[firstMissing.symbol]?.focus();
                  }
                }}
              >
                Enter the Marks
              </button>
            ) : nextActionableTrade ? (
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => requestOpenTrade(nextActionableTrade.tradeId)}
              >
                Next: {nextActionableTrade.symbol}
              </button>
            ) : null}

            {model.daySummary.dayPnlChangeDisplay && (
              <span className={styles.mono}>
                Day so far:{' '}
                <strong
                  className={model.daySummary.dayPnlChangePositive ? drStyles.up : drStyles.down}
                >
                  {model.daySummary.dayPnlChangeDisplay}
                </strong>
              </span>
            )}
          </div>

          {model.skippedSessions.length > 0 && (
            <p className={drStyles.notePlain}>
              <strong>
                No Review for {model.skippedSessions.map((s) => s.short).join(', ')}.
              </strong>{' '}
              Their Marks are optional.{' '}
              {!showSkippedCols && (
                <button
                  type="button"
                  className={mkStyles.linkBtn}
                  onClick={() => {
                    setShowSkippedCols(true);
                    setEditingMarks(true);
                  }}
                >
                  Add them
                </button>
              )}
            </p>
          )}

          {model.trades.length > 0 && (
            <ul className={drStyles.tlist}>
              {model.trades.map((t) => (
                <li key={t.tradeId}>
                  <button
                    type="button"
                    className={drStyles.tlistBtn}
                    onClick={() => requestOpenTrade(t.tradeId)}
                  >
                    {t.symbol}
                  </button>
                  {renderStandingChip(
                    t.standing,
                    t.evaluation.availability === 'Unavailable',
                    t.evaluation.availability === 'Unavailable' && t.evaluation.priorContext
                      ? formatSessionDateShort(t.evaluation.priorContext.asOfSessionDate)
                      : undefined,
                  )}
                  <span className={styles.muted}>
                    {t.todayAction
                      ? `Done · ${t.todayAction.action}`
                      : t.isResolvedForToday
                        ? 'To do: Action'
                        : 'To do: Mark, Action'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* STEP 1 · MARKS GRID */}
      {model.marks.length > 0 &&
        (showMarksCollapsed ? (
          <div className={styles.card}>
            <div className={styles.spaceBetween}>
              <div>
                <strong>1 · Marks saved for {model.reviewDateShort}</strong>
                <span className={styles.muted} style={{ marginLeft: 10 }}>
                  {model.marks
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
                onClick={() => setEditingMarks(true)}
              >
                Edit
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.card}>
            <div className={mkStyles.mkTitle}>
              <h2 className={styles.cardTitle} style={{ margin: 0 }}>
                1 · Closing Marks ({model.reviewDateShort})
              </h2>
              {allMarksResolved && (
                <button
                  type="button"
                  className={mkStyles.linkBtn}
                  onClick={() => setEditingMarks(false)}
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
                    {showSkippedCols &&
                      model.skippedSessions.map((sk) => <th key={sk.date}>{sk.short}</th>)}
                    <th>{model.reviewDateShort} close</th>
                    <th style={{ textAlign: 'left' }}>Status &amp; checks</th>
                  </tr>
                </thead>
                <tbody>
                  {model.marks.map((row, idx) => {
                    const raw = markDrafts[row.symbol] ?? '';
                    const sanity = sanityBySymbol[row.symbol];
                    const isSaved = row.todayMarkRaw !== '' && raw.trim() === row.todayMarkRaw;
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
                        {showSkippedCols &&
                          model.skippedSessions.map((sk) => {
                            const skKey = `${row.symbol}::${sk.date}`;
                            return (
                              <td key={sk.date}>
                                <input
                                  aria-label={`${row.symbol} optional mark ${sk.short}`}
                                  className={mkStyles.mkInput}
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="opt"
                                  value={skippedDrafts[skKey] ?? ''}
                                  disabled={!writable}
                                  onChange={(e) =>
                                    setSkippedDrafts((prev) => ({
                                      ...prev,
                                      [skKey]: e.target.value,
                                    }))
                                  }
                                />
                              </td>
                            );
                          })}
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
                                onChange={(e) => handleMarkDraftChange(row, e.target.value)}
                                onKeyDown={(e) => {
                                  void handleMarkKeyDown(e, row, idx);
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
                                  handleMarkDraftChange(row, sanity.suggestedRaw);
                                  void saveOneMark(row, sanity.suggestedRaw, true);
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
                                  void saveOneMark(row, raw, true);
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
                                  void saveOneMark(row, raw, true);
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
                disabled={!writable || saving || !hasUnsavedMarkDrafts}
                onClick={() => {
                  void handleSaveAllMarks();
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
        ))}

      {/* DUE JOURNAL DEBT SECTION */}
      {model.dueDebt.length > 0 && (
        <section aria-label="Due reflections">
          <h2 className={drStyles.grpTitle}>
            Due Reflections ({model.dueDebt.length}) — Required Before Review Completes
          </h2>
          {model.dueDebt.map((item) => {
            const form = getDebtForm(item.debt.id);
            return (
              <div key={item.debt.id} className={drStyles.debtCard}>
                <div className={styles.spaceBetween} style={{ marginBottom: 8 }}>
                  <div>
                    <strong>{item.symbol}</strong>{' '}
                    <span className={styles.muted}>· {item.summary}</span>
                  </div>
                  <span className={`${drStyles.chip} ${drStyles.chipAmber}`}>Reflection due</span>
                </div>

                {form.error && (
                  <div className={styles.alertError} role="alert">
                    {form.error}
                  </div>
                )}

                {form.mode === 'Answer' ? (
                  <div>
                    <div className={styles.row} style={{ marginBottom: 10 }}>
                      <label className={styles.field}>
                        <span>Decision mode</span>
                        <select
                          aria-label={`${item.symbol} debt decision mode`}
                          value={form.decisionMode}
                          onChange={(e) =>
                            updateDebtForm(item.debt.id, {
                              decisionMode: e.target.value as DecisionMode,
                              error: null,
                            })
                          }
                        >
                          {DECISION_MODE_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className={styles.field}>
                        <span>Primary emotion</span>
                        <select
                          aria-label={`${item.symbol} debt primary emotion`}
                          value={form.primaryEmotion}
                          onChange={(e) =>
                            updateDebtForm(item.debt.id, {
                              primaryEmotion: e.target.value as PrimaryEmotion,
                              error: null,
                            })
                          }
                        >
                          {PRIMARY_EMOTION_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className={styles.field}>
                        <span>Decision confidence (1–5)</span>
                        <select
                          aria-label={`${item.symbol} debt confidence`}
                          value={String(form.confidence)}
                          onChange={(e) =>
                            updateDebtForm(item.debt.id, {
                              confidence: Number(e.target.value),
                              error: null,
                            })
                          }
                        >
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={String(n)}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className={styles.field} style={{ marginBottom: 10 }}>
                      <span>Note (optional)</span>
                      <textarea
                        aria-label={`${item.symbol} debt note`}
                        rows={2}
                        value={form.note}
                        onChange={(e) => updateDebtForm(item.debt.id, { note: e.target.value })}
                      />
                    </label>
                    <div className={styles.spaceBetween}>
                      <button
                        type="button"
                        className={styles.btnPrimary}
                        disabled={!writable || saving}
                        onClick={() => {
                          void handleResolveDebt(item, 'Complete');
                        }}
                      >
                        Save Reflection
                      </button>
                      <button
                        type="button"
                        className={`${mkStyles.linkBtn} ${mkStyles.linkBtnMuted}`}
                        disabled={!writable || saving}
                        onClick={() => updateDebtForm(item.debt.id, { mode: 'Decline' })}
                      >
                        Decline…
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={drStyles.declBox}>
                    <p style={{ margin: '0 0 8px' }}>
                      <strong>Decline this reflection?</strong> The Journal will record it as
                      explicitly declined (no blank Entry created).
                    </p>
                    <label className={styles.field} style={{ marginBottom: 10 }}>
                      <span>Reason (optional)</span>
                      <textarea
                        aria-label={`${item.symbol} decline reason`}
                        rows={2}
                        value={form.declineReason}
                        onChange={(e) =>
                          updateDebtForm(item.debt.id, { declineReason: e.target.value })
                        }
                      />
                    </label>
                    <div className={styles.row}>
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        disabled={!writable || saving}
                        onClick={() => {
                          void handleResolveDebt(item, 'Decline');
                        }}
                      >
                        Decline Reflection
                      </button>
                      <button
                        type="button"
                        className={mkStyles.linkBtn}
                        onClick={() => updateDebtForm(item.debt.id, { mode: 'Answer' })}
                      >
                        Back to answer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* STEP 2 · ATTENTION-RANKED TRADE CARDS */}
      {model.trades.length > 0 && (
        <section aria-label="Open trades to review">
          <h2 className={drStyles.grpTitle}>2 · Trades (Attention Order)</h2>
          {model.trades.map((trade) => {
            const isOpen = openTradeId === trade.tradeId;
            const liveEval =
              trade.evaluation.availability === 'Available' ? trade.evaluation : null;
            const priorCtx =
              trade.evaluation.availability === 'Unavailable'
                ? trade.evaluation.priorContext
                : null;
            const displayEval = liveEval ?? priorCtx?.evaluation ?? null;
            const draft = getDraftFor(trade);
            const showActionForm = !trade.todayAction || changingTradeId === trade.tradeId;

            return (
              <div
                key={trade.tradeId}
                className={`${drStyles.tcard} ${isOpen ? drStyles.tcardOpen : ''}`}
              >
                <button
                  type="button"
                  className={drStyles.thead}
                  aria-expanded={isOpen}
                  onClick={() => requestOpenTrade(isOpen ? null : trade.tradeId)}
                >
                  <span className={drStyles.sym}>{trade.symbol}</span>
                  <span className={drStyles.pos}>
                    Long {trade.openSharesDisplay} shares
                  </span>
                  <span>
                    {renderStandingChip(
                      trade.standing,
                      !liveEval,
                      priorCtx ? formatSessionDateShort(priorCtx.asOfSessionDate) : undefined,
                    )}
                  </span>
                  <span />
                  <span
                    className={`${drStyles.hp} ${
                      liveEval
                        ? liveEval.openPnl.num >= 0n
                          ? drStyles.up
                          : drStyles.down
                        : styles.muted
                    }`}
                  >
                    {liveEval
                      ? `${liveEval.openPnlDisplay} · ${liveEval.openPnlRDisplay}`
                      : priorCtx
                        ? `${formatSessionDateShort(priorCtx.asOfSessionDate)} ${priorCtx.evaluation.openPnlDisplay}`
                        : '—'}
                  </span>
                  <span
                    className={`${drStyles.hd} ${
                      liveEval?.dailyChange
                        ? liveEval.dailyChange.num >= 0n
                          ? drStyles.up
                          : drStyles.down
                        : styles.muted
                    }`}
                  >
                    {liveEval?.dailyChangeDisplay ? `${liveEval.dailyChangeDisplay} today` : ''}
                  </span>
                  <span className={`${drStyles.theadMeter} ${liveEval ? '' : drStyles.faded}`}>
                    <GaugeMeter symbol={trade.symbol} evaluation={displayEval} big={false} />
                  </span>
                  <span className={`${drStyles.todo} ${trade.todayAction ? drStyles.todoOk : ''}`}>
                    {trade.todayAction
                      ? `Done · ${trade.todayAction.action}`
                      : trade.isResolvedForToday
                        ? 'To do: Action'
                        : 'To do: Mark, Action'}
                  </span>
                </button>

                {refuseSwitch &&
                  (refuseSwitch.targetId === trade.tradeId ||
                    (refuseSwitch.targetId === null && refuseSwitch.fromId === trade.tradeId)) && (
                  <div className={drStyles.refuse} role="alert">
                    <strong>{refuseSwitch.fromSymbol}&apos;s note isn&apos;t saved.</strong>
                    <button
                      type="button"
                      className={styles.btnPrimary}
                      disabled={!writable || saving}
                      onClick={async () => {
                        const fromTrade = model.trades.find(
                          (t) => t.tradeId === refuseSwitch.fromId,
                        );
                        if (!fromTrade) return;
                        const ok = await handleSaveAction(fromTrade);
                        if (ok) {
                          setOpenTradeId(refuseSwitch.targetId);
                        }
                      }}
                    >
                      Save it
                    </button>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      onClick={() => {
                        setActionDrafts((prev) => {
                          const next = { ...prev };
                          delete next[refuseSwitch.fromId];
                          return next;
                        });
                        const target = refuseSwitch.targetId;
                        setRefuseSwitch(null);
                        setOpenTradeId(target);
                      }}
                    >
                      Discard it
                    </button>
                    <button
                      type="button"
                      className={mkStyles.linkBtn}
                      onClick={() => setRefuseSwitch(null)}
                    >
                      Back to {refuseSwitch.fromSymbol}
                    </button>
                  </div>
                )}

                {isOpen && (
                  <div className={drStyles.tbody}>
                    <div className={styles.spaceBetween} style={{ marginBottom: 8 }}>
                      <span className={styles.muted}>
                        {trade.accountLabel} · {trade.institutionLabel}
                      </span>
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        onClick={() => onInspectTrade(trade.tradeId)}
                      >
                        Inspect
                      </button>
                    </div>

                    {/* PLAN vs NOW */}
                    <div className={drStyles.pn}>
                      <div className={drStyles.planBox}>
                        <h3 className={drStyles.subHead}>Plan</h3>
                        <div className={drStyles.plan2}>
                          <dl className={drStyles.kv}>
                            <dt>Entry</dt>
                            <dd>
                              {trade.plannedQuantityDisplay} sh @ {trade.intendedEntryDisplay}
                            </dd>
                            <dt>Stop</dt>
                            <dd>{trade.symbol} ≤ {trade.stopPriceDisplay}</dd>
                            <dt>Target</dt>
                            <dd>{trade.symbol} ≥ {trade.targetPriceDisplay}</dd>
                            <dt>Risk</dt>
                            <dd>{trade.oneRDisplay} (1R)</dd>
                            <dt>Reward</dt>
                            <dd>{trade.plannedRewardDisplay}</dd>
                          </dl>
                          <div>
                            <p className={drStyles.whyLbl}>Thesis</p>
                            <p className={drStyles.whyVal}>{trade.thesis || '—'}</p>
                            <p className={drStyles.whyLbl}>No longer valid if</p>
                            <p className={drStyles.whyVal}>{trade.invalidation || '—'}</p>
                          </div>
                        </div>
                      </div>

                      <div className={drStyles.meterBlk}>
                        <h3 className={drStyles.subHead}>
                          {liveEval
                            ? `Now · ${model.reviewDateShort}`
                            : priorCtx
                              ? `At the ${formatSessionDateShort(priorCtx.asOfSessionDate)} Marks (today Unavailable)`
                              : 'Now'}
                        </h3>
                        {displayEval ? (
                          <>
                            <p style={{ margin: '0 0 6px', fontSize: '0.92rem' }}>
                              {trade.symbol} <strong>{displayEval.currentMarkDisplay}</strong>
                              {displayEval.markChangeDisplay ? (
                                <span className={styles.muted} style={{ marginLeft: 6 }}>
                                  ({displayEval.markChangeDisplay})
                                </span>
                              ) : null}
                            </p>
                            <GaugeMeter symbol={trade.symbol} evaluation={displayEval} big />
                            <div className={drStyles.legs}>
                              <span className={drStyles.down}>
                                Stop: {displayEval.stopCondition.impactDisplay} (
                                {displayEval.stopCondition.impactRDisplay})
                              </span>
                              <span className={drStyles.up}>
                                Target: {displayEval.targetCondition.impactDisplay} (
                                {displayEval.targetCondition.impactRDisplay})
                              </span>
                            </div>
                            <dl className={drStyles.kv}>
                              <dt>Worst case</dt>
                              <dd>
                                {displayEval.worstCaseRiskDisplay} ·{' '}
                                {displayEval.worstCaseRiskRDisplay}
                              </dd>
                              <dt>Max reward</dt>
                              <dd>No cap</dd>
                            </dl>
                            <div className={drStyles.key}>
                              <span>
                                <i
                                  className={drStyles.keySwatch}
                                  style={{ background: '#c2e2c9' }}
                                />
                                Open gain
                              </span>
                              <span>
                                <i
                                  className={drStyles.keySwatch}
                                  style={{ background: '#f2c6c0' }}
                                />
                                Open loss
                              </span>
                              <span>
                                <i className={`${drStyles.keySwatch} ${drStyles.keyHat}`} />
                                Past line
                              </span>
                              <span>
                                <i className={`${drStyles.keySwatch} ${drStyles.keyDot}`} />
                                Prior
                              </span>
                              <span>
                                <i className={`${drStyles.keySwatch} ${drStyles.keyNow}`} />
                                Now
                              </span>
                            </div>
                          </>
                        ) : (
                          <p className={styles.muted} style={{ margin: 0 }}>
                            No Marks yet. Enter today&apos;s Mark above to compute P&amp;L and risk.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* MARKS-BEFORE-ACTION GATE OR ACTION AREA */}
                    {!trade.isResolvedForToday ? (
                      <div className={drStyles.locked}>
                        No Action until today&apos;s Mark is in.{' '}
                        <button
                          type="button"
                          className={mkStyles.linkBtn}
                          onClick={() => {
                            setEditingMarks(true);
                            inputRefs.current[trade.symbol]?.focus();
                          }}
                        >
                          Enter it
                        </button>
                      </div>
                    ) : !showActionForm && trade.todayAction ? (
                      <div className={drStyles.act}>
                        <div>
                          <div className={drStyles.savedAct}>
                            <span>
                              <strong>
                                {model.reviewDateShort}: {trade.todayAction.action}
                              </strong>
                              {trade.todayAction.reason ? ` · "${trade.todayAction.reason}"` : ''}
                              {trade.todayAction.conviction
                                ? ` · Conviction ${trade.todayAction.conviction}/5`
                                : ''}
                            </span>
                            <button
                              type="button"
                              className={styles.btnSecondary}
                              disabled={!writable}
                              onClick={() => {
                                setActionDrafts((prev) => ({
                                  ...prev,
                                  [trade.tradeId]: buildDefaultDraft(trade),
                                }));
                                setChangingTradeId(trade.tradeId);
                              }}
                            >
                              Change
                            </button>
                          </div>
                        </div>
                        {renderDecisionTrail(trade)}
                      </div>
                    ) : (
                      <div className={drStyles.act}>
                        <div role="form" aria-label={`Action, ${trade.symbol}`}>
                          <h3 className={drStyles.subHead}>Action</h3>
                          <p className={drStyles.ask}>
                            {trade.standing.kind === 'PastStop'
                              ? `Past your Stop (${trade.symbol} ≤ ${trade.stopPriceDisplay}). The Plan says out.`
                              : trade.standing.kind === 'AtTarget'
                                ? `At your Target (${trade.symbol} ≥ ${trade.targetPriceDisplay}). The Plan says out.`
                                : 'Inside its lines. The Plan says hold.'}
                          </p>
                          <div className={drStyles.seg} role="group" aria-label="Action choice">
                            <button
                              type="button"
                              className={drStyles.segBtn}
                              aria-pressed={draft.action === 'Hold'}
                              onClick={() =>
                                updateDraft(trade, { action: 'Hold', error: null })
                              }
                            >
                              Hold
                            </button>
                          </div>
                          {trade.strict && !draft.action && (
                            <p className={styles.muted} style={{ margin: '6px 0 0' }}>
                              Nothing is chosen for you here.
                            </p>
                          )}

                          <label className={styles.field} style={{ marginTop: 10 }}>
                            <span>
                              {trade.strict ? 'Why leave the Plan?' : 'Why? (optional)'}
                            </span>
                            <textarea
                              aria-label={`${trade.symbol} action reason`}
                              rows={2}
                              value={draft.reason}
                              onChange={(e) =>
                                updateDraft(trade, { reason: e.target.value, error: null })
                              }
                            />
                          </label>

                          {draft.error && (
                            <div className={styles.alertError} role="alert" style={{ marginTop: 6 }}>
                              {draft.error}
                            </div>
                          )}

                          <div
                            className={styles.row}
                            style={{ marginTop: 10, alignItems: 'center' }}
                          >
                            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                              Conviction now <span className={styles.muted}>(optional)</span>
                            </span>
                            <div
                              className={drStyles.seg}
                              role="group"
                              aria-label={`${trade.symbol} conviction`}
                            >
                              {[1, 2, 3, 4, 5].map((n) => (
                                <button
                                  key={n}
                                  type="button"
                                  className={`${drStyles.segBtn} ${drStyles.segBtnSm}`}
                                  aria-pressed={draft.conviction === n}
                                  onClick={() =>
                                    updateDraft(trade, {
                                      conviction: draft.conviction === n ? 0 : n,
                                    })
                                  }
                                >
                                  {n}
                                </button>
                              ))}
                            </div>
                          </div>

                          <details style={{ marginTop: 10 }}>
                            <summary
                              className={styles.muted}
                              style={{ cursor: 'pointer', fontWeight: 600 }}
                            >
                              Add more: what you decided against, a note
                            </summary>
                            <label className={styles.field} style={{ marginTop: 8 }}>
                              <span>Anything you considered and decided against?</span>
                              <textarea
                                rows={2}
                                value={draft.consideredAgainst}
                                onChange={(e) =>
                                  updateDraft(trade, { consideredAgainst: e.target.value })
                                }
                              />
                            </label>
                            <label className={styles.field} style={{ marginTop: 8 }}>
                              <span>Note</span>
                              <textarea
                                rows={2}
                                value={draft.note}
                                onChange={(e) => updateDraft(trade, { note: e.target.value })}
                              />
                            </label>
                          </details>

                          <div className={styles.row} style={{ marginTop: 12 }}>
                            <button
                              type="button"
                              className={styles.btnPrimary}
                              disabled={!writable || saving}
                              onClick={() => {
                                void handleSaveAction(trade);
                              }}
                            >
                              {draft.action ? `Save ${draft.action}` : 'Save'}
                            </button>
                            <button
                              type="button"
                              className={styles.btnSecondary}
                              onClick={() => {
                                setActionDrafts((prev) => {
                                  const next = { ...prev };
                                  delete next[trade.tradeId];
                                  return next;
                                });
                                setChangingTradeId(null);
                              }}
                            >
                              Discard
                            </button>
                          </div>
                        </div>
                        {renderDecisionTrail(trade)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}
    </section>
  );
}

function renderDecisionTrail(trade: DailyReviewTradeItem) {
  return (
    <div className={drStyles.trail}>
      <h3 className={drStyles.subHead}>Your last decisions</h3>
      {trade.holdPastStopStreak > 0 && (
        <p className={drStyles.streak}>
          Held past the Stop{' '}
          {trade.holdPastStopStreak > 1
            ? `${trade.holdPastStopStreak} sessions running`
            : 'last session'}
          .
        </p>
      )}
      {trade.holdPastTargetStreak > 0 && (
        <p className={drStyles.streak} style={{ color: 'var(--amber)' }}>
          Held past the Target{' '}
          {trade.holdPastTargetStreak > 1
            ? `${trade.holdPastTargetStreak} sessions running`
            : 'last session'}
          .
        </p>
      )}
      {trade.pastDecisions.length === 0 ? (
        <p className={styles.muted} style={{ margin: 0 }}>
          None yet.
        </p>
      ) : (
        <ol>
          {trade.pastDecisions.map((d) => (
            <li key={d.reviewDate}>
              <strong>{d.reviewDateShort}</strong> · {d.action}
              {d.conviction ? ` · Conviction ${d.conviction}/5` : ''}
              <br />
              {d.reason ? (
                <span>&ldquo;{d.reason}&rdquo;</span>
              ) : (
                <span className={styles.muted}>no reason given</span>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
