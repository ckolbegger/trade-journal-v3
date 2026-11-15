// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  ApplyPreparedRestoreResult,
  ConfirmBackupResult,
  ExportBackupResult,
  PrepareRestoreResult,
  RestoreCounts,
  RestorePreview,
  RestoreToken,
} from '../../app/types.ts';
import { Rational } from '../../domain/values/index.ts';
import { RuntimeContext } from '../runtime.tsx';
import { RestoreFlow } from './RestoreFlow.tsx';
import { createBackupFacadeDouble, createFileSelectionDouble } from './test-support.ts';

afterEach(cleanup);

const BINDING = { revision: 3 } as unknown as Extract<ExportBackupResult, { kind: 'Downloaded' }>['sourceBinding'];
const FILE = new File(['x'], 'journal.tjbackup.gz');

function counts(overrides: Partial<RestoreCounts> = {}): RestoreCounts {
  return {
    tradesByLifecycle: { Planned: 1, Open: 2, Closed: 3 },
    positionChanges: 7,
    executions: 8,
    expirations: 1,
    deviationOccurrences: 2,
    entriesByType: { Plan: 4 },
    declines: 1,
    debtsByStatus: { Open: 2 },
    marks: 10,
    acknowledgments: 3,
    institutions: 1,
    accounts: 2,
    strategies: 5,
    closeReasons: 6,
    entryDefinitionRevisions: 9,
    versions: {},
    ...overrides,
  };
}

const TOKEN: RestoreToken = { candidateId: 'cand-1', fullDigest: 'digest-1', targetBinding: BINDING, releaseId: '2026.11.14' };

function preview(overrides: Partial<RestorePreview> = {}): RestorePreview {
  return {
    source: { createdAt: '2026-11-20T18:00', releaseId: '2026.11.14', schemaVersion: 7, exportKind: 'Normal' },
    counts: counts(),
    migrations: { steps: [{ from: 5, to: 6 }], seedAdditions: ['Long Call'] },
    repairs: [
      { tradeId: 'trade-9', tradeSummary: { underlying: 'XYZ', summary: { kind: 'Stock', direction: 'Long', quantity: Rational.of(100n, 1n), price: Rational.of(5018n, 100n) } }, kind: 'Lifecycle', stored: 'Open', expected: 'Closed' },
      { tradeId: 'trade-10', tradeSummary: { underlying: 'ABC', summary: { kind: 'Option', direction: 'Short', contracts: Rational.of(2n, 1n), expiration: '2026-12-18', strike: '50', right: 'Put' } }, kind: 'EntrySizeDeviation', stored: 'None', expected: 'Present' },
    ],
    providerNeedsSetup: [],
    target: { hasUserData: true, counts: counts({ marks: 99, accounts: 4 }), currentTimeZone: 'America/Chicago', restoredTimeZone: 'America/New_York' },
    warnings: ['TimeZoneDiffers', 'OlderSchema', 'AnotherTabHasUnsavedWork'],
    safetyChoiceRequired: true,
    ...overrides,
  };
}

const PREPARED: PrepareRestoreResult = { kind: 'Prepared', token: TOKEN, preview: preview() };

function setup(report?: (result: { readonly kind: string }) => void) {
  const facade = createBackupFacadeDouble();
  const files = createFileSelectionDouble();
  files.choose(FILE);
  const flow = <RestoreFlow facade={facade.facade} selectFile={files.port} />;
  const utils = render(<MemoryRouter>{report ? <RuntimeContext.Provider value={{ writable: true, report }}>{flow}</RuntimeContext.Provider> : flow}</MemoryRouter>);
  return { facade, files, utils, user: userEvent.setup() };
}

async function choose(ctx: ReturnType<typeof setup>) {
  await ctx.user.click(screen.getByRole('button', { name: 'Choose backup file' }));
}

