// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ReplayDrawer } from '../drawers/replay.tsx';
import { AXIO, BREN, BREN_STOCK, DALE, fullView, markOf, session, usd, withMarks, type Session } from './view-doubles.props.ts';

afterEach(cleanup);

// W48 (T9.25): the line under the charts. Every figure is the view's own finished one (T9.23): the Trade P&L's change, the option Mark's change and the
// split's parts; the line selects and formats them.
type Estimates = NonNullable<Session['estimates']>;
const estimates = (over: Partial<Estimates> = {}): Estimates => ({
  impliedVolatility: { kind: 'Estimate', value: 0.277 },
  shareEquivalent: { kind: 'Estimate', value: 183.2 },
  split: { kind: 'Split', underlying: -0.52, time: -0.22, volatility: -0.01, remainder: 0 },
  rate: 0.04,
  days: 4,
  ...over,
});

// R-BREN-U on Mon Nov 16: the Trade P&L fell $150.00 since Fri Nov 13, the call's Mark by $0.75 a share.
const brenMon = (over: Partial<Estimates> = {}, since = '2026-11-13'): Session => ({
  ...withMarks(session({ date: '2026-11-16', held: 2, pnl: 832 }), [markOf(BREN_STOCK, '101.80'), markOf(BREN, '3.00', { since, dollars: usd(-0.75) })]),
  change: { since, dollars: usd(-150) },
  estimates: estimates(over),
});
const open = (sessions: readonly Session[], initialSession: string) => render(<ReplayDrawer replay={fullView(sessions)} initialSession={initialSession} />);
const since = () => screen.getByTestId('since');

// R-BREN-U on Tue Nov 17: the call's Mark rose $1.09 a share, the Trade P&L $218.00.
const brenTue = (split: Estimates['split']): Session => ({
  ...withMarks(session({ date: '2026-11-17', held: 2, pnl: 1050 }), [markOf(BREN_STOCK, '104.10'), markOf(BREN, '4.09', { since: '2026-11-16', dollars: usd(1.09) })]),
  change: { since: '2026-11-16', dollars: usd(218) },
  estimates: estimates({ impliedVolatility: { kind: 'Unavailable', reason: 'NoVolatilityFits' }, split }),
});

