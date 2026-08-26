import { useState } from 'react'
import { useTradeBook } from './tradeBookContext'
import { btnPrimary, field, heading, input, subheading } from './styles'
import type { Account, Institution } from '@/books/tradebook/types'
import { RestoreFlow } from './components/RestoreFlow'

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
    <div className="flex min-h-screen items-center justify-center bg-cream px-4">
      <section className="w-full max-w-md space-y-4 rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className={heading}>Set up your first account</h2>
        <p className="text-sm text-stone-600">
          Every Trade belongs to an Account held at an Institution. Add your first of each.
        </p>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            void handleSubmit()
          }}
        >
          <label className={field}>
            Institution name
            <input
              className={input}
              value={institutionName}
              onChange={(e) => setInstitutionName(e.target.value)}
            />
          </label>
          <label className={field}>
            Account name
            <input
              className={input}
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <button type="submit" className={btnPrimary}>
            Get started
          </button>
        </form>

        <div className="space-y-2 border-t border-stone-200 pt-4">
          <h3 className={subheading}>Returning trader?</h3>
          <p className="text-sm text-stone-600">Restore your journal from a backup file.</p>
          <RestoreFlow onRestored={onComplete} />
        </div>
      </section>
    </div>
  )
}
