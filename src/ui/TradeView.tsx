import { useCallback, useEffect, useState } from "react";
import type { PlanCondition } from "../plan";
import type { ApplicationRuntime } from "../workspace/runtime";
import type { TradeReadModel } from "../workspace/tradeView";

type LoadState =
  | { readonly kind: "loading" }
  | { readonly kind: "error"; readonly detail: string }
  | { readonly kind: "empty" }
  | { readonly kind: "ready"; readonly trades: readonly TradeReadModel[] };

/**
 * The Trade view for a confirmed Plan. Stored Lifecycle State and the derived expectation are shown
 * as separate concepts, a disagreement is never presented as agreement, and uninstalled concepts are
 * absent rather than a fabricated zero or Not Applicable.
 */
export function TradeView({
  runtime,
  active,
  selectedTradeId,
  onSelect,
}: {
  runtime: ApplicationRuntime;
  /** The panel stays mounted while hidden, so it reloads whenever it becomes the visible one. */
  active: boolean;
  selectedTradeId: string | undefined;
  onSelect: (tradeId: string) => void;
}) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const trades = await runtime.streamTrades();
      setState(trades.length === 0 ? { kind: "empty" } : { kind: "ready", trades });
    } catch (error) {
      setState({ kind: "error", detail: error instanceof Error ? error.message : String(error) });
    }
  }, [runtime]);

  useEffect(() => {
    if (active) void load();
  }, [active, load]);

  if (state.kind === "loading") {
    return (
      <section className="card" aria-labelledby="trades-loading" aria-busy="true">
        <h2 id="trades-loading">Loading Trades</h2>
        <p role="status">Reading the confirmed Plans from this Workspace.</p>
      </section>
    );
  }

  if (state.kind === "error") {
    return (
      <section className="card" role="alert" aria-labelledby="trades-error">
        <h2 id="trades-error">This view could not be assembled</h2>
        <p>{state.detail}</p>
        <button type="button" onClick={() => void load()}>
          Retry
        </button>
      </section>
    );
  }

  if (state.kind === "empty") {
    return (
      <section className="card" aria-labelledby="trades-empty">
        <h2 id="trades-empty">No Trades yet</h2>
        <p>
          A Trade appears here after you confirm a Plan. Open <strong>Plan</strong> to confirm your
          first one.
        </p>
      </section>
    );
  }

  const selected =
    state.trades.find((trade) => trade.tradeId === selectedTradeId) ?? state.trades[0];

  return (
    <section className="card" aria-labelledby="trades-title">
      <h2 id="trades-title">Trades</h2>
      <ul aria-label="Confirmed Trades">
        {state.trades.map((trade) => (
          <li key={trade.tradeId}>
            <button
              type="button"
              aria-current={trade.tradeId === selected?.tradeId ? "true" : undefined}
              onClick={() => onSelect(trade.tradeId)}
            >
              {trade.accountLabel}: {trade.strategyLabel} at {trade.intendedEntry.amount}
            </button>
          </li>
        ))}
      </ul>
      {selected !== undefined && <TradeDetail trade={selected} />}
    </section>
  );
}

function TradeDetail({ trade }: { trade: TradeReadModel }) {
  return (
    <article aria-labelledby="trade-detail-title" data-testid="trade-detail">
      <h3 id="trade-detail-title">Confirmed Plan</h3>

      {trade.disagreement !== undefined && (
        <div role="alert" className="error" data-testid="lifecycle-disagreement">
          <p>
            The stored Lifecycle State ({trade.disagreement.stored}) disagrees with the state these
            facts imply ({trade.disagreement.expected}). Nothing was repaired; this is an integrity
            disclosure.
          </p>
        </div>
      )}

      <dl className="facts">
        <dt>Account</dt>
        <dd>{trade.accountLabel}</dd>
        <dt>Strategy</dt>
        <dd>{trade.strategyLabel}</dd>
        <dt>Intended entry</dt>
        <dd data-testid="trade-entry">{trade.intendedEntry.amount}</dd>
        <dt>Planned Legs</dt>
        <dd>
          {trade.plannedLegs.map((leg) => (
            <span key={leg.legId}>
              {leg.side} {leg.quantity.amount} {leg.instrument.instrumentKey}
            </span>
          ))}
        </dd>
        <dt>1R (frozen, immutable)</dt>
        <dd data-testid="trade-one-r" data-immutable="true">
          {trade.oneR.amount} {trade.oneR.currency}
        </dd>
        <dt>Stored Lifecycle State</dt>
        <dd data-testid="trade-stored-lifecycle">{trade.storedLifecycle}</dd>
        <dt>Expected Lifecycle State</dt>
        <dd data-testid="trade-expected-lifecycle">{trade.expectedLifecycle ?? "Unavailable"}</dd>
      </dl>

      <h4>Original management</h4>
      <ul aria-label="Original Stops and Targets">
        {trade.originalManagement.map((condition) => (
          <li key={condition.conditionId} data-testid={`condition-${condition.conditionId}`}>
            <ConditionLine condition={condition} />
          </li>
        ))}
      </ul>

      {trade.reflection !== undefined && (
        <>
          <h4>Plan Reflection ({trade.reflection.sourceLabel})</h4>
          <p className="muted">
            The answers below are the same Entry that supplied the Plan's Thesis and Invalidation; they
            are one record, not two.
          </p>
          <dl className="facts">
            <dt>Why this trade</dt>
            <dd data-testid="trade-thesis">{trade.reflection.thesis}</dd>
            <dt>What would invalidate it</dt>
            <dd data-testid="trade-invalidation">{trade.reflection.invalidation}</dd>
          </dl>
        </>
      )}
    </article>
  );
}

function ConditionLine({ condition }: { condition: PlanCondition }) {
  if (condition.kind !== "UnderlyingPrice") return null;
  return (
    <>
      <strong>{condition.role}</strong> {condition.basis.direction}{" "}
      <span data-testid={`boundary-${condition.conditionId}`}>{condition.boundaryPrice.amount}</span>{" "}
      (frozen monetary boundary {condition.monetaryBoundary.amount}{" "}
      {condition.monetaryBoundary.currency})
      {condition.basis.comment !== undefined && (
        <span className="muted"> — {condition.basis.comment}</span>
      )}
    </>
  );
}