describe('choose and check (A142)', () => {
  it('should call prepareRestore with the chosen file and show checking text with progress and Cancel, and on rejection list the issues (at most 200, with the total) and Your current journal is unchanged', async () => {
    const ctx = setup();
    const { facade, user } = ctx;
    let finish: (result: PrepareRestoreResult) => void = () => undefined;
    let signal: AbortSignal | undefined;
    facade.respond('prepareRestore', (request) => {
      signal = request.signal;
      request.onProgress?.({ done: 1200, total: 5000 });
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    await choose(ctx);
    expect(await screen.findByText('Checking the backup. Your current journal is not changed.')).toBeTruthy();
    expect(await screen.findByText('Checking the backup: 1,200 of 5,000 records')).toBeTruthy();
    expect(facade.calls.prepareRestore).toHaveLength(1);
    expect(facade.calls.prepareRestore[0]!.file).toBe(FILE);
    expect(signal?.aborted).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(signal?.aborted).toBe(true);
    await act(() => {
      finish({ kind: 'Cancelled', liveBinding: BINDING });
      return Promise.resolve();
    });
    expect(await screen.findByRole('button', { name: 'Choose backup file' })).toBeTruthy();
    expect(screen.queryByText(/Checking the backup/)).toBeNull();

    facade.respond('prepareRestore', {
      kind: 'Rejected',
      totalIssues: 1234,
      liveBinding: BINDING,
      issues: [
        { code: 'UnsupportedFormat' },
        { code: 'MalformedRecord', line: 1042, path: 'r.facts[2].price' },
        { code: 'DigestMismatch', section: 'trades' },
        { code: 'InsufficientCapacity', availableBytes: 80_000_000, requiredBytes: 120_000_000 },
        { code: 'CrossSectionReference', kind: 'Account', identity: 'fx-0016' },
        { code: 'IncoherentFacts' },
        ...Array.from({ length: 194 }, () => ({ code: 'IncompleteArtifact' })),
      ],
    });
    await choose(ctx);
    expect(await screen.findByText("This backup can't be restored.")).toBeTruthy();
    expect(screen.getByText('Your current journal is unchanged.')).toBeTruthy();
    expect(screen.getByText('Showing the first 200 of 1,234 problems.')).toBeTruthy();
    expect(screen.getByText("This file uses a backup format this app doesn't read.")).toBeTruthy();
    expect(screen.getByText("Line 1,042 isn't a valid record (r.facts[2].price).")).toBeTruthy();
    expect(screen.getByText("The trades section doesn't match its checksum, so the file was changed or damaged.")).toBeTruthy();
    expect(screen.getByText("There isn't enough storage space: 120 MB needed, 80 MB available.")).toBeTruthy();
    expect(screen.getByText("A record refers to an Account that isn't in the backup (fx-0016).")).toBeTruthy();
    expect(screen.getByText("A Trade's recorded facts cannot be replayed.")).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(200);
  });

  it('should cancel the preparation when the Restore flow is left', async () => {
    const ctx = setup();
    let signal: AbortSignal | undefined;
    ctx.facade.respond('prepareRestore', (request) => {
      signal = request.signal;
      return new Promise(() => undefined);
    });
    await choose(ctx);
    expect(await screen.findByText('Checking the backup. Your current journal is not changed.')).toBeTruthy();
    expect(signal?.aborted).toBe(false);
    ctx.utils.unmount();
    expect(signal?.aborted).toBe(true);
  });
});

async function toPreview(ctx: ReturnType<typeof setup>, result: PrepareRestoreResult = PREPARED) {
  ctx.facade.respond('prepareRestore', result);
  await choose(ctx);
  await screen.findByText('Restoring replaces your entire current journal');
}

const REPLACE = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Replace entire journal' });
const UNDERSTAND = () => screen.getByRole('checkbox', { name: 'I understand this replaces my entire current journal' });

describe('confirmation and safety choice (AC-REST-002, P33)', () => {
  it('should keep Replace entire journal disabled until the replacement checkbox is ticked and, when user data exists, a safety choice is complete', async () => {
    const ctx = setup();
    await toPreview(ctx);
    const { user } = ctx;
    expect(REPLACE().disabled).toBe(true);
    await user.click(UNDERSTAND());
    // User data exists and no safety choice is made yet.
    expect(REPLACE().disabled).toBe(true);
    const group = screen.getByRole('radiogroup', { name: 'Safety backup' });
    await user.click(within(group).getByRole('radio', { name: 'Back up this journal first (recommended)' }));
    expect(REPLACE().disabled).toBe(true);
    expect(screen.queryByText('If this backup is wrong or incomplete, your current journal cannot be recovered.')).toBeNull();
    await user.click(within(group).getByRole('radio', { name: 'Replace without a backup' }));
    expect(screen.getByText('If this backup is wrong or incomplete, your current journal cannot be recovered.')).toBeTruthy();
    expect(REPLACE().disabled).toBe(true);
    await user.click(screen.getByRole('checkbox', { name: 'If this backup is wrong or incomplete, your current journal cannot be recovered.' }));
    expect(REPLACE().disabled).toBe(false);
    await user.click(UNDERSTAND());
    expect(REPLACE().disabled).toBe(true);
  });
});

type Downloaded = Extract<ExportBackupResult, { kind: 'Downloaded' }>;
const DOWNLOADED: Downloaded = {
  kind: 'Downloaded',
  sourceBinding: BINDING,
  fullDigest: 'safety-digest',
  manifestDigest: 'safety-manifest',
  fileName: 'trade-journal-2026-11-14.tjbackup.gz',
  counts: { trades: 2 },
  byteSize: 1234,
};
const RECEIPT = {
  receiptId: 'receipt-1',
  sourceBinding: BINDING,
  fullDigest: DOWNLOADED.fullDigest,
  manifestDigest: DOWNLOADED.manifestDigest,
  evidence: { fileName: DOWNLOADED.fileName, byteSize: 1234, compressed: true, lineCount: 10 },
  // 12:05 in Chicago (UTC-6 in November).
  completedAt: '2026-11-14T18:05:00Z',
};

describe('inline safety backup', () => {
  it('should run Back up this journal first as an inline download bound to the preview target followed by verification, and enable Replace only with the resulting receipt', async () => {
    const ctx = setup();
    const { facade, user } = ctx;
    await toPreview(ctx);
    await user.click(UNDERSTAND());
    await user.click(screen.getByRole('radio', { name: 'Back up this journal first (recommended)' }));
    let finish: (result: ExportBackupResult) => void = () => undefined;
    facade.respond('exportBackup', (request) => {
      request.onProgress?.({ done: 1200, total: 5000 });
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    await user.click(screen.getByRole('button', { name: 'Download backup' }));
    expect(await screen.findByText('Making the backup: 1,200 of 5,000 records')).toBeTruthy();
    expect(facade.calls.exportBackup).toHaveLength(1);
    expect(facade.calls.exportBackup[0]!.expectedBinding).toBe(TOKEN.targetBinding);
    await act(() => {
      finish(DOWNLOADED);
      return Promise.resolve();
    });
    expect(await screen.findByText("Downloaded, not verified yet. This app can't see where your browser saved the file.")).toBeTruthy();
    expect(screen.getByText(DOWNLOADED.fileName)).toBeTruthy();
    expect(REPLACE().disabled).toBe(true);

    // A file that is not the downloaded one leaves Replace disabled.
    facade.respond('confirmBackup', { kind: 'NotVerified', reason: 'DifferentArtifact' });
    await user.click(screen.getByRole('button', { name: 'Verify backup' }));
    expect(await screen.findByText('This is a different backup from the one you just downloaded.')).toBeTruthy();
    expect(REPLACE().disabled).toBe(true);

    facade.respond('confirmBackup', { kind: 'Completed', receipt: RECEIPT });
    await user.click(screen.getByRole('button', { name: 'Choose another file' }));
    expect(await screen.findByText('Backup complete. Checked Sat Nov 14, 12:05.')).toBeTruthy();
    expect(facade.calls.confirmBackup.at(-1)).toMatchObject({ expectedBinding: BINDING, expectedFullDigest: DOWNLOADED.fullDigest });
    expect(REPLACE().disabled).toBe(false);

    facade.respond('applyPreparedRestore', { kind: 'PreparationNotFound', liveBinding: BINDING });
    await user.click(REPLACE());
    expect(facade.calls.applyPreparedRestore).toEqual([{ token: TOKEN, confirmation: { kind: 'ReplaceEntireWorkspace' }, safety: { kind: 'Receipt', receipt: RECEIPT } }]);
  });

  it('should ignore a safety backup verification that finishes after the choice was changed', async () => {
    const ctx = setup();
    const { facade, user } = ctx;
    await toPreview(ctx);
    await user.click(UNDERSTAND());
    await user.click(screen.getByRole('radio', { name: 'Back up this journal first (recommended)' }));
    facade.respond('exportBackup', DOWNLOADED);
    await user.click(screen.getByRole('button', { name: 'Download backup' }));
    await screen.findByText(DOWNLOADED.fileName);
    let finish: (result: ConfirmBackupResult) => void = () => undefined;
    facade.respond('confirmBackup', () => new Promise((resolve) => {
      finish = resolve;
    }));
    await user.click(screen.getByRole('button', { name: 'Verify backup' }));
    await screen.findByText('Checking the file');

    // Switch the choice away and back, which remounts the safety backup.
    await user.click(screen.getByRole('radio', { name: 'Replace without a backup' }));
    await user.click(screen.getByRole('radio', { name: 'Back up this journal first (recommended)' }));
    await act(() => {
      finish({ kind: 'Completed', receipt: RECEIPT });
      return Promise.resolve();
    });
    expect(screen.queryByText(/Backup complete/)).toBeNull();
    expect(REPLACE().disabled).toBe(true);
  });

  it('should not reuse a safety receipt for Replace without a backup after switching choices', async () => {
    const ctx = setup();
    const { facade, user } = ctx;
    await toPreview(ctx);
    await user.click(UNDERSTAND());
    await user.click(screen.getByRole('radio', { name: 'Back up this journal first (recommended)' }));
    facade.respond('exportBackup', DOWNLOADED);
    await user.click(screen.getByRole('button', { name: 'Download backup' }));
    await screen.findByText(DOWNLOADED.fileName);
    facade.respond('confirmBackup', { kind: 'Completed', receipt: RECEIPT });
    await user.click(screen.getByRole('button', { name: 'Verify backup' }));
    await screen.findByText(/Backup complete/);
    expect(REPLACE().disabled).toBe(false);

    // The receipt stays in memory, but the other choice needs its own acknowledgment.
    await user.click(screen.getByRole('radio', { name: 'Replace without a backup' }));
    expect(REPLACE().disabled).toBe(true);
    await user.click(screen.getByRole('checkbox', { name: /cannot be recovered/ }));
    expect(REPLACE().disabled).toBe(false);
    facade.respond('applyPreparedRestore', { kind: 'PreparationNotFound', liveBinding: BINDING });
    await user.click(REPLACE());
    expect(facade.calls.applyPreparedRestore).toEqual([{ token: TOKEN, confirmation: { kind: 'ReplaceEntireWorkspace' }, safety: { kind: 'DeclinedAfterWarning' } }]);
  });

  it('should say the journal changed and offer Check the backup again when the inline backup conflicts', async () => {
    const ctx = setup();
    const { facade, user } = ctx;
    await toPreview(ctx);
    await user.click(screen.getByRole('radio', { name: 'Back up this journal first (recommended)' }));
    facade.respond('exportBackup', { kind: 'Conflict', currentBinding: BINDING });
    await user.click(screen.getByRole('button', { name: 'Download backup' }));
    expect(await screen.findByText('Your journal changed after the backup was checked.')).toBeTruthy();
    facade.respond('prepareRestore', PREPARED);
    await user.click(screen.getByRole('button', { name: 'Check the backup again' }));
    expect(await screen.findByText('Restoring replaces your entire current journal')).toBeTruthy();
    expect(facade.calls.prepareRestore).toHaveLength(2);
  });

  it('should require the separate warning acknowledgment for Replace without a backup, and show no safety choice when the target has no user data', async () => {
    const ctx = setup();
    const { facade, user } = ctx;
    await toPreview(ctx);
    await user.click(UNDERSTAND());
    await user.click(screen.getByRole('radio', { name: 'Replace without a backup' }));
    expect(REPLACE().disabled).toBe(true);
    await user.click(screen.getByRole('checkbox', { name: /cannot be recovered/ }));
    facade.respond('applyPreparedRestore', { kind: 'PreparationNotFound', liveBinding: BINDING });
    await user.click(REPLACE());
    expect(facade.calls.applyPreparedRestore).toEqual([{ token: TOKEN, confirmation: { kind: 'ReplaceEntireWorkspace' }, safety: { kind: 'DeclinedAfterWarning' } }]);
    cleanup();

    const empty = setup();
    const noData = { ...TOKEN, targetBinding: 'NoWorkspace' as const };
    await toPreview(empty, { kind: 'Prepared', token: noData, preview: preview({ safetyChoiceRequired: false, target: { hasUserData: false, counts: null, currentTimeZone: null, restoredTimeZone: 'America/New_York' }, warnings: [] }) });
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.queryByText('Back up this journal first (recommended)')).toBeNull();
    expect(screen.queryByRole('columnheader', { name: 'In your current journal' })).toBeNull();
    expect(REPLACE().disabled).toBe(true);
    await empty.user.click(UNDERSTAND());
    expect(REPLACE().disabled).toBe(false);
    empty.facade.respond('applyPreparedRestore', { kind: 'PreparationNotFound', liveBinding: 'NoWorkspace' });
    await empty.user.click(REPLACE());
    expect(empty.facade.calls.applyPreparedRestore).toEqual([{ token: noData, confirmation: { kind: 'ReplaceEntireWorkspace' } }]);
  });
});

describe('preview', () => {
  it('should show the backup made time as the Workspace-local time the Restore returns, whatever the browser zone is', async () => {
    const ctx = setup();
    await toPreview(ctx, { kind: 'Prepared', token: TOKEN, preview: preview({ source: { createdAt: '2026-11-15T09:36', releaseId: '2026.11.14', schemaVersion: 7, exportKind: 'Normal' }, target: { hasUserData: false, counts: null, currentTimeZone: null, restoredTimeZone: 'Asia/Tokyo' }, safetyChoiceRequired: false, warnings: [] }) });
    expect(screen.getByText('From a backup made Sun Nov 15, 09:36 (release 2026.11.14, schema 7)')).toBeTruthy();
  });

  it('should show the replacement heading, the source, the restored counts beside the current counts, migrations, repairs with stored and expected values, and warnings, all as text', async () => {
    const ctx = setup();
    await toPreview(ctx);
    expect(screen.getByText('From a backup made Fri Nov 20, 18:00 (release 2026.11.14, schema 7)')).toBeTruthy();
    const table = screen.getByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'In the backup' })).toBeTruthy();
    expect(within(table).getByRole('columnheader', { name: 'In your current journal' })).toBeTruthy();
    const row = (label: string) => within(within(table).getByRole('rowheader', { name: label }).closest('tr')!).getAllByRole('cell').map((c) => c.textContent);
    expect(row('Marks')).toEqual(['10', '99']);
    expect(row('Accounts')).toEqual(['2', '4']);
    expect(row('Open Trades')).toEqual(['2', '2']);
    expect(row('Journal entries: Plan')[0]).toBe('4');
    expect(row('Reflections owed: Open')[0]).toBe('2');
    expect(row('Marks acknowledged unavailable')[0]).toBe('3');
    expect(row('Journal question revisions')[0]).toBe('9');
    expect(screen.getByText('Updated from schema 5 to 6')).toBeTruthy();
    expect(screen.getByText('Added default: Long Call')).toBeTruthy();
    expect(screen.getByText("The backup's time zone (America/New_York) differs from this journal's (America/Chicago). The restored journal uses the backup's.")).toBeTruthy();
    expect(screen.getByText("This backup was made by an earlier version and will be updated as it's restored.")).toBeTruthy();
    expect(screen.getByText('Another tab has unsaved changes. They will be lost when the journal is replaced.')).toBeTruthy();
  });
});

