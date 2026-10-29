// T4.19: the D4 operations are reachable through the one application facade, and its mutating
// Market Data operation goes through the mutation guard like D1 and D2's (AC-CAP-001, AC-DEL-004).
import { describe, expect, it } from 'vitest';
import { device, dumpAll, onboarded, restart } from '../d2/support.ts';

describe('D4 facade', () => {
  it('should return RuntimeNotWritable from MarketData.save through the facade with every store unchanged while the inventory check fails', async () => {
    const d = await device();
    const app = await onboarded(d);
    d.testHost.fail(['inventory']);
    const recovery = await restart(app, d);
    const before = await dumpAll(d.factory);

    const result = await recovery.MarketData.save({
      intention: 'RecordInitialManualMark',
      instrumentKey: 'XYZ',
      tradingDate: '2026-10-09',
      price: '52',
      expectedResolutionRevision: 'None',
    });

    expect(result).toEqual(expect.objectContaining({ kind: 'RuntimeNotWritable' }));
    expect(await dumpAll(d.factory)).toEqual(before);
  });
});
