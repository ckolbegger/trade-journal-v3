import { openLongStockSummary } from '../../domain/trade-summary.ts';
import { derive, evaluate, type DerivedTradeState, type IncoherentFacts, type ObservationFrame, type TradeEvaluation } from '../../domain/trade-analysis/index.ts';
import type { Journal } from '../../modules/journal/index.ts';
import type { MarkFrame, MarketData, MarketDataIssue } from '../../modules/market-data/index.ts';
import type { ReferenceCatalog } from '../../modules/reference-catalog/index.ts';
import type { BrowseRecord, TradeRecord } from '../../modules/trade-record/index.ts';
import type { Persistence, WorkspaceSnapshotBinding } from '../../persistence/index.ts';
import { attentionOf, byAttention, unavailableFamilies } from './attention.ts';
import type {
  ActionForm,
  DailyTradeReview,
  GetDailyTradeReviewRequest,
  GetDailyTradeReviewResult,
  HistoricalGapGroup,
  IncompleteReason,
  MarkRow,
  OpenDailyReviewRequest,
  OpenDailyReviewResult,
  ReviewBinding,
  ReviewCompletion,
  ReviewFamily,
  ReviewTradeItem,
} from './types.ts';

export interface DailyReviewDeps {
  readonly persistence: Persistence;
  readonly tradeRecord: TradeRecord;
  readonly catalog: ReferenceCatalog;
  readonly journal: Journal;
  readonly marketData: MarketData;
}

const ASSEMBLY_ATTEMPTS = 3;

// Facts that cannot be replayed make the Trade a Blocker with no mark-based figures to compare.
function incoherentItem(identity: Pick<ReviewTradeItem, 'tradeId' | 'underlying' | 'lastActivity'>, incoherent: IncoherentFacts): ReviewTradeItem {
  return {
    ...identity,
    band: 'Blocker',
    reasons: [{ code: 'IncoherentFacts', findings: incoherent.findings }],
    basis: { kind: 'NotComparable', reason: 'FactsIncoherent' },
  };
}

type Derivation = ReturnType<typeof derive>;

// One Trade the index selected and confirmed Open at the cutoff, with both derivations of it.
interface EligibleTrade {
  readonly summary: BrowseRecord['summary'];
  readonly analysis: BrowseRecord['analysis'];
  readonly derivation: Derivation;
  readonly integrity: Derivation;
}

// The Marks the eligible Trades require: each Instrument once, at its earliest relevant date.
function observationNeeds(eligible: readonly EligibleTrade[]) {
  const derived = eligible.flatMap(({ summary, analysis, derivation, integrity }) => (derivation.kind === 'Derived' && integrity.kind === 'Derived' ? [{ summary, analysis, state: derivation }] : []));
  const requirements = derived.flatMap(({ state }) => state.observationRequirements.map((r) => ({ tradeId: state.tradeId, ...r })));
  const earliest = new Map<string, string>();
  for (const { instrument, earliestRelevance } of requirements) {
    const known = earliest.get(instrument.symbol);
    if (known === undefined || earliestRelevance < known) earliest.set(instrument.symbol, earliestRelevance);
  }
  return { requirements, earliest };
}

type ReadyReview = Extract<OpenDailyReviewResult, { kind: 'Ready' }>;

// What one pass returns before its binding is checked against the Workspace.
type Pass =
  | { readonly kind: 'Empty'; readonly reviewDate: string; readonly cutoff: string }
  | { readonly kind: 'Rejected'; readonly issues: readonly MarketDataIssue[] }
  | { readonly kind: 'Expired' }
  | {
      readonly kind: 'Ready';
      readonly review: Omit<ReadyReview, 'kind' | 'binding'>;
      readonly evidence: Pick<ReviewBinding, 'marketDataSnapshotId' | 'factRevisions'>;
    };

