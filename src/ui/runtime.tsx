import { createContext, useContext } from 'react';
import type { UiFacade } from '../app/compose.ts';

// The outcome of the trader's one explicit durability request.
export type Durability = Awaited<ReturnType<UiFacade['Workspace']['requestDurability']>>;

// What every screen needs to know about the session: whether authoritative writes are allowed,
// and where to report a mutation result so a refusal changes the whole shell at once.
export interface RuntimeState {
  readonly writable: boolean;
  // The Workspace time zone, once a Workspace exists.
  readonly timeZone?: string;
  readonly report: (result: { readonly kind: string }) => void;
  // The outcome of the durability request, if one was made. Held by the shell so it outlives any screen.
  readonly durability?: Durability;
  // Asks the browser to keep the data and records the outcome in the shell.
  readonly requestDurability?: () => void;
  // A durability request is in flight; further requests are ignored until it resolves.
  readonly requestingDurability?: boolean;
  // The last durability request was rejected, so the browser gave no answer.
  readonly durabilityRequestFailed?: boolean;
}

export const RuntimeContext = createContext<RuntimeState>({ writable: false, report: () => undefined });

export function useRuntime(): RuntimeState {
  return useContext(RuntimeContext);
}
