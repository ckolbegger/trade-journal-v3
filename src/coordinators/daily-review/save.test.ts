import { describe, expect, it } from 'vitest';
import { createDailyReview } from './index.ts';
import { fiveTradeFixture, MONDAY_1700, reviewStack, type ReviewStack } from '../../../tests/support/review-fixture.ts';
import { dumpAll } from '../../../tests/support/stack.ts';
import type { ActionChoice, GetDailyTradeReviewResult, SaveDailyReviewResult, TradeSaveBinding } from './index.ts';

// T4.16: DailyReview.save (SaveTradeAction), against the five-Trade fixture at Monday 17:00.

// The Trade's save binding, as the Review screen receives it from getTrade.
async function bindingFor(stack: ReviewStack, tradeId: string): Promise<TradeSaveBinding> {
  const opened = await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MONDAY_1700 });
  if (opened.kind !== 'Ready') throw new Error(`expected Ready, got ${opened.kind}`);
  const trade: GetDailyTradeReviewResult = await stack.dailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId, binding: opened.binding });
  if (trade.kind !== 'Ready') throw new Error(`expected Ready, got ${trade.kind}`);
  return trade.trade.saveBinding;
}

const saveAction = (stack: ReviewStack, binding: TradeSaveBinding, action: ActionChoice = 'Hold', intent?: string): Promise<SaveDailyReviewResult> =>
  stack.dailyReview.save({ kind: 'SaveTradeAction', binding, action, ...(intent === undefined ? {} : { intent }) });

function saved(result: SaveDailyReviewResult) {
  if (result.kind !== 'Saved') throw new Error(`expected Saved, got ${result.kind}`);
  return result;
}

