import type { Result } from './types'

// One exact option contract. The expiration is an explicit Plan/fact value —
// it is never inferred from a calendar or from a price observation.
export type OptionKind = 'Call' | 'Put'
export type OptionContract = {
  underlying: string
  kind: OptionKind
  strike: string
  expiration: string
  multiplier: number
}

export type OptionContractDraft = {
  underlying: string
  kind: string
  strike: string
  expiration: string
  multiplier: string
}

export function parseOptionContract(
  draft: OptionContractDraft,
): Result<OptionContract, { issues: string[] }> {
  const issues: string[] = []
  const underlying = String(draft.underlying ?? '').trim().toUpperCase()
  if (!underlying) issues.push('Underlying')
  const kind = draft.kind
  if (kind !== 'Call' && kind !== 'Put') issues.push('OptionKind')
  const strike = String(draft.strike ?? '').trim()
  if (!strike || !Number.isFinite(Number(strike)) || Number(strike) <= 0) issues.push('Strike')
  const expiration = String(draft.expiration ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiration)) issues.push('Expiration')
  const multiplier = Number(draft.multiplier)
  if (!Number.isInteger(multiplier) || multiplier <= 0) issues.push('Multiplier')
  if (issues.length) return { ok: false, error: { issues: [...new Set(issues)] } }
  return {
    ok: true,
    value: { underlying, kind, strike, expiration, multiplier },
  }
}

export function canonicalInstrument(contract: OptionContract): string {
  return `${contract.underlying} ${contract.strike}${contract.kind} ${contract.expiration} x${contract.multiplier}`
}
