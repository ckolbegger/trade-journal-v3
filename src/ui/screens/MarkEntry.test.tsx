// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { facadeDouble } from '../../../tests/support/facade-double.ts';
import type { UiFacade } from '../../app/compose.ts';
import type { ExpectedResolutionRevision, MarketDataIssue, MarketDataSaveResult, MarkResolution } from '../../app/types.ts';
import { RuntimeContext } from '../runtime.tsx';
import { MarkEntry } from './MarkEntry.tsx';

afterEach(cleanup);

const key = { instrumentKey: 'XYZ', tradingDate: '2026-10-12' };
const mark = (price: string, revisionNumber = 1, correctionReason?: string) =>
  ({
    kind: 'Available',
    mark: { revisionId: `r${revisionNumber}`, revisionNumber, price, source: 'Manual', savedAt: '2026-10-12T21:00:00Z', ...(correctionReason && { correctionReason }) },
  }) as const satisfies MarkResolution;
type FacadeSaveResult = Awaited<ReturnType<UiFacade['MarketData']['save']>>;
const rejected = (...issues: MarketDataIssue[]): Extract<FacadeSaveResult, { kind: 'Rejected' }> => ({ kind: 'Rejected', issues });
const storageFailure: Extract<FacadeSaveResult, { kind: 'StorageFailure' }> = { kind: 'StorageFailure', reason: 'QuotaExceededError' };
type Saved = Extract<MarketDataSaveResult, { kind: 'Saved' }>;
type Acknowledgment = Extract<Saved, { acknowledgment: unknown }>['acknowledgment'];
type Available = Extract<MarkResolution, { kind: 'Available' }>;
// A Mark save result: the intention's classification and the expected revision the request carried.
const savedMark = (resolution: Available, expectedResolutionRevision: ExpectedResolutionRevision, classification: 'InitialManual' | 'Correction' = 'InitialManual'): Saved => ({
  kind: 'Saved',
  key,
  resolution,
  resolutionRevision: resolution.mark.revisionNumber,
  classification,
  revision: {
    revisionId: resolution.mark.revisionId,
    revisionNumber: resolution.mark.revisionNumber,
    price: resolution.mark.price,
    source: 'Manual',
    intention: classification,
    ...(resolution.mark.correctionReason && { reason: resolution.mark.correctionReason }),
    observedAt: '2026-10-12T21:00:00Z',
    savedAt: resolution.mark.savedAt,
  },
  binding: { ...key, expectedResolutionRevision },
});
// An acknowledgment save result; Asserted resolves to AcknowledgedUnavailable, Withdrawn to Missing.
const savedAcknowledgment = (acknowledgment: Acknowledgment, resolutionRevision: number, expectedResolutionRevision: ExpectedResolutionRevision): Saved => ({
  kind: 'Saved',
  key,
  resolution: acknowledgment.kind === 'Asserted' ? { kind: 'AcknowledgedUnavailable', acknowledgment } : { kind: 'Missing' },
  resolutionRevision,
  classification: acknowledgment.kind,
  acknowledgment,
  binding: { ...key, expectedResolutionRevision },
});
const withdrawn: Acknowledgment = { versionId: 'a2', kind: 'Withdrawn', savedAt: '2026-10-12T21:00:00Z' };

// Like the shell: a RuntimeNotWritable result reported by a screen turns the whole runtime read only.
function ShellLike({ children }: { readonly children: ReactNode }) {
  const [writable, setWritable] = useState(true);
  return <RuntimeContext.Provider value={{ writable, report: (result) => result.kind === 'RuntimeNotWritable' && setWritable(false) }}>{children}</RuntimeContext.Provider>;
}

