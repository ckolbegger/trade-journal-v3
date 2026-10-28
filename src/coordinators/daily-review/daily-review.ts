import { derive, evaluate, type ObservationFrame } from '../../domain/trade-analysis/index.ts';
import type { Journal } from '../../modules/journal/index.ts';
import type { MarkFrame, MarketData, MarketDataIssue } from '../../modules/market-data/index.ts';
import type { ReferenceCatalog } from '../../modules/reference-catalog/index.ts';
import type { BrowseRecord, TradeRecord } from '../../modules/trade-record/index.ts';
import type { Persistence } from '../../persistence/index.ts';
import { attentionOf, byAttention, unavailableFamilies } from './attention.ts';
import type {
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

export interface DailyReview {
  open(request: OpenDailyReviewRequest): Promise<OpenDailyReviewResult>;
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

  // One pass over the module reads. Its Review carries what the pass itself learned of the binding.
  async function assemble(request: OpenDailyReviewRequest): Promise<Pass> {
    const session = await deps.marketData.query({ kind: 'ResolveSession', context: { kind: 'Current', asOf: request.asOf } });
    if (session.kind === 'Rejected') return session;
    if (session.kind !== 'Session') throw new Error(`unexpected session result: ${session.kind}`);
    const { tradingDate: reviewDate, closeInstant: cutoff } = session;
    const records = await eligibleRecords(cutoff);
    if (!records) return { kind: 'Expired' };
    if (records.length === 0) return { kind: 'Empty', reviewDate, cutoff };

    // Each Trade is derived at the cutoff, which also yields the Marks its Position requires.
    const derivations = records.map(({ summary, analysis }) => ({ summary, analysis, derivation: derive({ record: analysis, cutoff, valuationDate: reviewDate }) }));
    const derived = derivations.flatMap(({ summary, analysis, derivation }) => (derivation.kind === 'Derived' ? [{ summary, analysis, state: derivation }] : []));
    const requirements = derived.flatMap(({ state }) => state.observationRequirements.map((r) => ({ tradeId: state.tradeId, ...r })));
    const earliest = new Map<string, string>();
    for (const { instrument, earliestRelevance } of requirements) {
      const known = earliest.get(instrument.symbol);
      if (known === undefined || earliestRelevance < known) earliest.set(instrument.symbol, earliestRelevance);
    }
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
      .map(({ summary, analysis, derivation }) => {
        const identity = { tradeId: summary.tradeId, underlying: summary.underlying, lastActivity: summary.lastActivity ?? summary.planTime };
        if (derivation.kind === 'IncoherentFacts') {
          const item: ReviewTradeItem = {
            ...identity,
            band: 'Blocker',
            reasons: [{ code: 'IncoherentFacts', findings: derivation.findings }],
            basis: { kind: 'NotComparable', reason: 'FactsIncoherent' },
          };
          return { item, evaluation: undefined };
        }
        const frame = recovered.frames.find((f) => f.instrumentKey === analysis.plan.underlying);
        if (!frame) throw new Error(`Market Data returned no frame for ${analysis.plan.underlying}`);
        const evaluation = evaluate({ state: derivation, frame: observationFrame(frame) });
        const item: ReviewTradeItem = { ...identity, ...attentionOf(derivation, evaluation) };
        return { item, evaluation };
      })
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
    const completion: ReviewCompletion =
      reasons.length > 0
        ? { kind: 'Incomplete', reasons }
        : acknowledged.length > 0
          ? {
              kind: 'CompleteWithUnavailableMarks',
              instruments: acknowledged.map((row) => row.instrumentKey),
              trades: affected.map(({ item }) => item.tradeId),
              families: unavailableFamilies(affected.flatMap(({ evaluation }) => (evaluation ? [evaluation] : []))),
            }
          : { kind: 'Complete' };

    return {
      kind: 'Ready',
      review: { reviewDate, cutoff, families, completion },
      evidence: {
        marketDataSnapshotId: recovered.snapshotId,
        factRevisions: Object.fromEntries(derivations.map(({ analysis }) => [analysis.tradeId, analysis.factRevision])),
      },
    };
  }

  return {
    // The module reads are separate transactions, so a Review is accepted only if the Workspace is
    // unchanged across its assembly; otherwise it is read again, a bounded number of times (A46).
    async open(request) {
      for (let attempt = 0; attempt < ASSEMBLY_ATTEMPTS; attempt++) {
        const before = await currentBinding();
        const pass = await assemble(request);
        if (pass.kind === 'Expired') continue;
        if (pass.kind !== 'Ready') return pass;
        const after = await currentBinding();
        if (after.workspace.databaseName === before.workspace.databaseName && after.workspace.contentRevision === before.workspace.contentRevision) {
          return { kind: 'Ready', ...pass.review, binding: { ...after, ...pass.evidence } };
        }
      }
      return { kind: 'ChangedDuringAssembly' };
    },
  };
}
