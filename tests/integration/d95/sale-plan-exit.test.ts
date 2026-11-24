// I95.11 A sale is measured against the Plan Exit (AC-REV-008), the closing sale (AC-POS-004) and a buy's deferral (AC-JOUR-003),
// through the real facade on fake-indexeddb. Four stock Trades of 100 shares bought Thursday 10-08, each with an Exit saved on Friday's Review,
// and Monday's Marks in: ABC is at its Stop, MNO and PQR are inside both lines, STU is inside both lines and is sold in part.
import { describe, expect, it } from 'vitest';
import type { Application } from '../../../src/app/compose.ts';
import { measurePlanExit } from '../../../src/domain/plan-exit/index.ts';
import type { ReflectionDisposition } from '../../../src/modules/journal/index.ts';
import { buy, completeSale, closeReviewDisposition, device, dumpAll, exitCommand, onboarded, outstandingDebts, planStock, positionChange, record, saveMark } from '../d7/support.ts';
import { FRI_1700, FRIDAY, launch, MON_1700, MONDAY, onDay, openOn, saveActionOn } from './support.ts';

const THU_1000 = '2026-10-08T14:00:00Z';
const SALE_TIME = '2026-10-12T19:00:00Z';
const PLAN_DEPARTURE = 'prompt.position-change-reflection.plan-departure';

type Name = 'whole' | 'carried' | 'quiet' | 'part';
type Entry = 'Review' | 'Detail';

// ABC 30.00 (Stop 28, Target 36) is past its Stop Friday and Monday; Friday's Exit has no reason (the Plan said out).
// MNO and PQR 40.00 (Stop 38, Target 46) are inside Monday; MNO's Friday Exit has a reason, PQR's has none (it was past its Stop that day).
// STU 40.00 is inside both days; its Friday Exit has a reason.
async function saleBook() {
  const d = await device(undefined, MON_1700);
  let app = await onboarded(d);
  const ids = {} as Record<Name, string>;
  const marks: Record<string, [string, string]> = { ABC: ['27.00', '25.00'], MNO: ['41.00', '40.50'], PQR: ['37.00', '40.50'], STU: ['41.00', '40.50'] };
  const names: Record<string, Name> = { ABC: 'whole', MNO: 'carried', PQR: 'quiet', STU: 'part' };
  for (const [symbol, [stop, target]] of [['ABC', ['28.00', '36.00']], ['MNO', ['38.00', '46.00']], ['PQR', ['38.00', '46.00']], ['STU', ['38.00', '46.00']]] as const) {
    const entry = symbol === 'ABC' ? '30.00' : '40.00';
    const tradeId = await planStock(app, symbol, entry, stop, target, '100', '2026-10-08T13:00:00Z');
    await record(app, tradeId, { quantity: '100', price: entry, economicTime: THU_1000 });
    ids[names[symbol]!] = tradeId;
    await saveMark(app, symbol, FRIDAY, marks[symbol]![0]);
    await saveMark(app, symbol, MONDAY, marks[symbol]![1]);
  }
  app.persistence.close();
  app = await onDay(d, FRI_1700, async (friday) => {
    await saveActionOn(friday, FRI_1700, ids.whole, 'Exit');
    await saveActionOn(friday, FRI_1700, ids.carried, 'Exit', 'The thesis is done.');
    await saveActionOn(friday, FRI_1700, ids.quiet, 'Exit');
    await saveActionOn(friday, FRI_1700, ids.part, 'Exit', 'Trimming the position.');
    return friday;
  }).then(() => launch(d));
  return { d, app, ids };
}

// The facts a sale form reads: from the Review's card or from Trade Detail.
async function factsOf(app: Application, tradeId: string, entry: Entry) {
  if (entry === 'Review') {
    const opened = await openOn(app, MON_1700);
    const card = await app.DailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId, binding: opened.binding });
    if (card.kind !== 'Ready' || !card.trade.planExit) throw new Error(`getTrade: ${card.kind}`);
    return card.trade.planExit;
  }
  const detail = await app.TradeViewsAndReporting.getTradeDetail({ tradeId });
  if (detail.kind !== 'Ready' || !('planExit' in detail.view) || !detail.view.planExit) throw new Error(`getTradeDetail: ${detail.kind}`);
  return detail.view.planExit;
}

// The measure the sale form shows, worked from those facts as the form works it.
function measureOf(facts: Awaited<ReturnType<typeof factsOf>>, quantity: string, price: string) {
  const position = facts.positions[0]!;
  return measurePlanExit({ held: position.quantity, change: { side: 'Sell', quantity, price }, conditions: position.conditions, heldPast: facts.heldPast });
}

