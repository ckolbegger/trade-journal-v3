import { useEffect, useState } from 'react'
import { useJournal } from '../journalContext'
import { PromptFields } from '../components/PromptFields'
import { collectAnswers, type PromptValues } from '../components/prompt-answers'
import { btnPrimary, field, heading, input } from '../styles'
import type { Entry, EntryType } from '@/books/journal/types'

// Standalone journal writing: the trader picks any non-archived Entry Type
// freely — no lifecycle moment dictates it — and answers its prompts. There is
// no skip/placeholder path here: standalone writing is voluntary, and Journal
// Debt exists only for required lifecycle entries (ADR 0006).

export function NewEntryPage({
  onSaved,
}: {
  onSaved: (entry: Entry, entryTypeName: string) => void
}) {
  const journal = useJournal()
  const [entryTypes, setEntryTypes] = useState<EntryType[] | null>(null)
  const [entryTypeId, setEntryTypeId] = useState('')
  const [values, setValues] = useState<PromptValues>({})

  useEffect(() => {
    let active = true
    journal.entryTypes.list().then((types) => {
      if (active) setEntryTypes(types)
    })
    return () => {
      active = false
    }
  }, [journal])

  if (!entryTypes) return <p>Loading…</p>

  const entryType = entryTypes.find((t) => t.id === entryTypeId) ?? null

  async function save() {
    if (!entryType) return
    const at = Date.now()
    const answers = collectAnswers(entryType.prompts, values)
    const id = await journal.write({
      anchor: { kind: 'standalone' },
      entryTypeId: entryType.id,
      at,
      answers,
      placeholder: false,
    })
    const entry: Entry = {
      id,
      at,
      anchor: { kind: 'standalone' },
      entryTypeId: entryType.id,
      answered: entryType.prompts.map((prompt) => {
        const answer = answers.find((a) => a.promptId === prompt.id)
        return answer ? { prompt, answer } : { prompt }
      }),
      placeholder: false,
    }
    onSaved(entry, entryType.name)
  }

  return (
    <section className="space-y-4">
      <h2 className={heading}>New entry</h2>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <label className={field}>
          Entry Type
          <select
            className={input}
            value={entryTypeId}
            onChange={(e) => {
              setEntryTypeId(e.target.value)
              setValues({})
            }}
          >
            <option value="">Choose…</option>
            {entryTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </label>

        {entryType && (
          <PromptFields
            prompts={entryType.prompts}
            values={values}
            onChange={(id, value) => setValues((prev) => ({ ...prev, [id]: value }))}
            namespace="new-entry"
          />
        )}

        <button type="submit" className={btnPrimary} disabled={!entryType}>
          Save entry
        </button>
      </form>
    </section>
  )
}
