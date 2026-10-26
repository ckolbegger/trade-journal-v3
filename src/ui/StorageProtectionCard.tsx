import { useState } from 'react';
import type { UiFacade } from '../app/compose.ts';

type Durability = Awaited<ReturnType<UiFacade['Workspace']['requestDurability']>>;

export interface StorageProtectionCardProps {
  readonly facade: UiFacade;
  readonly protection: 'Protected' | 'BestEffort' | 'Unavailable';
  // About adds the backup recommendation; first run and onboarding stay compact.
  readonly recommendBackup?: boolean;
  // Called when the browser agrees to keep the data.
  readonly onKept?: () => void;
}

// The advisory storage warning (ADR 0009): the explanation, the one explicit request, and its honest
// result. It never disables a control. About shows it; first run and onboarding, which have no About
// to link to, show it themselves.
export function StorageProtectionCard({ facade, protection, recommendBackup, onKept }: StorageProtectionCardProps) {
  // The honest outcome of the trader's explicit durability request, if any.
  const [durability, setDurability] = useState<Durability | undefined>();
  return (
    <>
      {durability && durability.kind !== 'NotImproved' && (
        <p className="banner notice" role="status">
          The browser will now keep your journal data unless you clear it.
        </p>
      )}
      {protection !== 'Protected' && (!durability || durability.kind === 'NotImproved') && (
        <section className="banner warning durability" aria-label="Storage protection">
          <div className="banner-text">
            <p>
              This browser may clear your journal data, for example when the device is low on space. It has not promised
              to keep it.
            </p>
            {/* About has the room; first run and onboarding keep the compact card (T2.37). */}
            {recommendBackup && <p>Back up your journal as soon as this release offers backup.</p>}
            {durability?.kind === 'NotImproved' && (
              <p role="status">
                {durability.currentProtection.kind === 'BestEffort'
                  ? 'The browser declined to promise it will keep your data. You can keep using the journal.'
                  : 'This browser offers no way to ask it to keep data.'}
              </p>
            )}
          </div>
          {protection === 'BestEffort' && !durability && (
            <button
              type="button"
              className="pill secondary"
              onClick={() =>
                void facade.Workspace.requestDurability().then((result) => {
                  setDurability(result);
                  if (result.kind !== 'NotImproved') onKept?.();
                })
              }
            >
              Ask the browser to keep data
            </button>
          )}
        </section>
      )}
    </>
  );
}
