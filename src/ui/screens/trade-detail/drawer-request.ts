import { createContext, useContext } from 'react';

export const DRAWERS = ['Today', 'Replay', 'Position', 'Plan and Risk', 'Price History', 'Journal', 'Payoff'] as const;
export type Drawer = (typeof DRAWERS)[number];

// A drawer's name in the address ("price-history" for Price History, A257); undefined for a name no drawer has.
export const drawerNamed = (param: string | null): Drawer | undefined => DRAWERS.find((drawer) => drawer.toLowerCase().replaceAll(' ', '-') === param);

// A drawer request from inside the cockpit (A240): select a drawer by its W1 name, then move focus to the heading in it whose text is `heading`.
// The selected drawer is component state, so the address does not change.
export type DrawerRequest = (drawer: Drawer, heading: string) => void;
export const DrawerRequestContext = createContext<DrawerRequest>(() => undefined);
export const useDrawerRequest = (): DrawerRequest => useContext(DrawerRequestContext);
