import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router';

// P156: leaving the page is held while the caller says something is unsaved (main.tsx: a Mark draft in the Review). A link that goes to another page of the app asks first and the
// trader can cancel; a reload or tab close gets the browser's own prompt. A save that moves on by itself, a link within the
// page and going back or forward do not ask.
export const LEAVE_QUESTION = 'Leave without saving?';

export function LeaveGuard({ unsaved, children }: { readonly unsaved: () => boolean; readonly children: ReactNode }) {
  const { pathname } = useLocation();
  useEffect(() => {
    const ask = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!link || (link.getAttribute('target') ?? '_self') !== '_self' || link.hasAttribute('download')) return;
      const to = new URL(link.getAttribute('href') ?? '', window.location.href);
      if (to.origin !== window.location.origin || to.pathname === pathname || !unsaved()) return;
      if (!window.confirm(LEAVE_QUESTION)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const hold = (event: BeforeUnloadEvent) => {
      if (unsaved()) event.preventDefault();
    };
    document.addEventListener('click', ask, true);
    window.addEventListener('beforeunload', hold);
    return () => {
      document.removeEventListener('click', ask, true);
      window.removeEventListener('beforeunload', hold);
    };
  }, [pathname, unsaved]);
  return <>{children}</>;
}
