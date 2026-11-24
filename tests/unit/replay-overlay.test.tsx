// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TradeRecordRow } from '../../src/persistence/idb';
import { replayLongStockTrade } from '../../src/trade-analysis/replay';
import type { TradeReplayView } from '../../src/trade-views/trade-views';
import { ReplayOverlay } from '../../src/ui/replay/ReplayOverlay';
import { ReplayStrip } from '../../src/ui/replay/ReplayStrip';
import { makeExecution, makeLongStockPlan, ser } from '../helpers/builders';

afterEach(() => {
  cleanup();
});

function buildSampleView(overrides?: { isClosed?: boolean }): TradeReplayView {
  const closed = overrides?.isClosed ?? false;
  const replay = replayLongStockTrade({
    tradeId: 'trd-ui-1',
    symbol: 'AXIO',
    sessions: ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'],
    reviewDate: '2026-11-05',
    plan: makeLongStockPlan(),
    originalPlannedRisk: ser('300.00'),
    originalPlannedReward: ser('600.00'),
    executions: closed
      ? [
          makeExecution({
            id: 'b1',
            quantity: '100',
            fillPrice: '50.00',
            economicTime: '2026-11-02T15:00:00.000Z',
            recordedSequence: 2,
          }),
          makeExecution({
            id: 's1',
            side: 'Sell',
            quantity: '100',
            fillPrice: '55.00',
            economicTime: '2026-11-05T15:00:00.000Z',
            recordedSequence: 3,
          }),
        ]
      : [
          makeExecution({
            id: 'b1',
            quantity: '100',
            fillPrice: '50.00',
            economicTime: '2026-11-02T15:00:00.000Z',
            recordedSequence: 2,
          }),
        ],
    effectiveMarks: [
      { sessionDate: '2026-11-02', price: ser('49.50') },
      { sessionDate: '2026-11-03', price: ser('46.00') },
      // 2026-11-04 is an explicit missing-Mark gap
      { sessionDate: '2026-11-05', price: ser('45.50') },
    ],
    acknowledgedUnavailableDates: ['2026-11-04'],
    reviewActions: [
      { reviewDate: '2026-11-02', action: 'Hold', reason: null, conviction: 4 },
      { reviewDate: '2026-11-03', action: 'Hold', reason: 'Wait for close', conviction: 3 },
      { reviewDate: '2026-11-05', action: 'Hold', reason: 'Still holding', conviction: 2 },
    ],
  });

  const trade: TradeRecordRow = {
    id: 'trd-ui-1',
    accountId: 'acct-1',
    institutionId: 'inst-1',
    strategyId: 'strat_long_stock',
    symbol: 'AXIO',
    lifecycleState: closed ? 'Closed' : 'Open',
    factRevision: 2,
    createdAt: '2026-11-02T14:00:00.000Z',
    updatedAt: '2026-11-05T20:00:00.000Z',
    plannedQuantity: ser('100'),
    intendedEntryPrice: ser('50.00'),
    stopPrice: ser('47.00'),
    targetPrice: ser('56.00'),
    baseline: {
      riskPerShare: ser('3.00'),
      rewardPerShare: ser('6.00'),
      originalPlannedRisk: ser('300.00'),
      originalPlannedReward: ser('600.00'),
      plannedRewardToRisk: ser('2.00'),
      originalPlannedRiskDisplay: '$300.00',
      originalPlannedRewardDisplay: '$600.00',
      plannedRewardToRiskDisplay: '2.00R',
    },
    ...(closed
      ? {
          closeReasonId: 'cr_target_reached',
          closedAt: '2026-11-05T15:00:00.000Z',
          terminalDisposition: 'Closed via sale of 100 shares',
        }
      : {}),
  };

  return {
    trade,
    strategyLabel: 'Long Stock',
    accountLabel: 'Margin',
    institutionLabel: 'Fidelity',
    closeReasonLabel: closed ? 'Target Reached' : null,
    closedAtShort: closed ? 'Thu, Nov 5' : null,
    terminalDisposition: closed ? 'Closed via sale of 100 shares' : null,
    expectedSessionDate: '2026-11-05',
    expectedSessionDateShort: 'Thu, Nov 5',
    replay,
  };
}

