import type { InstalledCapabilityManifest } from "../capability/manifest";
import type { Clock, Instant } from "../platform/clock";
import type { StorageProtection } from "../platform/host";
import type { ReadinessResult } from "../readiness";
import type { RootObservation } from "../readiness/decision";
import type { SafeAction } from "../results";
import type { OnboardingState } from "./index";

export interface WorkspaceSnapshotBinding {
  readonly revision: number;
  readonly factRevision: number;
  readonly observationRevision: number;
  readonly journalRevision: number;
  readonly referenceRevision: number;
}

export interface WorkspaceRecord {
  readonly timeZone: string;
  readonly timeZoneRevision: number;
  readonly onboarding: OnboardingState;
  readonly seedVersions: { readonly journal: string; readonly catalog: string };
}

export type WorkspaceRead =
  | {
      readonly outcome: "Workspace";
      readonly value: WorkspaceRecord;
      readonly binding: WorkspaceSnapshotBinding;
    }
  | { readonly outcome: "NoWorkspace" }
  | { readonly outcome: "Unreadable"; readonly detail: string };

export interface StatusPorts {
  readonly readiness: () => Promise<ReadinessResult>;
  readonly root: () => Promise<RootObservation>;
  readonly readWorkspace: () => Promise<WorkspaceRead>;
  readonly clock: Clock;
  readonly capabilityManifest: InstalledCapabilityManifest;
  readonly protection: () => Promise<StorageProtection>;
  /** The latest migration/seed/private-rebuild receipt, if any. */
  readonly latestReceipt?: () => Promise<unknown | undefined>;
}

export type WorkspaceStatusOutcome =
  | "Ready"
  | "InitializationRequired"
  | "RecoveryOnly"
  | "Unsupported"
  | "IntegrityBlocked";

export interface WorkspaceStatus {
  readonly outcome: WorkspaceStatusOutcome;
  readonly evaluatedAt: Instant;
  readonly readiness: ReadinessResult;
  readonly protection: StorageProtection;
  readonly capabilityManifest: InstalledCapabilityManifest;
  readonly safetyActions: readonly SafeAction[];
  readonly binding?: WorkspaceSnapshotBinding;
  readonly timeZone?: string;
  readonly timeZoneRevision?: number;
  readonly onboarding?: OnboardingState;
  readonly schemaVersion: number;
  readonly latestReceipt?: unknown;
}

const recoveryActions: readonly SafeAction[] = [
  { id: "export-backup", explanation: "Export a backup of the readable Workspace." },
  { id: "retry", explanation: "Retry the readiness checks." },
];

const integrityActions: readonly SafeAction[] = [
  { id: "recovery-guidance", explanation: "Do not initialize over this storage." },
  { id: "retry", explanation: "Retry after checking the existing storage." },
];

function statusOf(
  outcome: WorkspaceStatusOutcome,
  base: {
    readiness: ReadinessResult;
    protection: StorageProtection;
    capabilityManifest: InstalledCapabilityManifest;
    schemaVersion: number;
    evaluatedAt: Instant;
    latestReceipt?: unknown;
  },
  extra: Partial<WorkspaceStatus> = {},
): WorkspaceStatus {
  return {
    outcome,
    ...base,
    safetyActions: extra.safetyActions ?? [],
    ...extra,
  };
}

/**
 * One honest lifecycle status from readiness, root state and installed capability. It reads and never
 * mutates or repairs.
 */
export async function getStatus(ports: StatusPorts): Promise<WorkspaceStatus> {
  const readiness = await ports.readiness();
  const root = await ports.root();
  const protection = await ports.protection();
  const evaluatedAt = ports.clock.now();
  const latestReceipt = ports.latestReceipt === undefined ? undefined : await ports.latestReceipt();
  const base = {
    readiness,
    protection,
    capabilityManifest: ports.capabilityManifest,
    schemaVersion: ports.capabilityManifest.schema.maxSchemaVersion,
    evaluatedAt,
    ...(latestReceipt === undefined ? {} : { latestReceipt }),
  };

  if (root === "unreadable") {
    return statusOf("IntegrityBlocked", base, { safetyActions: integrityActions });
  }

  const workspace = await ports.readWorkspace();
  if (workspace.outcome === "Unreadable") {
    return statusOf("IntegrityBlocked", base, { safetyActions: integrityActions });
  }

  if (readiness.outcome !== "Writable") {
    if (workspace.outcome === "Workspace") {
      return statusOf("RecoveryOnly", base, {
        safetyActions: recoveryActions,
        binding: workspace.binding,
        timeZone: workspace.value.timeZone,
        timeZoneRevision: workspace.value.timeZoneRevision,
        onboarding: workspace.value.onboarding,
      });
    }
    return statusOf("Unsupported", base, { safetyActions: readiness.safeActions });
  }

  if (workspace.outcome === "NoWorkspace") {
    return statusOf("InitializationRequired", base);
  }

  return statusOf("Ready", base, {
    binding: workspace.binding,
    timeZone: workspace.value.timeZone,
    timeZoneRevision: workspace.value.timeZoneRevision,
    onboarding: workspace.value.onboarding,
  });
}
