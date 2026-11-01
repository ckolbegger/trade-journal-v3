import type { WalkedTrade } from '../../src/app/types.ts';

// A walked Trade's Outstanding reflections as the D5 cases state them: due in this Review, or falling due later.
// Read from the Reflections panel of its progress (D5R2 A167).
export function reflectionCounts(trade: WalkedTrade): { readonly due: number; readonly later: number } {
  const panel = trade.progress.panels.find((p) => p.panel === 'Reflections');
  if (panel?.panel !== 'Reflections') throw new Error(`no Reflections panel on ${trade.tradeId}`);
  return { due: panel.dueNow, later: panel.later };
}
