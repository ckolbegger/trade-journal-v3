export interface InstalledCapabilityManifest {
  readonly manifestVersion: 7;
  readonly releaseDeliverable: 'D7';
  readonly schemaVersion: 6;
  readonly operations: readonly string[];
  readonly reportFamilies: readonly string[];
  readonly providerAdapters: readonly string[];
  readonly backupSchemaRange: null;
}

export const INSTALLED_CAPABILITY_MANIFEST: InstalledCapabilityManifest = Object.freeze({
  manifestVersion: 7,
  releaseDeliverable: 'D7',
  schemaVersion: 6,
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
    'TradeAnalysis.replay',
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
    'DailyReview.open',
    'DailyReview.getTrade',
    'DailyReview.getDebt',
    'DailyReview.save',
    'TradeViewsAndReporting.browseTrades',
    'TradeViewsAndReporting.getTradeDetail',
    'TradeViewsAndReporting.getReviewMarksView',
    'TradeViewsAndReporting.replayTrade',
  ]),
  reportFamilies: Object.freeze([]),
  providerAdapters: Object.freeze([]),
  backupSchemaRange: null,
});
