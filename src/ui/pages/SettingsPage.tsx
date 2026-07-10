import { useEffect, useState } from 'react'
import { useTradeBook } from '../tradeBookContext'
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
    <section>
      <h2>Settings</h2>

      <h3>Institutions</h3>
      <ul>
        {institutions.map((institution) => (
          <li key={institution.id}>{institution.name}</li>
        ))}
      </ul>
      <div>
        <label>
          Institution name
          <input value={institutionName} onChange={(e) => setInstitutionName(e.target.value)} />
        </label>
        <button type="button" onClick={() => void addInstitution()}>
          Add institution
        </button>
      </div>

      <h3>Accounts</h3>
      <ul>
        {accounts.map((account) => (
          <li key={account.id}>{account.name}</li>
        ))}
      </ul>
      <div>
        <label>
          Account name
          <input value={accountName} onChange={(e) => setAccountName(e.target.value)} />
        </label>
        <label>
          Institution
          <select
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
        <button type="button" onClick={() => void addAccount()}>
          Add account
        </button>
      </div>
    </section>
  )
}
