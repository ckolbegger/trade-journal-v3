// D8 additions to the Installed Capability Manifest. Spreads, settlement,
// management revision, provider, reports, backup, restore and replay remain
// uninstalled. Expiration payoff is intrinsic only, never a valuation.
export const D8_CAPABILITIES = [
  'TradeWorkflows.confirmPlan(OptionLeg)',
  'TradeWorkflows.recordPositionChange(OptionLeg)',
  'TradeAnalysis.assessPlan(OptionLeg)',
  'TradeAnalysis.expirationPayoff',
  'ReferenceCatalog.resolve(StrategyShape)',
  'TradeViewsAndReporting.getTradeDetail(Payoff)',
] as const

export const D8_NAVIGATION = ['Accounts', 'Status', 'New Plan', 'Trades', 'Review'] as const
