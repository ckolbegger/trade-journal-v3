import type { ExecutionFact } from '../../app/types.ts';
import { instrumentLabel } from '../calculation-words.ts';

// An Execution named in a receipt line, without its fee (C5): a stock Buy or Sell as it is, an option
// by its role's action ("Buy to open") and the contract's label (C6). A Long leg opens by buying and a
// Short leg by selling, so the side comes from the Planned Leg the Execution serves.
export function executionWhat(execution: ExecutionFact, legs: readonly { readonly factId: string; readonly side: 'Long' | 'Short' }[]): string {
  const { action, instrument, quantity } = execution;
  if (instrument.kind === 'Stock') return `${action} ${quantity} ${instrument.symbol}`;
  const side = legs.find((leg) => leg.factId === execution.intent.plannedLegId)?.side;
  return `${action} to ${(action === 'Buy') === (side === 'Long') ? 'open' : 'close'} ${quantity} ${instrumentLabel(instrument)}`;
}
