import type { OptionInstrument } from '../../domain/instrument/index.ts';
import { toWorkspaceLocal } from '../../domain/time/index.ts';
import { instrumentLabel } from '../calculation-words.ts';
import { shortDate } from '../format.ts';
import { plural } from './ReviewCard.tsx';

// The words an option Trade's Detail uses (approved-words rows 23.1 to 23.19 and conventions C1, C2, C4).

// "2 contracts" (C1); a stored quantity may be signed, a short leg's being negative.
export const contractCount = (amount: string | number): string => plural(Math.abs(Number(amount)), 'contract', 'contracts');

// A holding or leg: direction first, then count, then the contract (C2).
export const holdingText = (side: 'Long' | 'Short', amount: string | number, instrument: OptionInstrument): string =>
  `${side} ${contractCount(amount)} of ${instrumentLabel(instrument)}`;

// A long option Plan's Exercise Intent (A119).
export const exerciseIntentText = (intent: 'Authorized' | 'NotAuthorized'): string => (intent === 'Authorized' ? 'Authorized in advance' : 'Not authorized in advance');

// "Fri 20 Nov 2026": the expiration line keeps its year, since a far date needs it (conflict K8).
export const expirationDate = (date: string): string => {
  const parts = new Intl.DateTimeFormat('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).formatToParts(new Date(`${date}T00:00:00Z`));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('weekday')} ${part('day')} ${part('month')} ${part('year')}`;
};

// A settlement time in the Workspace zone: the short date, then the clock (C4).
export const settlementTime = (instant: string, timeZone: string): string => {
  const [date = '', clock = ''] = toWorkspaceLocal(instant, timeZone).split('T');
  return `${shortDate(date)}, ${clock}`;
};
