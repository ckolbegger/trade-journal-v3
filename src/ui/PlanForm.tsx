import { useCallback, useEffect, useState } from "react";
import type { EntryDefinitionPrompt, EntryTypeDefinition } from "../journal/definitions";
import type { BreachDirection, ConditionRole, PlanCondition, PlannedLeg } from "../plan";
import type { ConfirmPlanSuccess } from "../trade-workflows";
import type { ApplicationRuntime } from "../workspace/runtime";

type LoadState =
  | { readonly kind: "loading" }
  | { readonly kind: "error"; readonly detail: string }
  | {
      readonly kind: "ready";
      readonly definition: EntryTypeDefinition;
      readonly accounts: readonly { readonly id: string; readonly label: string }[];
      readonly strategies: readonly { readonly stableKey: string; readonly label: string }[];
    };

interface ConditionDraft {
  readonly key: string;
  role: ConditionRole;
  direction: BreachDirection;
  boundaryPrice: string;
  monetaryBoundary: string;
  comment: string;
}

interface AnswerState {
  readonly [promptStableKey: string]: string;
}

const DEFAULT_CONDITIONS: readonly ConditionDraft[] = [
  { key: "cond-1", role: "Stop", direction: "AtOrBelow", boundaryPrice: "", monetaryBoundary: "", comment: "" },
  { key: "cond-2", role: "Target", direction: "AtOrAbove", boundaryPrice: "", monetaryBoundary: "", comment: "" },
];

/**
 * The Plan confirmation form. It renders the exact Plan Reflection definition revision it loaded and
 * submits stable Prompt and Option identities. Entered values are held in component state only: a
 * resize, a navigation within the workflow, or an abandoned form writes nothing.
 */