function renderEntry(
  resolution: MarkResolution = { kind: 'Missing' },
  resolutionRevision: ExpectedResolutionRevision = 'None',
  options: { writable?: boolean; onDirtyChange?: (dirty: boolean) => void; report?: (result: { kind: string }) => void; facade?: UiFacade; shellLike?: boolean } = {},
) {
  const facade = options.facade ?? facadeDouble();
  const Provider = options.shellLike ? ShellLike : ({ children }: { children: ReactNode }) => <RuntimeContext.Provider value={{ writable: options.writable ?? true, report: options.report ?? (() => undefined) }}>{children}</RuntimeContext.Provider>;
  render(
    <Provider>
      <MarkEntry
        facade={facade}
        instrumentKey="XYZ"
        tradingDate="2026-10-12"
        resolution={resolution}
        resolutionRevision={resolutionRevision}
        onDirtyChange={options.onDirtyChange ?? (() => undefined)}
      />
    </Provider>,
  );
  return facade;
}

describe('entering, correcting, acknowledging, withdrawing', () => {
  it('should submit an initial Mark with the Instrument, date, price, and expected resolution revision, then render the saved resolution from the result without a read call', async () => {
    const facade = facadeDouble();
    vi.mocked(facade.MarketData.save).mockResolvedValue(savedMark(mark('52.5'), 'None'));
    renderEntry({ kind: 'Missing' }, 'None', { facade });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Enter' }));
    await user.type(screen.getByLabelText('Price'), '52.5');
    await user.click(screen.getByRole('button', { name: 'Save Mark' }));

    expect(facade.MarketData.save).toHaveBeenCalledExactlyOnceWith({ intention: 'RecordInitialManualMark', ...key, price: '52.5', expectedResolutionRevision: 'None' });
    expect(await screen.findByText('$52.50')).toBeTruthy();
    expect(screen.getByText(/Manual/)).toBeTruthy();
    expect(screen.queryByLabelText('Price')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Enter' })).toBeNull();
    expect(facade.MarketData.query).not.toHaveBeenCalled();
    expect(facade.MarketData.recover).not.toHaveBeenCalled();
  });

  it('should open Correct with the effective price shown, require a reason, and submit the new price and reason', async () => {
    const facade = facadeDouble();
    vi.mocked(facade.MarketData.save).mockResolvedValue(savedMark(mark('53', 2, 'Typo in the close'), 1, 'Correction'));
    renderEntry(mark('52.5'), 1, { facade });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Correct' }));
    const form = screen.getByRole('form', { name: 'Correct the Mark' });
    expect(within(form).getByText('Current price $52.50')).toBeTruthy();
    expect(within(form).getByLabelText<HTMLInputElement>('Price').value).toBe('');
    await user.type(within(form).getByLabelText('Price'), '53');
    await user.type(within(form).getByLabelText('Reason (required)'), 'Typo in the close');
    await user.click(within(form).getByRole('button', { name: 'Save correction' }));

    expect(facade.MarketData.save).toHaveBeenCalledExactlyOnceWith({
      intention: 'CorrectMark',
      ...key,
      price: '53',
      reason: 'Typo in the close',
      expectedResolutionRevision: 1,
    });
    expect(await screen.findByText('$53.00')).toBeTruthy();
    expect(screen.getByText(/Typo in the close/)).toBeTruthy();
    expect(screen.queryByRole('form')).toBeNull();
  });

  it('should submit Cant get a price with a required reason and render Acknowledged Unavailable as a trader acknowledgment, never as a price', async () => {
    const facade = facadeDouble();
    const acknowledged: MarkResolution = {
      kind: 'AcknowledgedUnavailable',
      acknowledgment: { versionId: 'a1', kind: 'Asserted', reason: 'Vendor outage', savedAt: '2026-10-12T21:00:00Z' },
    };
    vi.mocked(facade.MarketData.save).mockResolvedValue(savedAcknowledgment(acknowledged.acknowledgment, 1, 'None'));
    renderEntry({ kind: 'Missing' }, 'None', { facade });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: "Can't get a price" }));
    const form = screen.getByRole('form', { name: "Can't get a price" });
    expect(within(form).queryByLabelText('Price')).toBeNull();
    await user.type(within(form).getByLabelText('Reason (required)'), 'Vendor outage');
    await user.click(within(form).getByRole('button', { name: 'Save acknowledgment' }));

    expect(facade.MarketData.save).toHaveBeenCalledExactlyOnceWith({ intention: 'AssertUnavailable', ...key, reason: 'Vendor outage', expectedResolutionRevision: 'None' });
    expect(await screen.findByText('Acknowledged Unavailable')).toBeTruthy();
    expect(screen.getByText(/You said you can’t get a price/)).toBeTruthy();
    expect(screen.getByText(/Vendor outage/)).toBeTruthy();
    expect(screen.getByRole('region', { name: 'XYZ Mark, Mon Oct 12' }).textContent).not.toContain('$');
  });

  it('should offer Withdraw on an acknowledged key and render Missing afterwards', async () => {
    const facade = facadeDouble();
    vi.mocked(facade.MarketData.save).mockResolvedValue(savedAcknowledgment(withdrawn, 2, 1));
    renderEntry({ kind: 'AcknowledgedUnavailable', acknowledgment: { versionId: 'a1', kind: 'Asserted', savedAt: '2026-10-12T21:00:00Z' } }, 1, { facade });
    const user = userEvent.setup();
    expect(screen.queryByRole('button', { name: 'Correct' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Withdraw' }));

    expect(facade.MarketData.save).toHaveBeenCalledExactlyOnceWith({ intention: 'WithdrawAcknowledgment', ...key, expectedResolutionRevision: 1 });
    expect(await screen.findByText('Missing')).toBeTruthy();
    expect(screen.queryByText('Acknowledged Unavailable')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Withdraw' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Enter' })).toBeTruthy();
  });

  it('should offer Enter on an acknowledged key and save the Mark under that key revision', async () => {
    const facade = facadeDouble();
    vi.mocked(facade.MarketData.save).mockResolvedValue(savedMark(mark('52.5', 3), 2));
    renderEntry({ kind: 'AcknowledgedUnavailable', acknowledgment: { versionId: 'a1', kind: 'Asserted', savedAt: '2026-10-12T21:00:00Z' } }, 2, { facade });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Enter' }));
    await user.type(screen.getByLabelText('Price'), '52.5');
    await user.click(screen.getByRole('button', { name: 'Save Mark' }));

    expect(facade.MarketData.save).toHaveBeenCalledExactlyOnceWith({ intention: 'RecordInitialManualMark', ...key, price: '52.5', expectedResolutionRevision: 2 });
    expect(await screen.findByText('$52.50', { exact: false })).toBeTruthy();
  });

  it('should show InvalidPrice, ReasonRequired, ReasonTooLong, CorrectionUnchanged, and MarkExists beside their fields and move focus to the first', async () => {
    const facade = facadeDouble();
    const save = vi.mocked(facade.MarketData.save);
    renderEntry({ kind: 'Missing' }, 'None', { facade });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Enter' }));
    const price = screen.getByLabelText('Price');
    await user.type(price, 'abc');
    save.mockResolvedValueOnce(rejected({ field: 'price', code: 'InvalidPrice' }));
    await user.click(screen.getByRole('button', { name: 'Save Mark' }));
    const invalid = await screen.findByText('Enter a price as a number, with at most 6 decimal places.');
    expect(price.getAttribute('aria-invalid')).toBe('true');
    expect(price.getAttribute('aria-describedby')).toBe(invalid.id);
    expect(document.activeElement).toBe(price);
    cleanup();

    // Correct: an unchanged price and a missing reason, price first.
    renderEntry(mark('52.5'), 1, { facade });
    await user.click(screen.getByRole('button', { name: 'Correct' }));
    const newPrice = screen.getByLabelText('Price');
    const reason = screen.getByLabelText('Reason (required)');
    await user.type(newPrice, '52.5');
    save.mockResolvedValueOnce(rejected({ field: 'price', code: 'CorrectionUnchanged' }, { field: 'reason', code: 'ReasonRequired' }));
    await user.click(screen.getByRole('button', { name: 'Save correction' }));
    const unchanged = await screen.findByText('That is already the Mark; enter a different price.');
    const required = screen.getByText('Enter the reason for the correction.');
    expect(newPrice.getAttribute('aria-describedby')).toBe(unchanged.id);
    expect(reason.getAttribute('aria-describedby')).toBe(required.id);
    expect(document.activeElement).toBe(newPrice);

    // Only a reason issue: focus goes to the reason.
    save.mockResolvedValueOnce(rejected({ field: 'reason', code: 'ReasonTooLong' }));
    await user.click(screen.getByRole('button', { name: 'Save correction' }));
    const tooLong = await screen.findByText('Keep the reason to 500 characters or fewer.');
    expect(reason.getAttribute('aria-describedby')).toBe(tooLong.id);
    expect(newPrice.getAttribute('aria-describedby')).toBeNull();
    expect(document.activeElement).toBe(reason);
    cleanup();

    // MarkExists belongs to the key, not a field: it shows in the form and takes focus.
    renderEntry({ kind: 'Missing' }, 'None', { facade });
    await user.click(screen.getByRole('button', { name: "Can't get a price" }));
    await user.type(screen.getByLabelText('Reason (required)'), 'No feed');
    save.mockResolvedValueOnce(rejected({ field: 'key', code: 'MarkExists' }));
    await user.click(screen.getByRole('button', { name: 'Save acknowledgment' }));
    const exists = await screen.findByText('A Mark already exists for this date, so it cannot be marked unavailable.');
    expect(document.activeElement).toBe(exists);
  });

  it('should show PriceNegative beside the price and any other rejection for the Mark as a whole, even with no form open', async () => {
    const facade = facadeDouble();
    const save = vi.mocked(facade.MarketData.save);
    renderEntry({ kind: 'Missing' }, 'None', { facade });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Enter' }));
    const price = screen.getByLabelText('Price');
    await user.type(price, '-1');
    save.mockResolvedValueOnce(rejected({ field: 'price', code: 'PriceNegative' }));
    await user.click(screen.getByRole('button', { name: 'Save Mark' }));
    const negative = await screen.findByText('A price cannot be negative.');
    expect(price.getAttribute('aria-describedby')).toBe(negative.id);
    expect(document.activeElement).toBe(price);
    cleanup();

    renderEntry({ kind: 'AcknowledgedUnavailable', acknowledgment: { versionId: 'a1', kind: 'Asserted', savedAt: '2026-10-12T21:00:00Z' } }, 1, { facade });
    save.mockResolvedValueOnce(rejected({ field: 'key', code: 'NothingToWithdraw' }));
    await user.click(screen.getByRole('button', { name: 'Withdraw' }));
    const failed = await screen.findByText('This Mark could not be saved. Reopen it and try again.');
    expect(document.activeElement).toBe(failed);
  });

  it('should show Conflict with the entered values kept and the current resolution displayed', async () => {
    const facade = facadeDouble();
    const save = vi.mocked(facade.MarketData.save);
    save.mockResolvedValueOnce({ kind: 'Conflict', key, resolution: mark('51'), resolutionRevision: 1 });
    renderEntry({ kind: 'Missing' }, 'None', { facade });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Enter' }));
    await user.type(screen.getByLabelText('Price'), '52.5');
    await user.click(screen.getByRole('button', { name: 'Save Mark' }));

    const conflict = await screen.findByRole('alert');
    expect(conflict.textContent).toContain('This Mark changed after you opened it');
    expect(conflict.textContent).toContain('Nothing was saved');
    expect(document.activeElement).toBe(conflict);
    expect(screen.getByText('$51.00')).toBeTruthy();
    expect(screen.queryByText('Missing')).toBeNull();
    expect(screen.getByLabelText<HTMLInputElement>('Price').value).toBe('52.5');

    // Saving again binds to the revision the Conflict returned.
    save.mockResolvedValueOnce(rejected({ field: 'key', code: 'MarkExists' }));
    await user.click(screen.getByRole('button', { name: 'Save Mark' }));
    expect(save).toHaveBeenLastCalledWith({ intention: 'RecordInitialManualMark', ...key, price: '52.5', expectedResolutionRevision: 1 });
  });

  it('should make no call when cancelled or left, register as unsaved while a value has been entered, and offer its actions only while Writable', async () => {
    const facade = facadeDouble();
    const unwritable = (resolution: MarkResolution) => {
      renderEntry(resolution, 1, { facade, writable: false });
      expect(screen.queryAllByRole('button')).toEqual([]);
      cleanup();
    };
    unwritable({ kind: 'Missing' });
    unwritable(mark('52.5'));
    unwritable({ kind: 'AcknowledgedUnavailable', acknowledgment: { versionId: 'a1', kind: 'Asserted', savedAt: '2026-10-12T21:00:00Z' } });
    renderEntry({ kind: 'Missing' }, 'None', { facade, writable: false });
    expect(screen.getByText('Missing')).toBeTruthy();
    cleanup();

    // Opening a form is not unsaved; entering a value is, and clearing it again is not.
    const onDirtyChange = vi.fn();
    renderEntry({ kind: 'Missing' }, 'None', { facade, onDirtyChange });
    const user = userEvent.setup();
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    await user.click(screen.getByRole('button', { name: 'Enter' }));
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    await user.type(screen.getByLabelText('Price'), '5');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    await user.clear(screen.getByLabelText('Price'));
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);

    // Cancel discards the values and calls nothing.
    await user.type(screen.getByLabelText('Price'), '52.5');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('form')).toBeNull();
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    await user.click(screen.getByRole('button', { name: 'Enter' }));
    expect(screen.getByLabelText<HTMLInputElement>('Price').value).toBe('');

    // Leaving with a value entered releases the update hold and calls nothing.
    await user.type(screen.getByLabelText('Price'), '52.5');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    cleanup();
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    expect(facade.MarketData.save).not.toHaveBeenCalled();
  });

  it('should report a refused write to the shell and keep the entered values', async () => {
    const facade = facadeDouble();
    const refused: Extract<FacadeSaveResult, { kind: 'RuntimeNotWritable' }> = {
      kind: 'RuntimeNotWritable',
      runtimeReadiness: 'RecoveryOnly',
      failedChecks: [{ check: 'control', reason: 'ControlRecordUnreadable' }],
      workspaceStatus: 'RecoveryOnly',
      safeActions: [{ action: 'Reload', explanation: 'Reload the page.' }],
    };
    vi.mocked(facade.MarketData.save).mockResolvedValue(refused);
    const report = vi.fn();
    renderEntry({ kind: 'Missing' }, 'None', { facade, report });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Enter' }));
    await user.type(screen.getByLabelText('Price'), '52.5');
    await user.click(screen.getByRole('button', { name: 'Save Mark' }));
    await vi.waitFor(() => expect(report).toHaveBeenCalledExactlyOnceWith(refused));
    expect(screen.getByLabelText<HTMLInputElement>('Price').value).toBe('52.5');
  });

  it('should keep an entered price, and a correction with its reason, on screen when the shell turns read only, with no working Save', async () => {
    const refused = { kind: 'RuntimeNotWritable', runtimeReadiness: 'RecoveryOnly', failedChecks: [], workspaceStatus: 'RecoveryOnly', safeActions: [] } as const;
    const facade = facadeDouble();
    vi.mocked(facade.MarketData.save).mockResolvedValue(refused);
    renderEntry({ kind: 'Missing' }, 'None', { facade, shellLike: true });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Enter' }));
    await user.type(screen.getByLabelText('Price'), '52.5');
    await user.click(screen.getByRole('button', { name: 'Save Mark' }));
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Save Mark' })).toHaveProperty('disabled', true));
    expect(screen.getByLabelText<HTMLInputElement>('Price').value).toBe('52.5');
    cleanup();

    renderEntry(mark('52.5'), 1, { facade, shellLike: true });
    await user.click(screen.getByRole('button', { name: 'Correct' }));
    await user.type(screen.getByLabelText('Price'), '53');
    await user.type(screen.getByLabelText('Reason (required)'), 'Fat finger.');
    await user.click(screen.getByRole('button', { name: 'Save correction' }));
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Save correction' })).toHaveProperty('disabled', true));
    expect(screen.getByLabelText<HTMLInputElement>('Price').value).toBe('53');
    expect(screen.getByLabelText<HTMLTextAreaElement>('Reason (required)').value).toBe('Fat finger.');
  });

  it('should send one save and disable the Mark actions while a save is in flight', async () => {
    const facade = facadeDouble();
    let finish: (result: MarketDataSaveResult) => void = () => undefined;
    vi.mocked(facade.MarketData.save).mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderEntry({ kind: 'Missing' }, 'None', { facade });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Enter' }));
    await user.type(screen.getByLabelText('Price'), '52.5');
    const save = screen.getByRole('button', { name: 'Save Mark' });
    await user.click(save);
    await user.click(save);
    expect(facade.MarketData.save).toHaveBeenCalledOnce();
    expect((save as HTMLButtonElement).disabled).toBe(true);
    // Cancel is disabled too, so the form stays open for the late result.
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Cancel' }).disabled).toBe(true);

    finish(savedMark(mark('52.5'), 'None'));
    expect(await screen.findByText('$52.50')).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Correct' }).disabled).toBe(false);
    cleanup();

    // Withdraw sends one save and is disabled until the result arrives.
    const withdrawFacade = facadeDouble();
    vi.mocked(withdrawFacade.MarketData.save).mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderEntry({ kind: 'AcknowledgedUnavailable', acknowledgment: { versionId: 'a1', kind: 'Asserted', reason: 'Halted', savedAt: '2026-10-12T21:00:00Z' } }, 1, { facade: withdrawFacade });
    const withdraw = screen.getByRole<HTMLButtonElement>('button', { name: 'Withdraw' });
    await user.click(withdraw);
    await user.click(withdraw);
    expect(withdrawFacade.MarketData.save).toHaveBeenCalledOnce();
    expect(withdraw.disabled).toBe(true);
    finish(savedAcknowledgment(withdrawn, 2, 1));
    await vi.waitFor(() => expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Enter' }).disabled).toBe(false));
  });

  it('should show that the Mark was not saved, keep the entered values, and allow a retry when the save returns StorageFailure', async () => {
    const facade = facadeDouble();
    const save = vi.mocked(facade.MarketData.save);
    save.mockResolvedValueOnce(storageFailure);
    save.mockResolvedValueOnce(savedMark(mark('52.5'), 'None'));
    renderEntry({ kind: 'Missing' }, 'None', { facade });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Enter' }));
    await user.type(screen.getByLabelText('Price'), '52.5');
    await user.click(screen.getByRole('button', { name: 'Save Mark' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Nothing was saved');
    expect(document.activeElement).toBe(alert);
    expect(screen.getByLabelText<HTMLInputElement>('Price').value).toBe('52.5');
    expect(screen.getByRole('form', { name: 'Enter the Mark' })).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Save Mark' }).disabled).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Save Mark' }));
    expect(await screen.findByText('$52.50')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('should show that nothing was saved and keep Withdraw available when Withdraw returns StorageFailure', async () => {
    const facade = facadeDouble();
    const save = vi.mocked(facade.MarketData.save);
    save.mockResolvedValueOnce(storageFailure);
    save.mockResolvedValueOnce(savedAcknowledgment(withdrawn, 2, 1));
    renderEntry({ kind: 'AcknowledgedUnavailable', acknowledgment: { versionId: 'a1', kind: 'Asserted', savedAt: '2026-10-12T21:00:00Z' } }, 1, { facade });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Withdraw' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Nothing was saved');
    expect(alert.textContent).toContain('The acknowledgment could not be withdrawn.');
    expect(alert.textContent).not.toContain('Your values');
    expect(screen.getByText('Acknowledged Unavailable')).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Withdraw' }).disabled).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Withdraw' }));
    expect(await screen.findByText('Missing')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('should keep Cancel disabled while a save is in flight, and open each form with no earlier Conflict, storage-failure notice or issues', async () => {
    const facade = facadeDouble();
    const save = vi.mocked(facade.MarketData.save);
    let finish: (result: MarketDataSaveResult) => void = () => undefined;
    save.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    renderEntry({ kind: 'Missing' }, 'None', { facade });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Enter' }));
    await user.type(screen.getByLabelText('Price'), '52.5');
    await user.click(screen.getByRole('button', { name: 'Save Mark' }));
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Cancel' }).disabled).toBe(true);
    finish({ kind: 'Conflict', key, resolution: mark('51'), resolutionRevision: 1 });
    expect((await screen.findByRole('alert')).textContent).toContain('This Mark changed after you opened it');
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Cancel' }).disabled).toBe(false);

    // Cancel, then reopen: the earlier Conflict is gone.
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Correct' }));
    expect(screen.queryByRole('alert')).toBeNull();

    // A StorageFailure notice is gone after Cancel and reopen, and never shows with the Conflict banner.
    cleanup();
    save.mockResolvedValueOnce(storageFailure);
    renderEntry({ kind: 'Missing' }, 'None', { facade });
    await user.click(screen.getByRole('button', { name: 'Enter' }));
    await user.type(screen.getByLabelText('Price'), '52.5');
    await user.click(screen.getByRole('button', { name: 'Save Mark' }));
    const notice = await screen.findByRole('alert');
    expect(notice.textContent).toContain('could not be saved');
    expect(notice.textContent).not.toContain('changed after you opened it');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Enter' }));
    expect(screen.queryByRole('alert')).toBeNull();

    // Field issues are gone after Cancel and reopen.
    cleanup();
    save.mockResolvedValueOnce(rejected({ field: 'price', code: 'InvalidPrice' }));
    renderEntry({ kind: 'Missing' }, 'None', { facade });
    await user.click(screen.getByRole('button', { name: 'Enter' }));
    await user.type(screen.getByLabelText('Price'), 'abc');
    await user.click(screen.getByRole('button', { name: 'Save Mark' }));
    expect(await screen.findByText('Enter a price as a number, with at most 6 decimal places.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Enter' }));
    expect(screen.queryByText('Enter a price as a number, with at most 6 decimal places.')).toBeNull();
    expect(screen.getByLabelText('Price').getAttribute('aria-invalid')).toBeNull();

    // A Conflict from Withdraw has no form open; opening one next does not carry the banner along.
    cleanup();
    save.mockResolvedValueOnce({ kind: 'Conflict', key, resolution: mark('51'), resolutionRevision: 2 });
    renderEntry({ kind: 'AcknowledgedUnavailable', acknowledgment: { versionId: 'a1', kind: 'Asserted', savedAt: '2026-10-12T21:00:00Z' } }, 1, { facade });
    await user.click(screen.getByRole('button', { name: 'Withdraw' }));
    expect((await screen.findByRole('alert')).textContent).toContain('changed after you opened it');
    await user.click(screen.getByRole('button', { name: 'Correct' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('should close an open form whose intention no longer fits the refreshed Mark and say the Mark changed and nothing was saved', async () => {
    const facade = facadeDouble();
    const user = userEvent.setup();
    const entry = (resolution: MarkResolution, resolutionRevision: ExpectedResolutionRevision) => (
      <RuntimeContext.Provider value={{ writable: true, report: () => undefined }}>
        <MarkEntry facade={facade} instrumentKey="XYZ" tradingDate="2026-10-12" resolution={resolution} resolutionRevision={resolutionRevision} onDirtyChange={() => undefined} />
      </RuntimeContext.Provider>
    );
    const { rerender } = render(entry(mark('50'), 1));
    await user.click(screen.getByRole('button', { name: 'Correct' }));
    await user.type(screen.getByLabelText('Price'), '52');

    // The key is now Missing: a correction no longer fits.
    rerender(entry({ kind: 'Missing' }, 2));
    expect(screen.queryByRole('form')).toBeNull();
    const notice = screen.getByRole('alert');
    expect(notice.textContent).toContain('This Mark changed after you opened it');
    expect(notice.textContent).toContain('Nothing was saved');
    expect(notice.textContent).not.toContain('values are kept');
    expect(document.activeElement).toBe(notice);
    expect(screen.getByText('Missing')).toBeTruthy();

    // Reopening a form clears the notice.
    await user.click(screen.getByRole('button', { name: 'Enter' }));
    expect(screen.queryByRole('alert')).toBeNull();

    // Enter no longer fits an Available key.
    rerender(entry(mark('51', 3), 3));
    expect(screen.queryByRole('form')).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('Nothing was saved');
    expect(facade.MarketData.save).not.toHaveBeenCalled();
  });
});
