const placeholderRows = Array.from({ length: 24 }, (_, i) => i + 1)

export default function TradesPage() {
  return (
    <section>
      <p className="label-caps text-sm">Trade browsing</p>
      <h1 className="mb-4 text-2xl font-semibold">Trades</h1>

      <div className="card mb-4 p-4">
        <h2 className="label-caps text-sm">Planned</h2>
        <p className="text-sm text-muted">
          No trades yet. Confirmed plans and open trades will list here with
          their lifecycle state.
        </p>
      </div>

      <div className="card p-4" aria-hidden="true">
        <h2 className="label-caps text-sm">Reserved layout space</h2>
        <ul className="divide-y divide-line">
          {placeholderRows.map((n) => (
            <li key={n} className="flex justify-between py-2.5 text-sm">
              <span className="text-muted">Trade row {n}</span>
              <span className="figure text-muted">—</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
