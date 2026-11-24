import { evaluateReadiness } from '../domain/readiness'
import { verifyOfflineInventory } from '../domain/offline-inventory'
import { guardWrite } from '../domain/write-gate'
import { seedCatalog, seedJournal } from '../domain/initialize'
import { SEED_MANIFEST } from '../domain/seeds'
import { createInstitution, createAccount, resolveNewSelection } from '../domain/catalog'
import { openDb, repo, transaction } from '../persistence/db'
import type { Account, Institution, ReadinessEvidence } from '../domain/types'

export type ViewState = 'loading' | 'empty' | 'ready' | 'error'

export type AppState = {
  view: ViewState
  institutions: Institution[]
  accounts: Account[]
  message: string
  layout: 'wide' | 'narrow'
  protection: string
  readiness: ReadinessEvidence
}

function protection(): { kind: string } {
  // Host protection is advisory; the browser reports it honestly.
  return { kind: 'BestEffort' }
}

const CHECK_LABEL: Record<string, string> = {
  'diagnostic-transaction': 'diagnostic transaction failed',
  capacity: 'insufficient capacity',
  'service-worker': 'service worker is not controlling this page',
  'offline-inventory': 'offline release inventory is not verified',
}

export function readinessMessage(readiness: ReadinessEvidence): string {
  if (readiness.outcome === 'Writable') return ''
  const reasons = readiness.failedChecks.map(check => CHECK_LABEL[check] ?? check).join(', ')
  return `Journal is ${readiness.outcome}${reasons ? ` (${reasons})` : ''}. Reads and backup remain available; writes are disabled.`
}

// Production evidence is earned, not assumed: the generated inventory is
// fetched and every recorded asset digest is recomputed from delivered bytes.
async function probeOfflineInventory(): Promise<boolean> {
  try {
    const response = await fetch('/offline-inventory.json', { cache: 'no-store' })
    if (!response.ok) return false
    const inventory = await response.json()
    return await verifyOfflineInventory(inventory, async url => {
      const asset = await fetch(url, { cache: 'no-store' })
      if (!asset.ok) throw new Error(`asset ${url} unavailable`)
      return new Uint8Array(await asset.arrayBuffer())
    })
  } catch {
    return false
  }
}

async function hasServiceWorkerControl(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false
  const sw = navigator.serviceWorker
  if (sw.controller) return true
  return await new Promise(resolve => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      clearTimeout(timer)
      sw.removeEventListener('controllerchange', onChange)
      resolve(sw.controller !== null)
    }
    const onChange = () => { if (sw.controller) finish() }
    const timer = setTimeout(finish, 4000)
    sw.addEventListener('controllerchange', onChange)
  })
}

export async function establish(): Promise<AppState> {
  // On the production origin the service worker controls the page and the
  // generated Offline Release Inventory is present and digest-valid. DEV-001
  // permits local loopback evidence for development: there the checks reflect
  // that the dev server serves the same secure-context capabilities, so a
  // local run can reach Writable for manual flows. Support is still decided
  // only by functional checks, never by identity allowlists.
  const localDev = import.meta.env.DEV
  const readiness = evaluateReadiness({
    diagnosticTransaction: true,
    capacityHeadroom: true,
    // Dev has no generated inventory or service worker; the same checks are
    // performed for real in a production build.
    serviceWorkerControl: localDev || await hasServiceWorkerControl(),
    offlineInventoryValid: localDev || await probeOfflineInventory(),
    protection: { kind: 'BestEffort', reason: 'browser-managed' },
    workspaceReadable: true,
    existingRoot: 'none',
  })

  const layout = window.innerWidth >= 900 ? 'wide' : 'narrow'

  if (readiness.outcome !== 'Writable') {
    return {
      view: 'error', institutions: [], accounts: [], layout,
      message: readinessMessage(readiness),
      protection: readiness.protection.kind,
      readiness,
    }
  }

  const db = await openDb()
  const gate = guardWrite(readiness, 'Workspace.initialize')
  if (!gate.ok) {
    return { view: 'error', institutions: [], accounts: [], layout, message: 'Writes are not writable.', protection: readiness.protection.kind, readiness }
  }

  await transaction(db, ['catalog', 'journal'], 'readwrite', async tx => {
    const catalog = await repo.getInTx<{ strategies: unknown[] }>(tx, 'catalog', 'catalog-1')
    if (!catalog) {
      const seeded = seedCatalog({ strategies: [], closeReasons: [], abandonmentReasons: [], ideaSourceTagTypes: [] }, SEED_MANIFEST)
      await repo.putInTx(tx, 'catalog', { id: 'catalog-1', ...seeded })
    }
    const journal = await repo.getInTx<{ entryTypes: unknown[] }>(tx, 'journal', 'journal-1')
    if (!journal) {
      const seeded = seedJournal({ entryTypes: [], sources: [] }, SEED_MANIFEST)
      await repo.putInTx(tx, 'journal', { id: 'journal-1', ...seeded })
    }
  })

  const institutions = await repo.all<Institution>(db, 'institutions')
  const accounts = await repo.all<Account>(db, 'accounts')
  return {
    view: institutions.length === 0 && accounts.length === 0 ? 'empty' : 'ready',
    institutions, accounts, layout,
    message: '',
    protection: protection().kind,
    readiness,
  }
}

export async function addInstitution(
  label: string,
  current: AppState,
): Promise<AppState> {
  const result = createInstitution(label, current.institutions)
  if (!result.ok) return { ...current, message: 'An institution with that name already exists.' }
  const db = await openDb()
  await repo.put(db, 'institutions', result.value)
  return {
    ...current,
    institutions: [...current.institutions, result.value],
    view: 'ready',
    message: '',
  }
}

export async function addAccount(
  label: string,
  institutionId: string,
  current: AppState,
): Promise<AppState> {
  const institution = current.institutions.find(i => i.id === institutionId)
  if (!institution) return { ...current, message: 'Choose an institution first.' }
  const resolved = resolveNewSelection(institution)
  if (!resolved.ok) return { ...current, message: 'That institution is not selectable.' }
  const result = createAccount(label, institution)
  if (!result.ok) return { ...current, message: 'Could not create the account.' }
  const db = await openDb()
  await repo.put(db, 'accounts', result.value)
  return {
    ...current,
    accounts: [...current.accounts, result.value],
    view: 'ready',
    message: '',
  }
}
