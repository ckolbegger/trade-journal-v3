import { afterEach, describe, expect, it, vi } from 'vitest';
import { instrumentOf } from '../../domain/instrument/index.ts';
import { Rational } from '../../domain/values/index.ts';
import { describedLabelsOf, labelsOf, reasonText } from './review-attention.ts';

afterEach(() => {
  vi.useRealTimers();
});

describe('contract names in the Workspace zone (A238)', () => {
  it('should word an unavailable Mark sentence with the contracts year decided in the Workspace zone', () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2027-01-01T03:00:00Z') });
    const reason = { code: 'Unavailable', reason: 'MarkMissing', instrument: instrumentOf('XYZ270115C00055000'), date: '2026-12-31' };
    expect(reasonText(reason as never, { kind: 'Unavailable' } as never, 'America/New_York')).toContain('XYZ Jan 15 2027');
  });
});

// A Trade as the walk returns it, with only what a label reads.
const marksPanel = (done: boolean) => ({ panels: [{ panel: 'Marks', done, resolved: done ? 1 : 0, needed: 1 }] });
const trade = (over: Record<string, unknown>) => ({ band: 'Routine', reasons: [], progress: marksPanel(true), ...over }) as never;
const between = (percent: bigint, toward: 'Stop' | 'Target') => ({ now: { kind: 'Value', value: { zone: 'Between', share: { percent: Rational.of(percent), toward } } } });
// The Pressure the label's percent reads: a share of the range, on the side the Trade moves toward.
const pressure = (percent: bigint, toward: 'Stop' | 'Target') => ({ kind: 'Value', value: { side: toward === 'Stop' ? 'Losing' : 'Winning', share: Rational.of(percent, 100n), atEntry: Rational.of(300n), now: Rational.of(100n) } });

const previous = (zone: string, tradingDate: string) => ({ now: { kind: 'Unavailable' }, previous: { tradingDate, zone } });

describe('each label has its own reason (A302)', () => {
  const unavailable = { code: 'Unavailable', reason: 'MarkMissing', instrument: { kind: 'Stock', symbol: 'DEF' }, date: '2026-11-23' };
  const needed = { progress: marksPanel(false), reasons: [unavailable] };
  it('should describe Marks needed by the missing Mark and the session before label by its own crossing', () => {
    const labels = describedLabelsOf(trade({ band: 'EvidenceLimited', ...needed, meter: previous('PastStop', '2026-11-20') }), 'UTC');
    expect(labels).toEqual([
      { label: 'Marks needed', reason: 'Mark missing for DEF on Mon Nov 23' },
      { label: 'Past Stop Fri', reason: 'Past Stop at the close on Fri' },
    ]);
  });
  it('should describe a share label by its own share and give a label with no returned reason none', () => {
    expect(describedLabelsOf(trade({ band: 'QuantifiedPressure', meter: between(63n, 'Stop'), basis: pressure(63n, 'Stop') }), 'UTC')).toEqual([{ label: '63% to Stop', reason: '63% of the way from entry to the Stop' }]);
    expect(describedLabelsOf(trade({ band: 'StopReached' }), 'UTC')).toEqual([{ label: 'Past Stop', reason: undefined }]);
  });
});

describe('the share label of a partly sold Trade (T95.26-B3)', () => {
  it('should word the label percent with the pressure share of the open Lots and not the meter share that counts the realized P&L', () => {
    const basis = (side: 'Losing' | 'Winning', share: Rational) => ({ kind: 'Value', value: { side, share, atEntry: Rational.of(300n), now: Rational.of(100n) } });
    const stop = trade({ band: 'QuantifiedPressure', meter: between(86n, 'Stop'), basis: basis('Losing', Rational.of(2n, 3n)) });
    expect(describedLabelsOf(stop, 'UTC')).toEqual([{ label: '67% to Stop', reason: '67% of the way from entry to the Stop' }]);
    const target = trade({ band: 'QuantifiedPressure', meter: between(79n, 'Target'), basis: basis('Winning', Rational.of(58n, 100n)) });
    expect(describedLabelsOf(target, 'UTC')).toEqual([{ label: '58% to Target', reason: '58% of the way from entry to the Target' }]);
  });
});

describe('the share label of a Trade whose total result is zero (T95.26-B6)', () => {
  it('should word the label from the pressure share when the meter returns no share', () => {
    const noShare = { now: { kind: 'Value', value: { zone: 'Between' } } };
    const basis = { kind: 'Value', value: { side: 'Losing', share: Rational.of(2n, 3n), atEntry: Rational.of(300n), now: Rational.of(100n) } };
    expect(describedLabelsOf(trade({ band: 'QuantifiedPressure', meter: noShare, basis }), 'UTC')).toEqual([{ label: '67% to Stop', reason: '67% of the way from entry to the Stop' }]);
  });
});

describe('plain labels (A302)', () => {
  it('should label a Trade past its Stop Past Stop and one at its Target At Target', () => {
    expect(labelsOf(trade({ band: 'StopReached' }))).toEqual(['Past Stop']);
    expect(labelsOf(trade({ band: 'TargetReached' }))).toEqual(['At Target']);
  });

  it('should label a Trade whose Marks are not saved Marks needed, beside the session before label with its day', () => {
    const needed = { progress: marksPanel(false) };
    expect(labelsOf(trade({ band: 'EvidenceLimited', ...needed }))).toEqual(['Marks needed']);
    expect(labelsOf(trade({ band: 'EvidenceLimited', ...needed, meter: previous('PastStop', '2026-11-20') }))).toEqual(['Marks needed', 'Past Stop Fri']);
    expect(labelsOf(trade({ band: 'EvidenceLimited', ...needed, meter: previous('PastTarget', '2026-11-19') }))).toEqual(['Marks needed', 'At Target Thu']);
    expect(labelsOf(trade({ band: 'EvidenceLimited', ...needed, meter: previous('Between', '2026-11-19') }))).toEqual(['Marks needed']);
  });

  it('should label an expired contract Expired: settle and one expiring on the Review Date Expires today · Marks needed', () => {
    expect(labelsOf(trade({ band: 'SettlementDue' }))).toEqual(['Expired: settle']);
    expect(labelsOf(trade({ band: 'EvidenceLimited', expiresOnReviewDate: true, progress: marksPanel(false) }))).toEqual(['Expires today · Marks needed']);
  });

  it('should label a Trade with an acknowledged Unavailable Mark No price today', () => {
    const reasons = [{ code: 'Unavailable', reason: 'AcknowledgedUnavailable', instrument: { kind: 'Stock', symbol: 'DEF' }, date: '2026-11-23' }];
    expect(labelsOf(trade({ band: 'EvidenceLimited', reasons, basis: { kind: 'Unavailable' } }))).toEqual(['No price today']);
  });

  it('should label a Trade inside its lines by its share of the way', () => {
    expect(labelsOf(trade({ band: 'QuantifiedPressure', meter: between(63n, 'Stop'), basis: pressure(63n, 'Stop') }))).toEqual(['63% to Stop']);
    expect(labelsOf(trade({ band: 'QuantifiedPressure', meter: between(48n, 'Target'), basis: pressure(48n, 'Target') }))).toEqual(['48% to Target']);
  });
});
