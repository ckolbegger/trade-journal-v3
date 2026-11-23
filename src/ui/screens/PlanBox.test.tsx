// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { TradeReplayView } from '../../app/types.ts';
import { Rational } from '../../domain/values/index.ts';
import { AXIO, BREN, DALE, frac, usd } from '../cockpit/replay/view-doubles.props.ts';
import { PlanBox } from './PlanBox.tsx';

afterEach(cleanup);

type Terms = NonNullable<TradeReplayView['planColumn']>['terms'];

// R-AXIO-D: 200 shares at $50.00, a Stop at $47.00 and a Target at $56.00 on AXIO. 1R is $600.00, the Plan's reward $1,200.00.
const AXIO_TERMS: Terms = {
  legs: [{ instrument: AXIO, side: 'Long', quantity: Rational.of(200n), entryPrice: usd(50) }],
  conditions: [
    { role: 'Stop', priceOf: 'Underlying', price: usd(47), pnlIfHit: usd(-600) },
    { role: 'Target', priceOf: 'Underlying', price: usd(56), pnlIfHit: usd(1200) },
  ],
};
const replayOf = (terms: Terms, atStop = usd(-600), atTarget = usd(1200)) => ({ planColumn: { atStop, atTarget, rewardRisk: frac(2, 1), terms } }) as unknown as TradeReplayView;
const PLAN = { thesis: 'Earnings are priced in.', invalidation: 'A close under the 200-day line.' };

const row = (term: string) => screen.getByText(term, { selector: 'dt' }).closest('div')!;

describe('Plan box (W93, U7)', () => {
  it('should show the Plan box with Entry Stop Target Risk with 1R Reward and beside them Thesis and No longer valid if values in bold', () => {
    render(<PlanBox plan={PLAN} replay={replayOf(AXIO_TERMS)} />);

    const box = screen.getByRole('region', { name: 'Plan' });
    expect(within(row('Entry')).getByText('200 shares at $50.00')).toBeTruthy();
    expect(within(row('Stop')).getByText('AXIO at or below $47.00')).toBeTruthy();
    expect(within(row('Target')).getByText('AXIO at or above $56.00')).toBeTruthy();
    // The Risk is shown without its sign, as 1R; the Reward is the Plan's.
    expect(within(row('Risk')).getByText('$600.00 (1R)')).toBeTruthy();
    expect(within(row('Reward')).getByText('$1,200.00')).toBeTruthy();
    expect(within(box).getByText('Thesis')).toBeTruthy();
    expect(within(box).getByText('No longer valid if')).toBeTruthy();
    // Every value is bold.
    for (const text of ['200 shares at $50.00', 'AXIO at or below $47.00', 'AXIO at or above $56.00', '$600.00 (1R)', '$1,200.00', PLAN.thesis, PLAN.invalidation]) {
      expect(within(box).getByText(text).tagName, text).toBe('STRONG');
    }
  });

  it('should state each Stop and Target in the Plan own terms', () => {
    // A long call with its Stop and Target on the option's price; a short put with its Stop on the Underlying and its Target on the option.
    const bren: Terms = {
      legs: [{ instrument: BREN, side: 'Long', quantity: Rational.of(4n), entryPrice: frac(161, 100) }],
      conditions: [
        { role: 'Stop', priceOf: 'Option', price: frac(80, 100), pnlIfHit: usd(-324) },
        { role: 'Target', priceOf: 'Option', price: usd(4), pnlIfHit: usd(956) },
      ],
    };
    const dale: Terms = {
      legs: [{ instrument: DALE, side: 'Short', quantity: Rational.of(6n), entryPrice: frac(94, 100) }],
      conditions: [
        { role: 'Stop', priceOf: 'Underlying', price: usd(54), pnlIfHit: usd(-1536) },
        { role: 'Target', priceOf: 'Option', price: frac(20, 100), pnlIfHit: usd(444) },
      ],
    };

    const { rerender } = render(<PlanBox plan={PLAN} replay={replayOf(bren)} />);
    expect(within(row('Stop')).getByText('Call at or below $0.80')).toBeTruthy();
    expect(within(row('Target')).getByText('Call at or above $4.00')).toBeTruthy();

    rerender(<PlanBox plan={PLAN} replay={replayOf(dale)} />);
    expect(within(row('Stop')).getByText('DALE at or below $54.00')).toBeTruthy();
    expect(within(row('Target')).getByText('Put at or below $0.20')).toBeTruthy();
  });
});
