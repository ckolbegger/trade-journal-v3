import { useEffect, useState } from 'react'
import { useTradeBook } from '../tradeBookContext'
import { useJournal } from '../journalContext'
import { btnPrimary, btnSecondary, field, heading, input, subheading } from '../styles'
import type { CloseReason } from '@/books/tradebook/types'
import type { EntryType, PromptAnswer } from '@/books/journal/types'

// Shown when a fill flattens a Trade (or when abandoning a planned one): pick a
// Close Reason from the registry, then answer the Close journal prompts now
// (Record close) or skip them (Skip journal → TBD placeholder, ADR 0006). The
// reason is required either way; the whole prompt is non-blocking — Dismiss
// leaves the Trade closable later from the detail page.

export function CloseForm({
  tradeId,
  onDone,
  onDismiss,
}: {
  tradeId: string
  onDone: () => void
  onDismiss: () => void
}) {
  const tradeBook = useTradeBook()
  const journal = useJournal()
  const [reasons, setReasons] = useState<CloseReason[]>([])
  const [entryType, setEntryType] = useState<EntryType | null>(null)
  const [reasonId, setReasonId] = useState('')
  const [values, setValues] = useState<Record<string, string | number>>({})

  useEffect(() => {
    let active = true
    Promise.all([tradeBook.registries.closeReasons.list(), journal.entryTypes.list()]).then(
      ([loadedReasons, types]) => {
        if (!active) return
        setReasons(loadedReasons)
        setEntryType(types.find((t) => t.designatedFor === 'close') ?? null)
      },
    )
    return () => {
      active = false
    }
  }, [tradeBook, journal])

  function setValue(promptId: string, value: string | number) {
    setValues((prev) => ({ ...prev, [promptId]: value }))
  }

  function collectAnswers(type: EntryType): PromptAnswer[] {
    const answers: PromptAnswer[] = []
    for (const prompt of type.prompts) {
      const value = values[prompt.id]
      if (value === undefined || value === '') continue
      answers.push({ promptId: prompt.id, value })
    }
    return answers
  }

  const reason = reasons.find((r) => r.id === reasonId)

  async function close(placeholder: boolean) {
    if (!reason || !entryType) return
    await tradeBook.setCloseReason(tradeId, reason)
    await journal.write({
      anchor: { kind: 'close', tradeId },
      entryTypeId: entryType.id,
      at: Date.now(),
      answers: placeholder ? [] : collectAnswers(entryType),
      placeholder,
    })
    onDone()
  }

  return (
    <section className="space-y-4">
      <h2 className={heading}>Close this Trade</h2>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void close(false)
        }}
      >
        <label className={field}>
          Close reason
          <select className={input} value={reasonId} onChange={(e) => setReasonId(e.target.value)}>
            <option value="">Choose…</option>
            {reasons.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>

        {entryType && (
          <div className="space-y-4">
            <h3 className={subheading}>Close journal</h3>
            {entryType.prompts.map((prompt) => {
              if (prompt.kind === 'text') {
                return (
                  <label key={prompt.id} className={field}>
                    {prompt.text}
                    <textarea
                      className={input}
                      rows={3}
                      value={(values[prompt.id] as string) ?? ''}
                      onChange={(e) => setValue(prompt.id, e.target.value)}
                    />
                  </label>
                )
              }
              // select
              return (
                <label key={prompt.id} className={field}>
                  {prompt.text}
                  <select
                    className={input}
                    value={(values[prompt.id] as string) ?? ''}
                    onChange={(e) => setValue(prompt.id, e.target.value)}
                  >
                    <option value="">Choose…</option>
                    {prompt.options?.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              )
            })}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button type="submit" className={btnPrimary} disabled={!reason}>
            Record close
          </button>
          <button
            type="button"
            className={btnSecondary}
            disabled={!reason}
            onClick={() => void close(true)}
          >
            Skip journal
          </button>
          <button type="button" className={btnSecondary} onClick={onDismiss}>
            Dismiss
          </button>
        </div>
      </form>
    </section>
  )
}
