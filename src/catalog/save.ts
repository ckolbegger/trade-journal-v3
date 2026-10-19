import type { TransactionSeam } from "../persistence/indexeddb/transaction";
import type { RuntimeNotWritable } from "../results";
import {
  snapshotOf,
  type AccountSummary,
  type CatalogRecord,
  type CatalogSnapshot,
  type CatalogHistoryEntry,
} from "./index";

const CATALOG_STORE = "referenceCatalog";

export type CatalogSaveCommand =
  | { readonly type: "createInstitution"; readonly label: string; readonly expectedSnapshotRevision: number }
  | { readonly type: "renameInstitution"; readonly id: string; readonly label: string; readonly expectedSnapshotRevision: number }
  | { readonly type: "archiveInstitution"; readonly id: string; readonly expectedSnapshotRevision: number }
  | { readonly type: "reactivateInstitution"; readonly id: string; readonly label?: string; readonly expectedSnapshotRevision: number }
  | { readonly type: "createAccount"; readonly institutionId: string; readonly label: string; readonly expectedSnapshotRevision: number }
  | { readonly type: "renameAccount"; readonly id: string; readonly label: string; readonly expectedSnapshotRevision: number }
  | { readonly type: "retireAccount"; readonly id: string; readonly expectedSnapshotRevision: number }
  | { readonly type: "reactivateAccount"; readonly id: string; readonly label?: string; readonly expectedSnapshotRevision: number };

export type CatalogSaveResult =
  | {
      readonly outcome: "Saved";
      readonly identity: string;
      readonly record: CatalogRecord;
      readonly historyHead: CatalogHistoryEntry;
      readonly catalog: CatalogSnapshot;
    }
  | { readonly outcome: "Rejected"; readonly reason: string; readonly detail?: string }
  | { readonly outcome: "InactiveForRequestedUse"; readonly identity: string }
  | { readonly outcome: "Conflict"; readonly current: CatalogSnapshot }
  | { readonly outcome: "RuntimeNotWritable"; readonly payload: RuntimeNotWritable };

export type CatalogResolutionMode = "newSelection" | "retainedReference";

export type CatalogResolution =
  | {
      readonly outcome: "Resolved";
      readonly identity: string;
      readonly currentLabel: string;
      readonly historicalLabel: string;
      readonly active: boolean;
    }
  | { readonly outcome: "InactiveForRequestedUse"; readonly identity: string }
  | { readonly outcome: "Unknown"; readonly identity: string };

export type CatalogQueryView = "selectable" | "includeInactive";

export type CatalogQueryResult =
  | {
      readonly outcome: "Page";
      readonly kind: "institution" | "account";
      readonly records: readonly CatalogRecord[];
      readonly snapshotRevision: number;
      readonly nextCursor?: string;
      readonly history?: readonly CatalogHistoryEntry[];
    }
  | { readonly outcome: "Unknown"; readonly identity: string }
  | { readonly outcome: "Conflict"; readonly current: CatalogSnapshot };

async function readCatalog(
  seam: TransactionSeam,
): Promise<{ rows: CatalogRecord[]; revision: number }> {
  const snapshot = await seam.snapshot([CATALOG_STORE, "workspaceMeta"]);
  const rows = snapshot.rows(CATALOG_STORE) as unknown as CatalogRecord[];
  const revisions = snapshot
    .rows("workspaceMeta")
    .find((row) => row.key === "revisions")?.value as Record<string, number> | undefined;
  return { rows, revision: revisions?.[CATALOG_STORE] ?? 0 };
}

function historyOf(record: CatalogRecord): CatalogHistoryEntry[] {
  const history = record.history;
  return Array.isArray(history) ? (history as CatalogHistoryEntry[]) : [];
}

function withRevision(
  record: CatalogRecord,
  change: Partial<CatalogRecord>,
  inactive: boolean,
): CatalogRecord {
  const revision = record.revision + 1;
  const label = (change.label as string | undefined) ?? record.label;
  const history: CatalogHistoryEntry[] = [
    ...historyOf(record),
    { revision, label, inactive },
  ];
  return { ...record, ...change, label, revision, history };
}

const labelOf = (label: string): string => label.trim();

