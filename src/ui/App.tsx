import { NavLink, Route, Routes } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { TradesPage } from './pages/TradesPage'
import { PlanForm } from './pages/PlanForm'
import { TradeDetail } from './pages/TradeDetail'
import { TimelinePage } from './pages/TimelinePage'
import { ReviewPage } from './pages/ReviewPage'
import { SettingsPage } from './pages/SettingsPage'
import { NotFound } from './pages/NotFound'
import { tabItemActive, tabItemInactive } from './styles'

function tabClass({ isActive }: { isActive: boolean }) {
  return isActive ? tabItemActive : tabItemInactive
}

const homeIcon = (
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
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5 10v10h14V10" />
  </svg>
)

const tradesIcon = (
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
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M7 9h10M7 13h10M7 17h6" />
  </svg>
)

const journalIcon = (
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
    <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5V4.5Z" />
    <path d="M4 19a2.5 2.5 0 0 1 2.5-2.5H20" />
  </svg>
)

const reviewIcon = (
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
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <path d="M9 3v2h6V3" />
    <path d="m9 13 2 2 4-4" />
  </svg>
)

export function App() {
  return (
    <div className="min-h-screen bg-cream text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex w-full max-w-3xl items-center px-4 py-3">
          <h1 className="text-base font-semibold text-stone-900">Trade Journal</h1>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-6 pb-24">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/trades" element={<TradesPage />} />
          <Route path="/trades/new" element={<PlanForm />} />
          <Route path="/trades/:id" element={<TradeDetail />} />
          <Route path="/journal" element={<TimelinePage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <nav className="fixed inset-x-0 bottom-0 border-t border-stone-200 bg-white">
        <div className="mx-auto flex w-full max-w-3xl">
          <NavLink to="/" end className={tabClass}>
            {homeIcon}
            Home
          </NavLink>
          <NavLink to="/trades" className={tabClass}>
            {tradesIcon}
            Trades
          </NavLink>
          <NavLink to="/journal" className={tabClass}>
            {journalIcon}
            Journal
          </NavLink>
          <NavLink to="/review" className={tabClass}>
            {reviewIcon}
            Review
          </NavLink>
        </div>
      </nav>
    </div>
  )
}
