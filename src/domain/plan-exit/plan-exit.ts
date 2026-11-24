import { parseDecimal, Rational } from '../values/index.ts'

// The measure of a sale against the Plan Exit (A309). Pure: the caller supplies the facts its view returned.
export type PlanExitLine = 'Stop' | 'Target'

export interface PlanExitCondition {
  readonly id: string
  readonly role: PlanExitLine
  readonly boundary: string
  // The condition's status at the Trade's latest Marks; undefined when it cannot be read.
  readonly status?: 'Active' | 'Breached' | 'Reached'
  // True when the condition is priced in the traded Instrument, so the sale's own price can reach it.
  readonly pricedInTradedInstrument: boolean
}

// A Hold saved on an earlier Review Date while the condition was reached: its line, the date it was reached and the sessions held.
export interface PlanExitHoldPast {
  readonly conditionId: string
  readonly line: PlanExitLine
  readonly since: string
  readonly sessions: number
}

export interface PlanExitInput {
  // The open quantity of the traded Instrument, signed: negative for a short Position.
  readonly held: string
  readonly change: { readonly side: 'Buy' | 'Sell'; readonly quantity: string; readonly price?: string }
  readonly conditions: readonly PlanExitCondition[]
  readonly heldPast: readonly PlanExitHoldPast[]
}

export type PlanExitReason =
  | { readonly kind: 'BeforeCondition' }
  | { readonly kind: 'HeldPast'; readonly line: PlanExitLine; readonly since: string; readonly sessions: number }
  | { readonly kind: 'PartOnly'; readonly held: string; readonly sold: string }

export type PlanExitMeasure = { readonly kind: 'Follows' } | { readonly kind: 'Leaves'; readonly reasons: readonly PlanExitReason[] }

// The condition's boundary lies at or beyond the price, on the side the Position's quantity gives (the evaluator's own test).
function reachedAtPrice(condition: PlanExitCondition, held: Rational, price: string | undefined): boolean {
  if (!condition.pricedInTradedInstrument || price === undefined) return false
  const mark = parseDecimal(price)
  const boundary = parseDecimal(condition.boundary)
  if (!mark.ok || !boundary.ok) return false
  const toward = condition.role === 'Stop' ? mark.value.sub(boundary.value) : boundary.value.sub(mark.value)
  return held.mul(toward).compare(Rational.of(0n)) <= 0
}

// Nothing for a change that does not reduce the Position (a buy), or whose quantity is not yet a quantity.
export function measurePlanExit(input: PlanExitInput): PlanExitMeasure | undefined {
  const held = parseDecimal(input.held)
  const sold = parseDecimal(input.change.quantity)
  if (!held.ok || !sold.ok) return undefined
  // A sale takes the side opposite the Position's: a Sell of a long one, a Buy of a short one.
  if (held.value.numerator === 0n || (held.value.numerator > 0n) !== (input.change.side === 'Sell')) return undefined
  const heldAbs = held.value.numerator < 0n ? Rational.of(0n).sub(held.value) : held.value
  // No measure for a quantity that is not positive or is more than is held (the save refuses it).
  if (sold.value.numerator <= 0n || sold.value.compare(heldAbs) > 0) return undefined
  const reasons: PlanExitReason[] = []
  const reached = input.conditions.filter((c) => c.status === 'Breached' || c.status === 'Reached' || reachedAtPrice(c, held.value, input.change.price))
  if (reached.length === 0) reasons.push({ kind: 'BeforeCondition' })
  const holds = reached.flatMap((c) => input.heldPast.filter((h) => h.conditionId === c.id).slice(0, 1))
  // The sale follows the Plan when some reached condition was never held past; otherwise each Hold is a reason, the Stop's first.
  if (holds.length > 0 && holds.length === reached.length) {
    const ordered = [...holds].sort((a, b) => Number(a.line === 'Target') - Number(b.line === 'Target'))
    for (const h of ordered) reasons.push({ kind: 'HeldPast', line: h.line, since: h.since, sessions: h.sessions })
  }
  if (sold.value.compare(heldAbs) < 0) reasons.push({ kind: 'PartOnly', held: held.normalized.replace(/^-/, ''), sold: sold.normalized })
  return reasons.length === 0 ? { kind: 'Follows' } : { kind: 'Leaves', reasons }
}
