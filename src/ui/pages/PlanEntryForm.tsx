import { useEffect, useState } from 'react'
import { useJournal } from '../journalContext'
import { btnPrimary, btnSecondary, field, heading, input } from '../styles'
import type { EntryType, PromptAnswer } from '@/books/journal/types'

// Shown right after a Plan is confirmed: the seeded Plan prompts. The trader may
// answer them now (Write) or Skip — a skip writes a TBD placeholder silently and
// is one click, never blocking the flow (Journal Debt, ADR 0006). Prompts are
// snapshotted into the entry on write (ADR 0007).

export function PlanEntryForm({ tradeId, onDone }: { tradeId: string; onDone: () => void }) {
  const journal = useJournal()
  const [entryType, setEntryType] = useState<EntryType | null>(null)
  const [values, setValues] = useState<Record<string, string | number>>({})

  useEffect(() => {
    let active = true
    journal.entryTypes.list().then((types) => {
      if (!active) return
      setEntryType(types.find((t) => t.designatedFor === 'plan') ?? null)
    })
    return () => {
      active = false
    }
  }, [journal])

  if (!entryType) return <p>Loading…</p>

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

  async function writeNow() {
    await journal.write({
      anchor: { kind: 'plan', tradeId },
      entryTypeId: entryType!.id,
      at: Date.now(),
      answers: collectAnswers(entryType!),
      placeholder: false,
    })
    onDone()
  }

  async function skip() {
    await journal.write({
      anchor: { kind: 'plan', tradeId },
      entryTypeId: entryType!.id,
      at: Date.now(),
      answers: [],
      placeholder: true,
    })
    onDone()
  }

  return (
    <section className="space-y-4">
      <h2 className={heading}>Plan journal</h2>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void writeNow()
        }}
      >
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
          if (prompt.kind === 'select') {
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
          }
          // scale
          const { min, max } = prompt.scale!
          const steps = []
          for (let n = min; n <= max; n++) steps.push(n)
          return (
            <fieldset key={prompt.id} className="space-y-2 rounded-lg border border-slate-200 p-4">
              <legend className="px-1 text-sm font-medium text-slate-700">{prompt.text}</legend>
              <div className="flex flex-wrap gap-3">
                {steps.map((n) => (
                  <label key={n} className="flex items-center gap-1.5 text-sm text-slate-700">
                    <input
                      type="radio"
                      name={prompt.id}
                      value={n}
                      checked={values[prompt.id] === n}
                      onChange={() => setValue(prompt.id, n)}
                    />
                    {n}
                  </label>
                ))}
              </div>
            </fieldset>
          )
        })}

        <div className="flex items-center gap-2">
          <button type="submit" className={btnPrimary}>
            Write journal entry
          </button>
          <button type="button" className={btnSecondary} onClick={() => void skip()}>
            Skip
          </button>
        </div>
      </form>
    </section>
  )
}
