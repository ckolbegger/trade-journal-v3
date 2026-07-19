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
  // Expiration is LINKED across every CONCRETE option leg a template plans (a
  // spread's two legs share one expiration, S7.2) — one shared input, applied
  // to every non-TBD option leg at confirm time. A `tbdAllowed` leg gets its
  // OWN independent expiration input instead (`expirationByLeg`) — needed
  // once a template mixes a concrete leg with a TBD one at DIFFERENT
  // expirations (the PMCC's far LEAP vs. its near, still-unsold call, S7.3);
  // for a single-option-leg template (Long Call, Covered Call) this reduces
  // to exactly one input either way. Strike is already per-leg (a spread's
  // legs' strikes DIFFER), mirroring qtyByLeg below.
  const [expiration, setExpiration] = useState('')
  const [expirationByLeg, setExpirationByLeg] = useState<Record<number, string>>({})
  const [strike, setStrike] = useState('')
  const [strikeByLeg, setStrikeByLeg] = useState<Record<number, string>>({})
  const [qty, setQty] = useState('')
  const [qtyByLeg, setQtyByLeg] = useState<Record<number, string>>({})
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
  const legs = strategy?.legs ?? []
  // A multi-leg template (covered call: buy stock + sell call) plans quantity
  // and strike per-leg. TBD-ability is a SEPARATE, per-leg, template-driven
  // concern (`tbdAllowed`) — only a legging leg (the Covered Call's call) may
  // be left blank, completed later by its fill, not this form; a template
  // whose legs are all concrete at plan time (Bull Put Spread) requires every
  // leg's strike, and expiration, up front (decided in Slice 7.2 — matching
  // two same-type legs by instrument identity depends on both being concrete).
  const isMultiLeg = legs.length > 1
  const requiresExpiration = legs.some((l) => l.instrumentKind === 'option' && !l.tbdAllowed)
  const stopTemplate = strategy?.exitLevels.find((e) => e.side === 'stop')
  const targetTemplate = strategy?.exitLevels.find((e) => e.side === 'target')
  const asksStop = stopTemplate !== undefined
  const asksTarget = targetTemplate !== undefined

  const qtyFor = (i: number): string => (isMultiLeg ? (qtyByLeg[i] ?? '') : qty)
  const setQtyFor = (i: number, value: string): void => {
    if (isMultiLeg) setQtyByLeg((prev) => ({ ...prev, [i]: value }))
    else setQty(value)
  }

  const strikeFor = (i: number): string => (isMultiLeg ? (strikeByLeg[i] ?? '') : strike)
  const setStrikeFor = (i: number, value: string): void => {
    if (isMultiLeg) setStrikeByLeg((prev) => ({ ...prev, [i]: value }))
    else setStrike(value)
  }
  // A `tbdAllowed` leg's expiration is independent (`expirationByLeg`); every
  // other option leg shares the ONE `expiration` field (linked, S7.2) — the
  // shared field renders once, on the first such leg.
  const expirationFor = (i: number): string =>
    legs[i]?.tbdAllowed ? (expirationByLeg[i] ?? '') : expiration
  const setExpirationFor = (i: number, value: string): void => {
    if (legs[i]?.tbdAllowed) setExpirationByLeg((prev) => ({ ...prev, [i]: value }))
    else setExpiration(value)
  }
  const firstConcreteOptionLegIndex = legs.findIndex(
    (l) => l.instrumentKind === 'option' && !l.tbdAllowed,
  )

  const canConfirm =
    Boolean(accountId) &&
    thesis.trim().length > 0 &&
    ticker.trim().length > 0 &&
    legs.every((_, i) => Number(qtyFor(i)) > 0) &&
    (!requiresExpiration || expiration.trim().length > 0) &&
    legs.every(
      (l, i) => l.instrumentKind !== 'option' || l.tbdAllowed || strikeFor(i).trim().length > 0,
    ) &&
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
    if (!canConfirm || legs.length === 0) return
    const exitLevels: ExitLevel[] = []
    if (stopTemplate) exitLevels.push(buildExitLevel('stop', stopTemplate, stop))
    if (targetTemplate) exitLevels.push(buildExitLevel('target', targetTemplate, target))

    const tickerUpper = ticker.trim().toUpperCase()
    const plannedLegs: PlanDraft['plannedLegs'] = legs.map((l, i) => ({
      side: l.side,
      qty: Number(qtyFor(i)),
      instrument:
        l.instrumentKind === 'option'
          ? {
              kind: 'option' as const,
              ticker: tickerUpper,
              type: l.optionType!,
              ...(expirationFor(i).trim() ? { expiration: expirationFor(i) } : {}),
              ...(strikeFor(i).trim() ? { strike: dollarsToCents(strikeFor(i)) } : {}),
            }
          : { kind: 'stock' as const, ticker: tickerUpper },
    }))

    const draft: PlanDraft = {
      accountId,
      thesis: thesis.trim(),
      strategyId,
      ideaSourceId,
      plannedLegs,
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

        {legs.map((l, i) => (
          <fieldset key={i} className="space-y-3 rounded-lg border border-slate-200 p-4">
            <legend className="px-1 text-sm font-medium text-slate-700">
              {isMultiLeg ? `Planned Leg ${i + 1}` : 'Planned Leg'}
            </legend>
            <span className="inline-block text-sm text-slate-500 capitalize">
              {l.side} {l.instrumentKind}
            </span>
            {i === 0 && (
              <label className={field}>
                Ticker
                <input
                  className={input}
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                />
              </label>
            )}
            {l.instrumentKind === 'option' && (
              <>
                {(l.tbdAllowed || i === firstConcreteOptionLegIndex) && (
                  <>
                    <label className={field}>
                      Expiration{l.tbdAllowed ? ' (optional — TBD until the fill)' : ''}
                      <input
                        type="date"
                        className={input}
                        value={expirationFor(i)}
                        onChange={(e) => setExpirationFor(i, e.target.value)}
                      />
                    </label>
                    {l.tbdAllowed && !expirationFor(i).trim() && (
                      <p className="text-xs text-slate-500">Expiration TBD — set at the fill</p>
                    )}
                  </>
                )}
                <label className={field}>
                  Strike{l.tbdAllowed ? ' (optional — TBD until the fill)' : ''}
                  <input
                    className={`${input} ${num}`}
                    value={strikeFor(i)}
                    onChange={(e) => setStrikeFor(i, e.target.value)}
                    inputMode="decimal"
                  />
                </label>
                {l.tbdAllowed && !strikeFor(i).trim() && (
                  <p className="text-xs text-slate-500">Strike TBD — set at the fill</p>
                )}
              </>
            )}
            <label className={field}>
              Quantity
              {isMultiLeg
                ? ` (${l.side} ${l.instrumentKind === 'option' ? (l.optionType ?? 'option') : l.instrumentKind})`
                : ''}
              <input
                className={`${input} ${num}`}
                value={qtyFor(i)}
                onChange={(e) => setQtyFor(i, e.target.value)}
                inputMode="numeric"
              />
            </label>
          </fieldset>
        ))}

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
