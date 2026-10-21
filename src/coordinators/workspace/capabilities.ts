import { SCHEMA_VERSION } from '../../persistence/index.ts';

// The Installed Capability Manifest: what this release installs, bound to its release identity.
// It describes installed code, is not trader data, cannot be toggled, and is not restored.
// Anything not yet delivered is absent rather than reported as Unavailable.
export interface InstalledCapabilityManifest {
  readonly releaseId: string;
  // Each complete public operation with its supported variants.
  readonly operations: Readonly<Record<string, readonly string[]>>;
  readonly strategies: readonly string[];
  readonly entryTypes: readonly string[];
  // The Workspace schema version this release writes; older versions migrate to it.
  readonly schemaVersion: number;
  // No backup format is installed before D8.
  readonly backupSchemaRange: null;
  readonly providerAdapters: readonly string[];
}

// The capability set through D2 (implementation plan, D1 and D2 "Introduces").
const OPERATIONS: Readonly<Record<string, readonly string[]>> = {
  'Workspace.initialize': ['FreshWorkspace', 'ExistingWorkspace'],
  'Workspace.getStatus': [],
  'Workspace.requestDurability': [],
  'ReferenceCatalog.save': ['CreateInstitution', 'CreateAccount'],
  'ReferenceCatalog.query': ['Institution', 'Account', 'Strategy'],
  'ReferenceCatalog.resolve': ['NewSelection', 'DisplayOnly'],
  'Journal.getDefinitions': [],
  'Journal.query': ['TradeNarrative'],
  'TradeWorkflows.confirmPlan': ['LongStock'],
  // D2 A18: opening and increase Buys of a Stock serving its Planned Leg, every member in one
  // Trade, with the Position Change Reflection completed or declined.
  'TradeWorkflows.recordPositionChange': ['Opening', 'Increase', 'Stock', 'SingleTrade', 'Complete', 'Decline'],
  'TradeViewsAndReporting.browseTrades': ['Planned', 'Open'],
  'TradeViewsAndReporting.getTradeDetail': ['Planned', 'Open'],
};

export function installedCapabilities(releaseId: string): InstalledCapabilityManifest {
  return {
    releaseId,
    operations: OPERATIONS,
    strategies: ['strategy.long-stock'],
    entryTypes: ['entry-type.plan-reflection', 'entry-type.position-change-reflection'],
    schemaVersion: SCHEMA_VERSION,
    backupSchemaRange: null,
    providerAdapters: [],
  };
}
