import { useEffect, useRef, type ReactNode } from 'react';
import styles from './App.module.css';

export function ContextPanel({ title, busy, onClose, children }: { title: string; busy: boolean; onClose: () => void; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => { if (busy) panel.current?.focus({ preventScroll: true }); }, [busy]);
  useEffect(() => {
    const invoker = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; panel.current?.focus();
    const revealFocus = () => requestAnimationFrame(() => {
      if (panel.current?.contains(document.activeElement)) (document.activeElement as HTMLElement)?.scrollIntoView?.({ block: 'nearest' });
    });
    window.addEventListener('resize', revealFocus);
    return () => { document.body.style.overflow = overflow; window.removeEventListener('resize', revealFocus); queueMicrotask(() => { if (invoker?.isConnected) invoker.focus(); }); };
  }, []);
  return <div className={styles.backdrop}><div ref={panel} role="dialog" aria-modal="true" aria-label={title} tabIndex={0} className={styles.panel} onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); if (!busy) onClose(); }
    if (event.key === 'Tab') {
      const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], summary, [tabindex="0"]') ?? []).filter(element => !element.closest('[hidden]'));
      const first = controls[0]; const last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first?.focus(); }
    }
  }}><header className={styles.panelHeader}><div><p className={styles.eyebrow}>TRADE JOURNAL</p><h2>{title}</h2></div><button type="button" disabled={busy} aria-label={`Close ${title.toLowerCase()}`} onClick={onClose}>×</button></header>{children}</div></div>;
}
