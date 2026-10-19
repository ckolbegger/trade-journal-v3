import type { CommitResult, TransactionSeam } from "./transaction";

export type LifecycleStateName = "Planned" | "Open" | "Closed" | "Abandoned";

/** One authoritative lifecycle-index entry, bound to the committed FactRevision that produced it. */
export interface LifecycleEntry {
  readonly tradeId: string;
  readonly state: LifecycleStateName;
  readonly factRevision: number;
  /** The U.S. Trading Date on which exposure was first established. */
  readonly openedOn?: string;
  /** The U.S. Trading Date on which exposure reached zero. */
  readonly closedOn?: string;
  /** The completed session at which this membership was established. */
  readonly cutoffTradingDate?: string;
}

export interface LifecycleFactEffect {
  readonly store: string;
  readonly put?: readonly Record<string, unknown>[];
}

export interface LifecycleChange {
  readonly entry: LifecycleEntry;
  /** The lifecycle-changing facts; they commit in the same transaction as the membership write. */
  readonly facts?: readonly LifecycleFactEffect[];
}

/** Membership changes in the same commit as the facts that caused it. */
export function commitLifecycleChange(
  seam: TransactionSeam,
  change: LifecycleChange,
): Promise<CommitResult> {
  return seam.commit({
    participants: [
      { store: "lifecycleIndex", put: [{ ...change.entry }] },
      ...(change.facts ?? []),
    ],
  });
}

export interface AgreementResult {
  readonly outcome: "Agrees" | "Disagreement";
  readonly tradeId: string;
  readonly storedState?: LifecycleStateName;
  readonly derivedState?: LifecycleStateName;
}

interface ExecutionLike {
  readonly kind?: unknown;
  readonly side?: unknown;
  readonly quantity?: unknown;
}

/** D1-grade derivation: no executions is Planned, nonzero net is Open, flat after executions is Closed. */
export function deriveLifecycleState(
  facts: readonly Record<string, unknown>[],
): LifecycleStateName {
  const executions = facts.filter((fact) => fact.kind === "execution") as unknown as ExecutionLike[];
  if (executions.length === 0) return "Planned";
  let net = 0;
  for (const execution of executions) {
    const quantity = Number(execution.quantity ?? 0);
    net += execution.side === "sell" ? -quantity : quantity;
  }
  return net === 0 ? "Closed" : "Open";
}

/** Surface a disagreement; never repair it. */
export function checkLifecycleAgreement(
  entry: LifecycleEntry,
  facts: readonly Record<string, unknown>[],
): AgreementResult {
  const derived = deriveLifecycleState(facts);
  if (derived === entry.state) return { outcome: "Agrees", tradeId: entry.tradeId };
  return {
    outcome: "Disagreement",
    tradeId: entry.tradeId,
    storedState: entry.state,
    derivedState: derived,
  };
}

export function openAtCutoff(entry: LifecycleEntry, cutoffTradingDate: string): boolean {
  if (entry.openedOn === undefined) return false;
  if (entry.openedOn > cutoffTradingDate) return false;
  return entry.closedOn === undefined || entry.closedOn > cutoffTradingDate;
}

/**
 * Answer a past-cutoff Open question from membership facts, so a Trade that has since closed still
 * appears for the earlier completed session. It reads and never writes.
 */
export async function queryOpenAtCutoff(
  seam: TransactionSeam,
  cutoffTradingDate: string,
): Promise<readonly LifecycleEntry[]> {
  const snapshot = await seam.snapshot(["lifecycleIndex"]);
  return snapshot
    .rows("lifecycleIndex")
    .map((row) => row as unknown as LifecycleEntry)
    .filter((entry) => openAtCutoff(entry, cutoffTradingDate));
}

export interface TradeAgreementRead {
  readonly entry: LifecycleEntry;
  readonly facts: readonly Record<string, unknown>[];
  readonly agreement: AgreementResult;
}

/** Read a Trade's stored membership with its effective facts and report agreement without repairing. */
export async function readTradeAgreement(
  seam: TransactionSeam,
  tradeId: string,
): Promise<TradeAgreementRead | undefined> {
  const snapshot = await seam.snapshot(["lifecycleIndex", "tradeRecord"]);
  const entry = snapshot
    .rows("lifecycleIndex")
    .map((row) => row as unknown as LifecycleEntry)
    .find((candidate) => candidate.tradeId === tradeId);
  if (entry === undefined) return undefined;
  const facts = snapshot.rows("tradeRecord").filter((fact) => fact.tradeId === tradeId);
  return { entry, facts, agreement: checkLifecycleAgreement(entry, facts) };
}
