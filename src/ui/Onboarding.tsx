import { useState } from 'react'
import { useTradeBook } from './tradeBookContext'
import type { Account, Institution } from '@/books/tradebook/types'

export function Onboarding({ onComplete }: { onComplete: () => void }) {
  const tradeBook = useTradeBook()
  const [institutionName, setInstitutionName] = useState('')
  const [accountName, setAccountName] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!institutionName.trim() || !accountName.trim()) {
      setError('Enter both an institution name and an account name to continue.')
      return
    }
    const institution: Institution = { id: '', name: institutionName.trim() }
    await tradeBook.registries.institutions.save(institution)
    const account: Account = {
      id: '',
      name: accountName.trim(),
      institutionId: institution.id,
    }
    await tradeBook.registries.accounts.save(account)
    onComplete()
  }

  return (
    <section>
      <h2>Set up your first account</h2>
      <p>Every Trade belongs to an Account held at an Institution. Add your first of each.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void handleSubmit()
        }}
      >
        <label>
          Institution name
          <input value={institutionName} onChange={(e) => setInstitutionName(e.target.value)} />
        </label>
        <label>
          Account name
          <input value={accountName} onChange={(e) => setAccountName(e.target.value)} />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit">Get started</button>
      </form>
    </section>
  )
}
