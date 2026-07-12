import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useJournal } from '../journalContext'
import { useTradeBook } from '../tradeBookContext'
import { NewEntryPage } from './NewEntryPage'
import { SettleForm } from '../components/SettleForm'
import { AddAddendum } from '../components/AddAddendum'
import { AnsweredPrompts } from '../components/AnsweredPrompts'
import { buildEntryThreads } from '../components/entryThread'
import { collectAnswers } from '../components/prompt-answers'
import type { PromptValues } from '../components/prompt-answers'
import { shortDate, timestampToISODate } from '../format'
import { btnPrimary, card, field, heading, input, link as linkClass, subheading } from '../styles'
import type { Anchor, DateRange, Entry } from '@/books/journal/types'

// The Journal nav destination: the growth story, one chronological timeline of
// every entry across every anchor kind (Journal.timeline — journal.md).
// Placeholders render inline as owed, settleable right here (the same flow the
// Daily Review walk uses), and trade-anchored entries link back to their Trade.

interface Row {
  entry: Entry
  entryTypeName: string
  ticker?: string
  addenda: Row[]
}

export function TimelinePage() {
  const journal = useJournal()
  const tradeBook = useTradeBook()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [writing, setWriting] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let active = true
    async function load() {
      const range: DateRange | undefined = from && to ? { from, to } : undefined
      const [entries, types] = await Promise.all([
        journal.timeline(range),
        journal.entryTypes.list(true),
      ])
      const typeNames = new Map(types.map((t) => [t.id, t.name]))
      const tradeIds = [
        ...new Set(
          entries.flatMap((e) =>
            'tradeId' in e.anchor && e.anchor.tradeId ? [e.anchor.tradeId] : [],
          ),
        ),
      ]
      const tickers = new Map<string, string>()
      await Promise.all(
        tradeIds.map(async (tradeId) => {
          const record = await tradeBook.get(tradeId)
          tickers.set(tradeId, record.plan.plannedLegs[0]?.instrument.ticker ?? '')
        }),
      )
      if (!active) return
      const toRow = (entry: Entry): Row => ({
        entry,
        entryTypeName: typeNames.get(entry.entryTypeId) ?? '',
        ticker:
          'tradeId' in entry.anchor && entry.anchor.tradeId
            ? tickers.get(entry.anchor.tradeId)
            : undefined,
        addenda: [],
      })
      setRows(
        buildEntryThreads(entries)
          .slice()
          .sort((a, b) => b.root.at - a.root.at) // newest-first
          .map(({ root, addenda }) => ({
            ...toRow(root),
            addenda: addenda.map(toRow),
          })),
      )
    }
    void load()
    return () => {
      active = false
    }
  }, [journal, tradeBook, from, to, refresh])

  async function settle(entry: Entry, values: PromptValues) {
    await journal.settle(
      entry.id,
      collectAnswers(
        entry.answered.map((a) => a.prompt),
        values,
      ),
    )
    setRefresh((n) => n + 1)
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        {!writing && <h2 className={heading}>Journal</h2>}
        {!writing && (
          <button type="button" className={btnPrimary} onClick={() => setWriting(true)}>
            New entry
          </button>
        )}
      </div>

      {writing ? (
        <NewEntryPage
          onSaved={() => {
            setWriting(false)
            setRefresh((n) => n + 1)
          }}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <label className={field}>
              From
              <input
                type="date"
                className={input}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label className={field}>
              To
              <input
                type="date"
                className={input}
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
          </div>

          <ul aria-label="timeline" className="space-y-3">
            {rows?.map(({ entry, entryTypeName, ticker, addenda }) => (
              <li key={entry.id} className={`${card} space-y-2`}>
                <div className="space-y-0.5">
                  <p className={subheading}>{entryTypeName}</p>
                  <p className="text-sm text-slate-600">
                    {entry.placeholder && entry.settledAt !== undefined
                      ? `written ${timestampToISODate(entry.at)} · settled ${timestampToISODate(entry.settledAt)}`
                      : timestampToISODate(entry.at)}{' '}
                    · <AnchorLabel anchor={entry.anchor} ticker={ticker} />
                  </p>
                </div>
                {entry.placeholder && entry.settledAt === undefined ? (
                  <div className="space-y-3">
                    <p
                      aria-label="journal owed"
                      className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                    >
                      Journal entry owed
                    </p>
                    <ul className="space-y-3">
                      <SettleForm entry={entry} onSettle={(values) => void settle(entry, values)} />
                    </ul>
                  </div>
                ) : (
                  <AnsweredPrompts
                    answered={entry.answered}
                    promptClass="text-sm font-medium text-slate-700"
                  />
                )}
                <AddAddendum entry={entry} onAdded={() => setRefresh((n) => n + 1)} />
                {addenda.length > 0 && (
                  <ul
                    aria-label="addenda"
                    className="ml-4 space-y-3 border-l border-slate-200 pl-4"
                  >
                    {addenda.map(({ entry: addendum, entryTypeName: addendumTypeName }) => (
                      <li key={addendum.id} className="space-y-2">
                        <p className="text-xs text-slate-500">
                          {addendumTypeName} · {timestampToISODate(addendum.at)}
                        </p>
                        <AnsweredPrompts
                          answered={addendum.answered}
                          promptClass="text-sm font-medium text-slate-700"
                        />
                        <AddAddendum entry={addendum} onAdded={() => setRefresh((n) => n + 1)} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function AnchorLabel({ anchor, ticker }: { anchor: Anchor; ticker?: string }) {
  if (anchor.kind === 'standalone') return <span>Standalone</span>
  if (anchor.kind === 'review') {
    return (
      <span>
        Review —{' '}
        <Link to={`/trades/${anchor.tradeId}`} className={linkClass}>
          {ticker}
        </Link>
        , {shortDate(anchor.date)}
      </span>
    )
  }
  // Addenda are never rendered as their own timeline row — buildEntryThreads
  // groups them under their root, which is always 'standalone' | 'plan' |
  // 'close' | 'review' — so 'entry' never reaches this label in practice.
  if (anchor.kind === 'entry') return null
  const label = anchor.kind === 'plan' ? 'Plan' : 'Close'
  return (
    <span>
      {label} —{' '}
      <Link to={`/trades/${anchor.tradeId}`} className={linkClass}>
        {ticker}
      </Link>
    </span>
  )
}
