import type { StorageProtection } from './types'

export type SettingsResult =
  | { ok: true; value: { timeZone: string; revision: string }; errorKind?: undefined }
  | { ok: false; errorKind: 'Unchanged' | 'Conflict' }

export function saveSettings(
  command: { timeZone: string; revision: string },
  currentRevision: string,
): SettingsResult {
  if (command.revision !== currentRevision) return { ok: false, errorKind: 'Conflict' }
  return {
    ok: true,
    value: { timeZone: command.timeZone, revision: String(Number(currentRevision) + 1) },
  }
}

// Identical settings return Unchanged: compare against the current value.
export function saveSettingsWithCurrent(
  command: { timeZone: string; revision: string },
  current: { timeZone: string; revision: string },
): SettingsResult {
  if (command.revision !== current.revision) return { ok: false, errorKind: 'Conflict' }
  if (command.timeZone === current.timeZone) return { ok: false, errorKind: 'Unchanged' }
  return {
    ok: true,
    value: { timeZone: command.timeZone, revision: String(Number(current.revision) + 1) },
  }
}

export function requestDurability(protection: StorageProtection): 'Improved' | 'AlreadyProtected' | 'NotImproved' {
  return protection.kind === 'Protected' ? 'AlreadyProtected' : 'NotImproved'
}
