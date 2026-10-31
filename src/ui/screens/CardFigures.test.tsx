// @vitest-environment jsdom
import { cleanup, render, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { DailyTradeReview } from '../../app/types.ts';
import { Rational } from '../../domain/values/index.ts';
import { CardFigures } from './CardFigures.tsx';

afterEach(cleanup);

type Evaluation = NonNullable<DailyTradeReview['evaluation']>;

const value = (n: bigint, d = 1n) => ({ kind: 'Value' as const, value: Rational.of(n, d) });
const symbol = { kind: 'Stock' as const, symbol: 'XYZ' };
const missing = (name: string, date: string) => ({ kind: 'Unavailable' as const, reason: 'MarkMissing', detail: { instrument: { kind: 'Stock' as const, symbol: name }, date } });
const planBaseline = { kind: 'Value' as const, value: { originalPlannedRisk: Rational.of(250n), originalPlannedReward: Rational.of(600n), rewardRiskRatio: Rational.of(12n, 5n), oneR: Rational.of(250n) } };

// T-A at XYZ 52.00: P&L +$180.00, risk to stop $450.00, worst case $5,200.00, reward to target $400.00.
function evaluation(over: Record<string, unknown> = {}): Evaluation {
  return {
    kind: 'Evaluated',
    valuationDate: '2026-10-12',
    observation: { instrument: symbol, tradingDate: '2026-10-12', mark: { revisionId: 'r1', revisionNumber: 1, price: '52.00' } },
    currentMarkedPnl: value(180n),
    currentMarkedPnlInPlanR: value(18n, 25n),
    ongoingRiskToStop: value(450n),
    ongoingRiskToStopInPlanR: value(9n, 5n),
    worstCaseOngoingRisk: value(5200n),
    worstCaseOngoingRiskInPlanR: value(104n, 5n),
    incrementalRewardToTarget: value(400n),
    incrementalRewardToTargetInPlanR: value(8n, 5n),
    rewardRiskNow: value(40n, 45n),
    planBaseline,
    atEntry: { label: 'AtEntry', quantity: Rational.of(100n), averageEntry: Rational.of(50n), riskFromEntry: Rational.of(500n), rewardFromEntry: Rational.of(300n) },
    ...over,
  } as unknown as Evaluation;
}
function trade(over: Partial<DailyTradeReview> = {}): DailyTradeReview {
  return { tradeId: 't1', underlying: 'XYZ', evaluation: evaluation(), ...over } as unknown as DailyTradeReview;
}
const figure = (scope: HTMLElement, term: string) => within(scope).getAllByText(term)[0]?.nextElementSibling?.textContent;

describe('figures (A158)', () => {
  it('should show Current P&L, Risk to stop, Worst case, and Reward to target, each in dollars and R, then Reward : risk now 0.89 and planned 2.4, then At entry, for T-A at XYZ 52.00', () => {
    const { container: root } = render(<CardFigures trade={trade()} />);
    expect(figure(root, 'Current Marked Trade P&L')).toBe('+$180.00 · +0.72R');
    expect(figure(root, 'Ongoing Risk to Stop')).toBe('$450.00 · 1.80R');
    expect(figure(root, 'Worst-Case Ongoing Risk')).toBe('$5,200.00 · 20.80R');
    expect(figure(root, 'Incremental Reward to Target')).toBe('$400.00 · 1.60R');
    expect(figure(root, 'Reward : risk now')).toBe('0.89');
    expect(figure(root, 'Reward : risk planned')).toBe('2.4');
    const terms = [...root.querySelectorAll('dt')].map((dt) => dt.textContent);
    expect(terms).toEqual(['Current Marked Trade P&L', 'Ongoing Risk to Stop', 'Worst-Case Ongoing Risk', 'Incremental Reward to Target', 'Reward : risk now', 'Reward : risk planned', 'Risk to stop', 'Reward to target']);
    expect(within(root).getByRole('group', { name: 'At entry' })).toBeTruthy();
  });

  it('should show each figure that is not a Value in words, never as 0: T-C Mark missing: DEF, Oct 12, T-B Reward : risk Not applicable', () => {
    const gone = missing('DEF', '2026-10-12');
    const { container: root } = render(<CardFigures trade={trade({ evaluation: evaluation({ currentMarkedPnl: gone, currentMarkedPnlInPlanR: gone, ongoingRiskToStop: gone, ongoingRiskToStopInPlanR: gone, worstCaseOngoingRisk: gone, worstCaseOngoingRiskInPlanR: gone, incrementalRewardToTarget: gone, incrementalRewardToTargetInPlanR: gone, rewardRiskNow: gone, atEntry: null }) })} />);
    for (const term of ['Current Marked Trade P&L', 'Ongoing Risk to Stop', 'Worst-Case Ongoing Risk', 'Incremental Reward to Target', 'Reward : risk now']) expect(figure(root, term)).toBe('Mark missing: DEF, Mon Oct 12');
    expect(figure(root, 'Reward : risk planned')).toBe('2.4');
    expect(root.textContent).not.toMatch(/\$0\.00|(^|\s)0(\s|$)/);
    cleanup();

    const b = render(<CardFigures trade={trade({ evaluation: evaluation({ rewardRiskNow: { kind: 'NotApplicable' } }) })} />);
    expect(figure(b.container,'Reward : risk now')).toBe('Not applicable');
  });

  it('should keep the dated last-close group beside the figures when the Review-date Mark is missing', () => {
    const gone = missing('XYZ', '2026-10-12');
    const dated = evaluation({ currentMarkedPnl: value(-50n), currentMarkedPnlInPlanR: value(-1n, 5n) });
    const { container: root } = render(<CardFigures trade={trade({ evaluation: evaluation({ currentMarkedPnl: gone, currentMarkedPnlInPlanR: gone, observation: { instrument: symbol, tradingDate: '2026-10-12', mark: null } }), datedLastClose: { tradingDate: '2026-10-09', evaluation: dated } })} />);
    expect(figure(root, 'Current Marked Trade P&L')).toBe('Mark missing: XYZ, Mon Oct 12');
    const group = within(root).getByRole('group', { name: 'Fri Oct 9 close' });
    expect(figure(group, 'Current Marked Trade P&L')).toBe('−$50.00 · −0.20R');
    expect(figure(group, 'Ongoing Risk to Stop')).toBe('$450.00 · 1.80R');
  });
});
