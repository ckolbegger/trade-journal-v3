import { describe, it, expect } from 'vitest'
import { InMemoryBinding } from '@/storage/in-memory-binding'
import { Journal } from './journal'
import type { EntryDraft, EntryType } from './types'

// Settling a placeholder is completion, not editing: the answers land against the
// prompts as they were SNAPSHOTTED at the lifecycle moment (ADR 0007), and both
// timestamps survive — `at` (the moment it belonged to) and `settledAt` (when the
// trader finally wrote it), so "how late do I journal?" stays queryable.

const PLAN_TYPE: EntryType = {
  id: 'plan-type',
  name: 'Plan',
  designatedFor: 'plan',
  prompts: [
    { id: 'why', text: 'Why this trade, why now?', kind: 'text' },
    { id: 'conviction', text: 'Conviction', kind: 'scale', scale: { min: 1, max: 5 } },
  ],
}

const PLAN_MOMENT = 1_700_000_000_000

async function journalWithPlanType(): Promise<Journal> {
  const journal = new Journal(new InMemoryBinding())
  await journal.entryTypes.save({ ...PLAN_TYPE })
  return journal
}

function placeholderDraft(tradeId: string): EntryDraft {
  return {
    anchor: { kind: 'plan', tradeId },
    entryTypeId: PLAN_TYPE.id,
    at: PLAN_MOMENT,
    placeholder: true,
    answers: [],
  }
}

function fullDraft(tradeId: string): EntryDraft {
  return {
    anchor: { kind: 'plan', tradeId },
    entryTypeId: PLAN_TYPE.id,
    at: PLAN_MOMENT,
    placeholder: false,
    answers: [{ promptId: 'why', value: 'Breakout confirmed on volume' }],
  }
}

describe('Journal.settle', () => {
  it("stores answers against the placeholder's snapshotted prompts", async () => {
    const journal = await journalWithPlanType()
    const owed = await journal.write(placeholderDraft('t1'))

    // The Entry Type changed after the placeholder was written — the trader still
    // answers the questions as they were asked at the lifecycle moment.
    await journal.entryTypes.save({
      ...PLAN_TYPE,
      prompts: [{ id: 'lesson', text: 'Lesson', kind: 'text' }],
    })

    await journal.settle(owed, [
      { promptId: 'why', value: 'Breakout confirmed on volume' },
      { promptId: 'conviction', value: 4 },
    ])

    const [entry] = await journal.entriesFor({ trade: 't1' })
    expect(entry.answered.map((a) => a.prompt.id)).toEqual(['why', 'conviction'])
    expect(entry.answered.find((a) => a.prompt.id === 'why')?.answer).toEqual({
      promptId: 'why',
      value: 'Breakout confirmed on volume',
    })
    expect(entry.answered.find((a) => a.prompt.id === 'conviction')?.answer).toEqual({
      promptId: 'conviction',
      value: 4,
    })
  })

  it('keeps both at and settledAt', async () => {
    const journal = await journalWithPlanType()
    const owed = await journal.write(placeholderDraft('t1'))

    await journal.settle(owed, [{ promptId: 'why', value: 'late but honest' }])

    const [entry] = await journal.entriesFor({ trade: 't1' })
    expect(entry.at).toBe(PLAN_MOMENT)
    expect(entry.settledAt).toBeGreaterThan(PLAN_MOMENT)
  })

  it('rejects settling a non-placeholder entry', async () => {
    const journal = await journalWithPlanType()
    const written = await journal.write(fullDraft('t1'))

    await expect(
      journal.settle(written, [{ promptId: 'why', value: 'rewritten' }]),
    ).rejects.toThrow()
  })

  it('rejects settling twice', async () => {
    const journal = await journalWithPlanType()
    const owed = await journal.write(placeholderDraft('t1'))
    await journal.settle(owed, [{ promptId: 'why', value: 'first' }])

    await expect(journal.settle(owed, [{ promptId: 'why', value: 'second' }])).rejects.toThrow()
  })

  it('makes the entry disappear from outstandingDebt()', async () => {
    const journal = await journalWithPlanType()
    const owed = await journal.write(placeholderDraft('t1'))
    const stillOwed = await journal.write(placeholderDraft('t2'))

    await journal.settle(owed, [{ promptId: 'why', value: 'settled at review' }])

    const debt = await journal.outstandingDebt()
    expect(debt.map((e) => e.id)).toEqual([stillOwed])
  })

  it('outstandingDebt() excludes settled placeholders', async () => {
    const journal = await journalWithPlanType()
    const owed = await journal.write(placeholderDraft('t1'))
    await journal.settle(owed, [{ promptId: 'why', value: 'settled at review' }])

    expect(await journal.outstandingDebt()).toEqual([])
    // The settled entry is still a placeholder — the debt is paid, not erased:
    // `at` vs `settledAt` remains the late-journaling record.
    const [entry] = await journal.entriesFor({ trade: 't1' })
    expect(entry.placeholder).toBe(true)
    expect(entry.settledAt).toBeDefined()
  })
})
