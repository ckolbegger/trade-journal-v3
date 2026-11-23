import type { RuntimeReadinessSnapshot } from '../../runtime/readiness';
import styles from './AppShell.module.css';

interface ReadinessScreenProps {
  readonly mode: 'Loading' | 'Unsupported' | 'IntegrityBlocked';
  readonly readiness: RuntimeReadinessSnapshot | null;
  readonly reason?: string;
  readonly onRetry: () => void;
}

export function ReadinessScreen({ mode, readiness, reason, onRetry }: ReadinessScreenProps) {
  if (mode === 'Loading') {
    return (
      <main className={styles.content} aria-busy="true">
        <section className={styles.card}>
          <h1 className={styles.cardTitle}>Checking Runtime Readiness</h1>
          <p className={styles.muted}>
            Verifying local storage diagnostics, capacity headroom, service worker control, and
            offline release digests…
          </p>
        </section>
      </main>
    );
  }

  const isIntegrity = mode === 'IntegrityBlocked';

  return (
    <main className={styles.content}>
      <section className={styles.card} role="region" aria-labelledby="readiness-gate-heading">
        <div className={styles.spaceBetween}>
          <h1 id="readiness-gate-heading" className={styles.cardTitle}>
            {isIntegrity
              ? 'Workspace Integrity Blocked'
              : 'Environment Unsupported for Journal Writes'}
          </h1>
          <span className={`${styles.pill} ${styles.pillDanger}`}>
            {isIntegrity ? 'Integrity Blocked' : 'Unsupported'}
          </span>
        </div>

        <p className={styles.muted}>
          {isIntegrity
            ? 'An existing local Workspace root could not be read or validated. Trade Journal V3 will never treat an unreadable root as an empty journal or overwrite it.'
            : 'This browser environment did not pass all required Runtime Readiness checks. No Workspace data has been created or modified. You can retry below or try another browser.'}
        </p>

        {reason && (
          <div className={styles.alertError} role="alert">
            {reason}
          </div>
        )}

        {readiness && (
          <table className={styles.table} aria-label="Runtime readiness checks">
            <thead>
              <tr>
                <th>Check</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {readiness.checks.map((check) => (
                <tr key={check.id}>
                  <td>{check.label}</td>
                  <td>
                    <span
                      className={`${styles.pill} ${check.passed ? styles.pillSuccess : styles.pillDanger}`}
                    >
                      {check.passed ? 'Pass' : 'Failed'}
                    </span>
                  </td>
                  <td>{check.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className={styles.row} style={{ marginTop: 16 }}>
          <button type="button" className={styles.btnPrimary} onClick={onRetry}>
            Retry Readiness Checks
          </button>
        </div>
      </section>
    </main>
  );
}
