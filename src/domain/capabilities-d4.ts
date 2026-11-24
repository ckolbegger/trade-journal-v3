// D4 additions to the Installed Capability Manifest. D1-D3 declarations stay
// intact; provider recovery, replay, Review and reports remain uninstalled.
export const D4_CAPABILITIES = [
  'MarketData.save',
  'MarketData.query(ResolveFrames)',
  'TradeAnalysis.evaluate',
  'TradeViewsAndReporting.browseTrades(Evaluated)',
  'TradeViewsAndReporting.getTradeDetail(Evaluated)',
] as const

export const D4_NAVIGATION = ['Accounts', 'Status', 'New Plan', 'Trades'] as const
