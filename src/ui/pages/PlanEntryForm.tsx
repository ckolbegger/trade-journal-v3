import { useEffect, useState } from 'react'
import { useJournal } from '../journalContext'
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
    <section>
      <h2>Plan journal</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void writeNow()
        }}
      >
        {entryType.prompts.map((prompt) => {
          if (prompt.kind === 'text') {
            return (
              <label key={prompt.id}>
                {prompt.text}
                <textarea
                  value={(values[prompt.id] as string) ?? ''}
                  onChange={(e) => setValue(prompt.id, e.target.value)}
                />
              </label>
            )
          }
          if (prompt.kind === 'select') {
            return (
              <label key={prompt.id}>
                {prompt.text}
                <select
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
            <fieldset key={prompt.id}>
              <legend>{prompt.text}</legend>
              {steps.map((n) => (
                <label key={n}>
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
            </fieldset>
          )
        })}

        <button type="submit">Write journal entry</button>
        <button type="button" onClick={() => void skip()}>
          Skip
        </button>
      </form>
    </section>
  )
}
