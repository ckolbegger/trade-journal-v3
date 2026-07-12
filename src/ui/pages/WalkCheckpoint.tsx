import { useEffect, useState } from 'react'
import { useJournal } from '../journalContext'
import { usePriceBook } from '../priceBookContext'
import { TradeDashboard } from './TradeDashboard'
import { PromptFields } from '../components/PromptFields'
import { collectAnswers } from '../components/prompt-answers'
import type { PromptValues } from '../components/prompt-answers'
import { dollarsToCents } from '../format'
import { btnPrimary, btnSecondary, card, input, num, subheading } from '../styles'
import type { DateRange, ISODate, InstrumentKey } from '@/books/pricebook/types'
import type { Entry, EntryType, Prompt } from '@/books/journal/types'

// One Trade's checkpoint in the Daily Review walk, in the session's order:
//
//   1. this Trade's missing (instrument, date) Marks, typed inline — or skipped,
//      accepting the blind spot. Shared instruments prompt only at first
//      encounter: the rows are what is still missing when the checkpoint opens,
//      so an instrument another Trade already marked has nothing left to ask.
//   2. the refreshed dashboard — the numbers the decision is made on.
//   3. the Action: recording it writes the review-anchored entry, and THAT is what
//      marks the Trade reviewed (there is no separate reviewed flag — review.md).
//   4. this Trade's Journal Debt, offered for settlement — or deferred again,
//      never blocking (ADR 0006).
//
// The UI talks to the owning modules directly (PriceBook, Valuations, Journal);
// Review only supplies the walk order.

type MissingRow = { instrument: InstrumentKey; date: ISODate }

