import type { ReactNode } from 'react';

// One label and value in a figure grid; a row never grows wider than its cap (app.css).
export function Figure({ term, plain, children }: { readonly term: string; readonly plain?: boolean; readonly children: ReactNode }) {
  return (
    <div>
      <dt>{term}</dt>
      <dd className={plain ? undefined : 'number'}>{children}</dd>
    </div>
  );
}
