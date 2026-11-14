// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
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