export function WalkCheckpoint({
  tradeId,
  ticker,
  instruments,
  range,
  asOf,
  reviewedToday,
  onReviewed,
}: {
  tradeId: string
  ticker: string
  instruments: InstrumentKey[]
  range?: DateRange
  asOf: ISODate
  reviewedToday: boolean // this Trade's Action for asOf already exists (Review.walk)
  onReviewed: (tradeId: string) => void
}) {
  const journal = useJournal()
  const priceBook = usePriceBook()
  const [missing, setMissing] = useState<MissingRow[]>([])
  const [marksVersion, setMarksVersion] = useState(0)
  const [reviewType, setReviewType] = useState<EntryType | null>(null)
  const [action, setAction] = useState<string | null>(null)
  const [debt, setDebt] = useState<Entry[]>([])

  useEffect(() => {
    let active = true
    async function load() {
      const rows = range ? await priceBook.missingMarks(instruments, range) : []
      const types = await journal.entryTypes.list()
      const entries = await journal.entriesFor({ trade: tradeId })
      if (!active) return
      setMissing(rows)
      setReviewType(types.find((t) => t.designatedFor === 'review') ?? null)
      setDebt(entries.filter((e) => e.placeholder && e.settledAt === undefined))
      // Already reviewed today (a walk re-entered, or a Trade acted on earlier):
      // show the Action it carries rather than asking for a second one — a Trade
      // records exactly one Action per day.
      if (reviewedToday) {
        const recorded = entries.find((e) => e.anchor.kind === 'review' && e.anchor.date === asOf)
        setAction(actionOf(recorded))
      }
    }
    void load()
    return () => {
      active = false
    }
    // The rows are snapshotted when the checkpoint opens; filling them updates
    // state locally rather than re-querying.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journal, priceBook, tradeId])

  function dropRow(row: MissingRow) {
    setMissing((rows) =>
      rows.filter((r) => !(r.instrument === row.instrument && r.date === row.date)),
    )
  }

  async function recordMark(row: MissingRow, price: string) {
    if (price.trim() === '') return
    await priceBook.record(row.instrument, row.date, dollarsToCents(price), 'manual')
    dropRow(row)
    setMarksVersion((n) => n + 1)
  }

  async function recordAction(values: PromptValues) {
    const type = reviewType!
    const answers = collectAnswers(type.prompts, values)
    const chosen = answers.find((a) => a.promptId === actionPromptOf(type)?.id)?.value
    // The Action IS the review — an entry without one would flag the Trade
    // reviewed on a blank row of the behavioral dataset.
    if (chosen === undefined) return
    await journal.write({
      anchor: { kind: 'review', date: asOf, tradeId },
      entryTypeId: type.id,
      at: Date.now(),
      answers,
      placeholder: false,
    })
    setAction(String(chosen))
    onReviewed(tradeId)
  }

  async function settle(entry: Entry, values: PromptValues) {
    await journal.settle(
      entry.id,
      collectAnswers(
        entry.answered.map((a) => a.prompt),
        values,
      ),
    )
    setDebt((entries) => entries.filter((e) => e.id !== entry.id))
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-900">{ticker}</h3>

      {missing.length > 0 && (
        <div className={`${card} space-y-3`}>
          <h4 className={subheading}>Marks needed</h4>
          <ul aria-label="marks needed" className="space-y-2">
            {missing.map((row) => (
              <MarkRow
                key={`${row.instrument}|${row.date}`}
                row={row}
                onSave={(price) => void recordMark(row, price)}
                onSkip={() => dropRow(row)}
              />
            ))}
          </ul>
        </div>
      )}

      <TradeDashboard key={marksVersion} tradeId={tradeId} />

      <div className={`${card} space-y-3`}>
        <h4 className={subheading}>Action</h4>
        {action !== null ? (
          <p
            aria-label="action recorded"
            className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
          >
            {action}
          </p>
        ) : reviewType ? (
          <ActionForm prompts={reviewType} onRecord={(values) => void recordAction(values)} />
        ) : null}
      </div>

      {action !== null && debt.length > 0 && (
        <div className={`${card} space-y-3`}>
          <h4 className={subheading}>Journal owed</h4>
          <ul aria-label="journal owed" className="space-y-4">
            {debt.map((entry) => (
              <SettleForm
                key={entry.id}
                entry={entry}
                onSettle={(values) => void settle(entry, values)}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function MarkRow({
  row,
  onSave,
  onSkip,
}: {
  row: MissingRow
  onSave: (price: string) => void
  onSkip: () => void
}) {
  const [price, setPrice] = useState('')
  const label = `${row.instrument} ${row.date}`

  return (
    <li aria-label={label} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-slate-700">
        {label} price
        <input
          className={`${input} ${num}`}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          inputMode="decimal"
        />
      </label>
      <button type="button" className={btnPrimary} onClick={() => onSave(price)}>
        Save
      </button>
      <button type="button" className={btnSecondary} onClick={onSkip}>
        Skip
      </button>
    </li>
  )
}

// The Action is the review Entry Type's select prompt — its options ARE the
// Action list (review.md), which is what makes the Actions trader-configurable.
function actionPromptOf(type: EntryType): Prompt | undefined {
  return type.prompts.find((prompt) => prompt.kind === 'select')
}

function actionOf(entry: Entry | undefined): string {
  const answered = entry?.answered.find((a) => a.prompt.kind === 'select')
  return String(answered?.answer?.value ?? '')
}

function ActionForm({
  prompts,
  onRecord,
}: {
  prompts: EntryType
  onRecord: (values: PromptValues) => void
}) {
  const [values, setValues] = useState<PromptValues>({})
  const actionPrompt = actionPromptOf(prompts)
  // The Action is required; conviction and note ride along optionally.
  const chosen =
    actionPrompt === undefined ||
    (values[actionPrompt.id] !== undefined && values[actionPrompt.id] !== '')

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        onRecord(values)
      }}
    >
      <PromptFields
        prompts={prompts.prompts}
        values={values}
        namespace="action"
        onChange={(id, value) => setValues((prev) => ({ ...prev, [id]: value }))}
      />
      <button type="submit" className={btnPrimary} disabled={!chosen}>
        Record action
      </button>
    </form>
  )
}

function SettleForm({
  entry,
  onSettle,
}: {
  entry: Entry
  onSettle: (values: PromptValues) => void
}) {
  const [values, setValues] = useState<PromptValues>({})

  return (
    <li className="space-y-3">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          onSettle(values)
        }}
      >
        <PromptFields
          prompts={entry.answered.map((a) => a.prompt)}
          values={values}
          namespace={`settle-${entry.id}`}
          onChange={(id, value) => setValues((prev) => ({ ...prev, [id]: value }))}
        />
        <button type="submit" className={btnPrimary}>
          Settle entry
        </button>
      </form>
    </li>
  )
}
