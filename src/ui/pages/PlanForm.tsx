import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTradeBook } from '../tradeBookContext'
import { PlanEntryForm } from './PlanEntryForm'
import { dollarsToCents, todayISO } from '../format'
import { btnPrimary, btnSecondary, field, heading, input, num } from '../styles'
import type {
  Account,
  ExitLevel,
  IdeaSource,
  PlanDraft,
  StrategyTemplate,
} from '@/books/tradebook/types'

// "New Trade": pick an Account and a Strategy (whose template pre-fills the
// planned stock leg and names which Exit Levels to ask for), write the thesis,
// pick or add an Idea Source, set quantity and the stop/target, then confirm.
// The confirmed Plan is immutable — this form is the only place it is written.

export function PlanForm() {
  const tradeBook = useTradeBook()
  const navigate = useNavigate()

  const [accounts, setAccounts] = useState<Account[]>([])
  const [strategies, setStrategies] = useState<StrategyTemplate[]>([])
  const [ideaSources, setIdeaSources] = useState<IdeaSource[]>([])

  const [accountId, setAccountId] = useState('')
  const [strategyId, setStrategyId] = useState('')
  const [ideaSourceId, setIdeaSourceId] = useState('')
  const [newIdeaSourceName, setNewIdeaSourceName] = useState('')

  const [thesis, setThesis] = useState('')
  const [ticker, setTicker] = useState('')
  const [qty, setQty] = useState('')
  const [stop, setStop] = useState('')
  const [target, setTarget] = useState('')
  const [chartLink, setChartLink] = useState('')
  const [confirmedTradeId, setConfirmedTradeId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([
      tradeBook.registries.accounts.list(),
      tradeBook.registries.strategies.list(),
      tradeBook.registries.ideaSources.list(),
    ]).then(([loadedAccounts, loadedStrategies, loadedIdeaSources]) => {
      if (!active) return
      setAccounts(loadedAccounts)
      setStrategies(loadedStrategies)
      setIdeaSources(loadedIdeaSources)
      if (loadedAccounts[0]) setAccountId(loadedAccounts[0].id)
      if (loadedStrategies[0]) setStrategyId(loadedStrategies[0].id)
    })
    return () => {
      active = false
    }
  }, [tradeBook])

  const strategy = strategies.find((s) => s.id === strategyId)
  const leg = strategy?.legs[0]
  const asksStop = strategy?.exitLevels.some((e) => e.side === 'stop') ?? false
  const asksTarget = strategy?.exitLevels.some((e) => e.side === 'target') ?? false

  const canConfirm =
    Boolean(accountId) &&
    thesis.trim().length > 0 &&
    ticker.trim().length > 0 &&
    Number(qty) > 0 &&
    (!asksStop || stop.trim().length > 0) &&
    (!asksTarget || target.trim().length > 0)

  async function addIdeaSource() {
    if (!newIdeaSourceName.trim()) return
    const item: IdeaSource = { id: '', name: newIdeaSourceName.trim() }
    await tradeBook.registries.ideaSources.save(item)
    setIdeaSources(await tradeBook.registries.ideaSources.list())
    setIdeaSourceId(item.id)
    setNewIdeaSourceName('')
  }

  async function confirm() {
    if (!canConfirm || !leg) return
    const exitLevels: ExitLevel[] = []
    if (asksStop) {
      exitLevels.push({
        scope: { level: 'trade' },
        side: 'stop',
        kind: 'underlyingPrice',
        price: dollarsToCents(stop),
      })
    }
    if (asksTarget) {
      exitLevels.push({
        scope: { level: 'trade' },
        side: 'target',
        kind: 'underlyingPrice',
        price: dollarsToCents(target),
      })
    }
    const draft: PlanDraft = {
      accountId,
      thesis: thesis.trim(),
      strategyId,
      ideaSourceId,
      plannedLegs: [
        {
          side: leg.side,
          instrument: { kind: 'stock', ticker: ticker.trim().toUpperCase() },
          qty: Number(qty),
        },
      ],
      exitLevels,
      plannedAt: todayISO(),
      ...(chartLink.trim() ? { chartLink: chartLink.trim() } : {}),
    }
    const id = await tradeBook.confirmPlan(draft)
    setConfirmedTradeId(id)
  }

  // Once the Plan is confirmed, the Plan journal prompts take over the page —
  // answer now or skip (Journal Debt). Either way the trader lands on the detail.
  if (confirmedTradeId) {
    return (
      <PlanEntryForm
        tradeId={confirmedTradeId}
        onDone={() => navigate(`/trades/${confirmedTradeId}`)}
      />
    )
  }

  return (
    <section className="space-y-4">
      <h2 className={heading}>New Trade</h2>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void confirm()
        }}
      >
        <label className={field}>
          Account
          <select
            className={input}
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>

        <label className={field}>
          Strategy
          <select
            className={input}
            value={strategyId}
            onChange={(e) => setStrategyId(e.target.value)}
          >
            {strategies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        {leg && (
          <fieldset className="space-y-3 rounded-lg border border-slate-200 p-4">
            <legend className="px-1 text-sm font-medium text-slate-700">Planned Leg</legend>
            <span className="inline-block text-sm text-slate-500 capitalize">
              {leg.side} {leg.instrumentKind}
            </span>
            <label className={field}>
              Ticker
              <input className={input} value={ticker} onChange={(e) => setTicker(e.target.value)} />
            </label>
            <label className={field}>
              Quantity
              <input
                className={`${input} ${num}`}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                inputMode="numeric"
              />
            </label>
          </fieldset>
        )}

        <label className={field}>
          Thesis
          <textarea
            className={input}
            rows={3}
            value={thesis}
            onChange={(e) => setThesis(e.target.value)}
          />
        </label>

        <label className={field}>
          Idea Source
          <select
            className={input}
            value={ideaSourceId}
            onChange={(e) => setIdeaSourceId(e.target.value)}
          >
            <option value="">None</option>
            {ideaSources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <label className={`${field} flex-1`}>
            New idea source
            <input
              className={input}
              value={newIdeaSourceName}
              onChange={(e) => setNewIdeaSourceName(e.target.value)}
            />
          </label>
          <button type="button" className={btnSecondary} onClick={() => void addIdeaSource()}>
            Add idea source
          </button>
        </div>

        {asksStop && (
          <label className={field}>
            Stop (underlying price)
            <input
              className={`${input} ${num}`}
              value={stop}
              onChange={(e) => setStop(e.target.value)}
              inputMode="decimal"
            />
          </label>
        )}
        {asksTarget && (
          <label className={field}>
            Target (underlying price)
            <input
              className={`${input} ${num}`}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              inputMode="decimal"
            />
          </label>
        )}

        <label className={field}>
          Chart link (optional)
          <input
            className={input}
            value={chartLink}
            onChange={(e) => setChartLink(e.target.value)}
          />
        </label>

        <button type="submit" className={btnPrimary} disabled={!canConfirm}>
          Confirm plan
        </button>
      </form>
    </section>
  )
}