async function closing(app: Application): Promise<{ closeReasonId: string; closeReview: ReflectionDisposition }> {
  const page = await app.ReferenceCatalog.query({ family: 'CloseReason' });
  if (page.kind !== 'Page') throw new Error('no Close Reasons');
  return { closeReasonId: page.items[0]!.id, closeReview: { kind: 'Defer' } };
}

const SALES: Record<Name, { quantity: string; price: string }> = {
  whole: { quantity: '100', price: '25.00' },
  carried: { quantity: '100', price: '40.50' },
  quiet: { quantity: '100', price: '40.50' },
  part: { quantity: '40', price: '40.50' },
};

// One sale of the named Trade: the command a form would send for it.
async function saleOf(app: Application, tradeId: string, name: Name, reflection: ReflectionDisposition) {
  const { quantity, price } = SALES[name];
  const close = name === 'part' ? {} : await closing(app);
  return exitCommand(app, tradeId, [{ quantity, price, economicTime: SALE_TIME, fee: '1.00' }], { reflection, ...close });
}

// What a sale left behind: the result, the reflection's outcome and the Outstanding Debts the Trade owes.
async function outcomeOf(app: Application, tradeId: string, name: Name, reflection: ReflectionDisposition) {
  const result = await app.TradeWorkflows.recordPositionChange(await saleOf(app, tradeId, name, reflection));
  if (result.kind !== 'Recorded') return { kind: result.kind, issues: 'issues' in result ? result.issues : undefined };
  const owed = (await outstandingDebts(app)).filter((debt) => debt.anchor.tradeId === tradeId);
  return { kind: result.kind, reflection: result.receipt.reflection.kind, owed: owed.map((debt) => [debt.entryTypeKey, debt.requires]) };
}

const bareReflection = async (app: Application): Promise<ReflectionDisposition> => {
  const definition = await app.Journal.getDefinitions({ latestFor: 'entry-type.position-change-reflection' });
  if (definition.kind !== 'Found') throw new Error('no Position Change Reflection definition');
  return { kind: 'Complete', form: { definitionId: definition.definition.id, answers: {} } };
};

const BOTH: readonly Entry[] = ['Review', 'Detail'];
const CLOSE_REVIEW = 'entry-type.close-review';

describe('I95.11 AC-REV-008 A sale that follows the Plan Exit asks for no reason', () => {
  it('should record the whole Position sold at its Stop, never held past, with a completed reflection and no reflection Debt, from both entry points', { timeout: 120_000 }, async () => {
    const outcomes = [];
    for (const entry of BOTH) {
      const { app, ids } = await saleBook();
      const measure = measureOf(await factsOf(app, ids.whole, entry), '100', '25.00');
      outcomes.push({ measure: measure?.kind, ...(await outcomeOf(app, ids.whole, 'whole', await bareReflection(app))) });
    }

    // Catches a measure that asks a reason of a sale at the Stop, or a sale that leaves a reflection Debt; the Close Review Debt is the sale's own.
    expect(outcomes[0]).toEqual({ measure: 'Follows', kind: 'Recorded', reflection: 'Entry', owed: [[CLOSE_REVIEW, undefined]] });
    expect(outcomes[1]).toEqual(outcomes[0]);
  });

  it('should return the same Plan Exit facts from the Review card and from Trade Detail', { timeout: 120_000 }, async () => {
    const { app, ids } = await saleBook();

    for (const name of ['whole', 'carried', 'quiet', 'part'] as const) {
      const fromReview = await factsOf(app, ids[name], 'Review');
      const fromDetail = await factsOf(app, ids[name], 'Detail');
      // Catches a view that reads the conditions, the held quantity or the latest Exit differently from the other.
      expect(fromDetail).toEqual(fromReview);
    }
    const facts = await factsOf(app, ids.carried, 'Detail');
    expect(facts.exit).toEqual({ reviewDate: FRIDAY, reason: 'The thesis is done.' });
    expect(facts.positions[0]).toMatchObject({ quantity: '100.000000', conditions: [{ role: 'Stop', boundary: '38', status: 'Active' }, { role: 'Target', boundary: '46', status: 'Active' }] });
  });

  it('should record a whole sale before either line with no reason when the Exit Action carries one', { timeout: 120_000 }, async () => {
    const outcomes = [];
    for (const entry of BOTH) {
      const { app, ids } = await saleBook();
      const measure = measureOf(await factsOf(app, ids.carried, entry), '100', '40.50');
      outcomes.push({ measure: measure?.kind === 'Leaves' ? measure.reasons.map((r) => r.kind) : measure?.kind, ...(await outcomeOf(app, ids.carried, 'carried', await bareReflection(app))) });
    }

    // Catches a carried reason that is not recognised: the sale leaves the Plan, yet no reason is asked and none is copied.
    expect(outcomes[0]).toEqual({ measure: ['BeforeCondition'], kind: 'Recorded', reflection: 'Entry', owed: [[CLOSE_REVIEW, undefined]] });
    expect(outcomes[1]).toEqual(outcomes[0]);
  });
});

