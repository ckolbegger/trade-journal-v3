import type { TradeBook } from '@/books/tradebook/trade-book'
import type { CloseReason, StrategyTemplate } from '@/books/tradebook/types'
import type { Journal } from '@/books/journal/journal'
import type { EntryType } from '@/books/journal/types'

// Workspace owns app-lifecycle concerns rather than trading. This slice
// implements the ensureSeeded subset needed so far: the default Strategy and the
// Plan Entry Type. Seeding is additive and apply-iff-absent by id (Workspace
// design): because registries archive and never delete, existence alone is the
// ledger — edited defaults are never overwritten, archived ones never
// resurrected. Seeding goes through the Book interfaces, never raw stores.

export const LONG_STOCK_STRATEGY_ID = 'strategy-long-stock'
export const PLAN_ENTRY_TYPE_ID = 'entry-type-plan'
export const CLOSE_ENTRY_TYPE_ID = 'entry-type-close'
export const REVIEW_ENTRY_TYPE_ID = 'entry-type-trade-review'
export const TRADER_REFLECTION_ENTRY_TYPE_ID = 'entry-type-trader-reflection'
export const REVIEW_NOTE_ENTRY_TYPE_ID = 'entry-type-review-note'
export const ADDENDUM_ENTRY_TYPE_ID = 'entry-type-addendum'

// The five default Close Reasons, in seed order. "Rolled" is deliberately absent
// — it is seeded by Slice 16 with the roll gesture (no Slice 1 test can select it).
const CLOSE_REASONS: CloseReason[] = [
  { id: 'close-reason-hit-target', name: 'Hit Target' },
  { id: 'close-reason-hit-stop', name: 'Hit Stop' },
  { id: 'close-reason-thesis-invalidated', name: 'Thesis Invalidated' },
  { id: 'close-reason-timed-out', name: 'Timed Out' },
  { id: 'close-reason-never-filled', name: 'Never Filled' },
]

export const CLOSE_REASON_IDS = CLOSE_REASONS.map((r) => r.id)

const LONG_STOCK_STRATEGY: StrategyTemplate = {
  id: LONG_STOCK_STRATEGY_ID,
  name: 'Long Stock',
  legs: [{ side: 'buy', instrumentKind: 'stock' }],
  exitLevels: [
    { side: 'stop', kind: 'underlyingPrice' },
    { side: 'target', kind: 'underlyingPrice' },
  ],
}

const PLAN_ENTRY_TYPE: EntryType = {
  id: PLAN_ENTRY_TYPE_ID,
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

const CLOSE_ENTRY_TYPE: EntryType = {
  id: CLOSE_ENTRY_TYPE_ID,
  name: 'Close',
  designatedFor: 'close',
  prompts: [
    { id: 'what-worked', text: 'What worked / what didn’t?', kind: 'text' },
    {
      id: 'again',
      text: 'Would you take this trade again?',
      kind: 'select',
      options: ['yes', 'yes-smaller', 'no'],
    },
    { id: 'lesson', text: 'Lesson', kind: 'text' },
  ],
}

// The Daily Review checkpoint's type. Its Action select IS the Action list — the
// trader reconfigures their Actions by editing this Entry Type (review.md), and
// recording the Action is what marks a Trade reviewed.
const REVIEW_ENTRY_TYPE: EntryType = {
  id: REVIEW_ENTRY_TYPE_ID,
  name: 'Trade Review',
  designatedFor: 'review',
  prompts: [
    {
      id: 'action',
      text: 'What will you do with this Trade, based on today?',
      kind: 'select',
      options: ['Hold', 'Exit Soon', 'Adjust', 'Watch Closely'],
    },
    { id: 'conviction', text: 'Conviction', kind: 'scale', scale: { min: 1, max: 5 } },
    { id: 'note', text: 'Note', kind: 'text' },
  ],
}

// Undesignated: the trader picks either freely for standalone writing (S2.1) —
// no lifecycle moment uses these.
const TRADER_REFLECTION_ENTRY_TYPE: EntryType = {
  id: TRADER_REFLECTION_ENTRY_TYPE_ID,
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

const REVIEW_NOTE_ENTRY_TYPE: EntryType = {
  id: REVIEW_NOTE_ENTRY_TYPE_ID,
  name: 'Review Note',
  prompts: [
    { id: 'observation', text: 'Observation', kind: 'text' },
    {
      id: 'follow-up',
      text: 'Follow-up needed?',
      kind: 'select',
      options: ['yes', 'no'],
    },
  ],
}

// Undesignated: the addendum form's free-text-only fallback (Slice 2, S2.3) —
// offered alongside the parent's own Entry Type when growing an entry with
// something that doesn't fit the parent's structured prompts.
const ADDENDUM_ENTRY_TYPE: EntryType = {
  id: ADDENDUM_ENTRY_TYPE_ID,
  name: 'Note',
  prompts: [{ id: 'note', text: 'Add to the record', kind: 'text' }],
}

export class Workspace {
  constructor(
    private tradeBook: TradeBook,
    private journal: Journal,
  ) {}

  async ensureSeeded(): Promise<void> {
    const strategies = await this.tradeBook.registries.strategies.list(true)
    if (!strategies.some((s) => s.id === LONG_STOCK_STRATEGY.id)) {
      await this.tradeBook.registries.strategies.save({ ...LONG_STOCK_STRATEGY })
    }

    const closeReasons = await this.tradeBook.registries.closeReasons.list(true)
    for (const reason of CLOSE_REASONS) {
      if (!closeReasons.some((r) => r.id === reason.id)) {
        await this.tradeBook.registries.closeReasons.save({ ...reason })
      }
    }

    const entryTypes = await this.journal.entryTypes.list(true)
    if (!entryTypes.some((t) => t.id === PLAN_ENTRY_TYPE.id)) {
      await this.journal.entryTypes.save(structuredClone(PLAN_ENTRY_TYPE))
    }
    if (!entryTypes.some((t) => t.id === CLOSE_ENTRY_TYPE.id)) {
      await this.journal.entryTypes.save(structuredClone(CLOSE_ENTRY_TYPE))
    }
    if (!entryTypes.some((t) => t.id === REVIEW_ENTRY_TYPE.id)) {
      await this.journal.entryTypes.save(structuredClone(REVIEW_ENTRY_TYPE))
    }
    if (!entryTypes.some((t) => t.id === TRADER_REFLECTION_ENTRY_TYPE.id)) {
      await this.journal.entryTypes.save(structuredClone(TRADER_REFLECTION_ENTRY_TYPE))
    }
    if (!entryTypes.some((t) => t.id === REVIEW_NOTE_ENTRY_TYPE.id)) {
      await this.journal.entryTypes.save(structuredClone(REVIEW_NOTE_ENTRY_TYPE))
    }
    if (!entryTypes.some((t) => t.id === ADDENDUM_ENTRY_TYPE.id)) {
      await this.journal.entryTypes.save(structuredClone(ADDENDUM_ENTRY_TYPE))
    }
  }
}
