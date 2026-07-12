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

const CLOSE_TYPE: EntryType = {
  id: 'close-type',
  name: 'Close',
  designatedFor: 'close',
  prompts: [{ id: 'lesson', text: 'Lesson', kind: 'text' }],
}

const REVIEW_TYPE: EntryType = {
  id: 'review-type',
  name: 'Trade Review',
  designatedFor: 'review',
  prompts: [{ id: 'action', text: 'Action', kind: 'select', options: ['Hold', 'Exit Soon'] }],
}

describe('Journal.timeline', () => {
  it("returns all entries across anchors in 'at' order", async () => {
    const journal = await journalWithPlanType()
    await journal.entryTypes.save({ ...CLOSE_TYPE })

    await journal.write({
      anchor: { kind: 'close', tradeId: 't1' },
      entryTypeId: CLOSE_TYPE.id,
      at: 3_000,
      placeholder: false,
      answers: [{ promptId: 'lesson', value: 'Let it run' }],
    })
    const early = fullDraft('t1')
    early.at = 1_000
    await journal.write(early)
    const mid = placeholderDraft('t1')
    mid.at = 2_000
    await journal.write(mid)

    const timeline = await journal.timeline()
    expect(timeline.map((e) => e.at)).toEqual([1_000, 2_000, 3_000])
  })

  it('includes standalone, plan, close, and review entries together', async () => {
    const journal = await journalWithPlanType()
    await journal.entryTypes.save({ ...CLOSE_TYPE })
    await journal.entryTypes.save({ ...REVIEW_TYPE })
    await journal.entryTypes.save({ ...REFLECTION_TYPE })

    const plan = fullDraft('t1')
    plan.at = 1_000
    await journal.write(plan)
    await journal.write({
      anchor: { kind: 'close', tradeId: 't1' },
      entryTypeId: CLOSE_TYPE.id,
      at: 2_000,
      placeholder: false,
      answers: [{ promptId: 'lesson', value: 'Let it run' }],
    })
    await journal.write({
      anchor: { kind: 'review', date: '2026-07-03', tradeId: 't1' },
      entryTypeId: REVIEW_TYPE.id,
      at: 3_000,
      placeholder: false,
      answers: [{ promptId: 'action', value: 'Hold' }],
    })
    await journal.write({
      anchor: { kind: 'standalone' },
      entryTypeId: REFLECTION_TYPE.id,
      at: 4_000,
      placeholder: false,
      answers: [{ promptId: 'mind', value: 'Frothy' }],
    })

    const timeline = await journal.timeline()
    expect(timeline.map((e) => e.anchor.kind)).toEqual(['plan', 'close', 'review', 'standalone'])
  })

  it('respects a date range when given', async () => {
    const journal = await journalWithPlanType()
    const before = fullDraft('t1')
    before.at = new Date('2026-07-01T12:00:00').getTime()
    const within = fullDraft('t1')
    within.at = new Date('2026-07-10T12:00:00').getTime()
    const after = fullDraft('t1')
    after.at = new Date('2026-07-20T12:00:00').getTime()
    await journal.write(before)
    await journal.write(within)
    await journal.write(after)

    const timeline = await journal.timeline({ from: '2026-07-05', to: '2026-07-15' })
    expect(timeline).toHaveLength(1)
    expect(timeline[0].at).toBe(within.at)
  })

  it('includes unsettled placeholders (owed is part of the story)', async () => {
    const journal = await journalWithPlanType()
    await journal.write(placeholderDraft('t1'))

    const timeline = await journal.timeline()
    expect(timeline).toHaveLength(1)
    expect(timeline[0].placeholder).toBe(true)
    expect(timeline[0].answered.every((a) => a.answer === undefined)).toBe(true)
  })

  it('returns entries of the same type with different prompt snapshots side by side (ADR 0007)', async () => {
    const journal = new Journal(new InMemoryBinding())
    await journal.entryTypes.save({ ...REFLECTION_TYPE })

    await journal.write({
      anchor: { kind: 'standalone' },
      entryTypeId: REFLECTION_TYPE.id,
      at: 1_000,
      placeholder: false,
      answers: [{ promptId: 'mind', value: 'First shape' }],
    })

    // The Entry Type's Prompts evolve — a new prompt is added.
    const evolved = await journal.entryTypes.list()
    const type = evolved.find((t) => t.id === REFLECTION_TYPE.id)!
    await journal.entryTypes.save({
      ...type,
      prompts: [...type.prompts, { id: 'gratitude', text: 'Grateful for?', kind: 'text' }],
    })

    await journal.write({
      anchor: { kind: 'standalone' },
      entryTypeId: REFLECTION_TYPE.id,
      at: 2_000,
      placeholder: false,
      answers: [{ promptId: 'gratitude', value: 'A green day' }],
    })

    const timeline = await journal.timeline()
    expect(timeline).toHaveLength(2)
    expect(timeline.every((e) => e.entryTypeId === REFLECTION_TYPE.id)).toBe(true)
    expect(timeline[0].answered.map((a) => a.prompt.id)).toEqual(['mind', 'emotion', 'energy'])
    expect(timeline[1].answered.map((a) => a.prompt.id)).toEqual([
      'mind',
      'emotion',
      'energy',
      'gratitude',
    ])
  })
})

