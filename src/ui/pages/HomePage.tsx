import { Link } from 'react-router'

export default function HomePage() {
  return (
    <section>
      <p className="label-caps text-sm">Home</p>
      <h1 className="mb-4 text-2xl font-semibold">Trade Journal</h1>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          to="/plan"
          className="pill bg-ink px-4 py-2 text-sm font-medium text-card hover:opacity-90"
        >
          New Plan
        </Link>
        <Link
          to="/review"
          className="pill border border-ink bg-card px-4 py-2 text-sm text-ink hover:bg-line/40"
        >
          Daily Review
        </Link>
      </div>

      <div className="card p-4">
        <h2 className="label-caps text-sm">Shell preview</h2>
        <p className="mb-3 text-sm text-muted">
          Figures are placeholders — workspace summaries arrive with later
          deliverables.
        </p>
        <dl className="grid grid-cols-2 gap-3">
          <div className="rounded-md bg-ground p-3">
            <dt className="label-caps text-xs">Planned risk (1R)</dt>
            <dd className="figure text-lg font-medium">$150.00</dd>
          </div>
          <div className="rounded-md bg-ground p-3">
            <dt className="label-caps text-xs">Unrealized P&amp;L</dt>
            <dd className="figure text-lg font-medium text-positive">
              +$42.50
            </dd>
          </div>
          <div className="rounded-md bg-ground p-3">
            <dt className="label-caps text-xs">Worst-case ongoing risk</dt>
            <dd className="figure text-lg font-medium">$150.00</dd>
          </div>
          <div className="rounded-md bg-ground p-3">
            <dt className="label-caps text-xs">Open trades</dt>
            <dd className="figure text-lg font-medium">2</dd>
          </div>
        </dl>
      </div>
    </section>
  )
}
