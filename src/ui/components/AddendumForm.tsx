import { useEffect, useState } from 'react'
import { useJournal } from '../journalContext'
import { PromptFields } from './PromptFields'
import { collectAnswers, type PromptValues } from './prompt-answers'
import { btnPrimary, btnSecondary, field, input } from '../styles'
import { ADDENDUM_ENTRY_TYPE_ID } from '@/workspace/workspace'
import type { Entry, EntryType } from '@/books/journal/types'

// Growing an immutable entry: an addendum is an ordinary Entry anchored
// {kind:'entry'} to its parent — no extra operation (journal.md: "editing an
// entry is intentionally impossible"). The form defaults to the parent's own
// Entry Type (so an addendum can answer the same prompts) with a free-text-
// only fallback for anything that doesn't fit that shape.

export function AddendumForm({
  parent,
  onSaved,
  onCancel,
}: {
  parent: Entry
  onSaved: () => void
  onCancel: () => void
}) {
  const journal = useJournal()
  const [parentType, setParentType] = useState<EntryType | null>(null)
  const [fallbackType, setFallbackType] = useState<EntryType | null>(null)
  const [useFallback, setUseFallback] = useState(false)
  const [values, setValues] = useState<PromptValues>({})

  useEffect(() => {
    let active = true
    journal.entryTypes.list(true).then((types) => {
      if (!active) return
      setParentType(types.find((t) => t.id === parent.entryTypeId) ?? null)
      setFallbackType(types.find((t) => t.id === ADDENDUM_ENTRY_TYPE_ID) ?? null)
    })
    return () => {
      active = false
    }
  }, [journal, parent.entryTypeId])

  if (!parentType || !fallbackType) return <p>Loading…</p>

  const offersFallback = fallbackType.id !== parentType.id
  const entryType = useFallback && offersFallback ? fallbackType : parentType

  async function save() {
    const answers = collectAnswers(entryType.prompts, values)
    await journal.write({
      anchor: { kind: 'entry', entryId: parent.id },
      entryTypeId: entryType.id,
      at: Date.now(),
      answers,
      placeholder: false,
    })
    onSaved()
  }

  return (
    <form
      aria-label="add addendum"
      className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      {offersFallback && (
        <label className={field}>
          Entry Type
          <select
            className={input}
            value={entryType.id}
            onChange={(e) => {
              setUseFallback(e.target.value === fallbackType.id)
              setValues({})
            }}
          >
            <option value={parentType.id}>{parentType.name}</option>
            <option value={fallbackType.id}>{fallbackType.name}</option>
          </select>
        </label>
      )}

      <PromptFields
        prompts={entryType.prompts}
        values={values}
        onChange={(id, value) => setValues((prev) => ({ ...prev, [id]: value }))}
        namespace={`addendum-${parent.id}`}
      />

      <div className="flex gap-2">
        <button type="submit" className={btnPrimary}>
          Save addendum
        </button>
        <button type="button" className={btnSecondary} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
