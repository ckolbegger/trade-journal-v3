// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { facadeDouble, readyStatus } from '../../../tests/support/facade-double.ts';
import { FirstRun } from './FirstRun.tsx';

afterEach(cleanup);

const zones = ['America/Chicago', 'America/New_York', 'Europe/London'];

describe('first-run time zone', () => {
  it('should propose the browser-resolved zone and allow choosing any supported zone before calling initialize', async () => {
    const facade = facadeDouble();
    const opened = readyStatus({ onboarding: 'NeedsInstitutionAndAccount' });
    vi.mocked(facade.Workspace.initialize).mockResolvedValue({ kind: 'Opened', status: opened, receipt: {} } as never);
    const onOpened = vi.fn();
    render(<FirstRun facade={facade} proposedZone="America/New_York" zones={zones} onOpened={onOpened} />);
    const select = screen.getByLabelText<HTMLSelectElement>('Time zone');
    expect(select.value).toBe('America/New_York');
    expect(Array.from(select.options).map((o) => o.value)).toEqual(zones);
    const user = userEvent.setup();
    await user.selectOptions(select, 'Europe/London');
    expect(facade.Workspace.initialize).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Start my journal' }));
    expect(facade.Workspace.initialize).toHaveBeenCalledWith({ timeZone: 'Europe/London' });
    expect(onOpened).toHaveBeenCalledWith(opened);
  });

  it('should show InvalidTimeZone as a field error and make no other call', async () => {
    const facade = facadeDouble();
    vi.mocked(facade.Workspace.initialize).mockResolvedValue({ kind: 'Rejected', issues: [{ code: 'InvalidTimeZone' }] });
    const onOpened = vi.fn();
    render(<FirstRun facade={facade} proposedZone="Mars/Base" zones={['Mars/Base']} onOpened={onOpened} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Start my journal' }));
    const select = screen.getByLabelText('Time zone');
    expect((await screen.findByText(/this time zone is not recognized/i)).id).toBe(select.getAttribute('aria-describedby'));
    expect(select.getAttribute('aria-invalid')).toBe('true');
    expect(onOpened).not.toHaveBeenCalled();
    expect(facade.Workspace.initialize).toHaveBeenCalledTimes(1);
    expect(facade.Workspace.getStatus).not.toHaveBeenCalled();
  });
});