describe('Journal.write (addendum)', () => {
  it("stores an entry anchored {kind:'entry'} to its parent", async () => {
    const journal = await journalWithPlanType()
    const parentId = await journal.write(fullDraft('t1'))

    const addendumId = await journal.write({
      anchor: { kind: 'entry', entryId: parentId },
      entryTypeId: PLAN_TYPE.id,
      at: 1_700_000_100_000,
      placeholder: false,
      answers: [{ promptId: 'why', value: 'Hindsight: this held up' }],
    })

    const [entry] = await journal
      .entriesFor({ trade: 't1' })
      .then((es) => es.filter((e) => e.id === addendumId))
    expect(entry.anchor).toEqual({ kind: 'entry', entryId: parentId, tradeId: 't1' })
  })

  it("copies the parent's tradeId into the anchor when present", async () => {
    const journal = await journalWithPlanType()
    const parentId = await journal.write(fullDraft('t1'))

    const addendumId = await journal.write({
      anchor: { kind: 'entry', entryId: parentId },
      entryTypeId: PLAN_TYPE.id,
      at: 1_700_000_100_000,
      placeholder: false,
      answers: [],
    })

    const entries = await journal.entriesFor({ trade: 't1' })
    const addendum = entries.find((e) => e.id === addendumId)!
    expect((addendum.anchor as { tradeId?: string }).tradeId).toBe('t1')
  })

  it('rejects an addendum to a nonexistent entry', async () => {
    const journal = await journalWithPlanType()
    await expect(
      journal.write({
        anchor: { kind: 'entry', entryId: 'ghost' },
        entryTypeId: PLAN_TYPE.id,
        at: 1_700_000_100_000,
        placeholder: false,
        answers: [],
      }),
    ).rejects.toThrow()
  })
})

describe('Journal.entriesFor with addenda', () => {
  it('returns addenda on trade-anchored entries in entriesFor({trade})', async () => {
    const journal = await journalWithPlanType()
    const parentId = await journal.write(fullDraft('t1'))
    const addendumId = await journal.write({
      anchor: { kind: 'entry', entryId: parentId },
      entryTypeId: PLAN_TYPE.id,
      at: 1_700_000_100_000,
      placeholder: false,
      answers: [],
    })

    const entries = await journal.entriesFor({ trade: 't1' })
    expect(entries.map((e) => e.id)).toContain(addendumId)
  })

  it("returns an addendum chain flattened under the root entry's context", async () => {
    const journal = await journalWithPlanType()
    const rootId = await journal.write(fullDraft('t1'))
    const addendumId = await journal.write({
      anchor: { kind: 'entry', entryId: rootId },
      entryTypeId: PLAN_TYPE.id,
      at: 1_700_000_100_000,
      placeholder: false,
      answers: [],
    })
    const addendumToAddendumId = await journal.write({
      anchor: { kind: 'entry', entryId: addendumId },
      entryTypeId: PLAN_TYPE.id,
      at: 1_700_000_200_000,
      placeholder: false,
      answers: [],
    })

    const entries = await journal.entriesFor({ trade: 't1' })
    expect(entries.map((e) => e.id)).toEqual(
      expect.arrayContaining([rootId, addendumId, addendumToAddendumId]),
    )
    const grandchild = entries.find((e) => e.id === addendumToAddendumId)!
    expect((grandchild.anchor as { tradeId?: string }).tradeId).toBe('t1')
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
