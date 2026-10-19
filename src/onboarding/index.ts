import type { CatalogRecord, CatalogSnapshot } from "../catalog";
import { query, save, type CatalogSaveResult } from "../catalog/save";
import type { TransactionSeam } from "../persistence/indexeddb/transaction";
import type { OnboardingState } from "../workspace";

export interface OnboardingPorts {
  readonly seam: () => Promise<TransactionSeam>;
}

export type OnboardingOutcome =
  | {
      readonly outcome: "Created";
      readonly identity: string;
      readonly record: CatalogRecord;
      readonly onboarding: OnboardingState;
      readonly catalog: CatalogSnapshot;
    }
  | { readonly outcome: "Rejected"; readonly message: string; readonly field: "name" | "institution" }
  | { readonly outcome: "Conflict"; readonly current: CatalogSnapshot; readonly message: string }
  | { readonly outcome: "ParentConflict"; readonly current: CatalogSnapshot; readonly message: string; readonly field: "institution" }
  | { readonly outcome: "NotWritable" };

export function validateInstitutionName(name: string): string | undefined {
  return name.trim() === "" ? "Enter the brokerage name." : undefined;
}

export function validateAccountName(name: string): string | undefined {
  return name.trim() === "" ? "Enter the account name." : undefined;
}

/** Ready for Trade Planning only with a selectable Institution and a selectable Account. */
export function onboardingFrom(catalog: CatalogSnapshot): OnboardingState {
  const institution = catalog.institutions.some((record) => !record.archived);
  const account = catalog.accounts.some((record) => !record.retired);
  return institution && account ? "Ready for Trade Planning" : "Needs Institution and Account";
}

function mapSave(
  result: CatalogSaveResult,
  catalogFromRecord: (record: CatalogRecord) => CatalogSnapshot,
): OnboardingOutcome {
  if (result.outcome === "Saved") {
    return {
      outcome: "Created",
      identity: result.identity,
      record: result.record,
      onboarding: onboardingFrom(result.catalog),
      catalog: result.catalog,
    };
  }
  if (result.outcome === "Conflict") {
    return {
      outcome: "Conflict",
      current: result.current,
      message: "This catalog changed while you were editing. Review it and try again.",
    };
  }
  if (result.outcome === "Rejected") {
    return { outcome: "Rejected", message: result.reason, field: "name" };
  }
  void catalogFromRecord;
  return { outcome: "NotWritable" };
}

export async function createInstitution(
  ports: OnboardingPorts,
  request: { readonly label: string; readonly expectedSnapshotRevision: number },
): Promise<OnboardingOutcome> {
  const problem = validateInstitutionName(request.label);
  if (problem !== undefined) return { outcome: "Rejected", message: problem, field: "name" };
  const result = await save(await ports.seam(), {
    type: "createInstitution",
    label: request.label.trim(),
    expectedSnapshotRevision: request.expectedSnapshotRevision,
  });
  return mapSave(result, () => {
    throw new Error("unused");
  });
}

export async function createAccount(
  ports: OnboardingPorts,
  request: {
    readonly institutionId: string;
    readonly label: string;
    readonly expectedSnapshotRevision: number;
  },
): Promise<OnboardingOutcome> {
  if (request.institutionId === "") {
    return {
      outcome: "Rejected",
      message: "Choose the Institution this Account belongs to.",
      field: "institution",
    };
  }
  const problem = validateAccountName(request.label);
  if (problem !== undefined) return { outcome: "Rejected", message: problem, field: "name" };

  const seam = await ports.seam();
  const result = await save(seam, {
    type: "createAccount",
    institutionId: request.institutionId,
    label: request.label.trim(),
    expectedSnapshotRevision: request.expectedSnapshotRevision,
  });
  if (
    result.outcome === "Rejected" &&
    (result.reason === "the parent Institution is archived" ||
      result.reason === "the parent Institution is unknown")
  ) {
    const current = await query(seam, { kind: "institution", view: "includeInactive" });
    const snapshot: CatalogSnapshot =
      current.outcome === "Page"
        ? {
            revision: current.snapshotRevision,
            strategies: [],
            institutions: current.records
              .filter((record) => record.kind === "institution")
              .map((record) => ({
                id: record.id,
                label: record.label,
                archived: record.retired === true,
                revision: record.revision,
              })),
            accounts: [],
          }
        : { revision: 0, strategies: [], institutions: [], accounts: [] };
    return {
      outcome: "ParentConflict",
      current: snapshot,
      message: "The Institution is no longer selectable. Review it and choose again.",
      field: "institution",
    };
  }
  return mapSave(result, () => {
    throw new Error("unused");
  });
}

/** The selectable-only Account page in deterministic order, for the Account step. */
export async function selectableAccounts(
  ports: OnboardingPorts,
): Promise<readonly CatalogRecord[]> {
  const result = await query(await ports.seam(), { kind: "account", view: "selectable" });
  return result.outcome === "Page" ? result.records : [];
}
