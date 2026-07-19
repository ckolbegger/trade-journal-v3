import type {
  ExitLevel,
  LegFacts,
  MarkSet,
  Money,
  OptionInstrument,
  RiskReward,
  TradeRecord,
} from './types'
import { buildInstrumentKey } from './instrument'
import { contractMultiplierOf } from './multiplier'

// Ongoing Risk/Reward, mark-to-market (ADR 0010): the four anchors measure from
// today's Marks — giving back unrealized gains counts as risk. `original` measures
// from the actual entry basis to the ORIGINAL Plan's stop/target, for contrast;
// it is 'undefined' until the first Execution exists. A Trade-scope stop/target is
// `underlyingPrice` (stock's own scale, or an option projected at intrinsic —
// ADR 0009, decided in Slice 3) or `structureValue` — displayed to the trader as
// "Position price": the net per-spread-unit QUOTED price of the option legs,
// always a positive typed quote (user ruling 2026-07-19, docs/design/
// trademath.md). This per-unit scale is canonical for single- AND multi-leg
// structures alike — `projectedDelta` (below) multiplies the quote by the
// contract multiplier, the option legs' shared lot count (their qty GCD), and
// a DIRECTION inferred from the entry structure's net sign (credit → negative,
// debit → positive) — the same one formula a single held Leg already used
// (Slice 3.1), now generalized rather than special-cased.
//
// Multi-leg (Slice 7): worstCaseRisk/maxReward and an `underlyingPrice` stop/
// target project the WHOLE structure's signed value at a given underlying
// price — one universal sum over every Leg (ADR 0012, direction carries the
// signs; nothing branches on Strategy) — rather than each Leg's own extreme in
// isolation, which is what lets a covered call's maxReward come out CAPPED
// (the short call's slope cancels the stock's as the underlying rises)
// instead of 'unlimited', and lets a ratio write's local peak at its short
// strike show a positive maxReward instead of the nonsense a S→0/S→∞-only
// scan would produce (a negative "max reward"). `original` uses the SAME
// projection machinery over the Trade's entry basis (every Leg's opening
// fills) instead of today's Marks — one formula, two inputs.
//
// A stray `pctOfMaxProfit`-kind level from a pre-ruling stored Plan (never
// produced going forward) falls through every `level.kind` branch below —
// `projected` stays `undefined`, so `projectedDelta` reports 'undefined'
// rather than crashing (legacy tolerance, same ruling).

// An option's intrinsic value at a given underlying price — the only "worth"
// TradeMath ever assigns an option away from its own Mark (no pricing model,
// ADR 0009).
function intrinsicAt(instrument: OptionInstrument, underlyingPrice: number): number {
  return instrument.type === 'put'
    ? Math.max(instrument.strike - underlyingPrice, 0)
    : Math.max(underlyingPrice - instrument.strike, 0)
}

function stopLevel(trade: TradeRecord): ExitLevel | undefined {
  return trade.plan.exitLevels.find((l) => l.side === 'stop' && l.scope.level === 'trade')
}
function targetLevel(trade: TradeRecord): ExitLevel | undefined {
  return trade.plan.exitLevels.find((l) => l.side === 'target' && l.scope.level === 'trade')
}

interface LegBasis {
  leg: LegFacts
  qty: number
  side: 'long' | 'short'
  avgEntry: number
}

// Every currently-held Leg, with its net open quantity, side, and average
// entry price.
function heldLegs(trade: TradeRecord): LegBasis[] {
  const result: LegBasis[] = []
  for (const leg of trade.legs) {
    if (leg.executions.length === 0) continue
    const openSide = leg.executions[0].side
    let openedQty = 0
    let openedCost = 0
    let closedQty = 0
    for (const e of leg.executions) {
      if (e.side === openSide) {
        openedQty += e.qty
        openedCost += e.qty * e.price
      } else {
        closedQty += e.qty
      }
    }
    const qty = openedQty - closedQty
    if (qty > 0) {
      result.push({
        leg,
        qty,
        side: openSide === 'buy' ? 'long' : 'short',
        avgEntry: openedCost / openedQty,
      })
    }
  }
  return result
}

