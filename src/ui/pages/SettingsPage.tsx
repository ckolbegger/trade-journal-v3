import { useEffect, useState } from 'react'
import { useTradeBook } from '../tradeBookContext'
import { useWorkspace } from '../workspaceContext'
import { usePriceBook } from '../priceBookContext'
import { btnPrimary, btnSecondary, card, field, heading, input, num, subheading } from '../styles'
import { centsToDollars, daysAgoISO, downloadBlob, timestampToISODate, todayISO } from '../format'
import type { Account, Institution } from '@/books/tradebook/types'
import { MARKETDATA_SOURCE_ID } from '@/books/pricebook/adapters/marketdata-adapter'
import type { StorageHealth } from '@/workspace/workspace'
import { RestoreFlow } from '../components/RestoreFlow'

// Binary MiB, one decimal — plausible-reading figures next to the durable
// storage flag (workspace.md's StorageHealth is exact bytes; formatting is a
// UI concern).
function formatMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1)
}

// The one instrument "Test this source" checks connectivity against — a
// smoke test, not a Trade's actual instrument (docs/plan/slice-04-automated-pricing.md,
// S4.1.T3). Deliberately not AAPL: marketdata.app serves AAPL as its keyless
// trial symbol (real data for ANY token, even a bad one), so it can't actually
// validate a key — a liquid non-trial ticker is required for the test to fail
// on a bad key instead of silently "succeeding".
const TEST_INSTRUMENT = 'MSFT'

// A trailing window, not just today: a same-day-only test is a false negative
// every weekend/holiday (a valid key would show "no price" and look broken).
// The latest close in the window is what's shown, with its date.
const TEST_WINDOW_DAYS = 6

