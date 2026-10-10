import { Route, Routes } from 'react-router'
import { BottomNav, SideNav } from './nav'
import HomePage from './pages/HomePage'
import TradesPage from './pages/TradesPage'
import PlanPage from './pages/PlanPage'
import ReviewPage from './pages/ReviewPage'
import JournalPage from './pages/JournalPage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-ink"
      >
        Skip to content
      </a>
      <SideNav />
      <div className="md:pl-60">
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-3xl px-4 pt-6 pb-24 md:px-8 md:pb-10"
        >
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/trades" element={<TradesPage />} />
            <Route path="/plan" element={<PlanPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/journal" element={<JournalPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
      <BottomNav />
    </>
  )
}
