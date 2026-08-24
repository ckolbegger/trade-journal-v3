// The Journal's own record shapes. TradeMath never computes over Entries, so
// Entry/EntryType/Anchor/Prompt live here in the Journal module (not the domain
// fact contract). The tradeId an Anchor carries is an opaque string — the
// Journal knows nothing about the Trade lifecycle.
//
// Slice 1 implements only the subset the plan-time journal needs: the 'plan',
// 'close' and 'review' Anchors, the text/select/scale prompt kinds the seeded
// types use, and the write / settle / entriesFor / countFor / outstandingDebt
// operations. Later slices add anchor kinds, prompt kinds, and operations
// (timeline) without reshaping these.

export type EntryId = string
export type TradeId = string
export type Timestamp = number // epoch ms
export type ISODate = string // 'YYYY-MM-DD' — the trading date

// Anchor kinds arrive with the slices that first write them: plan (S1.2), close
// (S1.4), review (S1.7), standalone (S2.1). The rest follow. A review anchor
// carries the date it reviews — its existence for (date, tradeId) IS the
// Trade's reviewed-today flag (docs/design/review.md); nothing about
// "reviewed" is stored anywhere else. A standalone anchor carries no tradeId —
// trader-level reflection not tied to any one Trade.
// The 'entry' kind is an addendum — how an immutable entry grows (journal.md:
// "editing an entry is intentionally impossible"). Its tradeId is copied from
// the parent at write time when the parent is trade-anchored (Slice 2's
// decided-in-slice ruling), so entriesFor({trade}) stays one indexed query no
// matter how deep the addendum chain runs.
export type Anchor =
  | { kind: 'standalone' }
  | { kind: 'plan'; tradeId: TradeId }
  | { kind: 'close'; tradeId: TradeId }
  | { kind: 'review'; date: ISODate; tradeId: TradeId }
  | { kind: 'entry'; entryId: EntryId; tradeId?: TradeId }

export interface PromptOption {
  id: string
  label: string
}

export interface Prompt {
  id: string
  text: string
  kind: 'text' | 'select' | 'scale'
  options?: PromptOption[] // select — a select answer's value is the option id (S1.9),
  // so renaming an option's label never orphans a prior answer (ADR 0007).
  scale?: { min: number; max: number } // scale
}

export interface PromptAnswer {
  promptId: string
  value: string | number
}

export interface EntryType {
  id: string
  name: string
  // Which moment uses this type (seeded; re-designatable). 'review' = the Trade
  // Review checkpoint; its select prompt IS the Action list.
  designatedFor?: 'plan' | 'close' | 'review'
  prompts: Prompt[]
  archived?: boolean // registries archive, never delete
}

export interface Entry {
  id: EntryId
  at: Timestamp // the lifecycle moment it belongs to
  anchor: Anchor
  entryTypeId: string
  // Prompts snapshotted at write time (ADR 0007). A placeholder carries the
  // snapshot with no answers; settle() answers this same snapshot.
  answered: { prompt: Prompt; answer?: PromptAnswer }[]
  placeholder: boolean
  settledAt?: Timestamp // late journaling is visible: at vs settledAt
  // The trader explicitly had nothing to note (S1.9) — one act for the whole
  // Entry, never per Prompt. A declined Entry is settled: it is never Journal
  // Debt and is never nagged, same as any other full entry.
  declined?: true
}

export interface EntryDraft {
  anchor: Anchor
  entryTypeId: string
  at: Timestamp
  answers: PromptAnswer[]
  placeholder: boolean
  declined?: true
}

export interface AnchorQuery {
  trade: TradeId
}

// Journal-owned (mirrors PriceBook's DateRange shape, but Books never import
// from one another — see docs/plan/README.md's dependency rules). Bounds
// timeline() by the trading date entries fall on (Entry.at read through
// domain/dates.isoDateOf), inclusive both ends.
export interface DateRange {
  from: ISODate
  to: ISODate
}