describe('SaveTradeAction (AC-REV-003)', () => {
  it('should save Hold with no Intent as one Daily Trade Review Entry and return the Entry, the revised progress and completion, and the next step', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a, b, c, d, e } = await fiveTradeFixture(stack);
    const binding = await bindingFor(stack, a);

    const result = saved(await saveAction(stack, binding));

    // One Entry, durable, with the Hold Action and no Intent.
    const actions = (await stack.journal.queryActions({ reviewDate: binding.reviewDate })).actions;
    expect(Object.keys(actions)).toEqual([a]);
    expect(actions[a]).toEqual(expect.objectContaining({ action: 'Hold', entryRevision: 1 }));
    expect(result.action).toEqual(actions[a]);

    // Progress counts the Trades with an Action among the five eligible.
    expect(result.review).toEqual(expect.objectContaining({ kind: 'Ready', progress: { tradesWithAction: 1, tradesEligible: 5 } }));

    // Completion is the one `open` derives from the facts after the save: T-A's Action is no longer missing.
    const reasons = result.review.kind === 'Ready' && result.review.completion.kind === 'Incomplete' ? result.review.completion.reasons : [];
    expect(reasons.filter((r) => r.code === 'ActionMissing').map((r) => r.tradeId).sort()).toEqual([b, c, d, e].sort());
    expect(reasons).toContainEqual(expect.objectContaining({ code: 'MarkMissing', instrumentKey: 'DEF' }));
    const reopened = await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MONDAY_1700 });
    expect(result.review.kind === 'Ready' && result.review.completion).toEqual(reopened.kind === 'Ready' && reopened.completion);

    // The Review-date Mark for DEF is still missing, and Marks come first: the next step asks for it.
    expect(result.review.kind === 'Ready' && result.review.nextStep).toEqual({ kind: 'Mark', row: expect.objectContaining({ instrumentKey: 'DEF', task: 'Manual', trades: [c] }) as unknown });
  }, 30_000);

  it('should continue with the first Trade of the walk that has no Action, with the form getTrade would return', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a, d } = await fiveTradeFixture(stack);
    await stack.saveMark('DEF', '40.50');
    const binding = await bindingFor(stack, a);

    const { review } = saved(await saveAction(stack, binding));

    // The walk is T-D, T-B, T-C, T-A, T-E: T-A is saved, so T-D is next.
    if (review.kind !== 'Ready' || review.nextStep.kind !== 'Trade') throw new Error(`expected a Trade next step, got ${review.kind === 'Ready' ? review.nextStep.kind : review.kind}`);
    const again = await stack.dailyReview.getTrade({ reviewDate: binding.reviewDate, tradeId: d, binding: review.binding });
    expect(again.kind === 'Ready' && again.trade).toEqual(review.nextStep.trade);
    expect(review.nextStep.trade.form).toEqual({ kind: 'New', viewState: { selectedAction: 'Hold' } });
  }, 30_000);

  it('should reject Exit, Roll, or Adjust without Intent, and save them with Intent while creating no Trade fact', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a, b, c } = await fiveTradeFixture(stack);
    const bindings = { a: await bindingFor(stack, a), b: await bindingFor(stack, b), c: await bindingFor(stack, c) };
    const before = await dumpAll(stack.factory);

    // Without Intent, or with a blank one, nothing is written.
    for (const action of ['Exit', 'Roll', 'Adjust'] as const) {
      expect(await saveAction(stack, bindings.a, action)).toEqual({ kind: 'Rejected', issues: [{ code: 'RequiredAnswerMissing', promptId: 'prompt.daily-trade-review.intent' }] });
      expect(await saveAction(stack, bindings.a, action, '   ')).toEqual({ kind: 'Rejected', issues: [{ code: 'RequiredAnswerMissing', promptId: 'prompt.daily-trade-review.intent' }] });
    }
    expect(await dumpAll(stack.factory)).toEqual(before);

    // With Intent they save the Action and its Intent, and nothing else about the Trade.
    const choices = [
      [a, bindings.a, 'Exit'],
      [b, bindings.b, 'Roll'],
      [c, bindings.c, 'Adjust'],
    ] as const;
    for (const [tradeId, binding, action] of choices) {
      const result = saved(await saveAction(stack, binding, action, 'Because the plan changed.'));
      expect(result.action).toEqual(expect.objectContaining({ action, responses: expect.arrayContaining([{ prompt: 'Why are you taking this action?', answer: { kind: 'Text', text: 'Because the plan changed.' } }]) as unknown }));
      expect((await stack.journal.queryActions({ reviewDate: binding.reviewDate })).actions[tradeId]).toEqual(result.action);
    }
    const after = await dumpAll(stack.factory);
    const stores = (dump: typeof after) => Object.values(dump).find((db) => 'trades' in db)!;
    expect(stores(after)['trades']).toEqual(stores(before)['trades']);
    expect(stores(after)['journalEntries']).toHaveLength(stores(before)['journalEntries']!.length + 3);
  }, 30_000);

  it('should edit the same Entry identity when the Action is saved again with the expected Entry revision', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a } = await fiveTradeFixture(stack);
    const first = saved(await saveAction(stack, await bindingFor(stack, a)));

    // The form is rendered again from the saved Action: it names Entry revision 1.
    const binding = await bindingFor(stack, a);
    expect(binding.expectedEntryRevision).toBe(1);
    const second = saved(await saveAction(stack, binding, 'Exit', 'Because the plan changed.'));

    expect(second.action).toEqual(expect.objectContaining({ id: first.action.id, action: 'Exit', entryRevision: 2, edited: true }));
    const dump = await dumpAll(stack.factory);
    const entries = Object.values(dump).find((db) => 'journalEntries' in db)!['journalEntries'] as { id: string; versions: unknown[] }[];
    expect(entries.filter((entry) => entry.id === first.action.id).map((entry) => entry.versions.length)).toEqual([2]);
    expect(entries.filter((entry) => (entry as { entryTypeKey?: string }).entryTypeKey === 'entry-type.daily-trade-review')).toHaveLength(1);
  }, 30_000);
  it('should report Complete with nothing left to do when the save was the last open obligation', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a, b, c, e } = await fiveTradeFixture(stack, { withoutD: true });
    await stack.saveMark('DEF', '40.50');
    for (const tradeId of [b, c, e]) await stack.saveAction(tradeId, 'Hold');
    const binding = await bindingFor(stack, a);

    const { review } = saved(await saveAction(stack, binding));

    expect(review).toEqual(expect.objectContaining({ kind: 'Ready', completion: { kind: 'Complete' }, nextStep: { kind: 'Done' }, progress: { tradesWithAction: 4, tradesEligible: 4 } }));
  }, 30_000);
});

