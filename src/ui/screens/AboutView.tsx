import { useEffect, useState } from 'react';
import type { UiFacade } from '../../app/compose.ts';
import { APP_NAME, MANIFEST_ID } from '../../app/identity.ts';
import { PageTitle } from '../PageTitle.tsx';
import { useRuntime } from '../runtime.tsx';
import { StorageProtectionCard } from '../StorageProtectionCard.tsx';
import type { ReleaseUpdateController } from '../update/controller.ts';

type Status = Awaited<ReturnType<UiFacade['Workspace']['getStatus']>>;

export interface AboutViewProps {
  readonly facade: UiFacade;
  readonly updates: ReleaseUpdateController;
}

const CHECK_LABELS = {
  diagnostic: 'Test save and read-back',
  capacity: 'Storage space',
  control: 'Offline component in control',
  inventory: 'Offline copy complete',
} as const;

const PROTECTION = { Protected: 'Protected', BestEffort: 'Best effort', Unavailable: 'Unavailable' } as const;

const gb = (bytes: number) => `${(bytes / 1024 ** 3).toFixed(2)} GB`;

// Evidence about this installed release and this browser, never a support verdict by identity.
export function AboutView({ facade, updates }: AboutViewProps) {
  const [status, setStatus] = useState<Status | undefined>();
  const { durability, requestDurability, requestingDurability, durabilityRequestFailed } = useRuntime();
  const [checked, setChecked] = useState<'NoUpdate' | 'UpdateWaiting' | undefined>();
  useEffect(() => {
    void facade.Workspace.getStatus().then(setStatus);
  }, [facade]);
  if (!status) return <p role="status">Loading release details…</p>;
  // A request the browser granted in this session outranks the status read when About opened.
  const kept = durability !== undefined && durability.kind !== 'NotImproved';

  const { checks } = status.readiness;
  const inventory = checks.inventory.evidence;
  const describe = (name: keyof typeof CHECK_LABELS) => {
    const check = checks[name];
    const evidence = check.evidence;
    let detail = '';
    if (evidence && 'quota' in evidence) {
      detail = ` (quota ${gb(evidence.quota)}, used ${gb(evidence.usage)}, required ${gb(evidence.requiredQuotaBytes)} for a projected ${gb(evidence.projectedWorkspaceBytes)} journal)`;
    }
    return `${CHECK_LABELS[name]}: ${check.passed ? 'passed' : `failed (${check.reason})`}${detail}`;
  };
  const capabilities = status.installedCapabilities;

  return (
    <article className="about">
      <PageTitle>About</PageTitle>
      <StorageProtectionCard protection={status.protection} durability={durability} onRequest={requestDurability} requesting={requestingDurability} failed={durabilityRequestFailed} />
      <section className="card" aria-labelledby="release-heading">
        <h2 id="release-heading">This release</h2>
        <dl>
          <dt>Application</dt>
          <dd>{APP_NAME}</dd>
          <dt>Manifest id</dt>
          <dd>{MANIFEST_ID}</dd>
          <dt>Release</dt>
          <dd className="identity">{capabilities.releaseId}</dd>
          <dt>Schema version</dt>
          <dd className="number">{'schemaVersion' in status ? String(status.schemaVersion) : 'Unknown'}</dd>
          <dt>Offline assets</dt>
          <dd className="number">{inventory && 'assetCount' in inventory ? String(inventory.assetCount) : 'Unknown'}</dd>
          <dt>Storage protection</dt>
          <dd>{PROTECTION[kept ? 'Protected' : status.protection]}</dd>
          <dt>Time zone</dt>
          <dd>{'timeZone' in status ? status.timeZone : 'Not set'}</dd>
        </dl>
        <button type="button" className="pill secondary" onClick={() => void updates.checkForUpdates().then(setChecked)}>
          Check for updates
        </button>
        {checked === 'NoUpdate' && <p role="status">No update</p>}
        {/* The shell's update notice, shown on every screen, carries the Reload action. */}
        {checked === 'UpdateWaiting' && <p role="status">An update was found. Use Reload in the update notice.</p>}
      </section>
      <section className="card" aria-labelledby="readiness-heading">
        <h2 id="readiness-heading">Runtime Readiness</h2>
        <ul>
          {(Object.keys(CHECK_LABELS) as (keyof typeof CHECK_LABELS)[]).map((name) => (
            <li key={name}>{describe(name)}</li>
          ))}
        </ul>
      </section>
      <section className="card" aria-labelledby="capabilities-heading">
        <h2 id="capabilities-heading">Installed capabilities</h2>
        <ul>
          {Object.entries(capabilities.operations).map(([operation, variants]) => (
            <li key={operation}>{variants.length > 0 ? `${operation} (${variants.join(', ')})` : operation}</li>
          ))}
        </ul>
        <p>Strategies: {capabilities.strategies.join(', ')}</p>
        <p>Entry Types: {capabilities.entryTypes.join(', ')}</p>
      </section>
    </article>
  );
}
