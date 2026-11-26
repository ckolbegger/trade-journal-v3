// I95.14 An expiration recorded through Trade Workflows (AC-SET-003): in and out of the money, the Expiration Reason rule (A321), the completed reflection and the
// terminal Close Review put off (A312). Through the real facade on fake-indexeddb. A long contract expired Friday 10-09; the Review is Monday 10-12.
import { describe, expect, it } from 'vitest';
import type { Application } from '../../../src/app/compose.ts';
import type { ReflectionDisposition } from '../../../src/modules/journal/index.ts';
import { ABC_PUT, closeReviewDisposition, device, dumpAll, expirationMember, onboarded, optionCommand, optionPlanCommand, outstandingDebts, recordOption, saveMark, XYZ_CALL } from '../d7/support.ts';
import { FRIDAY, MON_1700 } from './support.ts';

const SETTLEMENT_TIME = '2026-10-09T20:00:00Z';
const REASON = 'prompt.position-change-reflection.expiration-reason';
const CONTRACTS = {
  // A call struck at 55 on XYZ: in the money above 55.
  'O-C': { instrument: { ...XYZ_CALL, expiration: FRIDAY }, underlying: 'XYZ' },
  // A put struck at 50 on ABC: in the money below 50.
  'O-P': { instrument: { ...ABC_PUT, expiration: FRIDAY }, underlying: 'ABC' },
} as const;

interface Held {
  readonly app: Application;
  readonly d: Awaited<ReturnType<typeof device>>;
  readonly tradeId: string;
}

// One long contract bought Monday 10-05, Settlement Due at the Review; the Underlying's Friday Mark is `mark`, or missing.
async function expiredContract(kind: 'O-C' | 'O-P', mark?: string): Promise<Held> {
  const d = await device(undefined, MON_1700);
  const app = await onboarded(d);
  const { instrument, underlying } = CONTRACTS[kind];
  const base = await optionPlanCommand(app, kind, '2026-10-05T13:00:00Z');
  const confirmed = await app.TradeWorkflows.confirmPlan({ ...base, plan: { ...base.plan, legs: [{ ...base.plan.legs[0]!, instrument, quantity: '1' }] } });
  if (confirmed.kind !== 'Confirmed') throw new Error(`confirmPlan: ${JSON.stringify(confirmed)}`);
  const tradeId = confirmed.receipt.tradeId;
  await recordOption(app, tradeId, 'Buy', { quantity: '1', price: '2.10', economicTime: '2026-10-05T14:00:00Z', fee: '0.65' });
  if (mark !== undefined) await saveMark(app, underlying, FRIDAY, mark);
  return { app, d, tradeId };
}

// The reflection the expiration form sends: completed, holding only the answers given.
async function reflectionOf(app: Application, answers: Record<string, { kind: 'Text'; text: string }> = {}): Promise<ReflectionDisposition> {
  const definition = await app.Journal.getDefinitions({ latestFor: 'entry-type.position-change-reflection' });
  if (definition.kind !== 'Found') throw new Error('no Position Change Reflection definition');
  return { kind: 'Complete', form: { definitionId: definition.definition.id, answers } };
}

async function expire(held: Held, reflection: ReflectionDisposition, closeReview: ReflectionDisposition = { kind: 'Defer' }) {
  const command = await optionCommand(held.app, held.tradeId, [await expirationMember(held.app, held.tradeId, '1', SETTLEMENT_TIME)], { reflection, closeReview });
  return held.app.TradeWorkflows.recordPositionChange(command);
}

const issuesOf = (result: Awaited<ReturnType<typeof expire>>) => {
  if (result.kind !== 'Rejected') throw new Error(`expected Rejected, got ${result.kind}`);
  return result.issues.filter((issue) => issue.source === 'TradeWorkflows');
};

// The reasons saved as an Expiration Reason on the Trade's reflections.
async function savedReasonsOf(held: Held) {
  const dump = await dumpAll(held.d.factory);
  const entries = (dump[Object.keys(dump).find((n) => n.startsWith('tj-ws-'))!] as Record<string, unknown[]>)['journalEntries'] as { entryTypeKey: string; anchorTradeId: string; versions: { responses: { promptId: string; value: unknown }[] }[] }[];
  return entries
    .filter((entry) => entry.entryTypeKey === 'entry-type.position-change-reflection' && entry.anchorTradeId === held.tradeId)
    .flatMap((entry) => entry.versions.at(-1)!.responses.filter((r) => r.promptId === REASON && (r.value as { kind: string }).kind === 'Text').map((r) => r.value));
}

async function closedIds(app: Application) {
  const closed = await app.TradeViewsAndReporting.browseTrades({ lifecycle: 'Closed' });
  if (closed.kind !== 'Ready') throw new Error(`browseTrades: ${closed.kind}`);
  return closed.view.items.map((item) => item.tradeId);
}

