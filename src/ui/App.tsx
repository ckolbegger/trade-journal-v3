import { useCallback, useEffect, useState } from 'react'
import { addAccount, addInstitution, establish, type AppState } from './controller'
import {
  confirmPlanFromDraft, initialPlanState, loadPlannedTrades, previewPlan,
  type PlanDraft, type PlanState,
} from './plan-controller'

const initial: AppState = {
  view: 'loading', institutions: [], accounts: [], message: '', layout: 'wide', protection: '',
}
const emptyDraft: PlanDraft = {
  accountId: '', underlying: '', quantity: '', entry: '', stop: '', target: '', thesis: '', invalidation: '',
}
type Screen = 'accounts' | 'new-plan' | 'trades'

export function App() {
  const [state, setState] = useState<AppState>(initial)
  const [screen, setScreen] = useState<Screen>('accounts')
  const [institutionName, setInstitutionName] = useState('')
  const [accountName, setAccountName] = useState('')
  const [institutionId, setInstitutionId] = useState('')
  const [draft, setDraft] = useState<PlanDraft>(emptyDraft)
  const [plan, setPlan] = useState<PlanState>(initialPlanState)

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

  const onConfirmPlan = useCallback(async () => {
    const { error } = await confirmPlanFromDraft(draft, state.accounts, state.institutions)
    if (error) { setPlan(p => ({ ...p, error })); return }
    const trades = await loadPlannedTrades()
    setPlan({ ...initialPlanState, screen: 'list', confirmed: trades })
    setScreen('trades')
    setDraft(emptyDraft)
  }, [draft, state.accounts, state.institutions])

  const onOpenTrades = useCallback(async () => {
    const trades = await loadPlannedTrades()
    setPlan({ ...initialPlanState, confirmed: trades })
    setScreen('trades')
  }, [])

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
                <section aria-label="Planned trades" data-screen="planned">
                  <h2>Planned trades</h2>
                  <ul>
                    {plan.confirmed.map(t => (
                      <li key={t.trade.id}>
                        <button type="button" onClick={() => setPlan({ ...plan, screen: 'detail', selected: t })}>
                          {t.trade.plan.underlying}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {plan.screen === 'detail' && plan.selected && (
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
                    </section>
                  )}
                </section>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  )
}
