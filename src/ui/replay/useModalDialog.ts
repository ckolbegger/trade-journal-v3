import { useEffect, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not(:disabled)',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  'details > summary',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function getVisibleFocusableElements(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter((el) => {
    if (el.hasAttribute('disabled')) return false;
    if (el.closest('[aria-hidden="true"]')) return false;
    const details = el.closest('details');
    if (details && !details.open && el.tagName !== 'SUMMARY') {
      return false;
    }
    return true;
  });
}

/**
 * Shared accessible modal behavior for ReplayOverlay and fallback Replay status dialogs:
 * locks body scroll, moves initial focus inside the dialog, dismisses on Escape,
 * and traps Tab / Shift+Tab within focusable elements inside the dialog container.
 */
export function useModalDialog(options: {
  readonly dialogRef: RefObject<HTMLElement | null>;
  readonly initialFocusRef?: RefObject<HTMLElement | null>;
  readonly onClose: () => void;
  readonly focusKey?: string;
}): void {
  const { dialogRef, initialFocusRef, onClose, focusKey } = options;

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    const target = initialFocusRef?.current ?? dialogRef.current;
    target?.focus();
  }, [dialogRef, initialFocusRef, focusKey]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (e.defaultPrevented) return;
        const target = e.target as HTMLElement | null;
        if (target?.tagName === 'SELECT') return;
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) {
        return;
      }
      const focusables = getVisibleFocusableElements(dialogRef.current);
      if (focusables.length === 0) {
        e.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      if (!active || !dialogRef.current.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialogRef, onClose]);
}
