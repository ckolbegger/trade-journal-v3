import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PromptFields } from './PromptFields'
import type { Prompt } from '@/books/journal/types'
import type { PromptValues } from './prompt-answers'

// S1.9.T2.2 — a select prompt's options carry a stable id alongside the
// display label; the widget records the id, not the label (docs/design's
// rename-survivability ruling, ADR 0007). UX.7 replaced the select's
// rendering with option chips (radio inputs) — the id/label distinction
// still holds, only the widget changed.

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
  it('renders one chip per option, named by the option label', () => {
    render(<Harness prompt={ACTION_PROMPT} />)

    expect(screen.getByRole('radio', { name: 'Hold' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Exit Soon' })).toBeInTheDocument()
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

    await userEvent.click(screen.getByRole('radio', { name: 'Hold' }))

    expect(recorded).toBe('opt-hold')
  })

  it('checks the chip for a stored option id', () => {
    render(<Harness prompt={ACTION_PROMPT} initial={{ action: 'opt-exit' }} />)

    expect(screen.getByRole('radio', { name: 'Exit Soon' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Hold' })).not.toBeChecked()
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

    expect(screen.getByRole('radio', { name: 'Keep Holding' })).toBeChecked()
  })
})

// UX.7 — a select prompt now renders as option chips: radio inputs grouped in
// a <fieldset> whose <legend> is the prompt text, matching how scale prompts
// already group their radios (S1.9). Seeded option ids equal their labels
// (workspace.ts), so a chip's accessible name is the raw option label.
describe('PromptFields select prompts as chips', () => {
  const FEELING_PROMPT: Prompt = {
    id: 'emotion',
    text: 'Emotional state',
    kind: 'select',
    options: [
      { id: 'calm', label: 'calm' },
      { id: 'eager', label: 'eager' },
      { id: 'anxious', label: 'anxious' },
      { id: 'FOMO', label: 'FOMO' },
      { id: 'revenge', label: 'revenge' },
    ],
  }

  it('renders one radio per option, named by the option label', () => {
    render(<Harness prompt={FEELING_PROMPT} />)

    expect(screen.getByRole('radio', { name: 'calm' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'eager' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'anxious' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'FOMO' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'revenge' })).toBeInTheDocument()
  })

  it('groups the radios in a fieldset whose legend is the prompt text', () => {
    render(<Harness prompt={FEELING_PROMPT} />)

    const group = screen.getByRole('group', { name: 'Emotional state' })
    expect(within(group).getByRole('radio', { name: 'calm' })).toBeInTheDocument()
  })

  it('selects no option initially', () => {
    render(<Harness prompt={FEELING_PROMPT} />)

    for (const name of ['calm', 'eager', 'anxious', 'FOMO', 'revenge']) {
      expect(screen.getByRole('radio', { name })).not.toBeChecked()
    }
  })

  it('reports the chosen option id through onChange when a chip is clicked', async () => {
    const onChange = vi.fn()
    render(
      <PromptFields
        prompts={[FEELING_PROMPT]}
        values={{}}
        namespace="record"
        onChange={onChange}
      />,
    )

    await userEvent.click(screen.getByRole('radio', { name: 'eager' }))

    expect(onChange).toHaveBeenCalledWith('emotion', 'eager')
  })

  it('marks only the chosen chip as checked', () => {
    render(<Harness prompt={FEELING_PROMPT} initial={{ emotion: 'anxious' }} />)

    expect(screen.getByRole('radio', { name: 'anxious' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'calm' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: 'eager' })).not.toBeChecked()
  })

  it('replaces the previous choice when a second chip is clicked', async () => {
    render(<Harness prompt={FEELING_PROMPT} initial={{ emotion: 'calm' }} />)

    await userEvent.click(screen.getByRole('radio', { name: 'FOMO' }))

    expect(screen.getByRole('radio', { name: 'FOMO' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'calm' })).not.toBeChecked()
  })

  it('keeps radio groups distinct when two select prompts share a form', async () => {
    const OTHER_PROMPT: Prompt = {
      id: 'again',
      text: 'Would you take this trade again?',
      kind: 'select',
      options: [
        { id: 'yes', label: 'yes' },
        { id: 'no', label: 'no' },
      ],
    }
    function TwoPrompts() {
      const [values, setValues] = useState<PromptValues>({})
      return (
        <PromptFields
          prompts={[FEELING_PROMPT, OTHER_PROMPT]}
          values={values}
          namespace="two"
          onChange={(id, value) => setValues((prev) => ({ ...prev, [id]: value }))}
        />
      )
    }
    render(<TwoPrompts />)

    await userEvent.click(screen.getByRole('radio', { name: 'calm' }))
    await userEvent.click(screen.getByRole('radio', { name: 'yes' }))

    expect(screen.getByRole('radio', { name: 'calm' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'yes' })).toBeChecked()
    // Checking one group's option never checks another id-alike option in
    // the other group (they don't share a name attribute).
    expect(screen.getByRole('radio', { name: 'no' })).not.toBeChecked()
  })

  it('renders text and scale prompts unchanged alongside a select prompt', () => {
    const prompts: Prompt[] = [
      { id: 'why', text: 'Why this trade, why now?', kind: 'text' },
      { id: 'conviction', text: 'Conviction', kind: 'scale', scale: { min: 1, max: 3 } },
      FEELING_PROMPT,
    ]
    function ThreePrompts() {
      const [values, setValues] = useState<PromptValues>({})
      return (
        <PromptFields
          prompts={prompts}
          values={values}
          namespace="three"
          onChange={(id, value) => setValues((prev) => ({ ...prev, [id]: value }))}
        />
      )
    }
    render(<ThreePrompts />)

    expect(screen.getByLabelText('Why this trade, why now?')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '2' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'calm' })).toBeInTheDocument()
  })
})
