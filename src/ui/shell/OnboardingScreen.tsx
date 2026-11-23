import { useState, type FormEvent } from 'react';
import styles from './AppShell.module.css';

export const COMMON_IANA_TIME_ZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Toronto',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
  'UTC',
] as const;

function detectInitialTimeZone(): string {
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (resolved && (resolved === 'UTC' || resolved.includes('/'))) {
      return resolved;
    }
  } catch {
    // Fallback below
  }
  return 'America/New_York';
}

interface OnboardingScreenProps {
  readonly onInitialize: (timeZone: string) => Promise<string | null>;
}

export function OnboardingScreen({ onInitialize }: OnboardingScreenProps) {
  const [timeZone, setTimeZone] = useState<string>(detectInitialTimeZone);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const err = await onInitialize(timeZone.trim());
      if (err) {
        setError(err);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize workspace.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className={styles.content}>
      <section className={styles.card} aria-labelledby="init-workspace-heading">
        <div className={styles.spaceBetween}>
          <h1 id="init-workspace-heading" className={styles.cardTitle}>
            Initialize Local Workspace
          </h1>
          <span className={`${styles.pill} ${styles.pillSuccess}`}>Runtime Writable</span>
        </div>

        <p className={styles.muted}>
          Choose the IANA time zone for your device-local journal. This governs future view moments,
          daily review selection, and report period boundaries. Market session dates remain
          exchange-defined (U.S. Eastern), and no fictional brokerage accounts are created.
        </p>

        {error && (
          <div className={styles.alertError} role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="init-tz-select">
              Common time zones
            </label>
            <select
              id="init-tz-select"
              className={styles.select}
              value={
                (COMMON_IANA_TIME_ZONES as readonly string[]).includes(timeZone) ? timeZone : ''
              }
              onChange={(e) => {
                if (e.target.value) {
                  setTimeZone(e.target.value);
                }
              }}
            >
              <option value="">Custom IANA zone…</option>
              {COMMON_IANA_TIME_ZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="init-tz-input">
              IANA Time Zone
            </label>
            <input
              id="init-tz-input"
              className={styles.input}
              type="text"
              value={timeZone}
              onChange={(e) => setTimeZone(e.target.value)}
              placeholder="America/New_York"
              required
            />
          </div>

          <button type="submit" className={styles.btnPrimary} disabled={submitting}>
            {submitting ? 'Initializing…' : 'Initialize Workspace'}
          </button>
        </form>
      </section>
    </main>
  );
}
