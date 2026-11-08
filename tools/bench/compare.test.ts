import { describe, expect, it } from 'vitest';
import { BENCH_SETTLEMENT_DUE, expectedSettlementDue } from '../../src/app/bench.ts';
import { Rational } from '../../src/domain/values/index.ts';
import { instrumentLabel } from '../../src/ui/calculation-words.ts';
import { shortDate } from '../../src/ui/format.ts';
import { signedContracts } from '../../src/ui/screens/option-words.ts';
import { closeDate, closedIdentity, contractLabel, expectedSettlementIdentity, firstDifference, reviewShortDate, settlementExpectations, signedContractsText, tradeIdOfHref, walkedTradesOwingNothing } from './compare.ts';
import { countStored, lastSessionOf, reviewMembersOf, schemaMismatch, type EntryRow, type StoredRows, type TradeRow } from './partial.ts';

describe('bench Action-save card choice', () => {
  // Every Underlying (AAA, BBB, CCC, DDD) has an owing walked Trade, yet some walked Trades owe none.
  const cards = [
    { tradeId: 'w1', underlying: 'AAA' },
    { tradeId: 'w2', underlying: 'AAA' },
    { tradeId: 'w3', underlying: 'BBB' },
    { tradeId: 'w4', underlying: 'BBB' },
    { tradeId: 'x1', underlying: 'CCC' },
    { tradeId: 'w5', underlying: 'CCC' },
    { tradeId: 'w6', underlying: 'DDD' },
    { tradeId: 'w7', underlying: 'MMM' },
  ];
  const walk = ['w7', 'w1', 'w2', 'w3', 'w4', 'w5', 'w6'];
  const debts = [{ tradeId: 'w1' }, { tradeId: 'w3' }, { tradeId: 'w5' }, { tradeId: 'x1' }, { tradeId: 'w6' }];

  it('should choose the walked Trades owing nothing, in card order, leaving out Missing Underlyings', () => {
    expect(walkedTradesOwingNothing(cards, walk, debts, ['MMM'], 10)).toEqual([
      { tradeId: 'w2', underlying: 'AAA' },
      { tradeId: 'w4', underlying: 'BBB' },
    ]);
  });

  it('should never choose a walked Trade that owes a reflection, and stop at the limit', () => {
    expect(walkedTradesOwingNothing(cards, walk, [], [], 3).map((c) => c.tradeId)).toEqual(['w1', 'w2', 'w3']);
    expect(walkedTradesOwingNothing(cards, walk, debts, [], 10).map((c) => c.tradeId)).toEqual(['w2', 'w4', 'w7']);
  });
});

describe('bench identity comparisons', () => {
  it('should report no difference for equal lists and the first difference otherwise', () => {
    expect(firstDifference(['a', 'b'], ['a', 'b'])).toBeUndefined();
    expect(firstDifference(['a', 'b', 'c'], ['a', 'x', 'c'])).toBe('position 2: expected "b", rendered "x"');
    expect(firstDifference(['a', 'b'], ['a'])).toBe('2 expected, 1 rendered (they agree on the first 1)');
  });

  it('should date a Closed row in the Workspace time zone, not in UTC', () => {
    expect(closeDate('2026-03-03T02:30:00Z', 'America/New_York')).toBe('2026-03-02');
    expect(closedIdentity({ tradeId: 't1', underlying: 'XYZ', terminalTime: '2026-03-03T15:00:00Z' }, 'America/New_York')).toBe('t1 XYZ 2026-03-03');
  });

  it('should read the Trade from a Closed row link', () => {
    expect(tradeIdOfHref('/trades/abc-123')).toBe('abc-123');
  });
});

const trade = (tradeId: string, lifecycle: string, over: Partial<TradeRow> = {}): TradeRow => ({ tradeId, underlying: tradeId.toUpperCase(), lifecycle, positionChanges: 0, executions: 0, closeReason: false, ...over });
const entry = (entryTypeKey: string, over: Partial<EntryRow> = {}): EntryRow => ({
  entryTypeKey,
  sourceKey: 'source.position-change',
  anchorTradeId: 'a',
  momentTime: '2027-02-17T21:00:00Z',
  authoredTime: '2027-02-17T21:35:00Z',
  versions: 1,
  ...over,
});
const none: StoredRows = { trades: [], entries: [], declines: [], debts: [], observations: [] };

