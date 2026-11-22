import { describe, expect, it } from 'vitest';
import { fixedClock } from '../../domain/time/index.ts';
import { beginSemanticTransaction } from '../../persistence/index.ts';
import { countRequests } from '../../../tests/support/request-counter.ts';
import { emptyWorkspace, sequentialIds } from '../../../tests/support/workspace.ts';
import { createJournal, D1_JOURNAL_MANIFEST, D2_JOURNAL_MANIFEST, D3_JOURNAL_MANIFEST, type DailyTradeReviewRequest } from './index.ts';

// T95.2: the Daily Trade Review Actions over a span of Review Dates, and one Trade's (P168).
const clock = fixedClock('2026-10-12T21:30:00Z');
const ACTION = 'prompt.daily-trade-review.action';
const INTENT = 'prompt.daily-trade-review.intent';
const option = (label: string) => ({ kind: 'Option', optionId: `option.daily-trade-review.action.${label.toLowerCase()}` }) as const;
// Seeding v1, v2, then v3 on an empty Journal: the third definition is Daily Trade Review.
const DEFINITION = 'j-0003';

async function fixture() {
  const { persistence } = await emptyWorkspace();
  const journal = createJournal({ persistence, ids: sequentialIds('j'), clock });
  await journal.seedDefaults(D1_JOURNAL_MANIFEST);
  await journal.seedDefaults(D2_JOURNAL_MANIFEST);
  await journal.seedDefaults(D3_JOURNAL_MANIFEST);
  const save = async (tradeId: string, reviewDate: string, answers: Record<string, unknown>) => {
    const request = {
      obligation: 'DailyTradeReview',
      disposition: { kind: 'Complete', form: { definitionId: DEFINITION, answers } },
      anchor: { kind: 'Trade', ref: tradeId },
      origin: { kind: 'DailyReview', ref: tradeId, reviewDate },
      momentTime: `${reviewDate}T21:00:00Z`,
    } as DailyTradeReviewRequest;
    const prepared = await journal.prepareEffects(request);
    if (prepared.kind !== 'Prepared') throw new Error('expected Prepared');
    const tx = beginSemanticTransaction();
    journal.applyPreparedEffects(tx, prepared, {});
    expect((await persistence.commit(tx.close())).kind).toBe('Committed');
  };
  return { journal, save };
}

describe('queryActions: earlier Actions since a date', () => {
  it('should return no earlier Actions when since is on or after the Review Date', async () => {
    const { journal, save } = await fixture();
    await save('trade-1', '2026-10-12', { [ACTION]: option('Exit'), [INTENT]: { kind: 'Text', text: 'Done.' } });
    await save('trade-2', '2026-10-13', { [ACTION]: option('Hold') });

    const onDate = await journal.queryActions({ reviewDate: '2026-10-13', since: '2026-10-13' });
    const after = await journal.queryActions({ reviewDate: '2026-10-13', since: '2026-10-14' });
    const before = await journal.queryActions({ reviewDate: '2026-10-13', since: '2026-10-12' });

    expect(onDate.earlier).toEqual([]);
    expect(after.earlier).toEqual([]);
    expect(before.earlier).toEqual([{ tradeId: 'trade-1', reviewDate: '2026-10-12', action: 'Exit', reason: 'Done.' }]);
  });
});

