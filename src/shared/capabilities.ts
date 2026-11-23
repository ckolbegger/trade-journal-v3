export interface InstalledCapabilityManifest {
  readonly manifestVersion: 3;
  readonly releaseDeliverable: 'D3';
  readonly schemaVersion: 3;
  readonly operations: readonly string[];
  readonly reportFamilies: readonly string[];
  readonly providerAdapters: readonly string[];
  readonly backupSchemaRange: null;
}

export const INSTALLED_CAPABILITY_MANIFEST: InstalledCapabilityManifest = Object.freeze({
  manifestVersion: 3,
  releaseDeliverable: 'D3',
  schemaVersion: 3,
  operations: Object.freeze([
    'Workspace.initialize',
    'Workspace.getStatus',
    'Workspace.saveSettings',
    'Workspace.requestDurability',
    'ReferenceCatalog.save',
    'ReferenceCatalog.query',
    'ReferenceCatalog.resolve',
    'ReferenceCatalog.seedDefaults',
    'TradeAnalysis.assessPlan',
    'TradeAnalysis.derive',
    'TradeWorkflows.confirmPlan',
    'TradeWorkflows.recordPositionChange',
    'TradeRecord.getRecord',
    'TradeRecord.queryRecords',
    'Journal.getDefinitions',
    'Journal.query',
    'Journal.seedDefaults',
    'TradeViewsAndReporting.browseTrades',
    'TradeViewsAndReporting.getTradeDetail',
  ]),
  reportFamilies: Object.freeze([]),
  providerAdapters: Object.freeze([]),
  backupSchemaRange: null,
});