describe('changed evidence (AC-REV-005)', () => {
  it('should return ReviewChanged with refreshed evidence and write nothing when a Mark, an acknowledgment, or the Trade facts changed since the binding', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a } = await fiveTradeFixture(stack);
    const binding = await bindingFor(stack, a);

    // A Mark corrected after the form was rendered: the refreshed frames carry the corrected price.
    const corrected = await stack.marketData.save({ intention: 'CorrectMark', instrumentKey: 'XYZ', tradingDate: binding.reviewDate, price: '51.50', reason: 'Typo.', expectedResolutionRevision: 1 });
    expect(corrected.kind).toBe('Saved');
    const before = await dumpAll(stack.factory);

    const result = await saveAction(stack, binding);

    if (result.kind !== 'ReviewChanged') throw new Error(`expected ReviewChanged, got ${result.kind}`);
    expect(result.evidence.marketDataSnapshotId).not.toBe(binding.marketDataSnapshotId);
    expect(result.evidence.frames).toContainEqual(expect.objectContaining({ instrumentKey: 'XYZ', resolution: expect.objectContaining({ kind: 'Available', mark: expect.objectContaining({ price: '51.5' }) as unknown }) as unknown }));
    expect(await dumpAll(stack.factory)).toEqual(before);

    // An acknowledgment recorded on another Review Instrument after a fresh binding.
    const afterMark = await bindingFor(stack, a);
    await stack.acknowledge('DEF');
    const beforeAcknowledgment = await dumpAll(stack.factory);
    const acknowledged = await saveAction(stack, afterMark);
    if (acknowledged.kind !== 'ReviewChanged') throw new Error(`expected ReviewChanged, got ${acknowledged.kind}`);
    expect(acknowledged.evidence.frames).toContainEqual(expect.objectContaining({ instrumentKey: 'DEF', resolution: expect.objectContaining({ kind: 'AcknowledgedUnavailable' }) as unknown }));
    expect(await dumpAll(stack.factory)).toEqual(beforeAcknowledgment);

    // A fill recorded on the Trade after the form was rendered: the refreshed evidence names its new FactRevision.
    const afterAcknowledgment = await bindingFor(stack, a);
    const current = await stack.tradeRecord.getRecord({ tradeId: a, projection: 'AnalysisInput' });
    if (current.kind !== 'Found') throw new Error('no Trade');
    await stack.fill(current.projection as Parameters<typeof stack.fill>[0], '2026-10-12T20:05:00Z', '10', '51.00');
    const beforeFill = await dumpAll(stack.factory);
    const filled = await saveAction(stack, afterAcknowledgment);
    if (filled.kind !== 'ReviewChanged') throw new Error(`expected ReviewChanged, got ${filled.kind}`);
    expect(filled.evidence.factRevision).toBeGreaterThan(afterAcknowledgment.factRevision);
    expect(await dumpAll(stack.factory)).toEqual(beforeFill);
  }, 30_000);

  it('should return Conflict and write nothing when another Action was saved for the same Trade and date since the binding', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a, b } = await fiveTradeFixture(stack);
    const newForm = await bindingFor(stack, a);
    await stack.saveAction(a, 'Hold');
    const before = await dumpAll(stack.factory);

    // A form rendered with no Action cannot create a second Entry.
    expect(await saveAction(stack, newForm, 'Exit', 'Because the plan changed.')).toEqual({ kind: 'Conflict' });
    expect(await dumpAll(stack.factory)).toEqual(before);

    // A form rendered from Entry revision 1 cannot edit revision 2.
    const saved1 = await bindingFor(stack, b);
    await saveAction(stack, saved1);
    const editing = await bindingFor(stack, b);
    saved(await saveAction(stack, editing, 'Exit', 'Because the plan changed.'));
    const afterEdit = await dumpAll(stack.factory);
    expect(await saveAction(stack, editing, 'Adjust', 'Another thought.')).toEqual({ kind: 'Conflict' });
    expect(await dumpAll(stack.factory)).toEqual(afterEdit);
  }, 30_000);
});

describe('write gate', () => {
  it('should return RuntimeNotWritable and write nothing when the mutation-boundary readiness recheck fails', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a } = await fiveTradeFixture(stack);
    const binding = await bindingFor(stack, a);
    stack.testHost.fail(['inventory']);
    const before = await dumpAll(stack.factory);

    expect(await saveAction(stack, binding)).toEqual(
      expect.objectContaining({ kind: 'RuntimeNotWritable', runtimeReadiness: 'RecoveryOnly', failedChecks: [{ check: 'inventory', reason: 'InventoryMissing' }] }),
    );
    expect(await dumpAll(stack.factory)).toEqual(before);
  }, 30_000);
});

