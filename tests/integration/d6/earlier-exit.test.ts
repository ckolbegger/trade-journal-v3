// I6.8: an earlier-dated exit re-runs FIFO over the effective facts (P23). Nothing about matching is
// stored: the receipt discloses the derived matches that changed, and the Detail after restart shows
// the FIFO set of the facts alone.
import { describe, expect, it } from 'vitest';
import { Rational } from '../../../src/domain/values/index.ts';
import {
  confirmReference, dec, device, dumpAll, onboarded, PC1, PC2, record, recordExit, restart, TUESDAY_0945, TUESDAY_1700, workspaceStores, X1,
  type Fill, type StoredTradeDoc,
} from './support.ts';

// X0 sells at 51.50 with fee 0.80; the plan row fixes only its quantity and its Economic Time.
const x0Of = (quantity: string): Fill => ({ quantity, price: '51.50', economicTime: TUESDAY_0945, fee: '0.80' });

type Match = readonly [opening: 'PC1' | 'PC2', disposing: 'X0' | 'X1', quantity: string];

const CASES = [
  {
    quantity: '60',
    // X0 takes PC1's 60; X1 then takes 30 of PC2, so PC1 <- X1 is superseded and two links are created.
    changes: [
      ['Superseded', 'PC1', 'X1', '30', null],
      ['Created', 'PC1', 'X0', null, '60'],
      ['Created', 'PC2', 'X1', null, '30'],
    ],
    matches: [['PC1', 'X0', '60'], ['PC2', 'X1', '30']] as readonly Match[],
    realized: { before: '55.90', after: '131.85' },
    remaining: '10',
  },
  {
    quantity: '40',
    // X0 takes 40 of PC1; X1 then takes the other 20 of PC1 and 10 of PC2, so PC1 <- X1 gains a new version.
    changes: [
      ['Created', 'PC1', 'X0', null, '40'],
      ['Revised', 'PC1', 'X1', '30', '20'],
      ['Created', 'PC2', 'X1', null, '10'],
    ],
    matches: [['PC1', 'X0', '40'], ['PC1', 'X1', '20'], ['PC2', 'X1', '10']] as readonly Match[],
    realized: { before: '55.90', after: '108.35' },
    remaining: '30',
  },
] as const;

describe('I6.8 earlier-dated exit', () => {
  for (const c of CASES) {
    it(`X0 of ${c.quantity}: should disclose the changed matches with realized P&L before ${c.realized.before} and after ${c.realized.after}, then after restart show the FIFO set in Detail and hold only the facts`, async () => {
      const d = await device(undefined, TUESDAY_1700);
      const app = await onboarded(d);
      const tradeId = await confirmReference(app);
      const pc1 = await record(app, tradeId, PC1);
      const pc2 = await record(app, tradeId, PC2);
      const x1 = await recordExit(app, tradeId, [X1]);
      // The Execution identity of each fill: the receipt lists the Position Change, then its members.
      const executions: Record<string, string> = { PC1: pc1.receipt.createdFactIds[1]!, PC2: pc2.receipt.createdFactIds[1]!, X1: x1.receipt.createdFactIds[1]! };
      expect(x1.postCommit.derivation.realizedToDate).toEqual(dec(c.realized.before));

      const x0 = await recordExit(app, tradeId, [x0Of(c.quantity)]);
      executions['X0'] = x0.receipt.createdFactIds[1]!;
      const quantity = (text: string | null) => (text === null ? null : dec(text));
      expect(x0.receipt.lotMatchChanges).toEqual(
        c.changes.map(([kind, opening, disposing, before, after]) => ({
          kind,
          openingExecutionId: executions[opening],
          disposingExecutionId: executions[disposing],
          quantity: { before: quantity(before), after: quantity(after) },
        })),
      );
      expect(x0.receipt.realizedToDate).toEqual({ before: dec(c.realized.before), after: dec(c.realized.after) });
      expect(x0.receipt.lifecycleTransitions).toEqual([]);

      const again = await restart(app, d);
      const result = await again.TradeViewsAndReporting.getTradeDetail({ tradeId });
      if (result.kind !== 'Ready' || !('lotMatches' in result.view)) throw new Error(`getTradeDetail: ${result.kind}`);
      const detail = result.view;
      expect(detail.lifecycle).toEqual({ stored: 'Open', agreement: { kind: 'Agrees' } });
      expect(detail.lotMatches.map((m) => [m.openingExecutionId, m.disposingExecutionId, m.quantity, m.policy])).toEqual(
        c.matches.map(([opening, disposing, matched]) => [executions[opening], executions[disposing], dec(matched), 'FIFO']),
      );
      expect(detail.realizedToDate).toEqual(dec(c.realized.after));
      expect(detail.positions[0]!.quantity).toEqual(Rational.of(BigInt(c.remaining)));

      // The dump holds the facts only: the four Executions with one version each, no match, no figure.
      const dump = await dumpAll(d.factory);
      const trade = (workspaceStores(dump)['trades'] as StoredTradeDoc[])[0]!;
      expect(trade.facts.filter((f) => f.kind === 'Execution').map((f) => f.factId).sort()).toEqual(Object.values(executions).sort());
      expect(trade.facts.every((f) => f.versions.length === 1)).toBe(true);
      expect(JSON.stringify(dump)).not.toMatch(/lotMatch|LotMatch|realized/);
    }, 60_000);
  }
});
