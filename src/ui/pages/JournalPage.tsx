import { useState } from 'react'
import { NewEntryPage } from './NewEntryPage'
import { btnPrimary, card, heading, subheading } from '../styles'
import type { Entry } from '@/books/journal/types'

// The Journal nav destination. This slice needs only enough surface for a
// written standalone entry to be visible — the full cross-anchor timeline (all
// entries, in 'at' order, across a date range) arrives in S2.2 via
// Journal.timeline.

interface Written {
  entry: Entry
  entryTypeName: string
}

export function JournalPage() {
  const [writing, setWriting] = useState(false)
  const [written, setWritten] = useState<Written[]>([])

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className={heading}>Journal</h2>
        {!writing && (
          <button type="button" className={btnPrimary} onClick={() => setWriting(true)}>
            New entry
          </button>
        )}
      </div>

      {writing && (
        <NewEntryPage
          onSaved={(entry, entryTypeName) => {
            setWritten((prev) => [{ entry, entryTypeName }, ...prev])
            setWriting(false)
          }}
        />
      )}

      <ul className="space-y-3">
        {written.map(({ entry, entryTypeName }) => (
          <li key={entry.id} className={`${card} space-y-2`}>
            <h3 className={subheading}>{entryTypeName}</h3>
            <dl className="space-y-2">
              {entry.answered.map((a, i) => (
                <div key={i}>
                  <dt className="text-sm font-medium text-slate-700">{a.prompt.text}</dt>
                  <dd className="mt-0.5 text-sm text-slate-800">
                    {a.answer ? String(a.answer.value) : '—'}
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </section>
  )
}
