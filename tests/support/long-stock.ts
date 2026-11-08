import type { CatalogRecord, StrategyRecord } from '../../src/modules/reference-catalog/index.ts';

// Strategies sort by label, so position says nothing: look Long Stock up by its product key.
export function longStockOf(items: readonly CatalogRecord[]): StrategyRecord {
  const found = items.find((r): r is StrategyRecord => r.kind === 'Strategy' && r.productKey === 'strategy.long-stock');
  if (!found) throw new Error('Long Stock Strategy missing');
  return found;
}
