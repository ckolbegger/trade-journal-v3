import { NavLink, Route, Routes } from 'react-router-dom'
import { TradesPage } from './pages/TradesPage'
import { ReviewPage } from './pages/ReviewPage'
import { SettingsPage } from './pages/SettingsPage'
import { NotFound } from './pages/NotFound'

export function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Trade Journal</h1>
        <nav className="app-nav">
          <NavLink to="/">Trades</NavLink>
          <NavLink to="/review">Review</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<TradesPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  )
}
