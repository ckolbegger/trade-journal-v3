// The section that owns each store, as the export writes them and Restore checks them (meta is the
// Workspace section's one store). One table, read by both, so they cannot disagree.
export const SECTION_OF_STORE: Readonly<Record<string, string>> = {
  meta: 'workspace',
  catalog: 'catalog',
  observations: 'marketData',
  trades: 'trades',
  journalTypes: 'journal',
  journalDefinitions: 'journal',
  journalEntries: 'journal',
  journalDeclines: 'journal',
  journalDebts: 'journal',
};
