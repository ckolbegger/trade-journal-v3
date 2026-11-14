import { useState, type FormEvent } from 'react';
import type { UiFacade } from '../../app/compose.ts';
import type { FileSelectionPort } from '../../app/types.ts';
import type { BackupFacade } from '../backup/facade.ts';
import { RestoreFlow } from '../backup/RestoreFlow.tsx';

type Opened = Extract<Awaited<ReturnType<UiFacade['Workspace']['initialize']>>, { kind: 'Opened' }>['status'];

export interface FirstRunProps {
  readonly facade: UiFacade;
  readonly onOpened: (status: Opened) => void;
  // The browser-resolved zone and the supported zones (D1 A8), injectable for tests.
  readonly proposedZone?: string;
  readonly zones?: readonly string[];
  // Present only while this browser can save safely and the release serves Restore (D8 A143): offers
  // Restore from a backup beside Start my journal, for a browser with no Workspace (P33).
  readonly restore?: { readonly facade: BackupFacade; readonly selectFile: FileSelectionPort };
}

export function FirstRun({
  facade,
  onOpened,
  proposedZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  zones = Intl.supportedValuesOf('timeZone'),
  restore,
}: FirstRunProps) {
  const [zone, setZone] = useState(proposedZone);
  const [invalid, setInvalid] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void facade.Workspace.initialize({ timeZone: zone }).then((result) => {
      if (result.kind === 'Opened') onOpened(result.status);
      else if (result.kind === 'Rejected') setInvalid(true);
    });
  };

  return (
    <main className="content first-run">
      <h1>Start your journal</h1>
      <form onSubmit={submit}>
        <label>
          Time zone
          <select
            value={zone}
            onChange={(event) => setZone(event.target.value)}
            aria-invalid={invalid}
            aria-describedby={invalid ? 'time-zone-error' : undefined}
          >
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </label>
        {invalid && (
          <p id="time-zone-error" className="field-error">
            This time zone is not recognized. Choose another.
          </p>
        )}
        <button type="submit" className="pill primary">
          Start my journal
        </button>
        {restore && (
          <button type="button" className="pill secondary" onClick={() => setRestoring(true)}>
            Restore from a backup
          </button>
        )}
      </form>
      {restore && restoring && <RestoreFlow facade={restore.facade} selectFile={restore.selectFile} />}
    </main>
  );
}
