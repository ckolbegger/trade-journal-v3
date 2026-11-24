// D3 additions to the Installed Capability Manifest. D1/D2 declarations stay
// intact; an undelivered capability is absent, never a fake Unavailable result.
export const D3_CAPABILITIES = [
  'TradeWorkflows.recordPositionChange(Open)',
  'TradeAnalysis.derive',
  'TradeRecord.history',
  'TradeViewsAndReporting.browseTrades(Open)',
  'TradeViewsAndReporting.getTradeDetail(Open)',
  'Journal.prepareEffects(PositionChangeReflection)',
  'Journal.applyPreparedEffects(PositionChangeReflection)',
  'Journal.query',
] as const

// Add Execution is an action on a Planned detail, not a navigation entry.
export const D3_NAVIGATION = ['Institutions & Accounts', 'Workspace', 'New Plan', 'Trades'] as const