export function PlanForm({
  runtime,
  onSaved,
}: {
  runtime: ApplicationRuntime;
  onSaved: (tradeId: string) => void;
}) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [accountId, setAccountId] = useState("");
  const [strategyStableKey, setStrategyStableKey] = useState("");
  const [intendedEntry, setIntendedEntry] = useState("");
  const [instrumentKey, setInstrumentKey] = useState("");
  const [quantity, setQuantity] = useState("");
  const [conditions, setConditions] = useState<readonly ConditionDraft[]>(DEFAULT_CONDITIONS);
  const [answers, setAnswers] = useState<AnswerState>({});
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [serverIssues, setServerIssues] = useState<readonly string[]>([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<ConfirmPlanSuccess | undefined>(undefined);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const [definitionSet, accounts, strategies] = await Promise.all([
        runtime.planDefinition(),
        runtime.streamAccounts(),
        runtime.streamStrategies(),
      ]);
      if (definitionSet.outcome !== "Definitions") {
        setState({ kind: "error", detail: "the Plan Reflection definition is not installed" });
        return;
      }
      const definition = definitionSet.entryTypes[0];
      if (definition === undefined) {
        setState({ kind: "error", detail: "the Plan Reflection definition is not installed" });
        return;
      }
      if (accounts.outcome !== "Page") {
        setState({ kind: "error", detail: "the Accounts could not be read" });
        return;
      }
      setState({
        kind: "ready",
        definition,
        accounts: accounts.records.map((record) => ({ id: record.id, label: record.label })),
        strategies,
      });
    } catch (error) {
      setState({ kind: "error", detail: error instanceof Error ? error.message : String(error) });
    }
  }, [runtime]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateCondition(key: string, patch: Partial<ConditionDraft>): void {
    setConditions((current) =>
      current.map((condition) => (condition.key === key ? { ...condition, ...patch } : condition)),
    );
  }

  function validate(definition: EntryTypeDefinition): Readonly<Record<string, string>> {
    const found: Record<string, string> = {};
    if (accountId === "") found.accountId = "Choose the Account you trade.";
    if (strategyStableKey === "") found.strategyStableKey = "Choose the Strategy.";
    if (intendedEntry.trim() === "") found.intendedEntry = "Enter the intended entry price.";
    if (instrumentKey.trim() === "") found.instrumentKey = "Enter the Instrument.";
    if (quantity.trim() === "") found.quantity = "Enter the Planned Leg quantity.";
    for (const condition of conditions) {
      if (condition.boundaryPrice.trim() === "") {
        found[`${condition.key}.boundaryPrice`] = `Enter the ${condition.role} boundary price.`;
      }
      if (condition.monetaryBoundary.trim() === "") {
        found[`${condition.key}.monetaryBoundary`] = `Enter the ${condition.role} monetary boundary.`;
      }
    }
    for (const prompt of definition.prompts) {
      if (prompt.required && (answers[prompt.stableKey] ?? "").trim() === "") {
        found[prompt.stableKey] = `Answer "${prompt.label}" before saving.`;
      }
    }
    return found;
  }

  async function save(): Promise<void> {
    if (state.kind !== "ready") return;
    const found = validate(state.definition);
    setErrors(found);
    setServerIssues([]);
    if (Object.keys(found).length > 0) {
      const first = Object.keys(found)[0];
      if (first !== undefined) document.getElementById(`field-${first}`)?.focus();
      return;
    }

    setBusy(true);
    try {
      const plannedLeg: PlannedLeg = {
        legId: "leg-1",
        instrument: { instrumentKey, instrumentClass: "stock" },
        side: "long",
        quantity: { amount: quantity, instrumentClass: "stock" },
        contract: { kind: "ExactContract" },
      };
      const management: PlanCondition[] = conditions.map((condition, index) => ({
        conditionId: `cond-${index + 1}`,
        kind: "UnderlyingPrice",
        role: condition.role,
        boundaryPrice: { amount: condition.boundaryPrice },
        monetaryBoundary: { amount: condition.monetaryBoundary, currency: "USD" },
        basis: {
          protects: ["leg-1"],
          direction: condition.direction,
          measurementPolicy: "NearestNonnegativeMonetaryBoundary",
          ...(condition.comment.trim() === "" ? {} : { comment: condition.comment }),
        },
      }));

      const result = await runtime.confirmPlan({
        accountId,
        strategyStableKey,
        tags: [],
        plan: { intendedEntry: { amount: intendedEntry }, plannedLegs: [plannedLeg], originalManagement: management },
        reflection: {
          entryTypeStableKey: state.definition.entryTypeStableKey,
          definitionRevision: state.definition.revision,
          answers: Object.entries(answers).map(([promptStableKey, value]) => ({ promptStableKey, value })),
        },
        economicTime: new Date().toISOString(),
        saveTime: new Date().toISOString(),
        firstAuthoredTime: new Date().toISOString(),
        obligationKey: "plan-confirmation:1",
      });

      if (result.outcome === "Accepted") {
        // The saved screen renders from the returned post-commit state; navigation is the trader's
        // next explicit gesture, not something Save performs on their behalf.
        setSaved(result.value);
        return;
      }
      if (result.outcome === "Rejected") {
        setServerIssues(result.issues.map((issue) => issue.detail));
      } else if (result.outcome === "Conflict") {
        setServerIssues(result.issues.map((issue) => issue.detail));
      } else {
        setServerIssues([`This browser cannot write right now (${result.runtimeReadiness}).`]);
      }
    } finally {
      setBusy(false);
    }
  }

  if (state.kind === "loading") {
    return (
      <section className="card" aria-labelledby="plan-loading" aria-busy="true">
        <h2 id="plan-loading">Loading the plan form</h2>
        <p role="status">Reading the Plan Reflection definition and the Accounts you can select.</p>
      </section>
    );
  }

  if (state.kind === "error") {
    return (
      <section className="card" role="alert" aria-labelledby="plan-error">
        <h2 id="plan-error">The plan form could not be loaded</h2>
        <p>{state.detail}</p>
        <button type="button" onClick={() => void load()}>
          Retry
        </button>
      </section>
    );
  }

  if (saved !== undefined) {
    const trade = saved.postCommit.trades[0];
    const entry = saved.postCommit.journal[0];
    const strategyLabel =
      state.strategies.find((strategy) => strategy.stableKey === trade?.strategyStableKey)?.label ??
      trade?.strategyStableKey ??
      "";
    return (
      <section className="card" aria-labelledby="plan-saved">
        <h2 id="plan-saved">Plan confirmed</h2>
        <p role="status">
          One Trade, one frozen Plan, its original management and one completed Plan Reflection were
          saved together.
        </p>
        <dl className="facts">
          <dt>Strategy</dt>
          <dd data-testid="saved-strategy">{strategyLabel}</dd>
          <dt>Instrument</dt>
          <dd data-testid="saved-instrument">
            {trade?.plan.plannedLegs.map((leg) => leg.instrument.instrumentKey).join(", ")}
          </dd>
          <dt>Intended entry</dt>
          <dd data-testid="saved-entry">{trade?.plan.intendedEntry.amount}</dd>
          <dt>Planned Leg quantity</dt>
          <dd data-testid="saved-quantity">
            {trade?.plan.plannedLegs.map((leg) => `${leg.side} ${leg.quantity.amount}`).join(", ")}
          </dd>
          <dt>1R (frozen at confirmation)</dt>
          <dd data-testid="saved-one-r">{saved.postCommit.derivation.oneR.amount}</dd>
          <dt>Lifecycle</dt>
          <dd>{trade?.lifecycle}</dd>
          <dt>Why this trade</dt>
          <dd data-testid="saved-thesis">{entry?.thesis}</dd>
          <dt>What would invalidate it</dt>
          <dd data-testid="saved-invalidation">{entry?.invalidation}</dd>
        </dl>

        <h3>Original management</h3>
        <ul aria-label="Saved original Stops and Targets">
          {(trade?.plan.originalManagement ?? []).map((condition) => (
            <li key={condition.conditionId} data-testid={`saved-condition-${condition.conditionId}`}>
              {condition.kind === "UnderlyingPrice" ? (
                <>
                  <strong>{condition.role}</strong> {condition.basis.direction}{" "}
                  {condition.boundaryPrice.amount} (frozen monetary boundary{" "}
                  {condition.monetaryBoundary.amount} {condition.monetaryBoundary.currency})
                  {condition.basis.comment !== undefined && (
                    <span className="muted"> — {condition.basis.comment}</span>
                  )}
                </>
              ) : (
                <span>{condition.role}: structure value</span>
              )}
            </li>
          ))}
        </ul>

        <button type="button" onClick={() => onSaved(trade?.tradeId ?? "")}>
          Open the Trade
        </button>
        <button type="button" onClick={() => setSaved(undefined)}>
          Start another plan
        </button>
      </section>
    );
  }

  return (
    <section className="card" aria-labelledby="plan-title">
      <h2 id="plan-title">Confirm a plan</h2>
      {serverIssues.length > 0 && (
        <div role="alert" className="error">
          <p>The Plan was not saved. Your entries are still here.</p>
          <ul>
            {serverIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="plan-form__grid">
        <div>
  <label htmlFor="field-accountId">Account</label>
        <select
          id="field-accountId"
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
          aria-describedby={errors.accountId === undefined ? undefined : "error-accountId"}
        >
          <option value="">Choose an Account</option>
          {state.accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.label}
            </option>
          ))}
        </select>
        {errors.accountId !== undefined && (
          <p id="error-accountId" role="alert" className="error">
            {errors.accountId}
          </p>
        )}
  
        
        </div>
        <div>
  <label htmlFor="field-strategyStableKey">Strategy</label>
        <select
          id="field-strategyStableKey"
          value={strategyStableKey}
          onChange={(event) => setStrategyStableKey(event.target.value)}
          aria-describedby={errors.strategyStableKey === undefined ? undefined : "error-strategyStableKey"}
        >
          <option value="">Choose a Strategy</option>
          {state.strategies.map((strategy) => (
            <option key={strategy.stableKey} value={strategy.stableKey}>
              {strategy.label}
            </option>
          ))}
        </select>
        {errors.strategyStableKey !== undefined && (
          <p id="error-strategyStableKey" role="alert" className="error">
            {errors.strategyStableKey}
          </p>
        )}
  
        
        </div>
        <div>
  <label htmlFor="field-intendedEntry">Intended entry</label>
        <input
          id="field-intendedEntry"
          value={intendedEntry}
          onChange={(event) => setIntendedEntry(event.target.value)}
          inputMode="decimal"
          aria-describedby={errors.intendedEntry === undefined ? undefined : "error-intendedEntry"}
        />
        {errors.intendedEntry !== undefined && (
          <p id="error-intendedEntry" role="alert" className="error">
            {errors.intendedEntry}
          </p>
        )}
  
        
        </div>
        <div>
  <label htmlFor="field-instrumentKey">Instrument</label>
        <input
          id="field-instrumentKey"
          value={instrumentKey}
          onChange={(event) => setInstrumentKey(event.target.value)}
          aria-describedby={errors.instrumentKey === undefined ? undefined : "error-instrumentKey"}
        />
        {errors.instrumentKey !== undefined && (
          <p id="error-instrumentKey" role="alert" className="error">
            {errors.instrumentKey}
          </p>
        )}
  
        
        </div>
        <div>
  <label htmlFor="field-quantity">Planned Leg quantity</label>
        <input
          id="field-quantity"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          inputMode="decimal"
          aria-describedby={errors.quantity === undefined ? undefined : "error-quantity"}
        />
        {errors.quantity !== undefined && (
          <p id="error-quantity" role="alert" className="error">
            {errors.quantity}
          </p>
        )}
        </div>
      </div>

      <fieldset>
        <legend>Stops and Targets</legend>
        {conditions.map((condition, index) => (
          <div key={condition.key} className="stack">
            <p className="muted">
              Condition {index + 1}: {condition.role}
            </p>
            <label htmlFor={`field-${condition.key}.boundaryPrice`}>Boundary price</label>
            <input
              id={`field-${condition.key}.boundaryPrice`}
              value={condition.boundaryPrice}
              onChange={(event) => updateCondition(condition.key, { boundaryPrice: event.target.value })}
              inputMode="decimal"
            />
            {errors[`${condition.key}.boundaryPrice`] !== undefined && (
              <p role="alert" className="error">
                {errors[`${condition.key}.boundaryPrice`]}
              </p>
            )}
            <label htmlFor={`field-${condition.key}.monetaryBoundary`}>Monetary boundary (USD)</label>
            <input
              id={`field-${condition.key}.monetaryBoundary`}
              value={condition.monetaryBoundary}
              onChange={(event) =>
                updateCondition(condition.key, { monetaryBoundary: event.target.value })
              }
              inputMode="decimal"
            />
            {errors[`${condition.key}.monetaryBoundary`] !== undefined && (
              <p role="alert" className="error">
                {errors[`${condition.key}.monetaryBoundary`]}
              </p>
            )}
            <label htmlFor={`field-${condition.key}.comment`}>
              Why this {condition.role.toLowerCase()} (optional)
            </label>
            <input
              id={`field-${condition.key}.comment`}
              value={condition.comment}
              onChange={(event) => updateCondition(condition.key, { comment: event.target.value })}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setConditions((current) => [
              ...current,
              {
                key: `cond-${current.length + 1}`,
                role: "Stop",
                direction: "AtOrBelow",
                boundaryPrice: "",
                monetaryBoundary: "",
                comment: "",
              },
            ])
          }
        >
          Add another condition
        </button>
      </fieldset>

      <fieldset>
        <legend>Plan Reflection</legend>
        {state.definition.prompts.map((prompt) => (
          <PromptField
            key={prompt.stableKey}
            prompt={prompt}
            value={answers[prompt.stableKey] ?? ""}
            error={errors[prompt.stableKey]}
            onChange={(value) => setAnswers((current) => ({ ...current, [prompt.stableKey]: value }))}
          />
        ))}
      </fieldset>

      <button type="button" disabled={busy} onClick={() => void save()}>
        Save the plan
      </button>
      <button type="button" disabled={busy} onClick={() => onSaved("")}>
        Cancel
      </button>
    </section>
  );
}

/** One prompt, rendered by kind. A Single Select is a radio group under a labelled fieldset. */
function PromptField({
  prompt,
  value,
  error,
  onChange,
}: {
  prompt: EntryDefinitionPrompt;
  value: string;
  error: string | undefined;
  onChange: (value: string) => void;
}) {
  const id = `field-${prompt.stableKey}`;
  if (prompt.kind === "singleSelect") {
    return (
      <fieldset aria-describedby={error === undefined ? undefined : `error-${prompt.stableKey}`}>
        <legend>
          {prompt.label}
          {prompt.required ? " (required)" : " (optional)"}
        </legend>
        {(prompt.options ?? []).map((option) => (
          <label key={option.stableKey} htmlFor={`${id}-${option.stableKey}`}>
            <input
              id={`${id}-${option.stableKey}`}
              type="radio"
              name={prompt.stableKey}
              value={option.stableKey}
              checked={value === option.stableKey}
              onChange={() => onChange(option.stableKey)}
            />
            {option.label}
          </label>
        ))}
        {error !== undefined && (
          <p id={`error-${prompt.stableKey}`} role="alert" className="error">
            {error}
          </p>
        )}
      </fieldset>
    );
  }
  if (prompt.kind === "scale") {
    return (
      <div className="stack">
        <label htmlFor={id}>
          {prompt.label}
          {prompt.required ? " (required)" : " (optional)"}
        </label>
        <input
          id={id}
          type="number"
          min={prompt.scaleMin ?? 1}
          max={prompt.scaleMax ?? 5}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={error === undefined ? undefined : `error-${prompt.stableKey}`}
        />
        {error !== undefined && (
          <p id={`error-${prompt.stableKey}`} role="alert" className="error">
            {error}
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="stack">
      <label htmlFor={id}>
        {prompt.label}
        {prompt.required ? " (required)" : " (optional)"}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={error === undefined ? undefined : `error-${prompt.stableKey}`}
        aria-required={prompt.required}
      />
      {error !== undefined && (
        <p id={`error-${prompt.stableKey}`} role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}
