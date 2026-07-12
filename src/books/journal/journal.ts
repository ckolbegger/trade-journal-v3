import type { StorageBinding } from '@/storage/storage-binding'
import { ListRegistry } from '../list-registry'
import type {
  AnchorQuery,
  Entry,
  EntryDraft,
  EntryId,
  EntryType,
  PromptAnswer,
  TradeId,
} from './types'

const ENTRIES = 'entries'
const ENTRY_TYPES = 'entryTypes'

// The system of record for all trader writing. Self-contained: it knows nothing
// about the Trade lifecycle (the UI writes entries at the right moments) and
// calls only its own StorageBinding. This slice implements plan-time journaling:
// write (full entry or placeholder), entriesFor, countFor, and the entryTypes
// registry. Entries are immutable — there is no operation that edits a written
// entry's answers.

export class Journal {
  readonly entryTypes: ListRegistry<EntryType>

  constructor(private binding: StorageBinding) {
    this.entryTypes = new ListRegistry<EntryType>(binding, ENTRY_TYPES)
  }

  async write(draft: EntryDraft): Promise<EntryId> {
    const entryType = await this.binding.get<EntryType>(ENTRY_TYPES, draft.entryTypeId)
    if (!entryType) throw new Error(`No Entry Type ${draft.entryTypeId}`)

    for (const answer of draft.answers) {
      validateAnswer(entryType, answer)
    }

    const answered = entryType.prompts.map((prompt) => {
      const answer = draft.answers.find((a) => a.promptId === prompt.id)
      return answer ? { prompt, answer } : { prompt }
    })

    const entry: Entry = {
      id: crypto.randomUUID(),
      at: draft.at,
      anchor: draft.anchor,
      entryTypeId: draft.entryTypeId,
      answered,
      placeholder: draft.placeholder,
    }
    await this.binding.put(ENTRIES, structuredClone(entry))
    return entry.id
  }

  async entriesFor(query: AnchorQuery): Promise<Entry[]> {
    const entries = await this.binding.where<Entry>(ENTRIES, 'anchor.tradeId', query.trade)
    return entries.sort((a, b) => a.at - b.at).map((e) => structuredClone(e))
  }

  async countFor(tradeId: TradeId): Promise<number> {
    return (await this.entriesFor({ trade: tradeId })).length
  }

  // Journal Debt IS the unsettled-placeholder query — no cross-Book derivation
  // (ADR 0006). Review surfaces these for settlement; nothing nags. (Settling
  // arrives in S1.7, which narrows this to placeholders without a settledAt.)
  async outstandingDebt(): Promise<Entry[]> {
    const entries = await this.binding.list<Entry>(ENTRIES)
    return entries
      .filter((e) => e.placeholder)
      .sort((a, b) => a.at - b.at)
      .map((e) => structuredClone(e))
  }
}

function validateAnswer(entryType: EntryType, answer: PromptAnswer): void {
  const prompt = entryType.prompts.find((p) => p.id === answer.promptId)
  if (!prompt) throw new Error(`No prompt ${answer.promptId} on Entry Type ${entryType.id}`)
  if (prompt.kind === 'select' && !prompt.options?.includes(answer.value as string)) {
    throw new Error(`Answer ${String(answer.value)} not among options for prompt ${prompt.id}`)
  }
  if (prompt.kind === 'scale') {
    const { min, max } = prompt.scale!
    if (typeof answer.value !== 'number' || answer.value < min || answer.value > max) {
      throw new Error(`Answer ${String(answer.value)} outside scale ${min}..${max}`)
    }
  }
}
