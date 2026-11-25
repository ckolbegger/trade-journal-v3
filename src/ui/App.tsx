import { useCallback, useEffect, useState } from 'react'
import { addAccount, addInstitution, establish, type AppState } from './controller'
import {
  confirmPlanFromDraft, initialPlanState, loadPlannedTrades, previewPlan,
  type PlanDraft, type PlanState,
} from './plan-controller'
import { openDb } from '../persistence/db'
import { queryOpenTrades, type StoredOpenTrade } from '../domain/open-views'
import { recordOpeningPositionChange } from './position-controller'
import { formatIssues } from './issue-copy'
import { requestDurability } from '../domain/workspace'
import { evaluateOpenTrade, saveManualMark } from './market-controller'
import {
  newActionForm, openReview, saveTradeAction, resolveReviewDebt,
  type ReviewView,
} from './review-controller'
import type { DailyActionForm } from '../domain/daily-action'
import type { CalculationResult } from '../domain/calculation'
import type { ReflectionDisposition } from '../domain/position-change-reflection'

const initial: AppState = {
  view: 'loading', institutions: [], accounts: [], message: '', layout: 'wide', protection: '',
  readiness: { outcome: 'Writable', passed: true, failedChecks: [], protection: { kind: 'BestEffort', reason: 'checking' } },
}
const emptyDraft: PlanDraft = {
  accountId: '', underlying: '', quantity: '', entry: '', stop: '', target: '', thesis: '', invalidation: '',
}
type Screen = 'accounts' | 'status' | 'new-plan' | 'trades' | 'review'

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

const monogram = (label: string) => label.slice(0, 2).toUpperCase()
const completionLabel = (state: string) =>
  state === 'CompleteWithUnavailableMarks' ? 'Complete with unavailable Marks' : state
// Explicit View Moment: noon Tuesday resolves Monday as the Expected Mark Date.
const VIEW_MOMENT = new Date('2026-11-24T17:00:00Z')

