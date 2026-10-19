import { useCallback, useEffect, useState } from "react";
import type { EntryDefinitionPrompt, EntryTypeDefinition } from "../journal/definitions";
import type { BreachDirection, ConditionRole, PlannedLeg, TradePlanInput } from "../plan";
import type {
  ConfirmPlanSuccess,
  PlanPreview,
  PlanPreviewResult,
  PreviewPlanCommand,
  WorkflowIssue,
} from "../trade-workflows";
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
  comment: string;
}

interface AnswerState {
  readonly [promptStableKey: string]: string;
}

/** Exactly one Stop and one Target: the product decides that a Long Stock plan has no third (E-012). */
const DEFAULT_CONDITIONS: readonly ConditionDraft[] = [
  { key: "cond-1", role: "Stop", direction: "AtOrBelow", boundaryPrice: "", comment: "" },
  { key: "cond-2", role: "Target", direction: "AtOrAbove", boundaryPrice: "", comment: "" },
];

/**
 * The Journal obligation identity of one confirmation. A Workspace may confirm more than one Plan, so
 * each plan session mints its own key; it stays stable across a retry of the same form, which is what
 * keeps a double submit from becoming two Trades, because the Journal participant rejects an
 * obligation key that already has a current outcome.
 */
function newObligationKey(): string {
  return `plan-confirmation:${crypto.randomUUID()}`;
}

function moneyText(value: { readonly amount: string; readonly currency: string }): string {
  return `${value.amount} ${value.currency}`;
}

/**
 * The inline slot one typed issue belongs to, when it has a rendered control. Unmapped issues are
 * listed once in the form's alert rather than hidden: the preview is the only rule set.
 */
function issueKey(
  issue: WorkflowIssue,
  conditions: readonly ConditionDraft[],
): string | undefined {
  if (issue.promptStableKey !== undefined) return issue.promptStableKey;
  if (issue.field === "accountId") return "accountId";
  if (issue.field === "strategyStableKey") return "strategyStableKey";
  if (issue.field === "plan.intendedEntry") return "intendedEntry";
  if (issue.field.startsWith("plan.plannedLegs")) {
    return issue.field.endsWith(".quantity") ? "quantity" : "instrumentKey";
  }
  if (issue.field.startsWith("plan.originalManagement")) {
    const index = /\[(\d+)\]/.exec(issue.field)?.[1];
    const condition =
      index === undefined
        ? conditions.find((candidate) => candidate.key === issue.conditionId)
        : conditions[Number(index)];
    return condition === undefined ? undefined : `${condition.key}.boundaryPrice`;
  }
  return undefined;
}

