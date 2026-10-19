import { toWorkspaceLocal } from '../domain/time/index.ts';
import { formatDecimal, formatMoney, type Rational } from '../domain/values/index.ts';

// Presentation only. Values may arrive structurally cloned (navigation state), so only their
// numerator and denominator fields are read.
export const money = (value: Rational): string => formatMoney(value);

// A ratio to at most two decimals, without trailing zeros (12/5 → "2.4").
export const ratio = (value: Rational): string => formatDecimal(value, 2).replace(/\.?0+$/, '');

// An instant as a Workspace-local date and time.
export const localTime = (instant: string, timeZone: string): string => toWorkspaceLocal(instant, timeZone).replace('T', ' ');
