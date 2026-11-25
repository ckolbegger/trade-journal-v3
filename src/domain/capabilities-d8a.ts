// D8a additions to the Installed Capability Manifest. All views are read-only.
// The advisory explanation is one capability: removing it removes its outputs
// rather than producing a domain Unavailable. Provider configuration/recovery,
// required Daily Bars, manual OHLC, custom ranges, combined replay+payoff,
// adherence scores and reports remain uninstalled.
export const D8A_CAPABILITIES = [
  'TradeViewsAndReporting.getTradeDetail(Complete)',
  'TradeViewsAndReporting.replayTrade(MarkOnly)',
  'MarketData.query(ReadSeries)',
  'Journal.query',
  'ReferenceCatalog.resolve(LabelLens)',
  'TradeAnalysis.advisoryExplanation(IV)',
] as const

export const D8A_NAVIGATION = ['Accounts', 'Status', 'New Plan', 'Trades', 'Review'] as const