export function SettingsPage() {
  const tradeBook = useTradeBook()
  const workspace = useWorkspace()
  const priceBook = usePriceBook()
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [institutionName, setInstitutionName] = useState('')
  const [accountName, setAccountName] = useState('')
  const [accountInstitutionId, setAccountInstitutionId] = useState('')
  // Displayed as a whole percentage ("4" for 4%), stored as the decimal
  // TradeMath.impliedVol reads (workspace.md's Settings.riskFreeRate).
  const [riskFreeRatePct, setRiskFreeRatePct] = useState('')
  const [sourceEnabled, setSourceEnabled] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [sourceSaved, setSourceSaved] = useState(false)
  const [testResult, setTestResult] = useState<{
    close?: string
    date?: string
    error?: string
  } | null>(null)

  useEffect(() => {
    let active = true
    void workspace.settings.get('riskFreeRate').then((rate) => {
      if (active) setRiskFreeRatePct(String(rate * 100))
    })
    return () => {
      active = false
    }
  }, [workspace])

  useEffect(() => {
    let active = true
    void workspace.settings.get('pricingSources').then((sources) => {
      if (!active) return
      const config = sources.find((s) => s.id === MARKETDATA_SOURCE_ID)
      if (config) {
        setSourceEnabled(config.enabled)
        setApiKey(config.apiKey ?? '')
      }
    })
    return () => {
      active = false
    }
  }, [workspace])

  async function saveRiskFreeRate() {
    if (riskFreeRatePct.trim() === '') return
    await workspace.settings.set('riskFreeRate', Number(riskFreeRatePct) / 100)
  }

  async function savePricingSource() {
    setSourceSaved(false)
    await workspace.settings.set('pricingSources', [
      { id: MARKETDATA_SOURCE_ID, enabled: sourceEnabled, apiKey },
    ])
    // Adapter registration reads Settings once, at startup (bootstrap.ts) — a
    // saved change needs a reload to take effect; this confirms the save
    // itself completed before the trader (or a test) reloads.
    setSourceSaved(true)
  }

  async function testPricingSource() {
    setTestResult(null)
    const report = await priceBook.fetch([TEST_INSTRUMENT], {
      from: daysAgoISO(TEST_WINDOW_DAYS),
      to: todayISO(),
    })
    if (report.errors.length > 0) {
      setTestResult({ error: report.errors[0].message })
    } else if (report.stored.length > 0) {
      const latest = report.stored.reduce((a, b) => (a.date > b.date ? a : b))
      setTestResult({ close: centsToDollars(latest.price), date: latest.date })
    } else {
      setTestResult({
        error: `No price returned for ${TEST_INSTRUMENT} in the last ${TEST_WINDOW_DAYS + 1} days.`,
      })
    }
  }

  async function reload() {
    setInstitutions(await tradeBook.registries.institutions.list())
    setAccounts(await tradeBook.registries.accounts.list())
  }

  const [backupNudgeDays, setBackupNudgeDays] = useState('')

  useEffect(() => {
    let active = true
    void workspace.settings.get('backupNudgeDays').then((days) => {
      if (active) setBackupNudgeDays(String(days))
    })
    return () => {
      active = false
    }
  }, [workspace])

  async function saveBackupNudgeDays() {
    if (backupNudgeDays.trim() === '') return
    await workspace.settings.set('backupNudgeDays', Number(backupNudgeDays))
  }

  const [health, setHealth] = useState<StorageHealth | null>(null)

  async function reloadHealth() {
    setHealth(await workspace.storageHealth())
  }

  useEffect(() => {
    let active = true
    void workspace.storageHealth().then((h) => {
      if (active) setHealth(h)
    })
    return () => {
      active = false
    }
  }, [workspace])

  async function requestPersistence() {
    await workspace.requestPersistence()
    await reloadHealth()
  }

  async function exportBackup() {
    const blob = await workspace.exportAll()
    downloadBlob(blob, `trade-journal-${todayISO()}.json`)
    await reloadHealth()
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
        <ul className="divide-y divide-stone-100 text-sm text-stone-800">
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
        <ul className="divide-y divide-stone-100 text-sm text-stone-800">
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

      <div className={`${card} space-y-3`}>
        <h3 className={subheading}>Pricing sources</h3>
        <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
          <input
            type="checkbox"
            checked={sourceEnabled}
            onChange={(e) => setSourceEnabled(e.target.checked)}
          />
          Enable marketdata.app
        </label>
        <div className="flex flex-wrap items-end gap-2">
          <label className={`${field} flex-1`}>
            API key
            <input
              className={input}
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </label>
          <button type="button" className={btnSecondary} onClick={() => void savePricingSource()}>
            Save source
          </button>
          <button type="button" className={btnSecondary} onClick={() => void testPricingSource()}>
            Test this source
          </button>
        </div>
        {sourceSaved && <p className="text-sm text-stone-500">Saved.</p>}
        {testResult && (
          <p className={`text-sm ${testResult.error ? 'text-red-700' : 'text-stone-700'}`}>
            {testResult.error ??
              `${TEST_INSTRUMENT} close (${testResult.date}): $${testResult.close}`}
          </p>
        )}
      </div>

      <div className={`${card} space-y-3`}>
        <h3 className={subheading}>Implied volatility</h3>
        <div className="flex items-end gap-2">
          <label className={`${field} flex-1`}>
            Risk-free rate (%)
            <input
              className={`${input} ${num}`}
              type="number"
              value={riskFreeRatePct}
              onChange={(e) => setRiskFreeRatePct(e.target.value)}
            />
          </label>
          <button type="button" className={btnPrimary} onClick={() => void saveRiskFreeRate()}>
            Save rate
          </button>
        </div>
      </div>

      <div className={`${card} space-y-3`}>
        <h3 className={subheading}>Backup</h3>
        {health && (
          <p className="text-sm text-stone-700">
            Durable storage: {health.persisted ? 'Yes' : 'No'} · {formatMB(health.usageBytes)} MB /{' '}
            {formatMB(health.quotaBytes)} MB
          </p>
        )}
        <p className="text-sm text-stone-500">
          {health?.lastExportAt
            ? `Last export: ${timestampToISODate(health.lastExportAt)}`
            : 'Never exported'}
        </p>
        <div className="flex flex-wrap gap-2">
          {health && !health.persisted && (
            <button
              type="button"
              className={btnSecondary}
              onClick={() => void requestPersistence()}
            >
              Request durable storage
            </button>
          )}
          <button type="button" className={btnPrimary} onClick={() => void exportBackup()}>
            Export backup
          </button>
        </div>
        <div className="flex items-end gap-2">
          <label className={`${field} flex-1`}>
            Nudge me to back up after (days)
            <input
              className={`${input} ${num}`}
              type="number"
              value={backupNudgeDays}
              onChange={(e) => setBackupNudgeDays(e.target.value)}
            />
          </label>
          <button type="button" className={btnSecondary} onClick={() => void saveBackupNudgeDays()}>
            Save
          </button>
        </div>
        <RestoreFlow
          onRestored={() => {
            void reload()
            void reloadHealth()
          }}
        />
      </div>
    </section>
  )
}
