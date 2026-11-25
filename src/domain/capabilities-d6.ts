// D6 additions to the Installed Capability Manifest. Close Review, options,
// settlement, provider recovery, reports, backup and restore are not installed.
export const D6_CAPABILITIES = [
  'TradeWorkflows.recordPositionChange(Closed)',
  'TradeAnalysis.derive(FIFO)',
  'TradeRecord.lotMatches',
  'ReferenceCatalog.resolve(CloseReason)',
  'TradeViewsAndReporting.getTradeDetail(Closed)',
] as const

// Close is an action on an Open detail, not a navigation entry.
export const D6_NAVIGATION = ['Accounts', 'Status', 'New Plan', 'Trades', 'Review'] as const
