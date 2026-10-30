// The D5 Debt fixture (breakdown D5, section 4), built through the real module APIs: every Position
// Change is recorded by Trade Workflows with a Defer disposition. The main clock is Tuesday
// 2026-10-13 17:00 New York; every Tuesday Mark and every Action for Tuesday is saved.
import type { DebtProjection } from '../../src/modules/journal/index.ts';
import { reviewStack, TEN_AM, ELEVEN_AM, type ReviewStack } from './review-fixture.ts';

export const TUESDAY_1700 = '2026-10-13T21:00:00Z';
export const TUESDAY_REVIEW_DATE = '2026-10-13';
export const TUESDAY_CUTOFF = '2026-10-13T20:00:00Z';
// Monday 16:00 New York, the close of the session before Tuesday.
export const MONDAY_CLOSE = '2026-10-12T20:00:00Z';
const FRIDAY_PLAN = '2026-10-09T13:00:00Z';
const FRIDAY_1400 = '2026-10-09T18:00:00Z';
const MONDAY_1600 = '2026-10-12T20:00:00Z';
const MONDAY_1605 = '2026-10-12T20:05:00Z';
const TUESDAY_1000 = '2026-10-13T14:00:00Z';

export type DebtName = 'D-1' | 'D-2' | 'D-3' | 'D-4' | 'D-5' | 'D-6' | 'D-7';

export interface DebtTrades {
  readonly a: string;
  readonly f: string;
  readonly e: string;
  readonly g: string;
  readonly h: string;
}

export interface DebtFixture {
  readonly stack: ReviewStack;
  readonly trades: DebtTrades;
  readonly debts: Readonly<Record<DebtName, DebtProjection>>;
}

// Each Debt is recorded in the order D-1 to D-7, so Debt identity orders D-1 before D-4 at their shared anchor.
export async function debtFixture(): Promise<DebtFixture> {
  const stack = await reviewStack(TUESDAY_1700);
  const defer = { kind: 'Defer' } as const;
  const a = await stack.confirm({ symbol: 'XYZ', shares: '100', entry: '50.00', stop: '47.50', target: '56.00' });
  const f = await stack.confirm({ symbol: 'MNO', shares: '100', entry: '25.00', stop: '23.00', target: '30.00', planTime: FRIDAY_PLAN });
  const e = await stack.confirm({ symbol: 'JKL', shares: '100', entry: '20.00', stop: '19.00', target: '30.00' });
  const g = await stack.confirm({ symbol: 'PQR', shares: '100', entry: '15.00', stop: '14.00', target: '18.00' });
  const h = await stack.confirm({ symbol: 'STU', shares: '100', entry: '10.00', stop: '9.00', target: '12.00' });
  await stack.fill(a, TEN_AM, '60', '50.10', defer);
  await stack.fill(a, ELEVEN_AM, '40', '50.30', defer);
  await stack.fill(f, FRIDAY_1400, '100', '25.00', defer);
  await stack.fill(e, TEN_AM, '100', '20.00', defer);
  await stack.fill(g, MONDAY_1600, '100', '15.00', defer);
  await stack.fill(h, MONDAY_1605, '100', '10.00', defer);
  await stack.fill(a, TUESDAY_1000, '20', '51.00', defer);

  for (const [symbol, price] of [['XYZ', '52.00'], ['MNO', '26.00'], ['JKL', '21.00'], ['PQR', '15.50'], ['STU', '10.50']] as const) {
    await stack.saveMark(symbol, price, TUESDAY_REVIEW_DATE);
  }
  for (const trade of [a, f, e, g, h]) await stack.saveAction(trade.tradeId, 'Hold', TUESDAY_REVIEW_DATE);

  const outstanding = await stack.journal.query({ scope: 'OutstandingDebt' });
  const find = (trade: string, momentTime: string): DebtProjection => {
    const debt = outstanding.debts.find((d) => d.anchor.tradeId === trade && d.momentTime === momentTime);
    if (!debt) throw new Error(`no Debt for ${trade} at ${momentTime}`);
    return debt;
  };
  const debts = {
    'D-1': find(a.tradeId, TEN_AM),
    'D-2': find(a.tradeId, ELEVEN_AM),
    'D-3': find(f.tradeId, FRIDAY_1400),
    'D-4': find(e.tradeId, TEN_AM),
    'D-5': find(g.tradeId, MONDAY_1600),
    'D-6': find(h.tradeId, MONDAY_1605),
    'D-7': find(a.tradeId, TUESDAY_1000),
  };
  return { stack, trades: { a: a.tradeId, f: f.tradeId, e: e.tradeId, g: g.tradeId, h: h.tradeId }, debts };
}
