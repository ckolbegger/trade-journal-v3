import { describe, expect, it } from 'vitest';
import { SECTION_OF_STORE } from '../../backup/format/index.ts';
import { exportLayoutFor } from '../../persistence/export-layout.ts';
import { KNOWN_SECTIONS } from './backup-export.ts';

describe('section of each store', () => {
  it('should map every store to the same section for export and Restore', () => {
    const exported = new Set([1, 2, 3, 4, 5, 6, 7].flatMap((version) => exportLayoutFor(version)!.stores));
    for (const store of ['meta', ...exported]) expect(SECTION_OF_STORE[store], store).toBeDefined();
    expect(SECTION_OF_STORE).toEqual({
      meta: 'workspace',
      catalog: 'catalog',
      observations: 'marketData',
      trades: 'trades',
      journalTypes: 'journal',
      journalDefinitions: 'journal',
      journalEntries: 'journal',
      journalDeclines: 'journal',
      journalDebts: 'journal',
    });
    expect([...KNOWN_SECTIONS].sort()).toEqual([...new Set(Object.values(SECTION_OF_STORE))].sort());
  });
});
