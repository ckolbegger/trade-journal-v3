// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createReleaseUpdateController } from './controller.ts';
import { ChannelNetwork, FakeContainer, FakeRegistration } from './doubles.ts';
import { UpdateNotice } from './UpdateNotice.tsx';

afterEach(cleanup);

function tab(network = new ChannelNetwork()) {
  const registration = new FakeRegistration();
  const container = new FakeContainer();
  const reload = vi.fn();
  const controller = createReleaseUpdateController({ registration, container, channel: network.open(), reload });
  return { controller, registration, container, reload };
}

describe('update availability', () => {
  it('should show "An update is ready" with a Reload action when a release is waiting and no form in any tab is unsaved', () => {
    const { controller, registration } = tab();
    render(<UpdateNotice controller={controller} />);
    expect(screen.queryByText('An update is ready')).toBeNull();
    act(() => registration.releaseWaiting());
    expect(screen.getByText('An update is ready')).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Reload' }).disabled).toBe(false);
  });
});

describe('deferral while work is unsaved', () => {
  it('should disable Reload and explain that the update waits for the open form to be saved or cancelled when this tab has an unsaved form', () => {
    const { controller, registration } = tab();
    render(<UpdateNotice controller={controller} />);
    act(() => {
      registration.releaseWaiting();
      controller.setUnsaved(true);
    });
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Reload' }).disabled).toBe(true);
    expect(screen.getByText(/waits until you save or cancel the open form/i)).toBeTruthy();
  });

  it('should disable Reload and explain that another tab has unsaved work when another tab reports one', () => {
    const network = new ChannelNetwork();
    const clean = tab(network);
    const busy = tab(network);
    render(<UpdateNotice controller={clean.controller} />);
    act(() => {
      clean.registration.releaseWaiting();
      busy.controller.setUnsaved(true);
    });
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Reload' }).disabled).toBe(true);
    expect(screen.getByText(/another tab has unsaved work/i)).toBeTruthy();
  });

  it('should enable Reload once every form is saved or cancelled', () => {
    const network = new ChannelNetwork();
    const here = tab(network);
    const other = tab(network);
    const closing = tab(network);
    render(<UpdateNotice controller={here.controller} />);
    act(() => {
      here.registration.releaseWaiting();
      here.controller.setUnsaved(true);
      other.controller.setUnsaved(true);
      closing.controller.setUnsaved(true);
    });
    act(() => {
      here.controller.setUnsaved(false);
      other.controller.setUnsaved(false);
      // Closing a tab abandons its form, which never blocks the update afterwards.
      closing.controller.dispose();
    });
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Reload' }).disabled).toBe(false);
  });
});

describe('activation', () => {
  it('should keep a tab\'s unsaved form on screen and show "Updated in another tab: reload when ready" when controllerchange arrives while that form is unsaved', () => {
    const { controller, container, reload } = tab();
    render(
      <>
        <UpdateNotice controller={controller} />
        <input aria-label="Underlying" defaultValue="XYZ" />
      </>,
    );
    act(() => {
      controller.setUnsaved(true);
      container.controllerChange();
    });
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByText('Updated in another tab: reload when ready')).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('Underlying').value).toBe('XYZ');
  });
});
