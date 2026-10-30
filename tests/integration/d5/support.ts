// The D5 Node application-stack suite (plan section 6.1): the real facade from createApplication on
// fake-indexeddb, NodeTestHost and the in-process lifecycle lock, called through facade operations
// only, as in D1, D2 and D4. Test code touches stored records only before an application opens them
// (the fixture loader and the integrity fixture writer). Clocks are fixed per case, and restart means
// a new application over the same factory.
import type { Application } from '../../../src/app/compose.ts';
import type { DebtProjection } from '../../../src/modules/journal/index.ts';
import { buy, type Fill, positionChange } from '../d4/support.ts';

export * from '../d4/support.ts';

// Tuesday 2026-10-13 at 17:00 America/New_York, and the instants the Defer cases use.
export const MONDAY_1005 = '2026-10-12T14:05:00Z';
export const TUESDAY_1700 = '2026-10-13T21:00:00Z';

// Records one single-Execution Position Change with the Defer disposition and returns the result
// the facade gave, requiring it to be Recorded.
export async function recordDeferred(app: Application, tradeId: string, fill: Fill) {
  const command = await positionChange(app, tradeId, [await buy(app, tradeId, fill)], { kind: 'Defer' });
  const result = await app.TradeWorkflows.recordPositionChange(command);
  if (result.kind !== 'Recorded') throw new Error(`recordPositionChange: ${JSON.stringify(result)}`);
  return result;
}

// Every Outstanding Debt the Journal lists, in due order.
export async function outstandingDebts(app: Application): Promise<readonly DebtProjection[]> {
  const page = await app.Journal.query({ scope: 'OutstandingDebt' });
  if (!('debts' in page)) throw new Error(`Journal.query OutstandingDebt: ${page.kind}`);
  return page.debts;
}
