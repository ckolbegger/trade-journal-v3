// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { facadeDouble } from '../../../../tests/support/facade-double.ts';
import { incoherentDetailOf, openDetailOf, PC1, PC2 } from '../../../../tests/support/open-detail-fixtures.ts';
import { plannedDetail } from '../../../../tests/support/views-fixtures.ts';
import type { TradeDetailView } from '../../../app/types.ts';
import { renderDetail, renderView } from './test-support.ts';

afterEach(cleanup);

describe('Trade Detail', () => {
  it('should render NotFound and Error states distinctly', async () => {
    const missing = facadeDouble();
    vi.mocked(missing.TradeViewsAndReporting.getTradeDetail).mockResolvedValue({ kind: 'NotFound' });
    renderDetail(missing);
    expect(await screen.findByRole('heading', { name: 'Trade not found' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    cleanup();

    const failing = facadeDouble();
    vi.mocked(failing.TradeViewsAndReporting.getTradeDetail)
      .mockResolvedValueOnce({ kind: 'ChangedDuringAssembly' })
      .mockResolvedValueOnce({ kind: 'Ready', view: plannedDetail, binding: {} } as never);
    renderDetail(failing);
    expect(await screen.findByText(/couldn’t load this trade/i)).toBeTruthy();
    screen.getByRole('button', { name: 'Retry' }).click();
    expect(await screen.findByRole('heading', { name: 'XYZ', level: 1 })).toBeTruthy();
  });
});

describe('Open Trade Detail', () => {
  it('should offer Record entry only while Writable', async () => {
    for (const view of [openDetailOf([PC1]), plannedDetail] as TradeDetailView[]) {
      renderView(view, true);
      const link = await screen.findByRole('link', { name: 'Record entry' });
      expect(link.getAttribute('href')).toBe('/trades/trade-1/record-entry');
      cleanup();

      renderView(view, false);
      await screen.findByRole('heading', { name: 'XYZ', level: 1 });
      expect(screen.queryByRole('link', { name: 'Record entry' })).toBeNull();
      cleanup();
    }
  });
});

describe('incoherent Trade Detail', () => {
  const incoherent = () => incoherentDetailOf([PC1], [{ factId: 'ex-1', kind: 'Execution', instrument: { kind: 'Stock', symbol: 'XYZ' }, economicTime: '2026-10-12T14:00:00Z', side: 'Buy', quantity: '60', reason: 'UnknownPlannedLeg' }]);

  it('should not offer Record entry on an IncoherentTradeDetail, while a coherent Open or Planned Detail still offers it', async () => {
    renderView(incoherent(), true);
    await screen.findByRole('region', { name: "Facts can't be replayed" });
    expect(screen.queryByRole('link', { name: 'Record entry' })).toBeNull();
    cleanup();

    for (const view of [openDetailOf([PC1]), plannedDetail] as TradeDetailView[]) {
      renderView(view, true);
      expect((await screen.findByRole('link', { name: 'Record entry' })).getAttribute('href')).toBe('/trades/trade-1/record-entry');
      cleanup();
    }
  });
});

describe('badge meanings', () => {
  it('should give the lifecycle badge the info tone', async () => {
    renderView(openDetailOf([PC1, PC2]));
    expect((await screen.findByText('Open', { selector: '.badge' })).getAttribute('data-tone')).toBe('info');
  });
});

describe('back to the list', () => {
  it('should show a Back to Trades link above the h1 that opens the Trades tab of the Trades stored lifecycle', async () => {
    const open = facadeDouble();
    vi.mocked(open.TradeViewsAndReporting.getTradeDetail).mockResolvedValue({ kind: 'Ready', view: openDetailOf([PC1]), binding: {} } as never);
    renderDetail(open);
    const h1 = await screen.findByRole('heading', { level: 1 });
    const link = screen.getByRole('link', { name: 'Back to Trades' });
    expect(link.getAttribute('href')).toBe('/');
    expect(link.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    cleanup();

    const planned = facadeDouble();
    vi.mocked(planned.TradeViewsAndReporting.getTradeDetail).mockResolvedValue({ kind: 'Ready', view: plannedDetail, binding: {} } as never);
    renderDetail(planned);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('link', { name: 'Back to Trades' }).getAttribute('href')).toBe('/?lifecycle=Planned');
  });

  it('should show the link on Loading, Not Found, and Error states as well', async () => {
    const loading = facadeDouble();
    vi.mocked(loading.TradeViewsAndReporting.getTradeDetail).mockReturnValue(new Promise(() => {}));
    renderDetail(loading);
    expect(screen.getByRole('link', { name: 'Back to Trades' }).getAttribute('href')).toBe('/');
    cleanup();

    const missing = facadeDouble();
    vi.mocked(missing.TradeViewsAndReporting.getTradeDetail).mockResolvedValue({ kind: 'NotFound' });
    renderDetail(missing);
    await screen.findByRole('heading', { name: 'Trade not found' });
    expect(screen.getByRole('link', { name: 'Back to Trades' }).getAttribute('href')).toBe('/');
    cleanup();

    const failing = facadeDouble();
    vi.mocked(failing.TradeViewsAndReporting.getTradeDetail).mockResolvedValue({ kind: 'ChangedDuringAssembly' });
    renderDetail(failing);
    await screen.findByText(/couldn’t load this trade/i);
    expect(screen.getByRole('link', { name: 'Back to Trades' }).getAttribute('href')).toBe('/');
  });
});
