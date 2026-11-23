import { useEffect, useState, type FormEvent } from 'react';
import {
  DECISION_MODE_OPTIONS,
  POSITION_CHANGE_REFLECTION_TYPE_ID,
  PRIMARY_EMOTION_OPTIONS,
  type DecisionMode,
  type Journal,
  type PrimaryEmotion,
} from '../../journal/journal';
import type { EntryDefinitionRecord, PlannedLegIntent } from '../../persistence/idb';
import type { Clock } from '../../shared/clock';
import type {
  PositionChangeReflectionDisposition,
  TradeWorkflows,
} from '../../trade-workflows/trade-workflows';
import styles from '../shell/AppShell.module.css';
import cockpitStyles from './Cockpit.module.css';

interface FillRowDraft {
  readonly quantity: string;
  readonly fillPrice: string;
  readonly fee: string;
  readonly plannedLegIntent: PlannedLegIntent;
}

interface RecordEntryPanelProps {
  readonly tradeId: string;
  readonly symbol: string;
  readonly expectedFactRevision: number;
  readonly defaultQuantity: string;
  readonly defaultPrice: string;
  readonly journal: Journal;
  readonly workflows: TradeWorkflows;
  readonly clock: Clock;
  readonly writable: boolean;
  readonly onRecorded: () => void;
  readonly onConflict: () => void;
  readonly onCancel: () => void;
  readonly onDirtyChange: (dirty: boolean) => void;
}

