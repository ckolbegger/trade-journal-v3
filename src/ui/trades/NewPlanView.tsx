import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { ReferenceCatalog } from '../../catalog/reference-catalog';
import {
  PLAN_REFLECTION_TYPE_ID,
  PRIMARY_EMOTION_OPTIONS,
  type Journal,
  type PrimaryEmotion,
} from '../../journal/journal';
import type {
  AccountRecord,
  EntryDefinitionRecord,
  InstitutionRecord,
  StrategyRecord,
} from '../../persistence/idb';
import type { Clock } from '../../shared/clock';
import { assessLongStockPlan } from '../../trade-analysis/assess-plan';
import type { TradeWorkflows } from '../../trade-workflows/trade-workflows';
import styles from '../shell/AppShell.module.css';
import cockpitStyles from './Cockpit.module.css';

interface NewPlanViewProps {
  readonly accountRefreshKey: number;
  readonly catalog: ReferenceCatalog;
  readonly journal: Journal;
  readonly workflows: TradeWorkflows;
  readonly clock: Clock;
  readonly writable: boolean;
  readonly onPlanConfirmed: (tradeId: string) => void;
  readonly onGoToAccounts: () => void;
  readonly onDirtyChange: (dirty: boolean) => void;
}

export function NewPlanView({
  accountRefreshKey,
  catalog,
  journal,
  workflows,
  clock,
  writable,
  onPlanConfirmed,
  onGoToAccounts,
  onDirtyChange,
}: NewPlanViewProps) {
  const [accounts, setAccounts] = useState<readonly AccountRecord[]>([]);
  const [institutions, setInstitutions] = useState<readonly InstitutionRecord[]>([]);
  const [strategies, setStrategies] = useState<readonly StrategyRecord[]>([]);
  const [planDef, setPlanDef] = useState<EntryDefinitionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [accountId, setAccountId] = useState('');
  const [strategyId, setStrategyId] = useState('');
  const [symbol, setSymbol] = useState('');
  const [quantity, setQuantity] = useState('');
  const [intendedEntryPrice, setIntendedEntryPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [thesis, setThesis] = useState('');
  const [invalidation, setInvalidation] = useState('');
  const [conviction, setConviction] = useState<string>('');
  const [primaryEmotion, setPrimaryEmotion] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<readonly string[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [instRes, acctRes, stratRes, defRes] = await Promise.all([
          catalog.query({ family: 'Institution', includeInactive: false }),
          catalog.query({ family: 'Account', includeInactive: false }),
          catalog.query({ family: 'Strategy', includeInactive: false }),
          journal.getDefinitions(),
        ]);
        if (!active) return;
        if (instRes.family === 'Institution') setInstitutions(instRes.items);
        if (acctRes.family === 'Account') {
          setAccounts(acctRes.items);
          setAccountId((prev) =>
            acctRes.items.some((a) => a.id === prev) ? prev : (acctRes.items[0]?.id ?? ''),
          );
        }
        if (stratRes.family === 'Strategy') {
          setStrategies(stratRes.items);
          setStrategyId((prev) => prev || stratRes.items[0]?.id || '');
        }
        const def = defRes.definitions.find((d) => d.entryTypeId === PLAN_REFLECTION_TYPE_ID) ?? null;
        setPlanDef(def);
        setLoadError(null);
      } catch (err) {
        if (active) {
          setLoadError(err instanceof Error ? err.message : 'Unable to load trade planning form.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [catalog, journal, accountRefreshKey]);

  useEffect(() => {
    const dirty =
      symbol.trim().length > 0 ||
      quantity.trim().length > 0 ||
      intendedEntryPrice.trim().length > 0 ||
      stopPrice.trim().length > 0 ||
      targetPrice.trim().length > 0 ||
      thesis.trim().length > 0 ||
      invalidation.trim().length > 0;
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [symbol, quantity, intendedEntryPrice, stopPrice, targetPrice, thesis, invalidation, onDirtyChange]);

  const instMap = useMemo(
    () => new Map(institutions.map((i) => [i.id, i.currentLabel])),
    [institutions],
  );

  // Live exact Plan Baseline preview powered directly by TradeAnalysis.assessLongStockPlan
  const liveAssessment = useMemo(() => {
    if (!symbol && !quantity && !intendedEntryPrice && !stopPrice && !targetPrice) {
      return null;
    }
    return assessLongStockPlan({
      symbol,
      quantity,
      intendedEntryPrice,
      stopPrice,
      targetPrice,
    });
  }, [symbol, quantity, intendedEntryPrice, stopPrice, targetPrice]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!planDef) {
      setErrors(['Plan Reflection definition is unavailable. Reload the app and try again.']);
      return;
    }
    setErrors([]);
    setSubmitting(true);
    try {
      const res = await workflows.confirmPlan({
        accountId,
        strategyId,
        symbol,
        quantity,
        intendedEntryPrice,
        stopPrice,
        targetPrice,
        economicTime: clock.nowIso(),
        planReflection: {
          definitionId: planDef.id,
          definitionRevision: planDef.revision,
          thesis,
          invalidation,
          conviction: conviction ? Number(conviction) : undefined,
          primaryEmotion: primaryEmotion ? (primaryEmotion as PrimaryEmotion) : undefined,
        },
      });
      if (res.status === 'Confirmed') {
        setSymbol('');
        setQuantity('');
        setIntendedEntryPrice('');
        setStopPrice('');
        setTargetPrice('');
        setThesis('');
        setInvalidation('');
        setConviction('');
        setPrimaryEmotion('');
        onPlanConfirmed(res.postCommit.trade.id);
        return;
      }
      if (res.status === 'Rejected') {
        setErrors(res.errors.map((err) => err.message));
        return;
      }
      setErrors([`Write blocked: runtime is ${res.reason}.`]);
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Unable to confirm plan.']);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <section className={styles.card} aria-busy="true">
        Loading trade planning form…
      </section>
    );
  }

  if (loadError) {
    return (
      <section className={styles.card}>
        <div className={styles.alertError} role="alert">
          {loadError}
        </div>
      </section>
    );
  }

  if (accounts.length === 0) {
    return (
      <section className={styles.card} aria-labelledby="new-plan-needs-account">
        <h1 id="new-plan-needs-account" className={styles.cardTitle}>
          Add an Account Before Planning a Trade
        </h1>
        <p className={styles.muted}>
          Your Workspace does not have an active brokerage Account yet. Create an Institution and
          Account first so your Plan is anchored to a real account.
        </p>
        <button type="button" className={styles.btnPrimary} onClick={onGoToAccounts}>
          Go to Accounts
        </button>
      </section>
    );
  }

  return (
    <section aria-labelledby="new-plan-heading">
      <div className={styles.spaceBetween} style={{ marginBottom: 16 }}>
        <div>
          <h1 id="new-plan-heading" style={{ margin: 0, fontSize: '1.45rem' }}>
            New Trade Plan
          </h1>
          <p className={styles.muted} style={{ margin: '4px 0 0' }}>
            Freeze your planned terms, 1R baseline, Thesis, and Invalidation before putting capital
            at risk.
          </p>
        </div>
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
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Plan Terms</h2>
          <div className={cockpitStyles.formGrid}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="plan-account">
                Account
              </label>
              <select
                id="plan-account"
                className={styles.select}
                value={accountId}
                disabled={!writable}
                onChange={(e) => setAccountId(e.target.value)}
              >
                {accounts.map((acct) => (
                  <option key={acct.id} value={acct.id}>
                    {instMap.get(acct.institutionId) ?? 'Institution'} — {acct.currentLabel}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="plan-strategy">
                Strategy
              </label>
              <select
                id="plan-strategy"
                className={styles.select}
                value={strategyId}
                disabled={!writable}
                onChange={(e) => setStrategyId(e.target.value)}
              >
                {strategies.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.currentLabel}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="plan-symbol">
                Symbol
              </label>
              <input
                id="plan-symbol"
                className={styles.input}
                type="text"
                placeholder="e.g., AAPL"
                value={symbol}
                disabled={!writable}
                onChange={(e) => setSymbol(e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="plan-quantity">
                Shares
              </label>
              <input
                id="plan-quantity"
                className={styles.input}
                type="text"
                inputMode="decimal"
                placeholder="100"
                value={quantity}
                disabled={!writable}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="plan-entry">
                Intended Entry ($)
              </label>
              <input
                id="plan-entry"
                className={styles.input}
                type="text"
                inputMode="decimal"
                placeholder="185.50"
                value={intendedEntryPrice}
                disabled={!writable}
                onChange={(e) => setIntendedEntryPrice(e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="plan-stop">
                Stop Price ($)
              </label>
              <input
                id="plan-stop"
                className={styles.input}
                type="text"
                inputMode="decimal"
                placeholder="178.00"
                value={stopPrice}
                disabled={!writable}
                onChange={(e) => setStopPrice(e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="plan-target">
                Target Price ($)
              </label>
              <input
                id="plan-target"
                className={styles.input}
                type="text"
                inputMode="decimal"
                placeholder="208.00"
                value={targetPrice}
                disabled={!writable}
                onChange={(e) => setTargetPrice(e.target.value)}
              />
            </div>
          </div>

          <div className={cockpitStyles.metricGrid} style={{ marginTop: 14, marginBottom: 0 }}>
            <div className={cockpitStyles.metricBox}>
              <div className={cockpitStyles.metricLabel}>1R (Original Planned Risk)</div>
              <div className={cockpitStyles.metricValue} data-testid="preview-1r">
                {liveAssessment?.status === 'Accepted'
                  ? liveAssessment.baseline.originalPlannedRiskDisplay
                  : '—'}
              </div>
            </div>
            <div className={cockpitStyles.metricBox}>
              <div className={cockpitStyles.metricLabel}>Original Planned Reward</div>
              <div className={cockpitStyles.metricValue} data-testid="preview-reward">
                {liveAssessment?.status === 'Accepted'
                  ? liveAssessment.baseline.originalPlannedRewardDisplay
                  : '—'}
              </div>
            </div>
            <div className={cockpitStyles.metricBox}>
              <div className={cockpitStyles.metricLabel}>Planned Reward : Risk</div>
              <div className={cockpitStyles.metricValue} data-testid="preview-rr">
                {liveAssessment?.status === 'Accepted'
                  ? liveAssessment.baseline.plannedRewardToRiskDisplay
                  : '—'}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Plan Reflection</h2>
          <p className={styles.muted}>
            Entered once during Plan confirmation — Thesis and Invalidation freeze onto the Plan and
            are saved as an immutable Plan Reflection Entry.
          </p>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="plan-thesis">
              Why this trade, why now? (Required)
            </label>
            <textarea
              id="plan-thesis"
              className={cockpitStyles.textarea}
              value={thesis}
              disabled={!writable}
              onChange={(e) => setThesis(e.target.value)}
              placeholder="Describe the setup, catalyst, and why now."
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="plan-invalidation">
              What would invalidate the thesis? (Required)
            </label>
            <textarea
              id="plan-invalidation"
              className={cockpitStyles.textarea}
              value={invalidation}
              disabled={!writable}
              onChange={(e) => setInvalidation(e.target.value)}
              placeholder="What price action or event proves this thesis wrong?"
            />
          </div>

          <div className={cockpitStyles.formGrid}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="plan-conviction">
                Conviction (Optional, 1–5)
              </label>
              <select
                id="plan-conviction"
                className={styles.select}
                value={conviction}
                disabled={!writable}
                onChange={(e) => setConviction(e.target.value)}
              >
                <option value="">Unanswered</option>
                <option value="1">1 — Low</option>
                <option value="2">2</option>
                <option value="3">3 — Moderate</option>
                <option value="4">4</option>
                <option value="5">5 — High</option>
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="plan-emotion">
                Primary emotion (Optional)
              </label>
              <select
                id="plan-emotion"
                className={styles.select}
                value={primaryEmotion}
                disabled={!writable}
                onChange={(e) => setPrimaryEmotion(e.target.value)}
              >
                <option value="">Unanswered</option>
                {PRIMARY_EMOTION_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.row} style={{ marginTop: 12 }}>
            <button type="submit" className={styles.btnPrimary} disabled={!writable || submitting}>
              {submitting ? 'Confirming Plan…' : 'Confirm Plan'}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
