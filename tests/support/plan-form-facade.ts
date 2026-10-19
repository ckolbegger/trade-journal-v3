// A facade double with the catalog and definition data the Plan form loads.
import { vi } from 'vitest';
import { D1_JOURNAL_MANIFEST } from '../../src/modules/journal/index.ts';
import { facadeDouble } from './facade-double.ts';

export const definition = {
  id: 'def-1',
  entryTypeKey: 'entry-type.plan-reflection',
  revisionNumber: 1,
  prompts: D1_JOURNAL_MANIFEST.entryTypes[0]!.prompts,
};

export function planFormFacade() {
  const facade = facadeDouble();
  const families = {
    Institution: [{ id: 'inst-1', kind: 'Institution', label: 'Fidelity', recordRevision: 1 }],
    Account: [
      { id: 'acct-1', kind: 'Account', institutionId: 'inst-1', label: 'Roth IRA', recordRevision: 1 },
      { id: 'acct-2', kind: 'Account', institutionId: 'inst-1', label: 'Taxable', recordRevision: 2 },
    ],
    // A Strategy this release does not install must never be offered.
    Strategy: [
      { id: 'strat-cc', kind: 'Strategy', label: 'Covered Call', productKey: 'strategy.covered-call', recordRevision: 1 },
      { id: 'strat-ls', kind: 'Strategy', label: 'Long Stock', productKey: 'strategy.long-stock', recordRevision: 1 },
    ],
  };
  vi.mocked(facade.ReferenceCatalog.query).mockImplementation((request) =>
    Promise.resolve({ kind: 'Page', items: families[request.family] as never, snapshot: { catalogRevision: 5 } }),
  );
  vi.mocked(facade.Journal.getDefinitions).mockResolvedValue({ kind: 'Found', definition } as never);
  return facade;
}
