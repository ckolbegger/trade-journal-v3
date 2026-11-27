import { useState } from 'react'
import type { ReviewView as ReviewData } from './review-controller'
import type { StoredClosedTrade } from '../domain/open-views'
import {
  daySummary, meterPercent, orderReviewItems, reviewSteps,
} from './review-visual'

export type ActionFormState = { action: string; intent?: string; conviction?: string }
export type MarkDraft = { price: string; reason: string }

type Props = {
  review: ReviewData | null
  actionForms: Record<string, ActionFormState>
  drafts: Record<string, MarkDraft>
  debtAnswers: Record<string, string>
  closedTrades: StoredClosedTrade[]
  closeReviewStatuses: Record<string, string>
  message: string
  error: string
  onMark: (
    tradeId: string,
    intention: 'RecordManualMark' | 'AcknowledgeUnavailable',
    override?: MarkDraft,
  ) => void
  onDraft: (tradeId: string, draft: MarkDraft) => void
  onActionForm: (tradeId: string, form: ActionFormState) => void
  onSaveAction: (tradeId: string) => void
  onResolveDebt: (id: string, reason: string, answers?: Record<string, string>) => void
  onDebtAnswer: (id: string, value: string) => void
  onReplay: (tradeId: string) => void
  onCloseReview: (tradeId: string) => void
}

function Meter({ price, stop, target, large }: {
  price?: string; stop: string; target: string; large?: boolean
}) {
  const percent = meterPercent(price, stop, target)
  return (
    <svg
      className={large ? 'meter-large' : 'meter-small'}
      viewBox="0 0 200 24" role="img"
      aria-label={`Stop ${stop}, Target ${target}${percent === null ? ', no Mark' : ''}`}
    >
      <rect x="1" y="5" width="198" height="14" className="meter-bg" />
      {percent !== null && (
        <>
          <rect x="1" y="5" width={Math.max(1, percent * 1.98)} height="14" className={percent >= 100 ? 'meter-over' : 'meter-fill'} />
          <line x1="199" y1="2" x2="199" y2="22" className="meter-target" />
        </>
      )}
      <line x1="1" y1="2" x2="1" y2="22" className="meter-stop" />
      {percent === null && <text x="100" y="16" className="meter-missed">MISSED</text>}
    </svg>
  )
}

