import type { ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'info' | 'warning';

// A compact label whose colour only reinforces its text; the tone is also exposed as data-tone.
export function Badge({ tone, children }: { readonly tone: BadgeTone; readonly children: ReactNode }) {
  return (
    <span className="badge" data-tone={tone}>
      {children}
    </span>
  );
}
