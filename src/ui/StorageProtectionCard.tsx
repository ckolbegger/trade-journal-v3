import type { Durability } from './runtime.tsx';

export interface StorageProtectionCardProps {
  readonly protection: 'Protected' | 'BestEffort' | 'Unavailable';
  // The shell's outcome of the request, and the shell function that makes it.
  readonly durability?: Durability;
  readonly onRequest?: () => void;
}

// The advisory storage warning (ADR 0009): the explanation, the one explicit request, and its honest
// result. It never disables a control. About shows it; first run and onboarding, which have no About
// to link to, show it themselves.
export function StorageProtectionCard({ protection, durability, onRequest }: StorageProtectionCardProps) {
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
              onClick={onRequest}
            >
              Ask the browser to keep data
            </button>
          )}
        </section>
      )}
    </>
  );
}
