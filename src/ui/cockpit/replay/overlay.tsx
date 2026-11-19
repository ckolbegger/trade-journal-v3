import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ReplayOverlayProps } from './replay.types.ts';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// A273: a modal dialog drawn over the whole viewport. It is a portal on the body, and every other child of the body
// is made inert while it is open (P153: inert only, never hidden or changed).
export function ReplayOverlay({ name, header, onClose, children }: ReplayOverlayProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const made: Element[] = [];
    for (const sibling of Array.from(document.body.children)) {
      if (sibling === dialogRef.current ||sibling.hasAttribute('inert')) continue;
      sibling.setAttribute('inert', '');
      made.push(sibling);
    }
    dialogRef.current?.querySelector<HTMLElement>('[data-close]')?.focus();
    return () => {
      for (const el of made) el.removeAttribute('inert');
      opener?.focus();
    };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      if (!e.defaultPrevented) onClose();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) return;
    const edge = items[e.shiftKey ? 0 : items.length - 1];
    if (document.activeElement === edge || !e.currentTarget.contains(document.activeElement)) {
      e.preventDefault();
      items[e.shiftKey ? items.length - 1 : 0]?.focus();
    }
  };

  return createPortal(
    <div className="replay-overlay" role="dialog" aria-modal="true" aria-label={name} ref={dialogRef} onKeyDown={onKeyDown}>
      <header className="replay-overlay-header">
        <h2>{header}</h2>
        <button type="button" data-close onClick={onClose}>
          Close
        </button>
      </header>
      <div className="replay-overlay-body">{children}</div>
    </div>,
    document.body,
  );
}
