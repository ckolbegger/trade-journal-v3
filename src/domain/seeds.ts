// Versioned, stable-keyed product defaults. Installed atomically by
// Workspace.initialize; never matched by mutable label or overwritten.
export const SEED_VERSION = 1

export const STRATEGY_SEEDS = [
  'Long Stock', 'Long Call', 'Long Put', 'Cash-Secured Put', 'Covered Call',
  'Vertical Call Debit Spread', 'Vertical Call Credit Spread',
  'Vertical Put Debit Spread', 'Vertical Put Credit Spread', 'PMCC', 'Iron Condor',
] as const

export const CLOSE_REASON_SEEDS = [
  'Target Reached', 'Stop Triggered', 'Thesis Invalidated', 'Time-Based Exit', 'Rolled',
] as const

export const ABANDONMENT_REASON_SEEDS = [
  'Entry Criteria Never Met', 'Thesis Invalidated Before Entry', 'Opportunity Missed',
  'Chose Not to Enter', 'Plan Superseded',
] as const

export const ENTRY_TYPE_SEEDS = [
  'Plan Reflection', 'Position Change Reflection', 'Management Revision', 'Close Review',
  'Daily Trade Review', 'Review Note', 'Trader Reflection',
] as const

export const SOURCE_SEEDS = [
  'Plan Confirmation', 'Position Change', 'Management Revision', 'Trade Close',
  'Daily Review', 'Trade Detail', 'Journal',
] as const

export const IDEA_SOURCE_TAG_TYPE = 'IdeaSource'

export type SeedManifest = {
  version: number
  strategies: readonly string[]
  closeReasons: readonly string[]
  abandonmentReasons: readonly string[]
  entryTypes: readonly string[]
  sources: readonly string[]
  ideaSourceTagType: string
}

export const SEED_MANIFEST: SeedManifest = {
  version: SEED_VERSION,
  strategies: STRATEGY_SEEDS,
  closeReasons: CLOSE_REASON_SEEDS,
  abandonmentReasons: ABANDONMENT_REASON_SEEDS,
  entryTypes: ENTRY_TYPE_SEEDS,
  sources: SOURCE_SEEDS,
  ideaSourceTagType: IDEA_SOURCE_TAG_TYPE,
}
