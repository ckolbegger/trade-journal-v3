import type { PlannedTradeDetail } from '../../app/types.ts';

// The just-confirmed Plan's Detail travels from the Plan form to Trade Detail in memory, not in router
// history state: the browser structured-clones history state, which strips the methods of the Rational
// values in the Detail's payoff and baseline (T7.31-F1).
let handedOver: PlannedTradeDetail | undefined;

export function handOffConfirmed(detail: PlannedTradeDetail): void {
  handedOver = detail;
}

// What was handed over for this Trade, or nothing.
export function handedOverConfirmed(tradeId: string): PlannedTradeDetail | undefined {
  return handedOver?.tradeId === tradeId ? handedOver : undefined;
}

// Trade Detail clears the hand-over once it has taken it, so a later visit takes the normal read.
export function clearHandedOver(): void {
  handedOver = undefined;
}
