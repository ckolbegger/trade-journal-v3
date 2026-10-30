// The D5 Node application-stack suite (plan section 6.1): the real facade from createApplication on
// fake-indexeddb, NodeTestHost and the in-process lifecycle lock, called through facade operations
// only, as in D1, D2 and D4. Test code touches stored records only before an application opens them
// (the fixture loader and the integrity fixture writer). Clocks are fixed per case, and restart means
// a new application over the same factory.
import type { Application } from '../../../src/app/compose.ts';
import type { DebtProjection } from '../../../src/modules/journal/index.ts';
import {
  buy, complete, confirmReference, device, type Dump, type Fill, onboarded, PC1, PC1_TIME, PC2, planStock, positionChange, record, saveMark, workspaceStores,
} from '../d4/support.ts';

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

// An onboarded Workspace on Monday 10:05 holding the reference Trade with PC1 deferred (D-1).
export async function withDebt() {
  const d = await device(undefined, MONDAY_1005);
  const app = await onboarded(d);
  const tradeId = await confirmReference(app);
  await recordDeferred(app, tradeId, PC1);
  const debt = (await outstandingDebts(app))[0]!;
  return { d, app, tradeId, debt };
}

export const SYMBOLS = ['XYZ', 'ABC', 'DEF', 'JKL'] as const;
export const PRICES = { XYZ: '52.00', ABC: '27.50', DEF: '40.50', JKL: '21.00' } as const;

// D4's five-Trade fixture without T-D: T-A (XYZ) with PC1 deferred and PC2 completed, then T-B ABC,
// T-C DEF and T-E JKL, each filled at 10:00 Monday.
export async function fixture(app: Application) {
  const a = await planStock(app, 'XYZ', '50.00', '47.50', '56.00');
  await recordDeferred(app, a, PC1);
  await record(app, a, PC2);
  const single = async (symbol: string, entry: string, stop: string, target: string) => {
    const tradeId = await planStock(app, symbol, entry, stop, target);
    await record(app, tradeId, { quantity: '100', price: entry, economicTime: PC1_TIME });
    return tradeId;
  };
  const b = await single('ABC', '30.00', '28.00', '36.00');
  const c = await single('DEF', '40.00', '38.00', '46.00');
  const e = await single('JKL', '20.00', '19.00', '30.00');
  return { a, b, c, e, all: [a, b, c, e] };
}

// Saves the four fixture Marks for one trading date.
export async function saveMarks(app: Application, date: string) {
  for (const symbol of SYMBOLS) await saveMark(app, symbol, date, PRICES[symbol]);
}

// The completed Position Change Reflection's form: the definition revision and its three answers.
export async function reflectionForm(app: Application) {
  const disposition = await complete(app);
  if (disposition.kind !== 'Complete') throw new Error('expected a Complete disposition');
  return disposition.form;
}

// The stored Journal records of a dump, keyed by store name.
export function journalStores(dump: Dump) {
  const stores = workspaceStores(dump);
  return {
    debts: stores['journalDebts'] as { debtId: string; obligationKey: string; versions: { versionId: string; status: string; entryId?: string; declineId?: string }[] }[],
    entries: stores['journalEntries'] as { id: string; entryTypeKey: string; sourceKey?: string; settledDebtId?: string; momentTime: string; authoredTime: string; versions: { definitionId: string; responses: unknown[] }[]; obligationKey?: unknown }[],
    declines: stores['journalDeclines'] as { id: string; sourceKey?: string; settledDebtId?: string; reason?: string }[],
    obligations: stores['journalObligations'] as { obligationKey: string; outcome: { kind: string; id: string } }[],
    all: stores,
  };
}
