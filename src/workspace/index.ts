import { CATALOG_SEED_MANIFEST_V1, planCatalogSeed } from "../catalog";
import { resolveSessionDate } from "../calendar";
import { SEED_MANIFEST_V1, planJournalSeed } from "../journal";
import type { MigrationOutcome } from "../persistence/indexeddb/migration";
import type { TransactionSeam } from "../persistence/indexeddb/transaction";
import type { Instant } from "../platform/clock";
import type { ReadinessResult } from "../readiness";
import type { RootObservation } from "../readiness/decision";
import {
  runtimeNotWritable,
  type RuntimeNotWritable,
  type SafeAction,
} from "../results";

export interface WorkspacePorts {
  readonly readiness: () => Promise<ReadinessResult>;
  readonly seam: () => TransactionSeam;
  readonly migrate: () => Promise<MigrationOutcome>;
  readonly root: () => Promise<RootObservation>;
  /** Stored-content validation after a passing readiness gate. */
  readonly validateStoredContents?: () => Promise<string | undefined>;
}

export interface InitializeRequest {
  readonly openingInstant: Instant;
  readonly timeZone?: string;
}

export type OnboardingState = "Needs Institution and Account" | "Ready for Trade Planning";

export interface WorkspaceInitializationReceipt {
  readonly readiness: ReadinessResult;
  readonly fresh: boolean;
  readonly schemaTransitions: readonly { readonly from: number; readonly to: number }[];
  readonly migrations: readonly string[];
  readonly seedVersions: { readonly journal: string; readonly catalog: string };
  readonly seedAdditions: readonly string[];
  readonly privateRebuilds: readonly string[];
  readonly incompleteTransactionRecovery: boolean;
  readonly timeZone: string;
  readonly openingSession?: { readonly tradingDate: string; readonly revision: string };
}

export type WorkspaceInitializationResult =
  | {
      readonly outcome: "Opened";
      readonly receipt: WorkspaceInitializationReceipt;
      readonly onboarding: OnboardingState;
    }
  | { readonly outcome: "TimeZoneSelectionRequired" }
  | {
      readonly outcome: "MigrationBlocked";
      readonly evidence: { readonly priorDataUnchanged: true; readonly detail: string };
    }
  | {
      readonly outcome: "IntegrityBlocked";
      readonly detail: string;
      readonly recoveryActions: readonly SafeAction[];
    }
  | { readonly outcome: "RuntimeNotWritable"; readonly payload: RuntimeNotWritable };

const recoveryActions: readonly SafeAction[] = [
  { id: "recovery-guidance", explanation: "Do not initialize over this storage; follow recovery guidance." },
  { id: "retry", explanation: "Retry after checking the existing storage." },
];

function onboardingOf(rows: readonly Record<string, unknown>[]): OnboardingState {
  const institutions = rows.filter(
    (row) => row.kind === "institution" && row.retired !== true,
  );
  const accounts = rows.filter((row) => row.kind === "account" && row.retired !== true);
  return institutions.length > 0 && accounts.length > 0
    ? "Ready for Trade Planning"
    : "Needs Institution and Account";
}

