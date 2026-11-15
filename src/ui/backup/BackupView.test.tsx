// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ExportBackupResult } from '../../app/types.ts';
import { BackupView, type BackupViewProps } from './BackupView.tsx';
import { createBackupFacadeDouble, createFileSelectionDouble } from './test-support.ts';

afterEach(cleanup);

type Downloaded = Extract<ExportBackupResult, { kind: 'Downloaded' }>;
const BINDING = { revision: 3 } as unknown as Downloaded['sourceBinding'];
const DOWNLOADED: Downloaded = {
  kind: 'Downloaded',
  sourceBinding: BINDING,
  fullDigest: 'full-digest-1',
  manifestDigest: 'manifest-digest-1',
  fileName: 'trade-journal-2026-11-14.tjbackup.gz',
  counts: { trades: 2 },
  byteSize: 1234,
};

function setup(props: Partial<BackupViewProps> = {}) {
  const facade = createBackupFacadeDouble();
  const files = createFileSelectionDouble();
  const view = <BackupView facade={facade.facade} selectFile={files.port} readiness={{ kind: 'Writable' }} timeZone="America/New_York" {...props} />;
  const utils = render(view);
  return { facade, files, user: userEvent.setup(), utils, view };
}

const RECEIPT = {
  receiptId: 'receipt-1',
  sourceBinding: BINDING,
  fullDigest: DOWNLOADED.fullDigest,
  manifestDigest: DOWNLOADED.manifestDigest,
  evidence: { fileName: DOWNLOADED.fileName, byteSize: 1234, compressed: true, lineCount: 10 },
  // 16:05 in New York (UTC-5 in November).
  completedAt: '2026-11-14T21:05:00Z',
};

async function downloadFirst(ctx: ReturnType<typeof setup>) {
  ctx.facade.respond('exportBackup', DOWNLOADED);
  await ctx.user.click(screen.getByRole('button', { name: 'Download backup' }));
  await screen.findByRole('button', { name: 'Verify backup' });
}

