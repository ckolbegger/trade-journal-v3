import type { StorageBinding } from '@/storage/storage-binding'
import { isoDateOf } from '@/domain/dates'
import { ListRegistry } from '../list-registry'
import type {
  AnchorQuery,
  DateRange,
  Entry,
  EntryDraft,
  EntryId,
  EntryType,
  Prompt,
  PromptAnswer,
  TradeId,
  Timestamp,
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

    const answered = answerPrompts(entryType.prompts, draft.answers)

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

  // Completing a placeholder — completion, not editing (entries are immutable).
  // The answers land against the prompts the ENTRY snapshotted, not today's
  // Entry Type: you answer the questions as they were asked at that lifecycle
  // moment (ADR 0007). Both timestamps survive, so late journaling stays visible.
  async settle(entryId: EntryId, answers: PromptAnswer[]): Promise<void> {
    const entry = await this.binding.get<Entry>(ENTRIES, entryId)
    if (!entry) throw new Error(`No entry ${entryId}`)
    if (!entry.placeholder) throw new Error(`Entry ${entryId} is not a placeholder`)
    if (entry.settledAt !== undefined) throw new Error(`Entry ${entryId} is already settled`)

    const prompts = entry.answered.map((a) => a.prompt)
    const settled: Entry = {
      ...entry,
      answered: answerPrompts(prompts, answers),
      settledAt: Date.now(),
    }
    await this.binding.put(ENTRIES, structuredClone(settled))
  }

  async entriesFor(query: AnchorQuery): Promise<Entry[]> {
    const entries = await this.binding.where<Entry>(ENTRIES, 'anchor.tradeId', query.trade)
    return entries.sort((a, b) => a.at - b.at).map((e) => structuredClone(e))
  }

  // The growth story: every entry, across every anchor kind, in 'at' order —
  // standalone reflections alongside plan/close/review entries, unsettled
  // placeholders included (they ARE part of the story, not hidden debt). A
  // `range` narrows to the trading dates entries fall on (domain/dates'
  // isoDateOf), inclusive both ends.
  async timeline(range?: DateRange): Promise<Entry[]> {
    const entries = await this.binding.list<Entry>(ENTRIES)
    return entries
      .filter((e) => inRange(e.at, range))
      .sort((a, b) => a.at - b.at)
      .map((e) => structuredClone(e))
  }

  async countFor(tradeId: TradeId): Promise<number> {
    return (await this.entriesFor({ trade: tradeId })).length
  }

  // Journal Debt IS the unsettled-placeholder query — no cross-Book derivation
  // (ADR 0006). Review surfaces these for settlement; nothing nags. A settled
  // placeholder stays a placeholder (its at/settledAt pair is the late-journaling
  // record) but is no longer owed.
  async outstandingDebt(): Promise<Entry[]> {
    const entries = await this.binding.list<Entry>(ENTRIES)
    return entries
      .filter((e) => e.placeholder && e.settledAt === undefined)
      .sort((a, b) => a.at - b.at)
      .map((e) => structuredClone(e))
  }
}

// Answers pinned to their prompts — the snapshot an entry keeps (ADR 0007). Both
// write (prompts from the Entry Type) and settle (prompts from the entry itself)
// answer a prompt list this way, so an answer is validated against exactly the
// question it answers.
function answerPrompts(
  prompts: Prompt[],
  answers: PromptAnswer[],
): { prompt: Prompt; answer?: PromptAnswer }[] {
  for (const answer of answers) {
    validateAnswer(prompts, answer)
  }
  return prompts.map((prompt) => {
    const answer = answers.find((a) => a.promptId === prompt.id)
    return answer ? { prompt, answer } : { prompt }
  })
}

function inRange(at: Timestamp, range?: DateRange): boolean {
  if (!range) return true
  const date = isoDateOf(at)
  return date >= range.from && date <= range.to
}

function validateAnswer(prompts: Prompt[], answer: PromptAnswer): void {
  const prompt = prompts.find((p) => p.id === answer.promptId)
  if (!prompt) throw new Error(`No prompt ${answer.promptId} among the answered prompts`)
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