// What one Trade pass returns before its binding is checked against the Workspace.
type TradePass =
  | { readonly kind: 'Expired' }
  | { readonly kind: 'Rejected'; readonly issues: readonly MarketDataIssue[] }
  | { readonly kind: 'ReviewChanged' }
  | { readonly kind: 'Ready'; readonly review: Omit<Extract<GetDailyTradeReviewResult, { kind: 'Ready' }>, 'kind'> };

// One attempt at a read: retried (an expired cursor), returned as it is, or returned once the
// Workspace is confirmed unchanged, completed with the binding then current.
type Attempt<R> =
  | { readonly retry: true }
  | { readonly done: R }
  | { readonly settle: (binding: { workspace: WorkspaceSnapshotBinding; catalogRevision: number; journalRevision: number }) => R };

export interface DailyReview {
  open(request: OpenDailyReviewRequest): Promise<OpenDailyReviewResult>;
  getTrade(request: GetDailyTradeReviewRequest): Promise<GetDailyTradeReviewResult>;
}

// Market Data's frame as Trade Analysis reads it: composition maps one into the other.
function observationFrame(frame: MarkFrame): ObservationFrame {
  return {
    instrument: { kind: 'Stock', symbol: frame.instrumentKey },
    tradingDate: frame.tradingDate,
    closeInstant: frame.closeInstant,
    resolution: frame.resolution,
  };
}

// The Trade's place in the walk and, when its facts replay, its evaluation at the Review-date frame.
function reviewItem({ summary, analysis, derivation, integrity }: EligibleTrade, frames: readonly MarkFrame[]) {
  const identity = { tradeId: summary.tradeId, underlying: summary.underlying, lastActivity: summary.lastActivity ?? summary.planTime };
  // Facts that cannot be replayed at any time make the Trade incoherent, whichever derivation finds them.
  if (derivation.kind === 'IncoherentFacts') return { item: incoherentItem(identity, derivation), evaluation: undefined };
  if (integrity.kind === 'IncoherentFacts') return { item: incoherentItem(identity, integrity), evaluation: undefined };
  const frame = frames.find((f) => f.instrumentKey === analysis.plan.underlying);
  if (!frame) throw new Error(`Market Data returned no frame for ${analysis.plan.underlying}`);
  const evaluation = evaluate({ state: derivation, frame: observationFrame(frame) });
  const item: ReviewTradeItem = { ...identity, ...attentionOf(derivation, evaluation, integrity.findings) };
  return { item, evaluation };
}

// The Position held at the Stale context's close, valued with that session's own exact Mark; absent
// without Stale context (P13, A54).
function datedLastCloseOf(analysis: EligibleTrade['analysis'], frame: MarkFrame, evaluation: TradeEvaluation): DailyTradeReview['datedLastClose'] {
  const stale = evaluation.staleContext;
  if (!stale) return undefined;
  const atLastClose = derive({ record: analysis, cutoff: stale.closeInstant, valuationDate: stale.tradingDate });
  if (atLastClose.kind !== 'Derived') throw new Error('facts cannot be replayed at the last close');
  // Shown only if the Trade had exposure then.
  if (!atLastClose.positions.some((p) => p.openLots.length > 0)) return undefined;
  const lastClose: ObservationFrame = {
    instrument: { kind: 'Stock', symbol: frame.instrumentKey },
    tradingDate: stale.tradingDate,
    closeInstant: stale.closeInstant,
    resolution: { kind: 'Available', mark: { revisionId: stale.revisionId, revisionNumber: stale.revisionNumber, price: stale.price } },
  };
  return { tradingDate: stale.tradingDate, evaluation: evaluate({ state: atLastClose, frame: lastClose }) };
}

// What replaying the Trade yields at the Review-date frame.
function figuresOf(entry: EligibleTrade, state: DerivedTradeState, frames: readonly MarkFrame[], evaluation: TradeEvaluation) {
  const frame = frames.find((f) => f.instrumentKey === entry.analysis.plan.underlying);
  if (!frame) throw new Error(`Market Data returned no frame for ${entry.analysis.plan.underlying}`);
  const summary = openLongStockSummary(state);
  const datedLastClose = datedLastCloseOf(entry.analysis, frame, evaluation);
  return { ...(summary && { summary }), frame, evaluation, ...(datedLastClose && { datedLastClose }) };
}

