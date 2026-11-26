import { describe, expect, it } from 'vitest';
import { Rational } from '../../domain/values/index.ts';
import { instrumentKey, type OptionInstrument } from '../../domain/instrument/index.ts';
import { D7_CATALOG_MANIFEST, type StrategyRecord } from '../../modules/reference-catalog/index.ts';
import { reviewStack, type ReviewStack } from '../../../tests/support/review-fixture.ts';
import type { ConfirmPlanCommand, PositionChangeMember } from '../trade-workflows/index.ts';
import type { OpenDailyReviewResult } from './index.ts';

// T95.49: a Trade with Settlement Due owes no Action; Settle Later finishes one Review only (A315, A316).
// New York is on standard time after 2026-11-01: Friday 11-20 17:00 is 22:00Z.
const FRIDAY_1700 = '2026-11-20T22:00:00Z';
const MONDAY_1700 = '2026-11-23T22:00:00Z';
const FRIDAY = '2026-11-20';
const FRIDAY_CLOSE = '2026-11-20T21:00:00Z';
const OC_PLAN = '2026-10-12T13:00:00Z';
const OC_10 = '2026-10-12T14:00:00Z';
const WEEK_PLAN = '2026-11-16T14:00:00Z';
const WEEK_10 = '2026-11-16T15:00:00Z';

const MNO_PUT_FRIDAY = { kind: 'Option', symbol: 'MNO', root: 'MNO', expiration: '2026-11-20', right: 'Put', strike: '45', multiplier: 100 } as const satisfies OptionInstrument;
const KLM = { kind: 'Stock', symbol: 'KLM' } as const;

// A short put that expires Friday (Settlement Due) and a stock Trade that does not.
async function expiryFixture(now: string, options: { readonly klmMark?: boolean; readonly expiration?: string; readonly mnoMark?: boolean } = {}) {
  const MNO_PUT: OptionInstrument = { ...MNO_PUT_FRIDAY, expiration: options.expiration ?? MNO_PUT_FRIDAY.expiration };
  const stack = await reviewStack(now);
  await stack.catalog.seedDefaults(D7_CATALOG_MANIFEST);
  const planReflection = {
    definitionId: stack.definition.id,
    answers: { 'prompt.plan-reflection.thesis': { kind: 'Text', text: 'The setup is worth the risk.' }, 'prompt.plan-reflection.invalidation': { kind: 'Text', text: 'A close beyond the stop.' } },
  } as const;
  const confirm = async (productKey: string, economicTime: string, plan: ConfirmPlanCommand['plan']) => {
    const strategies = await stack.catalog.query({ family: 'Strategy' });
    if (strategies.kind !== 'Page') throw new Error('no strategies');
    const strategy = strategies.items.find((s): s is StrategyRecord => s.kind === 'Strategy' && s.productKey === productKey);
    if (!strategy) throw new Error(`no ${productKey}`);
    const confirmed = await stack.tradeWorkflows.confirmPlan({ accountId: stack.account.id, accountRevision: stack.account.recordRevision, strategyId: strategy.id, strategyRevision: strategy.recordRevision, economicTime, plan, reflection: planReflection });
    if (confirmed.kind !== 'Confirmed') throw new Error(`expected Confirmed, got ${confirmed.kind}`);
    return confirmed.postCommit.trade.tradeId;
  };
  const record = async (tradeId: string, member: (legId: string) => PositionChangeMember) => {
    const current = await stack.tradeRecord.getRecord({ tradeId, projection: 'AnalysisInput' });
    if (current.kind !== 'Found') throw new Error('no Trade');
    const leg = (current.projection as unknown as { plan: { legs: { factId: string }[] } }).plan.legs[0]!;
    const result = await stack.tradeWorkflows.recordPositionChange({ originTradeId: tradeId, trades: [{ tradeId, expectedFactRevision: current.factRevision }], members: [member(leg.factId)], reflection: stack.reflection });
    if (result.kind !== 'Recorded') throw new Error(`expected Recorded, got ${JSON.stringify(result)}`);
  };
  const mno = await confirm('strategy.cash-secured-put', OC_PLAN, { underlying: 'MNO', legs: [{ side: 'Short', instrument: MNO_PUT, quantity: '-2', intendedEntry: '1.20' }], stops: [{ kind: 'UnderlyingPrice', price: '42.00' }], targets: [{ kind: 'UnderlyingPrice', price: '50.00' }] });
  await record(mno, (legId) => ({ kind: 'Execution', tradeId: mno, action: 'Sell', instrument: MNO_PUT, intent: { kind: 'ServesPlannedLeg', plannedLegId: legId }, quantity: '2', price: '1.25', fee: '1.30', economicTime: OC_10 }));
  const klm = await confirm('strategy.long-stock', WEEK_PLAN, { underlying: 'KLM', legs: [{ side: 'Long', instrument: KLM, quantity: '100', intendedEntry: '20.00' }], stops: [{ kind: 'UnderlyingPrice', price: '19.00' }], targets: [{ kind: 'UnderlyingPrice', price: '25.00' }] });
  await record(klm, (legId) => ({ kind: 'Execution', tradeId: klm, action: 'Buy', instrument: KLM, intent: { kind: 'ServesPlannedLeg', plannedLegId: legId }, quantity: '100', price: '20.00', fee: '1.00', economicTime: WEEK_10 }));
  await stack.saveMark(instrumentKey(MNO_PUT), '0.00', FRIDAY);
  if (options.mnoMark !== false) await stack.saveMark('MNO', '46.00', FRIDAY);
  if (options.klmMark !== false) await stack.saveMark('KLM', '20.50', FRIDAY);
  return { stack, mno, klm };
}

