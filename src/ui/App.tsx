import { useCallback, useEffect, useState } from 'react'
import { addAccount, addInstitution, establish, type AppState } from './controller'
import {
  confirmPlanFromDraft, initialPlanState, loadPlannedTrades, previewPlan,
  type PlanDraft, type PlanState,
} from './plan-controller'
import { openDb } from '../persistence/db'
import {
  readCloseReasonLabels, strategyIdOf, toStoredClosedTrade, toStoredOpenTrade,
} from './trade-read'
import { readCloseReviewState } from './obligation-read'
import { TradeSticker } from './trade-sticker'
import { queryClosedTrades, queryOpenTrades, type StoredClosedTrade, type StoredOpenTrade } from '../domain/open-views'
import { recordOpeningPositionChange } from './position-controller'
import { recordClosePositionChange } from './close-controller'
import { saveCloseReview } from './close-review-controller'
import type { NarrativeItem } from '../domain/journal-narrative'
import { messageFor } from './error-meaning'
import { requestDurability } from '../domain/workspace'
import { evaluateOpenTrade, saveManualMark } from './market-controller'
import {
  newActionForm, openReview, saveTradeAction, resolveReviewDebt,
  type ReviewView,
} from './review-controller'
import type { DailyActionForm } from '../domain/daily-action'
import type { CalculationResult } from '../domain/calculation'
import type { ReflectionDisposition } from '../domain/position-change-reflection'
import { canonicalInstrument, type OptionContract } from '../domain/option-contract'
import { resolveStrategyShape } from '../domain/strategy-shapes'
import { recordOptionPositionChange, recordOptionClose } from './option-controller'
import { loadCompleteTradeDetail, type LoadedDetail } from './detail-controller'
import { CompleteDetailView } from './complete-detail-view'
import { payoffForPlan } from '../domain/complete-detail'
import { D8A_CAPABILITIES } from '../domain/capabilities-d8a'

const SINGLE_LEG_OPTION_IDS = ['seed-long-call', 'seed-long-put', 'seed-cash-secured-put']
type OptionPlanFields = {
  strategyId: string
  entry: string
  contract: OptionContract
  contractInstrument: string
  plannedLeg: { contract: OptionContract; quantity: number; openingAction: 'Buy' | 'Sell' }
  management: { stop: string; target: string }
}

function optionPlanFields(plan: unknown): OptionPlanFields | null {
  const p = plan as Partial<OptionPlanFields> | null
  if (!p || !p.strategyId || !SINGLE_LEG_OPTION_IDS.includes(p.strategyId) || !p.contract || !p.plannedLeg) return null
  return p as OptionPlanFields
}

function strategyLabel(id?: string): string {
  if (!id) return 'Long Stock'
  const shape = resolveStrategyShape(id)
  return shape.ok ? shape.value.label : 'Long Stock'
}

