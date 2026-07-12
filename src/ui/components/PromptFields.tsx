import { field, input } from '../styles'
import type { PromptValues } from './prompt-answers'
import type { Prompt } from '@/books/journal/types'

// The entry-form widgets for a snapshotted prompt list — text, select, scale.
// Journal entries are written against prompts (from the Entry Type) and settled
// against prompts (from the entry's own snapshot, ADR 0007), so both forms render
// the same widgets from whatever prompt list they are handed.

export function PromptFields({
  prompts,
  values,
  onChange,
  namespace,
}: {
  prompts: Prompt[]
  values: PromptValues
  onChange: (promptId: string, value: string | number) => void
  namespace: string // keeps scale radio groups distinct when several forms coexist
}) {
  return (
    <>
      {prompts.map((prompt) => {
        if (prompt.kind === 'text') {
          return (
            <label key={prompt.id} className={field}>
              {prompt.text}
              <textarea
                className={input}
                rows={2}
                value={(values[prompt.id] as string) ?? ''}
                onChange={(e) => onChange(prompt.id, e.target.value)}
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
                onChange={(e) => onChange(prompt.id, e.target.value)}
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
        const { min, max } = prompt.scale!
        const steps: number[] = []
        for (let n = min; n <= max; n++) steps.push(n)
        return (
          <fieldset key={prompt.id} className="space-y-2 rounded-lg border border-slate-200 p-3">
            <legend className="px-1 text-sm font-medium text-slate-700">{prompt.text}</legend>
            <div className="flex flex-wrap gap-3">
              {steps.map((n) => (
                <label key={n} className="flex items-center gap-1.5 text-sm text-slate-700">
                  <input
                    type="radio"
                    name={`${namespace}-${prompt.id}`}
                    value={n}
                    checked={values[prompt.id] === n}
                    onChange={() => onChange(prompt.id, n)}
                  />
                  {n}
                </label>
              ))}
            </div>
          </fieldset>
        )
      })}
    </>
  )
}
