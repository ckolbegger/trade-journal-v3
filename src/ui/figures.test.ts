import { describe, expect, it } from 'vitest';
import type { CalculationResult } from '../app/types.ts';
import { Rational } from '../domain/values/index.ts';
import { calculation } from './figures.ts';
import { money } from './format.ts';

const unavailable = (reason: string): CalculationResult<Rational> =>
  ({ kind: 'Unavailable', reason, detail: { instrument: { kind: 'Stock', symbol: 'XYZ' }, date: '2026-10-13' } }) as unknown as CalculationResult<Rational>;

describe('calculation Unavailable wording', () => {
  it('should word a figure outside calendar coverage as Not available, not as a missing Mark', () => {
    expect(calculation(unavailable('SessionPolicyNotCovered'), money)).toBe('Not available');
  });

  it('should word each other reason from its code', () => {
    expect(calculation(unavailable('MarkMissing'), money)).toBe('Mark missing: XYZ, Tue Oct 13');
    expect(calculation(unavailable('AcknowledgedUnavailable'), money)).toBe('Acknowledged unavailable: XYZ, Tue Oct 13');
    const awaiting = { kind: 'Unavailable', reason: 'AwaitingClose', detail: { after: '2026-10-13' } } as unknown as CalculationResult<Rational>;
    expect(calculation(awaiting, money)).toBe('Awaiting the next close');
  });

  it('should word an unknown reason as Not available, with no Mark missing text', () => {
    expect(calculation(unavailable('SomeFutureReason'), money)).toBe('Not available');
  });
});
