import { NavLink, Route, Routes } from 'react-router-dom'
import { TradesPage } from './pages/TradesPage'
import { PlanForm } from './pages/PlanForm'
import { TradeDetail } from './pages/TradeDetail'
import { ReviewPage } from './pages/ReviewPage'
import { SettingsPage } from './pages/SettingsPage'
import { NotFound } from './pages/NotFound'

function navClass({ isActive }: { isActive: boolean }) {
  return isActive
    ? 'rounded-md px-3 py-1.5 text-sm font-medium text-indigo-700 bg-indigo-50'
    : 'rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100'
}

export function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3">
          <h1 className="text-base font-semibold text-slate-900">Trade Journal</h1>
          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={navClass}>
              Trades
            </NavLink>
            <NavLink to="/review" className={navClass}>
              Review
            </NavLink>
            <NavLink to="/settings" className={navClass}>
              Settings
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <Routes>
          <Route path="/" element={<TradesPage />} />
          <Route path="/trades/new" element={<PlanForm />} />
          <Route path="/trades/:id" element={<TradeDetail />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  )
}
