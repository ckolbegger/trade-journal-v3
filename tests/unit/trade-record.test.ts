import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createReferenceCatalog } from '../../src/catalog/reference-catalog';
import { createJournal, PLAN_REFLECTION_TYPE_ID } from '../../src/journal/journal';
import { createPersistenceSeam, CURRENT_SCHEMA_VERSION } from '../../src/persistence/idb';
import { createManualClock } from '../../src/shared/clock';
import { createTradeRecord } from '../../src/trade-record/trade-record';
import { createTradeWorkflows } from '../../src/trade-workflows/trade-workflows';

describe('TradeRecord store query seam', () => {
  it('returns null and empty list on an uninitialized workspace', async () => {
    const persistence = createPersistenceSeam({
      indexedDB: new IDBFactory(),
      writeGate: { checkWritable: () => ({ writable: true }) },
    });
    const tradeRecord = createTradeRecord({ persistence });

    expect(await tradeRecord.getRecord('trade_missing')).toBeNull();
    expect(await tradeRecord.queryRecords({})).toEqual({ items: [] });
    expect(await tradeRecord.queryRecords({ lifecycleState: 'Open' })).toEqual({ items: [] });
  });

  it('retrieves individual trades by ID and filters accurately across Planned, Open, and Closed lifecycles', async () => {
    const clock = createManualClock('2026-11-23T14:30:00.000Z');
    const persistence = createPersistenceSeam({
      indexedDB: new IDBFactory(),
      writeGate: { checkWritable: () => ({ writable: true }) },
    });
    const catalog = createReferenceCatalog({ persistence, clock });
    const journal = createJournal({ persistence, clock });
    const tradeRecord = createTradeRecord({ persistence });
    const workflows = createTradeWorkflows({ persistence, clock });

    await persistence.runWriteTransaction(['workspace_meta'], async (tx) => {
      tx.put('workspace_meta', {
        key: 'singleton',
        schemaVersion: CURRENT_SCHEMA_VERSION,
        timeZone: 'America/New_York',
        settingsRevision: 1,
        workspaceRevision: 1,
        initializedAt: '2026-11-23T14:30:00.000Z',
        updatedAt: '2026-11-23T14:30:00.000Z',
      });
    });

    await catalog.seedDefaults();
    await journal.seedDefaults();
    const inst = await catalog.save({ kind: 'CreateInstitution', label: 'Fidelity' });
    if (inst.status !== 'Saved' || inst.family !== 'Institution') throw new Error('inst failed');
    const acct = await catalog.save({
      kind: 'CreateAccount',
      institutionId: inst.record.id,
      label: 'Individual',
    });
    if (acct.status !== 'Saved' || acct.family !== 'Account') throw new Error('acct failed');
    const strats = await catalog.query({ family: 'Strategy', includeInactive: false });
    if (strats.family !== 'Strategy' || !strats.items[0]) throw new Error('strat missing');
    const accountId = acct.record.id;
    const strategyId = strats.items[0].id;
    const defs = await journal.getDefinitions();
    const planDef = defs.definitions.find((d) => d.entryTypeId === PLAN_REFLECTION_TYPE_ID)!;

    async function confirm(symbol: string) {
      const res = await workflows.confirmPlan({
        accountId,
        strategyId,
        symbol,
        quantity: '100',
        intendedEntryPrice: '50.00',
        stopPrice: '47.00',
        targetPrice: '56.00',
        economicTime: '2026-11-23T14:30:00.000Z',
        planReflection: {
          definitionId: planDef.id,
          definitionRevision: planDef.revision,
          thesis: `${symbol} thesis`,
          invalidation: `${symbol} invalidation`,
        },
      });
      if (res.status !== 'Confirmed') throw new Error(`confirm ${symbol} failed`);
      return res.postCommit.trade.id;
    }

    const plannedId = await confirm('AAPL');
    const openId = await confirm('NVDA');
    const closedId = await confirm('MSFT');

    // Open NVDA
    clock.setIso('2026-11-23T14:35:00.000Z');
    const openRes = await workflows.recordPositionChange({
      tradeId: openId,
      expectedFactRevision: 1,
      economicTime: '2026-11-23T14:35:00.000Z',
      executions: [
        { side: 'Buy', quantity: '100', fillPrice: '50.00', fee: '0.00', plannedLegIntent: 'PlannedLeg' },
      ],
      reflection: { kind: 'Defer' },
    });
    expect(openRes.status).toBe('Recorded');

    // Open then close MSFT
    const openMsft = await workflows.recordPositionChange({
      tradeId: closedId,
      expectedFactRevision: 1,
      economicTime: '2026-11-23T14:35:00.000Z',
      executions: [
        { side: 'Buy', quantity: '100', fillPrice: '50.00', fee: '0.00', plannedLegIntent: 'PlannedLeg' },
      ],
      reflection: { kind: 'Defer' },
    });
    expect(openMsft.status).toBe('Recorded');

    clock.setIso('2026-11-23T15:00:00.000Z');
    const closeMsft = await workflows.recordPositionChange({
      tradeId: closedId,
      expectedFactRevision: 2,
      economicTime: '2026-11-23T15:00:00.000Z',
      executions: [
        { side: 'Sell', quantity: '100', fillPrice: '56.00', fee: '0.00', plannedLegIntent: 'PlannedLeg' },
      ],
      closeReasonId: 'cr_target_reached',
      reflection: { kind: 'Defer' },
    });
    expect(closeMsft.status).toBe('Recorded');

    expect(await tradeRecord.getRecord('nonexistent')).toBeNull();
    const fetchedOpen = await tradeRecord.getRecord(openId);
    expect(fetchedOpen?.trade.symbol).toBe('NVDA');
    expect(fetchedOpen?.trade.lifecycleState).toBe('Open');
    expect(fetchedOpen?.facts).toHaveLength(1);

    const all = await tradeRecord.queryRecords({});
    expect(all.items.map((t) => t.id)).toEqual(
      expect.arrayContaining([plannedId, openId, closedId]),
    );
    expect(all.items).toHaveLength(3);

    const plannedOnly = await tradeRecord.queryRecords({ lifecycleState: 'Planned' });
    expect(plannedOnly.items.map((t) => t.id)).toEqual([plannedId]);

    const openOnly = await tradeRecord.queryRecords({ lifecycleState: 'Open' });
    expect(openOnly.items.map((t) => t.id)).toEqual([openId]);

    const closedOnly = await tradeRecord.queryRecords({ lifecycleState: 'Closed' });
    expect(closedOnly.items.map((t) => t.id)).toEqual([closedId]);
  });
});
