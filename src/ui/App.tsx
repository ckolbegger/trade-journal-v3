import { useCallback, useEffect, useState } from 'react'
import { addAccount, addInstitution, establish, type AppState } from './controller'
import {
  confirmPlanFromDraft, initialPlanState, loadPlannedTrades, previewPlan,
  type PlanDraft, type PlanState,
} from './plan-controller'
import { openDb } from '../persistence/db'
import { queryOpenTrades, type StoredOpenTrade } from '../domain/open-views'
import { recordOpeningPositionChange } from './position-controller'
import type { ReflectionDisposition } from '../domain/position-change-reflection'

const initial: AppState = {
  view: 'loading', institutions: [], accounts: [], message: '', layout: 'wide', protection: '',
  readiness: { outcome: 'Writable', passed: true, failedChecks: [], protection: { kind: 'BestEffort', reason: 'checking' } },
}
const emptyDraft: PlanDraft = {
  accountId: '', underlying: '', quantity: '', entry: '', stop: '', target: '', thesis: '', invalidation: '',
}
type Screen = 'accounts' | 'new-plan' | 'trades'

type ExecutionDraft = { instrument: string; quantity: string; price: string; fee: string; economicTime: string }
const emptyExecution = (): ExecutionDraft => ({
  instrument: '', quantity: '', price: '', fee: '', economicTime: '2026-11-24T20:00:00Z',
})
type PositionForm = {
  executions: ExecutionDraft[]
  reflection: 'Defer' | 'Decline' | 'Complete'
  decisionMode: string
  primaryEmotion: string
  decisionConfidence: string
  note: string
  declineReason: string
}
const emptyPositionForm = (): PositionForm => ({
  executions: [emptyExecution()], reflection: 'Defer', decisionMode: '', primaryEmotion: '',
  decisionConfidence: '', note: '', declineReason: '',
})

function dispositionOf(form: PositionForm): ReflectionDisposition {
  if (form.reflection === 'Complete') {
    return {
      kind: 'Complete',
      form: {
        decisionMode: form.decisionMode,
        primaryEmotion: form.primaryEmotion,
        decisionConfidence: Number(form.decisionConfidence),
        ...(form.note ? { note: form.note } : {}),
      },
    }
  }
  if (form.reflection === 'Decline') return { kind: 'Decline', reason: form.declineReason || undefined }
  return { kind: 'Defer' }
}

