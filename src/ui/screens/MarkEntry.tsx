import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { UiFacade } from '../../app/compose.ts';
import type { ExpectedResolutionRevision, MarkResolution } from '../../app/types.ts';
import { decimalMoney } from '../format.ts';
import { useRuntime } from '../runtime.tsx';
import { fieldIssues } from './form-issues.tsx';
import { describeMarkIssues } from './mark-issues.ts';
import type { FieldIssue } from './plan-issues.ts';

export interface MarkEntryProps {
  readonly facade: UiFacade;
  readonly instrumentKey: string;
  readonly tradingDate: string;
  // The key's resolution and the revision it was read at; every save binds to that revision.
  readonly resolution: MarkResolution;
  readonly resolutionRevision: ExpectedResolutionRevision;
  // Reports whether a value has been entered (update deferral, D1 A5).
  readonly onDirtyChange: (dirty: boolean) => void;
}

// The plan's and the acceptance rows' exact label, with a straight apostrophe.
const CANT_GET_A_PRICE = "Can't get a price";
const FORM_LABEL = { Enter: 'Enter the Mark', Correct: 'Correct the Mark', Acknowledge: CANT_GET_A_PRICE } as const;
const SAVE_LABEL = { Enter: 'Save Mark', Correct: 'Save correction', Acknowledge: 'Save acknowledgment' } as const;

