import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import type { UiFacade } from '../../app/compose.ts';
import { fromWorkspaceLocal, toWorkspaceLocal } from '../../domain/time/index.ts';
import type { EntryDefinitionRecord } from '../../app/types.ts';
import { useRuntime } from '../runtime.tsx';
import { confirmedDetail } from './confirmed-detail.ts';
import { describeIssues, type FieldIssue } from './plan-issues.ts';
import { ReflectionPrompts, type Answers } from './ReflectionPrompts.tsx';

interface Option {
  readonly id: string;
  readonly label: string;
  readonly recordRevision: number;
  // The plain labels, for presenting a confirmed Plan without a read.
  readonly name: string;
  readonly institution?: string;
}

export interface PlanFormProps {
  readonly facade: UiFacade;
  readonly timeZone: string;
  // The current instant, injectable so tests use a fixed clock.
  readonly now: () => string;
  // Reports whether any value differs from its initial value (update deferral, D1 A5).
  readonly onDirtyChange: (dirty: boolean) => void;
}

interface CatalogRow {
  readonly id: string;
  readonly label: string;
  readonly recordRevision: number;
  readonly institutionId?: string;
  readonly productKey?: string;
}

interface Fields {
  readonly accountId: string;
  readonly strategyId: string;
  readonly symbol: string;
  readonly quantity: string;
  readonly entry: string;
  readonly stop: string;
  readonly target: string;
  readonly planTime: string;
}

