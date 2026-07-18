import { useRef, useState } from 'react'
import { useWorkspace } from '../workspaceContext'
import { btnPrimary, btnSecondary } from '../styles'
import { todayISO } from '../format'
import type { ImportReport } from '@/workspace/workspace'

// Restore is replace-only (workspace.md) — picking a file never restores
// silently. It requires explicit confirmation naming the replacement, offers
// a safety export of current data first, and shows the ImportReport (or the
// rejection reason) on completion. Shared by Backup settings and onboarding's
// "returning trader with a backup file" path (S6.2).
export function RestoreFlow({ onRestored }: { onRestored?: (report: ImportReport) => void }) {
  const workspace = useWorkspace()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [report, setReport] = useState<ImportReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setError(null)
      setReport(null)
      setPendingFile(file)
    }
    e.target.value = ''
  }

  async function safetyExport() {
    const blob = await workspace.exportAll()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `trade-journal-${todayISO()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function confirmRestore() {
    if (!pendingFile) return
    const file = pendingFile
    try {
      const result = await workspace.importAll(file)
      setPendingFile(null)
      setReport(result)
      onRestored?.(result)
    } catch (err) {
      setPendingFile(null)
      setError(err instanceof Error ? err.message : 'Restore failed.')
    }
  }

  function cancel() {
    setPendingFile(null)
  }

  const restoredCount = report
    ? Object.values(report.counts).reduce((total, count) => total + count, 0)
    : 0

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        aria-label="Backup file"
        onChange={onFileChosen}
      />
      <button type="button" className={btnSecondary} onClick={() => fileInputRef.current?.click()}>
        Restore from backup…
      </button>

      {pendingFile && (
        <div className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-3">
          <p className="text-sm text-slate-700">
            Restoring <strong>{pendingFile.name}</strong> will replace all current data — every
            Trade, journal entry, and setting — with the contents of this file. This cannot be
            undone.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnSecondary} onClick={() => void safetyExport()}>
              Export current data first
            </button>
            <button type="button" className={btnPrimary} onClick={() => void confirmRestore()}>
              Replace all data
            </button>
            <button type="button" className={btnSecondary} onClick={cancel}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {report && (
        <p className="text-sm text-slate-700">
          Restored {restoredCount} record{restoredCount === 1 ? '' : 's'}.
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
