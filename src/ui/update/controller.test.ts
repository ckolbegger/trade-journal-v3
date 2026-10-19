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
