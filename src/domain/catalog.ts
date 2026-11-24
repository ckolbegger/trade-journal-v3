import type { Account, Institution, Result } from './types'

export type CatalogError =
  | { kind: 'DuplicateLabel' }
  | { kind: 'StaleRevision' }
  | { kind: 'ParentNotSelectable' }
  | { kind: 'HasSelectableAccounts' }
  | { kind: 'InactiveForRequestedUse' }

function nextId(prefix: string, label: string): string {
  const slug = label.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${prefix}-${slug}`
}

export function createInstitution(
  label: string,
  existing: Institution[],
): Result<Institution, CatalogError> {
  if (existing.some(i => i.label.toLowerCase() === label.toLowerCase() && i.active)) {
    return { ok: false, error: { kind: 'DuplicateLabel' } }
  }
  return {
    ok: true,
    value: {
      id: nextId('inst', label),
      label,
      active: true,
      revision: '1',
      history: [],
    },
  }
}

export function renameInstitution(
  institution: Institution,
  newLabel: string,
  expectedRevision: string,
): Result<Institution, CatalogError> {
  if (institution.revision !== expectedRevision) {
    return { ok: false, error: { kind: 'StaleRevision' } }
  }
  return {
    ok: true,
    value: {
      ...institution,
      label: newLabel,
      revision: String(Number(institution.revision) + 1),
      history: [...institution.history, { label: institution.label, active: institution.active, recordedAt: new Date().toISOString() }],
    },
  }
}

export function createAccount(
  label: string,
  institution: Institution,
): Result<Account, CatalogError> {
  if (!institution.active) return { ok: false, error: { kind: 'ParentNotSelectable' } }
  return {
    ok: true,
    value: {
      id: nextId('acct', label),
      institutionId: institution.id,
      label,
      active: true,
      revision: '1',
      history: [],
    },
  }
}

export function archiveInstitution(
  institution: Institution,
  accounts: Account[],
): Result<Institution, CatalogError> {
  if (accounts.some(a => a.institutionId === institution.id && a.active)) {
    return { ok: false, error: { kind: 'HasSelectableAccounts' } }
  }
  return {
    ok: true,
    value: {
      ...institution,
      active: false,
      revision: String(Number(institution.revision) + 1),
      history: [...institution.history, { label: institution.label, active: institution.active, recordedAt: new Date().toISOString() }],
    },
  }
}

export function resolveNewSelection(account: Account): Result<Account, CatalogError> {
  if (!account.active) return { ok: false, error: { kind: 'InactiveForRequestedUse' } }
  return { ok: true, value: account }
}
