// The Journal's own record shapes. TradeMath never computes over Entries, so
// Entry/EntryType/Anchor/Prompt live here in the Journal module (not the domain
// fact contract). The tradeId an Anchor carries is an opaque string — the
// Journal knows nothing about the Trade lifecycle.
//
// Slice 1 implements only the subset the plan-time journal needs: the 'plan'
// Anchor, the text/select/scale prompt kinds the seeded Plan type uses, and the
// write / entriesFor / countFor operations. Later slices add anchor kinds,
// prompt kinds, and operations (settle, timeline, outstandingDebt) without
// reshaping these.

export type EntryId = string
export type TradeId = string
export type Timestamp = number // epoch ms

// This slice anchors entries only at plan time. Other kinds arrive with the
// slices that first write them (close in S1.4, review in S1.7, …).
export type Anchor = { kind: 'plan'; tradeId: TradeId }

export interface Prompt {
  id: string
  text: string
  kind: 'text' | 'select' | 'scale'
  options?: string[] // select
  scale?: { min: number; max: number } // scale
}

export interface PromptAnswer {
  promptId: string
  value: string | number
}

export interface EntryType {
  id: string
  name: string
  designatedFor?: 'plan' // which moment uses this type (seeded; re-designatable)
  prompts: Prompt[]
  archived?: boolean // registries archive, never delete
}

export interface Entry {
  id: EntryId
  at: Timestamp // the lifecycle moment it belongs to
  anchor: Anchor
  entryTypeId: string
  // Prompts snapshotted at write time (ADR 0007). A placeholder carries the
  // snapshot with no answers; settle() (S1.7) answers this same snapshot.
  answered: { prompt: Prompt; answer?: PromptAnswer }[]
  placeholder: boolean
}

export interface EntryDraft {
  anchor: Anchor
  entryTypeId: string
  at: Timestamp
  answers: PromptAnswer[]
  placeholder: boolean
}

export interface AnchorQuery {
  trade: TradeId
}
