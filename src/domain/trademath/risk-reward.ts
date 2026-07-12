import type { ExitLevel, LegFacts, MarkSet, RiskReward, TradeRecord } from './types'
import { buildInstrumentKey } from './instrument'
import { contractMultiplierOf } from './multiplier'

// Ongoing Risk/Reward, mark-to-market (ADR 0010): the four anchors measure from
// today's Marks — giving back unrealized gains counts as risk. `original` measures
// from the actual entry basis to the ORIGINAL Plan's stop/target, for contrast;
// it is 'undefined' until the first Execution exists. Single-Leg Trades only this
// slice (multi-leg arrives Slice 7); long-only (short Legs arrive with the
// cash-secured put, Slice 3.2). A Trade-scope stop/target is either
// `underlyingPrice` (stock, its value the same scale as the stock's own Mark) or
// `structureValue` (option, its value the same scale as the contract's own Mark)
// — `levelValue` reads either without caring which.

function levelValue(level: ExitLevel): number {
  return level.kind === 'underlyingPrice' ? level.price : level.value
}

function stopLevel(trade: TradeRecord): ExitLevel | undefined {
  return trade.plan.exitLevels.find((l) => l.side === 'stop' && l.scope.level === 'trade')
}
function targetLevel(trade: TradeRecord): ExitLevel | undefined {
  return trade.plan.exitLevels.find((l) => l.side === 'target' && l.scope.level === 'trade')
}

// Net long quantity and average entry price of the currently-held Leg (the first
// Leg with a positive net — single-Leg Trades only this slice).
function heldLeg(trade: TradeRecord): { leg: LegFacts; qty: number; avgEntry: number } | undefined {
  for (const leg of trade.legs) {
    let boughtQty = 0
    let boughtCost = 0
    let netQty = 0
    for (const e of leg.executions) {
      netQty += e.side === 'buy' ? e.qty : -e.qty
      if (e.side === 'buy') {
        boughtQty += e.qty
        boughtCost += e.qty * e.price
      }
    }
    if (netQty > 0) return { leg, qty: netQty, avgEntry: boughtCost / boughtQty }
  }
  return undefined
}

// Total opening quantity and average entry price of the Leg `original` measures
// from (independent of what is still held).
function entryBasis(
  trade: TradeRecord,
): { leg: LegFacts; qty: number; avgEntry: number } | undefined {
  for (const leg of trade.legs) {
    let boughtQty = 0
    let boughtCost = 0
    for (const e of leg.executions) {
      if (e.side === 'buy') {
        boughtQty += e.qty
        boughtCost += e.qty * e.price
      }
    }
    if (boughtQty > 0) return { leg, qty: boughtQty, avgEntry: boughtCost / boughtQty }
  }
  return undefined
}

// A long put's structural ceiling: intrinsic at underlying zero is the strike
// itself (nothing subtracted — maximally in the money). Long stock and long
// calls have no such ceiling (intrinsicAtZero is only ever read when bounded).
function intrinsicAtZero(leg: LegFacts): number {
  return leg.instrument.kind === 'option' && leg.instrument.type === 'put'
    ? leg.instrument.strike
    : 0
}

// Whether the held Leg's max reward is structurally unbounded: long stock (no
// cap) and a long call (intrinsic grows without bound as the underlying rises).
function isUnboundedReward(leg: LegFacts): boolean {
  return leg.instrument.kind === 'stock' || leg.instrument.type === 'call'
}

export function riskReward(trade: TradeRecord, marks: MarkSet): RiskReward {
  const held = heldLeg(trade)
  const stop = stopLevel(trade)
  const target = targetLevel(trade)

  let plannedRisk: RiskReward['plannedRisk'] = stop === undefined ? 'undefined' : 0
  let plannedReward: RiskReward['plannedReward'] = target === undefined ? 'undefined' : 0
  let worstCaseRisk: RiskReward['worstCaseRisk'] = 0
  let maxReward: RiskReward['maxReward'] = 0

  if (held) {
    const multiplier = contractMultiplierOf(held.leg.instrument)
    const markPrice = marks.get(buildInstrumentKey(held.leg.instrument))!.price
    const currentValue = held.qty * markPrice * multiplier

    // Worst case is the instrument going worthless (stock or option to zero) —
    // the entire currentValue is lost either way.
    worstCaseRisk = currentValue

    if (isUnboundedReward(held.leg)) {
      maxReward = 'unlimited'
    } else {
      const valueAtZero = held.qty * intrinsicAtZero(held.leg) * multiplier
      maxReward = valueAtZero - currentValue
    }

    if (stop !== undefined) plannedRisk = currentValue - held.qty * levelValue(stop) * multiplier
    if (target !== undefined) {
      plannedReward = held.qty * levelValue(target) * multiplier - currentValue
    }
  }

  const basis = entryBasis(trade)
  const original: RiskReward['original'] =
    basis === undefined
      ? { risk: 'undefined', reward: 'undefined' }
      : {
          risk:
            stop === undefined
              ? 'undefined'
              : basis.qty *
                (basis.avgEntry - levelValue(stop)) *
                contractMultiplierOf(basis.leg.instrument),
          reward:
            target === undefined
              ? 'undefined'
              : basis.qty *
                (levelValue(target) - basis.avgEntry) *
                contractMultiplierOf(basis.leg.instrument),
        }

  return { plannedRisk, worstCaseRisk, plannedReward, maxReward, original }
}
