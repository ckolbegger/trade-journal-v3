import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { derive, type TradeAnalysisRecord } from '../../domain/trade-analysis/index.ts';
import { Rational } from '../../domain/values/index.ts';
import { D5_JOURNAL_MANIFEST, type ReflectionDisposition } from '../../modules/journal/index.ts';
import { D7_CATALOG_MANIFEST, type StrategyRecord } from '../../modules/reference-catalog/index.ts';
import { dumpAll } from '../../../tests/support/stack.ts';
import { onboardedStack } from '../../../tests/support/onboarded.ts';
import type { ConfirmPlanCommand, ExpirationMember, PositionChangeCommand, PositionChangeMember } from './index.ts';

// D7 section 4: O-S, the Cash-Secured Put on MNO (S1, B1), and O-C, the Long Call on XYZ (PC1, PC2, X1, E1).
// Every contract expires Friday 2026-11-20; New York is on standard time from 11-01, so 16:00 is 21:00Z.
const MONDAY_PLAN = '2026-10-12T13:00:00Z';
const MONDAY_10 = '2026-10-12T14:00:00Z';
const MONDAY_11 = '2026-10-12T15:00:00Z';
const TUESDAY_10 = '2026-10-13T14:00:00Z';
const FRIDAY_16 = '2026-11-20T21:00:00Z';
const FRIDAY_17 = '2026-11-20T22:00:00Z';
const MONDAY_NEXT_17 = '2026-11-23T22:00:00Z';

const MNO_PUT = { kind: 'Option', symbol: 'MNO', root: 'MNO', expiration: '2026-11-20', right: 'Put', strike: '45', multiplier: 100 } as const;
const XYZ_CALL = { kind: 'Option', symbol: 'XYZ', root: 'XYZ', expiration: '2026-11-20', right: 'Call', strike: '55', multiplier: 100 } as const;

type Stack = Awaited<ReturnType<typeof onboardedStack>>;

interface Ref {
  readonly stack: Stack;
  readonly trade: TradeAnalysisRecord;
  readonly instrument: typeof MNO_PUT | typeof XYZ_CALL;
  readonly reflectionDefinitionId: string;
  readonly closeReviewDefinitionId: string;
  readonly closeReasonId: string;
}

const reflection = (stack: Stack) => ({
  definitionId: stack.definition.id,
  answers: {
    'prompt.plan-reflection.thesis': { kind: 'Text', text: 'The premium is worth the risk.' },
    'prompt.plan-reflection.invalidation': { kind: 'Text', text: 'A close below 42.' },
  },
}) as const;

// Looked up by product key, never by position in the list.
async function strategyOf(stack: Stack, productKey: string): Promise<StrategyRecord> {
  const strategies = await stack.catalog.query({ family: 'Strategy' });
  if (strategies.kind !== 'Page') throw new Error('no strategies');
  const found = strategies.items.find((s): s is StrategyRecord => s.kind === 'Strategy' && s.productKey === productKey);
  if (!found) throw new Error(`no ${productKey}`);
  return found;
}

async function optionTrade(kind: 'CashSecuredPut' | 'LongCall', now: string): Promise<Ref> {
  const stack = await onboardedStack(new IDBFactory(), now);
  await stack.catalog.seedDefaults(D7_CATALOG_MANIFEST);
  await stack.journal.seedDefaults(D5_JOURNAL_MANIFEST);
  const strategy = await strategyOf(stack, kind === 'LongCall' ? 'strategy.long-call' : 'strategy.cash-secured-put');
  const base = { accountId: stack.account.id, accountRevision: stack.account.recordRevision, strategyId: strategy.id, strategyRevision: strategy.recordRevision, economicTime: MONDAY_PLAN, reflection: reflection(stack) };
  const plan: ConfirmPlanCommand['plan'] =
    kind === 'LongCall'
      ? {
          underlying: 'XYZ',
          legs: [{ side: 'Long', instrument: XYZ_CALL, quantity: '2', intendedEntry: '2.00' }],
          stops: [{ kind: 'UnderlyingPrice', price: '48.00' }],
          targets: [{ kind: 'UnderlyingPrice', price: '60.00' }],
          exerciseIntent: 'NotAuthorized',
        }
      : {
          underlying: 'MNO',
          legs: [{ side: 'Short', instrument: MNO_PUT, quantity: '-2', intendedEntry: '1.20' }],
          stops: [{ kind: 'UnderlyingPrice', price: '42.00' }],
          targets: [{ kind: 'UnderlyingPrice', price: '50.00' }],
        };
  const confirmed = await stack.tradeWorkflows.confirmPlan({ ...base, plan });
  if (confirmed.kind !== 'Confirmed') throw new Error(`expected Confirmed, got ${JSON.stringify(confirmed)}`);
  const position = await stack.journal.getDefinitions({ latestFor: 'entry-type.position-change-reflection' });
  const review = await stack.journal.getDefinitions({ latestFor: 'entry-type.close-review' });
  if (position.kind !== 'Found' || review.kind !== 'Found') throw new Error('no definitions');
  const reasons = await stack.catalog.query({ family: 'CloseReason' });
  if (reasons.kind !== 'Page') throw new Error('no Close Reasons');
  return {
    stack,
    trade: confirmed.postCommit.trade,
    instrument: kind === 'LongCall' ? XYZ_CALL : MNO_PUT,
    reflectionDefinitionId: position.definition.id,
    closeReviewDefinitionId: review.definition.id,
    closeReasonId: reasons.items[0]!.id,
  };
}

