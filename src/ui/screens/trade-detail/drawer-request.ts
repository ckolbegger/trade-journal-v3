import { createContext, useContext } from 'react';

export const DRAWERS = ['Today', 'Position', 'Plan and Risk', 'Price History', 'Journal', 'Payoff'] as const;
export type Drawer = (typeof DRAWERS)[number];

// A drawer's name in the address ("price-history" for Price History, A257); undefined for a name no drawer has.
export const drawerNamed = (param: string | null): Drawer | undefined => DRAWERS.find((drawer) => drawer.toLowerCase().replaceAll(' ', '-') === param);

// A drawer request from inside the cockpit (A240): select a drawer by its W1 name, then move focus to the heading in it whose text is `heading`,
// or (W46) to the element the selector finds in it.
// The selected drawer is component state, so the address does not change.
// `card` is the Journal session card the target is in (its id, the session's date): the cards turn to its page first.
export interface FocusTarget {
  readonly selector: string;
  readonly card?: string;
}
export type DrawerRequest = (drawer: Drawer, target: string | FocusTarget) => void;
export const DrawerRequestContext = createContext<DrawerRequest>(() => undefined);
export const useDrawerRequest = (): DrawerRequest => useContext(DrawerRequestContext);

// The drawer request being answered, a new object for each request (so the same one can be made again), for a drawer that must prepare
// before its target can take focus.
export interface DrawerFocus {
  readonly drawer: Drawer;
  readonly target: string | FocusTarget;
}
export const DrawerFocusContext = createContext<DrawerFocus | undefined>(undefined);