// The Long Stock Plan: one long Stock leg, one Stop, one Target (D1 A1), and the completed
// Plan Reflection. Nothing typed here is stored until Confirm Plan succeeds.
export function PlanForm({ facade, timeZone, now, onDirtyChange }: PlanFormProps) {
  const { writable } = useRuntime();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<readonly Option[] | undefined>();
  const [strategies, setStrategies] = useState<readonly Option[]>([]);
  const [definition, setDefinition] = useState<EntryDefinitionRecord | undefined>();
  const [answers, setAnswers] = useState<Answers>({});
  // Plan confirmation Economic Time is trader-entered, defaulting to now (decision 20).
  const [fields, setFields] = useState<Fields>(() => ({
    accountId: '',
    strategyId: '',
    symbol: '',
    quantity: '',
    entry: '',
    stop: '',
    target: '',
    planTime: toWorkspaceLocal(now(), timeZone),
  }));
  const set = (name: keyof Fields) => (value: string) => setFields((f) => ({ ...f, [name]: value }));
  const [issues, setIssues] = useState<readonly FieldIssue[]>([]);
  // The values as first shown; the form is unsaved while anything differs from them.
  const [initial, setInitial] = useState<Fields | undefined>();
  const dirty = initial !== undefined && (JSON.stringify(fields) !== JSON.stringify(initial) || Object.keys(answers).length > 0);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  // Leaving the form abandons it, so it no longer holds an update back.
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  const summaryRef = useRef<HTMLElement>(null);

  // A rejected confirmation moves focus to the summary of every issue.
  useEffect(() => {
    if (issues.length > 0) summaryRef.current?.focus();
  }, [issues]);

  useEffect(() => {
    const rows = async (family: 'Institution' | 'Account' | 'Strategy') => {
      const page = await facade.ReferenceCatalog.query({ family, pageSize: 500 });
      return (page.kind === 'Page' ? page.items : []) as readonly CatalogRow[];
    };
    void facade.Journal.getDefinitions({ latestFor: 'entry-type.plan-reflection' }).then((result) => {
      if (result.kind === 'Found') setDefinition(result.definition);
    });
    void Promise.all([rows('Institution'), rows('Account'), rows('Strategy')]).then(([institutions, accountRows, strategyRows]) => {
      const institution = new Map(institutions.map((i) => [i.id, i.label]));
      const accountOptions = accountRows.map((a) => ({
        id: a.id,
        label: `${institution.get(a.institutionId ?? '') ?? ''} — ${a.label}`,
        recordRevision: a.recordRevision,
        name: a.label,
        institution: institution.get(a.institutionId ?? '') ?? '',
      }));
      // Only Strategies this release installs are offered (decision 1: Long Stock until D7).
      const installed = new Set(facade.capabilities.strategies);
      const strategyOptions = strategyRows
        .filter((s) => installed.has(s.productKey ?? ''))
        .map((s) => ({ id: s.id, label: s.label, recordRevision: s.recordRevision, name: s.label }));
      setAccounts(accountOptions);
      setStrategies(strategyOptions);
      setFields((f) => {
        const loaded = { ...f, accountId: accountOptions[0]?.id ?? '', strategyId: strategyOptions[0]?.id ?? '' };
        setInitial(loaded);
        return loaded;
      });
    });
  }, [facade]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!definition) return;
    const economicTime = fromWorkspaceLocal(fields.planTime, timeZone);
    if (!economicTime.ok) return;
    const account = accounts?.find((a) => a.id === fields.accountId);
    const strategy = strategies.find((s) => s.id === fields.strategyId);
    const symbol = fields.symbol.trim().toUpperCase();
    const result = await facade.TradeWorkflows.confirmPlan({
      accountId: fields.accountId,
      accountRevision: account?.recordRevision ?? 0,
      strategyId: fields.strategyId,
      strategyRevision: strategy?.recordRevision ?? 0,
      economicTime: economicTime.instant,
      plan: {
        underlying: symbol,
        legs: [{ side: 'Long', instrument: { kind: 'Stock', symbol }, quantity: fields.quantity.trim(), intendedEntry: fields.entry.trim() }],
        stops: [{ kind: 'UnderlyingPrice', price: fields.stop.trim() }],
        targets: [{ kind: 'UnderlyingPrice', price: fields.target.trim() }],
      },
      reflection: { definitionId: definition.id, answers },
    });
    if (result.kind === 'Rejected') setIssues(describeIssues(result.issues, definition));
    if (result.kind === 'Confirmed') {
      const confirmed = confirmedDetail(result, definition, {
        strategy: strategy?.name ?? '',
        account: account?.name ?? '',
        institution: account?.institution ?? '',
      });
      void navigate(`/trades/${result.receipt.tradeId}`, { state: { confirmed } });
    }
  };

  if (!accounts || !definition) return <p role="status">Loading the Plan form…</p>;

  const errorFor = (field: string) => issues.filter((i) => i.field === field).map((i) => i.message).join(' ') || undefined;
  const fieldError = (field: string) => {
    const error = errorFor(field);
    return error ? (
      <p id={`${field}-error`} className="field-error">
        {error}
      </p>
    ) : null;
  };
  const describedBy = (field: string) => (errorFor(field) ? { 'aria-invalid': true, 'aria-describedby': `${field}-error` } : {});
  const input = (name: keyof Fields, label: string, inputMode?: 'decimal') => (
    <div className="field">
      <label>
        {label}
        <input value={fields[name]} inputMode={inputMode} onChange={(e) => set(name)(e.target.value)} {...describedBy(name)} />
      </label>
      {fieldError(name)}
    </div>
  );
  const promptErrors = Object.fromEntries(definition.prompts.flatMap((p) => (errorFor(p.id) ? [[p.id, errorFor(p.id)!]] : [])));

  return (
    <form className="plan-form" noValidate onSubmit={(event) => void submit(event)}>
      <h1>New Plan</h1>
      {issues.length > 0 && (
        <section ref={summaryRef} tabIndex={-1} className="banner warning" aria-labelledby="plan-issues-heading">
          <h2 id="plan-issues-heading">This Plan can’t be confirmed yet</h2>
          <ul>
            {issues.map((issue) => (
              <li key={`${issue.field}-${issue.message}`}>{issue.message}</li>
            ))}
          </ul>
        </section>
      )}
      <label>
        Account
        <select value={fields.accountId} onChange={(e) => set('accountId')(e.target.value)}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Strategy
        <select value={fields.strategyId} onChange={(e) => set('strategyId')(e.target.value)}>
          {strategies.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      {input('symbol', 'Symbol')}
      {input('quantity', 'Quantity', 'decimal')}
      {input('entry', 'Intended entry', 'decimal')}
      {input('stop', 'Stop', 'decimal')}
      {input('target', 'Target', 'decimal')}
      <label>
        Plan time
        <input type="datetime-local" value={fields.planTime} onChange={(e) => set('planTime')(e.target.value)} />
      </label>
      <ReflectionPrompts definition={definition} answers={answers} onChange={setAnswers} errors={promptErrors} />
      <button type="submit" className="pill primary" disabled={!writable}>
        Confirm Plan
      </button>
      {/* Leaving records nothing: entered values are never saved as a draft. */}
      <button type="button" className="pill secondary" onClick={() => void navigate('/')}>
        Cancel
      </button>
    </form>
  );
}
