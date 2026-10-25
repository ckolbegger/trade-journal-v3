// T2.58: the defined values of `summary` and `netCost` on the committed workspace-v2 fixture, which
// T2.56's verify:fixtures field rule relies on (the snapshot predates both fields). Expected values are
// arithmetic on the fixture's recorded facts, not copied from output.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Rational } from '../../../src/domain/values/index.ts';
import { launchOn, loadDump, type WorkspaceDump } from '../../../tools/fixtures/workspace-fixture.ts';
import { sequentialIds } from '../../support/workspace.ts';

const dump = JSON.parse(readFileSync('tests/fixtures/workspace-v2/dump.json', 'utf8')) as WorkspaceDump;

async function openFixture() {
  const app = await launchOn(await loadDump(dump), dump.asOf, sequentialIds('verify'));
  expect((await app.Workspace.initialize({})).kind).toBe('Opened');
  return app;
}

const stock = (quantity: Rational, price: Rational) => ({ kind: 'Stock', direction: 'Long', quantity, price });

describe('Trade Summary and Net cost on workspace-v2', () => {
  it('should give CSCO, KO and PFE their open quantity, average open cost, and Net cost, on the list and the Detail', async () => {
    const app = await openFixture();
    const open = await app.TradeViewsAndReporting.browseTrades({ lifecycle: 'Open' });
    if (open.kind !== 'Ready') throw new Error(`expected Ready, got ${open.kind}`);
    // CSCO buys 60 @ 50.10, 40 @ 50.30, 20 @ 51.00, each with fee 1.00:
    //   quantity 120; cost 3006 + 2012 + 1020 = 6038; average 6038 / 120 = 3019/60; Net cost 6038 + 3 = 6041.
    // KO buys 60 @ 50.10 and 40 @ 50.30: quantity 100; cost 5018; average 50.18 = 2509/50; Net cost 5018 + 2 = 5020.
    // PFE buys 60 @ 50.10: quantity 60; average 50.10 = 501/10; Net cost 3006 + 1 = 3007.
    const expected = {
      CSCO: { summary: stock(Rational.of(120n), Rational.of(3019n, 60n)), netCost: { kind: 'Value', value: Rational.of(6041n) } },
      KO: { summary: stock(Rational.of(100n), Rational.of(2509n, 50n)), netCost: { kind: 'Value', value: Rational.of(5020n) } },
      PFE: { summary: stock(Rational.of(60n), Rational.of(501n, 10n)), netCost: { kind: 'Value', value: Rational.of(3007n) } },
    };
    expect(open.view.items.map((i) => i.underlying).sort()).toEqual(['CSCO', 'KO', 'PFE']);
    for (const item of open.view.items) {
      const want = expected[item.underlying as keyof typeof expected];
      expect(item).toEqual(expect.objectContaining(want));
      const detail = await app.TradeViewsAndReporting.getTradeDetail({ tradeId: item.tradeId });
      expect(detail.kind === 'Ready' && detail.view).toEqual(expect.objectContaining(want));
    }
  });

  it('should give each Planned Trade its planned quantity and intended entry, and no Net cost, on the list and the Detail', async () => {
    const app = await openFixture();
    const planned = await app.TradeViewsAndReporting.browseTrades({ lifecycle: 'Planned' });
    if (planned.kind !== 'Ready') throw new Error(`expected Ready, got ${planned.kind}`);
    // The Planned Legs' quantity and intended entry: AAPL 50 @ 228.4 = 1142/5, MSFT 30 @ 415.1 = 4151/10,
    // NVDA 120 @ 131.25 = 525/4, COST 10 @ 905, BRK.B 25 @ 462.75 = 1851/4.
    const expected = {
      AAPL: stock(Rational.of(50n), Rational.of(1142n, 5n)),
      MSFT: stock(Rational.of(30n), Rational.of(4151n, 10n)),
      NVDA: stock(Rational.of(120n), Rational.of(525n, 4n)),
      COST: stock(Rational.of(10n), Rational.of(905n)),
      'BRK.B': stock(Rational.of(25n), Rational.of(1851n, 4n)),
    };
    expect(planned.view.items.map((i) => i.underlying).sort()).toEqual(Object.keys(expected).sort());
    for (const item of planned.view.items) {
      const want = expected[item.underlying as keyof typeof expected];
      expect(item).toEqual(expect.objectContaining({ summary: want }));
      expect(item).not.toHaveProperty('netCost');
      const detail = await app.TradeViewsAndReporting.getTradeDetail({ tradeId: item.tradeId });
      expect(detail.kind === 'Ready' && detail.view).toEqual(expect.objectContaining({ summary: want }));
      expect(detail.kind === 'Ready' && detail.view).not.toHaveProperty('netCost');
    }
  });
});