describe('I95.14 An expiration and its Expiration Reason', () => {
  it('should record an expiration out of the money with a completed reflection holding no answers', { timeout: 120_000 }, async () => {
    const held = await expiredContract('O-C', '50.00');

    const result = await expire(held, await reflectionOf(held.app));

    // Catches an out-of-the-money expiration that asks a reason, a reflection that is put off or declined, or a Trade left Open.
    if (result.kind !== 'Recorded') throw new Error(`expected Recorded, got ${JSON.stringify(result).slice(0, 300)}`);
    expect(result.receipt.reflection.kind).toBe('Entry');
    expect(await closedIds(held.app)).toEqual([held.tradeId]);
  });

  it('should refuse an expiration in the money with no Expiration Reason, or a blank one, and write nothing', { timeout: 120_000 }, async () => {
    const held = await expiredContract('O-C', '60.00');
    const before = await dumpAll(held.d.factory);

    const none = await expire(held, await reflectionOf(held.app));
    const blank = await expire(held, await reflectionOf(held.app, { [REASON]: { kind: 'Text', text: '   ' } }));

    // Catches an in-the-money expiration recorded without the reason: the refusal names the reason's prompt.
    expect(issuesOf(none)).toEqual([{ source: 'TradeWorkflows', field: REASON, code: 'ExpirationReasonRequired' }]);
    expect(issuesOf(blank)).toEqual([{ source: 'TradeWorkflows', field: REASON, code: 'ExpirationReasonRequired' }]);
    expect(await dumpAll(held.d.factory)).toEqual(before);
    expect(await closedIds(held.app)).toEqual([]);
  });

  it('should record an expiration in the money with its reason, saved as the reflection Expiration Reason', { timeout: 120_000 }, async () => {
    const held = await expiredContract('O-C', '60.00');

    const result = await expire(held, await reflectionOf(held.app, { [REASON]: { kind: 'Text', text: 'I let the call run out; the move came too late.' } }));

    expect(result.kind).toBe('Recorded');
    expect(await savedReasonsOf(held)).toEqual([{ kind: 'Text', text: 'I let the call run out; the move came too late.' }]);
    expect(await closedIds(held.app)).toEqual([held.tradeId]);
  });

  it('should apply the rule to a put: a reason is owed in the money below the strike and none out of the money above it', { timeout: 120_000 }, async () => {
    const inside = await expiredContract('O-P', '45.00');
    const outside = await expiredContract('O-P', '55.00');

    const owed = await expire(inside, await reflectionOf(inside.app));
    const quiet = await expire(outside, await reflectionOf(outside.app));

    expect(issuesOf(owed)).toEqual([{ source: 'TradeWorkflows', field: REASON, code: 'ExpirationReasonRequired' }]);
    expect(quiet.kind).toBe('Recorded');
  });

  it('should ask no reason when the expiration session has no Underlying Mark', { timeout: 120_000 }, async () => {
    const held = await expiredContract('O-C');

    const result = await expire(held, await reflectionOf(held.app));

    expect(result.kind).toBe('Recorded');
  });

  it('should refuse Defer or Decline for the reflection, and Complete or Decline for the terminal Close Review, writing nothing', { timeout: 120_000 }, async () => {
    const held = await expiredContract('O-C', '50.00');
    const before = await dumpAll(held.d.factory);
    const reflection = await reflectionOf(held.app);
    const definitionId = reflection.kind === 'Complete' ? reflection.form.definitionId : '';

    const reflections = [await expire(held, { kind: 'Defer' }), await expire(held, { kind: 'Decline', definitionId, reason: 'Nothing to add.' })];
    const closeReviews = [await expire(held, reflection, await closeReviewDisposition(held.app, 'Complete')), await expire(held, reflection, await closeReviewDisposition(held.app, 'Decline'))];

    expect(reflections.map(issuesOf)).toEqual(Array(2).fill([{ source: 'TradeWorkflows', field: 'reflection', code: 'ReflectionMustComplete' }]));
    expect(closeReviews.map(issuesOf)).toEqual(Array(2).fill([{ source: 'TradeWorkflows', field: 'closeReview', code: 'CloseReviewMustDefer' }]));
    expect(await dumpAll(held.d.factory)).toEqual(before);
  });

  it('should leave one Outstanding Close Review Debt on the terminal expiration, with no Close Reason', { timeout: 120_000 }, async () => {
    const held = await expiredContract('O-C', '50.00');

    const result = await expire(held, await reflectionOf(held.app));

    if (result.kind !== 'Recorded') throw new Error(`expected Recorded, got ${result.kind}`);
    const owed = (await outstandingDebts(held.app)).filter((debt) => debt.entryTypeKey === 'entry-type.close-review' && debt.anchor.tradeId === held.tradeId);
    expect(owed).toHaveLength(1);
    const detail = await held.app.TradeViewsAndReporting.getTradeDetail({ tradeId: held.tradeId });
    expect(detail.kind === 'Ready' && detail.view.lifecycle).toEqual({ stored: 'Closed', agreement: { kind: 'Agrees' } });
    expect(detail.kind === 'Ready' && 'closeReason' in detail.view ? detail.view.closeReason : undefined).toBeUndefined();
  });
});