// The commit rechecks the bindings (ADR 0002): a write that lands after the read and before the commit.
describe('bindings rechecked inside the commit', () => {
  // A Review whose Journal runs `race` once, after an Action has been prepared and before it commits.
  const racing = (stack: ReviewStack, race: () => Promise<void>) => {
    let raced = false;
    const prepareEffects = (async (request: Parameters<typeof stack.journal.prepareEffects>[0]) => {
      const prepared = await stack.journal.prepareEffects(request as never);
      if (!raced) {
        raced = true;
        await race();
      }
      return prepared;
    }) as typeof stack.journal.prepareEffects;
    return createDailyReview({ ...stack, journal: { ...stack.journal, prepareEffects } });
  };

  it('should return ReviewChanged and write no Action when the Trade facts change after the read and before the commit', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a } = await fiveTradeFixture(stack);
    const binding = await bindingFor(stack, a);
    const review = racing(stack, async () => {
      const current = await stack.tradeRecord.getRecord({ tradeId: a, projection: 'AnalysisInput' });
      if (current.kind !== 'Found') throw new Error('no Trade');
      await stack.fill(current.projection as Parameters<typeof stack.fill>[0], '2026-10-12T20:05:00Z', '10', '51.00');
    });

    const result = await review.save({ kind: 'SaveTradeAction', binding, action: 'Hold' });

    if (result.kind !== 'ReviewChanged') throw new Error(`expected ReviewChanged, got ${result.kind}`);
    expect(result.evidence.factRevision).toBeGreaterThan(binding.factRevision);
    expect((await stack.journal.queryActions({ reviewDate: binding.reviewDate })).actions).toEqual({});
  }, 30_000);

  it('should return ReviewChanged and write nothing when the save binding names another Workspace', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a } = await fiveTradeFixture(stack);
    const binding = await bindingFor(stack, a);
    const before = await dumpAll(stack.factory);

    const result = await saveAction(stack, { ...binding, databaseName: 'other-workspace' });

    expect(result.kind).toBe('ReviewChanged');
    expect(await dumpAll(stack.factory)).toEqual(before);
  }, 30_000);

  it('should return ReviewChanged and write no Action when a Mark changes after the read and before the commit', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a } = await fiveTradeFixture(stack);
    const binding = await bindingFor(stack, a);
    const review = racing(stack, async () => {
      const corrected = await stack.marketData.save({ intention: 'CorrectMark', instrumentKey: 'XYZ', tradingDate: binding.reviewDate, price: '51.50', reason: 'Typo.', expectedResolutionRevision: 1 });
      expect(corrected.kind).toBe('Saved');
    });

    const result = await review.save({ kind: 'SaveTradeAction', binding, action: 'Hold' });

    if (result.kind !== 'ReviewChanged') throw new Error(`expected ReviewChanged, got ${result.kind}`);
    expect(result.evidence.marketDataSnapshotId).not.toBe(binding.marketDataSnapshotId);
    expect((await stack.journal.queryActions({ reviewDate: binding.reviewDate })).actions).toEqual({});
  }, 30_000);

  it('should return ReviewChanged and write nothing when an earlier-session Mark is corrected between the read and the commit', async () => {
    const stack = await reviewStack(MONDAY_1700);
    // DEF has no Review-date Mark; its Stale context is Friday's Mark.
    await stack.saveMark('DEF', '39.00', '2026-10-09');
    const { a } = await fiveTradeFixture(stack);
    const binding = await bindingFor(stack, a);
    const review = racing(stack, async () => {
      const corrected = await stack.marketData.save({ intention: 'CorrectMark', instrumentKey: 'DEF', tradingDate: '2026-10-09', price: '39.50', reason: 'Typo.', expectedResolutionRevision: 1 });
      expect(corrected.kind).toBe('Saved');
    });
    const result = await review.save({ kind: 'SaveTradeAction', binding, action: 'Hold' });

    if (result.kind !== 'ReviewChanged') throw new Error(`expected ReviewChanged, got ${result.kind}`);
    expect(result.evidence.marketDataSnapshotId).not.toBe(binding.marketDataSnapshotId);
    expect((await stack.journal.queryActions({ reviewDate: binding.reviewDate })).actions).toEqual({});
  }, 30_000);

  it('should return ReviewChanged and write no Action when an acknowledgment is recorded after the read and before the commit', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a } = await fiveTradeFixture(stack);
    const binding = await bindingFor(stack, a);
    const review = racing(stack, () => stack.acknowledge('DEF'));

    const result = await review.save({ kind: 'SaveTradeAction', binding, action: 'Hold' });

    expect(result.kind).toBe('ReviewChanged');
    expect((await stack.journal.queryActions({ reviewDate: binding.reviewDate })).actions).toEqual({});
  }, 30_000);

  it('should save the Action, retrying, when only the shared Journal counter moved between the read and the commit', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a, b } = await fiveTradeFixture(stack);
    const binding = await bindingFor(stack, a);
    const journalRevision = async () => {
      const { value } = await stack.persistence.readSnapshot(['meta'], async (tx) => (await tx.get('meta', 'journal'))?.['journalRevision']);
      return value as number;
    };
    const base = await journalRevision();
    // An Action for another Trade lands in between: the subject (this Trade's Action) is unchanged.
    const review = racing(stack, () => stack.saveAction(b, 'Hold'));

    const result = await review.save({ kind: 'SaveTradeAction', binding, action: 'Hold' });

    expect(result.kind).toBe('Saved');
    expect(Object.keys((await stack.journal.queryActions({ reviewDate: binding.reviewDate })).actions).sort()).toEqual([a, b].sort());
    expect(await journalRevision()).toBe(base + 2);
  }, 30_000);

  it('should return Conflict and keep the one Entry when another Action for the Trade and date lands after the read and before the commit', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a } = await fiveTradeFixture(stack);
    const binding = await bindingFor(stack, a);
    const review = racing(stack, () => stack.saveAction(a, 'Hold'));

    const result = await review.save({ kind: 'SaveTradeAction', binding, action: 'Exit', intent: 'Because the plan changed.' });

    expect(result).toEqual({ kind: 'Conflict' });
    const actions = (await stack.journal.queryActions({ reviewDate: binding.reviewDate })).actions;
    expect(actions[a]).toEqual(expect.objectContaining({ action: 'Hold', entryRevision: 1 }));
  }, 30_000);
});

