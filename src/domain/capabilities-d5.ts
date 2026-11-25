// D5 additions to the Installed Capability Manifest. Provider recovery,
// replay visuals, reports, backup and close remain uninstalled.
export const D5_CAPABILITIES = [
  'DailyReview.open',
  'DailyReview.getTrade',
  'DailyReview.getDebt',
  'DailyReview.save',
  'Journal.save(DailyTradeReview)',
  'TradeAnalysis.replay',
  'TradeRecord.reconcileStopDiscipline',
] as const

export const D5_NAVIGATION = ['Accounts', 'Status', 'New Plan', 'Trades', 'Review'] as const
