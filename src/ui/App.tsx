import { useState } from 'react'

type ViewState = 'loading' | 'ready' | 'empty' | 'error'

export function App() {
  const [view, setView] = useState<ViewState>('loading')
  return (
    <main data-view={view}>
      <header>
        <h1>Trade Journal V3</h1>
        <nav aria-label="Primary">
          <button type="button" aria-current="page">Institutions &amp; Accounts</button>
        </nav>
      </header>
      <section aria-live="polite">
        {view === 'loading' && <p>Verifying startup…</p>}
        {view === 'ready' && <p>Your institutions and accounts.</p>}
        {view === 'empty' && <p>No institutions or accounts recorded yet.</p>}
        {view === 'error' && <p>Cannot load the journal.</p>}
      </section>
      <div className="dev-controls" hidden>
        <button type="button" onClick={() => setView('ready')}>ready</button>
        <button type="button" onClick={() => setView('empty')}>empty</button>
        <button type="button" onClick={() => setView('error')}>error</button>
      </div>
    </main>
  )
}