export function RecordEntryPanel({
  tradeId,
  symbol,
  expectedFactRevision,
  defaultQuantity,
  defaultPrice,
  journal,
  workflows,
  clock,
  writable,
  onRecorded,
  onConflict,
  onCancel,
  onDirtyChange,
}: RecordEntryPanelProps) {
  const [pcDef, setPcDef] = useState<EntryDefinitionRecord | null>(null);
  const [fills, setFills] = useState<readonly FillRowDraft[]>([
    {
      quantity: defaultQuantity,
      fillPrice: defaultPrice,
      fee: '0.00',
      plannedLegIntent: 'PlannedLeg',
    },
  ]);
  const [disposition, setDisposition] = useState<'Defer' | 'Complete' | 'Decline'>('Defer');
  const [decisionMode, setDecisionMode] = useState<DecisionMode>('As Planned');
  const [primaryEmotion, setPrimaryEmotion] = useState<PrimaryEmotion>('Calm');
  const [decisionConfidence, setDecisionConfidence] = useState<string>('4');
  const [note, setNote] = useState('');
  const [declineReason, setDeclineReason] = useState('');
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
    const edited =
      fills.length > 1 ||
      fills[0]?.quantity !== defaultQuantity ||
      fills[0]?.fillPrice !== defaultPrice ||
      fills[0]?.fee !== '0.00' ||
      fills[0]?.plannedLegIntent !== 'PlannedLeg' ||
      disposition !== 'Defer' ||
      note.trim().length > 0 ||
      declineReason.trim().length > 0;
    onDirtyChange(edited);
    return () => onDirtyChange(false);
  }, [fills, defaultQuantity, defaultPrice, disposition, note, declineReason, onDirtyChange]);

  const updateFill = (idx: number, patch: Partial<FillRowDraft>) => {
    setFills((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  const addFillRow = () => {
    setFills((prev) => [
      ...prev,
      { quantity: '', fillPrice: defaultPrice, fee: '0.00', plannedLegIntent: 'PlannedLeg' },
    ]);
  };

  const removeFillRow = (idx: number) => {
    setFills((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setErrors([]);

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
    try {
      const res = await workflows.recordPositionChange({
        tradeId,
        expectedFactRevision,
        economicTime: clock.nowIso(),
        executions: fills,
        reflection,
      });

      if (res.status === 'Recorded') {
        onRecorded();
        return;
      }
      if (res.status === 'Rejected') {
        setErrors(res.errors.map((err) => err.message));
        return;
      }
      if (res.status === 'Conflict') {
        onConflict();
        setErrors([`${res.message} Reloaded latest revision — please review and submit again.`]);
        return;
      }
      setErrors([`Write blocked: runtime is ${res.reason}.`]);
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Unable to record entry.']);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className={styles.card} aria-labelledby="record-entry-heading">
      <div className={styles.spaceBetween} style={{ marginBottom: 12 }}>
        <h2 id="record-entry-heading" className={styles.cardTitle} style={{ margin: 0 }}>
          Record Opening Entry — {symbol}
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
        {fills.map((row, idx) => (
          <div key={idx} className={cockpitStyles.formGrid} style={{ marginBottom: 10 }}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor={`fill-qty-${idx}`}>
                Shares {fills.length > 1 ? `#${idx + 1}` : ''}
              </label>
              <input
                id={`fill-qty-${idx}`}
                className={styles.input}
                type="text"
                inputMode="decimal"
                value={row.quantity}
                disabled={!writable}
                onChange={(e) => updateFill(idx, { quantity: e.target.value })}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor={`fill-price-${idx}`}>
                Fill Price ($)
              </label>
              <input
                id={`fill-price-${idx}`}
                className={styles.input}
                type="text"
                inputMode="decimal"
                value={row.fillPrice}
                disabled={!writable}
                onChange={(e) => updateFill(idx, { fillPrice: e.target.value })}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor={`fill-fee-${idx}`}>
                Fee ($)
              </label>
              <input
                id={`fill-fee-${idx}`}
                className={styles.input}
                type="text"
                inputMode="decimal"
                value={row.fee}
                disabled={!writable}
                onChange={(e) => updateFill(idx, { fee: e.target.value })}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor={`fill-intent-${idx}`}>
                Planned-Leg Intent
              </label>
              <select
                id={`fill-intent-${idx}`}
                className={styles.select}
                value={row.plannedLegIntent}
                disabled={!writable}
                onChange={(e) =>
                  updateFill(idx, { plannedLegIntent: e.target.value as PlannedLegIntent })
                }
              >
                <option value="PlannedLeg">Serves Planned Leg</option>
                <option value="ExplicitlyUnplanned">Explicitly Unplanned</option>
              </select>
            </div>

            {fills.length > 1 && (
              <div className={styles.field} style={{ justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => removeFillRow(idx)}
                >
                  Remove Fill
                </button>
              </div>
            )}
          </div>
        ))}

        <div style={{ marginBottom: 16 }}>
          <button
            type="button"
            className={styles.btnSecondary}
            disabled={!writable}
            onClick={addFillRow}
          >
            + Add Another Fill
          </button>
        </div>

        <fieldset
          style={{
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-md)',
            padding: 14,
            marginBottom: 14,
          }}
        >
          <legend className={styles.label}>Position Change Reflection</legend>
          <p className={styles.muted} style={{ marginTop: 0 }}>
            <strong>Defer</strong> is preselected so market-hours capture stays fast — deferred
            reflections surface in your next after-close Daily Review.
          </p>

          <div className={styles.row} style={{ marginBottom: 12 }}>
            <label className={styles.row} style={{ cursor: 'pointer' }}>
              <input
                type="radio"
                name="reflection-disposition"
                value="Defer"
                checked={disposition === 'Defer'}
                onChange={() => setDisposition('Defer')}
              />
              Defer (due in next Review)
            </label>
            <label className={styles.row} style={{ cursor: 'pointer' }}>
              <input
                type="radio"
                name="reflection-disposition"
                value="Complete"
                checked={disposition === 'Complete'}
                onChange={() => setDisposition('Complete')}
              />
              Complete now
            </label>
            <label className={styles.row} style={{ cursor: 'pointer' }}>
              <input
                type="radio"
                name="reflection-disposition"
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
                <label className={styles.label} htmlFor="pc-decision-mode">
                  Decision mode
                </label>
                <select
                  id="pc-decision-mode"
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
                <label className={styles.label} htmlFor="pc-emotion">
                  Primary emotion
                </label>
                <select
                  id="pc-emotion"
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
                <label className={styles.label} htmlFor="pc-confidence">
                  Decision confidence (1–5)
                </label>
                <select
                  id="pc-confidence"
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
                <label className={styles.label} htmlFor="pc-note">
                  Note (Optional)
                </label>
                <textarea
                  id="pc-note"
                  className={cockpitStyles.textarea}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </div>
          )}

          {disposition === 'Decline' && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="pc-decline-reason">
                Reason for declining (Optional)
              </label>
              <input
                id="pc-decline-reason"
                className={styles.input}
                type="text"
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="e.g., Routine limit fill"
              />
            </div>
          )}
        </fieldset>

        <button type="submit" className={styles.btnPrimary} disabled={!writable || submitting}>
          {submitting ? 'Recording Entry…' : 'Save Opening Entry'}
        </button>
      </form>
    </section>
  );
}
