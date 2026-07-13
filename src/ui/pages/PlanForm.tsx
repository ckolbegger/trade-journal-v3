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
  StrategyExitTemplate,
  StrategyTemplate,
} from '@/books/tradebook/types'

// "New Trade": pick an Account and a Strategy (whose template pre-fills the
// planned stock leg and names which Exit Levels to ask for), write the thesis,
// pick or add an Idea Source, set quantity and the stop/target, then confirm.
// The confirmed Plan is immutable — this form is the only place it is written.

function exitTemplateLabel(kind: StrategyExitTemplate['kind']): string {
  if (kind === 'structureValue') return 'structure value'
  if (kind === 'pctOfMaxProfit') return '% of max profit'
  return 'underlying price'
}

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
  const [expiration, setExpiration] = useState('')
  const [strike, setStrike] = useState('')
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
  const isOption = leg?.instrumentKind === 'option'
  const stopTemplate = strategy?.exitLevels.find((e) => e.side === 'stop')
  const targetTemplate = strategy?.exitLevels.find((e) => e.side === 'target')
  const asksStop = stopTemplate !== undefined
  const asksTarget = targetTemplate !== undefined

  const canConfirm =
    Boolean(accountId) &&
    thesis.trim().length > 0 &&
    ticker.trim().length > 0 &&
    Number(qty) > 0 &&
    (!isOption || (expiration.trim().length > 0 && strike.trim().length > 0)) &&
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

  function buildExitLevel(
    side: 'stop' | 'target',
    template: StrategyExitTemplate,
    value: string,
  ): ExitLevel {
    if (template.kind === 'pctOfMaxProfit') {
      return { scope: { level: 'trade' }, side, kind: 'pctOfMaxProfit', pct: Number(value) }
    }
    if (template.kind === 'structureValue') {
      return {
        scope: { level: 'trade' },
        side,
        kind: 'structureValue',
        value: dollarsToCents(value),
      }
    }
    return {
      scope: { level: 'trade' },
      side,
      kind: 'underlyingPrice',
      price: dollarsToCents(value),
    }
  }

  async function confirm() {
    if (!canConfirm || !leg) return
    const exitLevels: ExitLevel[] = []
    if (stopTemplate) exitLevels.push(buildExitLevel('stop', stopTemplate, stop))
    if (targetTemplate) exitLevels.push(buildExitLevel('target', targetTemplate, target))

    const instrument: PlanDraft['plannedLegs'][number]['instrument'] = isOption
      ? {
          kind: 'option',
          ticker: ticker.trim().toUpperCase(),
          expiration,
          type: leg.optionType!,
          strike: dollarsToCents(strike),
        }
      : { kind: 'stock', ticker: ticker.trim().toUpperCase() }

    const draft: PlanDraft = {
      accountId,
      thesis: thesis.trim(),
      strategyId,
      ideaSourceId,
      plannedLegs: [{ side: leg.side, instrument, qty: Number(qty) }],
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
            {isOption && (
              <>
                <label className={field}>
                  Expiration
                  <input
                    type="date"
                    className={input}
                    value={expiration}
                    onChange={(e) => setExpiration(e.target.value)}
                  />
                </label>
                <label className={field}>
                  Strike
                  <input
                    className={`${input} ${num}`}
                    value={strike}
                    onChange={(e) => setStrike(e.target.value)}
                    inputMode="decimal"
                  />
                </label>
              </>
            )}
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

        {stopTemplate && (
          <label className={field}>
            Stop ({exitTemplateLabel(stopTemplate.kind)})
            <input
              className={`${input} ${num}`}
              value={stop}
              onChange={(e) => setStop(e.target.value)}
              inputMode="decimal"
            />
          </label>
        )}
        {targetTemplate && (
          <label className={field}>
            Target ({exitTemplateLabel(targetTemplate.kind)})
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
