import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createPersistenceSeam, SCHEMA_VERSION_V1 } from '../../src/persistence/idb';
import { createReferenceCatalog } from '../../src/catalog/reference-catalog';
import { createManualClock } from '../../src/shared/clock';

async function createHarness(writable = true) {
  let isWritable = true;
  const clock = createManualClock('2026-11-23T14:00:00.000Z');
  const persistence = createPersistenceSeam({
    indexedDB: new IDBFactory(),
    writeGate: {
      checkWritable: () =>
        isWritable
          ? { writable: true }
          : {
              writable: false,
              reason: 'RecoveryOnly',
              failedChecks: ['service_worker_control'],
            },
    },
  });
  await persistence.runWriteTransaction(['workspace_meta'], (tx) => {
    tx.put('workspace_meta', {
      key: 'singleton',
      schemaVersion: SCHEMA_VERSION_V1,
      timeZone: 'America/New_York',
      settingsRevision: 1,
      workspaceRevision: 1,
      initializedAt: clock.nowIso(),
      updatedAt: clock.nowIso(),
    });
  });
  isWritable = writable;
  const catalog = createReferenceCatalog({ persistence, clock });
  return {
    catalog,
    clock,
    setWritable: (next: boolean) => {
      isWritable = next;
    },
  };
}

