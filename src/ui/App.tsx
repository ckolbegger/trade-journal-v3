import { useCallback, useEffect, useState } from 'react'
import { addAccount, addInstitution, establish, type AppState } from './controller'

const initial: AppState = {
  view: 'loading', institutions: [], accounts: [], message: '', layout: 'wide', protection: '',
}

export function App() {
  const [state, setState] = useState<AppState>(initial)
  const [institutionName, setInstitutionName] = useState('')
  const [accountName, setAccountName] = useState('')
  const [institutionId, setInstitutionId] = useState('')

  useEffect(() => {
    void establish().then(setState)
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
    setAccountName('')
  }, [accountName, institutionId, state])

  return (
    <main data-view={state.view} data-layout={state.layout}>
      <div className="shell">
        <header>
          <h1>Trade Journal V3</h1>
          <nav aria-label="Primary">
            <button type="button" aria-current="page">Institutions &amp; Accounts</button>
            <button type="button">Workspace</button>
          </nav>
        </header>
        <section aria-live="polite">
          {state.view === 'loading' && <p>Verifying startup…</p>}
          {state.view === 'error' && <p role="alert">{state.message}</p>}
          {(state.view === 'empty' || state.view === 'ready') && (
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

              <section aria-label="Institutions">
                <h2>Institutions</h2>
                <ul>{state.institutions.map(i => <li key={i.id}>{i.label}</li>)}</ul>
              </section>
              <section aria-label="Accounts">
                <h2>Accounts</h2>
                <ul>{state.accounts.map(a => <li key={a.id}>{a.label}</li>)}</ul>
              </section>

              <section aria-label="Workspace">
                <h2>Workspace</h2>
                <p>Storage protection: {state.protection || 'checking…'}</p>
              </section>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
