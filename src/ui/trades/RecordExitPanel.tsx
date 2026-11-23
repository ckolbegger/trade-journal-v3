import { useEffect, useState, type FormEvent } from 'react';
import {
  DECISION_MODE_OPTIONS,
  POSITION_CHANGE_REFLECTION_TYPE_ID,
  PRIMARY_EMOTION_OPTIONS,
  type DecisionMode,
  type Journal,
  type PrimaryEmotion,
} from '../../journal/journal';
import {
  getExchangeDateForInstant,
  resolveExecutionEconomicIso,
} from '../../market-data/session-calendar';
import type {
  CloseReasonRecord,
  EntryDefinitionRecord,
  PlannedLegIntent,
} from '../../persistence/idb';
import type { Clock } from '../../shared/clock';
import {
  cmp,
  ExactNumber,
  isPositive,
  toDecimalString,
  type Rational,
} from '../../shared/exact-number';
import type {
  PositionChangeReflectionDisposition,
  TradeWorkflows,
} from '../../trade-workflows/trade-workflows';
import styles from '../shell/AppShell.module.css';
import cockpitStyles from './Cockpit.module.css';

export interface RecordExitPanelProps {
  readonly tradeId: string;
  readonly symbol: string;
  readonly expectedFactRevision: number;
  readonly openSharesDisplay: string;
  readonly openShares?: Rational;
  readonly closeReasons: readonly CloseReasonRecord[];
  readonly closeReasonsUnavailable?: boolean;
  readonly latestExecutionIso?: string | null;
  readonly workflows: TradeWorkflows;
  readonly journal: Journal;
  readonly clock: Clock;
  readonly writable: boolean;
  readonly stopPrice?: Rational;
  readonly targetPrice?: Rational;
  readonly stopPriceDisplay?: string;
  readonly targetPriceDisplay?: string;
  readonly priorExitAction?: {
    readonly reviewDateShort: string;
    readonly reason: string | null;
  } | null;
  readonly initialNote?: string;
  readonly onSuccess: () => void | Promise<void>;
  readonly onCancel: () => void;
  readonly onConflict?: () => void;
  readonly onDirtyChange?: (dirty: boolean) => void;
}

function tryParseDecimal(raw: string): Rational | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return ExactNumber.tryFromDecimalString(trimmed);
}

