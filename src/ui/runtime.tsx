import { createContext, useContext } from 'react';

// What every screen needs to know about the session: whether authoritative writes are allowed,
// and where to report a mutation result so a refusal changes the whole shell at once.
export interface RuntimeState {
  readonly writable: boolean;
  // The Workspace time zone, once a Workspace exists.
  readonly timeZone?: string;
  readonly report: (result: { readonly kind: string }) => void;
  // About calls this when the browser agrees to keep the data, so the shell drops the warning icon.
  readonly onStorageKept?: () => void;
}

export const RuntimeContext = createContext<RuntimeState>({ writable: false, report: () => undefined });

export function useRuntime(): RuntimeState {
  return useContext(RuntimeContext);
}
