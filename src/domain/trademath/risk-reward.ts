import type { ExitLevel, LegFacts, MarkSet, RiskReward, TradeRecord } from './types'
import { buildInstrumentKey } from './instrument'

// Ongoing Risk/Reward, mark-to-market (ADR 0010): the four anchors measure from
// today's Marks — giving back unrealized gains counts as risk. `original` measures
// from the actual entry basis to the ORIGINAL Plan's stop/target, for contrast;
// it is 'undefined' until the first Execution exists. Long stock only this slice:
// worst-case loss is the stock going to zero (= currentValue) and max reward is
// structurally 'unlimited'.

function stopPrice(trade: TradeRecord): number | undefined {
  return priceOf(trade, 'stop')
}
function targetPrice(trade: TradeRecord): number | undefined {
  return priceOf(trade, 'target')
}
function priceOf(trade: TradeRecord, side: ExitLevel['side']): number | undefined {
  const level = trade.plan.exitLevels.find(
    (l) => l.side === side && l.scope.level === 'trade' && l.kind === 'underlyingPrice',
  )
  return level?.price
}

// Net long quantity and average entry price of the currently-held stock leg.
function heldStock(
  trade: TradeRecord,
): { leg: LegFacts; qty: number; avgEntry: number } | undefined {
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

// Total opening quantity and average entry price across the Trade's legs — the
// entry basis `original` measures from (independent of what is still held).
function entryBasis(trade: TradeRecord): { qty: number; avgEntry: number } | undefined {
  let boughtQty = 0
  let boughtCost = 0
  for (const leg of trade.legs) {
    for (const e of leg.executions) {
      if (e.side === 'buy') {
        boughtQty += e.qty
        boughtCost += e.qty * e.price
      }
    }
  }
  if (boughtQty === 0) return undefined
  return { qty: boughtQty, avgEntry: boughtCost / boughtQty }
}

export function riskReward(trade: TradeRecord, marks: MarkSet): RiskReward {
  const held = heldStock(trade)
  const stop = stopPrice(trade)
  const target = targetPrice(trade)

  let plannedRisk: RiskReward['plannedRisk'] = stop === undefined ? 'undefined' : 0
  let plannedReward: RiskReward['plannedReward'] = target === undefined ? 'undefined' : 0
  let worstCaseRisk: RiskReward['worstCaseRisk'] = 0
  let maxReward: RiskReward['maxReward'] = 0

  if (held) {
    const markPrice = marks.get(buildInstrumentKey(held.leg.instrument))!.price
    worstCaseRisk = held.qty * markPrice
    maxReward = 'unlimited'
    if (stop !== undefined) plannedRisk = held.qty * (markPrice - stop)
    if (target !== undefined) plannedReward = held.qty * (target - markPrice)
  }

  const basis = entryBasis(trade)
  const original: RiskReward['original'] =
    basis === undefined
      ? { risk: 'undefined', reward: 'undefined' }
      : {
          risk: stop === undefined ? 'undefined' : basis.qty * (basis.avgEntry - stop),
          reward: target === undefined ? 'undefined' : basis.qty * (target - basis.avgEntry),
        }

  return { plannedRisk, worstCaseRisk, plannedReward, maxReward, original }
}
