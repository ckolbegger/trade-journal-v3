import type { StorageHealth } from '@/workspace/workspace'

// Backup-nudge policy (S6.3): `lastExportAt` is a fact Workspace records
// (storageHealth); how stale it may get before nagging is a Settings value
// (backupNudgeDays); whether TODAY nudges is display policy that belongs in
// the Review UI, not a Workspace operation (workspace.md's facts-vs-behavior
// split). A standalone module (not exported alongside the ReviewPage
// component) so the integration seam can exercise the same computation
// against a real Dexie-backed Workspace without rendering React.
export function computeBackupNudge(
  health: Pick<StorageHealth, 'lastExportAt'>,
  backupNudgeDays: number,
): { neverExported: boolean } | null {
  if (health.lastExportAt === undefined) return { neverExported: true }
  const staleMs = backupNudgeDays * 24 * 60 * 60 * 1000
  if (Date.now() - health.lastExportAt > staleMs) return { neverExported: false }
  return null
}
