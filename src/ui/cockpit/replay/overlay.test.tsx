// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReplayOverlay } from './overlay.tsx';

afterEach(cleanup);

const open = (props: Partial<Parameters<typeof ReplayOverlay>[0]> = {}) => {
  const onClose = vi.fn();
  const view = render(
    <div>
      <div data-testid="page">
        <p>The page behind</p>
        <button type="button">Page button</button>
      </div>
      <ReplayOverlay name="Replay, BREN" header="BREN · Trade P&L +$988.00" onClose={onClose} {...props}>
        <p>Replay content</p>
        <button type="button">Inside button</button>
      </ReplayOverlay>
    </div>,
  );
  return { onClose, ...view };
};

describe('Replay overlay (decision 3)', () => {
  it('should show its content in a modal dialog named "Replay, BREN", with the page behind it inert', () => {
    open();
    const dialog = screen.getByRole('dialog', { name: 'Replay, BREN' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(within(dialog).getByText('Replay content')).toBeTruthy();
    expect(screen.getByTestId('page').closest('[inert]')).not.toBeNull();
    expect(dialog.closest('[inert]')).toBeNull();
  });

  it('should head it "BREN · Trade P&L +$988.00" with a Close button', () => {
    open();
    const dialog = screen.getByRole('dialog', { name: 'Replay, BREN' });
    expect(within(dialog).getByRole('heading').textContent).toBe('BREN · Trade P&L +$988.00');
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeTruthy();
  });

  it('should move focus into the dialog when it opens', () => {
    open();
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });

  it('should keep Tab and Shift+Tab inside the dialog', async () => {
    open();
    const user = userEvent.setup();
    const close = screen.getByRole('button', { name: 'Close' });
    const inside = screen.getByRole('button', { name: 'Inside button' });
    expect(document.activeElement).toBe(close);
    await user.tab();
    expect(document.activeElement).toBe(inside);
    await user.tab();
    expect(document.activeElement).toBe(close);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(inside);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(close);
  });

  it('should wrap Tab from the last control that can take focus to Close, and Shift+Tab from Close to it, when the dialog holds a closed details with a summary and a hidden region that has tabIndex 0', async () => {
    render(
      <ReplayOverlay name="Replay, BREN" header="BREN · Trade P&L +$988.00" onClose={vi.fn()}>
        <button type="button">Inside button</button>
        <details>
          <summary>Table</summary>
          <div tabIndex={0}>Hidden region</div>
        </details>
      </ReplayOverlay>,
    );
    const user = userEvent.setup();
    const close = screen.getByRole('button', { name: 'Close' });
    const summary = screen.getByText('Table');
    summary.focus();
    await user.tab();
    expect(document.activeElement).toBe(close);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(summary);
  });

  it('should call onClose from the Close button and from Escape', async () => {
    const { onClose } = open();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('should leave Escape to a control inside it that handles Escape itself, and close on the next', async () => {
    const onClose = vi.fn();
    const onEscape = vi.fn();
    render(
      <ReplayOverlay name="Replay, BREN" header="BREN" onClose={onClose}>
        <input
          aria-label="Inner"
          onKeyDown={(e) => {
            if (e.key === 'Escape' && onEscape.mock.calls.length === 0) {
              onEscape();
              e.preventDefault();
            }
          }}
        />
      </ReplayOverlay>,
    );
    screen.getByLabelText('Inner').focus();
    const user = userEvent.setup();
    await user.keyboard('{Escape}');
    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should return focus to the control that opened it when it closes', async () => {
    function Host() {
      const [shown, setShown] = useState(false);
      return (
        <div>
          <button type="button" onClick={() => setShown(true)}>
            Replay
          </button>
          {shown ? (
            <ReplayOverlay name="Replay, BREN" header="BREN" onClose={() => setShown(false)}>
              <p>content</p>
            </ReplayOverlay>
          ) : null}
        </div>
      );
    }
    render(<Host />);
    const user = userEvent.setup();
    const opener = screen.getByRole('button', { name: 'Replay' });
    await user.click(opener);
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
    expect(opener.closest('[inert]')).toBeNull();
  });

  it('should head a finished Trade "BREN · Final result +$1,138.00", and show the symbol alone when the latest session has no Mark', () => {
    const first = open({ header: 'BREN · Final result +$1,138.00' });
    expect(within(screen.getByRole('dialog')).getByRole('heading').textContent).toBe('BREN · Final result +$1,138.00');
    first.unmount();
    open({ name: 'Replay, CORV', header: 'CORV' });
    expect(within(screen.getByRole('dialog', { name: 'Replay, CORV' })).getByRole('heading').textContent).toBe('CORV');
  });

  it('should leave a shell banner present when the overlay opens in place and unchanged, and readable again the moment the overlay closes', () => {
    function Shell({ shown }: { shown: boolean }) {
      return (
        <div>
          <div data-testid="page">
            <div role="status">Update available</div>
          </div>
          {shown ? (
            <ReplayOverlay name="Replay, BREN" header="BREN" onClose={() => undefined}>
              <p>content</p>
            </ReplayOverlay>
          ) : null}
        </div>
      );
    }
    const { rerender } = render(<Shell shown={false} />);
    const banner = screen.getByText('Update available');
    rerender(<Shell shown />);
    expect(screen.getByText('Update available')).toBe(banner);
    expect(banner.textContent).toBe('Update available');
    expect(banner.closest('[aria-hidden="true"]')).toBeNull();
    rerender(<Shell shown={false} />);
    expect(screen.getByText('Update available')).toBe(banner);
    expect(banner.closest('[inert]')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('Update available');
  });
});

// Layout is not computed in jsdom, so this reads the overlay's stylesheet itself and asserts the rules (the browser suite measures the real placement).
describe('Replay overlay layout (A275)', () => {
  const css = postcss.parse(readFileSync('src/ui/cockpit/styles/replay-overlay.css', 'utf8'));
  const decls = (atMedia: string | null, selector: string) => {
    const out: Record<string, string> = {};
    css.walkRules((rule) => {
      const parent = rule.parent;
      const media = parent && parent.type === 'atrule' && (parent as postcss.AtRule).name === 'media' ? (parent as postcss.AtRule).params : null;
      if (media !== atMedia || !rule.selectors.includes(selector)) return;
      rule.walkDecls((d) => {
        out[d.prop] = d.value;
      });
    });
    return out;
  };
  const frame = '.replay-overlay .replay-card';
  const plot = '.replay-overlay .replay-plot-frame';
  const readout = '.replay-overlay .replay-readout';

  it('should place the charts on the left and the readout on the right inside the overlay at a wide width, and one column on a phone', () => {
    const wide = decls(null, frame);
    expect(wide.display).toBe('grid');
    expect(wide['grid-template-columns']?.split(/\s+(?![^(]*\))/).length).toBe(2);
    expect(decls(null, plot)['grid-column']).toBe('1');
    expect(decls(null, readout)['grid-column']).toBe('2');
    expect(decls('(max-width: 860px)', frame)['grid-template-columns']).toBe('minmax(0, 1fr)');
    expect(decls('(max-width: 860px)', plot)['grid-column']).toBe('1');
    expect(decls('(max-width: 860px)', readout)['grid-column']).toBe('1');
  });
});