describe('partial dataset counts', () => {
  it('should count what is stored by Lifecycle State, kind and last status', () => {
    const counts = countStored({
      trades: [
        trade('a', 'Closed', { positionChanges: 4, executions: 7, closeReason: true }),
        trade('b', 'Open', { positionChanges: 1, executions: 2 }),
        trade('c', 'Planned'),
      ],
      entries: [
        entry('entry-type.plan-reflection'),
        entry('entry-type.position-change-reflection'),
        entry('entry-type.position-change-reflection'),
        entry('entry-type.close-review'),
        entry('entry-type.daily-trade-review', { reviewDate: '2027-02-17' }),
        entry('entry-type.daily-trade-review', { reviewDate: '2027-02-17', versions: 2 }),
      ],
      declines: [{ entryTypeKey: 'entry-type.position-change-reflection' }, { entryTypeKey: 'entry-type.close-review' }],
      debts: [
        { anchorTradeId: 'a', entryTypeKey: 'entry-type.close-review', status: 'Settled' },
        { anchorTradeId: 'b', entryTypeKey: 'entry-type.position-change-reflection', status: 'Declined' },
        { anchorTradeId: 'b', entryTypeKey: 'entry-type.position-change-reflection', status: 'Outstanding' },
      ],
      observations: [
        { instrumentKey: 'A', tradingDate: '2027-02-16', marks: 2, corrections: 1 },
        { instrumentKey: 'B', tradingDate: '2027-02-16', marks: 1, corrections: 0 },
        { instrumentKey: 'A', tradingDate: '2027-02-17', marks: 1, corrections: 0 },
      ],
    });
    expect(counts).toEqual({
      trades: 3, openTrades: 1, plannedTrades: 1, closedTrades: 1, positionChanges: 5, executions: 9, closeReasons: 1, sessions: 2,
      marks: 4, markCorrections: 1, actions: 2, editedActions: 1, planReflectionEntries: 1, positionChangeReflectionEntries: 2,
      positionChangeReflectionDeclines: 1, closeReviewEntries: 1, closeReviewDeclines: 1, debts: 3, debtsSettled: 1, debtsDeclined: 1, debtsOutstanding: 1,
    });
    expect(countStored(none).trades).toBe(0);
  });
});

const action = (reviewDate: string, over: Partial<EntryRow> = {}) =>
  entry('entry-type.daily-trade-review', { sourceKey: 'source.daily-review', reviewDate, momentTime: `${reviewDate}T21:00:00Z`, authoredTime: `${reviewDate}T21:35:00Z`, ...over });
const marks = (tradingDate: string, instrumentKey = 'A') => ({ instrumentKey, tradingDate, marks: 1, corrections: 0 });

describe('partial dataset Review members', () => {
  it('should walk the Trades open at the close, owe the Outstanding Debts outside the walk, and name the Instruments without a Mark', () => {
    const last = { reviewDate: '2027-02-17', cutoff: '2027-02-17T21:00:00Z', asOf: '2027-02-17T21:35:00Z' };
    const rows: StoredRows = {
      ...none,
      trades: [
        trade('open1', 'Open', { exposureStart: '2027-02-10T15:00:00Z' }),
        trade('open2', 'Open', { exposureStart: '2027-02-10T15:00:00Z', underlying: 'OPEN1' }),
        trade('open3', 'Open', { exposureStart: '2027-02-17T21:30:00Z' }),
        trade('late', 'Closed', { exposureStart: '2027-02-10T15:00:00Z', terminalTime: '2027-02-17T21:10:00Z' }),
        trade('early', 'Closed', { exposureStart: '2027-02-01T15:00:00Z', terminalTime: '2027-02-17T20:00:00Z' }),
        trade('planned', 'Planned'),
      ],
      debts: [
        { anchorTradeId: 'early', entryTypeKey: 'entry-type.close-review', status: 'Outstanding' },
        { anchorTradeId: 'early', entryTypeKey: 'entry-type.position-change-reflection', status: 'Outstanding' },
        { anchorTradeId: 'open1', entryTypeKey: 'entry-type.position-change-reflection', status: 'Outstanding' },
        { anchorTradeId: 'planned', entryTypeKey: 'entry-type.position-change-reflection', status: 'Settled' },
      ],
      observations: [marks('2027-02-17', 'OPEN1'), marks('2027-02-16', 'OPEN2'), marks('2027-02-17', 'OTHER')],
      entries: [action('2027-02-17', { anchorTradeId: 'open2' }), action('2027-02-16', { anchorTradeId: 'open1' })],
    };
    expect(reviewMembersOf(rows, last)).toEqual({
      walk: ['late', 'open1', 'open2'],
      owed: ['early'],
      openUnderlyings: ['OPEN1', 'OPEN1', 'OPEN3'],
      missingInstruments: ['OPEN3'],
      actionedWalk: ['open2'],
    });
  });
});