describe.each([
  ['the whole Position sold before either line with no reason on the Exit', 'quiet', ['BeforeCondition']],
  ['part of the Position sold', 'part', ['BeforeCondition', 'PartOnly']],
] as const)('I95.11 AC-REV-008 %s', (title, name, reasons) => {
  it(`should refuse a completed reflection without the Plan Departure Reason, from both entry points, for ${title}`, { timeout: 120_000 }, async () => {
    for (const entry of BOTH) {
      const { d, app, ids } = await saleBook();
      const measure = measureOf(await factsOf(app, ids[name], entry), SALES[name].quantity, SALES[name].price);
      const before = await dumpAll(d.factory);

      const outcome = await outcomeOf(app, ids[name], name, await bareReflection(app));

      // Catches a sale that leaves the Plan recorded with no reason, or a measure that does not name why it leaves.
      expect(measure?.kind === 'Leaves' && measure.reasons.map((r) => r.kind)).toEqual(reasons);
      expect(outcome).toMatchObject({ kind: 'Rejected', issues: [{ source: 'TradeWorkflows', field: PLAN_DEPARTURE, code: 'PlanDepartureReasonRequired' }] });
      expect(await dumpAll(d.factory)).toEqual(before);
    }
  });

  it(`should record it with the reason in a completed reflection and no reflection Debt for ${title}`, { timeout: 120_000 }, async () => {
    const outcomes = [];
    for (const entry of BOTH) {
      const { app, ids } = await saleBook();
      await factsOf(app, ids[name], entry);
      outcomes.push(await outcomeOf(app, ids[name], name, await completeSale(app)));
    }

    const closes = name === 'part' ? [] : [[CLOSE_REVIEW, undefined]];
    expect(outcomes[0]).toEqual({ kind: 'Recorded', reflection: 'Entry', owed: closes });
    expect(outcomes[1]).toEqual(outcomes[0]);
  });

  it(`should record it with the reflection put off, leaving one Debt that cannot be answered without the reason, for ${title}`, { timeout: 120_000 }, async () => {
    const outcomes = [];
    for (const entry of BOTH) {
      const { app, ids } = await saleBook();
      await factsOf(app, ids[name], entry);
      const outcome = await outcomeOf(app, ids[name], name, { kind: 'Defer' });
      outcomes.push(outcome);

      const debt = (await outstandingDebts(app)).find((x) => x.entryTypeKey === 'entry-type.position-change-reflection')!;
      const without = await app.Journal.save({ intention: 'ResolveDebt', debtId: debt.debtId, expectedDebtRevision: debt.revision, resolution: { kind: 'Answer', form: await bareForm(app) } });
      // Catches a Debt that can be settled with no reason: the answer is refused and the Debt stays Outstanding.
      expect(without.kind).toBe('Rejected');
      expect((await outstandingDebts(app)).filter((x) => x.debtId === debt.debtId)).toHaveLength(1);

      const withReason = await completeSale(app);
      if (withReason.kind !== 'Complete') throw new Error('expected Complete');
      const answered = await app.Journal.save({ intention: 'ResolveDebt', debtId: debt.debtId, expectedDebtRevision: debt.revision, resolution: { kind: 'Answer', form: withReason.form } });
      expect(answered.kind).toBe('Saved');
    }

    const closes = name === 'part' ? [] : [[CLOSE_REVIEW, undefined]];
    expect(outcomes[0]).toEqual({ kind: 'Recorded', reflection: 'Debt', owed: [['entry-type.position-change-reflection', ['PlanDepartureReason']], ...closes] });
    expect(outcomes[1]).toEqual(outcomes[0]);
  });
});

async function bareForm(app: Application) {
  const bare = await bareReflection(app);
  if (bare.kind !== 'Complete') throw new Error('expected Complete');
  return bare.form;
}

