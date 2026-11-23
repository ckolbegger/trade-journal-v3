export interface InstalledCapabilityManifest {
  readonly manifestVersion: 4;
  readonly releaseDeliverable: 'D4';
  readonly schemaVersion: 4;
  readonly operations: readonly string[];
  readonly reportFamilies: readonly string[];
  readonly providerAdapters: readonly string[];
  readonly backupSchemaRange: null;
}

export const INSTALLED_CAPABILITY_MANIFEST: InstalledCapabilityManifest = Object.freeze({
  manifestVersion: 4,
  releaseDeliverable: 'D4',
  schemaVersion: 4,
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
    'TradeAnalysis.evaluate',
    'TradeWorkflows.confirmPlan',
    'TradeWorkflows.recordPositionChange',
    'TradeRecord.getRecord',
    'TradeRecord.queryRecords',
    'Journal.getDefinitions',
    'Journal.query',
    'Journal.seedDefaults',
    'MarketData.save',
    'MarketData.resolveFrames',
    'MarketData.readSeries',
    'MarketData.inspectObservations',
    'TradeViewsAndReporting.browseTrades',
    'TradeViewsAndReporting.getTradeDetail',
    'TradeViewsAndReporting.getReviewMarksView',
  ]),
  reportFamilies: Object.freeze([]),
  providerAdapters: Object.freeze([]),
  backupSchemaRange: null,
});