describe('the shared Journal counter keeps moving (ADR 0011)', () => {
  it('should return Conflict and write nothing when the Journal counter moves on every attempt', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a, b, c, e } = await fiveTradeFixture(stack);
    const binding = await bindingFor(stack, a);
    // Before each commit, another writer saves an Action for a different Trade: only the shared counter moves.
    const others = [b, c, e];
    let commits = 0;
    const commit = (async (...args: Parameters<typeof stack.persistence.commit>) => {
      await stack.saveAction(others[commits]!, 'Hold');
      commits += 1;
      return stack.persistence.commit(...args);
    }) as typeof stack.persistence.commit;
    const review = createDailyReview({ ...stack, persistence: { ...stack.persistence, commit } });

    const result = await review.save({ kind: 'SaveTradeAction', binding, action: 'Hold' });

    expect(result).toEqual({ kind: 'Conflict' });
    expect(commits).toBe(3);
    expect((await stack.journal.queryActions({ reviewDate: binding.reviewDate })).actions[a]).toBeUndefined();
  }, 30_000);
});

// The Action a save returns is the one it committed (A38), whatever lands before its post-commit read.
describe('the saved Action', () => {
  it('should return the Action this save committed even when another version lands before the post-commit read', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a } = await fiveTradeFixture(stack);
    saved(await saveAction(stack, await bindingFor(stack, a), 'Hold'));
    const binding = await bindingFor(stack, a);
    expect(binding.expectedEntryRevision).toBe(1);
    // After this save's commit, another writer edits the same Entry (revision 2 becomes 3).
    let raced = false;
    const commit = (async (...args: Parameters<typeof stack.persistence.commit>) => {
      const result = await stack.persistence.commit(...args);
      if (!raced) {
        raced = true;
        saved(await saveAction(stack, { ...binding, expectedEntryRevision: 2 }, 'Adjust', 'A newer thought.'));
      }
      return result;
    }) as typeof stack.persistence.commit;
    const review = createDailyReview({ ...stack, persistence: { ...stack.persistence, commit } });

    const result = saved(await review.save({ kind: 'SaveTradeAction', binding, action: 'Exit', intent: 'Because the plan changed.' }));

    expect(result.action).toEqual(expect.objectContaining({ action: 'Exit', entryRevision: 2 }));
    expect(result.action.responses.map(({ answer }) => answer)).toContainEqual({ kind: 'Text', text: 'Because the plan changed.' });
    expect((await stack.journal.queryActions({ reviewDate: binding.reviewDate })).actions[a]).toEqual(expect.objectContaining({ action: 'Adjust', entryRevision: 3 }));
  }, 30_000);
});

