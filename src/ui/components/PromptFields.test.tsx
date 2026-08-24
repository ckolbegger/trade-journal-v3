import { useState } from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PromptFields } from './PromptFields'
import type { Prompt } from '@/books/journal/types'
import type { PromptValues } from './prompt-answers'

// S1.9.T2.2 — a select prompt's options carry a stable id alongside the
// display label; the widget records the id, not the label (docs/design's
// rename-survivability ruling, ADR 0007).

const ACTION_PROMPT: Prompt = {
  id: 'action',
  text: 'Action',
  kind: 'select',
  options: [
    { id: 'opt-hold', label: 'Hold' },
    { id: 'opt-exit', label: 'Exit Soon' },
  ],
}

function Harness({ prompt, initial }: { prompt: Prompt; initial?: PromptValues }) {
  const [values, setValues] = useState<PromptValues>(initial ?? {})
  return (
    <PromptFields
      prompts={[prompt]}
      values={values}
      namespace="harness"
      onChange={(id, value) => setValues((prev) => ({ ...prev, [id]: value }))}
    />
  )
}

describe('Prompt options', () => {
  it('carries a stable id alongside the display label', () => {
    render(<Harness prompt={ACTION_PROMPT} />)

    const select = screen.getByRole('combobox', { name: 'Action' }) as HTMLSelectElement
    const rendered = Array.from(select.options).map((option) => ({
      value: option.value,
      text: option.text,
    }))

    expect(rendered).toEqual([
      { value: '', text: 'Choose…' },
      { value: 'opt-hold', text: 'Hold' },
      { value: 'opt-exit', text: 'Exit Soon' },
    ])
  })

  it('stores a select answer as the option id, not the label', async () => {
    let recorded: string | number | undefined
    render(
      <PromptFields
        prompts={[ACTION_PROMPT]}
        values={{}}
        namespace="record"
        onChange={(_id, value) => {
          recorded = value
        }}
      />,
    )

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Action' }), 'Hold')

    expect(recorded).toBe('opt-hold')
  })

  it('renders the label for a stored option id', () => {
    render(<Harness prompt={ACTION_PROMPT} initial={{ action: 'opt-exit' }} />)

    const select = screen.getByRole('combobox', { name: 'Action' }) as HTMLSelectElement
    expect(select.value).toBe('opt-exit')
    expect(within(select).getByRole('option', { name: 'Exit Soon' })).toBeInTheDocument()
  })

  it("still resolves an answer after the option's label changes", () => {
    const renamed: Prompt = {
      ...ACTION_PROMPT,
      options: [
        { id: 'opt-hold', label: 'Keep Holding' }, // renamed, id unchanged
        { id: 'opt-exit', label: 'Exit Soon' },
      ],
    }
    render(<Harness prompt={renamed} initial={{ action: 'opt-hold' }} />)

    const select = screen.getByRole('combobox', { name: 'Action' }) as HTMLSelectElement
    expect(select.value).toBe('opt-hold')
    expect(screen.getByText('Keep Holding')).toBeInTheDocument()
  })
})