function resultText(result: CalculationResult<string>, testId: string) {
  if (result.kind === 'Value') return <span className="num" data-testid={testId}>{result.value}</span>
  if (result.kind === 'Unavailable') {
    return <span className="unavailable" data-testid={testId}>Unavailable: {result.reason} ({result.details.instrument}, {result.details.date})</span>
  }
  if (result.kind === 'Unbounded') return <span data-testid={testId}>Unbounded {result.direction}: {result.explanation}</span>
  return <span data-testid={testId}>Not applicable: {result.reason}</span>
}

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
  const [durabilityMessage, setDurabilityMessage] = useState('')
  const [selectedEvaluation, setSelectedEvaluation] = useState<Awaited<ReturnType<typeof evaluateOpenTrade>> | null>(null)
  const [markDraft, setMarkDraft] = useState({ price: '', reason: '' })
  const [markError, setMarkError] = useState('')
  const [markMessage, setMarkMessage] = useState('')
  const [review, setReview] = useState<ReviewView | null>(null)
  const [actionForms, setActionForms] = useState<Record<string, DailyActionForm>>({})
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, { price: string; reason: string }>>({})
  const [reviewMessage, setReviewMessage] = useState('')
  const [reviewError, setReviewError] = useState('')

  useEffect(() => {
    void establish().then(s => {
      setState(s)
      setDraft(d => ({ ...d, accountId: s.accounts[0]?.id ?? '' }))
    })
    const onResize = () => setState(s => ({ ...s, layout: window.innerWidth >= 900 ? 'wide' : 'narrow' }))
    window.addEventListener('resize', onResize)
    // A production worker can gain control after first paint; re-establish
    // readiness without disturbing entered-but-unsaved form state.
    const sw = 'serviceWorker' in navigator ? navigator.serviceWorker : undefined
    const onControllerChange = () => {
      void establish().then(next => setState(s => ({
        ...s, view: next.view, message: next.message, readiness: next.readiness,
      })))
    }
    sw?.addEventListener('controllerchange', onControllerChange)
    return () => {
      window.removeEventListener('resize', onResize)
      sw?.removeEventListener('controllerchange', onControllerChange)
    }
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

  const showOpen = useCallback(async (trade: StoredOpenTrade) => {
    setPlan(p => ({ ...p, screen: 'list', selected: null }))
    setSelectedOpen(trade)
    // Clear stale form state before the async load so a value typed while the
    // evaluation resolves is not wiped afterwards.
    setMarkDraft({ price: '', reason: '' })
    setMarkError('')
    setMarkMessage('')
    setSelectedEvaluation(await evaluateOpenTrade(trade, await openDb(), VIEW_MOMENT))
  }, [])

  const onSaveMark = useCallback(async (intention: 'RecordManualMark' | 'AcknowledgeUnavailable') => {
    if (!selectedOpen || !selectedEvaluation) return
    const result = await saveManualMark({
      instrument: selectedOpen.plan.underlying,
      date: selectedEvaluation.expectedDate,
      expectedRevision: selectedEvaluation.revision,
      intention,
      price: intention === 'RecordManualMark' ? markDraft.price : undefined,
      reason: intention === 'AcknowledgeUnavailable' ? markDraft.reason : undefined,
      observedAt: `${selectedEvaluation.expectedDate}T20:00:00Z`,
      savedAt: VIEW_MOMENT.toISOString(),
      readiness: state.readiness,
    })
    if (!result.ok) {
      setMarkError(result.error.kind === 'Validation'
        ? formatIssues(result.error.issues)
        : 'Writes are disabled until Runtime Readiness is Writable.')
      return
    }
    setMarkError('')
    setMarkDraft({ price: '', reason: '' })
    setMarkMessage(intention === 'RecordManualMark' ? 'Manual Mark recorded.' : 'Unavailability acknowledged.')
    setSelectedEvaluation(await evaluateOpenTrade(selectedOpen, await openDb(), VIEW_MOMENT))
  }, [selectedOpen, selectedEvaluation, markDraft, state.readiness])

  const onOpenReview = useCallback(async () => {
    setScreen('review')
    const next = await openReview(VIEW_MOMENT)
    setReview(next)
    setActionForms(Object.fromEntries(next.items.map(i => [i.trade.id, newActionForm()])))
    setReviewDrafts(Object.fromEntries(next.items.map(i => [i.trade.id, { price: '', reason: '' }])))
    setReviewMessage('')
    setReviewError('')
  }, [])

  const onReviewMark = useCallback(async (tradeId: string, intention: 'RecordManualMark' | 'AcknowledgeUnavailable') => {
    if (!review) return
    const item = review.items.find(i => i.trade.id === tradeId)
    if (!item) return
    const draft = reviewDrafts[tradeId] ?? { price: '', reason: '' }
    const result = await saveManualMark({
      instrument: item.trade.plan.underlying,
      date: review.reviewDate,
      expectedRevision: item.frame.revision ?? '0',
      intention,
      price: intention === 'RecordManualMark' ? draft.price : undefined,
      reason: intention === 'AcknowledgeUnavailable' ? draft.reason : undefined,
      observedAt: `${review.reviewDate}T20:00:00Z`,
      savedAt: VIEW_MOMENT.toISOString(),
      readiness: state.readiness,
    })
    if (!result.ok) {
      setReviewError(result.error.kind === 'Validation' ? formatIssues(result.error.issues) : 'Writes are disabled until Runtime Readiness is Writable.')
      return
    }
    setReviewError('')
    setReviewMessage(intention === 'RecordManualMark' ? 'Mark recorded.' : 'Unavailability acknowledged.')
    setReview(await openReview(VIEW_MOMENT))
  }, [review, reviewDrafts, state.readiness])

  const onSaveAction = useCallback(async (tradeId: string) => {
    if (!review) return
    const result = await saveTradeAction({
      tradeId, reviewDate: review.reviewDate, definitionRevision: 'D1',
      form: actionForms[tradeId] ?? newActionForm(),
      expectedDigest: review.snapshot.digest,
      expectedTradeRevision: review.items.find(i => i.trade.id === tradeId)?.trade.revision ?? '1',
      readiness: state.readiness, now: VIEW_MOMENT,
    })
    if (!result.ok) {
      setReviewError(result.error.kind === 'Validation'
        ? formatIssues(result.error.issues)
        : result.error.kind === 'MarkMissing'
          ? 'An exact Mark is required before saving an Action.'
          : result.error.kind === 'ReviewChanged'
            ? 'Evidence changed; review it and save again.'
            : 'The Action could not be saved.')
      if (result.error.kind === 'ReviewChanged') setReview(result.error.refreshed)
      return
    }
    setReviewError('')
    setReviewMessage(result.value.nextStep)
    setReview(await openReview(VIEW_MOMENT))
  }, [review, actionForms, state.readiness])

  const onResolveDebt = useCallback(async (debtId: string, text: string) => {
    const result = await resolveReviewDebt({ debtId, form: { text }, readiness: state.readiness })
    if (!result.ok) {
      setReviewError(result.error.kind === 'NeedsTradeWorkflow'
        ? 'This Debt must be resolved in its Trade Workflow.'
        : 'The Debt could not be resolved.')
      return
    }
    setReviewError('')
    setReviewMessage('Debt resolved.')
    setReview(await openReview(VIEW_MOMENT))
  }, [state.readiness])

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
        ? formatIssues(result.error.issues)
        : 'Writes are disabled until Runtime Readiness is Writable.')
      return
    }
    setPositionError('')
    setExecutingId(null)
    setPositionForm(emptyPositionForm())
    await refreshTrades()
    await showOpen(result.value.trade)
  }, [positionForm, state.readiness, refreshTrades, showOpen])

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
            <button type="button" aria-current={screen === 'accounts' ? 'page' : undefined} onClick={() => setScreen('accounts')}>Accounts</button>
            <button type="button" aria-current={screen === 'status' ? 'page' : undefined} onClick={() => setScreen('status')}>Status</button>
            <button type="button" aria-current={screen === 'new-plan' ? 'page' : undefined} onClick={() => setScreen('new-plan')}>New Plan</button>
            <button type="button" aria-current={screen === 'trades' ? 'page' : undefined} onClick={() => { void onOpenTrades() }}>Trades</button>
            <button type="button" aria-current={screen === 'review' ? 'page' : undefined} onClick={() => { void onOpenReview() }}>Review</button>
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
                  <section aria-label="Institutions" className="card"><h2>Institutions</h2><ul>{state.institutions.map(i => <li key={i.id}>{i.label}</li>)}</ul></section>
                  <section aria-label="Accounts" className="card"><h2>Accounts</h2><ul>{state.accounts.map(a => <li key={a.id}>{a.label}</li>)}</ul></section>
                </>
              )}

              {screen === 'status' && (
                <section aria-label="Workspace status" className="card">
                  <p className="section-label">Workspace status</p>
                  <h2>Status</h2>
                  <p>Runtime Readiness: {state.readiness.outcome}</p>
                  <p>Storage protection: {state.readiness.protection.kind}</p>
                  {state.readiness.failedChecks.length > 0 && (
                    <p role="alert">Checks not passing: {state.readiness.failedChecks.join(', ')}</p>
                  )}
                  {state.readiness.protection.kind !== 'Protected' && (
                    <>
                      <p className="muted">This browser may clear journal data. Download a backup and keep a copy elsewhere; backup is not yet available in this build.</p>
                      <button type="button" onClick={() => setDurabilityMessage(
                        requestDurability(state.readiness.protection) === 'AlreadyProtected'
                          ? 'Storage is already protected.'
                          : 'This browser does not offer a stronger protection request.',
                      )}>Request stronger storage protection</button>
                    </>
                  )}
                  {durabilityMessage && <p role="status">{durabilityMessage}</p>}
                  <p className="muted">Journal data stays on this device.</p>
                </section>
              )}

              {screen === 'new-plan' && (
                <section aria-label="New Plan" className="card">
                  <p className="section-label">New plan</p>
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
                  <section aria-label="Planned trades" data-screen="planned" className="card">
                    <p className="section-label">Planned trades</p>
                    <h2>Planned trades</h2>
                    <ul>
                      {plan.confirmed.map(t => (
                        <li key={t.trade.id}>
                          <button type="button" className="trade-row" onClick={() => {
                            setSelectedOpen(null)
                            setExecutingId(null)
                            setPlan({ ...plan, screen: 'detail', selected: t })
                          }}>
                            <span className="monogram" aria-hidden="true">{monogram(t.trade.plan.underlying)}</span>
                            <span className="row-main">
                              <span className="row-title">{t.trade.plan.underlying}</span>
                              <span className="row-sub">Long Stock · 1R {t.trade.plan.oneR}</span>
                            </span>
                            <span className="badge badge-planned">Planned</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section aria-label="Open trades" data-screen="open" className="card">
                    <p className="section-label">Open trades</p>
                    <h2>Open trades</h2>
                    <ul>
                      {openTrades.map(t => (
                        <li key={t.id}>
                          <button type="button" className="trade-row" onClick={() => { void showOpen(t) }}>
                            <span className="monogram" aria-hidden="true">{monogram(t.plan.underlying)}</span>
                            <span className="row-main">
                              <span className="row-title">{t.plan.underlying}</span>
                              <span className="row-sub">Long Stock · {t.lots.length} lots</span>
                            </span>
                            <span className="num positive">{t.realizedToDate}</span>
                            <span className="badge badge-open">Open</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>

                  {plan.screen === 'detail' && plan.selected && !selectedOpen && (
                    <section aria-label="Trade detail">
                      <section className="card">
                        <div className="sheet-header">
                          <div>
                            <p className="section-label">Planned trade</p>
                            <h3>{plan.selected.trade.plan.underlying} Plan</h3>
                          </div>
                          <span className="badge badge-planned" data-testid="trade-lifecycle">{plan.selected.trade.lifecycle}</span>
                        </div>
                        <div className="figure-grid">
                          <div><p className="section-label">1R</p><p className="figure-value num" data-testid="trade-one-r">{plan.selected.trade.plan.oneR}</p></div>
                          <div><p className="section-label">Plan R:R</p><p className="figure-value num">{plan.selected.trade.plan.baseline}</p></div>
                          <div><p className="section-label">Strategy</p><p className="figure-value">Long Stock</p></div>
                        </div>
                      </section>
                      <section aria-label="Plan Reflection" data-testid="plan-reflection" className="card">
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
                        <div className="sheet-backdrop">
                        <form className="sheet" aria-label="Add execution" onSubmit={e => {
                          e.preventDefault()
                          void onRecordPosition(plan.selected!.trade.id, plan.selected!.revisions.trade)
                        }}>
                          <div className="sheet-header">
                            <div>
                              <p className="section-label">Add execution</p>
                              <h3>{plan.selected.trade.plan.underlying}</h3>
                            </div>
                            <button type="button" onClick={() => { setExecutingId(null); setPositionError('') }}>Cancel</button>
                          </div>
                          <p className="section-label">Action</p>
                          <span className="action-pill">Buy</span>
                          {positionForm.executions.map((execution, index) => (
                            <fieldset key={index}>
                              <legend>Execution {index + 1}</legend>
                              <div className="field-grid">
                                <div>
                                  <label htmlFor={`ex-qty-${index}`}>Execution {index + 1} quantity</label>
                                  <input id={`ex-qty-${index}`} value={execution.quantity} onChange={e => updateExecution(index, 'quantity', e.target.value)} />
                                </div>
                                <div>
                                  <label htmlFor={`ex-price-${index}`}>Execution {index + 1} price</label>
                                  <input id={`ex-price-${index}`} value={execution.price} onChange={e => updateExecution(index, 'price', e.target.value)} />
                                </div>
                                <div>
                                  <label htmlFor={`ex-fee-${index}`}>Execution {index + 1} fee</label>
                                  <input id={`ex-fee-${index}`} value={execution.fee} onChange={e => updateExecution(index, 'fee', e.target.value)} />
                                </div>
                                <div>
                                  <label htmlFor={`ex-time-${index}`}>Execution {index + 1} economic time</label>
                                  <input id={`ex-time-${index}`} value={execution.economicTime} onChange={e => updateExecution(index, 'economicTime', e.target.value)} />
                                </div>
                              </div>
                              <div>
                                <label htmlFor={`ex-inst-${index}`}>Execution {index + 1} instrument</label>
                                <input id={`ex-inst-${index}`} value={execution.instrument} onChange={e => updateExecution(index, 'instrument', e.target.value)} />
                              </div>
                            </fieldset>
                          ))}
                          <div className="sheet-actions">
                            <button type="button" onClick={() => setPositionForm(f => ({
                              ...f, executions: [...f.executions, emptyExecution()],
                            }))}>Add another execution</button>
                          </div>
                          <fieldset>
                            <legend>Position Change Reflection</legend>
                            <label className="pill-option"><input type="radio" name="reflection" checked={positionForm.reflection === 'Defer'} onChange={() => setPositionForm(f => ({ ...f, reflection: 'Defer' }))} /> Defer reflection</label>
                            <label className="pill-option"><input type="radio" name="reflection" checked={positionForm.reflection === 'Decline'} onChange={() => setPositionForm(f => ({ ...f, reflection: 'Decline' }))} /> Decline reflection</label>
                            <label className="pill-option"><input type="radio" name="reflection" checked={positionForm.reflection === 'Complete'} onChange={() => setPositionForm(f => ({ ...f, reflection: 'Complete' }))} /> Complete reflection</label>
                            {positionForm.reflection === 'Complete' && (
                              <div className="field-grid">
                                <div>
                                  <label htmlFor="decision-mode">Decision mode</label>
                                  <select id="decision-mode" value={positionForm.decisionMode} onChange={e => setPositionForm(f => ({ ...f, decisionMode: e.target.value }))}>
                                    <option value="">Choose…</option>
                                    <option>As Planned</option>
                                    <option>Deliberate Adjustment</option>
                                    <option>Reactive</option>
                                    <option>Externally Imposed</option>
                                  </select>
                                </div>
                                <div>
                                  <label htmlFor="primary-emotion">Primary emotion</label>
                                  <select id="primary-emotion" value={positionForm.primaryEmotion} onChange={e => setPositionForm(f => ({ ...f, primaryEmotion: e.target.value }))}>
                                    <option value="">Choose…</option>
                                    <option>Calm</option><option>Eager</option><option>Anxious</option><option>FOMO</option>
                                    <option>Revenge</option><option>Relieved</option><option>Frustrated</option><option>Other</option>
                                  </select>
                                </div>
                                <div>
                                  <label htmlFor="decision-confidence">Decision confidence</label>
                                  <input id="decision-confidence" value={positionForm.decisionConfidence} onChange={e => setPositionForm(f => ({ ...f, decisionConfidence: e.target.value }))} />
                                </div>
                                <div>
                                  <label htmlFor="reflection-note">Note</label>
                                  <input id="reflection-note" value={positionForm.note} onChange={e => setPositionForm(f => ({ ...f, note: e.target.value }))} />
                                </div>
                              </div>
                            )}
                            {positionForm.reflection === 'Decline' && (
                              <>
                                <label htmlFor="decline-reason">Decline reason</label>
                                <input id="decline-reason" value={positionForm.declineReason} onChange={e => setPositionForm(f => ({ ...f, declineReason: e.target.value }))} />
                              </>
                            )}
                          </fieldset>
                          {positionError && <p role="alert">{positionError}</p>}
                          <div className="sheet-actions">
                            <button type="submit">Record position change</button>
                          </div>
                        </form>
                        </div>
                      )}
                    </section>
                  )}

                  {selectedOpen && (
                    <section aria-label="Open trade detail">
                      <section className="card">
                        <div className="sheet-header">
                          <div>
                            <p className="section-label">Long stock · open</p>
                            <h3>{selectedOpen.plan.underlying}</h3>
                          </div>
                          <span className="badge badge-open" data-testid="trade-lifecycle">{selectedOpen.lifecycle}</span>
                        </div>
                        <p className="section-label">Position</p>
                        <p className="headline num" data-testid="open-position">{selectedOpen.positions[0]?.netQuantity ?? '0'}</p>
                        <p className="muted">shares · net exposure from opening Executions</p>
                        <div className="figure-grid">
                          <div>
                            <p className="section-label">Open lots</p>
                            <p className="figure-value num" data-testid="open-lots">{selectedOpen.lots.length} open lots</p>
                          </div>
                          <div>
                            <p className="section-label">Allocated opening fees</p>
                            <p className="figure-value num" data-testid="open-fees">{selectedOpen.lots.reduce((sum, l) => sum + Number(l.allocatedOpeningFee), 0).toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="section-label">Realized to date</p>
                            <p className="figure-value num" data-testid="realized-to-date">{selectedOpen.realizedToDate}</p>
                          </div>
                        </div>
                      </section>
                      <section aria-label="Executions" className="card">
                        <h4>Executions</h4>
                        <ul className="detail-list">{selectedOpen.executions.map(e => (
                          <li key={e.id}>
                            <span>{e.instrument} · {e.quantity} @ {e.price}</span>
                            <span className="num">fee {e.fee}</span>
                          </li>
                        ))}</ul>
                      </section>
                      <section aria-label="Open Lots" className="card">
                        <h4>Open Lots</h4>
                        <ul className="detail-list">{selectedOpen.lots.map(l => (
                          <li key={l.id}>
                            <span>{l.instrument} · {l.quantity} · basis {l.basis}</span>
                            <span className="num">allocated fee {l.allocatedOpeningFee}</span>
                          </li>
                        ))}</ul>
                      </section>

                      {selectedEvaluation && (
                        <>
                          <section aria-label="Marks" className="card">
                            <p className="section-label">Marks</p>
                            <h4>Expected Mark Date</h4>
                            <p><span data-testid="expected-mark-date">{selectedEvaluation.expectedDate}</span> for {selectedOpen.plan.underlying}</p>
                            <p data-testid="mark-status">
                              {selectedEvaluation.frame.status === 'Available' ? 'Available' : selectedEvaluation.frame.status === 'AcknowledgedUnavailable' ? 'Acknowledged Unavailable' : 'Missing'}
                            </p>
                            {selectedEvaluation.frame.stale && (
                              <p className="muted">Stale context only: {selectedEvaluation.frame.stale.price} on {selectedEvaluation.frame.stale.date} (not a value).</p>
                            )}
                            <div className="field-grid">
                              <div>
                                <label htmlFor="manual-mark-price">Manual Mark price</label>
                                <input id="manual-mark-price" value={markDraft.price} onChange={e => setMarkDraft(d => ({ ...d, price: e.target.value }))} />
                              </div>
                              <div>
                                <label htmlFor="unavailability-reason">Unavailability reason</label>
                                <input id="unavailability-reason" value={markDraft.reason} onChange={e => setMarkDraft(d => ({ ...d, reason: e.target.value }))} />
                              </div>
                            </div>
                            <div className="sheet-actions">
                              <button type="button" onClick={() => { void onSaveMark('RecordManualMark') }}>Record mark</button>
                              <button type="button" onClick={() => { void onSaveMark('AcknowledgeUnavailable') }}>Acknowledge unavailable</button>
                            </div>
                            {markError && <p role="alert">{markError}</p>}
                            {markMessage && <p role="status">{markMessage}</p>}
                          </section>

                          <section aria-label="Risk and reward" className="card">
                            <p className="section-label">Risk and reward</p>
                            <div className="figure-grid">
                              <div><p className="section-label">Marked P&amp;L</p>{resultText(selectedEvaluation.evaluation.markedPnl, 'marked-pnl')}</div>
                              <div><p className="section-label">Ongoing risk to Stop</p>{resultText(selectedEvaluation.evaluation.ongoingRiskToStop, 'ongoing-risk')}</div>
                              <div><p className="section-label">Incremental reward</p>{resultText(selectedEvaluation.evaluation.incrementalReward, 'incremental-reward')}</div>
                              <div><p className="section-label">Worst-case ongoing risk</p>{resultText(selectedEvaluation.evaluation.worstCaseOngoingRisk, 'worst-case')}</div>
                              <div><p className="section-label">1R</p>{resultText(selectedEvaluation.evaluation.oneR, 'eval-one-r')}</div>
                              <div><p className="section-label">Plan R:R</p>{resultText(selectedEvaluation.evaluation.planBaseline, 'plan-baseline')}</div>
                              <div><p className="section-label">Stop Overrun</p>{resultText(selectedEvaluation.evaluation.overrun, 'overrun')}</div>
                              <div><p className="section-label">Max reward</p>{resultText(selectedEvaluation.evaluation.maxIncrementalReward, 'max-reward')}</div>
                              <div><p className="section-label">Plan-R risk</p>{resultText(selectedEvaluation.evaluation.planR.risk, 'plan-r-risk')}</div>
                            </div>
                            <h4>Conditions</h4>
                            <ul className="detail-list">
                              {selectedEvaluation.evaluation.conditions.map(c => (
                                <li key={c.id} data-testid={c.id === 'stop-underlying' ? 'condition-stop' : 'condition-target'}>
                                  <span>{c.kind}: {c.status}</span><span className="muted">{c.detail}</span>
                                </li>
                              ))}
                            </ul>
                            <p className="muted">Coverage: {selectedEvaluation.evaluation.coverage.instrument} on {selectedEvaluation.evaluation.coverage.date} · {selectedEvaluation.evaluation.coverage.status}. Gaps: {selectedEvaluation.gaps.length}.</p>
                          </section>
                        </>
                      )}
                    </section>
                  )}
                </>
              )}

              {screen === 'review' && (
                <section aria-label="Daily Review" className="card">
                  <p className="section-label">Daily review</p>
                  <h2>Review — <span data-testid="review-date">{review?.reviewDate ?? '…'}</span></h2>
                  <p data-testid="review-completion">{completionLabel(review?.completion.state ?? 'Incomplete')}</p>
                  <div className="steps">
                    {(['Marks', 'Debt', 'Settlement', 'Trades'] as const).map(step => (
                      <span key={step} data-review-step className={review?.tasks.some(t => t.kind === step) ? 'now' : ''}>{step}</span>
                    ))}
                  </div>
                  <p data-testid="action-gate" role="status">
                    {review?.missingMarks.length ? 'MarkMissing — record an exact Mark before saving an Action.' : 'Evidence ready'}
                  </p>
                  {review?.dueDebt.map(debt => (
                    <div key={debt.id} className="card">
                      <p>Due Debt: {debt.obligationKey}</p>
                      <button type="button" onClick={() => { void onResolveDebt(debt.id, 'resolved in review') }}>Resolve debt</button>
                    </div>
                  ))}
                  {review?.items.map(item => {
                    const form = actionForms[item.trade.id] ?? newActionForm()
                    const draft = reviewDrafts[item.trade.id] ?? { price: '', reason: '' }
                    const reconciled = (item.trade.deviations?.length ?? 0) > 0
                    return (
                      <section key={item.trade.id} className="card" aria-label={`Trade ${item.trade.plan.underlying}`}>
                        <div className="sheet-header">
                          <div>
                            <p className="section-label">{item.attention.band} · {item.attention.reasons.join(', ')}</p>
                            <h3>{item.trade.plan.underlying}</h3>
                          </div>
                          <span className="badge badge-open">{item.trade.lifecycle}</span>
                        </div>
                        <p data-testid="review-mark-status">
                          {item.frame.status === 'AcknowledgedUnavailable' ? 'Acknowledged Unavailable' : item.frame.status}
                        </p>
                        <div className="field-grid">
                          <div>
                            <label htmlFor={`review-price-${item.trade.id}`}>Review mark price</label>
                            <input id={`review-price-${item.trade.id}`} value={draft.price} onChange={e => setReviewDrafts(d => ({
                              ...d, [item.trade.id]: { ...draft, price: e.target.value },
                            }))} />
                          </div>
                          <div>
                            <label htmlFor={`review-reason-${item.trade.id}`}>Review unavailability reason</label>
                            <input id={`review-reason-${item.trade.id}`} value={draft.reason} onChange={e => setReviewDrafts(d => ({
                              ...d, [item.trade.id]: { ...draft, reason: e.target.value },
                            }))} />
                          </div>
                        </div>
                        <div className="sheet-actions">
                          <button type="button" onClick={() => { void onReviewMark(item.trade.id, 'RecordManualMark') }}>Record mark for review</button>
                          <button type="button" onClick={() => { void onReviewMark(item.trade.id, 'AcknowledgeUnavailable') }}>Acknowledge for review</button>
                        </div>
                        <p data-testid="review-episode">
                          {reconciled ? 'Stop episode reconciled' : item.replay.episodes.length
                            ? `Stop episode from ${item.replay.episodes[0].start}`
                            : 'No Stop episode'}
                        </p>
                        <fieldset>
                          <legend>Daily Trade Review Action</legend>
                          {(['Hold', 'Exit', 'Roll', 'Adjust'] as const).map(action => (
                            <label key={action} className="pill-option">
                              <input
                                type="radio"
                                name={`action-${item.trade.id}`}
                                checked={form.action === action}
                                onChange={() => setActionForms(f => ({ ...f, [item.trade.id]: { ...form, action } }))}
                              /> {action} action
                            </label>
                          ))}
                          {form.action !== 'Hold' && (
                            <div>
                              <label htmlFor={`intent-${item.trade.id}`}>Review action intent</label>
                              <input
                                id={`intent-${item.trade.id}`}
                                value={form.intent ?? ''}
                                onChange={e => setActionForms(f => ({ ...f, [item.trade.id]: { ...form, intent: e.target.value } }))}
                              />
                            </div>
                          )}
                        </fieldset>
                        <div className="sheet-actions">
                          <button type="button" disabled={item.frame.status === 'Missing'} onClick={() => { void onSaveAction(item.trade.id) }}>Save action</button>
                        </div>
                      </section>
                    )
                  })}
                  {reviewMessage && <p role="status">{reviewMessage}</p>}
                  {reviewError && <p role="alert">{reviewError}</p>}
                </section>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  )
}
