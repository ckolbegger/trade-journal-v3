import type { CatalogQueryResult, CatalogSaveResult } from "../catalog/save";
import type { EntryDefinitionSet } from "../journal/definitions";
import type { ConfirmPlanCommand, ConfirmPlanResult } from "../trade-workflows";
import type { TradeReadModel } from "./tradeView";
import type { InstalledCapabilityManifest } from "../capability/manifest";
import type { StorageProtection, WorkerControl } from "../platform/host";
import type { InventoryFailure } from "../release/inventory";
import type { ReadinessResult } from "../readiness";
import type { WorkspaceDurabilityResult } from "./durability";
import type { WorkspaceInitializationResult } from "./index";
import type { WorkspaceStatus } from "./status";

/** A harness-only forcing seam: the checks still run, their inputs are pinned to a known condition. */
export interface StartupOverride {
  readonly delayMs?: number;
  readonly diagnosticFailure?: string;
  readonly capacityFreeBytes?: number;
  readonly protection?: StorageProtection;
  readonly workerControl?: WorkerControl;
  readonly inventoryFailures?: readonly InventoryFailure[];
  readonly rootUnreadable?: boolean;
  readonly noWorkspace?: boolean;
  readonly queryFailure?: boolean;
  readonly queryDelayMs?: number;
}

export interface ApplicationStart {
  readonly readiness: ReadinessResult;
  readonly status: WorkspaceStatus;
  readonly manifest: InstalledCapabilityManifest;
}

export interface ApplicationRuntime {
  start(): Promise<ApplicationStart>;
  refresh(): Promise<ApplicationStart>;
  initialize(timeZone: string): Promise<WorkspaceInitializationResult>;
  streamInstitutions(): Promise<CatalogQueryResult>;
  streamSelectableInstitutions(): Promise<CatalogQueryResult>;
  streamAccounts(): Promise<CatalogQueryResult>;
  addInstitution(label: string, expectedSnapshotRevision: number): Promise<CatalogSaveResult>;
  addAccount(
    institutionId: string,
    label: string,
    expectedSnapshotRevision: number,
  ): Promise<CatalogSaveResult>;
  /** The selectable Strategies. Only Long Stock is seeded at manifest v2. */
  streamStrategies(): Promise<readonly { readonly stableKey: string; readonly label: string }[]>;
  /** The exact Plan Reflection definition the confirmation form renders. */
  planDefinition(): Promise<EntryDefinitionSet>;
  /** The one confirmation command. */
  confirmPlan(command: ConfirmPlanCommand): Promise<ConfirmPlanResult>;
  /** The Trades this Workspace holds, as an honest bounded page. */
  streamTrades(): Promise<readonly TradeReadModel[]>;
  /** One committed Trade with its frozen Plan, stored lifecycle and derived agreement. */
  readTrade(tradeId: string): Promise<TradeReadModel | undefined>;
  requestDurability(): Promise<WorkspaceDurabilityResult>;
  setTimeZone(timeZone: string): void;
  capabilityManifest(): InstalledCapabilityManifest;
}
