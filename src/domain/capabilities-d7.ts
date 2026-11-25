// D7 additions to the Installed Capability Manifest. Close Review is a
// Journal obligation on a Closed detail; it is not a navigation entry. Edit,
// Addendum, Void, options, settlement, provider and reports are not installed.
export const D7_CAPABILITIES = [
  'Journal.save(CloseReview)',
  'Journal.query(CloseReview)',
  'Journal.getDefinitions(CloseReview)',
  'DailyReview.getDebt(CloseReview)',
  'TradeViewsAndReporting.getTradeDetail(JournalNarrative)',
] as const

export const D7_NAVIGATION = ['Accounts', 'Status', 'New Plan', 'Trades', 'Review'] as const