describe('partial dataset last session', () => {
  it('should take the latest Marks date, its close from the Actions saved on it, and the as-of instant 35 minutes later', () => {
    const rows: StoredRows = { ...none, observations: [marks('2027-02-16'), marks('2027-02-17')], entries: [action('2027-02-16', { momentTime: '2027-02-16T21:00:00Z' }), action('2027-02-17'), action('2027-02-17', { anchorTradeId: 'b' })] };
    expect(lastSessionOf(rows)).toEqual({ reviewDate: '2027-02-17', cutoff: '2027-02-17T21:00:00Z', asOf: '2027-02-17T21:35:00Z' });
  });

  it('should refuse a last session whose Actions disagree on the close or on the authoring instant, or that has none', () => {
    const observations = [marks('2027-02-17')];
    expect(() => lastSessionOf({ ...none, observations })).toThrow(/no Daily Trade Review Action/);
    expect(() => lastSessionOf({ ...none, observations, entries: [action('2027-02-17'), action('2027-02-17', { momentTime: '2027-02-17T18:00:00Z' })] })).toThrow(/close/);
    expect(() => lastSessionOf({ ...none, observations, entries: [action('2027-02-17', { authoredTime: '2027-02-17T21:40:00Z' })] })).toThrow(/authored/);
  });

  it('should accept a stored schema version equal to the source and refuse a different or unreadable one', () => {
    expect(schemaMismatch(5, 5)).toBeUndefined();
    expect(schemaMismatch(4, 5)).toMatch(/schema version 4.*5/);
    expect(schemaMismatch(6, 5)).toMatch(/schema version 6.*5/);
    expect(schemaMismatch(undefined, 5)).toMatch(/no schema version/);
  });
});

describe('settlement identities (T7.29)', () => {
  it('should word a contract key, a signed quantity and an expiration date as the Review does', () => {
    expect(contractLabel('NVDA261120C00107000')).toBe('NVDA 20 Nov 2026 107 Call');
    expect(contractLabel('QAB270104P00092500')).toBe('QAB 4 Jan 2027 92.5 Put');
    expect(signedContractsText('20')).toBe('Long 20 contracts');
    expect(signedContractsText('-1')).toBe('Short 1 contract');
    expect(reviewShortDate('2026-11-20')).toBe('Fri Nov 20');
    expect(expectedSettlementIdentity({ tradeId: 't1', contract: 'AAPL261120C00105000', expiration: '2026-11-20', quantity: '20' })).toBe('t1 AAPL 20 Nov 2026 105 Call Long 20 contracts expired Fri Nov 20');
  });
});

describe('settlement label helpers (T7.29-B4)', () => {
  it('should build the contract, date and signed-quantity texts with the UI functions instrumentLabel, shortDate and signedContracts', () => {
    const call = { kind: 'Option', symbol: 'NVDA', root: 'NVDA', expiration: '2026-11-20', strike: '107', right: 'Call', multiplier: 100 } as const;
    const put = { kind: 'Option', symbol: 'QAB', root: 'QAB', expiration: '2027-01-04', strike: '92.5', right: 'Put', multiplier: 100 } as const;
    expect(contractLabel('NVDA261120C00107000')).toBe(instrumentLabel(call));
    expect(contractLabel('QAB270104P00092500')).toBe(instrumentLabel(put));
    for (const q of [20, -1, 1, -2]) expect(signedContractsText(String(q))).toBe(signedContracts(Rational.of(BigInt(q))));
    for (const d of ['2026-11-20', '2027-01-04']) expect(reviewShortDate(d)).toBe(shortDate(d));
  });
});

describe('settlement expectations (T7.29-B3)', () => {
  it('should fail naming the missing settlement list when the profile has Settlement Due contracts', () => {
    expect(() => settlementExpectations(undefined, 4)).toThrow(/asOfReview\.settlement.*missing.*4/);
    expect(() => settlementExpectations([], 4)).toThrow(/asOfReview\.settlement.*empty.*4/);
    expect(settlementExpectations(undefined, 0)).toBeUndefined();
    const items = [{ tradeId: 't1', contract: 'AAPL261120C00105000', expiration: '2026-11-20', quantity: '20' }];
    expect(settlementExpectations(items, 1)).toBe(items);
  });
});

describe('expected Settlement Due count (T7.29-B9)', () => {
  it('should expect the lesser of the generator due count and the Open option Trades, and none for a partial dataset', () => {
    expect(expectedSettlementDue({ partial: false, openOptionTrades: 60 })).toBe(BENCH_SETTLEMENT_DUE);
    expect(expectedSettlementDue({ partial: false, openOptionTrades: 2 })).toBe(2);
    expect(expectedSettlementDue({ partial: false, openOptionTrades: 0 })).toBe(0);
    expect(expectedSettlementDue({ partial: true, openOptionTrades: 60 })).toBe(0);
  });
});