describe('I95.11 A sale never declines its reflection', () => {
  it('should refuse a declined reflection for each of the four sales and write nothing', { timeout: 120_000 }, async () => {
    const { d, app, ids } = await saleBook();
    const definition = await app.Journal.getDefinitions({ latestFor: 'entry-type.position-change-reflection' });
    if (definition.kind !== 'Found') throw new Error('no definition');
    const before = await dumpAll(d.factory);

    for (const name of ['whole', 'carried', 'quiet', 'part'] as const) {
      // Catches a decline accepted for a sale, whether or not the Plan was followed.
      const outcome = await outcomeOf(app, ids[name], name, { kind: 'Decline', definitionId: definition.definition.id });
      expect(outcome).toMatchObject({ kind: 'Rejected', issues: [expect.objectContaining({ code: 'ReflectionDeclineNotAllowed' })] });
    }
    expect(await dumpAll(d.factory)).toEqual(before);
  });
});

describe('I95.11 AC-POS-004 A closing sale requires its Close Reason', () => {
  it('should refuse a closing sale with no Close Reason, or with a Close Review answered at the sale, and write nothing', { timeout: 120_000 }, async () => {
    const { d, app, ids } = await saleBook();
    const before = await dumpAll(d.factory);
    const reflection = await bareReflection(app);
    const base = await saleOf(app, ids.whole, 'whole', reflection);
    const noReason = Object.fromEntries(Object.entries(base).filter(([key]) => key !== 'closeReasonId')) as typeof base;

    // Catches a Trade closed with no Close Reason, or a Close Review that is answered where it should be put off.
    const missing = await app.TradeWorkflows.recordPositionChange(noReason);
    expect(missing).toMatchObject({ kind: 'Rejected', issues: [expect.objectContaining({ field: 'closeReasonId', code: 'CloseReasonRequired' })] });
    const answered = await app.TradeWorkflows.recordPositionChange({ ...base, closeReview: await closeReviewDisposition(app, 'Complete') });
    expect(answered).toMatchObject({ kind: 'Rejected', issues: [expect.objectContaining({ field: 'closeReview', code: 'CloseReviewMustDefer' })] });
    expect(await dumpAll(d.factory)).toEqual(before);
  });

  it('should close the Trade with its Close Reason and leave exactly one Outstanding Close Review Debt', { timeout: 120_000 }, async () => {
    const { app, ids } = await saleBook();

    const outcome = await outcomeOf(app, ids.whole, 'whole', await bareReflection(app));

    expect(outcome).toMatchObject({ kind: 'Recorded' });
    const detail = await app.TradeViewsAndReporting.getTradeDetail({ tradeId: ids.whole });
    expect(detail.kind === 'Ready' && 'lifecycle' in detail.view && detail.view.lifecycle.stored).toBe('Closed');
    // Catches a close that owes no Close Review, or one that owes it twice.
    const closeReviews = (await outstandingDebts(app)).filter((debt) => debt.entryTypeKey === CLOSE_REVIEW);
    expect(closeReviews.map((debt) => [debt.anchor.tradeId, debt.status])).toEqual([[ids.whole, 'Outstanding']]);
  });
});

describe('I95.11 AC-JOUR-003 A buy keeps its reflection choices', () => {
  it('should let a buy put its reflection off, leaving a Debt with its form snapshot and no Entry for it', { timeout: 120_000 }, async () => {
    const { d, app, ids } = await saleBook();
    const before = await dumpAll(d.factory);
    const fill = { quantity: '10', price: '40.60', economicTime: SALE_TIME };
    const command = await positionChange(app, ids.part, [await buy(app, ids.part, fill)], { kind: 'Defer' });

    const result = await app.TradeWorkflows.recordPositionChange(command);

    if (result.kind !== 'Recorded') throw new Error(`recordPositionChange: ${JSON.stringify(result)}`);
    // Catches a buy that is refused a deferral, or one that writes a blank Entry in place of the Debt.
    expect(result.receipt.reflection.kind).toBe('Debt');
    const debts = (await outstandingDebts(app)).filter((debt) => debt.anchor.tradeId === ids.part);
    expect(debts).toHaveLength(1);
    expect(debts[0]).toMatchObject({ entryTypeKey: 'entry-type.position-change-reflection', status: 'Outstanding' });
    expect(debts[0]).not.toHaveProperty('requires');
    const entries = (stores: Awaited<ReturnType<typeof dumpAll>>) => Object.values(stores).flatMap((db) => (db['journalEntries'] ?? []) as { entryTypeKey: string }[]);
    expect(entries(await dumpAll(d.factory)).length).toBe(entries(before).length);
    // A Debt is not an incomplete Entry: the Review's completion does not count it as an Action missing.
    const opened = await openOn(app, MON_1700);
    expect(opened.completion.kind === 'Incomplete' && opened.completion.reasons.some((r) => r.code === 'ReflectionDue' && r.tradeId === ids.part)).toBe(false);
  });
});