describe('preview repairs (T8.13-F3)', () => {
  it('should word each repair with the Trade name and the approved sentence for its kind', async () => {
    const ctx = setup();
    await toPreview(ctx);
    expect(screen.getByText('XYZ (Long 100 shares @ $50.18): lifecycle recorded Open, facts say Closed. It will be corrected.')).toBeTruthy();
    expect(screen.getByText(/^ABC \(Short 2 .*\): Entry Size deviation missing\. It will be added\.$/)).toBeTruthy();
    expect(screen.queryByText(/trade-9|trade-10/)).toBeNull();
  });
});

describe('unexpected preparation failure reported by the coordinator (T8.13-F3)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const DETAIL = { stage: 'Prepare', name: 'Error', message: 'boom', stack: 'Error: boom\n at x' };
  const failed = { kind: 'Rejected', totalIssues: 0, liveBinding: BINDING, issues: [], detail: DETAIL } as unknown as PrepareRestoreResult;

  it('should show the could-not-be-checked sentence with Choose backup file when the rejection has no issues and a detail', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const ctx = setup();
    ctx.facade.respond('prepareRestore', failed);
    await choose(ctx);
    expect(await screen.findByText("The backup couldn't be checked. Your current journal is unchanged.")).toBeTruthy();
    expect(screen.queryByText("This backup can't be restored.")).toBeNull();
    expect(screen.getByRole('button', { name: 'Choose backup file' })).toBeTruthy();
  });

  it('should log the detail of a rejection that has no issues through the developer log', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const ctx = setup();
    ctx.facade.respond('prepareRestore', failed);
    await choose(ctx);
    await screen.findByText(/couldn't be checked/);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]).toEqual(['[Trade Journal]', DETAIL]);
  });
});

