// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import type {
  ApplyPreparedRestoreResult,
  ExportBackupResult,
  PrepareRestoreResult,
  RestoreCounts,
  RestorePreview,
  RestoreToken,
} from '../../app/types.ts';
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
    source: { createdAt: '2026-11-20T23:00:00Z', releaseId: '2026.11.14', schemaVersion: 7, exportKind: 'Normal' },
    counts: counts(),
    migrations: { steps: [{ from: 5, to: 6 }], seedAdditions: ['Long Call'] },
    repairs: [{ tradeId: 'trade-9', kind: 'Lifecycle', stored: 'Open', expected: 'Closed' }],
    providerNeedsSetup: [],
    target: { hasUserData: true, counts: counts({ marks: 99, accounts: 4 }), currentTimeZone: 'America/Chicago', restoredTimeZone: 'America/New_York' },
    warnings: ['TimeZoneDiffers', 'OlderSchema', 'AnotherTabHasUnsavedWork'],
    safetyChoiceRequired: true,
    ...overrides,
  };
}

const PREPARED: PrepareRestoreResult = { kind: 'Prepared', token: TOKEN, preview: preview() };

function setup() {
  const facade = createBackupFacadeDouble();
  const files = createFileSelectionDouble();
  files.choose(FILE);
  const utils = render(
    <MemoryRouter>
      <RestoreFlow facade={facade.facade} selectFile={files.port} />
    </MemoryRouter>,
  );
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
    expect(screen.getByText('trade-9: lifecycle recorded Open, facts say Closed. It will be corrected.')).toBeTruthy();
    expect(screen.getByText("The backup's time zone (America/New_York) differs from this journal's (America/Chicago). The restored journal uses the backup's.")).toBeTruthy();
    expect(screen.getByText("This backup was made by an earlier version and will be updated as it's restored.")).toBeTruthy();
    expect(screen.getByText('Another tab has unsaved changes. They will be lost when the journal is replaced.')).toBeTruthy();
  });
});

function restored(next: 'Trades' | 'InstitutionAndAccountOnboarding'): ApplyPreparedRestoreResult {
  return {
    kind: 'Restored',
    receipt: {
      artifactDigest: 'digest-1',
      replacedBinding: BINDING,
      newBinding: BINDING,
      counts: counts({ marks: 55 }),
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