// One Instrument's Mark for one session: its resolution and the actions that change it.
export function MarkEntry({ facade, instrumentKey, tradingDate, resolution: initial, resolutionRevision: initialRevision, onDirtyChange }: MarkEntryProps) {
  const { writable, report } = useRuntime();
  const [resolution, setResolution] = useState(initial);
  const [revision, setRevision] = useState(initialRevision);
  // The open form, if any: entering the first Mark, correcting the effective one, or saying no price can be had.
  const [mode, setMode] = useState<'Enter' | 'Correct' | 'Acknowledge' | undefined>();
  const [price, setPrice] = useState('');
  const [reason, setReason] = useState('');
  // Unsaved while a value has been entered; opening a form enters nothing.
  const dirty = price !== '' || reason !== '';
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  // Leaving abandons the values, so the form no longer holds an update back.
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  const [issues, setIssues] = useState<readonly FieldIssue[]>([]);
  // Field names and element ids are prefixed, since several Instruments share a page.
  const uid = useId();
  // The key changed after the form opened: nothing was saved, and the values stay for review.
  const [conflict, setConflict] = useState(false);
  // The write failed in storage: nothing was saved, and the values stay for a retry.
  const [storageFailed, setStorageFailed] = useState(false);
  const noticeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (conflict || storageFailed) noticeRef.current?.focus();
  }, [conflict, storageFailed]);
  const { fieldError, describedBy } = fieldIssues(issues);
  // An issue about the Mark as a whole has no field to sit beside.
  const keyIssue = issues.find((i) => i.field === `${uid}-key`);
  // A rejected save takes focus to the first issue's field, or to the message of an issue about the Mark as a whole.
  useEffect(() => {
    const first = issues[0];
    if (first) document.getElementById(first.field)?.focus();
  }, [issues]);

  // A form opens with the last result's Conflict, storage-failure notice and issues cleared, since they belonged to an earlier attempt.
  const openForm = (next: 'Enter' | 'Correct' | 'Acknowledge' | undefined) => {
    setMode(next);
    setIssues([]);
    setConflict(false);
    setStorageFailed(false);
  };
  // Closing the form discards what was entered; nothing is kept as a draft.
  const closeForm = () => {
    openForm(undefined);
    setPrice('');
    setReason('');
  };
  const key = { instrumentKey, tradingDate, expectedResolutionRevision: revision };
  // One save at a time: a second would carry the same expected revision, and a late Saved would close the form over newer input.
  const [saving, setSaving] = useState(false);
  const save = async (command: Parameters<UiFacade['MarketData']['save']>[0]) => {
    setSaving(true);
    let result;
    try {
      result = await facade.MarketData.save(command);
    } finally {
      setSaving(false);
    }
    // A refusal to write switches the whole shell to read only; the form keeps its values.
    report(result);
    setIssues(result.kind === 'Rejected' ? describeMarkIssues(result.issues, uid) : []);
    setConflict(result.kind === 'Conflict');
    setStorageFailed(result.kind === 'StorageFailure');
    if (result.kind === 'Conflict') {
      setResolution(result.resolution);
      setRevision(result.resolutionRevision);
    }
    if (result.kind === 'Saved') {
      setResolution(result.resolution);
      setRevision(result.resolutionRevision);
      closeForm();
    }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void save(
      mode === 'Acknowledge'
        ? { intention: 'AssertUnavailable', ...key, reason }
        : mode === 'Correct'
          ? { intention: 'CorrectMark', ...key, price: price.trim(), reason }
          : { intention: 'RecordInitialManualMark', ...key, price: price.trim() },
    );
  };

  return (
    <section aria-label={`${instrumentKey} Mark`}>
      {resolution.kind === 'Available' && (
        <p>
          <span className="number">{decimalMoney(resolution.mark.price)}</span> · {resolution.mark.source}
          {resolution.mark.correctionReason !== undefined && ` · Corrected: ${resolution.mark.correctionReason}`}
        </p>
      )}
      {resolution.kind === 'AcknowledgedUnavailable' && (
        <p>
          <strong>Acknowledged Unavailable</strong> · You said you can’t get a price
          {resolution.acknowledgment.reason !== undefined && `: ${resolution.acknowledgment.reason}`}
        </p>
      )}
      {resolution.kind === 'Missing' && (
        <p>
          <strong>Missing</strong>
        </p>
      )}
      {conflict && (
        <div ref={noticeRef} role="alert" tabIndex={-1} className="banner warning">
          <p>
            <strong>This Mark changed after you opened it.</strong> Nothing was saved. The current Mark is shown above, and your values are kept below.
          </p>
        </div>
      )}
      {storageFailed && (
        <div ref={noticeRef} role="alert" tabIndex={-1} className="banner warning">
          <p>
            <strong>This Mark could not be saved.</strong> Nothing was saved. Your values are kept, so you can try again.
          </p>
        </div>
      )}
      {keyIssue && (
        <p id={keyIssue.field} tabIndex={-1} className="field-error">
          {keyIssue.message}
        </p>
      )}
      {!writable ? null : mode ? (
        <form aria-label={FORM_LABEL[mode]} noValidate onSubmit={submit}>
          {mode === 'Correct' && resolution.kind === 'Available' && <p>{`Current price ${decimalMoney(resolution.mark.price)}`}</p>}
          {mode !== 'Acknowledge' && (
            <div className="field">
              <label>
                Price
                <input id={`${uid}-price`} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} {...describedBy(`${uid}-price`)} />
              </label>
              {fieldError(`${uid}-price`)}
            </div>
          )}
          {mode !== 'Enter' && (
            <div className="field">
              <label>
                Reason (required)
                <textarea id={`${uid}-reason`} value={reason} onChange={(e) => setReason(e.target.value)} {...describedBy(`${uid}-reason`)} />
              </label>
              {fieldError(`${uid}-reason`)}
            </div>
          )}
          <button type="submit" className="pill primary" disabled={saving}>
            {SAVE_LABEL[mode]}
          </button>
          <button type="button" className="pill secondary" onClick={closeForm} disabled={saving}>
            Cancel
          </button>
        </form>
      ) : (
        <>
          {resolution.kind === 'Missing' && (
            <>
              <button type="button" className="pill secondary" onClick={() => openForm('Enter')} disabled={saving}>
                Enter
              </button>
              <button type="button" className="pill secondary" onClick={() => openForm('Acknowledge')} disabled={saving}>
                {CANT_GET_A_PRICE}
              </button>
            </>
          )}
          {resolution.kind === 'AcknowledgedUnavailable' && (
            <button type="button" className="pill secondary" onClick={() => void save({ intention: 'WithdrawAcknowledgment', ...key })} disabled={saving}>
              Withdraw
            </button>
          )}
          {resolution.kind === 'Available' && (
            <button type="button" className="pill secondary" onClick={() => openForm('Correct')} disabled={saving}>
              Correct
            </button>
          )}
        </>
      )}
    </section>
  );
}
