// The Installed Capability Manifest: what this release installs, bound to its release identity.
// It describes installed code, is not trader data, cannot be toggled, and is not restored.
// Anything not yet delivered is absent rather than reported as Unavailable.
export interface InstalledCapabilityManifest {
  readonly releaseId: string;
  // Each complete public operation with its supported variants.
  readonly operations: Readonly<Record<string, readonly string[]>>;
  readonly strategies: readonly string[];
  readonly entryTypes: readonly string[];
  // No backup format is installed before D8.
  readonly backupSchemaRange: null;
  readonly providerAdapters: readonly string[];
}

// D1's capability set (implementation plan, D1 "Introduces").
const D1_OPERATIONS: Readonly<Record<string, readonly string[]>> = {
  'Workspace.initialize': ['FreshWorkspace', 'ExistingWorkspace'],
  'Workspace.getStatus': [],
  'Workspace.requestDurability': [],
  'ReferenceCatalog.save': ['CreateInstitution', 'CreateAccount'],
  'ReferenceCatalog.query': ['Institution', 'Account', 'Strategy'],
  'ReferenceCatalog.resolve': ['NewSelection', 'DisplayOnly'],
  'Journal.getDefinitions': [],
  'Journal.query': ['TradeNarrative'],
  'TradeWorkflows.confirmPlan': ['LongStock'],
  'TradeViewsAndReporting.browseTrades': ['Planned'],
  'TradeViewsAndReporting.getTradeDetail': ['Planned'],
};

export function installedCapabilities(releaseId: string): InstalledCapabilityManifest {
  return {
    releaseId,
    operations: D1_OPERATIONS,
    strategies: ['strategy.long-stock'],
    entryTypes: ['entry-type.plan-reflection'],
    backupSchemaRange: null,
    providerAdapters: [],
  };
}
