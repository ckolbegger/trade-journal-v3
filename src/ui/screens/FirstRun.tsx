import { useState, type FormEvent } from 'react';
import type { UiFacade } from '../../app/compose.ts';

type Opened = Extract<Awaited<ReturnType<UiFacade['Workspace']['initialize']>>, { kind: 'Opened' }>['status'];

export interface FirstRunProps {
  readonly facade: UiFacade;
  readonly onOpened: (status: Opened) => void;
  // The browser-resolved zone and the supported zones (D1 A8), injectable for tests.
  readonly proposedZone?: string;
  readonly zones?: readonly string[];
}

export function FirstRun({
  facade,
  onOpened,
  proposedZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  zones = Intl.supportedValuesOf('timeZone'),
}: FirstRunProps) {
  const [zone, setZone] = useState(proposedZone);
  const [invalid, setInvalid] = useState(false);

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
      </form>
    </main>
  );
}