function restored(next: 'Trades' | 'InstitutionAndAccountOnboarding', overrides: Partial<RestoreCounts> = {}): ApplyPreparedRestoreResult {
  return {
    kind: 'Restored',
    receipt: {
      artifactDigest: 'digest-1',
      replacedBinding: BINDING,
      newBinding: BINDING,
      counts: counts({ marks: 55, ...overrides }),
      migrations: { steps: [], seedAdditions: [] },
      repairs: [],
      readiness: {} as never,
    },
    status: { kind: 'Ready' } as never,
    landing: { kind: 'RestoreComplete', next },
  };
}

describe('result (AC-REST-003)', () => {
  it('should render the Restore complete summary from the result alone, discard every pre-Restore view and form, make no read call, and offer the next destination', async () => {
    const ctx = setup();
    const { facade, user } = ctx;
    await toPreview(ctx);
    await user.click(UNDERSTAND());
    await user.click(screen.getByRole('radio', { name: 'Replace without a backup' }));
    await user.click(screen.getByRole('checkbox', { name: /cannot be recovered/ }));
    facade.respond('applyPreparedRestore', restored('Trades'));
    await user.click(REPLACE());
    expect(await screen.findByRole('heading', { name: 'Restore complete' })).toBeTruthy();
    expect(screen.getByText('Your journal now holds the restored backup.')).toBeTruthy();
    const marks = within(screen.getByRole('table').querySelector('tbody')!).getByRole('rowheader', { name: 'Marks' }).closest('tr')!;
    expect(within(marks).getByRole('cell').textContent).toBe('55');
    expect(screen.getByRole('link', { name: 'Go to Trades' }).getAttribute('href')).toBe('/');
    expect(screen.queryByText('Restoring replaces your entire current journal')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Replace entire journal' })).toBeNull();
    expect(facade.calls.prepareRestore).toHaveLength(1);
    expect(facade.calls.exportBackup).toHaveLength(0);
    expect(facade.calls.confirmBackup).toHaveLength(0);
    expect(facade.calls.applyPreparedRestore).toHaveLength(1);

    cleanup();
    const other = setup();
    await toPreview(other, { kind: 'Prepared', token: TOKEN, preview: preview({ safetyChoiceRequired: false }) });
    await other.user.click(UNDERSTAND());
    other.facade.respond('applyPreparedRestore', restored('InstitutionAndAccountOnboarding'));
    await other.user.click(REPLACE());
    expect(await screen.findByRole('link', { name: 'Add an institution and account' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Add an institution and account' }).getAttribute('href')).toBe('/accounts');
  });

  it('should load the page afresh when Go to Trades is followed, since the summary and Trades share one path after a first-run Restore', async () => {
    const ctx = setup();
    await toPreview(ctx, { kind: 'Prepared', token: TOKEN, preview: preview({ safetyChoiceRequired: false }) });
    await ctx.user.click(UNDERSTAND());
    ctx.facade.respond('applyPreparedRestore', restored('Trades'));
    await ctx.user.click(REPLACE());
    const link = await screen.findByRole('link', { name: 'Go to Trades' });
    // An in-app navigation to the same path is cancelled by the router and changes nothing on screen.
    let defaultPrevented = true;
    const onBubble = (event: Event) => {
      defaultPrevented = event.defaultPrevented;
      event.preventDefault();
    };
    document.addEventListener('click', onBubble);
    await ctx.user.click(link);
    document.removeEventListener('click', onBubble);
    expect(defaultPrevented).toBe(false);
  });

  it('should report the Restored result to the shell so a readiness found after the Restore reaches the page', async () => {
    const report = vi.fn();
    const ctx = setup(report);
    await toPreview(ctx, { kind: 'Prepared', token: TOKEN, preview: preview({ safetyChoiceRequired: false }) });
    await ctx.user.click(UNDERSTAND());
    const result = { ...restored('Trades'), status: { kind: 'RecoveryOnly', failedChecks: [{ check: 'inventory', reason: 'InventoryInvalid' }] } } as unknown as ApplyPreparedRestoreResult;
    ctx.facade.respond('applyPreparedRestore', result);
    await ctx.user.click(REPLACE());
    await screen.findByRole('heading', { name: 'Restore complete' });
    expect(report).toHaveBeenCalledWith(result);
  });

  it('should show a rejected or conflicting apply with Your current journal is unchanged and Check the backup again', async () => {
    const ctx = setup();
    const { facade, user } = ctx;
    const cases: [ApplyPreparedRestoreResult, string][] = [
      [{ kind: 'Conflict', reason: 'TargetChanged', liveBinding: BINDING }, 'Your journal changed after the backup was checked.'],
      [{ kind: 'SafetyBackupStale', liveBinding: BINDING }, 'Your safety backup is out of date: the journal changed after it was made.'],
      [{ kind: 'CandidateChanged', store: 'trades', liveBinding: BINDING }, 'The checked backup is no longer available.'],
    ];
    await toPreview(ctx);
    for (const [result, sentence] of cases) {
      await user.click(UNDERSTAND());
      await user.click(screen.getByRole('radio', { name: 'Replace without a backup' }));
      await user.click(screen.getByRole('checkbox', { name: /cannot be recovered/ }));
      facade.respond('applyPreparedRestore', result);
      await user.click(REPLACE());
      expect(await screen.findByText(sentence)).toBeTruthy();
      expect(screen.getByText('Your current journal is unchanged.')).toBeTruthy();
      expect(screen.queryByText('Restore complete')).toBeNull();
      await user.click(screen.getByRole('button', { name: 'Check the backup again' }));
      await screen.findByText('Restoring replaces your entire current journal');
    }
    expect(facade.calls.prepareRestore).toHaveLength(4);
  });
});

describe('an unexpected apply failure (T8.13-B2)', () => {
  async function failApply(error: Error) {
    const ctx = setup();
    await toPreview(ctx);
    await ctx.user.click(UNDERSTAND());
    await ctx.user.click(screen.getByRole('radio', { name: 'Replace without a backup' }));
    await ctx.user.click(screen.getByRole('checkbox', { name: /cannot be recovered/ }));
    ctx.facade.respond('applyPreparedRestore', () => Promise.reject(error));
    await ctx.user.click(REPLACE());
    return ctx;
  }

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('should show the unfinished-Restore message when the Restore fails unexpectedly', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    const { user } = await failApply(new Error('boom'));
    expect(await screen.findByText("The Restore didn't finish. Reload the app to see which journal is in use.")).toBeTruthy();
    expect(screen.queryByText('Your current journal is unchanged.')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Reload' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('should write a developer log line when the Restore fails unexpectedly', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const error = new Error('boom');
    await failApply(error);
    await screen.findByText(/The Restore didn't finish/);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]).toEqual(['[Trade Journal]', { stage: 'Apply', name: 'Error', message: 'boom', stack: error.stack }]);
  });
});

describe('backup that cannot be checked because the journal is not writable (T8.13-B3)', () => {
  const NOT_WRITABLE = {
    kind: 'RuntimeNotWritable',
    runtimeReadiness: 'RecoveryOnly',
    failedChecks: [{ check: 'capacity', reason: 'InsufficientQuota' }],
    workspaceStatus: 'None',
    safeActions: [],
  } as unknown as PrepareRestoreResult;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should show the readiness sentence when the backup cannot be checked because the journal is not writable', async () => {
    const ctx = setup();
    ctx.facade.respond('prepareRestore', NOT_WRITABLE);
    await choose(ctx);
    expect(await screen.findByText('There is not enough storage space available in this browser for your journal and its safety margin.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Choose backup file' })).toBeTruthy();
  });

  it('should write a developer log line when the backup cannot be checked because the journal is not writable', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const ctx = setup();
    ctx.facade.respond('prepareRestore', NOT_WRITABLE);
    await choose(ctx);
    await screen.findByText(/not enough storage space/);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]).toEqual(['[Trade Journal]', { stage: 'Prepare', name: 'RuntimeNotWritable', message: 'The journal is not writable.', context: { failedChecks: 'capacity:InsufficientQuota' } }]);
  });
});

