export interface InstalledCapabilityManifest {
  readonly manifestVersion: 2;
  readonly releaseDeliverable: 'D2';
  readonly schemaVersion: 2;
  readonly operations: readonly string[];
  readonly reportFamilies: readonly string[];
  readonly providerAdapters: readonly string[];
  readonly backupSchemaRange: null;
}

export const INSTALLED_CAPABILITY_MANIFEST: InstalledCapabilityManifest = Object.freeze({
  manifestVersion: 2,
  releaseDeliverable: 'D2',
  schemaVersion: 2,
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
    'TradeWorkflows.confirmPlan',
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