describe('queryActionHistory: Actions over a span of Review Dates', () => {
  it('should return the Actions saved between two Review Dates, each with its Trade, Review Date, Action and reason', async () => {
    const { journal, save } = await fixture();
    await save('trade-1', '2026-10-12', { [ACTION]: option('Hold') });
    await save('trade-2', '2026-10-12', { [ACTION]: option('Roll'), [INTENT]: { kind: 'Text', text: 'Roll out a month.' } });
    await save('trade-1', '2026-10-13', { [ACTION]: option('Exit'), [INTENT]: { kind: 'Text', text: 'Done.' } });

    const result = await journal.queryActionHistory({ from: '2026-10-12', through: '2026-10-13' });

    expect(result.kind).toBe('ActionHistory');
    expect(result.actions).toEqual([
      { tradeId: 'trade-1', reviewDate: '2026-10-12', action: 'Hold' },
      { tradeId: 'trade-2', reviewDate: '2026-10-12', action: 'Roll', reason: 'Roll out a month.' },
      { tradeId: 'trade-1', reviewDate: '2026-10-13', action: 'Exit', reason: 'Done.' },
    ]);
  });

  it('should leave out an Action saved for a date outside the span', async () => {
    const { journal, save } = await fixture();
    await save('trade-1', '2026-10-09', { [ACTION]: option('Hold') });
    await save('trade-1', '2026-10-12', { [ACTION]: option('Hold') });
    await save('trade-2', '2026-10-13', { [ACTION]: option('Hold') });
    await save('trade-1', '2026-10-14', { [ACTION]: option('Hold') });

    const result = await journal.queryActionHistory({ from: '2026-10-12', through: '2026-10-13' });

    expect(result.actions.map((a) => [a.tradeId, a.reviewDate])).toEqual([
      ['trade-1', '2026-10-12'],
      ['trade-2', '2026-10-13'],
    ]);
  });

  it('should return no reason where none was saved', async () => {
    const { journal, save } = await fixture();
    await save('trade-1', '2026-10-12', { [ACTION]: option('Hold'), [INTENT]: { kind: 'Unanswered' } });

    const [action] = (await journal.queryActionHistory({ from: '2026-10-12', through: '2026-10-12' })).actions;

    expect(action).toEqual({ tradeId: 'trade-1', reviewDate: '2026-10-12', action: 'Hold' });
    expect('reason' in action!).toBe(false);
  });

  it('should read the span in one request through byObligation, for two Trades and for four', async () => {
    const { journal, save } = await fixture();
    for (const trade of ['trade-1', 'trade-2']) {
      await save(trade, '2026-10-12', { [ACTION]: option('Hold') });
      await save(trade, '2026-10-13', { [ACTION]: option('Hold') });
    }
    const span = { from: '2026-10-12', through: '2026-10-13' };
    const entryRequests = (requests: { store: string }[]) => requests.filter((r) => r.store === 'journalEntries');

    const two = await countRequests(() => journal.queryActionHistory(span));
    for (const trade of ['trade-3', 'trade-4']) {
      await save(trade, '2026-10-12', { [ACTION]: option('Hold') });
      await save(trade, '2026-10-13', { [ACTION]: option('Hold') });
    }
    const four = await countRequests(() => journal.queryActionHistory(span));

    expect(two.result.actions).toHaveLength(4);
    expect(four.result.actions).toHaveLength(8);
    expect(entryRequests(two.requests)).toEqual([{ on: 'index', store: 'journalEntries', index: 'byObligation', method: 'getAll' }]);
    expect(entryRequests(four.requests)).toEqual(entryRequests(two.requests));
    expect(four.requests).toEqual(two.requests);
  });

  it('should return one Trade\'s Actions in one request through byAnchorTrade when a Trade is named', async () => {
    const { journal, save } = await fixture();
    await save('trade-1', '2026-10-13', { [ACTION]: option('Exit'), [INTENT]: { kind: 'Text', text: 'Done.' } });
    await save('trade-2', '2026-10-12', { [ACTION]: option('Hold') });
    await save('trade-1', '2026-10-12', { [ACTION]: option('Hold') });

    const { result, requests } = await countRequests(() => journal.queryActionHistory({ tradeId: 'trade-1' }));

    expect(result.actions).toEqual([
      { tradeId: 'trade-1', reviewDate: '2026-10-12', action: 'Hold' },
      { tradeId: 'trade-1', reviewDate: '2026-10-13', action: 'Exit', reason: 'Done.' },
    ]);
    expect(requests.filter((r) => r.store === 'journalEntries')).toEqual([{ on: 'index', store: 'journalEntries', index: 'byAnchorTrade', method: 'getAll' }]);
  });
});
