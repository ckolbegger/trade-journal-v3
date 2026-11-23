import type { ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'info' | 'warning';

// A compact label whose colour only reinforces its text; the tone is also exposed as data-tone.
export function Badge({ tone, children, describedBy }: { readonly tone: BadgeTone; readonly children: ReactNode; readonly describedBy?: string }) {
  return (
    <span className="badge" data-tone={tone} aria-describedby={describedBy}>
      {children}
    </span>
  );
}
