import { createContext, useContext } from 'react';

export const DRAWERS = ['Today', 'Position', 'Plan and Risk', 'Price History', 'Journal', 'Payoff'] as const;
export type Drawer = (typeof DRAWERS)[number];

// A drawer request from inside the cockpit (A240): select a drawer by its W1 name, then move focus to the heading in it whose text is `heading`.
// The selected drawer is component state, so the address does not change.
export type DrawerRequest = (drawer: Drawer, heading: string) => void;
export const DrawerRequestContext = createContext<DrawerRequest>(() => undefined);
export const useDrawerRequest = (): DrawerRequest => useContext(DrawerRequestContext);
