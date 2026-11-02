// A facade double with the Trade Detail and Position Change Reflection definition the entry form
// loads: the Reference Trade's confirmed Plan (100 XYZ, entry 50, Stop 47.50, Target 56).
import { vi } from 'vitest';
import type { UiFacade } from '../../src/app/compose.ts';
import type { PlannedTradeDetail } from '../../src/app/types.ts';
import { D2_JOURNAL_MANIFEST, D5_JOURNAL_MANIFEST } from '../../src/modules/journal/index.ts';
import { D6_CATALOG_MANIFEST } from '../../src/modules/reference-catalog/index.ts';
import { facadeDouble } from './facade-double.ts';
import { openDetailOf, PC1, PC2 } from './open-detail-fixtures.ts';

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

// The Close Review definition the exit form loads (D5 manifest, "Initial Entry Definitions").
export const closeReviewDefinition = {
  id: 'def-cr-1',
  entryTypeKey: 'entry-type.close-review',
  revisionNumber: 1,
  prompts: D5_JOURNAL_MANIFEST.entryTypes.find((t) => t.productKey === 'entry-type.close-review')!.prompts,
};

// The four seeded Close Reasons as ReferenceCatalog.query returns them, in seed order.
export const closeReasonRecords = D6_CATALOG_MANIFEST.closeReasons!.map((reason, seedOrder) => ({
  id: `cr-${seedOrder + 1}`,
  kind: 'CloseReason',
  productKey: reason.productKey,
  label: reason.label,
  active: true,
  seedOrder,
}));

// A facade double for the exit form: an Open Trade of 100 shares, both reflection definitions, and
// the Close Reason family.
export function exitFormFacade(detail: unknown = openDetailOf([PC1, PC2])) {
  return withExitForm(facadeDouble(), detail);
}

// The same reads on a facade double that serves other screens too (the Review hosts the exit form, A94).
export function withExitForm(facade: UiFacade, detail: unknown = openDetailOf([PC1, PC2])) {
  vi.mocked(facade.TradeViewsAndReporting.getTradeDetail).mockResolvedValue({
    kind: 'Ready',
    view: detail,
    binding: { databaseName: 'tj-ws-1', contentRevision: 7 },
  } as never);
  vi.mocked(facade.Journal.getDefinitions).mockImplementation((request) =>
    Promise.resolve({
      kind: 'Found',
      definition: ('latestFor' in request && request.latestFor === 'entry-type.close-review' ? closeReviewDefinition : reflectionDefinition) as never,
    }),
  );
  vi.mocked(facade.ReferenceCatalog.query).mockResolvedValue({ kind: 'Page', items: closeReasonRecords, snapshot: { catalogRevision: 2 } } as never);
  return facade;
}

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
