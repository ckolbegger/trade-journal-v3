import { createContext, createElement, useContext, type ComponentProps } from 'react';
import { PageTitle } from '../PageTitle.tsx';

// The level of a form's title where a host shows the form inside its own page, as the Review's card does (A94): the title is a
// heading of the host's outline, and the form's sections sit one level below it. Undefined when the title is the page's own h1.
export type HostedTitleLevel = 1 | 2 | 3 | 4 | 5;
const TitleLevel = createContext<HostedTitleLevel | undefined>(undefined);
export const TitleLevelProvider = TitleLevel.Provider;

// The form's title: the page's h1, or a heading of the level its host gave it.
export function FormTitle(props: ComponentProps<'h1'>) {
  const level = useContext(TitleLevel);
  return level === undefined ? <PageTitle {...props} /> : createElement(`h${level}`, props);
}

// A section of the form: h2 under the page's h1, or one level below a hosted title.
export function SectionHeading(props: ComponentProps<'h2'>) {
  const level = useContext(TitleLevel);
  return createElement(`h${(level ?? 1) + 1}`, props);
}
