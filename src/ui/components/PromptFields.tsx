import { field, input, promptGroup, promptLegend, chip, chipSelected } from '../styles'
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
            <fieldset key={prompt.id} className={promptGroup}>
              <legend className={promptLegend}>{prompt.text}</legend>
              <div className="flex flex-wrap gap-2">
                {prompt.options?.map((option) => {
                  const checked = values[prompt.id] === option.id
                  return (
                    <label key={option.id} className={`relative ${checked ? chipSelected : chip}`}>
                      <input
                        type="radio"
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        name={`${namespace}-${prompt.id}`}
                        value={option.id}
                        checked={checked}
                        onChange={() => onChange(prompt.id, option.id)}
                      />
                      <span className="capitalize">{option.label}</span>
                    </label>
                  )
                })}
              </div>
            </fieldset>
          )
        }
        const { min, max } = prompt.scale!
        const steps: number[] = []
        for (let n = min; n <= max; n++) steps.push(n)
        return (
          <fieldset key={prompt.id} className={promptGroup}>
            <legend className={promptLegend}>{prompt.text}</legend>
            <div className="flex flex-wrap gap-3">
              {steps.map((n) => (
                <label key={n} className="flex items-center gap-1.5 text-sm text-stone-700">
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
