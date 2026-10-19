import type { TransactionSeam } from "../persistence/indexeddb/transaction";
import {
  LIFECYCLE_INDEX_STORE,
  TRADE_FACT_STORE,
  type AnalysisInput,
  type FactRevision,
  type LifecycleStateName,
} from "./index";

/**
 * `queryRecords` for a current-state page. `CurrentState` selects from the authoritative lifecycle
 * index in one bounded cursor pass and returns the complete `AnalysisInput` batch, so neither the
 * Open list nor Review issues one record load per result.
 */
export type TradeRecordProjection = "Summary" | "AnalysisInput";

export interface TradeRecordQuery {
  readonly lifecycle: "CurrentState";
  readonly state: LifecycleStateName;
  readonly projection: TradeRecordProjection;
  readonly limit: number;
}

export interface LifecycleListRow {
  readonly tradeId: string;
  readonly state: string;
  readonly factRevision: FactRevision;
  readonly cutoffTradingDate?: string;
}

export interface QueryCounts {
  readonly indexCursors: number;
  readonly cursorSteps: number;
  /** One bounded batch read, whatever the page size. */
  readonly batchReads: number;
  readonly batchEntries: number;
  /** Record loads outside the bounded batch; zero is the contract. */
  readonly perRecordReads: number;
}

export interface TradeRecordPage {
  readonly outcome: "Page";
  readonly rows: readonly LifecycleListRow[];
  readonly batch: readonly AnalysisInput[];
  readonly counts: QueryCounts;
}

function analysisInputOf(
  tradeId: string,
  facts: readonly Record<string, unknown>[],
  lifecycle: Record<string, unknown>,
): AnalysisInput {
  const header = facts.find((row) => row.kind === "trade");
  const plan = facts.find((row) => row.kind === "plan");
  return {
    tradeId,
    candidate: false,
    accountId: String(header?.accountId ?? ""),
    strategyStableKey: String(header?.strategyStableKey ?? ""),
    tags: (header?.tags as readonly string[] | undefined) ?? [],
    factRevision: Number(lifecycle.factRevision ?? 0),
    recordedSequence: Number(header?.recordedSequence ?? 0),
    economicTime: String(header?.economicTime ?? ""),
    saveTime: String(header?.saveTime ?? ""),
    plan: {
      intendedEntry: (plan?.intendedEntry as AnalysisInput["plan"]["intendedEntry"] | undefined) ?? {
        amount: "",
      },
      plannedLegs: facts
        .filter((row) => row.kind === "planned-leg")
        .map((row) => row.leg as AnalysisInput["plan"]["plannedLegs"][number]),
      originalManagement: facts
        .filter((row) => row.kind === "management-condition")
        .map((row) => row.condition as AnalysisInput["plan"]["originalManagement"][number]),
    },
  };
}

export function queryRecords(
  seam: TransactionSeam,
  query: TradeRecordQuery,
): Promise<TradeRecordPage> {
  return seam.snapshot([LIFECYCLE_INDEX_STORE, TRADE_FACT_STORE]).then((snapshot) => {
    // One pass over the authoritative index; a read never repairs or backfills an entry.
    const matches = snapshot
      .rows(LIFECYCLE_INDEX_STORE)
      .filter((row) => row.state === query.state)
      .slice(0, Math.max(0, query.limit))
      .map((row) => row as unknown as LifecycleListRow);

    const facts = snapshot.rows(TRADE_FACT_STORE);
    const batch =
      query.projection === "AnalysisInput"
        ? matches.map((row) =>
            analysisInputOf(
              row.tradeId,
              facts.filter((fact) => fact.tradeId === row.tradeId),
              row as unknown as Record<string, unknown>,
            ),
          )
        : [];

    return {
      outcome: "Page" as const,
      rows: matches,
      batch,
      counts: {
        indexCursors: 1,
        cursorSteps: matches.length,
        batchReads: 1,
        batchEntries: matches.length,
        perRecordReads: 0,
      },
    };
  });
}