describe('ReplayOverlay & ReplayStrip components (jsdom)', () => {
  it('opens on initialSelectedIndex (post-gap Stop breach run) showing PastStop hero, stake sentence, and StopDiscipline episode', () => {
    const view = buildSampleView();
    render(<ReplayOverlay view={view} returnLabel="Back to the Review" onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog', { name: 'Replay, AXIO' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText(/4 of 4/)).toBeInTheDocument();
    expect(screen.getByText(/Past the Stop by \$150\.00/)).toBeInTheDocument();
    expect(
      screen.getByText(
        'From here: already $150.00 past the Stop. Each $1.00 lower costs $100.00 more.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Still holding/)).toBeInTheDocument();
    expect(screen.getByText(/StopDiscipline:/)).toBeInTheDocument();
  });

  it('scrubs via step buttons and range slider with aria-valuetext while disabling ‹ at start and › at end', () => {
    const view = buildSampleView();
    render(<ReplayOverlay view={view} returnLabel="Back to the Review" onClose={vi.fn()} />);

    const prev = screen.getByRole('button', { name: 'Earlier session' });
    const next = screen.getByRole('button', { name: 'Later session' });
    const slider = screen.getByRole('slider', { name: 'Session shown' }) as HTMLInputElement;

    expect(slider.value).toBe('3');
    expect(next).toBeDisabled();
    expect(slider).toHaveAttribute('aria-valuetext', expect.stringContaining('4 of 4'));

    fireEvent.click(prev);
    expect(slider.value).toBe('2');
    expect(prev).not.toBeDisabled();
    expect(next).not.toBeDisabled();

    fireEvent.change(slider, { target: { value: '0' } });
    expect(slider.value).toBe('0');
    expect(prev).toBeDisabled();
  });

  it('ignores ArrowLeft inside Key moments select so native option navigation stays intact', () => {
    const view = buildSampleView();
    render(<ReplayOverlay view={view} returnLabel="Back to the Review" onClose={vi.fn()} />);

    const slider = screen.getByRole('slider', { name: 'Session shown' }) as HTMLInputElement;
    const select = screen.getByLabelText('Key moments');
    fireEvent.keyDown(select, { key: 'ArrowLeft' });
    expect(slider.value).toBe('3');
  });

  it('ignores modified keyboard shortcuts such as Alt+ArrowLeft and Ctrl+Home', () => {
    const view = buildSampleView();
    render(<ReplayOverlay view={view} returnLabel="Back to the Review" onClose={vi.fn()} />);

    const slider = screen.getByRole('slider', { name: 'Session shown' }) as HTMLInputElement;
    fireEvent.keyDown(window, { key: 'ArrowLeft', altKey: true });
    expect(slider.value).toBe('3');
    fireEvent.keyDown(window, { key: 'Home', ctrlKey: true });
    expect(slider.value).toBe('3');
  });

  it.each([
    { key: 'ArrowLeft', expected: '2' },
    { key: 'Home', expected: '0' },
  ])('scrubs session index via keyboard $key from trailing index 3', ({ key, expected }) => {
    const view = buildSampleView();
    render(<ReplayOverlay view={view} returnLabel="Back to the Review" onClose={vi.fn()} />);

    const slider = screen.getByRole('slider', { name: 'Session shown' }) as HTMLInputElement;
    fireEvent.keyDown(window, { key });
    expect(slider.value).toBe(expected);
  });

  it('steps forward on ArrowRight and jumps to max on End from index 0', () => {
    const view = buildSampleView();
    render(<ReplayOverlay view={view} returnLabel="Back to the Review" onClose={vi.fn()} />);

    const slider = screen.getByRole('slider', { name: 'Session shown' }) as HTMLInputElement;
    fireEvent.keyDown(window, { key: 'Home' });
    expect(slider.value).toBe('0');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(slider.value).toBe('1');
    fireEvent.keyDown(window, { key: 'End' });
    expect(slider.value).toBe('3');
  });

  it('closes on Escape from dialog button controls while ignoring Escape directly on Key moments select', () => {
    const onClose = vi.fn();
    const view = buildSampleView();
    render(<ReplayOverlay view={view} returnLabel="Back to the Review" onClose={onClose} />);

    const select = screen.getByLabelText('Key moments');
    fireEvent.keyDown(select, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();

    const closeBtn = screen.getByRole('button', { name: 'Back to the Review' });
    closeBtn.focus();
    fireEvent.keyDown(closeBtn, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('traps Tab and Shift+Tab focus inside Replay and recovers focus from outside elements', () => {
    const view = buildSampleView();
    render(
      <div>
        <button type="button">Outside trigger</button>
        <ReplayOverlay view={view} returnLabel="Back to the Review" onClose={vi.fn()} />
      </div>,
    );

    const outsideBtn = screen.getByRole('button', { name: 'Outside trigger' });
    const closeBtn = screen.getByRole('button', { name: 'Back to the Review' });
    const summaryBtn = screen.getByText('Accessible session table').closest('summary') as HTMLElement;

    closeBtn.focus();
    fireEvent.keyDown(document.activeElement!, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(summaryBtn);

    fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
    expect(document.activeElement).toBe(closeBtn);

    outsideBtn.focus();
    fireEvent.keyDown(outsideBtn, { key: 'Tab' });
    expect(document.activeElement).toBe(closeBtn);
  });

  it('syncs Key Moments select dropdown and shows off-moment message on non-moment sessions', () => {
    const view = buildSampleView();
    render(<ReplayOverlay view={view} returnLabel="Back to the Review" onClose={vi.fn()} />);

    const select = screen.getByLabelText('Key moments') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '0' } });
    expect(screen.getByText(/1 of 4/)).toBeInTheDocument();

    const slider = screen.getByRole('slider', { name: 'Session shown' });
    fireEvent.change(slider, { target: { value: '2' } });
    expect(screen.getByText('No key moment this session.')).toBeInTheDocument();
  });

  it('renders No Mark and Unavailable honestly in Readout for missing-Mark sessions', () => {
    const view = buildSampleView();
    render(<ReplayOverlay view={view} returnLabel="Back to the Review" onClose={vi.fn()} />);

    fireEvent.change(screen.getByRole('slider', { name: 'Session shown' }), { target: { value: '2' } });
    const readout = screen.getByRole('complementary', { name: 'Session readout' });
    expect(within(readout).getByText('No Review this session.')).toBeInTheDocument();
    expect(within(readout).getByText('No Mark')).toBeInTheDocument();
    expect(within(readout).getAllByText('Unavailable')).toHaveLength(2);
  });

  it('jumps cursor when clicking a session row in the expandable Accessible session table', () => {
    const view = buildSampleView();
    render(<ReplayOverlay view={view} returnLabel="Back to the Review" onClose={vi.fn()} />);

    fireEvent.click(screen.getByText('Accessible session table'));
    const table = screen.getByRole('table', { name: 'Replay sessions' });
    fireEvent.click(within(table).getByRole('button', { name: 'Mon, Nov 2' }));
    expect(screen.getByText(/1 of 4/)).toBeInTheDocument();
  });

  it('displays aria-hidden hover tooltip via data-testid and clears on mouseLeave', () => {
    const view = buildSampleView();
    render(<ReplayOverlay view={view} returnLabel="Back to the Review" onClose={vi.fn()} />);

    const hit0 = screen.getByTestId('corridor-hit-0');
    fireEvent.mouseMove(hit0, { clientX: 120, clientY: 160 });
    const tip = screen.getByTestId('corridor-tooltip');
    expect(tip).not.toHaveAttribute('role', 'status');
    expect(tip).toHaveAttribute('aria-hidden', 'true');
    expect(tip).toHaveTextContent('$49.50');
    expect(tip).toHaveTextContent('-$50.00');
    expect(tip).toHaveTextContent('Buy 100 @ $50.00');

    fireEvent.mouseLeave(hit0);
    expect(screen.queryByTestId('corridor-tooltip')).not.toBeInTheDocument();
  });

  it('selects session index when clicking a Corridor chart hit target', () => {
    const view = buildSampleView();
    render(<ReplayOverlay view={view} returnLabel="Back to the Review" onClose={vi.fn()} />);

    fireEvent.click(screen.getByTestId('corridor-hit-0'));
    expect(screen.getByText(/1 of 4/)).toBeInTheDocument();
  });

  it('renders Closed readout execution without spurious empty action line', () => {
    const view = buildSampleView({ isClosed: true });
    render(<ReplayOverlay view={view} returnLabel="Back to Trade" onClose={vi.fn()} />);

    const readout = screen.getByRole('complementary', { name: 'Session readout' });
    expect(within(readout).getByText('Sold 100 at $55.00.')).toBeInTheDocument();
    expect(within(readout).queryByText('Nothing recorded.')).not.toBeInTheDocument();
  });

  it('invokes onOpenPriceHistory and onClose callbacks cleanly', () => {
    const onClose = vi.fn();
    const onOpenPriceHistory = vi.fn();
    const view = buildSampleView({ isClosed: true });

    render(
      <ReplayOverlay
        view={view}
        returnLabel="Back to Trade"
        onClose={onClose}
        onOpenPriceHistory={onOpenPriceHistory}
      />,
    );

    fireEvent.click(screen.getByText('Accessible session table'));
    fireEvent.click(screen.getByRole('button', { name: 'Open Price History in Trade Detail' }));
    expect(onOpenPriceHistory).toHaveBeenCalledWith('trd-ui-1');

    fireEvent.click(screen.getByRole('button', { name: 'Back to Trade' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders ReplayStrip with summary, primary highlight when PastStop, and passes button ref on click', () => {
    const view = buildSampleView();
    const onOpen = vi.fn();
    render(<ReplayStrip model={view.replay} onOpen={onOpen} />);

    expect(screen.getByText(/Past the Stop since/)).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: 'Replay' });
    expect(btn.className).toContain('btnPrimary');
    fireEvent.click(btn);
    expect(onOpen).toHaveBeenCalledWith(btn);
  });

  it('renders quiet btnSecondary ReplayStrip when closed', () => {
    const closedView = buildSampleView({ isClosed: true });
    render(<ReplayStrip model={closedView.replay} onOpen={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Replay' }).className).toContain('btnSecondary');
  });

  it('renders Pending review state and prior Exit review action in Session readout', () => {
    const openPendingModel = replayLongStockTrade({
      tradeId: 'trd-pending',
      symbol: 'AXIO',
      sessions: ['2026-11-02', '2026-11-03'],
      reviewDate: '2026-11-03',
      plan: makeLongStockPlan(),
      originalPlannedRisk: ser('300.00'),
      executions: [makeExecution()],
      effectiveMarks: [
        { sessionDate: '2026-11-02', price: ser('51.00') },
        { sessionDate: '2026-11-03', price: ser('52.00') },
      ],
      reviewActions: [{ reviewDate: '2026-11-02', action: 'Exit', reason: 'Taking gains' }],
    });
    const pendingView: TradeReplayView = { ...buildSampleView(), replay: openPendingModel };
    render(<ReplayOverlay view={pendingView} returnLabel="Back to Trade" onClose={vi.fn()} />);

    const readout = screen.getByRole('complementary', { name: 'Session readout' });
    expect(within(readout).getByText('Action: not chosen yet.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Earlier session' }));
    expect(within(readout).getByText(/Exit/)).toBeInTheDocument();
    expect(within(readout).getByText(/Taking gains/)).toBeInTheDocument();
  });

  it('renders zero-overrun At the Stop / At the Target exact boundaries without "$0.00 past" phrasing', () => {
    const boundaryModel = replayLongStockTrade({
      tradeId: 'trd-exact-lines',
      symbol: 'AXIO',
      sessions: ['2026-11-02', '2026-11-03'],
      reviewDate: '2026-11-03',
      plan: makeLongStockPlan(),
      originalPlannedRisk: ser('300.00'),
      executions: [makeExecution()],
      effectiveMarks: [
        { sessionDate: '2026-11-02', price: ser('47.00') }, // exact Stop
        { sessionDate: '2026-11-03', price: ser('56.00') }, // exact Target
      ],
    });
    const view: TradeReplayView = { ...buildSampleView(), replay: boundaryModel };
    render(<ReplayOverlay view={view} returnLabel="Back to Trade" onClose={vi.fn()} />);

    const readout = screen.getByRole('complementary', { name: 'Session readout' });
    expect(screen.getByText('At the Target.')).toBeInTheDocument();
    expect(within(readout).getByText('At Target')).toBeInTheDocument();
    expect(screen.queryByText(/\$0\.00 past/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Earlier session' }));
    expect(screen.getByText('At the Stop.')).toBeInTheDocument();
    expect(screen.getByText(/From here: at the Stop\./)).toBeInTheDocument();
    expect(within(readout).getByText('At Stop')).toBeInTheDocument();
    expect(screen.queryByText(/\$0\.00 past/)).not.toBeInTheDocument();
  });

  it('renders InsideTarget and AtTarget overrun hero copy across target run sessions', () => {
    const targetModel = replayLongStockTrade({
      tradeId: 'trd-target-copy',
      symbol: 'AXIO',
      sessions: ['2026-11-02', '2026-11-03'],
      reviewDate: '2026-11-03',
      plan: makeLongStockPlan(),
      originalPlannedRisk: ser('300.00'),
      executions: [makeExecution()],
      effectiveMarks: [
        { sessionDate: '2026-11-02', price: ser('53.00') },
        { sessionDate: '2026-11-03', price: ser('57.50') },
      ],
    });
    const view: TradeReplayView = { ...buildSampleView(), replay: targetModel };
    render(<ReplayOverlay view={view} returnLabel="Back to Trade" onClose={vi.fn()} />);

    expect(screen.getByText(/Target reached, \$150\.00 past it\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Earlier session' }));
    expect(screen.getByText('50% of the way to the Target.')).toBeInTheDocument();
  });

  it('renders pre-entry and Oversold sessions that carry Marks as Unavailable instead of No Mark', () => {
    const preAndOversoldModel = replayLongStockTrade({
      tradeId: 'trd-pre-ov',
      symbol: 'AXIO',
      sessions: ['2026-11-02', '2026-11-03'],
      plan: makeLongStockPlan(),
      originalPlannedRisk: ser('300.00'),
      executions: [
        makeExecution({
          id: 'b1',
          quantity: '100',
          fillPrice: '50.00',
          economicTime: '2026-11-03T15:00:00.000Z',
        }),
        makeExecution({
          id: 's1',
          side: 'Sell',
          quantity: '110',
          fillPrice: '52.00',
          economicTime: '2026-11-03T15:30:00.000Z',
          recordedSequence: 3,
        }),
      ],
      effectiveMarks: [
        { sessionDate: '2026-11-02', price: ser('50.25') },
        { sessionDate: '2026-11-03', price: ser('52.00') },
      ],
    });
    const view: TradeReplayView = { ...buildSampleView(), replay: preAndOversoldModel };
    render(<ReplayOverlay view={view} returnLabel="Back to Trade" onClose={vi.fn()} />);

    expect(screen.getByText('Position oversold (derived integrity block).')).toBeInTheDocument();
    expect(screen.getByText('Unavailable', { selector: 'span' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Earlier session' }));
    expect(screen.getByText('Not entered yet.')).toBeInTheDocument();
    expect(screen.getByText('Unavailable', { selector: 'span' })).toBeInTheDocument();
  });

  it('renders in-progress live session copy explicitly without calling it No Mark', () => {
    const liveModel = replayLongStockTrade({
      tradeId: 'trd-live',
      symbol: 'AXIO',
      sessions: ['2026-11-03'],
      reviewDate: '2026-11-02',
      inProgressSessionDate: '2026-11-03',
      plan: makeLongStockPlan(),
      originalPlannedRisk: ser('300.00'),
      executions: [makeExecution({ economicTime: '2026-11-03T14:45:00.000Z' })],
      effectiveMarks: [],
    });
    const view: TradeReplayView = { ...buildSampleView(), replay: liveModel };
    render(<ReplayOverlay view={view} returnLabel="Back to Trade" onClose={vi.fn()} />);

    expect(screen.getByText("Session still open — waiting for today's close.")).toBeInTheDocument();
    expect(screen.getByText('Market open', { selector: 'span' })).toBeInTheDocument();
  });

  it('preserves focus inside the dialog when Earlier or Later step button reaches a boundary and disables', () => {
    const view = buildSampleView();
    render(<ReplayOverlay view={view} returnLabel="Back to the Review" onClose={vi.fn()} />);

    const prevBtn = screen.getByRole('button', { name: 'Earlier session' });
    const nextBtn = screen.getByRole('button', { name: 'Later session' });

    fireEvent.click(prevBtn); // 3 -> 2
    fireEvent.click(prevBtn); // 2 -> 1
    prevBtn.focus();
    fireEvent.click(prevBtn); // 1 -> 0 (disables prevBtn)
    expect(prevBtn).toBeDisabled();
    expect(document.activeElement).toBe(nextBtn);

    fireEvent.click(nextBtn); // 0 -> 1
    fireEvent.click(nextBtn); // 1 -> 2
    nextBtn.focus();
    fireEvent.click(nextBtn); // 2 -> 3 (disables nextBtn)
    expect(nextBtn).toBeDisabled();
    expect(document.activeElement).toBe(prevBtn);
  });

  it('allows window ArrowLeft on focused dialog buttons while letting INPUT slider handle native arrows once', () => {
    const view = buildSampleView();
    render(<ReplayOverlay view={view} returnLabel="Back to the Review" onClose={vi.fn()} />);

    const slider = screen.getByRole('slider', { name: 'Session shown' }) as HTMLInputElement;
    const prevBtn = screen.getByRole('button', { name: 'Earlier session' });
    expect(slider.value).toBe('3');

    // On INPUT target, ReplayOverlay window keydown skips so slider does not double-step
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(slider.value).toBe('3');

    // On dialog button target, ArrowLeft steps back once
    prevBtn.focus();
    fireEvent.keyDown(prevBtn, { key: 'ArrowLeft' });
    expect(slider.value).toBe('2');
  });

  it('switches Corridor chart SVG between wide 720px and narrow 340px geometry via Element.prototype.clientWidth', () => {
    let mockWidth = 800;
    const spy = vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(() => mockWidth);
    try {
      const view = buildSampleView();
      render(<ReplayOverlay view={view} returnLabel="Back to Trade" onClose={vi.fn()} />);
      expect(screen.getByRole('img', { name: /AXIO Corridor Replay chart/ }).getAttribute('viewBox')).toMatch(
        /^0 0 720 /,
      );

      mockWidth = 340;
      cleanup();
      render(<ReplayOverlay view={view} returnLabel="Back to Trade" onClose={vi.fn()} />);
      expect(screen.getByRole('img', { name: /AXIO Corridor Replay chart/ }).getAttribute('viewBox')).toMatch(
        /^0 0 340 /,
      );
    } finally {
      spy.mockRestore();
    }
  });

  it('renders panel-clipped No Mark bands behind headings so the Trade P&L subtitle is never occluded', () => {
    const view = buildSampleView();
    const { container } = render(
      <ReplayOverlay view={view} returnLabel="Back to the Review" onClose={vi.fn()} />,
    );

    const svg = screen.getByRole('img', { name: /AXIO Corridor Replay chart/ });
    const gapRects = Array.from(svg.querySelectorAll('rect[fill="#f3efe6"]'));
    expect(gapRects).toHaveLength(2);

    const pnlHeading = Array.from(container.querySelectorAll('svg text')).find((t) =>
      t.textContent?.includes('Trade P&L'),
    );
    expect(pnlHeading).toBeDefined();
    const pnlHeadingY = Number(pnlHeading!.getAttribute('y'));
    for (const r of gapRects) {
      const y = Number(r.getAttribute('y'));
      const h = Number(r.getAttribute('height'));
      const bandOverlapsHeadingRow = y <= pnlHeadingY && y + h >= pnlHeadingY - 10;
      expect(bandOverlapsHeadingRow).toBe(false);
    }
  });
});