describe('download (A141)', () => {
  it('should call exportBackup once on Download backup, show progress, then Downloaded not verified yet with the file name, the explanation that the app cannot see where the file was saved, and Verify backup, never Backup complete', async () => {
    const { facade, user } = setup();
    let finish: (result: ExportBackupResult) => void = () => undefined;
    facade.respond('exportBackup', (request) => {
      request.onProgress?.({ done: 1200, total: 5000 });
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    expect(screen.getByRole('heading', { level: 1, name: 'Backup' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Download a backup' })).toBeTruthy();
    expect(screen.getByText('While a backup is being made, saving waits until it finishes.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Download backup' }));
    expect(await screen.findByText('Making the backup: 1,200 of 5,000 records')).toBeTruthy();
    expect(facade.calls.exportBackup).toHaveLength(1);
    await act(() => {
      finish(DOWNLOADED);
      return Promise.resolve();
    });
    expect(await screen.findByText("Downloaded, not verified yet. This app can't see where your browser saved the file.")).toBeTruthy();
    expect(screen.getByText(DOWNLOADED.fileName)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Verify backup' })).toBeTruthy();
    expect(screen.queryByText(/Backup complete/)).toBeNull();
    expect(facade.calls.exportBackup).toHaveLength(1);
  });

  it('should show NotCompleted stage and reason with Retry', async () => {
    const { facade, user } = setup();
    facade.respond('exportBackup', { kind: 'NotCompleted', stage: 'Read', reason: 'ReadFailed', workspaceBinding: BINDING });
    await user.click(screen.getByRole('button', { name: 'Download backup' }));
    expect(await screen.findByText("The backup could not be made. Your journal couldn't be read. Nothing was changed.")).toBeTruthy();
    expect(screen.queryByText(/Downloaded, not verified/)).toBeNull();
    facade.respond('exportBackup', { kind: 'NotCompleted', stage: 'Offer', reason: 'OfferFailed', workspaceBinding: BINDING });
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText("The backup could not be made. Your browser didn't accept the download. Nothing was changed.")).toBeTruthy();
    expect(facade.calls.exportBackup).toHaveLength(2);
    facade.respond('exportBackup', DOWNLOADED);
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText(DOWNLOADED.fileName)).toBeTruthy();
    expect(screen.queryByText(/The backup could not be made/)).toBeNull();
  });

  it('should show each Not Completed reason in its own words', async () => {
    const { facade, user } = setup();
    const cases: [ExportBackupResult, string][] = [
      [{ kind: 'NotCompleted', stage: 'Read', reason: 'ReadFailed', workspaceBinding: BINDING }, "The backup could not be made. Your journal couldn't be read. Nothing was changed."],
      [{ kind: 'NotCompleted', stage: 'Offer', reason: 'OfferFailed', workspaceBinding: BINDING }, "The backup could not be made. Your browser didn't accept the download. Nothing was changed."],
      [{ kind: 'NotCompleted', stage: 'Read', reason: 'IntegrityBlocked', workspaceBinding: null }, 'The backup could not be made. Your journal has a problem that blocks a normal backup. Nothing was changed.'],
      [{ kind: 'Conflict', currentBinding: BINDING }, 'The backup could not be made. Your journal changed while the backup was being made. Nothing was changed.'],
    ];
    let button = 'Download backup';
    for (const [result, words] of cases) {
      facade.respond('exportBackup', result);
      await user.click(screen.getByRole('button', { name: button }));
      expect(await screen.findByText(words)).toBeTruthy();
      expect(screen.getAllByText(/The backup could not be made/)).toHaveLength(1);
      button = 'Retry';
    }
  });
});

describe('verify', () => {
  it('should open file selection and call confirmBackup with the binding and digest from the Downloaded result in view state, showing Backup complete with the completion time only for Completed', async () => {
    const ctx = setup();
    const { facade, files, user } = ctx;
    await downloadFirst(ctx);
    const file = new File(['x'], 'chosen.gz');
    files.choose(file);
    let finish: (result: unknown) => void = () => undefined;
    facade.respond('confirmBackup', (request) => {
      request.onProgress?.({ done: 1200, total: 5000 });
      return new Promise((resolve) => {
        finish = resolve as never;
      });
    });
    await user.click(screen.getByRole('button', { name: 'Verify backup' }));
    expect(await screen.findByText('Checking the file: 1,200 of 5,000 records')).toBeTruthy();
    expect(files.requests()).toBe(1);
    expect(facade.calls.confirmBackup).toHaveLength(1);
    expect(facade.calls.confirmBackup[0]).toMatchObject({ file, expectedBinding: BINDING, expectedFullDigest: 'full-digest-1' });
    expect(screen.queryByText(/Backup complete/)).toBeNull();
    await act(() => {
      finish({ kind: 'Completed', receipt: RECEIPT });
      return Promise.resolve();
    });
    expect(await screen.findByText('Backup complete. Checked Sat Nov 14, 16:05.')).toBeTruthy();
  });

  it('should replace the Downloaded line with Backup complete once verification completes', async () => {
    const ctx = setup();
    const { facade, files, user } = ctx;
    await downloadFirst(ctx);
    files.choose(new File(['x'], 'chosen.gz'));
    facade.respond('confirmBackup', () => Promise.resolve({ kind: 'Completed', receipt: RECEIPT }) as never);
    expect(screen.queryByText(/Downloaded, not verified yet/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Verify backup' }));
    expect(await screen.findByText('Backup complete. Checked Sat Nov 14, 16:05.')).toBeTruthy();
    expect(screen.queryByText(/Downloaded, not verified yet/)).toBeNull();
  });

  it('should show each Not Verified reason in plain language with Choose another file and no completed state', async () => {
    const ctx = setup();
    const { facade, files, user } = ctx;
    await downloadFirst(ctx);
    files.choose(new File(['x'], 'chosen.gz'));
    const messages = {
      Unreadable: "This file couldn't be read. Choose the file you just downloaded.",
      IncompleteOrCorrupt: "This file is incomplete or damaged, so it isn't a usable backup.",
      DifferentArtifact: 'This is a different backup from the one you just downloaded.',
    } as const;
    let expectedCalls = 0;
    for (const [reason, message] of Object.entries(messages) as [keyof typeof messages, string][]) {
      facade.respond('confirmBackup', { kind: 'NotVerified', reason });
      await user.click(screen.getAllByRole('button', { name: /^(Verify backup|Choose another file)$/ })[0]!);
      expect(await screen.findByText(message)).toBeTruthy();
      expect(screen.getAllByRole('button', { name: 'Choose another file' })).toHaveLength(1);
      expect(screen.queryByText(/Backup complete/)).toBeNull();
      expectedCalls += 1;
      expect(facade.calls.confirmBackup).toHaveLength(expectedCalls);
    }
    expect(files.requests()).toBe(3);
  });

  it('should not carry an earlier verification result over to a new download, nor apply a verification that finishes after a new download', async () => {
    const ctx = setup();
    const { facade, files, user } = ctx;
    await downloadFirst(ctx);
    files.choose(new File(['x'], 'chosen.gz'));
    facade.respond('confirmBackup', { kind: 'Completed', receipt: RECEIPT });
    await user.click(screen.getByRole('button', { name: 'Verify backup' }));
    expect(await screen.findByText(/Backup complete/)).toBeTruthy();
    // Backup B replaces backup A: A's result must not show under B.
    facade.respond('exportBackup', { ...DOWNLOADED, fileName: 'second.tjbackup.gz' });
    await user.click(screen.getByRole('button', { name: 'Download backup' }));
    expect(await screen.findByText('second.tjbackup.gz')).toBeTruthy();
    expect(screen.queryByText(/Backup complete/)).toBeNull();
    // A check still running when B is downloaded must not write its result under B.
    let finish: (result: unknown) => void = () => undefined;
    facade.respond('confirmBackup', () => new Promise((resolve) => (finish = resolve as never)));
    await user.click(screen.getByRole('button', { name: 'Verify backup' }));
    await screen.findByText('Checking the file');
    facade.respond('exportBackup', { ...DOWNLOADED, fileName: 'third.tjbackup.gz' });
    await user.click(screen.getByRole('button', { name: 'Download backup' }));
    expect(await screen.findByText('third.tjbackup.gz')).toBeTruthy();
    await act(() => {
      finish({ kind: 'Completed', receipt: RECEIPT });
      return Promise.resolve();
    });
    expect(screen.queryByText(/Backup complete/)).toBeNull();
  });

  it('should ignore progress from a verification started before a newer download', async () => {
    const ctx = setup();
    const { facade, files, user } = ctx;
    await downloadFirst(ctx);
    files.choose(new File(['x'], 'chosen.gz'));
    facade.respond('confirmBackup', () => new Promise(() => undefined));
    await user.click(screen.getByRole('button', { name: 'Verify backup' }));
    await screen.findByText('Checking the file');
    facade.respond('exportBackup', { ...DOWNLOADED, fileName: 'second.tjbackup.gz' });
    await user.click(screen.getByRole('button', { name: 'Download backup' }));
    expect(await screen.findByText('second.tjbackup.gz')).toBeTruthy();
    // The old check reports progress after the newer download.
    await act(() => {
      facade.calls.confirmBackup[0]?.onProgress?.({ done: 1, total: 2 });
      return Promise.resolve();
    });
    expect(screen.queryByText(/Checking the file/)).toBeNull();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Verify backup' }).disabled).toBe(false);
  });

  it('should drop a verification whose file was chosen for an earlier download', async () => {
    let choose: (chosen: { kind: 'Chosen'; file: File }) => void = () => undefined;
    const open = new Promise<{ kind: 'Chosen'; file: File }>((resolve) => (choose = resolve));
    const ctx = setup({ selectFile: { choose: () => open } });
    const { facade, user } = ctx;
    await downloadFirst(ctx);
    facade.respond('confirmBackup', { kind: 'Completed', receipt: RECEIPT });
    // The picker opens for the first download and stays open.
    await user.click(screen.getByRole('button', { name: 'Verify backup' }));
    facade.respond('exportBackup', { ...DOWNLOADED, fileName: 'second.tjbackup.gz' });
    await user.click(screen.getByRole('button', { name: 'Download backup' }));
    expect(await screen.findByText('second.tjbackup.gz')).toBeTruthy();
    await act(() => {
      choose({ kind: 'Chosen', file: new File(['x'], 'chosen.gz') });
      return Promise.resolve();
    });
    expect(facade.calls.confirmBackup).toHaveLength(0);
    expect(screen.queryByText(/Checking the file/)).toBeNull();
    expect(screen.queryByText(/Backup complete/)).toBeNull();
  });

  it('should forget the Downloaded result when the page is left, so Verify backup is offered again only after a new download', async () => {
    const ctx = setup();
    await downloadFirst(ctx);
    ctx.utils.unmount();
    render(ctx.view);
    expect(screen.queryByRole('button', { name: 'Verify backup' })).toBeNull();
    expect(screen.queryByText(DOWNLOADED.fileName)).toBeNull();
    await ctx.user.click(screen.getByRole('button', { name: 'Download backup' }));
    expect(await screen.findByRole('button', { name: 'Verify backup' })).toBeTruthy();
    expect(ctx.facade.calls.exportBackup).toHaveLength(2);
  });
});

describe('Recovery Only (A144)', () => {
  it('should offer Download backup and Verify backup, and show Restore needs a browser that can save safely with the failed checks instead of the Restore section', async () => {
    const writable = setup();
    expect(screen.getByRole('heading', { name: 'Restore from a backup' })).toBeTruthy();
    expect(screen.queryByText('Restore needs a browser that can save safely')).toBeNull();
    writable.utils.unmount();

    const ctx = setup({
      readiness: {
        kind: 'RecoveryOnly',
        failedChecks: [
          { check: 'capacity', reason: 'InsufficientQuota' },
          { check: 'control', reason: 'NotControlled' },
        ],
      },
    });
    expect(screen.getByRole('button', { name: 'Download backup' })).toBeTruthy();
    await downloadFirst(ctx);
    expect(screen.getByRole('button', { name: 'Verify backup' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Restore needs a browser that can save safely' })).toBeTruthy();
    expect(screen.getByText('There is not enough storage space available in this browser for your journal and its safety margin.')).toBeTruthy();
    expect(screen.getByText("The app's offline component is not in control of this page yet.")).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Restore from a backup' })).toBeNull();
  });
});

describe('Restore completion (A142)', () => {
  it('should discard the Backup page download and verification when a Restore completes', async () => {
    const facade = createBackupFacadeDouble();
    const files = createFileSelectionDouble();
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <BackupView facade={facade.facade} selectFile={files.port} readiness={{ kind: 'Writable' }} timeZone="America/New_York" />
      </MemoryRouter>,
    );
    facade.respond('exportBackup', DOWNLOADED);
    await user.click(screen.getByRole('button', { name: 'Download backup' }));
    await screen.findByRole('button', { name: 'Verify backup' });
    files.choose(new File(['x'], 'chosen.gz'));
    facade.respond('confirmBackup', { kind: 'Completed', receipt: RECEIPT });
    await user.click(screen.getByRole('button', { name: 'Verify backup' }));
    expect(await screen.findByText('Backup complete. Checked Sat Nov 14, 16:05.')).toBeTruthy();

    await completeRestore(facade, files, user);

    expect(screen.queryByText(DOWNLOADED.fileName)).toBeNull();
    expect(screen.queryByText(/Backup complete/)).toBeNull();
    expect(screen.queryByText(/Downloaded, not verified/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Verify backup' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Download backup' })).toBeTruthy();
  });
});

async function completeRestore(facade: ReturnType<typeof createBackupFacadeDouble>, files: ReturnType<typeof createFileSelectionDouble>, user: ReturnType<typeof userEvent.setup>) {
  {
    const token ={ candidateId: 'cand-1', fullDigest: 'digest-1', targetBinding: BINDING, releaseId: '2026.11.14' };
    const counts = {
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
    };
    const target = { hasUserData: true, counts, currentTimeZone: 'America/New_York', restoredTimeZone: 'America/New_York' };
    const source = { createdAt: '2026-11-20T23:00:00Z', releaseId: '2026.11.14', schemaVersion: 7, exportKind: 'Normal' };
    const preview = { source, counts, migrations: { steps: [], seedAdditions: [] }, repairs: [], providerNeedsSetup: [], target, warnings: [], safetyChoiceRequired: false };
    files.choose(new File(['x'], 'restore.gz'));
    facade.respond('prepareRestore', { kind: 'Prepared', token, preview } as never);
    await user.click(screen.getByRole('button', { name: 'Choose backup file' }));
    await user.click(await screen.findByRole('checkbox', { name: 'I understand this replaces my entire current journal' }));
    facade.respond('applyPreparedRestore', {
      kind: 'Restored',
      receipt: { artifactDigest: 'digest-1', replacedBinding: BINDING, newBinding: BINDING, counts, migrations: { steps: [], seedAdditions: [] }, repairs: [], readiness: {} },
      status: { kind: 'Ready' },
      landing: { kind: 'RestoreComplete', next: 'Trades' },
    } as never);
    await user.click(screen.getByRole('button', { name: 'Replace entire journal' }));
    expect(await screen.findByRole('heading', { name: 'Restore complete' })).toBeTruthy();
  }
}

describe('Restore completion with a download in flight (A142)', () => {
  it('should discard a backup download that finishes after a Restore completes', async () => {
    const facade = createBackupFacadeDouble();
    const files = createFileSelectionDouble();
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <BackupView facade={facade.facade} selectFile={files.port} readiness={{ kind: 'Writable' }} timeZone="America/New_York" />
      </MemoryRouter>,
    );
    let finish: (result: Downloaded) => void = () => undefined;
    facade.respond('exportBackup', () => new Promise<Downloaded>((resolve) => (finish = resolve)));
    await user.click(screen.getByRole('button', { name: 'Download backup' }));
    await completeRestore(facade, files, user);
    await act(() => {
      finish(DOWNLOADED);
      return Promise.resolve();
    });
    expect(screen.queryByText(DOWNLOADED.fileName)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Verify backup' })).toBeNull();
    expect(screen.queryByText(/Making the backup/)).toBeNull();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Download backup' }).disabled).toBe(false);
  });
});

describe('developer log (Q5)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('should log the failure detail when a backup is not completed', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { facade, user } = setup();
    const detail = { stage: 'Read', name: 'NotFoundError', message: 'store missing', context: { store: 'trades' } };
    facade.respond('exportBackup', { kind: 'NotCompleted', stage: 'Read', reason: 'ReadFailed', workspaceBinding: BINDING, detail });
    await user.click(screen.getByRole('button', { name: 'Download backup' }));
    await screen.findByText(/The backup could not be made/);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]).toEqual(['[Trade Journal]', detail]);
  });

  it('should log the failure detail when a downloaded backup is not verified', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const ctx = setup();
    await downloadFirst(ctx);
    ctx.files.choose(new File(['x'], 'chosen.gz'));
    const detail = { stage: 'Verify', name: 'SyntaxError', message: 'bad line', context: { line: 4 } };
    ctx.facade.respond('confirmBackup', { kind: 'NotVerified', reason: 'IncompleteOrCorrupt', detail });
    await ctx.user.click(screen.getByRole('button', { name: 'Verify backup' }));
    await screen.findByText(/incomplete or damaged/);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]).toEqual(['[Trade Journal]', detail]);
  });

  it('should log an unexpected failure while making or checking a backup', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const ctx = setup();
    const buildError = new Error('build boom');
    ctx.facade.respond('exportBackup', () => Promise.reject(buildError));
    await ctx.user.click(screen.getByRole('button', { name: 'Download backup' }));
    await screen.findByText(/The backup could not be made/);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]).toEqual(['[Trade Journal]', { stage: 'Build', name: 'Error', message: 'build boom', stack: buildError.stack }]);
    log.mockClear();
    ctx.facade.respond('exportBackup', DOWNLOADED);
    await ctx.user.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByRole('button', { name: 'Verify backup' });
    ctx.files.choose(new File(['x'], 'chosen.gz'));
    const verifyError = new TypeError('verify boom');
    ctx.facade.respond('confirmBackup', () => Promise.reject(verifyError));
    await ctx.user.click(screen.getByRole('button', { name: 'Verify backup' }));
    await screen.findByText(/couldn't be read/);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]).toEqual(['[Trade Journal]', { stage: 'Verify', name: 'TypeError', message: 'verify boom', stack: verifyError.stack }]);
  });

  it('should log the stage and reason when a failed result carries no detail', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const ctx = setup();
    ctx.facade.respond('exportBackup', { kind: 'NotCompleted', stage: 'Offer', reason: 'OfferFailed', workspaceBinding: BINDING });
    await ctx.user.click(screen.getByRole('button', { name: 'Download backup' }));
    await screen.findByText(/The backup could not be made/);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]).toEqual(['[Trade Journal]', { stage: 'Offer', name: 'OfferFailed', message: 'The result carried no detail.' }]);
    log.mockClear();
    ctx.facade.respond('exportBackup', DOWNLOADED);
    await ctx.user.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByRole('button', { name: 'Verify backup' });
    ctx.files.choose(new File(['x'], 'chosen.gz'));
    ctx.facade.respond('confirmBackup', { kind: 'NotVerified', reason: 'DifferentArtifact' });
    await ctx.user.click(screen.getByRole('button', { name: 'Verify backup' }));
    await screen.findByText(/different backup/);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]).toEqual(['[Trade Journal]', { stage: 'Verify', name: 'DifferentArtifact', message: 'The result carried no detail.' }]);
  });
});
