import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { HomePage } from './HomePage'

describe('HomePage', () => {
  it('renders the Home heading', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument()
  })

  it('renders a Settings link', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument()
  })

  it('renders no derived figures — no dollar amount and no digit-count line', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    // An absence check that records intent: the ESLint boundary rule is what
    // actually prevents deriving here, since this page has no data to derive from.
    // No P&L / dollar figure anywhere on the page.
    expect(screen.queryByText(/\$-?[\d,]/)).not.toBeInTheDocument()
    // No "Day N" / "K open" style computed count.
    expect(screen.queryByText(/\bDay \d/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/\d+\s*open/i)).not.toBeInTheDocument()
  })
})
