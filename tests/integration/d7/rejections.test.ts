// I7.8: option Plans and Position Changes the application refuses write nothing, checked on the whole Workspace
// dump after each one (A100, A102, A103, A106, A107; P22 position paths).
import { describe, expect, it } from 'vitest';
import type { Application } from '../../../src/app/compose.ts';
import type { ConfirmPlanCommand, PositionChangeCommand } from '../../../src/coordinators/trade-workflows/index.ts';
import { Rational } from '../../../src/domain/values/index.ts';
import {
  closeReviewDisposition, complete, confirmOption, dumpAll, expirationMember, FRIDAY_1600, MONDAY_NEXT_1700, onboardedAt, optionCommand, optionExecution, optionPlanCommand, OS_S1, recordExpiration,
  recordOption, XYZ_CALL,
} from './support.ts';

const MONDAY_NEXT_10 = '2026-11-23T15:00:00Z';
const MONDAY_NEXT_1600 = '2026-11-23T21:00:00Z';

// Confirms the Plan and requires it to be Rejected with no write: the dump is equal before and after.
async function rejectedPlan(app: Application, d: { factory: Parameters<typeof dumpAll>[0] }, command: ConfirmPlanCommand) {
  const before = await dumpAll(d.factory);
  const result = await app.TradeWorkflows.confirmPlan(command);
  if (result.kind !== 'Rejected') throw new Error(`expected Rejected, got ${result.kind}`);
  expect(await dumpAll(d.factory)).toEqual(before);
  return result.issues;
}

// Records the command and requires it not to be accepted, with no write; returns the whole result.
async function refused(app: Application, d: { factory: Parameters<typeof dumpAll>[0] }, command: PositionChangeCommand) {
  const before = await dumpAll(d.factory);
  const result = await app.TradeWorkflows.recordPositionChange(command);
  expect(result.kind).not.toBe('Recorded');
  expect(await dumpAll(d.factory)).toEqual(before);
  return result;
}

const issuesOf = (result: Awaited<ReturnType<typeof refused>>) => {
  if (result.kind !== 'Rejected') throw new Error(`expected Rejected, got ${result.kind}`);
  return result.issues;
};

