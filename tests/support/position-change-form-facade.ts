// A facade double with the Trade Detail and Position Change Reflection definition the entry form
// loads: the Reference Trade's confirmed Plan (100 XYZ, entry 50, Stop 47.50, Target 56).
import { vi } from 'vitest';
import type { PlannedTradeDetail } from '../../src/app/types.ts';
import { D2_JOURNAL_MANIFEST } from '../../src/modules/journal/index.ts';
import { facadeDouble } from './facade-double.ts';

export const reflectionDefinition = {
  id: 'def-pcr-1',
  entryTypeKey: 'entry-type.position-change-reflection',
  revisionNumber: 1,
  prompts: D2_JOURNAL_MANIFEST.entryTypes.find((t) => t.productKey === 'entry-type.position-change-reflection')!.prompts,
};

export const plannedDetail = {
  tradeId: 'trade-1',
  factRevision: 1,
  plan: {
    underlying: 'XYZ',
    planTime: '2026-10-12T13:00:00Z',
    thesis: 'Breakout above the 50-day.',
    invalidation: 'A close below 48.',
    legs: [{ factId: 'leg-1', side: 'Long', instrument: { kind: 'Stock', symbol: 'XYZ' }, quantity: '100', intendedEntry: '50' }],
    stops: [{ factId: 'stop-1', kind: 'UnderlyingPrice', price: '47.5' }],
    targets: [{ factId: 'target-1', kind: 'UnderlyingPrice', price: '56' }],
  },
  lifecycle: { stored: 'Planned', agreement: { kind: 'Agrees' } },
  baseline: {},
  labels: { strategy: 'Long Stock', account: 'Taxable', institution: 'Fidelity' },
  journal: [],
} as unknown as PlannedTradeDetail;

export function positionChangeFormFacade() {
  const facade = facadeDouble();
  vi.mocked(facade.TradeViewsAndReporting.getTradeDetail).mockResolvedValue({
    kind: 'Ready',
    view: plannedDetail,
    binding: { databaseName: 'tj-ws-1', contentRevision: 7 },
  } as never);
  vi.mocked(facade.Journal.getDefinitions).mockResolvedValue({ kind: 'Found', definition: reflectionDefinition } as never);
  return facade;
}