describe('Restore screen gaps (T8.13-F1)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const rejected = (issues: readonly object[], totalIssues = issues.length) => ({ kind: 'Rejected', totalIssues, liveBinding: BINDING, issues }) as unknown as PrepareRestoreResult;

  it('should show the fallback sentence for a module validator code with no sentence of its own', async () => {
    const ctx = setup();
    ctx.facade.respond('prepareRestore', rejected([{ code: 'PriceNegative', section: 'trades', line: 5, path: 'r.price' }]));
    await choose(ctx);
    expect(await screen.findByText("A record in the trades section didn't pass a check (PriceNegative).")).toBeTruthy();
  });

  it('should write one developer log line for a rejected backup with the issue count and the first issue code section line and path', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const ctx = setup();
    ctx.facade.respond('prepareRestore', rejected([{ code: 'PriceNegative', section: 'trades', line: 5, path: 'r.price' }, { code: 'UnsupportedFormat' }], 1234));
    await choose(ctx);
    await screen.findByText("This backup can't be restored.");
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]).toEqual(['[Trade Journal]', { stage: 'Prepare', name: 'Rejected', message: 'The backup was rejected.', context: { issueCount: 1234, code: 'PriceNegative', section: 'trades', line: 5, path: 'r.price' } }]);
  });

  it('should show the could-not-be-checked message with Choose backup file when preparing the backup fails unexpectedly', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const ctx = setup();
    ctx.facade.respond('prepareRestore', () => Promise.reject(new Error('boom')));
    await choose(ctx);
    expect(await screen.findByText("The backup couldn't be checked. Your current journal is unchanged.")).toBeTruthy();
    expect(screen.queryByText(/Checking the backup/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Choose backup file' })).toBeTruthy();
  });

  it('should write a developer log line with the error name and message and stack when preparing the backup fails unexpectedly', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const error = new Error('boom');
    const ctx = setup();
    ctx.facade.respond('prepareRestore', () => Promise.reject(error));
    await choose(ctx);
    await screen.findByText(/couldn't be checked/);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]).toEqual(['[Trade Journal]', { stage: 'Prepare', name: 'Error', message: 'boom', stack: error.stack }]);
  });

  it('should choose a or an from the kind word in the cross-section reference sentence', async () => {
    const ctx = setup();
    ctx.facade.respond(
      'prepareRestore',
      rejected([
        { code: 'CrossSectionReference', kind: 'Trade', identity: 't-1' },
        { code: 'CrossSectionReference', kind: 'Journal entry', identity: 'e-1' },
        { code: 'CrossSectionReference', kind: 'Account', identity: 'a-1' },
      ]),
    );
    await choose(ctx);
    expect(await screen.findByText("A record refers to a Trade that isn't in the backup (t-1).")).toBeTruthy();
    expect(screen.getByText("A record refers to a Journal entry that isn't in the backup (e-1).")).toBeTruthy();
    expect(screen.getByText("A record refers to an Account that isn't in the backup (a-1).")).toBeTruthy();
  });

  it('should show the version count once on the Trades total line and once on the Journal entries row and not on the Planned Open and Closed rows', async () => {
    const ctx = setup();
    await toPreview(ctx, { kind: 'Prepared', token: TOKEN, preview: preview({ counts: counts({ versions: { trades: 5, entries: 2, debts: 1 } }) }) });
    const table = screen.getByRole('table');
    const row = (label: string) => within(within(table).getByRole('rowheader', { name: label }).closest('tr')!).getAllByRole('cell').map((c) => c.textContent);
    expect(row('Trades')).toEqual(['6 (5 versions)', '6']);
    expect(row('Journal entries')).toEqual(['4 (2 versions)', '4']);
    for (const label of ['Planned Trades', 'Open Trades', 'Closed Trades', 'Journal entries: Plan', 'Reflections owed: Open']) expect(row(label)[0]).not.toMatch(/versions/);
    expect(table.textContent?.match(/versions/g)).toHaveLength(3);
  });

  it('should show the reflection debt version count once on a Reflections owed total row', async () => {
    const ctx = setup();
    await toPreview(ctx, { kind: 'Prepared', token: TOKEN, preview: preview({ counts: counts({ debtsByStatus: { Open: 2, Satisfied: 3 }, versions: { trades: 5, entries: 2, debts: 4 } }) }) });
    const rowOf = (label: string) => within(within(screen.getByRole('table')).getByRole('rowheader', { name: label }).closest('tr')!).getAllByRole('cell').map((c) => c.textContent);
    expect(rowOf('Reflections owed')).toEqual(['5 (4 versions)', '2']);
    expect(rowOf('Reflections owed: Open')[0]).toBe('2');
    expect(rowOf('Reflections owed: Satisfied')[0]).toBe('3');
    const labels = within(screen.getByRole('table')).getAllByRole('rowheader').map((h) => h.textContent);
    expect(labels.indexOf('Reflections owed') + 1).toBe(labels.indexOf('Reflections owed: Open'));
    const { facade, user } = ctx;
    await user.click(UNDERSTAND());
    await user.click(screen.getByRole('radio', { name: 'Replace without a backup' }));
    await user.click(screen.getByRole('checkbox', { name: /cannot be recovered/ }));
    facade.respond('applyPreparedRestore', restored('Trades', { debtsByStatus: { Open: 2 }, versions: { debts: 4 } }));
    await user.click(REPLACE());
    await screen.findByRole('heading', { name: 'Restore complete' });
    const summary = within(screen.getByRole('table').querySelector('tbody')!).getByRole('rowheader', { name: 'Reflections owed' }).closest('tr')!;
    expect(within(summary).getByRole('cell').textContent).toBe('2 (4 versions)');
  });
});
