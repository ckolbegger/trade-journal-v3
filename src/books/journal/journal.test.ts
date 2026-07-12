import { describe, it, expect } from 'vitest'
import { InMemoryBinding } from '@/storage/in-memory-binding'
import { Journal } from './journal'
import type { Entry, EntryDraft, EntryType } from './types'

const PLAN_TYPE: EntryType = {
  id: 'plan-type',
  name: 'Plan',
  designatedFor: 'plan',
  prompts: [
    { id: 'why', text: 'Why this trade, why now?', kind: 'text' },
    { id: 'invalidates', text: 'What invalidates the thesis?', kind: 'text' },
    { id: 'conviction', text: 'Conviction', kind: 'scale', scale: { min: 1, max: 5 } },
    {
      id: 'emotion',
      text: 'Emotional state',
      kind: 'select',
      options: ['calm', 'eager', 'anxious', 'FOMO', 'revenge'],
    },
  ],
}

async function journalWithPlanType(): Promise<Journal> {
  const journal = new Journal(new InMemoryBinding())
  await journal.entryTypes.save({ ...PLAN_TYPE })
  return journal
}

function fullDraft(tradeId: string): EntryDraft {
  return {
    anchor: { kind: 'plan', tradeId },
    entryTypeId: PLAN_TYPE.id,
    at: 1_700_000_000_000,
    placeholder: false,
    answers: [
      { promptId: 'why', value: 'Breakout confirmed on volume' },
      { promptId: 'invalidates', value: 'Close back below 145' },
      { promptId: 'conviction', value: 4 },
      { promptId: 'emotion', value: 'calm' },
    ],
  }
}

function placeholderDraft(tradeId: string): EntryDraft {
  return {
    anchor: { kind: 'plan', tradeId },
    entryTypeId: PLAN_TYPE.id,
    at: 1_700_000_000_000,
    placeholder: true,
    answers: [],
  }
}

describe('Journal.write', () => {
  it('stores an entry with answers snapshotting the prompts as asked', async () => {
    const journal = await journalWithPlanType()
    const id = await journal.write(fullDraft('t1'))
    const [entry] = await journal.entriesFor({ trade: 't1' })

    expect(entry.id).toBe(id)
    expect(entry.placeholder).toBe(false)
    expect(entry.answered.map((a) => a.prompt.id)).toEqual([
      'why',
      'invalidates',
      'conviction',
      'emotion',
    ])
    expect(entry.answered.find((a) => a.prompt.id === 'conviction')?.answer).toEqual({
      promptId: 'conviction',
      value: 4,
    })
    expect(entry.answered.find((a) => a.prompt.id === 'emotion')?.answer).toEqual({
      promptId: 'emotion',
      value: 'calm',
    })
  })

  it('stores a placeholder with prompts snapshotted and placeholder=true', async () => {
    const journal = await journalWithPlanType()
    await journal.write(placeholderDraft('t1'))
    const [entry] = await journal.entriesFor({ trade: 't1' })

    expect(entry.placeholder).toBe(true)
    expect(entry.answered.map((a) => a.prompt.id)).toEqual([
      'why',
      'invalidates',
      'conviction',
      'emotion',
    ])
    expect(entry.answered.every((a) => a.answer === undefined)).toBe(true)
  })

  it('rejects an answer to a prompt id not in the Entry Type', async () => {
    const journal = await journalWithPlanType()
    const draft = fullDraft('t1')
    draft.answers.push({ promptId: 'ghost', value: 'x' })
    await expect(journal.write(draft)).rejects.toThrow()
  })

  it('rejects a select answer not among the prompt options', async () => {
    const journal = await journalWithPlanType()
    const draft = fullDraft('t1')
    draft.answers = [{ promptId: 'emotion', value: 'ecstatic' }]
    await expect(journal.write(draft)).rejects.toThrow()
  })

  it('rejects a scale answer outside the prompt min..max', async () => {
    const journal = await journalWithPlanType()
    const draft = fullDraft('t1')
    draft.answers = [{ promptId: 'conviction', value: 6 }]
    await expect(journal.write(draft)).rejects.toThrow()
  })

  it("records 'at' as the lifecycle moment's timestamp", async () => {
    const journal = await journalWithPlanType()
    const draft = fullDraft('t1')
    draft.at = 1_712_000_000_000
    await journal.write(draft)
    const [entry] = await journal.entriesFor({ trade: 't1' })
    expect(entry.at).toBe(1_712_000_000_000)
  })
})

const REFLECTION_TYPE: EntryType = {
  id: 'reflection-type',
  name: 'Trader Reflection',
  prompts: [
    { id: 'mind', text: "What's on your mind?", kind: 'text' },
    {
      id: 'emotion',
      text: 'Current emotional state',
      kind: 'select',
      options: ['calm', 'eager', 'anxious', 'FOMO', 'revenge'],
    },
    { id: 'energy', text: 'Energy', kind: 'scale', scale: { min: 1, max: 5 } },
  ],
}