export function ReviewView({
  review, actionForms, drafts, debtAnswers, closedTrades, closeReviewStatuses, message, error,
  onMark, onDraft, onActionForm, onSaveAction, onResolveDebt, onDebtAnswer,
  onReplay, onCloseReview,
}: Props) {
  const [noPrice, setNoPrice] = useState(false)
  const [noPriceReason, setNoPriceReason] = useState('')
  const taskKinds = review?.tasks.map(t => t.kind) ?? []
  const steps = reviewSteps(taskKinds)
  const items = review
    ? orderReviewItems(review.items.map(item => ({ ...item, band: item.attention.band })))
    : []
  const openMarks = items.filter(item => item.frame.status === 'Missing').length
  const savedMarks = items.filter(item => item.frame.status === 'Available').length
  const actionsSaved = items.filter(item => item.action).length
  const completionText = review?.completion.settlementSubState?.text
    ?? (review?.completion.state === 'CompleteWithUnavailableMarks'
      ? 'Complete with unavailable Marks' : review?.completion.state ?? 'Incomplete')

  return (
    <section aria-label="Daily Review" className="card">
      <div className="day-card" data-testid="review-day-card">
        <div className="sheet-header">
          <div>
            <p className="section-label">Daily review</p>
            <h2>Review — <span data-testid="review-date">{review?.reviewDate ?? '…'}</span></h2>
            <p data-testid="review-day-summary">
              {daySummary(items.length, openMarks, items.length - actionsSaved)}
            </p>
          </div>
          <span className={`badge badge-completion ${review?.completion.settlementSubState ? 'badge-deferred' : ''}`} data-testid="review-completion">
            {completionText}
          </span>
        </div>
        <ol className="stepper">
          {['Marks', 'Trades', 'The day'].map((step, i) => (
            <li key={step} data-review-stepper-step className={steps[i]}>{i + 1} {step}</li>
          ))}
        </ol>
        <div className="family-chips">
          {(['Marks', 'Debt', 'Settlement', 'Trades'] as const).map(step => (
            <span key={step} data-review-step className={taskKinds.includes(step) ? 'now' : ''}>{step}</span>
          ))}
        </div>
        <p className="day-so-far">Day so far: {savedMarks} of {items.length} Marks, {actionsSaved} Actions saved.</p>
        <button
          type="button" className="primary-next"
          onClick={() => document.getElementById(`mark-${items[0]?.trade.id}`)?.focus()}
        >
          {review?.missingMarks.length ? 'Enter the Marks' : `Next: ${items[0]?.trade.plan.underlying ?? 'Review'}`}
        </button>
        <div data-testid="review-due-debt">
          {review?.dueDebt.map(debt => (
          <div key={debt.id} className="due-debt card">
            <p>Due Debt: {debt.obligationKey}</p>
            {debt.obligationKey.startsWith('CloseReview:') ? (
              <>
                <label htmlFor={`debt-answer-${debt.id}`}>Review TakeAgain</label>
                <select
                  id={`debt-answer-${debt.id}`}
                  value={debtAnswers[debt.id] ?? ''}
                  onChange={e => onDebtAnswer(debt.id, e.target.value)}
                >
                  <option value="">Choose…</option>
                  <option>Yes, as planned</option><option>Yes, with changes</option>
                  <option>No</option><option>Unsure</option>
                </select>
                <button type="button" onClick={() => onResolveDebt(debt.id, '', { takeAgain: debtAnswers[debt.id] ?? '' })}>
                  Answer Close Review debt
                </button>
              </>
            ) : (
              <button type="button" onClick={() => onResolveDebt(debt.id, 'resolved in review')}>Resolve debt</button>
            )}
          </div>
          ))}
        </div>
      </div>

      <section aria-label="Marks" className="marks-card card">
        <p className="section-label">Marks</p>
        <h3>Marks</h3>
        <p className="muted">{savedMarks} of {items.length} saved · {openMarks} no price</p>
        <div className="history-scroll">
          <table className="marks-table">
            <thead>
              <tr>
                <th scope="col">Instrument</th><th scope="col">Previous</th>
                <th scope="col">Today</th><th scope="col">Change</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const draft = drafts[item.trade.id] ?? { price: '', reason: '' }
                return (
                  <tr key={item.trade.id}>
                    <th scope="row">{item.trade.plan.underlying}</th>
                    <td>—</td>
                    <td>
                      <label className="visually-hidden" htmlFor={`mark-${item.trade.id}`}>Mark price for {item.trade.plan.underlying}</label>
                      <input
                        id={`mark-${item.trade.id}`} className="mark-input"
                        value={draft.price} placeholder="—"
                        onChange={e => onDraft(item.trade.id, { ...draft, price: e.target.value })}
                      />
                    </td>
                    <td>{item.frame.price ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {noPrice && (
          <div>
            <label htmlFor="no-price-reason">Why no price is available</label>
            <input id="no-price-reason" value={noPriceReason} onChange={e => setNoPriceReason(e.target.value)} />
          </div>
        )}
        <div className="sheet-actions">
          <button type="button" onClick={() => {
            for (const item of items) {
              if (noPrice && noPriceReason.trim()) {
                onMark(item.trade.id, 'AcknowledgeUnavailable', { price: '', reason: noPriceReason })
              } else if (drafts[item.trade.id]?.price) {
                onMark(item.trade.id, 'RecordManualMark')
              }
            }
          }}>Save Marks</button>
          <button type="button" onClick={() => setNoPrice(true)}>Can&apos;t get a price</button>
          <button type="button" onClick={() => {
            setNoPrice(false); setNoPriceReason('')
            for (const item of items) onDraft(item.trade.id, { price: '', reason: '' })
          }}>Discard</button>
        </div>
      </section>

      <h3 className="sec-title">Trades · most pressing first</h3>
      <div data-testid="action-gate" className={`locked-gate${review?.missingMarks.length ? ' active' : ''}`} role="status">
        {review?.missingMarks.length
          ? <>MarkMissing — No Action until today&apos;s Mark(s) are in. <button type="button" onClick={() => document.getElementById(`mark-${items[0]?.trade.id}`)?.focus()}>Enter it</button></>
          : 'Evidence ready'}
      </div>
      {items.map(item => {
        const form = actionForms[item.trade.id] ?? { action: 'Hold' }
        const draft = drafts[item.trade.id] ?? { price: '', reason: '' }
        return (
          <section key={item.trade.id} className="card review-trade-card" aria-label={`Trade ${item.trade.plan.underlying}`}>
            <div className="trade-head">
              <div>
                <p className="section-label">{item.attention.band} · {item.attention.reasons.join(', ')}</p>
                <h3>{item.trade.plan.underlying}</h3>
                <p className="muted">{item.trade.lifecycle} · {item.trade.lotCount ?? 0} lots</p>
              </div>
              <span className="badge badge-open">{item.trade.lifecycle}</span>
              <div className="head-figures">
                <p>Marked P&amp;L <strong>{item.evaluation.markedPnl.kind === 'Value' ? item.evaluation.markedPnl.value : 'Unavailable'}</strong></p>
                <p>Change <strong>{item.frame.status === 'Available' && item.frame.price ? item.frame.price : '—'}</strong></p>
              </div>
              <Meter price={item.frame.price} stop={item.trade.plan.stop} target={item.trade.plan.target} />
              <span className="todo">{review?.missingMarks.includes(item.trade.plan.underlying) ? 'Mark due' : 'Ready'}</span>
            </div>
            <p className="last-decision">Last decision: {item.action?.kind ?? 'none recorded'}</p>
            <p data-testid="review-mark-status">
              {item.frame.status === 'AcknowledgedUnavailable' ? 'Acknowledged Unavailable' : item.frame.status}
            </p>
            <p data-testid="review-episode">
              {(item.trade.deviations?.length ?? 0) > 0 ? 'Stop episode reconciled'
                : item.replay.episodes.length ? `Stop episode from ${item.replay.episodes[0].start}`
                  : 'No Stop episode'}
            </p>
            <div className="plan-now">
              <div>
                <p className="section-label">Plan</p>
                <dl className="kv">
                  <dt>Entry</dt><dd>{item.trade.plan.entry}</dd>
                  <dt>Stop</dt><dd>{item.trade.plan.stop}</dd>
                  <dt>Target</dt><dd>{item.trade.plan.target}</dd>
                  <dt>Thesis</dt><dd>{item.trade.thesis ?? '—'}</dd>
                  <dt>Invalidation</dt><dd>{item.trade.invalidation ?? '—'}</dd>
                </dl>
              </div>
              <div>
                <p className="section-label">Now</p>
                <Meter large price={item.frame.price} stop={item.trade.plan.stop} target={item.trade.plan.target} />
                <p className="meter-labels">
                  Stop {item.trade.plan.stop} · Target {item.trade.plan.target}
                  {item.frame.price ? ` · Mark ${item.frame.price}` : ' · no Mark, nothing carried over'}
                </p>
              </div>
            </div>
            <div className="replay-strip">
              <svg className="meter-small" viewBox="0 0 200 24" aria-hidden="true"><polyline points="0,18 60,12 120,16 200,6" /></svg>
              <button type="button" onClick={() => onReplay(item.trade.id)}>Replay</button>
            </div>
            <div className="mark-fields field-grid">
              <div>
                <label htmlFor={`review-price-${item.trade.id}`}>Review mark price</label>
                <input
                  id={`review-price-${item.trade.id}`} value={draft.price}
                  onChange={e => onDraft(item.trade.id, { ...draft, price: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor={`review-reason-${item.trade.id}`}>Review unavailability reason</label>
                <input
                  id={`review-reason-${item.trade.id}`} value={draft.reason}
                  onChange={e => onDraft(item.trade.id, { ...draft, reason: e.target.value })}
                />
              </div>
            </div>
            <div className="sheet-actions">
              <button type="button" onClick={() => onMark(item.trade.id, 'RecordManualMark')}>Record mark for review</button>
              <button type="button" onClick={() => onMark(item.trade.id, 'AcknowledgeUnavailable')}>Acknowledge for review</button>
            </div>
            <fieldset>
              <legend>Daily Trade Review Action</legend>
              {(['Hold', 'Exit', 'Roll', 'Adjust'] as const).map(action => (
                <label key={action} className="pill-option">
                  <input
                    type="radio" name={`action-${item.trade.id}`}
                    checked={form.action === action}
                    onChange={() => onActionForm(item.trade.id, { ...form, action })}
                  /> {action} action
                </label>
              ))}
              {form.action !== 'Hold' && (
                <div>
                  <label htmlFor={`intent-${item.trade.id}`}>Review action intent</label>
                  <input
                    id={`intent-${item.trade.id}`} value={form.intent ?? ''}
                    onChange={e => onActionForm(item.trade.id, { ...form, intent: e.target.value })}
                  />
                </div>
              )}
              <div>
                <label htmlFor={`conviction-${item.trade.id}`}>Conviction</label>
                <input
                  id={`conviction-${item.trade.id}`} value={form.conviction ?? ''}
                  onChange={e => onActionForm(item.trade.id, { ...form, conviction: e.target.value })}
                />
              </div>
            </fieldset>
            <div className="sheet-actions">
              <button type="button" disabled={item.frame.status === 'Missing'} onClick={() => onSaveAction(item.trade.id)}>Save action</button>
              <button type="button" onClick={() => onActionForm(item.trade.id, { action: 'Hold' })}>Discard</button>
            </div>
            <p className="decisions-trail">Your last decisions: {item.action ? `${item.action.kind} on ${item.action.date ?? review?.reviewDate}` : 'none yet'}</p>
          </section>
        )
      })}

      <h3 className="sec-title">Closed · Close Review</h3>
      {closedTrades.length === 0 && <p className="muted">No closed Trades yet.</p>}
      {closedTrades.map(trade => (
        <section key={trade.id} className="card closed-card" aria-label={`Closed ${trade.plan.underlying}`} data-close-review-status={closeReviewStatuses[trade.id] ?? ''}>
          <div className="trade-head">
            <div>
              <p className="section-label">
                {closeReviewStatuses[trade.id] === 'saved' ? 'Close Review saved'
                  : closeReviewStatuses[trade.id] === 'declined' ? 'Close Review declined'
                    : closeReviewStatuses[trade.id] === 'deferred' ? 'Close Review · next Review'
                      : 'Close Review due'}
              </p>
              <h3>{trade.plan.underlying}</h3>
              <p className="muted">Closed · {trade.realizedToDate} realized</p>
            </div>
            <span className="badge badge-closed">Closed</span>
          </div>
          <table className="cmp">
            <thead><tr><th scope="col">Plan</th><th scope="col">What happened</th></tr></thead>
            <tbody><tr><td>{trade.plan.entry} / {trade.plan.stop} / {trade.plan.target}</td><td>{trade.realizedToDate}</td></tr></tbody>
          </table>
          <div className="replay-strip">
            <button type="button" onClick={() => onReplay(trade.id)}>Replay</button>
            {!closeReviewStatuses[trade.id] && (
              <>
                <button type="button" onClick={() => onCloseReview(trade.id)}>Write the Close Review</button>
                <button type="button" onClick={() => onCloseReview(trade.id)}>Decline</button>
              </>
            )}
          </div>
        </section>
      ))}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
