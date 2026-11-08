import type { PositionChangeResult } from '../../app/types.ts';
import { quantity } from '../format.ts';
import { plural } from './ReviewCard.tsx';

type Recorded = Extract<PositionChangeResult, { readonly kind: 'Recorded' }>;
type Mechanisms = Extract<Recorded['postCommit']['derivation']['terminalDisposition'], { readonly kind: 'Value' }>['value'];
type Timing = Extract<Recorded['postCommit']['derivation']['optionDispositionTiming'], { readonly kind: 'Value' }>['value'];

const contracts = (amount: { readonly numerator: bigint }): string => plural(Number(amount.numerator), 'contract', 'contracts');

// How a Closed option Trade's exposure ended (row 23.12): a Long leg's Executions are sales, a Short leg's
// are buybacks (conflict K10), and an Expiration is named with its contracts.
export function closedViaOption(side: 'Long' | 'Short', mechanisms: Mechanisms): string {
  const parts = mechanisms.map(({ mechanism, quantity }) => `${mechanism === 'Expiration' ? 'expiration' : side === 'Long' ? 'sale' : 'buyback'} of ${contracts(quantity)}`);
  return `Closed via ${parts.join(' and ')}`;
}

const TIMING: Record<Timing['timing'], string> = {
  FullyDisposedPreExpiration: 'Fully disposed before expiration',
  FullyHeldToExpirationSettlement: 'Fully held to expiration',
  Mixed: 'Mixed',
};

// Option Disposition Timing with both quantities (row 23.13).
export const timingWords = ({ timing, disposedByExecutions, disposedBySettlement }: Timing): string =>
  `${TIMING[timing]}: ${quantity(disposedByExecutions)} before expiration, ${quantity(disposedBySettlement)} at expiration`;