describe('I7.8 Rejections write nothing', () => {
  it('should reject an option Plan carrying each assessPlan issue with its typed code and leave the dump unchanged', async () => {
    const { d, app } = await onboardedAt(MONDAY_NEXT_1700);
    const longCall = await optionPlanCommand(app, 'O-C');
    const cashSecuredPut = await optionPlanCommand(app, 'O-S');
    const withPlan = (base: ConfirmPlanCommand, plan: Partial<ConfirmPlanCommand['plan']>): ConfirmPlanCommand => ({ ...base, plan: { ...base.plan, ...plan } });
    const leg = longCall.plan.legs[0]!;
    const withoutIntent = { ...longCall.plan, exerciseIntent: undefined };

    const cases: readonly [code: string, command: ConfirmPlanCommand][] = [
      // A Stop at 58.00 has a value of 3.00 at expiration, not below the 2.00 entry.
      ['NoPositiveRisk', withPlan(longCall, { stops: [{ kind: 'UnderlyingPrice', price: '58.00' }] })],
      // A Target at 56.00 has a value of 1.00, below the breakeven 57.00.
      ['TargetNotBeyondEntry', withPlan(longCall, { targets: [{ kind: 'UnderlyingPrice', price: '56.00' }] })],
      ['StopTargetOrder', withPlan(longCall, { stops: [{ kind: 'UnderlyingPrice', price: '61.00' }] })],
      ['ExerciseIntentNotApplicable', withPlan(cashSecuredPut, { exerciseIntent: 'NotAuthorized' })],
      ['ExerciseIntentRequired', { ...longCall, plan: withoutIntent }],
      ['StrategyShapeMismatch', withPlan(longCall, { legs: [{ ...leg, instrument: { ...XYZ_CALL, right: 'Put' } }] })],
      ['ContractQuantityNotWhole', withPlan(longCall, { legs: [{ ...leg, quantity: '1.5' }] })],
      ['ContractAlreadyExpired', withPlan(longCall, { legs: [{ ...leg, instrument: { ...XYZ_CALL, expiration: '2026-10-11' } }] })],
    ];
    for (const [code, command] of cases) {
      const issues = await rejectedPlan(app, d, command);
      expect(issues, code).toEqual(expect.arrayContaining([expect.objectContaining({ source: 'TradeAnalysis', code })]));
    }
    // The breakeven is named on the two risk issues (A100).
    const noRisk = await rejectedPlan(app, d, cases[0]![1]);
    expect(noRisk).toEqual(expect.arrayContaining([{ source: 'TradeAnalysis', code: 'NoPositiveRisk', details: { breakeven: Rational.of(57n) } }]));
  }, 60_000);

  it('should refuse a Buy 3 to close, an Execution dated 2026-11-23, an Expiration of 1 of 2, a settlement time on 2026-11-23, an Expiration on XYZ stock, an Expiration with an Execution, and a Buy after E1, each with its typed result and the dump unchanged', async () => {
    const { d, app } = await onboardedAt(MONDAY_NEXT_1700);
    const tradeId = (await confirmOption(app, 'O-S')).receipt.tradeId;
    await recordOption(app, tradeId, 'Sell', OS_S1);
    const buy = (quantity: string, economicTime: string) => optionExecution(app, tradeId, 'Buy', { quantity, price: '0.60', economicTime, fee: '0.65' });
    const close = { closeReview: await closeReviewDisposition(app, 'Complete') };

    // A Buy 3 after S1 exceeds the 2 contracts open.
    const exceeds = issuesOf(await refused(app, d, await optionCommand(app, tradeId, [await buy('3', '2026-10-13T14:00:00Z')])));
    expect(exceeds).toEqual([expect.objectContaining({ source: 'TradeAnalysis', member: 0, code: 'ExceedsOpenQuantity', available: Rational.of(2n) })]);

    // An Execution dated after the contract's expiration.
    const late = issuesOf(await refused(app, d, await optionCommand(app, tradeId, [await buy('1', MONDAY_NEXT_10)])));
    expect(late).toEqual([{ source: 'TradeAnalysis', member: 0, field: 'economicTime', code: 'AfterExpiration' }]);

    // An Expiration of 1 of the 2 contracts open.
    const partial = issuesOf(await refused(app, d, await optionCommand(app, tradeId, [await expirationMember(app, tradeId, '1', FRIDAY_1600)], close)));
    expect(partial).toEqual([expect.objectContaining({ source: 'TradeAnalysis', member: 0, field: 'quantity', code: 'ExpirationMustSettleAllOpen', available: Rational.of(2n) })]);

    // A settlement time on 2026-11-23, after the expiration session.
    const wrongTime = issuesOf(await refused(app, d, await optionCommand(app, tradeId, [await expirationMember(app, tradeId, '2', MONDAY_NEXT_1600)], close)));
    expect(wrongTime).toEqual([expect.objectContaining({ source: 'TradeAnalysis', member: 0, code: 'SettlementTimeInvalid' })]);

    // An Expiration naming XYZ stock rather than an option contract.
    const stock = await expirationMember(app, tradeId, '2', FRIDAY_1600);
    const notOption = issuesOf(await refused(app, d, await optionCommand(app, tradeId, [{ ...stock, instrument: { kind: 'Stock', symbol: 'XYZ' } }], close)));
    expect(notOption).toEqual([expect.objectContaining({ source: 'TradeAnalysis', member: 0, code: 'NotAnOption' })]);

    // An Expiration and an Execution in one Position Change is not an installed variant.
    const mixed = await refused(app, d, await optionCommand(app, tradeId, [await buy('1', '2026-10-13T14:00:00Z'), await expirationMember(app, tradeId, '1', FRIDAY_1600)], close));
    expect(mixed).toEqual({ kind: 'VariantNotInstalled', variants: ['MixedMembers'] });

    // After E-S closes the Trade, a Buy is refused with TradeClosed.
    await recordExpiration(app, tradeId, '2', FRIDAY_1600, { reflection: await complete(app), closeReview: await closeReviewDisposition(app, 'Complete') });
    const closed = issuesOf(await refused(app, d, await optionCommand(app, tradeId, [await buy('1', '2026-10-13T14:00:00Z')])));
    expect(closed).toEqual([expect.objectContaining({ code: 'TradeClosed' })]);
  }, 60_000);
});
