export const D2_CAPABILITIES = [
  'ConfirmPlan',
  'TradeAnalysis.assessPlan',
  'TradeRecord.prepareChange',
  'TradeRecord.applyPreparedChange',
  'TradeRecord.getRecord',
  'TradeRecord.queryRecords',
  'TradeViewsAndReporting.browseTrades(Planned)',
  'TradeViewsAndReporting.getTradeDetail(Planned)',
  'Journal.prepareEffects(PlanReflection)',
  'Journal.applyPreparedEffects(PlanReflection)',
  'Journal.getDefinitions',
] as const

export const D2_NAVIGATION = ['Accounts', 'Status', 'New Plan', 'Trades'] as const
