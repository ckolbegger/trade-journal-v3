import { Link } from 'react-router-dom'
import { card, heading } from '../styles'

// The Home tab's landing screen. Account-wide totals (open P&L, open/planned
// Trade counts, realized-to-date) need a Valuations totals operation that does
// not exist yet — deferred to S15.3 by user ruling 2026-08-25. Constraint 2
// forbids summing per-Trade facts in the UI, so this page shows no totals at
// all rather than a zero or a placeholder, and says so without naming a future
// slice at the trader. Home carries the Settings link the tab bar does not.
export function HomePage() {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className={heading}>Home</h2>
        <Link
          to="/settings"
          aria-label="Settings"
          className="rounded-full p-2 text-stone-600 hover:bg-stone-100 hover:text-stone-900"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
          </svg>
        </Link>
      </div>
      <div className={card}>
        <p className="font-medium text-stone-900">Account-wide totals aren&rsquo;t computed yet.</p>
        <p className="mt-1 text-sm text-stone-600">
          Open Trades to see how each one stands, or Journal for what you&rsquo;ve logged.
        </p>
      </div>
    </section>
  )
}
