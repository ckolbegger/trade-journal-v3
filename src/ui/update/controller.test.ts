import { describe, expect, it, vi } from 'vitest';
import { createReleaseUpdateController } from './controller.ts';
import { ChannelNetwork, FakeContainer, FakeRegistration } from './doubles.ts';

function tab(network = new ChannelNetwork(), registration = new FakeRegistration(), container = new FakeContainer()) {
  const reload = vi.fn();
  const controller = createReleaseUpdateController({
    registration,
    container,
    channel: network.open(),
    reload,
  });
  return { controller, registration, container, reload, network };
}

describe('update availability', () => {
  it('should show no notice until a new release is waiting (installed and verified)', () => {
    const { controller, registration } = tab();
    expect(controller.state().notice).toBe('None');
    registration.releaseWaiting();
    expect(controller.state().notice).not.toBe('None');
  });
});

describe('activation', () => {
  it('should post ApplyUpdate to the waiting worker and reload exactly once on controllerchange', () => {
    const { controller, registration, container, reload } = tab();
    registration.releaseWaiting();
    const waiting = registration.waiting!;
    controller.applyUpdate();
    expect(waiting.messages).toEqual([{ type: 'ApplyUpdate' }]);
    expect(reload).not.toHaveBeenCalled();
    container.controllerChange();
    container.controllerChange();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('should reload a tab with no unsaved form on controllerchange caused by another tab', () => {
    const { container, reload } = tab();
    container.controllerChange();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe('asking the other tabs', () => {
  it('should send a query on askOthers and learn unsaved work from the reply', () => {
    const network = new ChannelNetwork();
    const asker = tab(network);
    // A stand-in for another tab that holds unsaved work and answers any query.
    const other = network.open();
    const queries: unknown[] = [];
    other.addEventListener('message', (event) => {
      const message = (event as MessageEvent<{ type: string }>).data;
      if (message.type !== 'query') return;
      queries.push(message);
      other.postMessage({ type: 'unsaved', tabId: 'other', unsaved: true });
    });
    expect(asker.controller.state().unsavedElsewhere).toBe(false);
    asker.controller.askOthers();
    expect(queries).toEqual([expect.objectContaining({ type: 'query' })]);
    expect(asker.controller.state().unsavedElsewhere).toBe(true);
  });
});

describe('critic-1 findings (C1.8)', () => {
  it('should learn of unsaved work that another tab announced before this tab opened', () => {
    const network = new ChannelNetwork();
    const editing = tab(network);
    editing.controller.setUnsaved(true);
    const opened = tab(network);
    expect(opened.controller.state().unsavedElsewhere).toBe(true);
  });

  it('should report UpdateWaiting when the check finds a release still installing, once it is installed and waiting', async () => {
    const { controller, registration } = tab();
    const installing = Object.assign(new EventTarget(), { state: 'installing' });
    registration.update = () => {
      registration.updates++;
      Object.assign(registration, { installing });
      setTimeout(() => {
        installing.state = 'installed';
        Object.assign(registration, { installing: null });
        registration.releaseWaiting();
        installing.dispatchEvent(new Event('statechange'));
      }, 0);
      return Promise.resolve();
    };
    expect(await controller.checkForUpdates()).toBe('UpdateWaiting');
  });
});