export async function initialize(
  ports: WorkspacePorts,
  request: InitializeRequest,
): Promise<WorkspaceInitializationResult> {
  const readiness = await ports.readiness();
  const root = await ports.root();

  if (readiness.outcome !== "Writable") {
    return {
      outcome: "RuntimeNotWritable",
      payload: runtimeNotWritable({
        runtimeReadiness: root === "readable" ? "RecoveryOnly" : "Unsupported",
        failedChecks: readiness.failedChecks,
        existingRootUnreadable: root === "unreadable",
        workspaceStatus: root === "readable" ? "RecoveryOnly" : undefined,
        safeActions:
          root === "readable"
            ? [
                { id: "export-backup", explanation: "Export a backup of this readable Workspace." },
                ...readiness.safeActions,
              ]
            : readiness.safeActions,
      }),
    };
  }

  if (root === "unreadable") {
    return {
      outcome: "IntegrityBlocked",
      detail: "a known or possible existing root cannot be read or validated",
      recoveryActions,
    };
  }

  const seam = ports.seam();
  const meta = await seam.snapshot(["workspaceMeta", "referenceCatalog"]);
  const existing = meta.rows("workspaceMeta").find((row) => row.key === "workspace");

  if (existing !== undefined) {
    const stored = existing.value as {
      timeZone?: string;
      seedVersions?: { journal?: string; catalog?: string };
      openingSession?: { tradingDate: string; revision: string };
    };
    return {
      outcome: "Opened",
      onboarding: onboardingOf(meta.rows("referenceCatalog")),
      receipt: {
        readiness,
        fresh: false,
        schemaTransitions: [],
        migrations: [],
        seedVersions: {
          journal: stored.seedVersions?.journal ?? "",
          catalog: stored.seedVersions?.catalog ?? "",
        },
        seedAdditions: [],
        privateRebuilds: [],
        incompleteTransactionRecovery: false,
        timeZone: stored.timeZone ?? "",
        ...(stored.openingSession === undefined ? {} : { openingSession: stored.openingSession }),
      },
    };
  }

  if (request.timeZone === undefined || request.timeZone.trim() === "") {
    return { outcome: "TimeZoneSelectionRequired" };
  }

  const migration = await ports.migrate();
  if (migration.outcome !== "Migrated") {
    return {
      outcome: "MigrationBlocked",
      evidence: {
        priorDataUnchanged: true,
        detail:
          migration.outcome === "UnsupportedVersion"
            ? `stored version ${migration.storedVersion} is newer than the supported ${migration.targetVersion}`
            : migration.outcome === "MigrationBlocked"
              ? migration.detail
              : "the migration did not complete",
      },
    };
  }

  const storedProblem = ports.validateStoredContents === undefined ? undefined : await ports.validateStoredContents();
  if (storedProblem !== undefined) {
    return { outcome: "IntegrityBlocked", detail: storedProblem, recoveryActions };
  }

  const journalRows = (await seam.snapshot(["journal"])).rows("journal");
  const catalogRows = (await seam.snapshot(["referenceCatalog"])).rows("referenceCatalog");
  const journalPlan = planJournalSeed(journalRows, SEED_MANIFEST_V1);
  const catalogPlan = planCatalogSeed(catalogRows, CATALOG_SEED_MANIFEST_V1);
  if (journalPlan.outcome === "SeedConflict" || catalogPlan.outcome === "SeedConflict") {
    return {
      outcome: "IntegrityBlocked",
      detail: "a known stable product key already exists with an incompatible meaning",
      recoveryActions,
    };
  }

  const session = resolveSessionDate(request.openingInstant);
  const openingSession =
    session.outcome === "Resolved"
      ? { tradingDate: session.tradingDate, revision: session.revision }
      : undefined;
  const workspace = {
    key: "workspace",
    value: {
      initializedAt: request.openingInstant,
      timeZone: request.timeZone,
      schemaVersion: 1,
      seedVersions: {
        journal: SEED_MANIFEST_V1.version,
        catalog: CATALOG_SEED_MANIFEST_V1.version,
      },
      openingSession: openingSession ?? null,
    },
  };

  const committed = await seam.commit({
    participants: [
      { store: "journal", put: journalPlan.additions },
      { store: "referenceCatalog", put: catalogPlan.additions },
      { store: "workspaceMeta", put: [workspace] },
    ],
  });
  if (committed.kind === "Rejected") {
    return { outcome: "RuntimeNotWritable", payload: committed.payload };
  }

  return {
    outcome: "Opened",
    onboarding: "Needs Institution and Account",
    receipt: {
      readiness,
      fresh: true,
      schemaTransitions: migration.receipt.schemaTransitions,
      migrations: migration.receipt.migrationsApplied,
      seedVersions: {
        journal: SEED_MANIFEST_V1.version,
        catalog: CATALOG_SEED_MANIFEST_V1.version,
      },
      seedAdditions: [...journalPlan.additionKeys, ...catalogPlan.additionKeys],
      privateRebuilds: migration.receipt.privateRebuilds,
      incompleteTransactionRecovery: false,
      timeZone: request.timeZone,
      ...(openingSession === undefined ? {} : { openingSession }),
    },
  };
}