const initial: AppState = {
  view: 'loading', institutions: [], accounts: [], message: '', layout: 'wide', protection: '',
  readiness: { outcome: 'Writable', passed: true, failedChecks: [], protection: { kind: 'BestEffort', reason: 'checking' } },
}
const emptyDraft: PlanDraft = {
  accountId: '', underlying: '', quantity: '', entry: '', stop: '', target: '', thesis: '', invalidation: '',
  strategyId: 'seed-long-stock', optionKind: 'Call', strike: '', expiration: '', multiplier: '100',
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

type CloseExecutionDraft = ExecutionDraft
type CloseForm = {
  executions: CloseExecutionDraft[]
  closeReason: string
  reflection: 'Defer' | 'Decline' | 'Complete'
  decisionMode: string
  primaryEmotion: string
  decisionConfidence: string
  note: string
  declineReason: string
}
const emptyCloseForm = (): CloseForm => ({
  executions: [{
    instrument: '', quantity: '', price: '', fee: '', economicTime: '2026-11-25T20:00:00Z',
  }],
  closeReason: '', reflection: 'Defer', decisionMode: '', primaryEmotion: '',
  decisionConfidence: '', note: '', declineReason: '',
})

type CloseReviewFormState = {
  disposition: 'Complete' | 'Defer' | 'Decline'
  takeAgain: string
  worked: string
  lesson: string
  reason: string
}
const emptyCloseReviewForm = (): CloseReviewFormState => ({
  disposition: 'Complete', takeAgain: '', worked: '', lesson: '', reason: '',
})

function closeDispositionOf(form: CloseForm): ReflectionDisposition {
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

function OptionPayoffPanel({ plan, realizedToDate }: { plan: OptionPlanFields; realizedToDate?: string }) {
  const payoff = payoffForPlan(
    { entry: plan.entry, plannedLeg: plan.plannedLeg },
    realizedToDate === undefined ? 'Planned' : 'Current',
    realizedToDate,
  )
  return (
    <section aria-label="Expiration payoff" data-testid="payoff-panel" className="card">
      <p className="section-label">Expiration payoff</p>
      <h4>Intrinsic payoff at expiration</h4>
      <p data-testid="payoff-contract">{canonicalInstrument(plan.contract)}</p>
      {payoff.kind === 'Value' ? (
        <>
          <p data-testid="payoff-break-even">Break-even: {payoff.value.zeroCrossings.join(', ') || '—'}</p>
          <ul className="detail-list">
            {payoff.value.extrema.map((e, index) => (
              <li key={index}>{e.kind}: {e.value} on {e.attainedOn}</li>
            ))}
          </ul>
        </>
      ) : (
        <p data-testid="payoff-status">{payoff.kind}: {payoff.reason}</p>
      )}
      <p className="muted">Intrinsic settlement only — no model-derived price.</p>
    </section>
  )
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
  const [closedTrades, setClosedTrades] = useState<StoredClosedTrade[]>([])
  const [selectedOpen, setSelectedOpen] = useState<StoredOpenTrade | null>(null)
  const [selectedClosed, setSelectedClosed] = useState<StoredClosedTrade | null>(null)
  const [executingId, setExecutingId] = useState<string | null>(null)
  const [closingId, setClosingId] = useState<string | null>(null)
  const [closeForm, setCloseForm] = useState<CloseForm>(emptyCloseForm())
  const [closeError, setCloseError] = useState('')
  const [closeReasons, setCloseReasons] = useState<string[]>([])
  const [closeReviewOpen, setCloseReviewOpen] = useState<string | null>(null)
  const [closeReviewForm, setCloseReviewForm] = useState<CloseReviewFormState>(emptyCloseReviewForm())
  const [closeReviewError, setCloseReviewError] = useState('')
  const [closeReviewStatus, setCloseReviewStatus] = useState('')
  const [narrative, setNarrative] = useState<NarrativeItem[]>([])
  const [reviewDebtAnswers, setReviewDebtAnswers] = useState<Record<string, string>>({})
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
  const [completeDetail, setCompleteDetail] = useState<LoadedDetail | null>(null)
  const [replayIndex, setReplayIndex] = useState(0)

  useEffect(() => {
    void establish().then(async s => {
      setState(s)
      setDraft(d => ({ ...d, accountId: s.accounts[0]?.id ?? '' }))
      setCloseReasons(await readCloseReasonLabels(await openDb()))
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
    const db = await openDb()
    setOpenTrades(await queryOpenTrades(db))
    setClosedTrades(await queryClosedTrades(db))
  }, [])

  const onOpenCompleteDetail = useCallback(async (tradeId: string) => {
    setCompleteDetail(await loadCompleteTradeDetail({
      tradeId,
      now: VIEW_MOMENT,
      advisoryInstalled: D8A_CAPABILITIES.some(c => c === 'TradeAnalysis.advisoryExplanation(IV)'),
    }))
    setReplayIndex(0)
  }, [])

  const onConfirmPlan = useCallback(async () => {
    try {
      const { error } = await confirmPlanFromDraft(draft, state.accounts, state.institutions)
      if (error) { setPlan(p => ({ ...p, error })); return }
      await refreshTrades()
      setSelectedOpen(null)
      setScreen('trades')
      setDraft(emptyDraft)
    } catch (e) {
      // An unexpected browser/API failure must never look like a dead button.
      setPlan(p => ({ ...p, error: e instanceof Error ? e.message : 'Could not save the Plan.' }))
    }
  }, [draft, state.accounts, state.institutions, refreshTrades])

  const onOpenTrades = useCallback(async () => {
    await refreshTrades()
    setClosingId(null)
    setCloseForm(emptyCloseForm())
    setCloseError('')
    setCloseReviewOpen(null)
    setCloseReviewForm(emptyCloseReviewForm())
    setScreen('trades')
    // The detail can still be mounted from a previous visit; re-derive its
    // evaluation so Marks recorded in Review are not shown as stale.
    const db = await openDb()
    if (selectedOpen) {
      setSelectedEvaluation(await evaluateOpenTrade(selectedOpen, db, VIEW_MOMENT))
    }
    // A deferred Close Review can be answered in Review while this detail is
    // still mounted; re-derive its status and narrative on the way back.
    if (selectedClosed) {
      const state = await readCloseReviewState(db, selectedClosed)
      setCloseReviewStatus(state.status)
      setNarrative(state.narrative)
    }
  }, [refreshTrades, selectedOpen, selectedClosed])

  const showOpen = useCallback(async (trade: StoredOpenTrade) => {
    setPlan(p => ({ ...p, screen: 'list', selected: null }))
    setSelectedClosed(null)
    setClosingId(null)
    setSelectedOpen(trade)
    // Clear stale form state before the async load so a value typed while the
    // evaluation resolves is not wiped afterwards.
    setMarkDraft({ price: '', reason: '' })
    setMarkError('')
    setMarkMessage('')
    // Option plans carry premium Stop/Target values, not underlying-price
    // conditions; the standard Marks/evaluation card is not applicable. The
    // independent intrinsic payoff panel presents option exposure instead.
    if (optionPlanFields(trade.plan)) {
      setSelectedEvaluation(null)
      return
    }
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
      setMarkError(messageFor(result.error))
      return
    }
    setMarkError('')
    setMarkDraft({ price: '', reason: '' })
    setMarkMessage(intention === 'RecordManualMark' ? 'Manual Mark recorded.' : 'Unavailability acknowledged.')
    setSelectedEvaluation(await evaluateOpenTrade(selectedOpen, await openDb(), VIEW_MOMENT))
  }, [selectedOpen, selectedEvaluation, markDraft, state.readiness])

  const onOpenReview = useCallback(async () => {
    setClosingId(null)
    setCloseForm(emptyCloseForm())
    setCloseError('')
    setCloseReviewOpen(null)
    setCloseReviewForm(emptyCloseReviewForm())
    setScreen('review')
    const next = await openReview(VIEW_MOMENT)
    setReview(next)
    setActionForms(Object.fromEntries(next.items.map(i => [i.trade.id, newActionForm()])))
    setReviewDrafts(Object.fromEntries(next.items.map(i => [i.trade.id, {
      price: i.frame.price ?? '', reason: '',
    }])))
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
      intention: intention === 'RecordManualMark' && item.frame.status === 'Available'
        ? 'ManualOverride' : intention,
      price: intention === 'RecordManualMark' ? draft.price : undefined,
      reason: intention === 'AcknowledgeUnavailable' ? draft.reason : undefined,
      observedAt: `${review.reviewDate}T20:00:00Z`,
      savedAt: VIEW_MOMENT.toISOString(),
      readiness: state.readiness,
    })
    if (!result.ok) {
      setReviewError(messageFor(result.error))
      return
    }
    setReviewError('')
    setReviewMessage(intention === 'RecordManualMark' ? 'Mark recorded.' : 'Unavailability acknowledged.')
    const refreshed = await openReview(VIEW_MOMENT)
    setReview(refreshed)
    const savedPrice = refreshed.items.find(i => i.trade.id === tradeId)?.frame.price ?? ''
    setReviewDrafts(d => ({ ...d, [tradeId]: { price: savedPrice, reason: '' } }))
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
      setReviewError(messageFor(result.error))
      if (result.error.kind === 'ReviewChanged') setReview(result.error.refreshed)
      return
    }
    setReviewError('')
    setReviewMessage(result.value.nextStep)
    setReview(await openReview(VIEW_MOMENT))
  }, [review, actionForms, state.readiness])

  const onResolveDebt = useCallback(async (debtId: string, text: string, answers?: { takeAgain: string }) => {
    const result = await resolveReviewDebt({
      debtId, form: { text, ...(answers ? { answers } : {}) }, readiness: state.readiness,
    })
    if (!result.ok) {
      setReviewError(messageFor(result.error))
      return
    }
    setReviewError('')
    setReviewMessage('Debt resolved.')
    setReview(await openReview(VIEW_MOMENT))
  }, [state.readiness])

  const onRecordPosition = useCallback(async (tradeId: string, expectedRevision: string) => {
    try {
    const option = optionPlanFields(plan.selected?.trade.plan)
    if (option) {
      const instrument = canonicalInstrument(option.contract)
      if (positionForm.executions.some(e => e.instrument.trim() && e.instrument.trim() !== instrument)) {
        setPositionError(`Instrument must match the frozen contract ${instrument}.`)
        return
      }
      const shape = resolveStrategyShape(option.strategyId)
      const action: 'Buy' | 'Sell' = shape.ok ? shape.value.openingAction : 'Buy'
      const result = await recordOptionPositionChange({
        tradeId,
        expectedRevision,
        positionChangeId: `pc-${tradeId}`,
        economicTime: '2026-11-24T20:00:00Z',
        executions: positionForm.executions.map((e, index) => ({
          id: `exec-${tradeId}-${index + 1}`,
          contract: option.contract,
          action,
          opening: true,
          quantity: e.quantity,
          price: e.price,
          fee: e.fee,
          economicTime: e.economicTime,
        })),
        reflection: { definitionRevision: 'D1', disposition: dispositionOf(positionForm) },
        readiness: state.readiness,
      })
      if (!result.ok) {
        setPositionError(messageFor(result.error))
        return
      }
      setPositionError('')
      setExecutingId(null)
      setPositionForm(emptyPositionForm())
      await refreshTrades()
      await showOpen(toStoredOpenTrade(result.value.trade))
      return
    }
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
      setPositionError(messageFor(result.error))
      return
    }
    setPositionError('')
    setExecutingId(null)
    setPositionForm(emptyPositionForm())
    await refreshTrades()
    await showOpen(result.value.trade)
    } catch (e) {
      setPositionError(e instanceof Error ? e.message : 'Could not record the position change.')
    }
  }, [positionForm, state.readiness, refreshTrades, showOpen, plan.selected])

  const showClosed = useCallback(async (trade: StoredClosedTrade) => {
    setPlan(p => ({ ...p, screen: 'list', selected: null }))
    setSelectedOpen(null)
    setClosingId(null)
    setSelectedClosed(trade)
    setCloseReviewOpen(null)
    setCloseReviewForm(emptyCloseReviewForm())
    setCloseReviewError('')
    const state = await readCloseReviewState(await openDb(), trade)
    setCloseReviewStatus(state.status)
    setNarrative(state.narrative)
  }, [])

  const onRecordClose = useCallback(async (trade: StoredOpenTrade) => {
    try {
    const option = optionPlanFields(trade.plan)
    if (option) {
      const instrument = canonicalInstrument(option.contract)
      if (closeForm.executions.some(e => e.instrument.trim() && e.instrument.trim() !== instrument)) {
        setCloseError(`Instrument must match the frozen contract ${instrument}.`)
        return
      }
      const shape = resolveStrategyShape(option.strategyId)
      const action: 'Buy' | 'Sell' = shape.ok && shape.value.openingAction === 'Buy' ? 'Sell' : 'Buy'
      const result = await recordOptionClose({
        tradeId: trade.id,
        expectedRevision: trade.revision,
        positionChangeId: `close-${trade.id}`,
        economicTime: closeForm.executions[0]?.economicTime || '2026-11-25T20:00:00Z',
        executions: closeForm.executions.map((e, index) => ({
          id: `close-exec-${trade.id}-${index + 1}`,
          contract: option.contract,
          action,
          opening: false,
          quantity: e.quantity,
          price: e.price,
          fee: e.fee,
          economicTime: e.economicTime,
        })),
        closeReason: closeForm.closeReason,
        reflection: { definitionRevision: 'D1', disposition: closeDispositionOf(closeForm) },
        readiness: state.readiness,
      })
      if (!result.ok) {
        setCloseError(messageFor(result.error))
        return
      }
      setCloseError('')
      setClosingId(null)
      setCloseForm(emptyCloseForm())
      setSelectedOpen(null)
      setCloseReviewOpen(null)
      setCloseReviewForm(emptyCloseReviewForm())
      setCloseReviewError('')
      setCloseReviewStatus('')
      setNarrative([])
      setSelectedClosed(toStoredClosedTrade(result.value.trade))
      await refreshTrades()
      return
    }
    const result = await recordClosePositionChange({
      tradeId: trade.id,
      expectedRevision: trade.revision,
      positionChangeId: `close-${trade.id}`,
      economicTime: closeForm.executions[0]?.economicTime || '2026-11-25T20:00:00Z',
      executions: closeForm.executions.map((e, index) => ({
        id: `close-exec-${trade.id}-${index + 1}`,
        instrument: e.instrument, quantity: e.quantity, price: e.price,
        fee: e.fee, economicTime: e.economicTime,
      })),
      closeReason: closeForm.closeReason,
      reflection: { definitionRevision: 'D1', disposition: closeDispositionOf(closeForm) },
      readiness: state.readiness,
    })
    if (!result.ok) {
      setCloseError(messageFor(result.error))
      return
    }
    setCloseError('')
    setClosingId(null)
    setCloseForm(emptyCloseForm())
    setSelectedOpen(null)
    // A newly closed Trade auto-opens its detail; clear the previous Trade's
    // Close Review status and narrative rather than rendering them as stale.
    setCloseReviewOpen(null)
    setCloseReviewForm(emptyCloseReviewForm())
    setCloseReviewError('')
    setCloseReviewStatus('')
    setNarrative([])
    setSelectedClosed(result.value.trade)
    await refreshTrades()
    } catch (e) {
      setCloseError(e instanceof Error ? e.message : 'Could not record the close.')
    }
  }, [closeForm, state.readiness, refreshTrades])

  const onSaveCloseReview = useCallback(async (trade: StoredClosedTrade) => {
    const form = closeReviewForm
    const disposition = form.disposition === 'Complete'
      ? {
          kind: 'Complete' as const,
          form: {
            takeAgain: form.takeAgain,
            ...(form.worked ? { workedAndDidNot: form.worked } : {}),
            ...(form.lesson ? { keyLesson: form.lesson } : {}),
          },
        }
      : form.disposition === 'Decline'
        ? { kind: 'Decline' as const, reason: form.reason || undefined }
        : { kind: 'Defer' as const }
    const result = await saveCloseReview({
      tradeId: trade.id, definitionRevision: 'D1', economicTime: trade.economicTime,
      disposition, readiness: state.readiness,
    })
    if (!result.ok) {
      setCloseReviewError(messageFor(result.error))
      return
    }
    setCloseReviewError('')
    setCloseReviewOpen(null)
    setCloseReviewForm(emptyCloseReviewForm())
    setCloseReviewStatus(result.value.outcome.kind === 'Entry' ? 'Saved'
      : result.value.outcome.kind === 'JournalDecline' ? 'Declined' : 'Outstanding Debt')
    await showClosed(trade)
  }, [closeReviewForm, state.readiness, showClosed])

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
                  <h2>New Plan — {strategyLabel(draft.strategyId)}</h2>
                  <form onSubmit={e => { e.preventDefault(); void onConfirmPlan() }}>
                    <label htmlFor="strategy">Strategy</label>
                    <select id="strategy" value={draft.strategyId ?? 'seed-long-stock'} onChange={e => {
                      const strategyId = e.target.value
                      const shape = resolveStrategyShape(strategyId)
                      setDraft({ ...draft, strategyId, optionKind: shape.ok ? shape.value.expectedKind : (draft.optionKind ?? 'Call') })
                    }}>
                      <option value="seed-long-stock">Long Stock</option>
                      <option value="seed-long-call">Long Call</option>
                      <option value="seed-long-put">Long Put</option>
                      <option value="seed-cash-secured-put">Cash-Secured Put</option>
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
                    {draft.strategyId && draft.strategyId !== 'seed-long-stock' && (
                      <>
                        <label htmlFor="option-kind">Option type</label>
                        <select id="option-kind" value={draft.optionKind ?? 'Call'} onChange={e => setDraft({ ...draft, optionKind: e.target.value as 'Call' | 'Put' })}>
                          <option value="Call">Call</option>
                          <option value="Put">Put</option>
                        </select>
                        <label htmlFor="strike">Strike</label>
                        <input id="strike" value={draft.strike ?? ''} onChange={e => setDraft({ ...draft, strike: e.target.value })} />
                        <label htmlFor="expiration">Expiration</label>
                        <input
                          id="expiration" type="date" value={draft.expiration ?? ''}
                          onChange={e => setDraft({ ...draft, expiration: e.target.value })}
                        />
                        <label htmlFor="multiplier">Multiplier</label>
                        <input id="multiplier" value={draft.multiplier ?? '100'} onChange={e => setDraft({ ...draft, multiplier: e.target.value })} />
                      </>
                    )}
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
                            <TradeSticker underlying={t.trade.plan.underlying} />
                            <span className="row-main">
                              <span className="row-title">{t.trade.plan.underlying}</span>
                              <span className="row-sub">{strategyLabel(strategyIdOf(t.trade.plan))} · 1R {t.trade.plan.oneR}</span>
                            </span>
                            <span className="badge badge-planned">Planned</span>
                          </button>
                          <button type="button" className="detail-link" aria-label={`Complete detail for ${t.trade.plan.underlying}`} onClick={() => { void onOpenCompleteDetail(t.trade.id) }}>Complete detail</button>
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
                            <TradeSticker underlying={t.plan.underlying} />
                            <span className="row-main">
                              <span className="row-title">{t.plan.underlying}</span>
                              <span className="row-sub">{strategyLabel(strategyIdOf(t.plan))} · {t.lots.length} lots</span>
                            </span>
                            <span className="num positive">{t.realizedToDate}</span>
                            <span className="badge badge-open">Open</span>
                          </button>
                          <button type="button" className="detail-link" aria-label={`Complete detail for ${t.plan.underlying}`} onClick={() => { void onOpenCompleteDetail(t.id) }}>Complete detail</button>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section aria-label="Closed trades" className="card">
                    <p className="section-label">Closed trades</p>
                    <h2>Closed trades</h2>
                    <ul>
                      {closedTrades.map(t => (
                        <li key={t.id}>
                          <button type="button" className="trade-row" onClick={() => showClosed(t)}>
                            <TradeSticker underlying={t.plan.underlying} />
                            <span className="row-main">
                              <span className="row-title">{t.plan.underlying}</span>
                              <span className="row-sub">{strategyLabel(strategyIdOf(t.plan))} · {t.lotMatches.length} lot matches</span>
                            </span>
                            <span className="num">{t.realizedToDate}</span>
                            <span className="badge badge-closed">Closed</span>
                          </button>
                          <button type="button" className="detail-link" aria-label={`Complete detail for ${t.plan.underlying}`} onClick={() => { void onOpenCompleteDetail(t.id) }}>Complete detail</button>
                        </li>
                      ))}
                    </ul>
                  </section>

                  {completeDetail && (
                    <>
                      <button type="button" className="detail-link" onClick={() => setCompleteDetail(null)}>Back to trades</button>
                      <CompleteDetailView
                        loaded={completeDetail}
                        replayIndex={replayIndex}
                        onSelectReplay={setReplayIndex}
                        onOpenReview={() => { void onOpenReview() }}
                      />
                    </>
                  )}

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
                          <div><p className="section-label">Strategy</p><p className="figure-value">{strategyLabel(strategyIdOf(plan.selected.trade.plan))}</p></div>
                        </div>
                      </section>
                      <section aria-label="Plan Reflection" data-testid="plan-reflection" className="card">
                        <h4>Plan Reflection</h4>
                        <p>Thesis: {String(plan.selected.entry.snapshot?.answers?.Thesis ?? '')}</p>
                        <p>Invalidation: {String(plan.selected.entry.snapshot?.answers?.Invalidation ?? '')}</p>
                      </section>
                      {optionPlanFields(plan.selected.trade.plan) && (
                        <OptionPayoffPanel plan={optionPlanFields(plan.selected.trade.plan)!} />
                      )}
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
                          <span className="action-pill">{optionPlanFields(plan.selected?.trade.plan)?.plannedLeg.openingAction ?? 'Buy'}</span>
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
                            <p className="section-label">{strategyLabel(strategyIdOf(selectedOpen.plan))} · open</p>
                            <h3>{selectedOpen.plan.underlying}</h3>
                            {optionPlanFields(selectedOpen.plan) && (
                              <p data-testid="option-contract">{canonicalInstrument(optionPlanFields(selectedOpen.plan)!.contract)}</p>
                            )}
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
                      {optionPlanFields(selectedOpen.plan) && (
                        <OptionPayoffPanel
                          plan={optionPlanFields(selectedOpen.plan)!}
                          realizedToDate={selectedOpen.realizedToDate}
                        />
                      )}

                      <button type="button" onClick={() => {
                        setClosingId(selectedOpen.id)
                        setCloseForm(emptyCloseForm())
                        setCloseError('')
                      }}>Close position</button>
                      {closingId === selectedOpen.id && (
                        <div className="sheet-backdrop" onClick={e => {
                          if (e.target === e.currentTarget) {
                            setClosingId(null)
                            setCloseForm(emptyCloseForm())
                            setCloseError('')
                          }
                        }}>
                          <form className="sheet" aria-label="Close position" onSubmit={e => {
                            e.preventDefault()
                            void onRecordClose(selectedOpen)
                          }}>
                            <div className="sheet-header">
                              <div>
                                <p className="section-label">Terminal position close</p>
                                <h3>Close {selectedOpen.plan.underlying}</h3>
                              </div>
                            </div>
                            {closeForm.executions.map((e, index) => (
                              <fieldset key={index}>
                                <legend>Close {index + 1}</legend>
                                <div className="field-grid">
                                  <div>
                                    <label htmlFor={`close-instrument-${index}`}>Close {index + 1} instrument</label>
                                    <input id={`close-instrument-${index}`} value={e.instrument} onChange={ev => setCloseForm(f => ({
                                      ...f, executions: f.executions.map((x, i) => i === index ? { ...x, instrument: ev.target.value } : x),
                                    }))} />
                                  </div>
                                  <div>
                                    <label htmlFor={`close-quantity-${index}`}>Close {index + 1} quantity</label>
                                    <input id={`close-quantity-${index}`} value={e.quantity} onChange={ev => setCloseForm(f => ({
                                      ...f, executions: f.executions.map((x, i) => i === index ? { ...x, quantity: ev.target.value } : x),
                                    }))} />
                                  </div>
                                  <div>
                                    <label htmlFor={`close-price-${index}`}>Close {index + 1} price</label>
                                    <input id={`close-price-${index}`} value={e.price} onChange={ev => setCloseForm(f => ({
                                      ...f, executions: f.executions.map((x, i) => i === index ? { ...x, price: ev.target.value } : x),
                                    }))} />
                                  </div>
                                  <div>
                                    <label htmlFor={`close-fee-${index}`}>Close {index + 1} fee</label>
                                    <input id={`close-fee-${index}`} value={e.fee} onChange={ev => setCloseForm(f => ({
                                      ...f, executions: f.executions.map((x, i) => i === index ? { ...x, fee: ev.target.value } : x),
                                    }))} />
                                  </div>
                                  <div>
                                    <label htmlFor={`close-time-${index}`}>Close {index + 1} economic time</label>
                                    <input id={`close-time-${index}`} value={e.economicTime} onChange={ev => setCloseForm(f => ({
                                      ...f, executions: f.executions.map((x, i) => i === index ? { ...x, economicTime: ev.target.value } : x),
                                    }))} />
                                  </div>
                                </div>
                              </fieldset>
                            ))}
                            <button type="button" onClick={() => setCloseForm(f => ({
                              ...f,
                              executions: [...f.executions, { instrument: f.executions[0]?.instrument ?? '', quantity: '', price: '', fee: '', economicTime: '2026-11-25T20:00:00Z' }],
                            }))}>Add another closing execution</button>
                            <div>
                              <label htmlFor="close-reason">Close reason</label>
                              <select id="close-reason" value={closeForm.closeReason} onChange={ev => setCloseForm(f => ({ ...f, closeReason: ev.target.value }))}>
                                <option value="">Choose…</option>
                                {closeReasons.map(reason => <option key={reason}>{reason}</option>)}
                              </select>
                            </div>
                            <fieldset>
                              <legend>Position Change Reflection</legend>
                              <label className="pill-option"><input type="radio" name="close-reflection" checked={closeForm.reflection === 'Defer'} onChange={() => setCloseForm(f => ({ ...f, reflection: 'Defer' }))} /> Defer reflection</label>
                              <label className="pill-option"><input type="radio" name="close-reflection" checked={closeForm.reflection === 'Decline'} onChange={() => setCloseForm(f => ({ ...f, reflection: 'Decline' }))} /> Decline reflection</label>
                              <label className="pill-option"><input type="radio" name="close-reflection" checked={closeForm.reflection === 'Complete'} onChange={() => setCloseForm(f => ({ ...f, reflection: 'Complete' }))} /> Complete reflection</label>
                              {closeForm.reflection === 'Complete' && (
                                <div className="field-grid">
                                  <div>
                                    <label htmlFor="close-decision-mode">Decision mode</label>
                                    <select id="close-decision-mode" value={closeForm.decisionMode} onChange={ev => setCloseForm(f => ({ ...f, decisionMode: ev.target.value }))}>
                                      <option value="">Choose…</option><option>As Planned</option><option>Deliberate Adjustment</option><option>Reactive</option><option>Externally Imposed</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label htmlFor="close-primary-emotion">Primary emotion</label>
                                    <select id="close-primary-emotion" value={closeForm.primaryEmotion} onChange={ev => setCloseForm(f => ({ ...f, primaryEmotion: ev.target.value }))}>
                                      <option value="">Choose…</option><option>Calm</option><option>Eager</option><option>Anxious</option><option>FOMO</option><option>Revenge</option><option>Relieved</option><option>Frustrated</option><option>Other</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label htmlFor="close-decision-confidence">Decision confidence</label>
                                    <input id="close-decision-confidence" value={closeForm.decisionConfidence} onChange={ev => setCloseForm(f => ({ ...f, decisionConfidence: ev.target.value }))} />
                                  </div>
                                </div>
                              )}
                              {closeForm.reflection === 'Decline' && (
                                <div>
                                  <label htmlFor="close-decline-reason">Decline reason</label>
                                  <input id="close-decline-reason" value={closeForm.declineReason} onChange={ev => setCloseForm(f => ({ ...f, declineReason: ev.target.value }))} />
                                </div>
                              )}
                            </fieldset>
                            <div className="sheet-actions">
                              <button type="submit">Record close</button>
                              <button type="button" onClick={() => {
                                setClosingId(null)
                                setCloseForm(emptyCloseForm())
                                setCloseError('')
                              }}>Cancel</button>
                            </div>
                            {closeError && <p role="alert">{closeError}</p>}
                          </form>
                        </div>
                      )}

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

                  {selectedClosed && !selectedOpen && (
                    <section aria-label="Closed trade detail">
                      <section className="card">
                        <div className="sheet-header">
                          <div>
                            <p className="section-label">{strategyLabel(strategyIdOf(selectedClosed.plan))} · closed</p>
                            <h3>{selectedClosed.plan.underlying}</h3>
                          </div>
                          <span className="badge badge-closed" data-testid="trade-lifecycle">{selectedClosed.lifecycle}</span>
                        </div>
                        <div className="figure-grid">
                          <div>
                            <p className="section-label">Realized P&amp;L</p>
                            <p className="figure-value num" data-testid="closed-realized-pnl">{selectedClosed.realizedToDate}</p>
                          </div>
                          <div>
                            <p className="section-label">Close Reason</p>
                            <p className="figure-value" data-testid="closed-reason">{selectedClosed.closeReason.label}</p>
                          </div>
                          <div>
                            <p className="section-label">Closed via</p>
                            <p className="figure-value" data-testid="closed-disposition">{selectedClosed.terminalDisposition?.kind ?? 'Execution'}</p>
                          </div>
                          <div>
                            <p className="section-label">FIFO Lot Matches</p>
                            <p className="figure-value num" data-testid="closed-lot-matches">{selectedClosed.lotMatches.length}</p>
                          </div>
                        </div>
                      </section>
                      <section aria-label="Lot Matches" className="card">
                        <h4>FIFO Lot Matches</h4>
                        <ul className="detail-list">{selectedClosed.lotMatches.map(m => (
                          <li key={m.id}>
                            <span>{m.quantity} · {m.matchingMethod}</span>
                            <span className="num">opening fee {m.allocatedOpeningFee ?? '—'} · disposal fee {m.allocatedDisposalFee ?? '—'}</span>
                          </li>
                        ))}</ul>
                      </section>
                      <section aria-label="Executions" className="card">
                        <h4>Executions</h4>
                        <ul className="detail-list">{selectedClosed.executions.map(e => (
                          <li key={e.id}>
                            <span>{e.action} · {e.instrument} · {e.quantity} @ {e.price}</span>
                            <span className="num">fee {e.fee}</span>
                          </li>
                        ))}</ul>
                      </section>

                      <section aria-label="Close Review" className="card">
                        <p className="section-label">Close Review</p>
                        <h4>Close Review</h4>
                        <p data-testid="close-review-status">{closeReviewStatus || 'Not started'}</p>
                        {!closeReviewStatus && (
                          <button type="button" onClick={() => {
                            setCloseReviewOpen(selectedClosed.id)
                            setCloseReviewForm(emptyCloseReviewForm())
                            setCloseReviewError('')
                          }}>Start Close Review</button>
                        )}
                        {closeReviewOpen === selectedClosed.id && (
                          <form className="sheet" aria-label="Close Review" onSubmit={e => {
                            e.preventDefault()
                            void onSaveCloseReview(selectedClosed)
                          }}>
                            <fieldset>
                              <legend>Outcome</legend>
                              <label className="pill-option"><input type="radio" name="close-review-outcome" checked={closeReviewForm.disposition === 'Complete'} onChange={() => setCloseReviewForm(f => ({ ...f, disposition: 'Complete' }))} /> Complete review</label>
                              <label className="pill-option"><input type="radio" name="close-review-outcome" checked={closeReviewForm.disposition === 'Defer'} onChange={() => setCloseReviewForm(f => ({ ...f, disposition: 'Defer' }))} /> Defer review</label>
                              <label className="pill-option"><input type="radio" name="close-review-outcome" checked={closeReviewForm.disposition === 'Decline'} onChange={() => setCloseReviewForm(f => ({ ...f, disposition: 'Decline' }))} /> Decline review</label>
                            </fieldset>
                            {closeReviewForm.disposition === 'Complete' && (
                              <div className="field-grid">
                                <div>
                                  <label htmlFor="cr-take-again">Would you take this Trade again?</label>
                                  <select id="cr-take-again" value={closeReviewForm.takeAgain} onChange={e => setCloseReviewForm(f => ({ ...f, takeAgain: e.target.value }))}>
                                    <option value="">Choose…</option>
                                    <option>Yes, as planned</option><option>Yes, with changes</option>
                                    <option>No</option><option>Unsure</option>
                                  </select>
                                </div>
                                <div>
                                  <label htmlFor="cr-worked">What worked and what did not?</label>
                                  <input id="cr-worked" value={closeReviewForm.worked} onChange={e => setCloseReviewForm(f => ({ ...f, worked: e.target.value }))} />
                                </div>
                                <div>
                                  <label htmlFor="cr-lesson">Key lesson</label>
                                  <input id="cr-lesson" value={closeReviewForm.lesson} onChange={e => setCloseReviewForm(f => ({ ...f, lesson: e.target.value }))} />
                                </div>
                              </div>
                            )}
                            {closeReviewForm.disposition === 'Decline' && (
                              <div>
                                <label htmlFor="cr-reason">Decline reason</label>
                                <input id="cr-reason" value={closeReviewForm.reason} onChange={e => setCloseReviewForm(f => ({ ...f, reason: e.target.value }))} />
                              </div>
                            )}
                            <div className="sheet-actions">
                              <button type="submit">Save Close Review</button>
                              <button type="button" onClick={() => {
                                setCloseReviewOpen(null)
                                setCloseReviewForm(emptyCloseReviewForm())
                                setCloseReviewError('')
                              }}>Cancel</button>
                            </div>
                            {closeReviewError && <p role="alert">{closeReviewError}</p>}
                          </form>
                        )}
                      </section>

                      <section aria-label="Journal narrative" className="card" data-testid="journal-narrative">
                        <p className="section-label">Journal narrative</p>
                        <h4>Journal narrative</h4>
                        <ul className="detail-list">{narrative.map(n => (
                          <li key={n.id}>
                            <span>{n.obligationKey} · {n.kind} · {n.source}</span>
                            <span className="muted">{Object.entries(n.answers).map(([k, v]) => `${k}: ${v}`).join(', ')}</span>
                          </li>
                        ))}</ul>
                      </section>
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
                  <div data-testid="review-due-debt">
                    {review?.dueDebt.map(debt => (
                      <div key={debt.id} className="card">
                        <p>Due Debt: {debt.obligationKey}</p>
                        {debt.obligationKey.startsWith('CloseReview:') ? (
                          <>
                            <label htmlFor={`debt-answer-${debt.id}`}>Review TakeAgain</label>
                            <select
                              id={`debt-answer-${debt.id}`}
                              value={reviewDebtAnswers[debt.id] ?? ''}
                              onChange={e => setReviewDebtAnswers(a => ({ ...a, [debt.id]: e.target.value }))}
                            >
                              <option value="">Choose…</option>
                              <option>Yes, as planned</option><option>Yes, with changes</option>
                              <option>No</option><option>Unsure</option>
                            </select>
                            <button type="button" onClick={() => {
                              void onResolveDebt(debt.id, '', { takeAgain: reviewDebtAnswers[debt.id] ?? '' })
                            }}>Answer Close Review debt</button>
                          </>
                        ) : (
                          <button type="button" onClick={() => { void onResolveDebt(debt.id, 'resolved in review') }}>Resolve debt</button>
                        )}
                      </div>
                    ))}
                  </div>
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
                        {item.frame.price && (
                          <p className="muted">Saved Mark: {item.frame.price} on {item.frame.date}. Edit and record to override.</p>
                        )}
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
