// I2.7: rejected Position Changes write nothing (AC-JOUR-005 retries included).
import { describe, expect, it } from 'vitest';
import {
  buy,
  complete,
  confirmReference,
  device,
  dumpAll,
  NOW,
  onboarded,
  PC1,
  positionChange,
  PLAN_TIME,
  reflectionDefinitionId,
} from './support.ts';

const anHour = (instant: string, sign: 1 | -1) => new Date(Date.parse(instant) + sign * 3_600_000).toISOString();

describe('I2.7 rejections write nothing', () => {
  it('should reject the invalid members and blank answers together, a Sell as VariantNotInstalled, and a repeat as Conflict, with the stores unchanged except for the one accepted submission', async () => {
    const d = await device();
    const app = await onboarded(d);
    const tradeId = await confirmReference(app);
    const before = await dumpAll(d.factory);

    // Before the Plan time, in the future, quantity 0, and every required answer blank, in one command.
    const invalid = await positionChange(
      app,
      tradeId,
      [
        await buy(app, tradeId, { ...PC1, economicTime: anHour(PLAN_TIME, -1) }),
        await buy(app, tradeId, { ...PC1, economicTime: anHour(NOW, 1) }),
        await buy(app, tradeId, { ...PC1, quantity: '0' }),
      ],
      { kind: 'Complete', form: { definitionId: await reflectionDefinitionId(app), answers: {} } },
    );
    const rejected = await app.TradeWorkflows.recordPositionChange(invalid);
    expect(rejected.kind).toBe('Rejected');
    const issues = rejected.kind === 'Rejected' ? rejected.issues : [];
    expect(issues).toEqual(
      expect.arrayContaining([
        { source: 'TradeWorkflows', member: 0, field: 'economicTime', code: 'EconomicTimeBeforePlan' },
        { source: 'TradeWorkflows', member: 1, field: 'economicTime', code: 'EconomicTimeInFuture' },
        expect.objectContaining({ source: 'TradeWorkflows', member: 2, field: 'quantity' }),
        expect.objectContaining({ source: 'Journal', field: 'prompt.position-change-reflection.decision-mode' }),
        expect.objectContaining({ source: 'Journal', field: 'prompt.position-change-reflection.primary-emotion' }),
        expect.objectContaining({ source: 'Journal', field: 'prompt.position-change-reflection.decision-confidence' }),
      ]),
    );
    expect(issues).toHaveLength(6);
    expect(await dumpAll(d.factory)).toEqual(before);

    // A Sell is outside D2's installed variant (A18).
    const sell = await positionChange(app, tradeId, [{ ...(await buy(app, tradeId, PC1)), action: 'Sell' }], await complete(app));
    expect(await app.TradeWorkflows.recordPositionChange(sell)).toEqual({ kind: 'VariantNotInstalled', variants: ['Sell'] });
    expect(await dumpAll(d.factory)).toEqual(before);

    // The same valid command twice: the first is accepted, the repeat carries a stale FactRevision.
    const valid = await positionChange(app, tradeId, [await buy(app, tradeId, PC1)], await complete(app));
    expect((await app.TradeWorkflows.recordPositionChange(valid)).kind).toBe('Recorded');
    const accepted = await dumpAll(d.factory);
    expect(accepted).not.toEqual(before);
    expect(await app.TradeWorkflows.recordPositionChange(valid)).toEqual(expect.objectContaining({ kind: 'Conflict' }));
    expect(await dumpAll(d.factory)).toEqual(accepted);
  });
});
