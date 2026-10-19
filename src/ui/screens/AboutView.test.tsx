// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { facadeDouble, readyStatus } from '../../../tests/support/facade-double.ts';
import { createReleaseUpdateController } from '../update/controller.ts';
import { ChannelNetwork, FakeContainer, FakeRegistration } from '../update/doubles.ts';
import { AboutView } from './AboutView.tsx';

afterEach(cleanup);

const GB = 1024 ** 3;
const status = readyStatus({
  protection: 'BestEffort',
  readiness: {
    outcome: 'Writable',
    failures: [],
    protection: 'BestEffort',
    checks: {
      diagnostic: { passed: true },
      capacity: {
        passed: true,
        evidence: { quota: 10 * GB, usage: 0.5 * GB, available: 9.5 * GB, projectedWorkspaceBytes: 0.7 * GB, requiredQuotaBytes: 2.1 * GB },
      },
      control: { passed: true },
      inventory: { passed: true, evidence: { assetCount: 7 } },
    },
  },
});

function controller(registration = new FakeRegistration()) {
  return createReleaseUpdateController({ registration, container: new FakeContainer(), channel: new ChannelNetwork().open(), reload: () => undefined });
}

describe('About this release', () => {
  it('should show the application name, Web App Manifest id, release identity, inventory asset count, per-check readiness evidence including the capacity figures, storage protection, Workspace time zone, and the Installed Capability Manifest', async () => {
    render(<AboutView facade={facadeDouble({ status })} updates={controller()} />);
    const about = await screen.findByRole('region', { name: 'This release' });
    const value = (term: string) => within(about).getByText(term, { selector: 'dt' }).nextElementSibling?.textContent;
    expect(value('Application')).toBe('Trade Journal');
    expect(value('Manifest id')).toBe('/');
    expect(value('Release')).toBe('release-1');
    expect(value('Offline assets')).toBe('7');
    expect(value('Storage protection')).toBe('Best effort');
    expect(value('Time zone')).toBe('America/New_York');
    const checks = screen.getByRole('region', { name: 'Runtime Readiness' });
    expect(within(checks).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Test save and read-back: passed',
      'Storage space: passed (quota 10.00 GB, used 0.50 GB, required 2.10 GB for a projected 0.70 GB journal)',
      'Offline component in control: passed',
      'Offline copy complete: passed',
    ]);
    const capabilities = screen.getByRole('region', { name: 'Installed capabilities' });
    expect(within(capabilities).getByText('TradeWorkflows.confirmPlan (LongStock)')).toBeTruthy();
    expect(within(capabilities).getByText(/Strategies: strategy.long-stock/)).toBeTruthy();
  });

  it('should call registration.update when "Check for updates" is pressed and report "No update" or show the update notice', async () => {
    const quiet = new FakeRegistration();
    render(<AboutView facade={facadeDouble({ status })} updates={controller(quiet)} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Check for updates' }));
    expect(quiet.updates).toBe(1);
    expect(await screen.findByText('No update')).toBeTruthy();
    cleanup();

    const newer = new FakeRegistration();
    newer.update = () => {
      newer.updates++;
      newer.releaseWaiting();
      return Promise.resolve();
    };
    render(<AboutView facade={facadeDouble({ status })} updates={controller(newer)} />);
    await user.click(await screen.findByRole('button', { name: 'Check for updates' }));
    expect(newer.updates).toBe(1);
    expect(await screen.findByText('An update was found. Use Reload in the update notice.')).toBeTruthy();
  });
});