function fill(ref: Ref, action: 'Buy' | 'Sell', economicTime: string, quantity: string, price: string, fee: string): PositionChangeMember {
  return {
    kind: 'Execution',
    tradeId: ref.trade.tradeId,
    action,
    instrument: ref.instrument,
    intent: { kind: 'ServesPlannedLeg', plannedLegId: ref.trade.plan.legs[0]!.factId },
    quantity,
    price,
    fee,
    economicTime,
  };
}

function expiration(ref: Ref, economicTime: string, quantity: string, instrument: ExpirationMember['instrument'] = ref.instrument): ExpirationMember {
  return { kind: 'Expiration', tradeId: ref.trade.tradeId, instrument, quantity, economicTime };
}

const complete = (ref: Ref): ReflectionDisposition => ({
  kind: 'Complete',
  form: {
    definitionId: ref.reflectionDefinitionId,
    answers: {
      'prompt.position-change-reflection.decision-mode': { kind: 'Option', optionId: 'option.position-change-reflection.decision-mode.as-planned' },
      'prompt.position-change-reflection.primary-emotion': { kind: 'Option', optionId: 'option.position-change-reflection.primary-emotion.calm' },
      'prompt.position-change-reflection.decision-confidence': { kind: 'Scale', value: 4 },
    },
  },
});

const closeReviewForm = (ref: Ref): ReflectionDisposition => ({
  kind: 'Complete',
  form: { definitionId: ref.closeReviewDefinitionId, answers: { 'prompt.close-review.take-again': { kind: 'Option', optionId: 'option.close-review.take-again.yes-as-planned' } } },
});

function command(ref: Ref, expectedFactRevision: number, members: PositionChangeCommand['members'], extra: Partial<PositionChangeCommand> = {}): PositionChangeCommand {
  return { originTradeId: ref.trade.tradeId, trades: [{ tradeId: ref.trade.tradeId, expectedFactRevision }], members, reflection: complete(ref), ...extra };
}

// Records each change in turn with a completed reflection, from the Plan's FactRevision 1.
async function recordAll(ref: Ref, changes: readonly PositionChangeCommand['members'][]) {
  let factRevision = 1;
  for (const members of changes) {
    const result = await ref.stack.tradeWorkflows.recordPositionChange(command(ref, factRevision, members));
    if (result.kind !== 'Recorded') throw new Error(`expected Recorded, got ${JSON.stringify(result)}`);
    factRevision = result.receipt.factRevision;
  }
  return factRevision;
}

const workspaceStores = (dump: Awaited<ReturnType<typeof dumpAll>>) => Object.entries(dump).find(([name]) => name.startsWith('tj-ws-'))![1];

const contentRevision = (stores: Record<string, unknown[]>) =>
  (stores['meta'] as { key: string; contentRevision?: number }[]).find((m) => m.key === 'content')!.contentRevision!;

