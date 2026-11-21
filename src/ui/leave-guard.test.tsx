// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LeaveGuard } from './leave-guard.tsx';

afterEach(cleanup);

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function page(unsaved: boolean) {
  render(
    <MemoryRouter initialEntries={['/review']}>
      <LeaveGuard unsaved={() => unsaved}>
        <Link to="/trades">Trades</Link>
        <Where />
      </LeaveGuard>
    </MemoryRouter>,
  );
}

describe('leaving the page with unsaved work', () => {
  it('should ask before a route change and stay when the trader cancels', () => {
    const ask = vi.spyOn(window, 'confirm').mockReturnValue(false);
    page(true);
    fireEvent.click(screen.getByRole('link', { name: 'Trades' }));
    expect(ask).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('where').textContent).toBe('/review');
    ask.mockRestore();
  });

  it('should leave when the trader accepts, and never ask when nothing is unsaved', () => {
    const ask = vi.spyOn(window, 'confirm').mockReturnValue(true);
    page(true);
    fireEvent.click(screen.getByRole('link', { name: 'Trades' }));
    expect(ask).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('where').textContent).toBe('/trades');
    cleanup();
    ask.mockClear();
    page(false);
    fireEvent.click(screen.getByRole('link', { name: 'Trades' }));
    expect(ask).not.toHaveBeenCalled();
    expect(screen.getByTestId('where').textContent).toBe('/trades');
    ask.mockRestore();
  });

  it('should hold a reload or tab close with the browser prompt only while something is unsaved', () => {
    page(true);
    const held = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(held);
    expect(held.defaultPrevented).toBe(true);
    cleanup();
    page(false);
    const free = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(free);
    expect(free.defaultPrevented).toBe(false);
  });
});
