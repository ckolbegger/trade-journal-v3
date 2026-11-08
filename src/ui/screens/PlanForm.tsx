import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import type { UiFacade } from '../../app/compose.ts';
import { fromWorkspaceLocal, toWorkspaceLocal } from '../../domain/time/index.ts';
import { exerciseIntentApplies, type StrategyShape } from '../../domain/strategy/index.ts';
import { Rational } from '../../domain/values/index.ts';
import type { EntryDefinitionRecord } from '../../app/types.ts';
import { money } from '../format.ts';
import { PageTitle } from '../PageTitle.tsx';
import { useRuntime } from '../runtime.tsx';
import { confirmedDetail } from './confirmed-detail.ts';
import { handOffConfirmed } from './confirmed-handoff.ts';
import { answerChanged, fieldIssues, isValidSymbol, IssueSummary, positiveDecimal } from './form-issues.tsx';
import { describeIssues, type FieldIssue } from './plan-issues.ts';
import { AMBIGUOUS_TIME, INVALID_TIME, LOCAL_TIME_CODES, minuteOf, NONEXISTENT_TIME } from './local-time.ts';
import { ReflectionPrompts, type Answers } from './ReflectionPrompts.tsx';
import { plural } from './ReviewCard.tsx';

const PLAN_TIME_MESSAGES = {
  InvalidLocalTime: `The Plan time ${INVALID_TIME}`,
  NonexistentLocalTime: `The Plan time ${NONEXISTENT_TIME}`,
  AmbiguousLocalTime: `The Plan time ${AMBIGUOUS_TIME}`,
} as const;

interface Option {
  readonly id: string;
  readonly label: string;
  readonly recordRevision: number;
  // The plain labels, for presenting a confirmed Plan without a read.
  readonly name: string;
  readonly institution?: string;
  readonly productKey?: string;
  // The Strategy's role shape: what the form shows and submits is read from it, never from its name.
  readonly shape?: StrategyShape;
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
  readonly shape?: StrategyShape;
}

interface Fields {
  readonly accountId: string;
  readonly strategyId: string;
  readonly symbol: string;
  readonly expiration: string;
  readonly strike: string;
  readonly quantity: string;
  readonly entry: string;
  readonly stop: string;
  readonly target: string;
  readonly planTime: string;
}

// The single Call or Put role an option Strategy's shape has; none for a Stock shape.
function optionRoleOf(shape: StrategyShape | undefined) {
  const role = shape?.roles[0];
  return role && role.instrument !== 'Stock' ? { side: role.side, right: role.instrument } : undefined;
}

const OPTION_TRIGGER_CODES: ReadonlySet<string> = new Set(['NoPositiveRisk', 'TargetNotBeyondEntry', 'StopTargetOrder']);

// A Long Call and a Cash-Secured Put gain as the Underlying rises; a Long Put as it falls. Read from the role.
const isBullish = (role: NonNullable<ReturnType<typeof optionRoleOf>>) => (role.right === 'Call') === (role.side === 'Long');

