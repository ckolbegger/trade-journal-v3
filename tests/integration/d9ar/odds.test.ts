// I9AR.2 The odds, and the card agrees with the replay (AC-CALC-003, cumulative): R-DALE-D to Wed 11-11 and R-BREN-U to Mon 11-16 through
// replayTrade, and the Review's getTrade for the same date. Section 5's table: each session's odds and whole percents.
import { describe, expect, it } from 'vitest';
import type { Application } from '../../../src/app/compose.ts';
import { R_BREN_U, R_DALE_D } from '../../../src/domain/trade-analysis/option-trade.ts';
import { R_AXIO_D } from '../../../src/domain/trade-analysis/reference-trade.ts';
import { Rational } from '../../../src/domain/values/index.ts';
import type { ReplaySession } from '../../../src/coordinators/trade-views/index.ts';
import { dollars as q, frac, MON_1116_1700, oddsText, readyReplay, seriesApp, sessionOf, WED_1111_1700 } from './support.ts';

const odds = (s: ReplaySession) => oddsText(s.figures?.rewardRiskOdds);

// The Review for the day, then the card of the Trade, as the screen reads them.
async function card(app: Application, tradeId: string, asOf: string) {
  const opened = await app.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf });
  if (opened.kind !== 'Ready') throw new Error(`DailyReview.open: ${opened.kind}`);
  const result = await app.DailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId, binding: opened.binding });
  if (result.kind !== 'Ready' || !result.trade.replay) throw new Error(`DailyReview.getTrade: ${result.kind}`);
  if (!result.trade.evaluation) throw new Error('no evaluation on the card');
  return { reviewDate: opened.reviewDate, trade: result.trade, evaluation: result.trade.evaluation };
}

describe('I9AR.2 The odds', () => {
  it('I9AR.2 should give each session its odds and whole percents, none past the Stop, the Plan odds on every session, the extremes weight, and the card the replay odds', { timeout: 300_000 }, async () => {
    const dale = await seriesApp(R_DALE_D, 'strategy.cash-secured-put', WED_1111_1700, { marksThrough: 7 });
    const bren = await seriesApp(R_BREN_U, 'strategy.long-call', MON_1116_1700, { marksThrough: 10 });
    const axio = await seriesApp(R_AXIO_D, 'strategy.long-stock', MON_1116_1700, { marksThrough: 10 });

    const daleView = await readyReplay(dale.app, dale.tradeId);
    const brenView = await readyReplay(bren.app, bren.tradeId);
    const axioView = await readyReplay(axio.app, axio.tradeId);

    // Section 5's table: R-DALE-D Wed 11-11 $78 at risk and $912 to gain, 78/990, 8 : 92; R-BREN-U Mon 11-02 352/1,280, 28 : 72, and Wed 11-11 66 : 34.
    expect(odds(sessionOf(daleView, '2026-11-11'))).toBe(`${q(78n, 990n)} ${q(912n, 990n)} ${q(8n)}:${q(92n)}`);
    expect(odds(sessionOf(brenView, '2026-11-02'))).toBe(`${q(352n, 1280n)} ${q(928n, 1280n)} ${q(28n)}:${q(72n)}`);
    expect(odds(sessionOf(brenView, '2026-11-11'))).toBe(`${q(844n, 1280n)} ${q(436n, 1280n)} ${q(66n)}:${q(34n)}`);
    // Every pair of whole percents adds to 100.
    for (const s of [...daleView.sessions, ...brenView.sessions]) {
      const r = s.figures?.rewardRiskOdds;
      if (r?.kind === 'Value') expect(r.value.percent.targetFirst.add(r.value.percent.stopFirst).compare(Rational.of(100n))).toBe(0);
    }
    // Not applicable past the Stop: R-AXIO-D on Mon 11-16 ($44.00) is $300 past it.
    expect(odds(sessionOf(axioView, '2026-11-16'))).toMatch(/^NotApplicable:/);
    expect(odds(sessionOf(axioView, '2026-11-16'))).not.toContain('/');

    // The Plan's odds on every session: BREN 324/1,280 (25 : 75), DALE 1,536/1,980 (78 : 22).
    const planOdds = (view: typeof brenView) => {
      const o = view.planColumn?.odds;
      if (!o) throw new Error('no Plan odds');
      return `${frac(o.targetFirst)} ${frac(o.stopFirst)} ${frac(o.percent.targetFirst)}:${frac(o.percent.stopFirst)}`;
    };
    expect(planOdds(brenView)).toBe(`${q(324n, 1280n)} ${q(956n, 1280n)} ${q(25n)}:${q(75n)}`);
    expect(planOdds(daleView)).toBe(`${q(1536n, 1980n)} ${q(444n, 1980n)} ${q(78n)}:${q(22n)}`);

    // The extremes' weight: Main for the Cash-Secured Put, Remote for a long option.
    expect(daleView.sessions.every((s) => s.figures?.extremes === 'Main')).toBe(true);
    expect(brenView.sessions.every((s) => s.figures?.extremes === 'Remote')).toBe(true);

    // The card's evaluation holds the same odds as the replay's Review Date session.
    const daleCard = await card(dale.app, dale.tradeId, WED_1111_1700);
    expect(daleCard.reviewDate).toBe('2026-11-11');
    const lastDale = daleCard.trade.replay!.sessions.at(-1)!;
    expect(lastDale.date).toBe('2026-11-11');
    expect(oddsText(daleCard.evaluation.rewardRiskOdds)).toBe(odds(lastDale));
    expect(oddsText(daleCard.evaluation.rewardRiskOdds)).toBe(odds(sessionOf(daleView, '2026-11-11')));
    expect(daleCard.evaluation.extremes).toBe('Main');
    const brenCard = await card(bren.app, bren.tradeId, MON_1116_1700);
    const lastBren = brenCard.trade.replay!.sessions.at(-1)!;
    expect(lastBren.date).toBe(brenCard.reviewDate);
    expect(oddsText(brenCard.evaluation.rewardRiskOdds)).toBe(odds(lastBren));
    expect(oddsText(brenCard.evaluation.planOdds)).toBe(planOdds(brenView));
    expect(brenCard.evaluation.extremes).toBe('Remote');
  });
});