describe('Journal.write (standalone)', () => {
  it("stores an entry anchored {kind:'standalone'} with no tradeId", async () => {
    const binding = new InMemoryBinding()
    const journal = new Journal(binding)
    await journal.entryTypes.save({ ...REFLECTION_TYPE })

    await journal.write({
      anchor: { kind: 'standalone' },
      entryTypeId: REFLECTION_TYPE.id,
      at: 1_700_000_000_000,
      placeholder: false,
      answers: [{ promptId: 'mind', value: 'Market feels frothy today' }],
    })

    const [entry] = await binding.list<Entry>('entries')
    expect(entry.anchor).toEqual({ kind: 'standalone' })
    expect((entry.anchor as { tradeId?: string }).tradeId).toBeUndefined()
  })

  it("snapshots the chosen Entry Type's prompts as answered", async () => {
    const binding = new InMemoryBinding()
    const journal = new Journal(binding)
    await journal.entryTypes.save({ ...REFLECTION_TYPE })

    await journal.write({
      anchor: { kind: 'standalone' },
      entryTypeId: REFLECTION_TYPE.id,
      at: 1_700_000_000_000,
      placeholder: false,
      answers: [
        { promptId: 'mind', value: 'Market feels frothy today' },
        { promptId: 'emotion', value: 'anxious' },
        { promptId: 'energy', value: 3 },
      ],
    })

    const [entry] = await binding.list<Entry>('entries')
    expect(entry.answered.map((a) => a.prompt.id)).toEqual(['mind', 'emotion', 'energy'])
    expect(entry.answered.find((a) => a.prompt.id === 'mind')?.answer).toEqual({
      promptId: 'mind',
      value: 'Market feels frothy today',
    })
    expect(entry.answered.find((a) => a.prompt.id === 'emotion')?.answer).toEqual({
      promptId: 'emotion',
      value: 'anxious',
    })
    expect(entry.answered.find((a) => a.prompt.id === 'energy')?.answer).toEqual({
      promptId: 'energy',
      value: 3,
    })
  })
})

describe('Journal.entriesFor / countFor', () => {
  it('returns entries anchored {kind:plan} for the Trade', async () => {
    const journal = await journalWithPlanType()
    await journal.write(fullDraft('t1'))
    await journal.write(placeholderDraft('t2'))

    const entries = await journal.entriesFor({ trade: 't1' })
    expect(entries).toHaveLength(1)
    expect(entries[0].anchor).toEqual({ kind: 'plan', tradeId: 't1' })
  })

  it("returns entries in 'at' order", async () => {
    const journal = await journalWithPlanType()
    const later = fullDraft('t1')
    later.at = 2_000
    await journal.write(later)
    const earlier = placeholderDraft('t1')
    earlier.at = 1_000
    await journal.write(earlier)

    const entries = await journal.entriesFor({ trade: 't1' })
    expect(entries.map((e) => e.at)).toEqual([1_000, 2_000])
  })

  it("counts a Trade's entries", async () => {
    const journal = await journalWithPlanType()
    await journal.write(fullDraft('t1'))
    await journal.write(placeholderDraft('t1'))
    expect(await journal.countFor('t1')).toBe(2)
  })

  it('returns nothing for a Trade with no entries', async () => {
    const journal = await journalWithPlanType()
    expect(await journal.entriesFor({ trade: 'nobody' })).toEqual([])
    expect(await journal.countFor('nobody')).toBe(0)
  })
})

describe('entry immutability', () => {
  it('exposes no operation that edits a written entry answers', async () => {
    const journal = await journalWithPlanType()
    await journal.write(fullDraft('t1'))

    const ops = Object.getOwnPropertyNames(Object.getPrototypeOf(journal))
    expect(ops).not.toContain('edit')
    expect(ops).not.toContain('update')

    // A returned entry is a copy — mutating it never changes the stored record.
    const [entry] = await journal.entriesFor({ trade: 't1' })
    entry.answered[0].answer = { promptId: 'why', value: 'rewritten' }
    entry.placeholder = true
    const [again] = await journal.entriesFor({ trade: 't1' })
    expect(again.answered[0].answer).toEqual({
      promptId: 'why',
      value: 'Breakout confirmed on volume',
    })
    expect(again.placeholder).toBe(false)
  })
})

describe('Journal.outstandingDebt', () => {
  it('returns unsettled placeholders only', async () => {
    const journal = await journalWithPlanType()
    const owed = await journal.write(placeholderDraft('t1'))
    await journal.write(placeholderDraft('t2'))

    const debt = await journal.outstandingDebt()

    expect(debt.map((e) => e.id)).toContain(owed)
    expect(debt).toHaveLength(2)
    expect(debt.every((e) => e.placeholder)).toBe(true)
  })

  it('excludes full entries', async () => {
    const journal = await journalWithPlanType()
    await journal.write(fullDraft('t1'))
    const owed = await journal.write(placeholderDraft('t2'))

    const debt = await journal.outstandingDebt()

    expect(debt.map((e) => e.id)).toEqual([owed])
  })

  it('returns nothing when no entry was skipped', async () => {
    const journal = await journalWithPlanType()
    await journal.write(fullDraft('t1'))

    expect(await journal.outstandingDebt()).toEqual([])
  })
})
