import { useEffect, useState } from 'react'
import { useJournal } from '../journalContext'
import { PromptFields } from '../components/PromptFields'
import { btnPrimary, btnSecondary, heading } from '../styles'
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
        <PromptFields
          prompts={entryType.prompts}
          values={values}
          namespace="plan-entry"
          onChange={setValue}
        />

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