describe('ReferenceCatalog seam', () => {
  it('seeds zero fictional institutions or accounts and seeds Long Stock strategy idempotently', async () => {
    const { catalog } = await createHarness();

    const first = await catalog.seedDefaults();
    expect(first.status).toBe('Seeded');
    if (first.status !== 'Seeded') return;
    expect(first.additions).toEqual([
      'strat_long_stock',
      'cr_target_reached',
      'cr_stop_triggered',
      'cr_thesis_invalidated',
      'cr_time_based_exit',
    ]);
    expect(first.hasSelectableAccounts).toBe(false);

    const second = await catalog.seedDefaults();
    expect(second.status).toBe('Seeded');
    if (second.status !== 'Seeded') return;
    expect(second.catalogRevision).toBe(first.catalogRevision);
    expect(second.additions).toEqual([]);

    const insts = await catalog.query({ family: 'Institution', includeInactive: true });
    const accts = await catalog.query({ family: 'Account', includeInactive: true });
    const strategies = await catalog.query({ family: 'Strategy', includeInactive: true });
    const closeReasons = await catalog.query({ family: 'CloseReason', includeInactive: true });
    expect(insts.items).toEqual([]);
    expect(accts.items).toEqual([]);
    expect(strategies.items.map((s) => s.currentLabel)).toEqual(['Long Stock']);
    expect(closeReasons.items.map((c) => c.currentLabel)).toEqual([
      'Stop Triggered',
      'Target Reached',
      'Thesis Invalidated',
      'Time-Based Exit',
    ]);
  });

  it('prevents concurrent duplicate-label creation inside atomic write transactions', async () => {
    const { catalog } = await createHarness();

    const [r1, r2] = await Promise.all([
      catalog.save({ kind: 'CreateInstitution', label: 'Vanguard' }),
      catalog.save({ kind: 'CreateInstitution', label: 'vanguard' }),
    ]);

    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual(['Rejected', 'Saved']);
  });

  it('creates, renames, archives, and reactivates Institutions and Accounts while preserving revision history and immutable institutionId', async () => {
    const { catalog, clock } = await createHarness();

    const createdInst = await catalog.save({
      kind: 'CreateInstitution',
      label: 'Fidelity',
    });
    expect(createdInst.status).toBe('Saved');
    if (createdInst.status !== 'Saved' || createdInst.family !== 'Institution') return;
    const instId = createdInst.record.id;
    expect(createdInst.record.revision).toBe(1);
    expect(createdInst.record.history).toHaveLength(1);
    expect(createdInst.hasSelectableAccounts).toBe(false);

    clock.advanceMs(60_000);
    const createdAcct = await catalog.save({
      kind: 'CreateAccount',
      institutionId: instId,
      label: 'Taxable Margin',
    });
    expect(createdAcct.status).toBe('Saved');
    if (createdAcct.status !== 'Saved' || createdAcct.family !== 'Account') return;
    const acctId = createdAcct.record.id;
    expect(createdAcct.record.institutionId).toBe(instId);
    expect(createdAcct.hasSelectableAccounts).toBe(true);

    // Archiving an Institution with a selectable Account must be blocked.
    const blockedArchive = await catalog.save({
      kind: 'ArchiveInstitution',
      id: instId,
      expectedRevision: 1,
    });
    expect(blockedArchive).toEqual({
      status: 'Rejected',
      code: 'InstitutionHasSelectableAccounts',
      message: expect.any(String),
    });

    // Rename Account appends history without overwriting revision 1.
    clock.advanceMs(60_000);
    const renamedAcct = await catalog.save({
      kind: 'RenameAccount',
      id: acctId,
      label: 'Individual Brokerage',
      expectedRevision: 1,
    });
    expect(renamedAcct.status).toBe('Saved');
    if (renamedAcct.status !== 'Saved' || renamedAcct.family !== 'Account') return;
    expect(renamedAcct.record.revision).toBe(2);
    expect(renamedAcct.record.institutionId).toBe(instId);
    expect(renamedAcct.record.history.map((h) => h.label)).toEqual([
      'Taxable Margin',
      'Individual Brokerage',
    ]);

    // Stale revision produces Conflict without mutation.
    const conflict = await catalog.save({
      kind: 'RenameAccount',
      id: acctId,
      label: 'Stale Attempt',
      expectedRevision: 1,
    });
    expect(conflict.status).toBe('Conflict');

    // Archive Account, then archive Institution succeeds.
    clock.advanceMs(60_000);
    const archivedAcct = await catalog.save({
      kind: 'ArchiveAccount',
      id: acctId,
      expectedRevision: 2,
    });
    expect(archivedAcct.status).toBe('Saved');
    if (archivedAcct.status !== 'Saved') return;
    expect(archivedAcct.hasSelectableAccounts).toBe(false);

    clock.advanceMs(60_000);
    const archivedInst = await catalog.save({
      kind: 'ArchiveInstitution',
      id: instId,
      expectedRevision: 1,
    });
    expect(archivedInst.status).toBe('Saved');

    // Reactivating Account under an Archived Institution must be rejected.
    const blockedReactivate = await catalog.save({
      kind: 'ReactivateAccount',
      id: acctId,
      expectedRevision: 3,
    });
    expect(blockedReactivate).toEqual({
      status: 'Rejected',
      code: 'InstitutionNotSelectable',
      message: expect.any(String),
    });

    // Reactivating Institution then Account succeeds.
    clock.advanceMs(60_000);
    const reactivatedInst = await catalog.save({
      kind: 'ReactivateInstitution',
      id: instId,
      expectedRevision: 2,
    });
    expect(reactivatedInst.status).toBe('Saved');

    clock.advanceMs(60_000);
    const reactivatedAcct = await catalog.save({
      kind: 'ReactivateAccount',
      id: acctId,
      expectedRevision: 3,
    });
    expect(reactivatedAcct.status).toBe('Saved');
    if (reactivatedAcct.status !== 'Saved') return;
    expect(reactivatedAcct.hasSelectableAccounts).toBe(true);
  });

  it('enforces label distinguishability globally for Institutions and per-Institution for Accounts', async () => {
    const { catalog } = await createHarness();

    const inst1 = await catalog.save({ kind: 'CreateInstitution', label: 'Schwab' });
    expect(inst1.status).toBe('Saved');
    if (inst1.status !== 'Saved' || inst1.family !== 'Institution') return;

    const dupInst = await catalog.save({ kind: 'CreateInstitution', label: '  schwab ' });
    expect(dupInst.status).toBe('Rejected');
    if (dupInst.status === 'Rejected') {
      expect(dupInst.code).toBe('DuplicateLabel');
    }

    const inst2 = await catalog.save({ kind: 'CreateInstitution', label: 'IBKR' });
    expect(inst2.status).toBe('Saved');
    if (inst2.status !== 'Saved' || inst2.family !== 'Institution') return;

    const a1 = await catalog.save({
      kind: 'CreateAccount',
      institutionId: inst1.record.id,
      label: 'Roth IRA',
    });
    expect(a1.status).toBe('Saved');

    // Same account label under a DIFFERENT institution is allowed.
    const a2 = await catalog.save({
      kind: 'CreateAccount',
      institutionId: inst2.record.id,
      label: 'Roth IRA',
    });
    expect(a2.status).toBe('Saved');

    // Duplicate account label under the SAME institution is rejected.
    const dupAcct = await catalog.save({
      kind: 'CreateAccount',
      institutionId: inst1.record.id,
      label: 'roth ira',
    });
    expect(dupAcct.status).toBe('Rejected');
    if (dupAcct.status === 'Rejected') {
      expect(dupAcct.code).toBe('DuplicateLabel');
    }
  });

  it('resolves NewSelection vs RetainedReference accurately and rejects writes when RuntimeNotWritable', async () => {
    const { catalog, setWritable } = await createHarness();

    const inst = await catalog.save({ kind: 'CreateInstitution', label: 'Tastytrade' });
    if (inst.status !== 'Saved' || inst.family !== 'Institution') throw new Error('expected saved');
    const acct = await catalog.save({
      kind: 'CreateAccount',
      institutionId: inst.record.id,
      label: 'Options Margin',
    });
    if (acct.status !== 'Saved' || acct.family !== 'Account') throw new Error('expected saved');

    await catalog.save({
      kind: 'ArchiveAccount',
      id: acct.record.id,
      expectedRevision: 1,
    });

    const newSel = await catalog.resolve({
      requirements: [{ family: 'Account', id: acct.record.id, mode: 'NewSelection' }],
    });
    expect(newSel.status).toBe('Resolved');
    if (newSel.status === 'Resolved') {
      expect(newSel.results[0]?.status).toBe('InactiveForRequestedUse');
    }

    const retained = await catalog.resolve({
      requirements: [{ family: 'Account', id: acct.record.id, mode: 'RetainedReference' }],
    });
    expect(retained.status).toBe('Resolved');
    if (retained.status === 'Resolved') {
      expect(retained.results[0]?.status).toBe('Valid');
    }

    setWritable(false);
    const blocked = await catalog.save({ kind: 'CreateInstitution', label: 'Blocked Broker' });
    expect(blocked.status).toBe('RuntimeNotWritable');
  });
});