describe('option Executions', () => {
  it('should commit S1 as a Sell to open and B1 as a Buy to close on O-S, returning the derived short Lot and Lot Match equal to a fresh derivation of the stored Trade (AC-RESP-001)', async () => {
    const ref = await optionTrade('CashSecuredPut', FRIDAY_17);
    const opened = await ref.stack.tradeWorkflows.recordPositionChange(command(ref, 1, [fill(ref, 'Sell', MONDAY_10, '2', '1.25', '1.30')]));
    if (opened.kind !== 'Recorded') throw new Error(`expected Recorded, got ${JSON.stringify(opened)}`);
    expect(opened.receipt.lifecycleTransitions).toEqual([{ tradeId: ref.trade.tradeId, from: 'Planned', to: 'Open' }]);
    expect(opened.postCommit.derivation.positions[0]!.openLots.map((l) => l.quantity)).toEqual([Rational.of(-2n)]);

    const before = workspaceStores(await dumpAll(ref.stack.factory));
    const closed = await ref.stack.tradeWorkflows.recordPositionChange(command(ref, opened.receipt.factRevision, [fill(ref, 'Buy', TUESDAY_10, '1', '0.60', '0.65')]));
    if (closed.kind !== 'Recorded') throw new Error(`expected Recorded, got ${JSON.stringify(closed)}`);
    const after = workspaceStores(await dumpAll(ref.stack.factory));
    expect(contentRevision(after)).toBe(contentRevision(before) + 1);
    expect(closed.receipt.lifecycleTransitions).toEqual([]);
    const stored = await ref.stack.tradeRecord.getRecord({ tradeId: ref.trade.tradeId, projection: 'AnalysisInput' });
    if (stored.kind !== 'Found') throw new Error('trade not found');
    const record = stored.projection as TradeAnalysisRecord;
    expect(closed.postCommit.trade).toEqual(record);
    expect(closed.postCommit.derivation).toEqual(derive({ record }));
    // S1 <- B1 matches 1 contract: 1 x 100 x (1.25 - 0.60) - 0.65 - 0.65 = 63.70, leaving 1 short contract.
    const { derivation } = closed.postCommit;
    expect(derivation.lotMatches).toEqual([expect.objectContaining({ quantity: Rational.of(1n), policy: 'FIFO' })]);
    expect(derivation.realizedToDate).toEqual(Rational.of(637n, 10n));
    expect(derivation.positions[0]!.openLots.map((l) => l.quantity)).toEqual([Rational.of(-1n)]);
  });

  it('should require a Close Reason when a Buy to close makes O-S flat, as for any terminal exit with agency', async () => {
    const ref = await optionTrade('CashSecuredPut', FRIDAY_17);
    const revision = await recordAll(ref, [[fill(ref, 'Sell', MONDAY_10, '2', '1.25', '1.30')]]);
    const before = await dumpAll(ref.stack.factory);
    const buyAll = [fill(ref, 'Buy', TUESDAY_10, '2', '0.60', '1.30')];
    const rejected = await ref.stack.tradeWorkflows.recordPositionChange(command(ref, revision, buyAll));
    if (rejected.kind !== 'Rejected') throw new Error(`expected Rejected, got ${rejected.kind}`);
    expect(rejected.issues).toEqual([
      { source: 'TradeWorkflows', field: 'closeReasonId', code: 'CloseReasonRequired' },
      { source: 'TradeWorkflows', field: 'closeReview', code: 'CloseReviewDispositionRequired' },
    ]);
    expect(await dumpAll(ref.stack.factory)).toEqual(before);
    const accepted = await ref.stack.tradeWorkflows.recordPositionChange(command(ref, revision, buyAll, { closeReasonId: ref.closeReasonId, closeReview: closeReviewForm(ref) }));
    if (accepted.kind !== 'Recorded') throw new Error(`expected Recorded, got ${JSON.stringify(accepted)}`);
    expect(accepted.receipt.lifecycleTransitions).toEqual([{ tradeId: ref.trade.tradeId, from: 'Open', to: 'Closed' }]);
  });
});

// O-C through X1: PC1 and PC2 on Monday, X1 on Tuesday, leaving PC2's contract open for E1.
const ocBeforeExpiration = (ref: Ref) =>
  recordAll(ref, [
    [fill(ref, 'Buy', MONDAY_10, '1', '2.10', '0.65')],
    [fill(ref, 'Buy', MONDAY_11, '1', '1.90', '0.65')],
    [fill(ref, 'Sell', TUESDAY_10, '1', '3.00', '0.65')],
  ]);

