import { useEffect, useState } from 'react'
import { useTradeBook } from '../tradeBookContext'
import { btnSecondary, card, field, heading, input, subheading } from '../styles'
import type { Account, Institution } from '@/books/tradebook/types'

export function SettingsPage() {
  const tradeBook = useTradeBook()
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [institutionName, setInstitutionName] = useState('')
  const [accountName, setAccountName] = useState('')
  const [accountInstitutionId, setAccountInstitutionId] = useState('')

  async function reload() {
    setInstitutions(await tradeBook.registries.institutions.list())
    setAccounts(await tradeBook.registries.accounts.list())
  }

  useEffect(() => {
    let active = true
    Promise.all([
      tradeBook.registries.institutions.list(),
      tradeBook.registries.accounts.list(),
    ]).then(([loadedInstitutions, loadedAccounts]) => {
      if (active) {
        setInstitutions(loadedInstitutions)
        setAccounts(loadedAccounts)
      }
    })
    return () => {
      active = false
    }
  }, [tradeBook])

  async function addInstitution() {
    if (!institutionName.trim()) return
    await tradeBook.registries.institutions.save({ id: '', name: institutionName.trim() })
    setInstitutionName('')
    await reload()
  }

  async function addAccount() {
    if (!accountName.trim() || !accountInstitutionId) return
    await tradeBook.registries.accounts.save({
      id: '',
      name: accountName.trim(),
      institutionId: accountInstitutionId,
    })
    setAccountName('')
    await reload()
  }

  return (
    <section className="space-y-6">
      <h2 className={heading}>Settings</h2>

      <div className={`${card} space-y-3`}>
        <h3 className={subheading}>Institutions</h3>
        <ul className="divide-y divide-slate-100 text-sm text-slate-800">
          {institutions.map((institution) => (
            <li key={institution.id} className="py-1.5">
              {institution.name}
            </li>
          ))}
        </ul>
        <div className="flex items-end gap-2">
          <label className={`${field} flex-1`}>
            Institution name
            <input
              className={input}
              value={institutionName}
              onChange={(e) => setInstitutionName(e.target.value)}
            />
          </label>
          <button type="button" className={btnSecondary} onClick={() => void addInstitution()}>
            Add institution
          </button>
        </div>
      </div>

      <div className={`${card} space-y-3`}>
        <h3 className={subheading}>Accounts</h3>
        <ul className="divide-y divide-slate-100 text-sm text-slate-800">
          {accounts.map((account) => (
            <li key={account.id} className="py-1.5">
              {account.name}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-end gap-2">
          <label className={`${field} flex-1`}>
            Account name
            <input
              className={input}
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
            />
          </label>
          <label className={`${field} flex-1`}>
            Institution
            <select
              className={input}
              value={accountInstitutionId}
              onChange={(e) => setAccountInstitutionId(e.target.value)}
            >
              <option value="">Select…</option>
              {institutions.map((institution) => (
                <option key={institution.id} value={institution.id}>
                  {institution.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className={btnSecondary} onClick={() => void addAccount()}>
            Add account
          </button>
        </div>
      </div>
    </section>
  )
}
