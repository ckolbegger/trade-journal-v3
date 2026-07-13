import type {
  ExitLevel,
  LegFacts,
  MarkSet,
  OptionInstrument,
  RiskReward,
  TradeRecord,
} from './types'
import { buildInstrumentKey } from './instrument'
import { contractMultiplierOf } from './multiplier'

// Ongoing Risk/Reward, mark-to-market (ADR 0010): the four anchors measure from
// today's Marks — giving back unrealized gains counts as risk. `original` measures
// from the actual entry basis to the ORIGINAL Plan's stop/target, for contrast;
// it is 'undefined' until the first Execution exists. Single-Leg Trades only this
// slice (multi-leg arrives Slice 7). A Trade-scope stop/target is
// `underlyingPrice` (stock's own scale, or an option projected at intrinsic —
// ADR 0009, decided in Slice 3), `structureValue` (option, its value the same
// scale as the contract's own Mark), or `pctOfMaxProfit` (a short credit's
// buyback price at which that % of the entry credit is realized) —
// `priceAtLevel` resolves any of them to a raw per-unit price.

// An option's intrinsic value at a given underlying price — the only "worth"
// TradeMath ever assigns an option away from its own Mark (no pricing model,
// ADR 0009).
function intrinsicAt(instrument: OptionInstrument, underlyingPrice: number): number {
  return instrument.type === 'put'
    ? Math.max(instrument.strike - underlyingPrice, 0)
    : Math.max(underlyingPrice - instrument.strike, 0)
}

// Resolves an ExitLevel to a raw per-unit price, before qty/multiplier/sign are
// applied. `underlyingPrice` on a stock Leg and `structureValue` on any Leg are
// already expressed at that per-unit scale; `underlyingPrice` on an option Leg
// intrinsic-projects the underlying price instead (decided in Slice 3: no
// pricing model exists to value time). `pctOfMaxProfit` is a short-credit
// concept only (slice-10: credit × (1 − pct/100)) — max profit is the entry
// credit, so pct% of it is realized by buying back at avgEntry × (1 − pct/100);
// on a long Leg it resolves to nothing (undefined), never an invented price.
function priceAtLevel(
  level: ExitLevel,
  leg: LegFacts,
  avgEntry: number,
  side: 'long' | 'short',
): number | undefined {
  if (level.kind === 'pctOfMaxProfit') {
    return side === 'short' ? avgEntry * (1 - level.pct / 100) : undefined
  }
  if (level.kind === 'underlyingPrice' && leg.instrument.kind === 'option') {
    return intrinsicAt(leg.instrument, level.price)
  }
  return level.kind === 'underlyingPrice' ? level.price : level.value
}

function stopLevel(trade: TradeRecord): ExitLevel | undefined {
  return trade.plan.exitLevels.find((l) => l.side === 'stop' && l.scope.level === 'trade')
}
function targetLevel(trade: TradeRecord): ExitLevel | undefined {
  return trade.plan.exitLevels.find((l) => l.side === 'target' && l.scope.level === 'trade')
}

// The currently-held Leg (single-Leg Trades only this slice), with its net open
// quantity, side, and average entry price. A Leg opens in whichever direction
// its first Execution takes — long-only or short-only, no flip mid-Leg.
function heldLeg(
  trade: TradeRecord,
): { leg: LegFacts; qty: number; side: 'long' | 'short'; avgEntry: number } | undefined {
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
      return {
        leg,
        qty,
        side: openSide === 'buy' ? 'long' : 'short',
        avgEntry: openedCost / openedQty,
      }
    }
  }
  return undefined
}

// Total opening quantity and average entry price of the Leg `original` measures
// from (independent of what is still held) — the Leg's opening side (its first
// Execution), so a fully-closed short Leg's buy-to-close is never mistaken for
// an entry.
function entryBasis(
  trade: TradeRecord,
): { leg: LegFacts; qty: number; side: 'long' | 'short'; avgEntry: number } | undefined {
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
      return {
        leg,
        qty: openedQty,
        side: openSide === 'buy' ? 'long' : 'short',
        avgEntry: openedCost / openedQty,
      }
    }
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

// Whether the Leg's value grows without bound as the underlying rises: stock
// and calls. Held long that is unlimited reward; held short it is unlimited
// loss (trademath.md structural extremes — both S→0 and S→∞ limits).
function unboundedAbove(leg: LegFacts): boolean {
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
    const sign = held.side === 'short' ? -1 : 1
    const currentValue = sign * held.qty * markPrice * multiplier

    if (held.side === 'short') {
      // Worst case for a short Leg is the underlying extreme working maximally
      // against it. Short put: stock to zero, intrinsic maxed at the strike.
      // Short call or stock: the S→∞ limit — structurally unbounded.
      worstCaseRisk = unboundedAbove(held.leg)
        ? 'unlimited'
        : currentValue - sign * held.qty * intrinsicAtZero(held.leg) * multiplier
      // Best case for any short Leg is the instrument expiring worthless — always
      // bounded by the credit already banked.
      maxReward = -currentValue
    } else {
      // Worst case for a long Leg is the instrument itself going worthless — the
      // entire currentValue is lost.
      worstCaseRisk = currentValue
      if (unboundedAbove(held.leg)) {
        maxReward = 'unlimited'
      } else {
        const valueAtZero = held.qty * intrinsicAtZero(held.leg) * multiplier
        maxReward = valueAtZero - currentValue
      }
    }

    // Math.round guards against float drift from pctOfMaxProfit's division (all
    // other level kinds already resolve to whole cents) — money stays integer.
    if (stop !== undefined) {
      const stopPrice = priceAtLevel(stop, held.leg, held.avgEntry, held.side)
      plannedRisk =
        stopPrice === undefined
          ? 'undefined'
          : Math.round(currentValue - sign * held.qty * stopPrice * multiplier)
    }
    if (target !== undefined) {
      const targetPrice = priceAtLevel(target, held.leg, held.avgEntry, held.side)
      plannedReward =
        targetPrice === undefined
          ? 'undefined'
          : Math.round(sign * held.qty * targetPrice * multiplier - currentValue)
    }
  }

  const basis = entryBasis(trade)
  const basisSign = basis?.side === 'short' ? -1 : 1
  const basisStopPrice =
    basis === undefined || stop === undefined
      ? undefined
      : priceAtLevel(stop, basis.leg, basis.avgEntry, basis.side)
  const basisTargetPrice =
    basis === undefined || target === undefined
      ? undefined
      : priceAtLevel(target, basis.leg, basis.avgEntry, basis.side)
  const original: RiskReward['original'] =
    basis === undefined
      ? { risk: 'undefined', reward: 'undefined' }
      : {
          risk:
            basisStopPrice === undefined
              ? 'undefined'
              : Math.round(
                  basisSign *
                    basis.qty *
                    (basis.avgEntry - basisStopPrice) *
                    contractMultiplierOf(basis.leg.instrument),
                ),
          reward:
            basisTargetPrice === undefined
              ? 'undefined'
              : Math.round(
                  basisSign *
                    basis.qty *
                    (basisTargetPrice - basis.avgEntry) *
                    contractMultiplierOf(basis.leg.instrument),
                ),
        }

  return { plannedRisk, worstCaseRisk, plannedReward, maxReward, original }
}