describe('Expiration (AC-POS-004, A107)', () => {
  it('should commit E1 with no Close Reason, the Open-to-Closed move, the terminal time, the reflection outcome, and the Close Review outcome for each disposition in one semantic commit, returning the Terminal Disposition, Option Disposition Timing, Realized R, and both Journal projections', async () => {
    for (const kind of ['Complete', 'Decline', 'Defer'] as const) {
      const ref = await optionTrade('LongCall', FRIDAY_17);
      const revision = await ocBeforeExpiration(ref);
      const disposition: ReflectionDisposition =
        kind === 'Complete' ? closeReviewForm(ref) : kind === 'Decline' ? { kind, definitionId: ref.closeReviewDefinitionId, reason: 'Nothing to add.' } : { kind };
      const before = workspaceStores(await dumpAll(ref.stack.factory));
      const result = await ref.stack.tradeWorkflows.recordPositionChange(command(ref, revision, [expiration(ref, FRIDAY_16, '1')], { closeReview: disposition }));
      if (result.kind !== 'Recorded') throw new Error(`expected Recorded for ${kind}, got ${JSON.stringify(result)}`);
      const after = workspaceStores(await dumpAll(ref.stack.factory));
      expect(contentRevision(after)).toBe(contentRevision(before) + 1);
      // Closed at the settlement time, with the one Expiration member and no Close Reason fact.
      const trade = (after['trades'] as { lifecycle: string; terminalTime?: string; facts: { kind: string; factId: string }[]; closeReasonFacts?: unknown[] }[])[0]!;
      expect(trade).toEqual(expect.objectContaining({ lifecycle: 'Closed', terminalTime: FRIDAY_16 }));
      expect(trade.facts.filter((f) => f.kind === 'Expiration')).toHaveLength(1);
      expect(trade.closeReasonFacts ?? []).toEqual([]);
      // The reflection and the Close Review are separate outcomes, both at the settlement time.
      const e1 = trade.facts.filter((f) => f.kind === 'PositionChange').at(-1)!.factId;
      const outcome = { Complete: 'Entry', Decline: 'Decline', Defer: 'Debt' }[kind];
      expect(after['journalObligations']).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ obligationKey: `CloseReview:${ref.trade.tradeId}`, outcome: expect.objectContaining({ kind: outcome }) as unknown }),
          expect.objectContaining({ obligationKey: `PositionChangeReflection:${e1}`, outcome: expect.objectContaining({ kind: 'Entry' }) as unknown }),
        ]),
      );
      const closeReview = { sourceKey: 'source.trade-close', anchor: { kind: 'Trade', tradeId: ref.trade.tradeId }, origin: { kind: 'PositionChange', factId: e1 }, momentTime: FRIDAY_16 };
      const stored = {
        Complete: (after['journalEntries'] as { entryTypeKey: string }[]).find((e) => e.entryTypeKey === 'entry-type.close-review'),
        Decline: (after['journalDeclines'] as { entryTypeKey: string }[]).find((e) => e.entryTypeKey === 'entry-type.close-review'),
        Defer: (after['journalDebts'] as { entryTypeKey: string }[]).find((e) => e.entryTypeKey === 'entry-type.close-review'),
      }[kind];
      expect(stored).toEqual(expect.objectContaining(closeReview));
      if (kind === 'Defer') expect(stored).toEqual(expect.objectContaining({ dueAnchor: FRIDAY_16, dueRule: 'OneSessionGrace' }));
      const { receipt, postCommit, affected } = result;
      expect(receipt.lifecycleTransitions).toEqual([{ tradeId: ref.trade.tradeId, from: 'Open', to: 'Closed' }]);
      expect(receipt.reflection.kind).toBe('Entry');
      expect(receipt.closeReview?.kind).toBe(outcome);
      expect(postCommit.reflection.kind).toBe('Entry');
      expect(postCommit.closeReview?.kind).toBe(outcome);
      expect(postCommit.trade).toEqual(expect.objectContaining({ storedLifecycle: 'Closed', terminalTime: FRIDAY_16 }));
      expect(postCommit.trade.closeReason).toBeUndefined();
      const { derivation } = postCommit;
      expect(derivation.expectedLifecycle).toBe('Closed');
      expect(derivation.terminalDisposition).toEqual({
        kind: 'Value',
        value: [
          { mechanism: 'Executions', quantity: Rational.of(1n) },
          { mechanism: 'Expiration', quantity: Rational.of(1n) },
        ],
      });
      expect(derivation.optionDispositionTiming.kind).toBe('Value');
      expect(derivation.optionDispositionTiming).toEqual(expect.objectContaining({ value: expect.objectContaining({ timing: 'Mixed' }) as unknown }));
      // 88.70 from X1 and -190.65 from E1 over 1R of $400.
      expect(derivation.realizedToDate).toEqual(Rational.of(-10195n, 100n));
      expect(derivation.realizedR).toEqual({ kind: 'Value', value: Rational.of(-2039n, 8000n) });
      expect(affected).toEqual([
        { scope: 'TradeList', lifecycle: 'Closed' },
        { scope: 'TradeList', lifecycle: 'Open' },
      ]);
    }
  });

  it('should reject a Close Reason on E1 with CloseReasonNotApplicable, and an Expiration mixed with an Execution in one Position Change with VariantNotInstalled', async () => {
    const ref = await optionTrade('CashSecuredPut', FRIDAY_17);
    const revision = await recordAll(ref, [[fill(ref, 'Sell', MONDAY_10, '2', '1.25', '1.30')]]);
    const before = await dumpAll(ref.stack.factory);
    const withReason = await ref.stack.tradeWorkflows.recordPositionChange(
      command(ref, revision, [expiration(ref, FRIDAY_16, '2')], { closeReasonId: ref.closeReasonId, closeReview: closeReviewForm(ref) }),
    );
    expect(withReason).toEqual(expect.objectContaining({ kind: 'Rejected', issues: [{ source: 'TradeWorkflows', field: 'closeReasonId', code: 'CloseReasonNotApplicable' }] }));
    const mixed = await ref.stack.tradeWorkflows.recordPositionChange(
      command(ref, revision, [fill(ref, 'Buy', TUESDAY_10, '1', '0.60', '0.65'), expiration(ref, FRIDAY_16, '1')], { closeReview: closeReviewForm(ref) }),
    );
    expect(mixed.kind).toBe('VariantNotInstalled');
    expect(await dumpAll(ref.stack.factory)).toEqual(before);
  });

  it('should reject an Expiration naming a contract other than the held one (another strike, another expiration) with VariantNotInstalled OtherInstrument, writing nothing', async () => {
    const ref = await optionTrade('CashSecuredPut', MONDAY_NEXT_17);
    const revision = await recordAll(ref, [[fill(ref, 'Sell', MONDAY_10, '2', '1.25', '1.30')]]);
    const before = await dumpAll(ref.stack.factory);
    const held = ref.instrument;
    if (held.kind !== 'Option') throw new Error('expected an option instrument');
    const others = [{ ...held, strike: '999' }, { ...held, expiration: '2026-12-18' }];
    for (const other of others) {
      const result = await ref.stack.tradeWorkflows.recordPositionChange(
        command(ref, revision, [expiration(ref, FRIDAY_16, '2', other)], { closeReview: closeReviewForm(ref) }),
      );
      expect(result).toEqual({ kind: 'VariantNotInstalled', variants: ['OtherInstrument'] });
    }
    expect(await dumpAll(ref.stack.factory)).toEqual(before);
  });

  it('should return the analysis ExpirationMustSettleAllOpen and SettlementTimeInvalid issues, and reject a settlement time in the future with EconomicTimeInFuture, writing nothing', async () => {
    const ref = await optionTrade('CashSecuredPut', MONDAY_NEXT_17);
    const revision = await recordAll(ref, [[fill(ref, 'Sell', MONDAY_10, '2', '1.25', '1.30')]]);
    const before = await dumpAll(ref.stack.factory);
    const attempt = (member: ExpirationMember) =>
      ref.stack.tradeWorkflows.recordPositionChange(command(ref, revision, [member], { closeReview: closeReviewForm(ref) }));
    const partial = await attempt(expiration(ref, FRIDAY_16, '1'));
    expect(partial).toEqual(
      expect.objectContaining({ kind: 'Rejected', issues: [expect.objectContaining({ source: 'TradeAnalysis', member: 0, field: 'quantity', code: 'ExpirationMustSettleAllOpen', available: Rational.of(2n) })] }),
    );
    const late = await attempt(expiration(ref, '2026-11-23T21:00:00Z', '2'));
    expect(late).toEqual(expect.objectContaining({ kind: 'Rejected', issues: [expect.objectContaining({ source: 'TradeAnalysis', member: 0, code: 'SettlementTimeInvalid' })] }));
    const stock = await attempt(expiration(ref, FRIDAY_16, '2', { kind: 'Stock', symbol: 'MNO' }));
    expect(stock).toEqual(expect.objectContaining({ kind: 'Rejected', issues: [expect.objectContaining({ source: 'TradeAnalysis', member: 0, code: 'NotAnOption' })] }));
    expect(await dumpAll(ref.stack.factory)).toEqual(before);

    const thursday = await optionTrade('CashSecuredPut', '2026-11-19T22:00:00Z');
    const thursdayRevision = await recordAll(thursday, [[fill(thursday, 'Sell', MONDAY_10, '2', '1.25', '1.30')]]);
    const unchanged = await dumpAll(thursday.stack.factory);
    const future = await thursday.stack.tradeWorkflows.recordPositionChange(
      command(thursday, thursdayRevision, [expiration(thursday, FRIDAY_16, '2')], { closeReview: closeReviewForm(thursday) }),
    );
    expect(future).toEqual(
      expect.objectContaining({ kind: 'Rejected', issues: [{ source: 'TradeWorkflows', member: 0, field: 'economicTime', code: 'EconomicTimeInFuture' }] }),
    );
    expect(await dumpAll(thursday.stack.factory)).toEqual(unchanged);
  });
});