/**
 * The Plan confirmation form. It renders the exact Plan Reflection definition revision it loaded and
 * submits stable Prompt and Option identities. Entered values are held in component state only: a
 * resize, a navigation within the workflow, or an abandoned form writes nothing.
 *
 * Before Save it shows the provisional reward-to-risk ratio and maximum loss the confirmation will
 * freeze, from `previewPlan` (deviation D-001), and it collects only what the product cannot decide:
 * one Stop and one Target with a boundary price each (E-012, E-013). Trade Analysis derives the
 * monetary boundary; the form never computes it.
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
  const [obligationKey, setObligationKey] = useState(newObligationKey);
  const [submitted, setSubmitted] = useState(false);
  const [preview, setPreview] = useState<PlanPreview | undefined>(undefined);
  const [previewIssues, setPreviewIssues] = useState<readonly WorkflowIssue[] | undefined>(undefined);
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

  function currentPlan(): TradePlanInput {
    const plannedLeg: PlannedLeg = {
      legId: "leg-1",
      instrument: { instrumentKey, instrumentClass: "stock" },
      side: "long",
      quantity: { amount: quantity, instrumentClass: "stock" },
      contract: { kind: "ExactContract" },
    };
    return {
      intendedEntry: { amount: intendedEntry },
      plannedLegs: [plannedLeg],
      originalManagement: conditions.map((condition) => ({
        conditionId: condition.key,
        kind: "UnderlyingPrice" as const,
        role: condition.role,
        boundaryPrice: { amount: condition.boundaryPrice },
        basis: {
          protects: ["leg-1"],
          direction: condition.direction,
          measurementPolicy: "NearestNonnegativeMonetaryBoundary" as const,
          ...(condition.comment.trim() === "" ? {} : { comment: condition.comment }),
        },
      })),
    };
  }

  /**
   * The identities the preview needs before it can say anything: the Account and Strategy it
   * resolves, and the Instrument whose leg it measures. Until all three are present no preview is
   * attempted, so an untouched form is not reported as invalid.
   */
  function identityErrors(): Readonly<Record<string, string>> {
    const found: Record<string, string> = {};
    if (accountId === "") found.accountId = "Choose the Account you trade.";
    if (strategyStableKey === "") found.strategyStableKey = "Choose the Strategy.";
    if (instrumentKey.trim() === "") found.instrumentKey = "Enter the Instrument.";
    return found;
  }

  function previewCommand(definition: EntryTypeDefinition): PreviewPlanCommand {
    return {
      accountId,
      strategyStableKey,
      tags: [],
      plan: currentPlan(),
      reflection: {
        entryTypeStableKey: definition.entryTypeStableKey,
        definitionRevision: definition.revision,
        answers: Object.entries(answers).map(([promptStableKey, value]) => ({
          promptStableKey,
          value,
        })),
      },
      economicTime: new Date().toISOString(),
      obligationKey,
    };
  }

  const identitiesReady =
    accountId !== "" && strategyStableKey !== "" && instrumentKey.trim() !== "";

  // The provisional figures are re-derived from the same step confirmation runs, on every edit.
  useEffect(() => {
    if (state.kind !== "ready" || !identitiesReady) {
      setPreview(undefined);
      setPreviewIssues(undefined);
      return;
    }
    let cancelled = false;
    void (async () => {
      const result: PlanPreviewResult = await runtime.previewPlan(previewCommand(state.definition));
      if (cancelled) return;
      if (result.outcome === "Previewed") {
        setPreview(result.value);
        setPreviewIssues(undefined);
        return;
      }
      setPreview(undefined);
      setPreviewIssues(result.outcome === "RuntimeNotWritable" ? [] : result.issues);
    })();
    return () => {
      cancelled = true;
    };
  }, [runtime, state, identitiesReady, accountId, strategyStableKey, intendedEntry, instrumentKey, quantity, conditions, answers, obligationKey]);

  const identityProblems = submitted ? identityErrors() : {};
  const inlineIssues: Record<string, string> = {};
  const unmapped: string[] = [];
  if (submitted && previewIssues !== undefined) {
    for (const issue of previewIssues) {
      const key = issueKey(issue, conditions);
      if (key === undefined) unmapped.push(issue.detail);
      else inlineIssues[key] ??= issue.detail;
    }
  }
  const errors: Readonly<Record<string, string>> = { ...identityProblems, ...inlineIssues };

  async function save(): Promise<void> {
    if (state.kind !== "ready") return;
    setSubmitted(true);
    setServerIssues([]);
    const identity = identityErrors();
    const firstIdentity = Object.keys(identity)[0];
    if (firstIdentity !== undefined) {
      document.getElementById(`field-${firstIdentity}`)?.focus();
      return;
    }

    setBusy(true);
    try {
      const command = previewCommand(state.definition);
      const previewed = await runtime.previewPlan(command);
      if (previewed.outcome !== "Previewed") {
        setPreview(undefined);
        setPreviewIssues(previewed.outcome === "RuntimeNotWritable" ? [] : previewed.issues);
        if (previewed.outcome === "RuntimeNotWritable") {
          setServerIssues([`This browser cannot write right now (${previewed.runtimeReadiness}).`]);
        }
        return;
      }
      setPreview(previewed.value);
      setPreviewIssues(undefined);

      const result = await runtime.confirmPlan({
        ...command,
        saveTime: new Date().toISOString(),
        firstAuthoredTime: new Date().toISOString(),
      });

      if (result.outcome === "Accepted") {
        // The saved screen renders from the returned post-commit state; navigation is the trader's
        // next explicit gesture, not something Save performs on their behalf.
        setSaved(result.value);
        return;
      }
      if (result.outcome === "Rejected") {
        setPreviewIssues(result.issues);
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
    const frozen = saved.postCommit.derivation;
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
          <dt>Reward-to-risk (frozen)</dt>
          <dd data-testid="saved-rr">{frozen.planBaseline.plannedRewardRiskRatio}</dd>
          <dt>Maximum loss (frozen)</dt>
          <dd data-testid="saved-max-loss">{moneyText(frozen.oneR)}</dd>
          <dt>1R (frozen at confirmation)</dt>
          <dd data-testid="saved-one-r">{frozen.oneR.amount}</dd>
          <dt>Lifecycle</dt>
          <dd>{trade?.lifecycle}</dd>
          <dt>Why this trade</dt>
          <dd data-testid="saved-thesis">{entry?.thesis}</dd>
          <dt>What would invalidate it</dt>
          <dd data-testid="saved-invalidation">{entry?.invalidation}</dd>
        </dl>
        <p className="muted">
          These are the frozen figures. They are the provisional ones you saw before Save: freezing
          did not change them.
        </p>

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
        <button
          type="button"
          onClick={() => {
            // A new plan session is a new Journal obligation, never a second outcome for the old one.
            setObligationKey(newObligationKey());
            setPreview(undefined);
            setPreviewIssues(undefined);
            setSubmitted(false);
            setSaved(undefined);
          }}
        >
          Start another plan
        </button>
      </section>
    );
  }

  const alertIssues = [...serverIssues, ...unmapped];

  return (
    <section className="card plan-form" aria-labelledby="plan-title">
      <h2 id="plan-title">Confirm a plan</h2>
      {alertIssues.length > 0 && (
        <div role="alert" className="error">
          <p>The Plan was not saved. Your entries are still here.</p>
          <ul>
            {alertIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="plan-form__grid">
        <div className="field">
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
        <div className="field">
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
        <div className="field">
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
        <div className="field">
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
        <div className="field">
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
        {conditions.map((condition, index) => {
          const derived = preview?.perConditionBasis.find(
            (basis) => basis.conditionId === condition.key,
          )?.monetaryBoundary;
          return (
            <div key={condition.key} className="condition">
              <p className="muted">
                Condition {index + 1}: {condition.role}
              </p>
              <label htmlFor={`field-${condition.key}.boundaryPrice`}>Boundary price</label>
              <input
                id={`field-${condition.key}.boundaryPrice`}
                value={condition.boundaryPrice}
                onChange={(event) =>
                  setConditions((current) =>
                    current.map((candidate) =>
                      candidate.key === condition.key
                        ? { ...candidate, boundaryPrice: event.target.value }
                        : candidate,
                    ),
                  )
                }
                inputMode="decimal"
              />
              {errors[`${condition.key}.boundaryPrice`] !== undefined && (
                <p role="alert" className="error">
                  {errors[`${condition.key}.boundaryPrice`]}
                </p>
              )}
              <p className="muted" data-testid={`derived-boundary-${condition.key}`}>
                Monetary boundary (derived): {derived === undefined ? "not yet available" : moneyText(derived)}
              </p>
              <label htmlFor={`field-${condition.key}.comment`}>
                Why this {condition.role.toLowerCase()} (optional)
              </label>
              <input
                id={`field-${condition.key}.comment`}
                value={condition.comment}
                onChange={(event) =>
                  setConditions((current) =>
                    current.map((candidate) =>
                      candidate.key === condition.key
                        ? { ...candidate, comment: event.target.value }
                        : candidate,
                    ),
                  )
                }
              />
            </div>
          );
        })}
      </fieldset>

      {preview !== undefined || previewIssues !== undefined ? (
        <section className="plan-form__preview" aria-labelledby="plan-preview-title">
          <h3 id="plan-preview-title">Before you save (provisional)</h3>
          {preview === undefined ? (
            <p className="muted">
              Reward-to-risk and maximum loss appear here once the Plan can be assessed.
            </p>
          ) : (
            <dl className="facts">
              <dt>Reward-to-risk (provisional)</dt>
              <dd data-testid="preview-rr">{preview.planBaseline.plannedRewardRiskRatio}</dd>
              <dt>Maximum loss (provisional)</dt>
              <dd data-testid="preview-max-loss">{moneyText(preview.oneR)}</dd>
            </dl>
          )}
        </section>
      ) : null}

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

      <div className="plan-form__actions">
        <button type="button" className="primary" disabled={busy} onClick={() => void save()}>
          Save the plan
        </button>
        <button type="button" disabled={busy} onClick={() => onSaved("")}>
          Cancel
        </button>
      </div>
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
        <div className="plan-form__radio-group">
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
        </div>
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
      <div className="field">
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
    <div className="field">
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