export function RecordExitPanel({
  tradeId,
  symbol,
  expectedFactRevision,
  openSharesDisplay,
  openShares,
  closeReasons,
  closeReasonsUnavailable = false,
  latestExecutionIso = null,
  workflows,
  journal,
  clock,
  writable,
  stopPrice,
  targetPrice,
  stopPriceDisplay,
  targetPriceDisplay,
  priorExitAction,
  initialNote = '',
  onSuccess,
  onCancel,
  onConflict,
  onDirtyChange,
}: RecordExitPanelProps) {
  const [pcDef, setPcDef] = useState<EntryDefinitionRecord | null>(null);
  const initialDate = getExchangeDateForInstant(clock.now());
  const [executionDate, setExecutionDate] = useState<string>(initialDate);
  const [quantity, setQuantity] = useState<string>(openSharesDisplay);
  const [quantityEdited, setQuantityEdited] = useState(false);
  const [fillPrice, setFillPrice] = useState<string>('');
  const [fee, setFee] = useState<string>('0.00');
  const [plannedLegIntent, setPlannedLegIntent] = useState<PlannedLegIntent>('PlannedLeg');
  const [closeReasonId, setCloseReasonId] = useState<string>('');
  const [disposition, setDisposition] = useState<'Defer' | 'Complete' | 'Decline'>(
    initialNote.trim() ? 'Complete' : 'Defer',
  );
  const [decisionMode, setDecisionMode] = useState<DecisionMode>('As Planned');
  const [primaryEmotion, setPrimaryEmotion] = useState<PrimaryEmotion>('Calm');
  const [decisionConfidence, setDecisionConfidence] = useState<string>('4');
  const [note, setNote] = useState<string>(initialNote);
  const [declineReason, setDeclineReason] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<readonly string[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const defs = await journal.getDefinitions();
        if (!active) return;
        const found =
          [...defs.definitions]
            .filter((d) => d.entryTypeId === POSITION_CHANGE_REFLECTION_TYPE_ID)
            .sort((a, b) => b.revision - a.revision)[0] ?? null;
        setPcDef(found);
      } catch (err) {
        if (active) {
          setErrors([
            err instanceof Error ? err.message : 'Unable to load Position Change Reflection form.',
          ]);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [journal]);

  useEffect(() => {
    if (!quantityEdited) {
      setQuantity(openSharesDisplay);
    }
  }, [openSharesDisplay, quantityEdited]);

  useEffect(() => {
    if (!onDirtyChange) return;
    const edited =
      quantity !== openSharesDisplay ||
      fillPrice.trim().length > 0 ||
      fee !== '0.00' ||
      closeReasonId !== '' ||
      note.trim() !== initialNote.trim() ||
      declineReason.trim().length > 0;
    onDirtyChange(edited);
    return () => onDirtyChange(false);
  }, [quantity, openSharesDisplay, fillPrice, fee, closeReasonId, note, initialNote, declineReason, onDirtyChange]);

  const parsedQty = tryParseDecimal(quantity);
  const parsedOpen = openShares ?? tryParseDecimal(openSharesDisplay);
  const parsedPrice = tryParseDecimal(fillPrice);
  const isClosingAll =
    parsedQty !== null &&
    parsedOpen !== null &&
    isPositive(parsedQty) &&
    cmp(parsedQty, parsedOpen) === 0;
  const isPartial =
    parsedQty !== null &&
    parsedOpen !== null &&
    isPositive(parsedQty) &&
    cmp(parsedQty, parsedOpen) < 0;

  // Plan conformance feedback ("Against the Plan") matching prototypes/review-coach-mockup/index.html
  const planCheckMessages: string[] = [];
  let matchesLine: 'Stop' | 'Target' | null = null;
  if (parsedPrice && isPositive(parsedPrice) && stopPrice && targetPrice) {
    if (cmp(parsedPrice, stopPrice) <= 0) {
      matchesLine = 'Stop';
    } else if (cmp(parsedPrice, targetPrice) >= 0) {
      matchesLine = 'Target';
    } else {
      planCheckMessages.push('Neither the Stop nor the Target is reached at this fill price.');
    }
  }
  if (isPartial) {
    planCheckMessages.push(
      `The Plan's exit is all ${openSharesDisplay} shares. This sells ${quantity.trim()}.`,
    );
  }
  const followsPlan = matchesLine !== null && planCheckMessages.length === 0;

  function renderPlanCheckStatus() {
    if (followsPlan && matchesLine) {
      return (
        <p style={{ margin: 0 }}>
          <strong className={cockpitStyles.up}>Follows the Plan:</strong> all{' '}
          {openSharesDisplay} shares, at the {matchesLine}.
        </p>
      );
    }
    if (planCheckMessages.length > 0) {
      return (
        <p style={{ margin: 0 }}>
          <strong style={{ color: 'var(--amber)' }}>Leaves the Plan:</strong>{' '}
          {planCheckMessages.join(' ')}
        </p>
      );
    }
    return (
      <p className={styles.muted} style={{ margin: 0 }}>
        {isClosingAll
          ? 'Closing all remaining open shares transitions this Trade to Closed.'
          : 'Partial sale realizes FIFO Lot Matches against your earliest open shares.'}
      </p>
    );
  }

  function getSubmitLabel(): string {
    if (submitting) return 'Recording Exit…';
    return isClosingAll ? 'Save & Close Trade' : 'Save Exit';
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setErrors([]);

    if (isClosingAll && closeReasonsUnavailable) {
      setErrors(['Close Reasons failed to load from catalog; reload before closing this Trade.']);
      return;
    }
    if (isClosingAll && !closeReasonId) {
      setErrors(['Close Reason is required when closing all remaining shares.']);
      return;
    }

    let reflection: PositionChangeReflectionDisposition;
    if (disposition === 'Defer') {
      reflection = { kind: 'Defer' };
    } else if (disposition === 'Decline') {
      reflection = { kind: 'Decline', reason: declineReason };
    } else {
      if (!pcDef) {
        setErrors(['Position Change Reflection definition is unavailable.']);
        return;
      }
      reflection = {
        kind: 'Complete',
        definitionId: pcDef.id,
        definitionRevision: pcDef.revision,
        decisionMode,
        primaryEmotion,
        decisionConfidence: Number(decisionConfidence),
        note,
      };
    }

    setSubmitting(true);
    const economicTime = resolveExecutionEconomicIso(
      executionDate,
      clock.now(),
      latestExecutionIso,
    );

    try {
      const res = await workflows.recordPositionChange({
        tradeId,
        expectedFactRevision,
        economicTime,
        executions: [
          {
            side: 'Sell',
            quantity: quantity.trim(),
            fillPrice: fillPrice.trim(),
            fee: fee.trim() || '0.00',
            plannedLegIntent,
          },
        ],
        closeReasonId: isClosingAll ? closeReasonId : undefined,
        reflection,
      });

      if (res.status === 'Recorded') {
        await onSuccess();
        return;
      }
      if (res.status === 'Rejected') {
        setErrors(res.errors.map((err) => err.message));
        return;
      }
      if (res.status === 'Conflict') {
        onConflict?.();
        setErrors([`${res.message} Reloaded latest revision — please review and submit again.`]);
        return;
      }
      setErrors([`Write blocked: runtime is ${res.reason}.`]);
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Unable to record exit.']);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      className={styles.card}
      aria-labelledby={`record-exit-heading-${tradeId}`}
      style={{ marginBottom: 14 }}
    >
      <div className={styles.spaceBetween} style={{ marginBottom: 12 }}>
        <h2
          id={`record-exit-heading-${tradeId}`}
          className={styles.cardTitle}
          style={{ margin: 0 }}
        >
          Record Exit — {symbol} ({openSharesDisplay} shares open)
        </h2>
        <button type="button" className={styles.btnSecondary} onClick={onCancel}>
          Cancel
        </button>
      </div>

      {errors.length > 0 && (
        <div className={styles.alertError} role="alert">
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {errors.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className={cockpitStyles.formGrid} style={{ marginBottom: 12 }}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`exit-exec-date-${tradeId}`}>
              Execution Date
            </label>
            <input
              id={`exit-exec-date-${tradeId}`}
              className={styles.input}
              type="date"
              max={initialDate}
              value={executionDate}
              disabled={!writable}
              onChange={(e) => setExecutionDate(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor={`exit-qty-${tradeId}`}>
              Shares to Sell
            </label>
            <input
              id={`exit-qty-${tradeId}`}
              className={styles.input}
              type="text"
              inputMode="decimal"
              value={quantity}
              disabled={!writable}
              onChange={(e) => {
                setQuantityEdited(true);
                setQuantity(e.target.value);
              }}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor={`exit-price-${tradeId}`}>
              Fill Price ($)
            </label>
            <input
              id={`exit-price-${tradeId}`}
              className={styles.input}
              type="text"
              inputMode="decimal"
              placeholder={
                targetPrice ? toDecimalString(targetPrice, 2) : 'e.g. 112.00'
              }
              value={fillPrice}
              disabled={!writable}
              onChange={(e) => setFillPrice(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor={`exit-fee-${tradeId}`}>
              Fee ($)
            </label>
            <input
              id={`exit-fee-${tradeId}`}
              className={styles.input}
              type="text"
              inputMode="decimal"
              value={fee}
              disabled={!writable}
              onChange={(e) => setFee(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor={`exit-intent-${tradeId}`}>
              Planned-Leg Intent
            </label>
            <select
              id={`exit-intent-${tradeId}`}
              className={styles.select}
              value={plannedLegIntent}
              disabled={!writable}
              onChange={(e) => setPlannedLegIntent(e.target.value as PlannedLegIntent)}
            >
              <option value="PlannedLeg">Serves Planned Leg</option>
              <option value="ExplicitlyUnplanned">Explicitly Unplanned</option>
            </select>
          </div>

          {isClosingAll && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor={`exit-close-reason-${tradeId}`}>
                Close Reason (required)
              </label>
              {closeReasonsUnavailable ? (
                <div className={styles.alertError} role="alert">
                  Close Reasons failed to load from catalog; reload before closing.
                </div>
              ) : (
                <select
                  id={`exit-close-reason-${tradeId}`}
                  className={styles.select}
                  value={closeReasonId}
                  disabled={!writable}
                  onChange={(e) => setCloseReasonId(e.target.value)}
                >
                  <option value="">Select Close Reason…</option>
                  {closeReasons.map((cr) => (
                    <option key={cr.id} value={cr.id}>
                      {cr.currentLabel}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

        {/* Against the Plan conformance box */}
        <div className={cockpitStyles.planCheckBox}>
          <div className={cockpitStyles.kvGroupTitle} style={{ marginBottom: 4 }}>
            Against the Plan
          </div>
          <p className={styles.muted} style={{ margin: '0 0 4px' }}>
            The Plan&apos;s exit: all {openSharesDisplay} shares at Stop (
            {stopPriceDisplay ?? '—'}) or Target ({targetPriceDisplay ?? '—'}).
          </p>
          {renderPlanCheckStatus()}
          {priorExitAction?.reason && (
            <p className={styles.muted} style={{ margin: '6px 0 0' }}>
              Your Review note ({priorExitAction.reviewDateShort}): &ldquo;{priorExitAction.reason}
              &rdquo;
            </p>
          )}
        </div>

        <fieldset className={cockpitStyles.reflectionFieldset}>
          <legend className={styles.label}>Position Change Reflection</legend>
          <p className={styles.muted} style={{ marginTop: 0 }}>
            <strong>Defer</strong> is preselected so fast exit capture works anytime — deferred
            reflections surface in your next Review.
          </p>

          <div className={styles.row} style={{ marginBottom: 12 }}>
            <label className={styles.row} style={{ cursor: 'pointer' }}>
              <input
                type="radio"
                name={`exit-reflection-${tradeId}`}
                value="Defer"
                checked={disposition === 'Defer'}
                onChange={() => setDisposition('Defer')}
              />
              Defer (due in next Review)
            </label>
            <label className={styles.row} style={{ cursor: 'pointer' }}>
              <input
                type="radio"
                name={`exit-reflection-${tradeId}`}
                value="Complete"
                checked={disposition === 'Complete'}
                onChange={() => setDisposition('Complete')}
              />
              Complete now
            </label>
            <label className={styles.row} style={{ cursor: 'pointer' }}>
              <input
                type="radio"
                name={`exit-reflection-${tradeId}`}
                value="Decline"
                checked={disposition === 'Decline'}
                onChange={() => setDisposition('Decline')}
              />
              Decline
            </label>
          </div>

          {disposition === 'Complete' && (
            <div className={cockpitStyles.formGrid}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor={`exit-pc-mode-${tradeId}`}>
                  Decision mode
                </label>
                <select
                  id={`exit-pc-mode-${tradeId}`}
                  className={styles.select}
                  value={decisionMode}
                  onChange={(e) => setDecisionMode(e.target.value as DecisionMode)}
                >
                  {DECISION_MODE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor={`exit-pc-emotion-${tradeId}`}>
                  Primary emotion
                </label>
                <select
                  id={`exit-pc-emotion-${tradeId}`}
                  className={styles.select}
                  value={primaryEmotion}
                  onChange={(e) => setPrimaryEmotion(e.target.value as PrimaryEmotion)}
                >
                  {PRIMARY_EMOTION_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor={`exit-pc-confidence-${tradeId}`}>
                  Decision confidence (1–5)
                </label>
                <select
                  id={`exit-pc-confidence-${tradeId}`}
                  className={styles.select}
                  value={decisionConfidence}
                  onChange={(e) => setDecisionConfidence(e.target.value)}
                >
                  <option value="1">1 — Low</option>
                  <option value="2">2</option>
                  <option value="3">3 — Moderate</option>
                  <option value="4">4</option>
                  <option value="5">5 — High</option>
                </select>
              </div>

              <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
                <label className={styles.label} htmlFor={`exit-pc-note-${tradeId}`}>
                  Note (Optional)
                </label>
                <textarea
                  id={`exit-pc-note-${tradeId}`}
                  className={cockpitStyles.textarea}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </div>
          )}

          {disposition === 'Decline' && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor={`exit-pc-decline-${tradeId}`}>
                Reason for declining (Optional)
              </label>
              <input
                id={`exit-pc-decline-${tradeId}`}
                className={styles.input}
                type="text"
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="e.g., Target fill executed as planned"
              />
            </div>
          )}
        </fieldset>

        <div className={styles.row}>
          <button type="submit" className={styles.btnPrimary} disabled={!writable || submitting}>
            {getSubmitLabel()}
          </button>
          <button type="button" className={styles.btnSecondary} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