export function createDailyReview(deps: DailyReviewDeps): DailyReview {
  // Every Open Trade whose exposure started at or before the cutoff, following the pages; undefined when a Trade commit expired the cursor.
  async function eligibleRecords(cutoff: string): Promise<BrowseRecord[] | undefined> {
    const records: BrowseRecord[] = [];
    let cursor: string | undefined;
    do {
      const page = await deps.tradeRecord.queryRecords({ lifecycle: 'Open', cutoff, projection: 'Browse', ...(cursor && { cursor }) });
      if (page.kind === 'CursorExpired') return undefined;
      records.push(...(page.items as BrowseRecord[]));
      cursor = page.nextCursor;
    } while (cursor);
    return records;
  }

  // The Workspace, Catalog, and Journal revisions of one snapshot.
  async function currentBinding(): Promise<Pick<ReviewBinding, 'workspace' | 'catalogRevision' | 'journalRevision'>> {
    const stored = await deps.persistence.readSnapshot(['meta'], async (tx) => ({
      catalog: (await tx.get('meta', 'catalog')) as { catalogRevision: number } | undefined,
      journal: (await tx.get('meta', 'journal')) as { journalRevision: number } | undefined,
    }));
    return {
      workspace: stored.binding,
      catalogRevision: stored.value.catalog?.catalogRevision ?? 0,
      journalRevision: stored.value.journal?.journalRevision ?? 0,
    };
  }

  // Each eligible Trade is derived at the cutoff, which also yields the Marks its Position requires.
  // The index only selects; a Trade whose facts do not leave it Open at the cutoff is not eligible.
  // Integrity (A59) is whether the stored Trade agrees with all its facts, so it comes from a
  // second derivation with no cutoff; the cutoff derivation decides eligibility, state, and evaluation.
  // Undefined when a Trade commit expired the eligibility cursor.
  async function eligibleTrades(cutoff: string, reviewDate: string): Promise<EligibleTrade[] | undefined> {
    const records = await eligibleRecords(cutoff);
    if (!records) return undefined;
    return records
      .map(({ summary, analysis }) => ({
        summary,
        analysis,
        derivation: derive({ record: analysis, cutoff, valuationDate: reviewDate }),
        integrity: derive({ record: analysis }),
      }))
      .filter(({ derivation }) => derivation.kind !== 'Derived' || derivation.expectedLifecycle === 'Open');
  }

  // The module reads are separate transactions, so a read is accepted only if the Workspace is
  // unchanged across its assembly; otherwise it is read again, a bounded number of times (A46).
  async function coherently<R>(attempt: () => Promise<Attempt<R>>): Promise<R | { readonly kind: 'ChangedDuringAssembly' }> {
    for (let i = 0; i < ASSEMBLY_ATTEMPTS; i++) {
      const before = await currentBinding();
      const result = await attempt();
      if ('retry' in result) continue;
      if ('done' in result) return result.done;
      const after = await currentBinding();
      if (after.workspace.databaseName === before.workspace.databaseName && after.workspace.contentRevision === before.workspace.contentRevision) {
        return result.settle(after);
      }
    }
    return { kind: 'ChangedDuringAssembly' };
  }

  // One pass over the module reads. Its Review carries what the pass itself learned of the binding.
  async function assemble(request: OpenDailyReviewRequest): Promise<Pass> {
    const session = await deps.marketData.query({ kind: 'ResolveSession', context: { kind: 'Current', asOf: request.asOf } });
    if (session.kind === 'Rejected') return session;
    if (session.kind !== 'Session') throw new Error(`unexpected session result: ${session.kind}`);
    const { tradingDate: reviewDate, closeInstant: cutoff } = session;
    const derivations = await eligibleTrades(cutoff, reviewDate);
    if (!derivations) return { kind: 'Expired' };
    if (derivations.length === 0) return { kind: 'Empty', reviewDate, cutoff };
    const { requirements, earliest } = observationNeeds(derivations);
    const recovered = await deps.marketData.recover({
      context: { kind: 'Review', reviewDate },
      instruments: [...earliest].map(([instrumentKey, earliestExposure]) => ({ instrumentKey, earliestExposure })),
    });
    if (recovered.kind === 'Rejected') throw new Error('Market Data rejected the Review recovery request');

    const today = recovered.frames.map(
      ({ instrumentKey, tradingDate, resolution }): MarkRow => ({
        instrumentKey,
        tradingDate,
        trades: requirements.filter((r) => r.instrument.symbol === instrumentKey).map((r) => r.tradeId),
        resolution,
        task: resolution.kind === 'Missing' ? 'Manual' : null,
      }),
    );
    const earlier = recovered.gaps
      .filter((g) => g.missing.length + g.acknowledged.length > 0)
      .map((g): HistoricalGapGroup => ({ ...g, blocking: false }));

    const ranked = derivations
      .map((trade) => reviewItem(trade, recovered.frames))
      .sort((a, b) => byAttention(a.item, b.item));
    const families: ReviewFamily[] = [
      { family: 'Marks', today, earlier },
      { family: 'Trades', trades: ranked.map((r) => r.item) },
    ];

    const actions = await deps.journal.queryActions({ reviewDate });
    const reasons: IncompleteReason[] = [
      ...today
        .filter((row) => row.task === 'Manual')
        .map((row): IncompleteReason => ({ code: 'MarkMissing', instrumentKey: row.instrumentKey, tradingDate: row.tradingDate, trades: row.trades })),
      ...ranked.flatMap(({ item }): IncompleteReason[] => [
        ...item.reasons.flatMap((reason): IncompleteReason[] =>
          reason.code === 'IntegrityDisagreement' || reason.code === 'IncoherentFacts' ? [{ ...reason, tradeId: item.tradeId }] : [],
        ),
        ...(item.tradeId in actions.actions ? [] : [{ code: 'ActionMissing' as const, tradeId: item.tradeId }]),
      ]),
    ];
    const acknowledged = today.filter((row) => row.resolution.kind === 'AcknowledgedUnavailable');
    const affected = ranked.filter(({ item }) => acknowledged.some((row) => row.trades.includes(item.tradeId)));
    const completionOf = (): ReviewCompletion => {
      if (reasons.length > 0) return { kind: 'Incomplete', reasons };
      if (acknowledged.length === 0) return { kind: 'Complete' };
      return {
        kind: 'CompleteWithUnavailableMarks',
        instruments: acknowledged.map((row) => row.instrumentKey),
        trades: affected.map(({ item }) => item.tradeId),
        families: unavailableFamilies(affected.flatMap(({ evaluation }) => (evaluation ? [evaluation] : []))),
      };
    };
    const completion = completionOf();

    return {
      kind: 'Ready',
      review: { reviewDate, cutoff, families, completion },
      evidence: {
        marketDataSnapshotId: recovered.snapshotId,
        factRevisions: Object.fromEntries(derivations.map(({ analysis }) => [analysis.tradeId, analysis.factRevision])),
      },
    };
  }

  // One pass over the module reads for one Trade of an overview.
  async function assembleTrade(request: GetDailyTradeReviewRequest): Promise<TradePass> {
    const session = await deps.marketData.query({ kind: 'ResolveSession', context: { kind: 'Review', reviewDate: request.reviewDate } });
    if (session.kind === 'Rejected') return session;
    if (session.kind !== 'Session') throw new Error(`unexpected session result: ${session.kind}`);
    const { tradingDate: reviewDate, closeInstant: cutoff } = session;
    const eligible = await eligibleTrades(cutoff, reviewDate);
    if (!eligible) return { kind: 'Expired' };
    const entry = eligible.find(({ analysis }) => analysis.tradeId === request.tradeId);
    if (!entry) return { kind: 'ReviewChanged' };
    const { summary, analysis } = entry;
    if (analysis.factRevision !== request.binding.factRevisions[analysis.tradeId]) return { kind: 'ReviewChanged' };
    // The same request as the overview's recovery, so its snapshot is comparable.
    const instruments = [...observationNeeds(eligible).earliest.keys()];
    const frames = await deps.marketData.query({ kind: 'ResolveFrames', context: { kind: 'Review', reviewDate }, instruments });
    if (frames.kind === 'Rejected') return frames;
    if (frames.kind !== 'Frames') throw new Error(`unexpected frames result: ${frames.kind}`);
    if (frames.snapshotId !== request.binding.marketDataSnapshotId) return { kind: 'ReviewChanged' };
    const labels = await deps.catalog.resolve([
      { name: 'account', kind: 'Account', id: summary.accountId, mode: 'DisplayOnly' },
      { name: 'strategy', kind: 'Strategy', id: summary.strategyId, mode: 'DisplayOnly' },
    ]);
    const resolved = labels.kind === 'Resolved' ? labels.resolved : {};
    const { item, evaluation } = reviewItem(entry, frames.frames);
    // Facts that cannot be replayed have no figures.
    const figures = evaluation && entry.derivation.kind === 'Derived' ? figuresOf(entry, entry.derivation, frames.frames, evaluation) : {};
    const saved = (await deps.journal.queryActions({ reviewDate })).actions[analysis.tradeId];
    const form: ActionForm = saved ? { kind: 'Saved', action: saved } : { kind: 'New', viewState: { selectedAction: 'Hold' } };
    // A saved Action's form is the Entry's first version's definition; a new form takes the latest.
    let definitionRevision = saved?.definitionId;
    if (definitionRevision === undefined) {
      const definition = await deps.journal.getDefinitions({ latestFor: 'entry-type.daily-trade-review' });
      if (definition.kind !== 'Found') throw new Error('no Daily Trade Review definition');
      definitionRevision = definition.definition.id;
    }
    return {
      kind: 'Ready',
      review: {
        reviewDate,
        cutoff,
        trade: {
          tradeId: analysis.tradeId,
          underlying: summary.underlying,
          attention: item,
          labels: {
            strategy: resolved['strategy']?.label ?? '',
            account: resolved['account']?.label ?? '',
            institution: resolved['account']?.institution?.label ?? '',
          },
          ...figures,
          form,
          definitionRevision,
          saveBinding: {
            reviewDate,
            tradeId: analysis.tradeId,
            factRevision: analysis.factRevision,
            marketDataSnapshotId: frames.snapshotId,
            obligationKey: { entryType: 'DailyTradeReview', trade: analysis.tradeId, reviewDate },
            ...(saved && { expectedEntryRevision: saved.entryRevision }),
            definitionRevision,
          },
        },
      },
    };
  }

  return {
    // A Review is accepted only if the Workspace is unchanged across its assembly (A46).
    open: (request) =>
      coherently<OpenDailyReviewResult>(async () => {
        const pass = await assemble(request);
        if (pass.kind === 'Expired') return { retry: true };
        if (pass.kind !== 'Ready') return { done: pass };
        return { settle: (binding) => ({ kind: 'Ready', ...pass.review, binding: { ...binding, ...pass.evidence } }) };
      }),

    getTrade: (request) =>
      coherently<GetDailyTradeReviewResult>(async () => {
        const pass = await assembleTrade(request);
        if (pass.kind === 'Expired') return { retry: true };
        if (pass.kind !== 'Ready') return { done: pass };
        // The overview's Workspace is the one this read must be in; its content revision moves with every write.
        return { settle: ({ workspace }) => (workspace.databaseName === request.binding.workspace.databaseName ? { kind: 'Ready', ...pass.review } : { kind: 'ReviewChanged' }) };
      }),
  };
}
