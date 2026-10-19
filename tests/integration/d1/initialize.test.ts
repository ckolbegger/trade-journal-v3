import { describe, expect, it } from 'vitest';
import { device, dumpAll, launch, restart, workspaceStores } from './support.ts';

describe('I1.1 fresh initialization', () => {
  it('should go from InitializationRequired to Opened needing an Institution and Account, then reopen Ready in the same zone with the seeds added once', async () => {
    const d = await device();
    const app = await launch(d);
    expect((await app.Workspace.getStatus()).kind).toBe('InitializationRequired');

    const first = await app.Workspace.initialize({ timeZone: 'America/New_York' });
    if (first.kind !== 'Opened') throw new Error(`initialize: ${first.kind}`);
    expect(first.status.onboarding).toBe('NeedsInstitutionAndAccount');
    expect(first.receipt.fresh).toBe(true);
    expect(first.receipt.seeds.catalog.additions.length).toBeGreaterThan(0);
    expect(first.receipt.seeds.journal.additions.length).toBeGreaterThan(0);

    const again = await restart(app, d);
    const status = await again.Workspace.getStatus();
    expect(status.kind === 'Ready' && [status.timeZone, status.onboarding]).toEqual(['America/New_York', 'NeedsInstitutionAndAccount']);
    const second = await again.Workspace.initialize({});
    if (second.kind !== 'Opened') throw new Error(`second initialize: ${second.kind}`);
    expect(second.receipt.fresh).toBe(false);
    expect(second.receipt.seeds.catalog.additions).toEqual([]);
    expect(second.receipt.seeds.journal.additions).toEqual([]);

    const stores = workspaceStores(await dumpAll(d.factory));
    const strategies = (stores['catalog'] as { kind: string; productKey?: string }[]).filter((r) => r.kind === 'Strategy');
    expect(strategies.map((s) => s.productKey)).toEqual(['strategy.long-stock']);
    expect((stores['journalDefinitions'] as { entryTypeKey?: string }[]).length).toBe(1);
  });
});

describe('I1.9 concurrent first run', () => {
  it('should leave exactly one Workspace database and one pointer when two applications initialize at once, both Opened on it', async () => {
    const d = await device();
    const [a, b] = [await launch(d), await launch(d)];
    const results = await Promise.all([
      a.Workspace.initialize({ timeZone: 'America/New_York' }),
      b.Workspace.initialize({ timeZone: 'America/New_York' }),
    ]);
    expect(results.map((r) => r.kind)).toEqual(['Opened', 'Opened']);
    const names = results.map((r) => (r.kind === 'Opened' ? r.status.binding.databaseName : ''));
    expect(names[0]).toBe(names[1]);

    const dump = await dumpAll(d.factory);
    expect(Object.keys(dump).filter((n) => n.startsWith('tj-ws-'))).toEqual([names[0]]);
    expect(dump['tj-root']!['pointer']).toEqual([{ key: 'current', databaseName: names[0] }]);
  });
});