// The commit is the save; a read that fails after it must not turn a committed Action into a failure.
describe('a failure after the commit', () => {
  it('should return Saved with the review ChangedDuringAssembly when the post-commit read fails', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a } = await fiveTradeFixture(stack);
    const binding = await bindingFor(stack, a);
    let committed = false;
    let failed = false;
    const commit = (async (...args: Parameters<typeof stack.persistence.commit>) => {
      const result = await stack.persistence.commit(...args);
      committed = true;
      return result;
    }) as typeof stack.persistence.commit;
    const query = (async (...args: Parameters<typeof stack.marketData.query>) => {
      if (committed && !failed) {
        failed = true;
        throw new Error('read failed after the commit');
      }
      return stack.marketData.query(...args);
    }) as typeof stack.marketData.query;
    const review = createDailyReview({ ...stack, persistence: { ...stack.persistence, commit }, marketData: { ...stack.marketData, query } });

    const result = await review.save({ kind: 'SaveTradeAction', binding, action: 'Hold' });

    expect(saved(result).review).toEqual({ kind: 'ChangedDuringAssembly' });
    expect(saved(result).action).toEqual(expect.objectContaining({ action: 'Hold', entryRevision: 1 }));
    expect((await stack.journal.queryActions({ reviewDate: binding.reviewDate })).actions[a]).toEqual(expect.objectContaining({ action: 'Hold', entryRevision: 1 }));
  }, 30_000);

  it('should return Saved with the committed Action when the post-commit Journal read fails', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a } = await fiveTradeFixture(stack);
    const binding = await bindingFor(stack, a);
    let committed = false;
    const commit = (async (...args: Parameters<typeof stack.persistence.commit>) => {
      const result = await stack.persistence.commit(...args);
      committed = true;
      return result;
    }) as typeof stack.persistence.commit;
    // Every Journal read, once the commit has landed, throws.
    const journal = new Proxy(stack.journal, {
      get(target, property, receiver) {
        const member: unknown = Reflect.get(target, property, receiver);
        if (typeof member !== 'function' || ['prepareEffects', 'applyPreparedEffects', 'seedDefaults'].includes(String(property))) return member;
        return (...args: unknown[]) => {
          if (committed) throw new Error('journal read failed after the commit');
          return (member as (...a: unknown[]) => unknown).apply(target, args);
        };
      },
    });
    const review = createDailyReview({ ...stack, persistence: { ...stack.persistence, commit }, journal });

    const result = saved(await review.save({ kind: 'SaveTradeAction', binding, action: 'Hold' }));

    expect(result.action).toEqual(expect.objectContaining({ action: 'Hold', entryRevision: 1 }));
    expect(result.review).toEqual({ kind: 'ChangedDuringAssembly' });
  }, 30_000);
});

// T4.30-B1: the Review a save returns reads today's frames only; the historical Mark-gap scan is for `open`.
describe('the Review after a save (T4.30-B1)', () => {
  it('should read the post-save Review without the historical gap scan and return the binding a fresh open would give', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a, b } = await fiveTradeFixture(stack);
    const binding = await bindingFor(stack, a);
    let recoveries = 0;
    const recover = (async (...args: Parameters<typeof stack.marketData.recover>) => {
      recoveries++;
      return stack.marketData.recover(...args);
    }) as typeof stack.marketData.recover;
    const review = createDailyReview({ ...stack, marketData: { ...stack.marketData, recover } });

    const result = saved(await review.save({ kind: 'SaveTradeAction', binding, action: 'Hold' }));

    expect(recoveries).toBe(0);
    const ready = result.review;
    if (ready.kind !== 'Ready') throw new Error(`expected Ready, got ${ready.kind}`);
    const reopened = await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MONDAY_1700 });
    if (reopened.kind !== 'Ready') throw new Error(`expected Ready, got ${reopened.kind}`);
    expect(ready.binding).toEqual(reopened.binding);
    expect(ready.completion).toEqual(reopened.completion);
    // The returned binding is still accepted by getTrade and by the next save.
    const trade = await stack.dailyReview.getTrade({ reviewDate: binding.reviewDate, tradeId: b, binding: ready.binding });
    if (trade.kind !== 'Ready') throw new Error(`expected Ready, got ${trade.kind}`);
    expect(saved(await saveAction(stack, trade.trade.saveBinding)).action).toEqual(expect.objectContaining({ action: 'Hold' }));
  }, 30_000);
});