export function App() {
  const [state, setState] = useState<AppState>(initial)
  const [screen, setScreen] = useState<Screen>('accounts')
  const [institutionName, setInstitutionName] = useState('')
  const [accountName, setAccountName] = useState('')
  const [institutionId, setInstitutionId] = useState('')
  const [draft, setDraft] = useState<PlanDraft>(emptyDraft)
  const [plan, setPlan] = useState<PlanState>(initialPlanState)
  const [openTrades, setOpenTrades] = useState<StoredOpenTrade[]>([])
  const [selectedOpen, setSelectedOpen] = useState<StoredOpenTrade | null>(null)
  const [executingId, setExecutingId] = useState<string | null>(null)
  const [positionForm, setPositionForm] = useState<PositionForm>(emptyPositionForm())
  const [positionError, setPositionError] = useState('')

  useEffect(() => {
    void establish().then(s => {
      setState(s)
      setDraft(d => ({ ...d, accountId: s.accounts[0]?.id ?? '' }))
    })
    const onResize = () => setState(s => ({ ...s, layout: window.innerWidth >= 900 ? 'wide' : 'narrow' }))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const onAddInstitution = useCallback(async () => {
    if (!institutionName.trim()) return
    const next = await addInstitution(institutionName.trim(), state)
    setState(next)
    setInstitutionId(institutionId || next.institutions.at(-1)?.id || '')
    setInstitutionName('')
  }, [institutionName, state, institutionId])

  const onAddAccount = useCallback(async () => {
    if (!accountName.trim()) return
    const next = await addAccount(accountName.trim(), institutionId, state)
    setState(next)
    setDraft(d => ({ ...d, accountId: next.accounts.at(-1)?.id ?? d.accountId }))
    setAccountName('')
  }, [accountName, institutionId, state])

  const preview = previewPlan(draft)

  const refreshTrades = useCallback(async () => {
    const planned = await loadPlannedTrades()
    setPlan({ ...initialPlanState, confirmed: planned })
    setOpenTrades(await queryOpenTrades(await openDb()))
  }, [])

  const onConfirmPlan = useCallback(async () => {
    const { error } = await confirmPlanFromDraft(draft, state.accounts, state.institutions)
    if (error) { setPlan(p => ({ ...p, error })); return }
    await refreshTrades()
    setSelectedOpen(null)
    setScreen('trades')
    setDraft(emptyDraft)
  }, [draft, state.accounts, state.institutions, refreshTrades])

  const onOpenTrades = useCallback(async () => {
    await refreshTrades()
    setScreen('trades')
  }, [refreshTrades])

  const onRecordPosition = useCallback(async (tradeId: string, expectedRevision: string) => {
    const result = await recordOpeningPositionChange({
      tradeId,
      expectedRevision,
      positionChangeId: `pc-${tradeId}`,
      economicTime: '2026-11-24T20:00:00Z',
      executions: positionForm.executions.map((e, index) => ({
        id: `exec-${tradeId}-${index + 1}`,
        instrument: e.instrument,
        action: 'Buy' as const,
        quantity: e.quantity,
        price: e.price,
        fee: e.fee,
        economicTime: e.economicTime,
        plannedLegId: 'leg-1',
      })),
      reflection: { definitionRevision: 'D1', disposition: dispositionOf(positionForm) },
      readiness: state.readiness,
    })
    if (!result.ok) {
      setPositionError(result.error.kind === 'Validation'
        ? result.error.issues.join(', ')
        : 'Writes are disabled until Runtime Readiness is Writable.')
      return
    }
    setPositionError('')
    setExecutingId(null)
    setPositionForm(emptyPositionForm())
    await refreshTrades()
    setSelectedOpen(result.value.trade)
  }, [positionForm, state.readiness, refreshTrades])

  const updateExecution = (index: number, field: keyof ExecutionDraft, value: string) => {
    setPositionForm(f => ({
      ...f,
      executions: f.executions.map((e, i) => i === index ? { ...e, [field]: value } : e),
    }))
  }

  return (
    <main data-view={state.view} data-layout={state.layout}>
      <div className="shell">
        <header>
          <h1>Trade Journal V3</h1>
          <nav aria-label="Primary">
            <button type="button" aria-current={screen === 'accounts' ? 'page' : undefined} onClick={() => setScreen('accounts')}>Institutions &amp; Accounts</button>
            <button type="button">Workspace</button>
            <button type="button" aria-current={screen === 'new-plan' ? 'page' : undefined} onClick={() => setScreen('new-plan')}>New Plan</button>
            <button type="button" aria-current={screen === 'trades' ? 'page' : undefined} onClick={() => { void onOpenTrades() }}>Trades</button>
          </nav>
        </header>
        <section aria-live="polite">
          {state.view === 'loading' && <p>Verifying startup…</p>}
          {state.view === 'error' && <p role="alert">{state.message}</p>}
          {(state.view === 'empty' || state.view === 'ready') && (
            <>
              {screen === 'accounts' && (
                <>
                  {state.view === 'empty' && <p>No institutions or accounts recorded yet.</p>}
                  {state.message && <p role="alert">{state.message}</p>}
                  <form onSubmit={e => { e.preventDefault(); void onAddInstitution() }}>
                    <label htmlFor="inst-name">Institution name</label>
                    <input id="inst-name" value={institutionName} onChange={e => setInstitutionName(e.target.value)} />
                    <button type="submit">Add institution</button>
                  </form>
                  <form onSubmit={e => { e.preventDefault(); void onAddAccount() }}>
                    <label htmlFor="acct-name">Account name</label>
                    <input id="acct-name" value={accountName} onChange={e => setAccountName(e.target.value)} />
                    <label htmlFor="acct-inst">Institution</label>
                    <select id="acct-inst" value={institutionId} onChange={e => setInstitutionId(e.target.value)}>
                      <option value="">Choose…</option>
                      {state.institutions.map(i => <option key={i.id} value={i.id}>{i.label}</option>)}
                    </select>
                    <button type="submit">Add account</button>
                  </form>
                  <section aria-label="Institutions"><h2>Institutions</h2><ul>{state.institutions.map(i => <li key={i.id}>{i.label}</li>)}</ul></section>
                  <section aria-label="Accounts"><h2>Accounts</h2><ul>{state.accounts.map(a => <li key={a.id}>{a.label}</li>)}</ul></section>
                  <section aria-label="Workspace"><h2>Workspace</h2><p>Storage protection: {state.protection || 'checking…'}</p></section>
                </>
              )}

              {screen === 'new-plan' && (
                <section aria-label="New Plan">
                  <h2>New Plan — Long Stock</h2>
                  <form onSubmit={e => { e.preventDefault(); void onConfirmPlan() }}>
                    <label htmlFor="strategy">Strategy</label>
                    <select id="strategy" value="seed-long-stock" readOnly>
                      <option value="seed-long-stock">Long Stock</option>
                    </select>
                    <label htmlFor="underlying">Underlying</label>
                    <input id="underlying" value={draft.underlying} onChange={e => setDraft({ ...draft, underlying: e.target.value })} />
                    <label htmlFor="quantity">Quantity</label>
                    <input id="quantity" value={draft.quantity} onChange={e => setDraft({ ...draft, quantity: e.target.value })} />
                    <label htmlFor="entry">Entry price</label>
                    <input id="entry" value={draft.entry} onChange={e => setDraft({ ...draft, entry: e.target.value })} />
                    <label htmlFor="stop">Stop price</label>
                    <input id="stop" value={draft.stop} onChange={e => setDraft({ ...draft, stop: e.target.value })} />
                    <label htmlFor="target">Target price</label>
                    <input id="target" value={draft.target} onChange={e => setDraft({ ...draft, target: e.target.value })} />
                    <label htmlFor="thesis">Thesis</label>
                    <textarea id="thesis" value={draft.thesis} onChange={e => setDraft({ ...draft, thesis: e.target.value })} />
                    <label htmlFor="invalidation">Invalidation</label>
                    <textarea id="invalidation" value={draft.invalidation} onChange={e => setDraft({ ...draft, invalidation: e.target.value })} />
                    <div className="preview">
                      <p>1R: <span data-testid="one-r">{preview.oneR}</span></p>
                      <p>Plan R:R: <span data-testid="baseline">{preview.baseline}</span></p>
                    </div>
                    {(plan.error || preview.error) && <p role="alert">{plan.error || preview.error}</p>}
                    <button type="submit">Confirm plan</button>
                  </form>
                </section>
              )}

              {screen === 'trades' && (
                <>
                  <section aria-label="Planned trades" data-screen="planned">
                    <h2>Planned trades</h2>
                    <ul>
                      {plan.confirmed.map(t => (
                        <li key={t.trade.id}>
                          <button type="button" onClick={() => {
                            setSelectedOpen(null)
                            setExecutingId(null)
                            setPlan({ ...plan, screen: 'detail', selected: t })
                          }}>
                            {t.trade.plan.underlying}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section aria-label="Open trades" data-screen="open">
                    <h2>Open trades</h2>
                    <ul>
                      {openTrades.map(t => (
                        <li key={t.id}>
                          <button type="button" onClick={() => {
                            setPlan(p => ({ ...p, screen: 'list', selected: null }))
                            setSelectedOpen(t)
                          }}>
                            {t.plan.underlying}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>

                  {plan.screen === 'detail' && plan.selected && !selectedOpen && (
                    <section aria-label="Trade detail">
                      <h3>{plan.selected.trade.plan.underlying} Plan</h3>
                      <p>Lifecycle: <span data-testid="trade-lifecycle">{plan.selected.trade.lifecycle}</span></p>
                      <p>1R: <span data-testid="trade-one-r">{plan.selected.trade.plan.oneR}</span></p>
                      <p>Plan R:R: {plan.selected.trade.plan.baseline}</p>
                      <section aria-label="Plan Reflection" data-testid="plan-reflection">
                        <h4>Plan Reflection</h4>
                        <p>Thesis: {String(plan.selected.entry.snapshot?.answers?.Thesis ?? '')}</p>
                        <p>Invalidation: {String(plan.selected.entry.snapshot?.answers?.Invalidation ?? '')}</p>
                      </section>
                      <button type="button" onClick={() => {
                        setExecutingId(plan.selected!.trade.id)
                        setPositionForm(emptyPositionForm())
                        setPositionError('')
                      }}>Add execution</button>
                      {executingId === plan.selected.trade.id && (
                        <form aria-label="Add execution" onSubmit={e => {
                          e.preventDefault()
                          void onRecordPosition(plan.selected!.trade.id, plan.selected!.revisions.trade)
                        }}>
                          {positionForm.executions.map((execution, index) => (
                            <fieldset key={index}>
                              <legend>Execution {index + 1}</legend>
                              <label htmlFor={`ex-inst-${index}`}>Execution {index + 1} instrument</label>
                              <input id={`ex-inst-${index}`} value={execution.instrument} onChange={e => updateExecution(index, 'instrument', e.target.value)} />
                              <label htmlFor={`ex-qty-${index}`}>Execution {index + 1} quantity</label>
                              <input id={`ex-qty-${index}`} value={execution.quantity} onChange={e => updateExecution(index, 'quantity', e.target.value)} />
                              <label htmlFor={`ex-price-${index}`}>Execution {index + 1} price</label>
                              <input id={`ex-price-${index}`} value={execution.price} onChange={e => updateExecution(index, 'price', e.target.value)} />
                              <label htmlFor={`ex-fee-${index}`}>Execution {index + 1} fee</label>
                              <input id={`ex-fee-${index}`} value={execution.fee} onChange={e => updateExecution(index, 'fee', e.target.value)} />
                              <label htmlFor={`ex-time-${index}`}>Execution {index + 1} economic time</label>
                              <input id={`ex-time-${index}`} value={execution.economicTime} onChange={e => updateExecution(index, 'economicTime', e.target.value)} />
                            </fieldset>
                          ))}
                          <button type="button" onClick={() => setPositionForm(f => ({
                            ...f, executions: [...f.executions, emptyExecution()],
                          }))}>Add another execution</button>
                          <fieldset>
                            <legend>Position Change Reflection</legend>
                            <label><input type="radio" name="reflection" checked={positionForm.reflection === 'Defer'} onChange={() => setPositionForm(f => ({ ...f, reflection: 'Defer' }))} /> Defer reflection</label>
                            <label><input type="radio" name="reflection" checked={positionForm.reflection === 'Decline'} onChange={() => setPositionForm(f => ({ ...f, reflection: 'Decline' }))} /> Decline reflection</label>
                            <label><input type="radio" name="reflection" checked={positionForm.reflection === 'Complete'} onChange={() => setPositionForm(f => ({ ...f, reflection: 'Complete' }))} /> Complete reflection</label>
                            {positionForm.reflection === 'Complete' && (
                              <>
                                <label htmlFor="decision-mode">Decision mode</label>
                                <select id="decision-mode" value={positionForm.decisionMode} onChange={e => setPositionForm(f => ({ ...f, decisionMode: e.target.value }))}>
                                  <option value="">Choose…</option>
                                  <option>As Planned</option>
                                  <option>Deliberate Adjustment</option>
                                  <option>Reactive</option>
                                  <option>Externally Imposed</option>
                                </select>
                                <label htmlFor="primary-emotion">Primary emotion</label>
                                <select id="primary-emotion" value={positionForm.primaryEmotion} onChange={e => setPositionForm(f => ({ ...f, primaryEmotion: e.target.value }))}>
                                  <option value="">Choose…</option>
                                  <option>Calm</option><option>Eager</option><option>Anxious</option><option>FOMO</option>
                                  <option>Revenge</option><option>Relieved</option><option>Frustrated</option><option>Other</option>
                                </select>
                                <label htmlFor="decision-confidence">Decision confidence</label>
                                <input id="decision-confidence" value={positionForm.decisionConfidence} onChange={e => setPositionForm(f => ({ ...f, decisionConfidence: e.target.value }))} />
                                <label htmlFor="reflection-note">Note</label>
                                <input id="reflection-note" value={positionForm.note} onChange={e => setPositionForm(f => ({ ...f, note: e.target.value }))} />
                              </>
                            )}
                            {positionForm.reflection === 'Decline' && (
                              <>
                                <label htmlFor="decline-reason">Decline reason</label>
                                <input id="decline-reason" value={positionForm.declineReason} onChange={e => setPositionForm(f => ({ ...f, declineReason: e.target.value }))} />
                              </>
                            )}
                          </fieldset>
                          {positionError && <p role="alert">{positionError}</p>}
                          <button type="submit">Record position change</button>
                        </form>
                      )}
                    </section>
                  )}

                  {selectedOpen && (
                    <section aria-label="Open trade detail">
                      <h3>{selectedOpen.plan.underlying} position</h3>
                      <p>Lifecycle: <span data-testid="trade-lifecycle">{selectedOpen.lifecycle}</span></p>
                      <p>Position: <span data-testid="open-position">{selectedOpen.positions[0]?.netQuantity ?? '0'}</span> shares</p>
                      <p data-testid="open-lots">{selectedOpen.lots.length} open lots</p>
                      <p>Allocated opening fees: <span data-testid="open-fees">{selectedOpen.lots.reduce((sum, l) => sum + Number(l.allocatedOpeningFee), 0).toFixed(2)}</span></p>
                      <p>Realized to date: <span data-testid="realized-to-date">{selectedOpen.realizedToDate}</span></p>
                      <section aria-label="Executions">
                        <h4>Executions</h4>
                        <ul>{selectedOpen.executions.map(e => (
                          <li key={e.id}>{e.instrument} · {e.quantity} @ {e.price} · fee {e.fee}</li>
                        ))}</ul>
                      </section>
                      <section aria-label="Open Lots">
                        <h4>Open Lots</h4>
                        <ul>{selectedOpen.lots.map(l => (
                          <li key={l.id}>{l.instrument} · {l.quantity} · basis {l.basis} · allocated fee {l.allocatedOpeningFee}</li>
                        ))}</ul>
                      </section>
                    </section>
                  )}
                </>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  )
}