export async function save(
  seam: TransactionSeam,
  command: CatalogSaveCommand,
): Promise<CatalogSaveResult> {
  const { rows, revision } = await readCatalog(seam);
  const catalog = snapshotOf(rows, revision);

  if (command.expectedSnapshotRevision !== revision) {
    return { outcome: "Conflict", current: catalog };
  }

  const find = (id: string): CatalogRecord | undefined => rows.find((row) => row.id === id);
  const accounts = rows.filter((row) => row.kind === "account" && row.retired !== true);

  if (command.type === "createInstitution") {
    const label = labelOf(command.label);
    if (label === "") return { outcome: "Rejected", reason: "an Institution name is required" };
    const record: CatalogRecord = {
      id: `institution:${label.toLowerCase().replace(/\s+/g, "-")}`,
      kind: "institution",
      label,
      revision: 1,
      retired: false,
      history: [{ revision: 1, label, inactive: false }],
    };
    const committed = await seam.commit({
      participants: [{ store: CATALOG_STORE, put: [record] }],
    });
    if (committed.kind === "Rejected") return { outcome: "RuntimeNotWritable", payload: committed.payload };
    return {
      outcome: "Saved",
      identity: record.id,
      record,
      historyHead: { revision: 1, label, inactive: false },
      catalog: snapshotOf([...rows, record], committed.revisions[CATALOG_STORE] ?? revision),
    };
  }

  if (command.type === "createAccount") {
    const label = labelOf(command.label);
    if (label === "") return { outcome: "Rejected", reason: "an Account name is required" };
    const parent = find(command.institutionId);
    if (parent === undefined || parent.kind !== "institution") {
      return {
        outcome: "Rejected",
        reason: "the parent Institution is unknown",
        detail: command.institutionId,
      };
    }
    if (parent.retired === true) {
      return {
        outcome: "Rejected",
        reason: "the parent Institution is archived",
        detail: command.institutionId,
      };
    }
    const record: CatalogRecord = {
      id: `account:${parent.id}:${label.toLowerCase().replace(/\s+/g, "-")}`,
      kind: "account",
      parentId: parent.id,
      label,
      revision: 1,
      retired: false,
      history: [{ revision: 1, label, inactive: false }],
    };
    const committed = await seam.commit({
      participants: [{ store: CATALOG_STORE, put: [record] }],
    });
    if (committed.kind === "Rejected") return { outcome: "RuntimeNotWritable", payload: committed.payload };
    return {
      outcome: "Saved",
      identity: record.id,
      record,
      historyHead: { revision: 1, label, inactive: false },
      catalog: snapshotOf([...rows, record], committed.revisions[CATALOG_STORE] ?? revision),
    };
  }

  const id = command.id;
  const record = find(id);
  if (record === undefined) return { outcome: "Rejected", reason: "the identity is unknown", detail: id };

  if (command.type === "renameInstitution" || command.type === "renameAccount") {
    const label = labelOf(command.label);
    if (label === "") return { outcome: "Rejected", reason: "a name is required" };
    const expectedKind = command.type === "renameInstitution" ? "institution" : "account";
    if (record.kind !== expectedKind) {
      return { outcome: "Rejected", reason: `the identity is not an ${expectedKind}`, detail: id };
    }
    const next = withRevision(record, { label }, record.retired === true);
    const committed = await seam.commit({
      participants: [{ store: CATALOG_STORE, put: [next] }],
    });
    if (committed.kind === "Rejected") return { outcome: "RuntimeNotWritable", payload: committed.payload };
    return {
      outcome: "Saved",
      identity: id,
      record: next,
      historyHead: { revision: next.revision, label, inactive: next.retired === true },
      catalog: snapshotOf(
        rows.map((row) => (row.id === id ? next : row)),
        committed.revisions[CATALOG_STORE] ?? revision,
      ),
    };
  }

  if (command.type === "archiveInstitution") {
    if (record.kind !== "institution") {
      return { outcome: "Rejected", reason: "the identity is not an Institution", detail: id };
    }
    if (accounts.some((account) => account.parentId === id)) {
      return {
        outcome: "Rejected",
        reason: "an Institution with selectable Accounts cannot be archived",
        detail: id,
      };
    }
    const next = withRevision(record, { retired: true }, true);
    const committed = await seam.commit({
      participants: [{ store: CATALOG_STORE, put: [next] }],
    });
    if (committed.kind === "Rejected") return { outcome: "RuntimeNotWritable", payload: committed.payload };
    return {
      outcome: "Saved",
      identity: id,
      record: next,
      historyHead: { revision: next.revision, label: next.label, inactive: true },
      catalog: snapshotOf(
        rows.map((row) => (row.id === id ? next : row)),
        committed.revisions[CATALOG_STORE] ?? revision,
      ),
    };
  }

  if (command.type === "retireAccount") {
    if (record.kind !== "account") {
      return { outcome: "Rejected", reason: "the identity is not an Account", detail: id };
    }
    const next = withRevision(record, { retired: true }, true);
    const committed = await seam.commit({
      participants: [{ store: CATALOG_STORE, put: [next] }],
    });
    if (committed.kind === "Rejected") return { outcome: "RuntimeNotWritable", payload: committed.payload };
    return {
      outcome: "Saved",
      identity: id,
      record: next,
      historyHead: { revision: next.revision, label: next.label, inactive: true },
      catalog: snapshotOf(
        rows.map((row) => (row.id === id ? next : row)),
        committed.revisions[CATALOG_STORE] ?? revision,
      ),
    };
  }

  // Reactivation: valid only when the meaning is unchanged.
  const expectedKind = command.type === "reactivateInstitution" ? "institution" : "account";
  if (record.kind !== expectedKind) {
    return { outcome: "Rejected", reason: `the identity is not an ${expectedKind}`, detail: id };
  }
  if (command.label !== undefined && command.label !== record.label) {
    return {
      outcome: "Rejected",
      reason: "reactivation cannot change the meaning of the identity",
      detail: id,
    };
  }
  const next = withRevision(record, { retired: false }, false);
  const committed = await seam.commit({
    participants: [{ store: CATALOG_STORE, put: [next] }],
  });
  if (committed.kind === "Rejected") return { outcome: "RuntimeNotWritable", payload: committed.payload };
  return {
    outcome: "Saved",
    identity: id,
    record: next,
    historyHead: { revision: next.revision, label: next.label, inactive: false },
    catalog: snapshotOf(
      rows.map((row) => (row.id === id ? next : row)),
      committed.revisions[CATALOG_STORE] ?? revision,
    ),
  };
}