const open = (stack: ReviewStack, asOf: string) => stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf });

function ready(result: OpenDailyReviewResult) {
  if (result.kind !== 'Ready') throw new Error(`expected Ready, got ${result.kind}`);
  return result;
}

async function cardOf(stack: ReviewStack, asOf: string, tradeId: string) {
  const review = ready(await open(stack, asOf));
  const card = await stack.dailyReview.getTrade({ reviewDate: review.reviewDate, tradeId, binding: review.binding });
  if (card.kind !== 'Ready') throw new Error(`expected Ready, got ${card.kind}`);
  return card.trade;
}

describe('a Trade with Settlement Due owes no Action (A315, A316)', () => {
  it('should stay Incomplete with Settlement Due and neither an outcome nor a Settle Later', async () => {
    const { stack, mno } = await expiryFixture(FRIDAY_1700);

    const { completion } = ready(await open(stack, FRIDAY_1700));

    if (completion.kind !== 'Incomplete') throw new Error(`expected Incomplete, got ${completion.kind}`);
    expect(completion.reasons.filter((reason) => reason.code === 'SettlementDue').map((reason) => reason.tradeId)).toEqual([mno]);
  }, 60_000);

  it('should owe no Action for a Trade with Settlement Due', async () => {
    const { stack, mno, klm } = await expiryFixture(FRIDAY_1700);

    const { completion } = ready(await open(stack, FRIDAY_1700));

    if (completion.kind !== 'Incomplete') throw new Error(`expected Incomplete, got ${completion.kind}`);
    expect(completion.reasons.filter((reason) => reason.code === 'ActionMissing').map((reason) => reason.tradeId)).toEqual([klm]);
    const card = await stack.dailyReview.getTrade({ reviewDate: FRIDAY, tradeId: mno, binding: ready(await open(stack, FRIDAY_1700)).binding });
    if (card.kind !== 'Ready') throw new Error(`expected Ready, got ${card.kind}`);
    expect(card.trade.progress.panels.find((panel) => panel.panel === 'Action')).toEqual({ panel: 'Action', done: true, owed: false });
  }, 60_000);

  it('should refuse Hold, Exit, Roll and Adjust for that Trade with ActionNotOwed', async () => {
    const { stack, mno } = await expiryFixture(FRIDAY_1700);
    const { saveBinding } = await cardOf(stack, FRIDAY_1700, mno);

    const results = [];
    for (const action of ['Hold', 'Exit', 'Roll', 'Adjust'] as const) {
      results.push(await stack.dailyReview.save({ kind: 'SaveTradeAction', binding: saveBinding, action, intent: 'Because the plan changed.' }));
    }

    expect(results).toEqual(Array(4).fill({ kind: 'Rejected', issues: [{ code: 'ActionNotOwed' }] }));
  }, 60_000);

  it('should save Settle Later as that dates Daily Trade Review Entry with the protected option, and change no Trade fact', async () => {
    const { stack, mno } = await expiryFixture(FRIDAY_1700);
    const { saveBinding } = await cardOf(stack, FRIDAY_1700, mno);
    const before = await stack.tradeRecord.getRecord({ tradeId: mno, projection: 'AnalysisInput' });

    const saved = await stack.dailyReview.save({ kind: 'SettleLater', binding: saveBinding });

    if (saved.kind !== 'Saved') throw new Error(`expected Saved, got ${JSON.stringify(saved)}`);
    expect(saved.action).toEqual(expect.objectContaining({ action: 'Settle Later', reviewDate: FRIDAY }));
    const day = await stack.journal.queryActions({ reviewDate: FRIDAY });
    expect(Object.keys(day.actions)).toEqual([mno]);
    expect(day.actions[mno]).toEqual(expect.objectContaining({ action: 'Settle Later', reviewDate: FRIDAY }));
    // The protected option holds no Intent or other answer.
    expect(day.actions[mno]!.responses.filter(({ answer }) => answer.kind !== 'Unanswered')).toEqual([{ prompt: 'Action', answer: { kind: 'Option', label: 'Settle Later' } }]);
    expect(await stack.tradeRecord.getRecord({ tradeId: mno, projection: 'AnalysisInput' })).toEqual(before);
  }, 60_000);

  it('should refuse Settle Later for a Trade with no Settlement Due with SettleLaterNotApplicable', async () => {
    const { stack, klm } = await expiryFixture(FRIDAY_1700);
    const { saveBinding } = await cardOf(stack, FRIDAY_1700, klm);

    const refused = await stack.dailyReview.save({ kind: 'SettleLater', binding: saveBinding });

    expect(refused).toEqual({ kind: 'Rejected', issues: [{ code: 'SettleLaterNotApplicable' }] });
    expect((await stack.journal.queryActions({ reviewDate: FRIDAY })).actions).toEqual({});
  }, 60_000);

  it('should report CompleteWithSettlementToRecord naming the Trade when everything else is resolved', async () => {
    const { stack, mno, klm } = await expiryFixture(FRIDAY_1700);
    const held = await stack.dailyReview.save({ kind: 'SaveTradeAction', binding: (await cardOf(stack, FRIDAY_1700, klm)).saveBinding, action: 'Hold', intent: 'Nothing has changed.' });
    if (held.kind !== 'Saved') throw new Error(`expected Saved, got ${JSON.stringify(held)}`);

    const settled = await stack.dailyReview.save({ kind: 'SettleLater', binding: (await cardOf(stack, FRIDAY_1700, mno)).saveBinding });

    if (settled.kind !== 'Saved' || settled.review.kind !== 'Ready') throw new Error(`expected a Ready Review, got ${JSON.stringify(settled)}`);
    expect(settled.review.completion).toEqual({ kind: 'CompleteWithSettlementToRecord', trades: [mno] });
    const reopened = ready(await open(stack, FRIDAY_1700));
    expect(reopened.completion).toEqual({ kind: 'CompleteWithSettlementToRecord', trades: [mno] });
    // The day's count agrees with the reasons: nothing is left to go.
    expect(reopened.day?.toGo.expirations).toBe(0);
    expect(reopened.day?.lines.find((line) => line.tradeId === mno)?.needs).toEqual([]);
  }, 60_000);

  it('should carry the Unavailable disclosure as well when both apply', async () => {
    const { stack, mno, klm } = await expiryFixture(FRIDAY_1700, { klmMark: false });
    await stack.acknowledge('KLM', FRIDAY);
    const held = await stack.dailyReview.save({ kind: 'SaveTradeAction', binding: (await cardOf(stack, FRIDAY_1700, klm)).saveBinding, action: 'Hold', intent: 'Nothing has changed.' });
    if (held.kind !== 'Saved') throw new Error(`expected Saved, got ${JSON.stringify(held)}`);

    const settled = await stack.dailyReview.save({ kind: 'SettleLater', binding: (await cardOf(stack, FRIDAY_1700, mno)).saveBinding });

    if (settled.kind !== 'Saved' || settled.review.kind !== 'Ready') throw new Error(`expected a Ready Review, got ${JSON.stringify(settled)}`);
    expect(settled.review.completion).toEqual({ kind: 'CompleteWithSettlementToRecord', trades: [mno], unavailable: { instruments: [KLM], trades: [klm], families: expect.any(Array) as unknown } });
  }, 60_000);

  it('should report Settlement Due again, and Incomplete, on the next Review Date', async () => {
    const { stack, mno } = await expiryFixture(FRIDAY_1700);
    const settled = await stack.dailyReview.save({ kind: 'SettleLater', binding: (await cardOf(stack, FRIDAY_1700, mno)).saveBinding });
    if (settled.kind !== 'Saved') throw new Error(`expected Saved, got ${JSON.stringify(settled)}`);
    stack.clock.now = () => MONDAY_1700;

    const monday = ready(await open(stack, MONDAY_1700));

    expect(monday.reviewDate).toBe('2026-11-23');
    if (monday.completion.kind !== 'Incomplete') throw new Error(`expected Incomplete, got ${monday.completion.kind}`);
    expect(monday.completion.reasons.filter((reason) => reason.code === 'SettlementDue').map((reason) => reason.tradeId)).toEqual([mno]);
    expect(monday.completion.reasons.filter((reason) => reason.code === 'ActionMissing').map((reason) => reason.tradeId)).not.toContain(mno);
    expect(monday.day?.toGo.expirations).toBe(1);
  }, 60_000);

  it('should report Complete once the outcome is recorded, keeping the Settle Later entry', async () => {
    const { stack, mno, klm } = await expiryFixture(FRIDAY_1700);
    const held = await stack.dailyReview.save({ kind: 'SaveTradeAction', binding: (await cardOf(stack, FRIDAY_1700, klm)).saveBinding, action: 'Hold', intent: 'Nothing has changed.' });
    const settled = await stack.dailyReview.save({ kind: 'SettleLater', binding: (await cardOf(stack, FRIDAY_1700, mno)).saveBinding });
    if (held.kind !== 'Saved' || settled.kind !== 'Saved') throw new Error('expected both Actions Saved');
    const current = await stack.tradeRecord.getRecord({ tradeId: mno, projection: 'AnalysisInput' });
    if (current.kind !== 'Found') throw new Error('no Trade');

    const recorded = await stack.tradeWorkflows.recordPositionChange({
      originTradeId: mno,
      trades: [{ tradeId: mno, expectedFactRevision: current.factRevision }],
      members: [{ kind: 'Expiration', tradeId: mno, instrument: MNO_PUT_FRIDAY, quantity: '2', economicTime: FRIDAY_CLOSE }],
      reflection: stack.expirationReflection,
      closeReview: { kind: 'Defer' },
    });
    if (recorded.kind !== 'Recorded') throw new Error(`expected Recorded, got ${JSON.stringify(recorded)}`);
    const closeReview = await stack.journal.getDefinitions({ latestFor: 'entry-type.close-review' });
    if (closeReview.kind !== 'Found') throw new Error('no Close Review definition');
    await stack.resolveCloseReview(mno, { kind: 'Decline', definitionId: closeReview.definition.id });

    expect(ready(await open(stack, FRIDAY_1700)).completion).toEqual({ kind: 'Complete' });
    expect((await stack.journal.queryActions({ reviewDate: FRIDAY })).actions[mno]).toEqual(expect.objectContaining({ action: 'Settle Later' }));
  }, 60_000);

  it('should carry the contracts standing and the date of an earlier Settle Later on the card', async () => {
    const { stack, mno, klm } = await expiryFixture(FRIDAY_1700);
    const friday = await cardOf(stack, FRIDAY_1700, mno);
    const settled = await stack.dailyReview.save({ kind: 'SettleLater', binding: friday.saveBinding });
    if (settled.kind !== 'Saved') throw new Error(`expected Saved, got ${JSON.stringify(settled)}`);
    stack.clock.now = () => MONDAY_1700;

    const monday = await cardOf(stack, MONDAY_1700, mno);

    // MNO finished Friday at 46 against a 45 strike: a put out of the money by 1 a share, worth nothing.
    expect(monday.expirationStanding).toEqual({ kind: 'Value', value: expect.objectContaining({ underlyingPrice: Rational.of(46n), strike: Rational.of(45n), inTheMoney: false, amount: Rational.of(1n), worth: Rational.of(0n) }) as unknown });
    expect(monday.settledLaterOn).toBe(FRIDAY);
    expect(friday.settledLaterOn).toBeUndefined();
    // The expiration day's own card reads the same finish from that session's Mark.
    expect(friday.expirationStanding).toEqual(monday.expirationStanding);
    expect((await cardOf(stack, MONDAY_1700, klm)).expirationStanding).toBeUndefined();
  }, 60_000);

  it('should give each Settlement Due Trade in open its standing and Settle Later date, equal to its card', async () => {
    const { stack, mno, klm } = await expiryFixture(FRIDAY_1700);
    const friday = await cardOf(stack, FRIDAY_1700, mno);
    const settled = await stack.dailyReview.save({ kind: 'SettleLater', binding: friday.saveBinding });
    if (settled.kind !== 'Saved') throw new Error(`expected Saved, got ${JSON.stringify(settled)}`);
    stack.clock.now = () => MONDAY_1700;

    const walked = (await open(stack, MONDAY_1700)).kind === 'Ready' ? ready(await open(stack, MONDAY_1700)).families.flatMap((f) => (f.family === 'Trades' ? f.trades : [])) : [];
    const card = await cardOf(stack, MONDAY_1700, mno);

    const due = walked.find((t) => t.tradeId === mno);
    expect(due?.expirationStanding).toEqual(card.expirationStanding);
    expect(due?.expirationStanding).toEqual({ kind: 'Value', value: expect.objectContaining({ underlyingPrice: Rational.of(46n), strike: Rational.of(45n), inTheMoney: false }) as unknown });
    expect(due?.settledLaterOn).toBe(FRIDAY);
    const other = walked.find((t) => t.tradeId === klm);
    expect(other?.expirationStanding).toBeUndefined();
    expect(other?.settledLaterOn).toBeUndefined();
  }, 60_000);

  it('should give the standing at the session that settles an expiration on a weekend', async () => {
    const { stack, mno } = await expiryFixture(MONDAY_1700, { expiration: '2026-11-21' });

    const card = await cardOf(stack, MONDAY_1700, mno);

    // Saturday has no session: the contract finished at Friday's Mark of 46.
    expect(card.expirationStanding).toEqual({ kind: 'Value', value: expect.objectContaining({ underlyingPrice: Rational.of(46n), strike: Rational.of(45n), inTheMoney: false }) as unknown });
  }, 60_000);

  it('should stay Unavailable when the session that settles a weekend expiration has no Underlying Mark', async () => {
    const { stack, mno } = await expiryFixture(MONDAY_1700, { expiration: '2026-11-21', mnoMark: false });

    const card = await cardOf(stack, MONDAY_1700, mno);

    expect(card.expirationStanding).toEqual(expect.objectContaining({ kind: 'Unavailable', reason: 'MarkMissing' }));
  }, 60_000);
});
