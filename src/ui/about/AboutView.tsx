import { useEffect, useState, type FormEvent } from 'react';
import type { WorkspaceStatusSnapshot } from '../../workspace/workspace';
import styles from '../shell/AppShell.module.css';
import { COMMON_IANA_TIME_ZONES } from '../shell/OnboardingScreen';

interface AboutViewProps {
  readonly workspaceStatus: WorkspaceStatusSnapshot;
  readonly writable: boolean;
  readonly durabilityBusy: boolean;
  readonly onSaveTimeZone: (timeZone: string) => Promise<{ ok: boolean; message: string }>;
  readonly onRequestDurability: () => Promise<{ ok: boolean; message: string }>;
  readonly onRerunReadiness: () => Promise<void>;
  readonly onDirtyChange: (dirty: boolean) => void;
}

export function AboutView({
  workspaceStatus,
  writable,
  durabilityBusy,
  onSaveTimeZone,
  onRequestDurability,
  onRerunReadiness,
  onDirtyChange,
}: AboutViewProps) {
  const [timeZoneDraft, setTimeZoneDraft] = useState(workspaceStatus.timeZone);
  const [savingTz, setSavingTz] = useState(false);
  const [tzMessage, setTzMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(
    null,
  );
  const [durabilityMessage, setDurabilityMessage] = useState<{
    kind: 'error' | 'success';
    text: string;
  } | null>(null);
  const [checkingReadiness, setCheckingReadiness] = useState(false);

  useEffect(() => {
    setTimeZoneDraft(workspaceStatus.timeZone);
  }, [workspaceStatus.timeZone]);

  useEffect(() => {
    onDirtyChange(timeZoneDraft.trim() !== workspaceStatus.timeZone);
    return () => onDirtyChange(false);
  }, [timeZoneDraft, workspaceStatus.timeZone, onDirtyChange]);

  const handleSaveTz = async (e: FormEvent) => {
    e.preventDefault();
    setTzMessage(null);
    setSavingTz(true);
    try {
      const result = await onSaveTimeZone(timeZoneDraft.trim());
      setTzMessage({ kind: result.ok ? 'success' : 'error', text: result.message });
    } catch (error) {
      setTzMessage({
        kind: 'error',
        text: error instanceof Error ? error.message : 'Failed to save time zone.',
      });
    } finally {
      setSavingTz(false);
    }
  };

  const handleDurability = async () => {
    setDurabilityMessage(null);
    try {
      const res = await onRequestDurability();
      setDurabilityMessage({ kind: res.ok ? 'success' : 'error', text: res.message });
    } catch (error) {
      setDurabilityMessage({
        kind: 'error',
        text: error instanceof Error ? error.message : 'Failed to request persistent storage.',
      });
    }
  };

  const handleRerun = async () => {
    setCheckingReadiness(true);
    try {
      await onRerunReadiness();
    } catch (error) {
      setTzMessage({
        kind: 'error',
        text: error instanceof Error ? error.message : 'Failed to re-run readiness checks.',
      });
    } finally {
      setCheckingReadiness(false);
    }
  };

  const { readiness, capabilities } = workspaceStatus;

  return (
    <section aria-labelledby="about-heading">
      <h1 id="about-heading" style={{ margin: '0 0 16px', fontSize: '1.45rem' }}>
        About &amp; Workspace Status
      </h1>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Workspace Time Zone</h2>
        <p className={styles.muted}>
          Changing your Workspace time zone changes how future View Moments, Daily Review selection,
          and named Report Period boundaries resolve. It never rewrites stored instants, Economic
          Dates, U.S. Trading Dates, Journal history, or earlier calculations.
        </p>

        {tzMessage && (
          <div
            className={tzMessage.kind === 'error' ? styles.alertError : styles.alertSuccess}
            role={tzMessage.kind === 'error' ? 'alert' : 'status'}
          >
            {tzMessage.text}
          </div>
        )}

        <form onSubmit={handleSaveTz}>
          <div className={styles.row} style={{ marginBottom: 10 }}>
            <label className={styles.label} htmlFor="about-tz-select">
              Preset
            </label>
            <select
              id="about-tz-select"
              className={styles.select}
              disabled={!writable}
              value={
                (COMMON_IANA_TIME_ZONES as readonly string[]).includes(timeZoneDraft)
                  ? timeZoneDraft
                  : ''
              }
              onChange={(e) => {
                if (e.target.value) {
                  setTimeZoneDraft(e.target.value);
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

          <div className={styles.row}>
            <label className="sr-only" htmlFor="about-tz-input">
              IANA Time Zone
            </label>
            <input
              id="about-tz-input"
              className={styles.input}
              type="text"
              value={timeZoneDraft}
              onChange={(e) => setTimeZoneDraft(e.target.value)}
              disabled={!writable}
            />
            <button type="submit" className={styles.btnPrimary} disabled={!writable || savingTz}>
              {savingTz ? 'Saving…' : 'Save Time Zone'}
            </button>
          </div>
        </form>
      </div>

      <div className={styles.card}>
        <div className={styles.spaceBetween}>
          <h2 className={styles.cardTitle} style={{ margin: 0 }}>
            Runtime Readiness
          </h2>
          <div className={styles.row}>
            <span
              className={`${styles.pill} ${
                readiness.state === 'Writable' ? styles.pillSuccess : styles.pillDanger
              }`}
            >
              {readiness.state}
            </span>
            <button
              type="button"
              className={styles.btnSecondary}
              disabled={checkingReadiness}
              onClick={() => {
                void handleRerun();
              }}
            >
              {checkingReadiness ? 'Checking…' : 'Re-run Checks'}
            </button>
          </div>
        </div>

        <p className={styles.muted}>
          Binding: <span className={styles.mono}>{workspaceStatus.binding.bindingToken}</span> ·
          Release: <span className={styles.mono}>{readiness.releaseId ?? 'none'}</span> · Schema v
          {workspaceStatus.schemaVersion}
        </p>

        <table className={styles.table} aria-label="Runtime readiness evidence">
          <thead>
            <tr>
              <th>Check</th>
              <th>Result</th>
              <th>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {readiness.checks.map((check) => (
              <tr key={check.id}>
                <td>{check.label}</td>
                <td>
                  <span
                    className={`${styles.pill} ${
                      check.passed ? styles.pillSuccess : styles.pillDanger
                    }`}
                  >
                    {check.passed ? 'Pass' : 'Failed'}
                  </span>
                </td>
                <td>{check.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.card}>
        <div className={styles.spaceBetween}>
          <h2 className={styles.cardTitle} style={{ margin: 0 }}>
            Local Storage Protection
          </h2>
          <span
            className={`${styles.pill} ${
              readiness.storageProtection.state === 'Protected'
                ? styles.pillSuccess
                : styles.pillWarning
            }`}
          >
            {readiness.storageProtection.state}
          </span>
        </div>
        <p className={styles.muted}>
          Storage protection is advisory and never replaces backups. Even when protected, device
          loss or profile deletion can still erase local data.
        </p>
        {durabilityMessage && (
          <div
            className={
              durabilityMessage.kind === 'error' ? styles.alertError : styles.alertSuccess
            }
            role={durabilityMessage.kind === 'error' ? 'alert' : 'status'}
          >
            {durabilityMessage.text}
          </div>
        )}
        <button
          type="button"
          className={styles.btnSecondary}
          disabled={durabilityBusy}
          onClick={() => {
            void handleDurability();
          }}
        >
          {durabilityBusy ? 'Requesting…' : 'Request Persistent Storage'}
        </button>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>
          Installed Capability Manifest (v{capabilities.manifestVersion} ·{' '}
          {capabilities.releaseDeliverable})
        </h2>
        <p className={styles.muted}>
          Only completed, dependency-closed capabilities installed in this release are listed below.
        </p>
        <ul className={styles.mono}>
          {capabilities.operations.map((op) => (
            <li key={op}>{op}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
