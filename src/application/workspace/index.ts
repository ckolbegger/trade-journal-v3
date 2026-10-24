import { migrateD1 } from './migration';
import capabilities from '../../../public/capabilities.json';
import { Temporal } from '@js-temporal/polyfill';
import { ReferenceCatalog, longStock, queryPlanningCatalog } from '../../domain/reference-catalog';
import { Journal, planDefinition } from '../../domain/journal';
import { Runtime, rootHeaderFailure, type Root } from '../../infrastructure/storage';
export class Workspace {
  constructor(readonly runtime: Runtime) {}
  private async validRoot(root: Root) {
    if (rootHeaderFailure(root)) return false;
    const store = this.runtime.store;
    const [seeds, versions, plans, entries, membership] = await Promise.all([
      store.versions.bulkGet([`${root.generation}:long-stock-v1`, `${root.generation}:${root.definitionRevision}`, `${root.generation}:plan-confirmation-v1`]),
      store.versions.where('[generation+kind]').between([root.generation, ''], [root.generation, '\uffff']).count(),
      store.versions.where('[generation+kind]').equals([root.generation, 'Plan']).count(),
      store.versions.where('[generation+kind]').equals([root.generation, 'JournalEntry']).count(),
      store.lifecycle.where('[generation+lifecycle+economicOrder+sequence]').between([root.generation, 'Planned', '', 0], [root.generation, 'Planned', '\uffff', Number.MAX_SAFE_INTEGER]).count(),
    ]);
    if (root.schema === 2) {
      const openingSeeds = await store.versions.bulkGet([`${root.generation}:position-change-reflection-v1`, `${root.generation}:position-change-v1`]);
      const allMembership = await store.lifecycle.where('[generation+tradeId]').between([root.generation, ''], [root.generation, '\uffff']).count();
      return seeds[0]?.kind === 'Strategy' && seeds[1]?.kind === 'Definition' && seeds[2]?.kind === 'Source' && openingSeeds[0]?.kind === 'Definition' && openingSeeds[1]?.kind === 'Source' && versions === root.recordCounts?.versions && allMembership === root.recordCounts.lifecycle && allMembership === plans && entries >= plans;
    }
    return seeds[0]?.kind === 'Strategy' && seeds[1]?.kind === 'Definition' && seeds[2]?.kind === 'Source' && versions === root.commitOrdinal + root.recordedSequence + 2 && plans === root.recordedSequence && entries === plans && membership === plans;
  }
  private async migrationRecovery(previous: Root) {
    try { return await this.runtime.store.transaction('r', [this.runtime.store.roots, this.runtime.store.versions, this.runtime.store.lifecycle], async () => {
      const root = await this.runtime.store.roots.get('active');
      if (!root || root.revision !== previous.revision || !await this.validRoot(root)) return undefined;
      return { root, catalog: await queryPlanningCatalog(this.runtime.store), definition: await new Journal(this.runtime.store).getDefinitions() };
    }); } catch { return undefined; }
  }
  async requestDurability() {
    const before = await this.runtime.host.check(this.runtime.store);
    if (before.protection === 'Protected') return { status: 'AlreadyProtected', currentProtection: 'Protected' };
    const protection = await this.runtime.host.requestDurability();
    return { status: protection === 'Protected' ? 'Improved' : 'NotImproved', currentProtection: protection };
  }
  async initialize(request: { openingInstant: string; timeZone?: string }) {
    const readiness = await this.runtime.establish();
    if (readiness.status !== 'Writable') return readiness;
    const inspected = await this.runtime.store.inspect();
    let previous = inspected.status === 'Readable' ? inspected.root : undefined;
    if (previous) {
      if (previous.schema !== 1 && previous.schema !== 2) return { status: 'MigrationBlocked' as const, reason: 'UnsupportedSchema' };
      try { Temporal.Instant.from(request.openingInstant).toZonedDateTimeISO(previous.timeZone); }
      catch { return { status: 'IntegrityBlocked' as const }; }
    }
    if (!previous) {
      try {
        if (!request.timeZone || /^[+-]/.test(request.timeZone)) return { status: 'TimeZoneSelectionRequired' as const };
        Temporal.Instant.from(request.openingInstant).toZonedDateTimeISO(request.timeZone);
      } catch { return { status: 'TimeZoneSelectionRequired' as const }; }
    }
    let migration: Extract<Awaited<ReturnType<typeof migrateD1>>, { status: 'Migrated' }>['migration'] | undefined;
    if (previous?.schema === 1) {
      try {
        const result = await migrateD1(this.runtime, previous, request.openingInstant);
        if (result.status !== 'Migrated') return result.status === 'MigrationBlocked' && result.reason !== 'InvalidSource' ? { ...result, recovery: await this.migrationRecovery(previous) } : result;
        previous = result.root; migration = result.migration;
      } catch { this.runtime.invalidate('transaction'); return { status: 'MigrationBlocked' as const, reason: 'StorageFailure', unchangedRevision: previous.revision, recovery: await this.migrationRecovery(previous) }; }
    }
    try { return await this.runtime.mutate(previous?.generation, async current => {
      if (current) {
        if (!await this.validRoot(current)) return { status: 'IntegrityBlocked' as const };
        const catalog = await queryPlanningCatalog(this.runtime.store);
        const definition = await new Journal(this.runtime.store).getDefinitions();
        return { status: 'Opened' as const, root: current, catalog, definition, onboarding: catalog.records.some(record => record.kind === 'Account' && record.active) ? 'ReadyForTradePlanning' : 'NeedsInstitutionAndAccount', receipt: { fresh: false, candidateSealed: true, authoritativeCount: current.recordCounts?.versions ?? current.commitOrdinal + current.recordedSequence + 2, seeds: migration ? ['position-change-reflection', 'position-change'] : [], migration } };
      }
      const root: Root = { key: 'active', generation: crypto.randomUUID(), revision: crypto.randomUUID(), schema: 2, recordCounts: { versions: 5, lifecycle: 0 }, timeZone: request.timeZone ?? 'UTC', catalogRevision: crypto.randomUUID(), definitionRevision: 'plan-reflection-v1', commitOrdinal: 1, recordedSequence: 0 };
      await new ReferenceCatalog(this.runtime.store).seedDefaults(root, request.openingInstant);
      await new Journal(this.runtime.store).seedDefaults(root, request.openingInstant);
      const candidate = await this.runtime.store.versions.where('[generation+kind]').between([root.generation, ''], [root.generation, '\uffff']).toArray();
      if (candidate.length !== 5 || !candidate.some(row => row.kind === 'Definition') || !candidate.some(row => row.kind === 'Source') || !candidate.some(row => row.kind === 'Strategy')) throw new Error('SeedConflict');
      await this.runtime.store.roots.put(root);
      return { status: 'Opened' as const, root, catalog: { status: 'Ready' as const, records: [{ ...longStock, version: `${root.generation}:long-stock-v1` }], catalogRevision: root.catalogRevision, generation: root.generation }, definition: structuredClone(planDefinition), onboarding: 'NeedsInstitutionAndAccount', receipt: { fresh: true, candidateSealed: true, authoritativeCount: candidate.length, seeds: ['long-stock', 'plan-reflection', 'plan-confirmation', 'position-change-reflection', 'position-change'] } };
    }); } catch (error) {
      if (error instanceof Error && error.message === 'SeedConflict') return { status: 'SeedConflict' as const };
      this.runtime.invalidate('transaction');
      return { status: 'StorageFailure' as const };
    }
  }
  async getStatus() {
    const readiness = await this.runtime.establish();
    if (readiness.status === 'RuntimeNotWritable' && readiness.runtimeReadiness === 'RecoveryOnly') {
      try {
        const recovery = await this.runtime.store.transaction('r', [this.runtime.store.roots, this.runtime.store.versions, this.runtime.store.lifecycle], async () => {
          const root = await this.runtime.store.roots.get('active');
          if (!root || !await this.validRoot(root)) return { valid: false as const };
          return { valid: true as const, root, catalog: await queryPlanningCatalog(this.runtime.store), definition: await new Journal(this.runtime.store).getDefinitions() };
        });
        if (recovery.valid) return { ...readiness, recovery };
        this.runtime.invalidate('InvalidRoot');
        return { ...readiness, runtimeReadiness: 'Unsupported' as const, workspaceStatus: 'IntegrityBlocked' as const, failedChecks: [...readiness.failedChecks, 'InvalidRoot'] };
      } catch {
        this.runtime.invalidate('UnreadableRoot');
        return { ...readiness, runtimeReadiness: 'Unsupported' as const, workspaceStatus: 'IntegrityBlocked' as const, failedChecks: [...readiness.failedChecks, 'UnreadableRoot'] };
      }
    }
    if (readiness.status === 'Writable') {
      try {
        return await this.runtime.store.transaction('r', [this.runtime.store.roots, this.runtime.store.versions, this.runtime.store.lifecycle, this.runtime.store.projections], async () => {
          const root = await this.runtime.store.roots.get('active');
          if (root && !await this.validRoot(root)) {
            this.runtime.invalidate('InvalidRoot');
            return { status: 'RuntimeNotWritable' as const, runtimeReadiness: 'Unsupported' as const, workspaceStatus: 'IntegrityBlocked' as const, failedChecks: ['InvalidRoot'], safeActions: ['Retry'] };
          }
          return { ...readiness, workspaceStatus: root ? root.schema === 1 ? 'MigrationRequired' as const : 'Ready' as const : 'InitializationRequired' as const, root, capabilities, storageMeasurement: await this.runtime.store.storageMeasurement(root) };
        });
      } catch {
        this.runtime.invalidate('UnreadableRoot');
        return { status: 'RuntimeNotWritable' as const, runtimeReadiness: 'Unsupported' as const, workspaceStatus: 'IntegrityBlocked' as const, failedChecks: ['UnreadableRoot'], safeActions: ['Retry'] };
      }
    }
    return { ...readiness, capabilities };
  }
}
