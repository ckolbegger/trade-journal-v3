import type { PositionChangeResult } from '../../app/types.ts';
import { quantity } from '../format.ts';
import { plural } from './ReviewCard.tsx';

type Recorded = Extract<PositionChangeResult, { readonly kind: 'Recorded' }>;
type Mechanisms = Extract<Recorded['postCommit']['derivation']['terminalDisposition'], { readonly kind: 'Value' }>['value'];
type Timing = Extract<Recorded['postCommit']['derivation']['optionDispositionTiming'], { readonly kind: 'Value' }>['value'];

const contracts = (amount: { readonly numerator: bigint }): string => plural(Number(amount.numerator), 'contract', 'contracts');

// A Long leg's Executions are sales, a Short leg's are buybacks (conflict K10); an Expiration is its own word.
const mechanismWord = (side: 'Long' | 'Short', mechanism: Mechanisms[number]['mechanism']): string => (mechanism === 'Expiration' ? 'expiration' : side === 'Long' ? 'sale' : 'buyback');

// How a Closed option Trade's exposure ended (row 23.12): each mechanism is named with its contracts.
export function closedViaOption(side: 'Long' | 'Short', mechanisms: Mechanisms): string {
  const parts = mechanisms.map(({ mechanism, quantity }) => `${mechanismWord(side, mechanism)} of ${contracts(quantity)}`);
  return `Closed via ${parts.join(' and ')}`;
}

// The same without the quantities, for the Closed list's cell (row 23.14).
export const closedViaOptionShort = (side: 'Long' | 'Short', mechanisms: Mechanisms): string => `Closed via ${mechanisms.map(({ mechanism }) => mechanismWord(side, mechanism)).join(' and ')}`;

// An expiration closes a Trade with no Close Reason to give (row 23.15).
export const closedByExpiration = (mechanisms: Mechanisms): boolean => mechanisms.some(({ mechanism }) => mechanism === 'Expiration');

const TIMING: Record<Timing['timing'], string> = {
  FullyDisposedPreExpiration: 'Fully disposed before expiration',
  FullyHeldToExpirationSettlement: 'Fully held to expiration',
  Mixed: 'Mixed',
};

// The timing's short label, as the Closed list shows it after the disposition (row 23.14).
export const timingLabel = ({ timing }: Timing): string => TIMING[timing];

// Option Disposition Timing with both quantities (row 23.13).
export const timingWords = ({ timing, disposedByExecutions, disposedBySettlement }: Timing): string =>
  `${TIMING[timing]}: ${quantity(disposedByExecutions)} before expiration, ${quantity(disposedBySettlement)} at expiration`;
