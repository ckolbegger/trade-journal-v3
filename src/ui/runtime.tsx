import { createContext, useContext } from 'react';

// What every screen needs to know about the session: whether authoritative writes are allowed,
// and where to report a mutation result so a refusal changes the whole shell at once.
export interface RuntimeState {
  readonly writable: boolean;
  report(result: { readonly kind: string }): void;
}

export const RuntimeContext = createContext<RuntimeState>({ writable: false, report: () => undefined });

export function useRuntime(): RuntimeState {
  return useContext(RuntimeContext);
}