export async function resolveReference(
  seam: TransactionSeam,
  request: { readonly kind: "institution" | "account"; readonly id: string; readonly mode: CatalogResolutionMode },
): Promise<CatalogResolution> {
  const { rows } = await readCatalog(seam);
  const record = rows.find((row) => row.id === request.id);
  if (record === undefined || record.kind !== request.kind) {
    return { outcome: "Unknown", identity: request.id };
  }
  const history = historyOf(record);
  const historicalLabel = history[0]?.label ?? record.label;
  const active = record.retired !== true;
  if (!active && request.mode === "newSelection") {
    return { outcome: "InactiveForRequestedUse", identity: request.id };
  }
  return {
    outcome: "Resolved",
    identity: request.id,
    currentLabel: record.label,
    historicalLabel,
    active,
  };
}

export async function query(
  seam: TransactionSeam,
  request: {
    readonly kind: "institution" | "account";
    readonly view: CatalogQueryView;
    readonly limit?: number;
    readonly cursor?: string;
    readonly identity?: string;
  },
): Promise<CatalogQueryResult> {
  const { rows, revision } = await readCatalog(seam);
  if (request.identity !== undefined) {
    const record = rows.find(
      (row) => row.id === request.identity && row.kind === request.kind,
    );
    if (record === undefined) return { outcome: "Unknown", identity: request.identity };
    return {
      outcome: "Page",
      kind: request.kind,
      records: [record],
      snapshotRevision: revision,
      history: historyOf(record),
    };
  }

  const family = rows
    .filter((row) => row.kind === request.kind)
    .filter((row) => request.view === "includeInactive" || row.retired !== true)
    .sort((left, right) => {
      const byLabel = left.label.localeCompare(right.label);
      return byLabel !== 0 ? byLabel : left.id.localeCompare(right.id);
    });

  const afterCursor = request.cursor === undefined ? 0 : family.findIndex((row) => row.id === request.cursor) + 1;
  const limit = request.limit ?? family.length;
  const page = family.slice(afterCursor, afterCursor + limit);
  const next = afterCursor + limit < family.length ? page[page.length - 1]?.id : undefined;

  return {
    outcome: "Page",
    kind: request.kind,
    records: page,
    snapshotRevision: revision,
    ...(next === undefined ? {} : { nextCursor: next }),
  };
}

export type { AccountSummary };
