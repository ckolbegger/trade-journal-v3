// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { facadeDouble, readyStatus } from '../../../tests/support/facade-double.ts';
import { createReleaseUpdateController } from '../update/controller.ts';
import { ChannelNetwork, FakeContainer, FakeRegistration } from '../update/doubles.ts';
import { AboutView } from './AboutView.tsx';

afterEach(cleanup);

// The About page reads the estimates' own constants; a test can move them to see the page follow.
const assumed = vi.hoisted(() => ({ short: 0.04, long: 0.0525, lastDay: 365 }));
vi.mock('../../domain/option-pricing/assumptions.ts', () => ({
  get SHORT_TERM_RATE() {
    return assumed.short;
  },
  get LONG_TERM_RATE() {
    return assumed.long;
  },
  get SHORT_TERM_LAST_DAY() {
    return assumed.lastDay;
  },
}));

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
    expect(within(capabilities).getByText('TradeWorkflows.confirmPlan (LongStock, LongCall, LongPut, CashSecuredPut, StructureValueCondition)')).toBeTruthy();
    expect(within(capabilities).getByText(/Strategies: strategy.long-stock/)).toBeTruthy();
  });

  it('should show the Workspace schema version next to the release identity', async () => {
    render(<AboutView facade={facadeDouble({ status: { ...status, schemaVersion: 2 } })} updates={controller()} />);
    const about = await screen.findByRole('region', { name: 'This release' });
    expect(within(about).getByText('Schema version', { selector: 'dt' }).nextElementSibling?.textContent).toBe('2');
  });

  it('should show the backup export and Restore schema ranges with the format version from the Installed Capability Manifest', async () => {
    render(<AboutView facade={facadeDouble({ status })} updates={controller()} />);
    const capabilities = await screen.findByRole('region', { name: 'Installed capabilities' });
    expect(within(capabilities).getByText('Backups: exports schema 7 (format 1); restores schemas 3 to 7 (format 1)')).toBeTruthy();
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

describe('session-policy coverage', () => {
  it('should carry the release identity class on exactly one element so the session policy id is not a second release identity', async () => {
    const { container } = render(<AboutView facade={facadeDouble({ status })} updates={controller()} />);
    await screen.findByRole('region', { name: 'This release' });
    const identities = container.querySelectorAll('.identity');
    expect(Array.from(identities).map((e) => e.textContent)).toEqual(['release-1']);
  });

  it('should show in About the session policy id, revision, and coverage range', async () => {
    render(<AboutView facade={facadeDouble({ status })} updates={controller()} />);
    const about = await screen.findByRole('region', { name: 'This release' });
    const value = (term: string) => within(about).getByText(term, { selector: 'dt' }).nextElementSibling?.textContent;
    expect(value('Session policy')).toBe('nyse');
    expect(value('Session policy revision')).toBe('1');
    expect(value('Calendar coverage')).toBe('2024-01-01 to 2028-12-31');
  });
});

describe('About: option estimates (W50)', () => {
  const estimates = async () => {
    render(<AboutView facade={facadeDouble({ status })} updates={controller()} />);
    return within(await screen.findByRole('region', { name: 'Option estimates' }));
  };

  it('should state the formula limits under Option estimates', async () => {
    const section = await estimates();
    expect(section.getByText("Implied volatility, the share equivalent and the split of an option's move are estimates. They use the textbook option formula (Black-Scholes): no dividends, and exercise only at expiration.")).toBeTruthy();
    expect(section.getByText("The option's Mark and the Underlying's Mark may not be from the same moment. An estimate never changes a P&L or a risk figure.")).toBeTruthy();
  });
  it('should state both rates and the 365-day line, read from the constants the estimates use', async () => {
    const section = await estimates();
    expect(section.getByText('Interest rate: 4% for a contract with up to 365 days to expiration, 5.25% beyond.')).toBeTruthy();
    cleanup();
    Object.assign(assumed, { short: 0.05, long: 0.0625, lastDay: 400 });
    try {
      const moved = await estimates();
      expect(moved.getByText('Interest rate: 5% for a contract with up to 400 days to expiration, 6.25% beyond.')).toBeTruthy();
    } finally {
      Object.assign(assumed, { short: 0.04, long: 0.0525, lastDay: 365 });
    }
  });
});