// Every Leg's entry basis — total opening quantity and average entry price,
// independent of what is still held (a fully-closed short Leg's buy-to-close
// is never mistaken for an entry; only its opening side counts). This is what
// `original` measures from — the Trade's ENTRY structure, across every Leg
// that ever opened, not just what remains today (multi-leg, Slice 7 — a
// covered call's original risk/reward is the STOCK entry and the CALL entry
// summed, not just whichever Leg happens to iterate first).
function entryBasisLegs(trade: TradeRecord): LegBasis[] {
  const result: LegBasis[] = []
  for (const leg of trade.legs) {
    if (leg.executions.length === 0) continue
    const openSide = leg.executions[0].side
    let openedQty = 0
    let openedCost = 0
    for (const e of leg.executions) {
      if (e.side === openSide) {
        openedQty += e.qty
        openedCost += e.qty * e.price
      }
    }
    if (openedQty > 0) {
      result.push({
        leg,
        qty: openedQty,
        side: openSide === 'buy' ? 'long' : 'short',
        avgEntry: openedCost / openedQty,
      })
    }
  }
  return result
}

// The structure's signed value at a given underlying price S — a stock Leg's
// own "intrinsic" IS S; an option Leg intrinsic-projects at S (no pricing
// model, ADR 0009). Summed across every Leg with its sign, qty, and contract
// multiplier (ADR 0012 — direction carries the signs, nothing branches on
// Strategy).
function structureValueAt(legs: LegBasis[], underlyingPrice: number): number {
  return legs.reduce((sum, h) => {
    const sign = h.side === 'short' ? -1 : 1
    const multiplier = contractMultiplierOf(h.leg.instrument)
    const value =
      h.leg.instrument.kind === 'option'
        ? intrinsicAt(h.leg.instrument, underlyingPrice)
        : underlyingPrice
    return sum + sign * h.qty * value * multiplier
  }, 0)
}

// The structure's current signed value from live Marks (mark-to-market,
// ADR 0010).
function currentStructureValue(legs: LegBasis[], marks: MarkSet): number {
  return legs.reduce((sum, h) => {
    const sign = h.side === 'short' ? -1 : 1
    const multiplier = contractMultiplierOf(h.leg.instrument)
    const markPrice = marks.get(buildInstrumentKey(h.leg.instrument))!.price
    return sum + sign * h.qty * markPrice * multiplier
  }, 0)
}

// The structure's value AT ENTRY — each Leg priced at its own average entry,
// not a Mark. What `original` measures its risk/reward from.
function entryStructureValue(legs: LegBasis[]): number {
  return legs.reduce((sum, h) => {
    const sign = h.side === 'short' ? -1 : 1
    const multiplier = contractMultiplierOf(h.leg.instrument)
    return sum + sign * h.qty * h.avgEntry * multiplier
  }, 0)
}

// The structure's slope as S→∞: a stock or call Leg's value keeps climbing
// (slope ±1 × qty × multiplier, signed); a put's intrinsic goes flat to 0
// beyond its strike (slope 0). A nonzero total slope means one side is
// structurally unbounded; zero means the legs cancel (a covered call's
// capped upside) and the limit is a finite constant instead.
function structureSlopeAtInfinity(legs: LegBasis[]): number {
  return legs.reduce((sum, h) => {
    const sign = h.side === 'short' ? -1 : 1
    const multiplier = contractMultiplierOf(h.leg.instrument)
    const contributes = h.leg.instrument.kind === 'stock' || h.leg.instrument.type === 'call'
    return sum + (contributes ? sign * h.qty * multiplier : 0)
  }, 0)
}