describe('Replay: since the session before (W48)', () => {
  it('should read Since Fri Nov 13 with the Trade P&L, the move of the call and its three parts, tagged estimate', () => {
    open([brenMon()], '2026-11-16');
    expect(since().textContent).toBe("Since Fri Nov 13: Trade P&L −$150.00. The call moved −$0.75 a share: BREN's move −$0.52 · time −$0.22 · volatility −$0.01estimate");
    expect(since().querySelector('.replay-chip-tag')?.textContent).toBe('estimate');
  });
  it('should read time and volatility together when they can not be told apart', () => {
    open([brenTue({ kind: 'Split', underlying: 1.13, timeAndVolatility: -0.04, remainder: 0 })], '2026-11-17');
    expect(since().textContent).toBe("Since Mon Nov 16: Trade P&L +$218.00. The call moved +$1.09 a share: BREN's move +$1.13 · time and volatility together −$0.04estimate");
    // The bar draws the two parts, the gain to the right of the zero line and the loss to its left.
    const [move, together] = within(since()).getAllByTestId('since-bar-part');
    expect(Number(together!.getAttribute('x')) + Number(together!.getAttribute('width'))).toBeCloseTo(Number(move!.getAttribute('x')), 5);
  });
  it('should say the move is not split, why, and the Mark real change', () => {
    // R-CORV-D style: no Mark on Tue Nov 10, so Wed Nov 11's change is measured from Mon Nov 9, and Mon Nov 9 has no implied volatility to split from.
    const wed: Session = {
      ...withMarks(session({ date: '2026-11-11', instrument: DALE, held: 2, pnl: 640 }), [markOf({ kind: 'Stock', symbol: 'DALE' }, '55.00'), markOf(DALE, '2.10', { since: '2026-11-09', dollars: usd(0.87) })]),
      change: { since: '2026-11-09', dollars: usd(174) },
      estimates: estimates({ split: { kind: 'Unavailable', reason: 'NoVolatilityFits', session: '2026-11-10', since: '2026-11-09', change: 0.87 } }),
    };
    render(<ReplayDrawer replay={{ ...fullView([wed]), instruments: [{ kind: 'Stock', symbol: 'DALE' }, DALE] }} initialSession="2026-11-11" />);
    expect(since().textContent).toBe("Since Mon Nov 9: Trade P&L +$174.00. Not split: no implied volatility Tue Nov 10. The put moved +$0.87 since Mon Nov 9.");
    // Nothing is split, so nothing is tagged or drawn.
    expect(within(since()).queryByTestId('since-bar')).toBeNull();
    expect(within(since()).queryByText('estimate')).toBeNull();
  });
  const notSplitWed = (reason: 'MarkMissing' | 'NoVolatilityFits'): Session => ({
    ...withMarks(session({ date: '2026-11-11', instrument: DALE, held: 2, pnl: 640 }), [markOf({ kind: 'Stock', symbol: 'DALE' }, '55.00'), markOf(DALE, '2.10', { since: '2026-11-09', dollars: usd(0.87) })]),
    change: { since: '2026-11-09', dollars: usd(174) },
    estimates: estimates({ split: { kind: 'Unavailable', reason, session: '2026-11-10', since: '2026-11-09', change: 0.87 } }),
  });
  const openWed = (wed: Session) => render(<ReplayDrawer replay={{ ...fullView([wed]), instruments: [{ kind: 'Stock', symbol: 'DALE' }, DALE] }} initialSession="2026-11-11" />);
  it('should say a Mark is missing, with W49 words, when the move is not split for a missing Mark', () => {
    openWed(notSplitWed('MarkMissing'));
    expect(since().textContent).toBe("Since Mon Nov 9: Trade P&L +$174.00. Not split: no Mark Tue Nov 10. The put moved +$0.87 since Mon Nov 9.");
  });
  it('should keep no implied volatility for the date when the earlier session has no implied volatility', () => {
    openWed(notSplitWed('NoVolatilityFits'));
    expect(since().textContent).toBe("Since Mon Nov 9: Trade P&L +$174.00. Not split: no implied volatility Tue Nov 10. The put moved +$0.87 since Mon Nov 9.");
  });
  it('should end the not-split sentence at the reason when there is no earlier Mark to compare', () => {
    const wed = notSplitWed('MarkMissing');
    openWed({ ...wed, estimates: estimates({ split: { kind: 'Unavailable', reason: 'MarkMissing', session: '2026-11-10' } }) });
    expect(since().textContent).toBe('Since Mon Nov 9: Trade P&L +$174.00. Not split: no Mark Tue Nov 10.');
  });
  it('should read AXIO moved a share for stock, with no tag', () => {
    const stock: Session = {
      ...withMarks(session({ date: '2026-11-16', instrument: AXIO, held: 200, pnl: 340 }), [markOf(AXIO, '61.40', { since: '2026-11-13', dollars: usd(1.4) })]),
      change: { since: '2026-11-13', dollars: usd(280) },
      estimates: estimates({ impliedVolatility: { kind: 'NotApplicable' }, shareEquivalent: { kind: 'Estimate', value: 200, exact: true }, split: { kind: 'NotApplicable' }, rate: null, days: null }),
    };
    render(<ReplayDrawer replay={{ ...fullView([stock]), instruments: [AXIO] }} initialSession="2026-11-16" />);
    expect(since().textContent).toBe('Since Fri Nov 13: Trade P&L +$280.00. AXIO moved +$1.40 a share.');
    expect(within(since()).queryByTestId('since-bar')).toBeNull();
  });
  it('should leave the line out on a final session, which has no option Mark change to split', () => {
    // An expired put's last session (DALE, Fri Nov 20): the Trade P&L's change is $0.00 and nothing is held, so it holds no estimates.
    const final: Session = { ...session({ date: '2026-11-20', instrument: DALE, held: 0, pnl: 1200, final: { kind: 'Expired', contract: DALE } }), change: { since: '2026-11-19', dollars: usd(0) } };
    render(<ReplayDrawer replay={{ ...fullView([final]), instruments: [{ kind: 'Stock', symbol: 'DALE' }, DALE] }} initialSession="2026-11-20" />);
    expect(screen.queryByTestId('since')).toBeNull();
  });
  it('should draw the parts as a small bar whose text equivalent is the sentence', () => {
    open([brenMon()], '2026-11-16');
    // The bar is a picture only: the sentence in the same line says all of it, so a screen reader has nothing to miss.
    const bar = within(since()).getByTestId('since-bar');
    expect(bar.getAttribute('aria-hidden')).toBe('true');
    expect(since().textContent).toContain("BREN's move −$0.52 · time −$0.22 · volatility −$0.01");
    const parts = within(bar).getAllByTestId('since-bar-part');
    expect(parts.map((part) => part.getAttribute('data-part'))).toEqual(["BREN's move", 'time', 'volatility']);
    // Each part is as wide as its figure is large, side by side, all inside the picture.
    const widths = parts.map((part) => Number(part.getAttribute('width')));
    expect(widths[0]! / widths[1]!).toBeCloseTo(0.52 / 0.22, 1);
    expect(widths[1]! / widths[2]!).toBeCloseTo(0.22 / 0.01, 0);
    const [x, width] = [Number(parts[0]!.getAttribute('x')), widths[0]!];
    const box = bar.getAttribute('viewBox')!.split(' ').map(Number);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x + width).toBeLessThanOrEqual(box[2]!);
    expect(Number(parts[1]!.getAttribute('x')) + widths[1]!).toBeCloseTo(x, 5);
  });
});