// The Long Stock Plan: one long Stock leg, one Stop, one Target (D1 A1), and the completed
// Plan Reflection. Nothing typed here is stored until Confirm Plan succeeds.
export function PlanForm({ facade, timeZone, now, onDirtyChange }: PlanFormProps) {
  const { writable, report } = useRuntime();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<readonly Option[] | undefined>();
  const [strategies, setStrategies] = useState<readonly Option[]>([]);
  const [definition, setDefinition] = useState<EntryDefinitionRecord | undefined>();
  const [answers, setAnswers] = useState<Answers>({});
  // Plan confirmation Economic Time is trader-entered, defaulting to now (decision 20). While the
  // trader leaves it alone, Confirm Plan submits that instant itself: a wall time that occurs twice
  // at a fall-back would otherwise make the default unusable.
  const [defaultInstant] = useState(() => minuteOf(now()));
  const [timeEdited, setTimeEdited] = useState(false);
  const [fields, setFields] = useState<Fields>(() => ({
    accountId: '',
    strategyId: '',
    symbol: '',
    expiration: '',
    strike: '',
    quantity: '',
    entry: '',
    stop: '',
    target: '',
    planTime: toWorkspaceLocal(defaultInstant, timeZone),
  }));
  const set = (name: keyof Fields) => (value: string) => setFields((f) => ({ ...f, [name]: value }));
  // A long option's Exercise Intent: unchecked is a recorded NotAuthorized, never absent.
  const [exercise, setExercise] = useState(false);
  const [issues, setIssues] = useState<readonly FieldIssue[]>([]);
  // The values the issues were reported against, to tell which the trader has since corrected.
  const [reported, setReported] = useState<{ readonly fields: Fields; readonly answers: Answers } | undefined>();
  // The values as first shown; the form is unsaved while anything differs from them.
  const [initial, setInitial] = useState<Fields | undefined>();
  const dirty = initial !== undefined && (JSON.stringify(fields) !== JSON.stringify(initial) || exercise || Object.keys(answers).length > 0);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  // Leaving the form abandons it, so it no longer holds an update back.
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
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
        .map((s) => ({ id: s.id, label: s.label, recordRevision: s.recordRevision, name: s.label, productKey: s.productKey, shape: s.shape }));
      // Preselect Long Stock by product key, never the first row (decision 88).
      const preselected = strategyOptions.find((s) => s.productKey === 'strategy.long-stock') ?? strategyOptions[0];
      setAccounts(accountOptions);
      setStrategies(strategyOptions);
      setFields((f) => {
        const loaded = { ...f, accountId: accountOptions[0]?.id ?? '', strategyId: preselected?.id ?? '' };
        setInitial(loaded);
        return loaded;
      });
    });
  }, [facade]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!definition) return;
    const economicTime = timeEdited ? fromWorkspaceLocal(fields.planTime, timeZone) : ({ ok: true, instant: defaultInstant } as const);
    // A time that does not resolve to one instant is explained and nothing is written.
    if (!economicTime.ok) {
      setIssues([{ field: 'planTime', message: PLAN_TIME_MESSAGES[economicTime.reason], code: economicTime.reason }]);
      setReported({ fields, answers });
      return;
    }
    const account = accounts?.find((a) => a.id === fields.accountId);
    const strategy = strategies.find((s) => s.id === fields.strategyId);
    const symbol = fields.symbol.trim().toUpperCase();
    const submitted = optionRoleOf(strategy?.shape);
    // Only the selected Strategy's fields are submitted: an option Plan's leg is signed by its role's
    // side (A100), and a long option's checkbox is an explicit Authorized or NotAuthorized.
    const leg =
      submitted
        ? {
            side: submitted.side,
            instrument: {
              kind: 'Option' as const,
              symbol,
              root: symbol.replace(/\./g, ''),
              expiration: fields.expiration.trim(),
              right: submitted.right,
              strike: fields.strike.trim(),
              multiplier: 100 as const,
            },
            quantity: `${submitted.side === 'Short' ? '-' : ''}${fields.quantity.trim()}`,
            intendedEntry: fields.entry.trim(),
          }
        : { side: 'Long' as const, instrument: { kind: 'Stock' as const, symbol }, quantity: fields.quantity.trim(), intendedEntry: fields.entry.trim() };
    const result = await facade.TradeWorkflows.confirmPlan({
      accountId: fields.accountId,
      accountRevision: account?.recordRevision ?? 0,
      strategyId: fields.strategyId,
      strategyRevision: strategy?.recordRevision ?? 0,
      economicTime: economicTime.instant,
      plan: {
        underlying: symbol,
        legs: [leg],
        stops: [{ kind: 'UnderlyingPrice', price: fields.stop.trim() }],
        targets: [{ kind: 'UnderlyingPrice', price: fields.target.trim() }],
        ...(strategy?.shape && exerciseIntentApplies(strategy.shape) && { exerciseIntent: exercise ? 'Authorized' : 'NotAuthorized' }),
      },
      reflection: { definitionId: definition.id, answers },
    });
    // A refusal switches the whole shell to Recovery Only; the form keeps its values.
    report(result);
    if (result.kind === 'Rejected') {
      setIssues(
        describeIssues(
          result.issues,
          definition,
          (['entry', 'stop', 'target'] as const).filter((name) => !positiveDecimal(fields[name])),
          submitted && { bullish: isBullish(submitted) },
        ),
      );
      setReported({ fields, answers });
    }
    if (result.kind === 'Confirmed') {
      const confirmed = confirmedDetail(result, definition, {
        strategy: strategy?.name ?? '',
        account: account?.name ?? '',
        institution: account?.institution ?? '',
      });
      // The Planned payoff travels inside the confirmed Detail (decision 92), so Trade Detail shows it without a read.
      // Handed over in memory, not in history state, which the browser structured-clones (T7.31-F1).
      handOffConfirmed(confirmed);
      void navigate(`/trades/${result.receipt.tradeId}`);
    }
  };

  if (!accounts || !definition) return <p role="status">Loading the Plan form…</p>;

  // What the chosen Strategy's shape says: an option form for a single Call or Put role. The direction
  // of the triggers and whether the entry is a credit come from the role, never from the Strategy's name.
  const shape = strategies.find((s) => s.id === fields.strategyId)?.shape;
  const option = optionRoleOf(shape);
  const bullish = option ? isBullish(option) : true;

  // Only what the form can judge from the values themselves clears on edit; the server's other
  // issues (the chosen Account, the Plan time) stay until the next submit. An option's trigger
  // issues are judged against the breakeven and the contract's value at expiration, which only the
  // domain computes, so they stay too.
  const corrected = (issue: FieldIssue) => {
    if (!reported) return false;
    if (option && OPTION_TRIGGER_CODES.has(issue.code ?? '')) return false;
    const changed = (name: keyof Fields) => fields[name] !== reported.fields[name];
    const quantity = positiveDecimal(fields.quantity);
    const entry = positiveDecimal(fields.entry);
    const stop = positiveDecimal(fields.stop);
    const target = positiveDecimal(fields.target);
    switch (issue.field) {
      case 'symbol':
        return changed('symbol') && isValidSymbol(fields.symbol);
      case 'quantity':
        // Fractional shares are allowed, fractional contracts are not.
        return changed('quantity') && !!quantity && (!option || quantity.denominator === 1n);
      case 'entry':
        return changed('entry') && !!entry;
      case 'stop':
        return (changed('stop') || changed('entry')) && !!stop && (issue.code !== 'NoPositiveRisk' || (!!entry && stop.compare(entry) < 0));
      case 'planTime':
        return LOCAL_TIME_CODES.has(issue.code ?? '') && changed('planTime') && fromWorkspaceLocal(fields.planTime, timeZone).ok;
      case 'target':
        return (changed('target') || changed('entry')) && !!target && (issue.code !== 'TargetNotBeyondEntry' || (!!entry && target.compare(entry) > 0));
      default:
        return definition.prompts.some((p) => p.id === issue.field) && answerChanged(reported.answers, answers, issue.field);
    }
  };
  const { fieldError, describedBy, promptErrors } = fieldIssues(issues.filter((issue) => !corrected(issue)));
  const input = (name: keyof Fields, label: string, inputMode?: 'decimal', hint?: string) => (
    <div className="field">
      <label>
        {label}
        <input value={fields[name]} inputMode={inputMode} onChange={(e) => set(name)(e.target.value)} {...describedBy(name)} />
      </label>
      {hint && <p className="hint">{hint}</p>}
      {fieldError(name)}
    </div>
  );

  const underlying = fields.symbol.trim().toUpperCase() || 'Underlying';
  const contracts = positiveDecimal(fields.quantity);
  const premium = positiveDecimal(fields.entry);
  const cashHint =
    option && contracts && premium && contracts.denominator === 1n
      ? `= ${money(contracts.mul(premium).mul(Rational.of(100n)))}${option.side === 'Short' ? ' credit' : ''} for ${plural(Number(contracts.numerator), 'contract', 'contracts')}`
      : undefined;

  return (
    <form className="plan-form" noValidate onSubmit={(event) => void submit(event)}>
      <PageTitle>New Plan</PageTitle>
      {/* A rejected confirmation moves focus to the summary of every issue. */}
      <IssueSummary id="plan-issues-heading" heading="This Plan can’t be confirmed yet" issues={issues} corrected={corrected} />
      <section className="card" aria-labelledby="plan-trade-heading">
        <h2 id="plan-trade-heading">Trade</h2>
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
        {!option && input('symbol', 'Symbol')}
        <div className="field">
          <label>
            Plan time
            <input
              type="datetime-local"
              value={fields.planTime}
              onChange={(e) => {
                setTimeEdited(true);
                set('planTime')(e.target.value);
              }}
              {...describedBy('planTime')}
            />
          </label>
          {fieldError('planTime')}
        </div>
      </section>
      {option && (
        <section className="card" aria-labelledby="plan-contract-heading">
          <h2 id="plan-contract-heading">Contract</h2>
          {input('symbol', 'Underlying')}
          {input('expiration', 'Expiration date')}
          <label>
            Type
            <input readOnly value={option.right} />
          </label>
          {input('strike', 'Strike', 'decimal')}
        </section>
      )}
      <section className="card" aria-labelledby="plan-risk-heading">
        <h2 id="plan-risk-heading">Risk</h2>
        <div className="risk-grid">
          {input('quantity', option ? 'Contracts' : 'Quantity', 'decimal')}
          {input('entry', option ? 'Intended entry price (per share)' : 'Intended entry', 'decimal', cashHint)}
          {input('stop', option ? `Stop (${underlying} at or ${bullish ? 'below' : 'above'})` : 'Stop', 'decimal')}
          {input('target', option ? `Target (${underlying} at or ${bullish ? 'above' : 'below'})` : 'Target', 'decimal')}
        </div>
        {option && <p className="hint">Risk and reward are measured by the option&apos;s value at expiration at these prices</p>}
        {option && option.side === 'Short' && <p className="hint">The app doesn&apos;t check that you have the cash to buy the shares if you&apos;re assigned.</p>}
        {shape && exerciseIntentApplies(shape) && (
          <label>
            <input type="checkbox" checked={exercise} onChange={(e) => setExercise(e.target.checked)} />I plan to exercise this option if it is in the money
          </label>
        )}
      </section>
      <section className="card" aria-labelledby="plan-reflection-heading">
        <h2 id="plan-reflection-heading">Plan Reflection</h2>
        <ReflectionPrompts definition={definition} answers={answers} onChange={setAnswers} errors={promptErrors(definition)} />
      </section>
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
