import { useState } from 'react'
import { PromptFields } from './PromptFields'
import type { PromptValues } from './prompt-answers'
import { btnPrimary } from '../styles'
import type { Entry } from '@/books/journal/types'

// Completing an owed placeholder — answers land against the prompts the ENTRY
// snapshotted at creation, not today's Entry Type (ADR 0007). Shared by the
// Daily Review walk (WalkCheckpoint) and the Journal timeline — both offer the
// same inline settle affordance wherever a placeholder is shown.

export function SettleForm({
  entry,
  onSettle,
}: {
  entry: Entry
  onSettle: (values: PromptValues) => void
}) {
  const [values, setValues] = useState<PromptValues>({})

  return (
    <li className="space-y-3">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          onSettle(values)
        }}
      >
        <PromptFields
          prompts={entry.answered.map((a) => a.prompt)}
          values={values}
          namespace={`settle-${entry.id}`}
          onChange={(id, value) => setValues((prev) => ({ ...prev, [id]: value }))}
        />
        <button type="submit" className={btnPrimary}>
          Settle entry
        </button>
      </form>
    </li>
  )
}
