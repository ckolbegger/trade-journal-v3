import { useEffect, useRef } from 'react';
import type { Durability } from './runtime.tsx';

export interface StorageProtectionCardProps {
  readonly protection: 'Protected' | 'BestEffort' | 'Unavailable';
  // The shell's outcome of the request, and the shell function that makes it.
  readonly durability?: Durability;
  readonly onRequest?: () => void;
  // A request is in flight: the button is aria-disabled (it keeps focus) until it resolves.
  readonly requesting?: boolean;
  // The last request was rejected: say so; the button works again.
  readonly failed?: boolean;
}

// The advisory storage warning (ADR 0009): the explanation, the one explicit request, and its honest
// result. It never disables a control. About shows it; first run and onboarding, which have no About
// to link to, show it themselves.
export function StorageProtectionCard({ protection, durability, onRequest, requesting, failed }: StorageProtectionCardProps) {
  // When the result arrives, focus moves to its status so the keyboard user is not left on the body.
  const result = useRef<HTMLParagraphElement>(null);
  const seen = useRef(durability);
  useEffect(() => {
    if (durability && durability !== seen.current) result.current?.focus();
    seen.current = durability;
  }, [durability]);
  return (
    <>
      {durability && durability.kind !== 'NotImproved' && (
        <p className="banner notice" role="status" tabIndex={-1} ref={result}>
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
              <p role="status" tabIndex={-1} ref={result}>
                {durability.currentProtection.kind === 'BestEffort'
                  ? 'The browser declined to promise it will keep your data. You can keep using the journal.'
                  : 'This browser offers no way to ask it to keep data.'}
              </p>
            )}
            {failed && !durability && <p role="status">The browser didn't answer. You can try again.</p>}
          </div>
          {protection === 'BestEffort' && !durability && (
            <button
              type="button"
              className="pill secondary"
              aria-disabled={requesting ? 'true' : undefined}
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