// Structural extremes (trademath.md): intrinsic value sampled at S→0 and at
// EVERY strike a held Leg names — a multi-leg structure's payoff is piecewise
// LINEAR in S, so its only candidate extrema are those kinks; interior points
// between kinks are never extremal (a ratio write's local peak sits exactly
// at its short strike, not at 0 or ∞ — a S→0/S→∞-only scan would miss it and
// can even report a negative "max reward"). The S→∞ tail is either unbounded
// (nonzero slope — overrides the corresponding bound with ±Infinity) or, when
// the slope cancels, already equal to the sample at the LARGEST held strike
// (beyond it the structure is exactly linear with that zero slope, hence
// constant) — no separate sample needed.
function structuralExtremes(legs: LegBasis[]): { min: number; max: number } {
  const strikes = legs
    .filter(
      (h): h is LegBasis & { leg: { instrument: OptionInstrument } } =>
        h.leg.instrument.kind === 'option',
    )
    .map((h) => h.leg.instrument.strike)
  const sampled = [0, ...strikes].map((s) => structureValueAt(legs, s))
  const slope = structureSlopeAtInfinity(legs)
  return {
    min: slope < 0 ? -Infinity : Math.min(...sampled),
    max: slope > 0 ? Infinity : Math.max(...sampled),
  }
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

// The option legs' common quantity factor — every current seed's option legs
// share one qty (a spread's two legs, a PMCC's two calls, a single held
// contract), so this is that shared qty; the GCD generalizes it for an
// uneven multi-lot structure without special-casing the common case (user
// ruling 2026-07-19).
function lotCountOf(legs: LegBasis[]): number {
  return legs.map((l) => l.qty).reduce(gcd)
}

// Resolves a `structureValue` ExitLevel — displayed as "Position price" — to
// a signed projected structure value. `level.value` is always a positive
// per-unit QUOTED price (the broker-chain number, e.g. "the spread trades for
// 15.00"); DIRECTION is inferred from the entry structure's own net sign
// (credit → negative, i.e. the same sign a short Leg's entry already carries;
// debit/flat → positive) — the same formula as `structureValueAt`, just at
// the quote's own per-unit scale instead of intrinsic value. This is one
// formula for single- AND multi-leg structures (user ruling 2026-07-19):
// a single held Leg's own Mark scale already coincided with this per-unit
// scale (Slice 3.1), so it falls out of the general case unchanged.
function projectedStructureValue(legs: LegBasis[], quote: number): number {
  const multiplier = contractMultiplierOf(legs[0].leg.instrument)
  const direction = entryStructureValue(legs) < 0 ? -1 : 1
  return direction * quote * multiplier * lotCountOf(legs)
}

// Projects an ExitLevel's risk or reward delta against `legs`, from
// `currentValue` (today's Marks for the ongoing anchors, or the entry
// structure value for `original`) — the one formula both share.
// `underlyingPrice` projects the WHOLE structure at that price;
// `structureValue` resolves via `projectedStructureValue` above. A level
// whose `kind` matches neither (a legacy pre-ruling `pctOfMaxProfit` level,
// tolerated on read but never produced) leaves `projected` undefined, so this
// reports 'undefined' rather than crashing.
function projectedDelta(
  legs: LegBasis[],
  level: ExitLevel,
  currentValue: number,
  direction: 'risk' | 'reward',
): Money | 'undefined' {
  let projected: number | undefined
  if (level.kind === 'underlyingPrice') {
    projected = structureValueAt(legs, level.price)
  } else if (level.kind === 'structureValue') {
    projected = projectedStructureValue(legs, level.value)
  }
  if (projected === undefined) return 'undefined'
  return Math.round(direction === 'risk' ? currentValue - projected : projected - currentValue)
}

export function riskReward(trade: TradeRecord, marks: MarkSet): RiskReward {
  const held = heldLegs(trade)
  const stop = stopLevel(trade)
  const target = targetLevel(trade)

  let plannedRisk: RiskReward['plannedRisk'] = stop === undefined ? 'undefined' : 0
  let plannedReward: RiskReward['plannedReward'] = target === undefined ? 'undefined' : 0
  let worstCaseRisk: RiskReward['worstCaseRisk'] = 0
  let maxReward: RiskReward['maxReward'] = 0

  if (held.length > 0) {
    const currentValue = currentStructureValue(held, marks)
    const { min, max } = structuralExtremes(held)
    worstCaseRisk = min === -Infinity ? 'unlimited' : currentValue - min
    maxReward = max === Infinity ? 'unlimited' : max - currentValue

    if (stop !== undefined) plannedRisk = projectedDelta(held, stop, currentValue, 'risk')
    if (target !== undefined) plannedReward = projectedDelta(held, target, currentValue, 'reward')
  }

  const basis = entryBasisLegs(trade)
  const original: RiskReward['original'] =
    basis.length === 0
      ? { risk: 'undefined', reward: 'undefined' }
      : {
          risk:
            stop === undefined
              ? 'undefined'
              : projectedDelta(basis, stop, entryStructureValue(basis), 'risk'),
          reward:
            target === undefined
              ? 'undefined'
              : projectedDelta(basis, target, entryStructureValue(basis), 'reward'),
        }

  return { plannedRisk, worstCaseRisk, plannedReward, maxReward, original }
}
