import { describe, expect, it } from 'vitest';
import type { IncoherentFact } from '../domain/calculation-result/index.ts';
import { Rational } from '../domain/values/index.ts';
import { instrumentOf } from '../domain/instrument/index.ts';
import { acknowledgedUnavailableStatusLabel, findingWords, instrumentLabel, isExceedsOpenQuantityIssue, isFlatBeforeLaterFactsIssue, notApplicableWords, text, unavailableWords, unboundedWords } from './calculation-words.ts';

const ZONE = 'America/New_York';
const XYZ = instrumentOf('XYZ');
const words = (reason: Parameters<typeof unavailableWords>[0], length: 'label' | 'figure' | 'sentence') => text(unavailableWords(reason, length, ZONE));

describe('calculation words (P70, P71, section 1.4)', () => {
  it('should word MarkMissing at the label, figure and sentence lengths as section 1.4 gives', () => {
    const reason = { reason: 'MarkMissing', instrument: XYZ, date: '2026-10-12' } as const;
    expect(words(reason, 'label')).toBe('Mark missing');
    expect(words(reason, 'figure')).toBe('Mark missing: XYZ, Mon Oct 12');
    expect(words(reason, 'sentence')).toBe('Mark missing for XYZ on Mon Oct 12');
  });

  it('should word AcknowledgedUnavailable with acknowledged at every length', () => {
    const reason = { reason: 'AcknowledgedUnavailable', instrument: XYZ, date: '2026-10-12' } as const;
    expect(words(reason, 'label')).toBe('Acknowledged unavailable');
    expect(words(reason, 'figure')).toBe('Acknowledged unavailable: XYZ, Mon Oct 12');
    expect(words(reason, 'sentence')).toBe('Mark acknowledged unavailable for XYZ on Mon Oct 12');
  });

  it('should word AwaitingClose and SessionPolicyNotCovered at each length', () => {
    const awaiting = { reason: 'AwaitingClose', after: '2026-10-12' } as const;
    expect(words(awaiting, 'label')).toBe('Awaiting close');
    expect(words(awaiting, 'figure')).toBe('Awaiting the close after Mon Oct 12');
    expect(words(awaiting, 'sentence')).toBe('Awaiting the next close after Mon Oct 12');
    const outside = { reason: 'SessionPolicyNotCovered', instrument: XYZ, date: '2026-10-12' } as const;
    expect(words(outside, 'label')).toBe('Outside calendar');
    expect(words(outside, 'figure')).toBe('Outside the market calendar: Mon Oct 12');
    expect(words(outside, 'sentence')).toBe('Mon Oct 12 is outside the market calendar');
  });

  const AT = '2026-10-14T14:30:00Z'; // 10:30 in New York
  const execution = (side: 'Buy' | 'Sell', quantity: string) => ({ factId: 'f1', kind: 'Execution', instrument: XYZ, economicTime: AT, side, quantity }) as const;
  const sentence = (finding: IncoherentFact) => text(findingWords(finding, ZONE));

  it('should word each finding as a sentence, with its quantities, and a Position Change duplicate in its own form', () => {
    expect(sentence({ ...execution('Sell', '120'), reason: 'ExceedsOpenQuantity', available: Rational.of(100n, 1n) })).toBe(
      'Sell of 120 XYZ on Wed Oct 14, 10:30 is more than the 100 shares open',
    );
    expect(sentence({ ...execution('Sell', '100'), reason: 'FlatBeforeLaterFacts' })).toBe('Sell of 100 XYZ on Wed Oct 14, 10:30 leaves the Position flat before later records');
    expect(sentence({ ...execution('Buy', '100'), reason: 'UnknownPlannedLeg' })).toBe("Buy of 100 XYZ on Wed Oct 14, 10:30 names a Planned Leg that isn't in the Plan");
    expect(sentence({ ...execution('Buy', '0'), reason: 'NonpositiveQuantity' })).toBe("Buy of 0 XYZ on Wed Oct 14, 10:30 has a quantity that isn't positive");
    expect(sentence({ ...execution('Buy', '100'), reason: 'DuplicateFactId' })).toBe('Buy of 100 XYZ on Wed Oct 14, 10:30 shares its identity with another record');
    expect(sentence({ factId: 'p1', kind: 'PositionChange', economicTime: AT, reason: 'DuplicateFactId' })).toBe('Position Change on Wed Oct 14, 10:30 shares its identity with another record');
  });

  it('should word FactsIncoherent as Facts cannot be replayed, Not available, and the first finding sentence with and 2 more', () => {
    const first: IncoherentFact = { ...execution('Buy', '0'), reason: 'NonpositiveQuantity' };
    const second: IncoherentFact = { ...execution('Buy', '100'), reason: 'DuplicateFactId' };
    const third: IncoherentFact = { factId: 'p1', kind: 'PositionChange', economicTime: AT, reason: 'DuplicateFactId' };
    const one = { reason: 'FactsIncoherent', findings: [first] } as const;
    const three = { reason: 'FactsIncoherent', findings: [first, second, third] } as const;
    expect(words(three, 'label')).toBe("Facts can't be replayed");
    expect(words(three, 'figure')).toBe('Not available');
    expect(words(one, 'sentence')).toBe("Buy of 0 XYZ on Wed Oct 14, 10:30 has a quantity that isn't positive");
    expect(words(three, 'sentence')).toBe("Buy of 0 XYZ on Wed Oct 14, 10:30 has a quantity that isn't positive and 2 more");
  });

  it('should word every NotApplicable reason as Not applicable and Not applicable: plus its words, and NonPositiveAtEntry by its side', () => {
    const cases = [
      [{ reason: 'NoRemainingPosition' }, 'no open position'],
      [{ reason: 'NotClosed' }, 'not closed yet'],
      [{ reason: 'EntryNotResolved' }, 'entry not resolved yet'],
      [{ reason: 'NoOngoingRisk' }, 'no risk to the Stop'],
      [{ reason: 'EntryAtOrBeyondStop' }, 'entry at or beyond the Stop'],
      [{ reason: 'EntryAtOrBeyondTarget' }, 'entry at or beyond the Target'],
      [{ reason: 'NonPositiveAtEntry', side: 'Losing' }, 'no risk at entry'],
      [{ reason: 'NonPositiveAtEntry', side: 'Winning' }, 'no reward at entry'],
    ] as const;
    for (const [reason, tail] of cases) {
      expect(text(notApplicableWords(reason, 'label'))).toBe('Not applicable');
      expect(text(notApplicableWords(reason, 'figure'))).toBe(`Not applicable: ${tail}`);
      expect(text(notApplicableWords(reason, 'sentence'))).toBe(`Not applicable: ${tail}`);
    }
  });

  it('should word Unbounded above and below', () => {
    expect(text(unboundedWords('Above'))).toBe('Unbounded above');
    expect(text(unboundedWords('Below'))).toBe('Unbounded below');
  });

  it('should return the words in parts, with the Instrument and the date as their own parts, and join them with text', () => {
    const parts = unavailableWords({ reason: 'MarkMissing', instrument: XYZ, date: '2026-10-12' }, 'figure', ZONE);
    expect(parts).toEqual([
      { kind: 'text', text: 'Mark missing: ' },
      { kind: 'instrument', instrument: XYZ },
      { kind: 'text', text: ', ' },
      { kind: 'date', date: '2026-10-12' },
    ]);
    expect(text(parts)).toBe('Mark missing: XYZ, Mon Oct 12');
  });

  it('should name an Instrument only through instrumentLabel: a stock by its symbol', () => {
    expect(instrumentLabel(XYZ)).toBe('XYZ');
    expect(instrumentLabel(instrumentOf('BRK.B'))).toBe('BRK.B');
  });

  it('should label an Option Instrument as XYZ 20 Nov 2026 55 Call', () => {
    expect(instrumentLabel(instrumentOf('XYZ261120C00055000'))).toBe('XYZ 20 Nov 2026 55 Call');
    expect(instrumentLabel({ kind: 'Option', symbol: 'BRK.B', root: 'BRKB', expiration: '2026-11-20', strike: '412.5', right: 'Put', multiplier: 100 })).toBe('BRK.B 20 Nov 2026 412.5 Put');
  });

  it('should label the Expected-Mark Status Acknowledged Unavailable with the Mark row casing', () => {
    expect(acknowledgedUnavailableStatusLabel()).toBe('Acknowledged Unavailable');
  });

  it('should recognise the two Position Change issue codes and no other', () => {
    expect(isExceedsOpenQuantityIssue({ code: 'ExceedsOpenQuantity' })).toBe(true);
    expect(isExceedsOpenQuantityIssue({ code: 'FlatBeforeLaterFacts' })).toBe(false);
    expect(isFlatBeforeLaterFactsIssue({ code: 'FlatBeforeLaterFacts' })).toBe(true);
    expect(isFlatBeforeLaterFactsIssue({ code: 'ExceedsOpenQuantity' })).toBe(false);
  });
});
