import { addedRecords, Runtime, type Store, type Root } from '../../infrastructure/storage';
export interface CatalogRecord {
  id: string; version: string; kind: string; label: string; active: boolean; origin: string; parentId?: string;
  shape?: { roles: { kind: string; direction: string; relativeQuantity: string }[] };
}
export const longStock = { id: 'long-stock', kind: 'Strategy', label: 'Long Stock', active: true, shape: { roles: [{ kind: 'Stock', direction: 'Long', relativeQuantity: '1' }] }, origin: 'Default' };
export class ReferenceCatalog {
  constructor(readonly store: Store, readonly runtime?: Runtime) {}
  async save(command: { kind: 'Institution' | 'Account'; label: string; parentId?: string; generation: string; expectedCatalogRevision: string }) {
    if (!this.runtime) throw new Error('Coordinator runtime required');
    try { return await this.runtime.mutate(command.generation, async root => {
      if (!root) throw new Error('WorkspaceRequired');
      if (root.catalogRevision !== command.expectedCatalogRevision) return { status: 'Conflict' as const, reason: 'CatalogChanged' };
      const rows = (await Promise.all(['Institution', 'Account'].map(kind => this.store.versions.where('[generation+kind]').equals([root.generation, kind]).toArray()))).flat();
      const records = rows.map(row => row.value as CatalogRecord);
      const normalize = (label: string) => label.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
      const issues: string[] = [];
      if (!normalize(command.label)) issues.push('LabelRequired');
      if (records.some(record => record.kind === command.kind && record.parentId === command.parentId && normalize(record.label) === normalize(command.label))) issues.push('DuplicateLabel');
      if (command.kind === 'Account' && !records.some(record => record.id === command.parentId && record.kind === 'Institution' && record.active)) issues.push('SelectableInstitutionRequired');
      if (issues.length) return { status: 'Rejected' as const, issues };
      const version = crypto.randomUUID();
      const record: CatalogRecord = { id: crypto.randomUUID(), version, kind: command.kind, label: command.label, active: true, origin: 'Trader', ...(command.parentId ? { parentId: command.parentId } : {}) };
      const saveTime = new Date().toISOString();
      await this.store.versions.add({ version, id: record.id, generation: root.generation, kind: command.kind, value: record, tradeId: '', economicTime: saveTime, saveTime, sequence: 0, commitOrdinal: root.commitOrdinal + 1 });
      const catalogRevision = crypto.randomUUID();
      await this.store.roots.put({ ...root, revision: crypto.randomUUID(), catalogRevision, recordCounts: addedRecords(root, 1), commitOrdinal: root.commitOrdinal + 1 });
      return { status: 'Saved' as const, record, catalogRevision, onboarding: command.kind === 'Account' ? 'ReadyForTradePlanning' : 'NeedsInstitutionAndAccount' };
    }); } catch {
      this.runtime.invalidate('transaction');
      return { status: 'StorageFailure' as const };
    }
  }
  async query(request: { family: 'Strategy' | 'Institution' | 'Account' }) {
    return this.store.transaction('r', [this.store.roots, this.store.versions], async () => {
      const root = await this.store.roots.get('active');
      if (!root) return { status: 'NotInitialized' as const, records: [] };
      const rows = await this.store.versions.where('[generation+kind]').equals([root.generation, request.family]).toArray();
      return { status: 'Ready' as const, records: rows.map(row => ({ ...(row.value as Omit<CatalogRecord, 'version'>), version: (row.value as CatalogRecord).version ?? row.domainVersion ?? row.version })).sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id)), catalogRevision: root.catalogRevision, generation: root.generation };
    });
  }
  async resolve(request: { ids: string[]; expectedCatalogRevision: string; use: 'NewSelection' | 'DisplayOnly' | 'RetainedReference' }) {
    const catalog = await queryPlanningCatalog(this.store);
    if (catalog.status !== 'Ready' || catalog.catalogRevision !== request.expectedCatalogRevision) return { status: 'Conflict' as const };
    const records = request.ids.map(id => catalog.records.find(record => record.id === id));
    if (records.some(record => !record || (request.use === 'NewSelection' && !record.active))) return { status: 'Rejected' as const, issues: ['InactiveOrUnknownReference'] };
    return { status: 'Resolved' as const, records: records as CatalogRecord[], catalogRevision: catalog.catalogRevision };
  }
  async seedDefaults(root: Root, saveTime: string) {
    const version = `${root.generation}:long-stock-v1`;
    const existing = await this.store.versions.get(version);
    if (existing) { if (JSON.stringify(existing.value) !== JSON.stringify(longStock)) throw new Error('SeedConflict'); return; }
    await this.store.versions.add({ version, id: longStock.id, generation: root.generation, kind: 'Strategy', value: longStock, tradeId: '', economicTime: saveTime, saveTime, sequence: 0, commitOrdinal: root.commitOrdinal });
  }
}

// Current coordinators need all three planning families from one read snapshot.
export async function queryPlanningCatalog(store: Store) {
  return store.transaction('r', [store.roots, store.versions], async () => {
    const families = await Promise.all((['Strategy', 'Institution', 'Account'] as const).map(family => new ReferenceCatalog(store).query({ family })));
    const binding = families[0];
    return { ...binding, records: families.flatMap(family => family.records) };
  });
}
