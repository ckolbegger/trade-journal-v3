// Immutable Installed Capability Manifest for D1. Undelivered capabilities are
// absent, never represented as a domain Unavailable result.
export const INSTALLED_CAPABILITIES = [
  'ReferenceCatalog.save(Institution)',
  'ReferenceCatalog.save(Account)',
  'ReferenceCatalog.query(typed families)',
  'ReferenceCatalog.resolve(typed requirements)',
  'Workspace.initialize',
  'Workspace.getStatus',
  'Workspace.saveSettings',
  'Workspace.requestDurability',
] as const

export const NOT_INSTALLED = [
  'ConfirmPlan',
  'PositionChange',
  'JournalEntry',
  'Mark',
  'Report',
  'Backup',
  'Restore',
] as const

export type Capability = (typeof INSTALLED_CAPABILITIES)[number]