describe('Replay: estimates in the readout and the session cards', () => {
  const readout = () => within(screen.getByTestId('readout'));
  const group = (title: string) => readout().getByRole('heading', { name: title }).closest('section') as HTMLElement;
  it('should add Implied volatility under Marks and the share equivalent under Position, each tagged estimate', () => {
    open([brenMon()], '2026-11-16');
    const volatility = within(group('Marks')).getByText('Implied volatility').closest('[data-row]') as HTMLElement;
    expect(volatility.textContent).toBe('Implied volatility27.7%estimate');
    const shares = within(group('Position')).getByText('Behaves like').closest('[data-row]') as HTMLElement;
    expect(shares.textContent).toBe('Behaves like≈ 183 sharesestimate');
    cleanup();
    // Where there is none, the row says Unavailable and the reason is its hover text.
    open([brenMon({ impliedVolatility: { kind: 'Unavailable', reason: 'NoVolatilityFits' }, shareEquivalent: { kind: 'Unavailable', reason: 'NoVolatilityFits' } })], '2026-11-16');
    const none = within(group('Marks')).getByText('Implied volatility').closest('[data-row]') as HTMLElement;
    // Nothing to tag: no figure stands there.
    expect(none.textContent).toBe('Implied volatilityUnavailable');
    expect(within(none).getByText('Unavailable').closest('[title]')?.getAttribute('title')).toBe('No volatility fits this Mark.');
    cleanup();
    // Stock: its shares exactly, with no tag, and no implied volatility row.
    const stock: Session = {
      ...session({ date: '2026-11-16', instrument: AXIO, held: 200, pnl: 340 }),
      estimates: estimates({ impliedVolatility: { kind: 'NotApplicable' }, shareEquivalent: { kind: 'Estimate', value: 200, exact: true }, split: { kind: 'NotApplicable' }, rate: null, days: null }),
    };
    render(<ReplayDrawer replay={{ ...fullView([stock]), instruments: [AXIO] }} initialSession="2026-11-16" />);
    const exact = within(group('Position')).getByText('Behaves like').closest('[data-row]') as HTMLElement;
    expect(exact.textContent).toBe('Behaves like200 shares');
    expect(readout().queryByText('Implied volatility')).toBeNull();
  });
  it('should add both as rows of each session card, with Unavailable where there is none', () => {
    const none: Estimates['impliedVolatility'] = { kind: 'Unavailable', reason: 'NoVolatilityFits' };
    const fri: Session = { ...withMarks(session({ date: '2026-11-13', held: 2, pnl: 982 }), [markOf(BREN_STOCK, '101.80'), markOf(BREN, '3.75')]), estimates: estimates({ impliedVolatility: none, shareEquivalent: none }) };
    open([fri, brenMon()], '2026-11-16');
    const card = (heading: string) => within(within(screen.getByRole('region', { name: 'Session by session' })).getByRole('button', { name: heading, hidden: true }).closest('article') as HTMLElement);
    const row = (heading: string, label: string) => (card(heading).getByText(label, { selector: 'dt' }).closest('[data-row]') as HTMLElement).textContent;
    expect(row('Mon Nov 16', 'Implied volatility')).toBe('Implied volatility27.7%estimate');
    expect(row('Mon Nov 16', 'Behaves like')).toBe('Behaves like≈ 183 sharesestimate');
    expect(row('Fri Nov 13', 'Implied volatility')).toBe('Implied volatilityUnavailable');
    expect(row('Fri Nov 13', 'Behaves like')).toBe('Behaves likeUnavailable');
  });
});
