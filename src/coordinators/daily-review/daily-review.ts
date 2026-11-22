import { Temporal } from 'temporal-polyfill';
import { instrumentKey, settlementDueOn, type Instrument, type OptionInstrument } from '../../domain/instrument/index.ts';
import { openTradeSummary } from '../../domain/trade-summary.ts';
import { Rational } from '../../domain/values/index.ts';
import { derive, type DerivedTradeState, type IncoherentFacts, type LifecycleState, type TradeAnalysisRecord, type TradeEvaluation } from '../../domain/trade-analysis/index.ts';
import { classifyDue, compareDueAnchors, compareOwed, owedStandingOf, type SessionCloses } from '../../domain/journal-debt/index.ts';
import type { DebtProjection, HistoryAction, Journal, ObligationOutcome } from '../../modules/journal/index.ts';
import type { EvidenceBinding, FrameContext, HistoricalGaps, MarketData, MarketDataPrepareEntry, MarketDataIssue, MarketDataReadSession, SeriesPoint } from '../../modules/market-data/index.ts';
import type { ReferenceCatalog } from '../../modules/reference-catalog/index.ts';
import type { BrowseRecord, TradeRecord } from '../../modules/trade-record/index.ts';
import { beginSemanticTransaction, type Persistence, type WorkspaceSnapshotBinding } from '../../persistence/index.ts';
import type { MutationGuard } from '../mutation-guard.ts';
import { payoffOf } from '../settlement.ts';
import { assembleReplay } from '../replay/index.ts';
import { attentionOf, byAttention, meterReadingOf, unavailableFamilies, valueTrade, type TradeValuation } from '../valuation/index.ts';
import type {
  ActionForm,
  DailyTradeReview,
  EarlierMark,
  EarlierMarksGroup,
  GetDailyTradeReviewRequest,
  GetDailyTradeReviewResult,
  HistoricalGapGroup,
  IncompleteReason,
  MarkRow,
  OpenDailyReviewRequest,
  OpenDailyReviewResult,
  OwedReflection,
  OwedReflectionsCard,
  OwedReflectionsTrade,
  OwedTradeSummary,
  CardProgress,
  DayChange,
  DayNeed,
  DayPastLine,
  DaySummary,
  PanelProgress,
  PostMarksReview,
  PostSaveReview,
  ReviewBinding,
  ReviewCompletion,
  ReviewFamily,
  ReviewNextStep,
  ReviewProgress,
  ResolveReviewDebtRequest,
  ReviewTradeItem,
  LastAction,
  WalkedTrade,
  SaveDailyReviewRequest,
  SaveDailyReviewResult,
  SavedMark,
  SettlementItem,
  SaveReviewMarksRequest,
  SaveReviewMarksResult,
  SaveTradeActionRequest,
  TradeSaveBinding,
} from './types.ts';

export interface DailyReviewDeps {
  readonly persistence: Persistence;
  readonly tradeRecord: TradeRecord;
  readonly catalog: ReferenceCatalog;
  readonly journal: Journal;
  readonly marketData: MarketData;
  readonly guard: MutationGuard;
}

const ASSEMBLY_ATTEMPTS = 3;

// The reason Daily Review gives a correction of a Mark typed in this Review (A303).
const SAME_REVIEW_FIX = 'Fixed in the same Review';

// The first listed gap date whose session close, as Market Data returns it, is at or after the exposure: the
// session the exposure is relevant from. Daily Review does not see the session policy (D4 A39; decision 62).
const firstRelevantGapDate = (closes: Readonly<Record<string, string>>, exposure: string): string | undefined =>
  Object.entries(closes)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .find(([, close]) => Temporal.Instant.compare(Temporal.Instant.from(close), Temporal.Instant.from(exposure)) >= 0)?.[0];

// A series point's Available Mark as a resolution, as the Review's rows carry it.
function availableOf(key: string, point: Extract<SeriesPoint, { readonly kind: 'Available' }>): EarlierMark['resolution'] {
  const { tradingDate, revisionNumber, price, source, savedAt, reason } = point;
  return { kind: 'Available', mark: { revisionId: `${key}@${tradingDate}#${revisionNumber}`, revisionNumber, price, source, savedAt, ...(reason !== undefined && { correctionReason: reason }) } };
}

// Facts that cannot be replayed make the Trade a Blocker with no mark-based figures to compare.
function incoherentItem(identity: Pick<ReviewTradeItem, 'tradeId' | 'underlying' | 'lastActivity'>, incoherent: IncoherentFacts): ReviewTradeItem {
  const unavailable = { reason: 'FactsIncoherent', findings: incoherent.findings } as const;
  return {
    ...identity,
    band: 'Blocker',
    reasons: [{ code: 'Unavailable', ...unavailable }],
    basis: { kind: 'Unavailable', ...unavailable },
  };
}

type Derivation = ReturnType<typeof derive>;

type ValuedTrade = Extract<TradeValuation, { readonly kind: 'Valued' }>;

// One Trade the index selected and confirmed Open at the cutoff, with both derivations of it.
interface EligibleTrade {
  readonly summary: BrowseRecord['summary'];
  readonly analysis: BrowseRecord['analysis'];
  readonly derivation: Derivation;
  readonly integrity: Derivation;
  // The Trade valued at the Review's close through Mark-to-Market Valuation, once its facts replay under both derivations.
  readonly valuation?: ValuedTrade;
  // The same Trade valued at the session before the Review Date, for the meter's earlier result (A260); absent when it cannot be.
  readonly before?: { readonly tradingDate: string; readonly evaluation: TradeEvaluation };
}

// The Marks the eligible Trades require: each Instrument once, at its earliest relevant date.
function observationNeeds(eligible: readonly EligibleTrade[]) {
  const derived = eligible.flatMap(({ summary, analysis, derivation, integrity }) => (derivation.kind === 'Derived' && integrity.kind === 'Derived' ? [{ summary, analysis, state: derivation }] : []));
  const requirements = derived.flatMap(({ state }) => state.observationRequirements.map((r) => ({ tradeId: state.tradeId, ...r })));
  const earliest = new Map<string, string>();
  for (const { instrument, earliestRelevance } of requirements) {
    const key = instrumentKey(instrument);
    const known = earliest.get(key);
    if (known === undefined || earliestRelevance < known) earliest.set(key, earliestRelevance);
  }
  return { requirements, earliest };
}

// The Review Date of the earliest first exposure among the Trades, in UTC: a Trade's first Review Date is never before it, whatever the
// Workspace's zone. A Trade whose facts cannot be replayed has none, so its Plan time stands in, which is never later.
function earliestExposureDate(eligible: readonly EligibleTrade[]): string {
  const starts = eligible.map(({ summary, derivation }) => (derivation.kind === 'Derived' ? derivation.exposureStart : null) ?? summary.planTime);
  return Temporal.Instant.from(starts.reduce((a, b) => (Temporal.Instant.compare(b, a) < 0 ? b : a))).toZonedDateTimeISO('UTC').toPlainDate().toString();
}

// The day's change in Trade P&L over the walked Trades: each Trade's figure at the Review Date less its figure at the session before, a Trade
// with no valuation then (not yet open) counting from nothing. Unavailable when a Review Date Mark is Missing, a Trade's facts cannot be
// replayed, or either figure is Unavailable for any other reason, such as the earlier session's own Mark being Missing.
function dayChangeOf(ranked: readonly { readonly valuation: ValuedTrade | undefined; readonly before: EligibleTrade['before'] }[], markMissing: boolean): DayChange {
  if (markMissing) return { kind: 'Unavailable' };
  let change = Rational.of(0n);
  for (const { valuation, before } of ranked) {
    const now = valuation?.evaluation.currentMarkedPnl;
    if (now?.kind !== 'Value') return { kind: 'Unavailable' };
    const earlier = before?.evaluation.currentMarkedPnl;
    if (earlier === undefined || earlier.kind === 'NotApplicable') change = change.add(now.value);
    else if (earlier.kind === 'Value') change = change.add(now.value.sub(earlier.value));
    else return { kind: 'Unavailable' };
  }
  return { kind: 'Value', dollars: change };
}

const shiftDay = (date: string, days: number): string => Temporal.PlainDate.from(date).add({ days }).toString();
const dayAfter = (date: string) => shiftDay(date, 1);
const dayBefore = (date: string) => shiftDay(date, -1);

// The session dates from `from` to `to`, both included, as the Review's calendar names them; none when the calendar does not cover them.
function missedSessions(read: MarketDataReadSession, from: string, to: string): readonly string[] {
  if (from > to) return [];
  const found = read.sessionDatesBetween(from, to);
  return found.kind === 'Sessions' ? found.dates : [];
}

// The option contracts the walked Trades still hold that expire after the Review Date, by expiration date, each date with the sessions left.
function expirationsAhead(ranked: readonly { readonly item: ReviewTradeItem; readonly valuation: ValuedTrade | undefined }[], read: MarketDataReadSession, reviewDate: string): NonNullable<DaySummary['finished']>['due']['expirations'] {
  const byDate = new Map<string, { tradeId: string; instrument: OptionInstrument }[]>();
  for (const { item, valuation } of ranked) {
    for (const { instrument, openLots } of valuation?.state.positions ?? []) {
      if (instrument.kind !== 'Option' || openLots.length === 0 || settlementDueOn(instrument, reviewDate)) continue;
      byDate.set(instrument.expiration, [...(byDate.get(instrument.expiration) ?? []), { tradeId: item.tradeId, instrument }]);
    }
  }
  return [...byDate]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([expiration, contracts]) => {
      const sessions = read.sessionDatesBetween(dayAfter(reviewDate), expiration);
      return { expiration, ...(sessions.kind === 'Sessions' && { sessionsLeft: sessions.dates.length }), contracts };
    });
}

// Each Trade's most recent Action of the history read, which is by Review Date.
function lastActionsOf(history: readonly HistoryAction[]): Map<string, LastAction> {
  const latest = new Map<string, LastAction>();
  for (const { tradeId, ...action } of history) latest.set(tradeId, action);
  return latest;
}

// The Debt ids of each of the Trades that has any, in the order given.
function outstandingDebtsOf(debts: readonly { readonly debtId: string; readonly anchor: { readonly tradeId: string } }[], tradeIds: readonly string[]) {
  const byTrade: Record<string, string[]> = {};
  for (const tradeId of tradeIds) {
    const ids = debts.filter((debt) => debt.anchor.tradeId === tradeId).map((debt) => debt.debtId);
    if (ids.length > 0) byTrade[tradeId] = ids;
  }
  return byTrade;
}

type ReflectionCounts = { readonly due: number; readonly later: number };

const reflectionsPanel = (reflections: ReflectionCounts): PanelProgress => ({ panel: 'Reflections', done: reflections.due === 0, dueNow: reflections.due, later: reflections.later });

// A card's panels in work order; it is done when every panel is (A164).
function cardProgress(marks: { readonly resolved: number; readonly needed: number }, reflections: ReflectionCounts, owed: boolean, settlementDue: boolean): CardProgress {
  const panels: PanelProgress[] = [
    { panel: 'Marks', done: marks.needed === 0, resolved: marks.resolved, needed: marks.needed },
    reflectionsPanel(reflections),
    // Between Reflections and Action, only while a contract's settlement is due (A112, decision 81).
    ...(settlementDue ? [{ panel: 'Settlement' as const, done: false, needed: true }] : []),
    { panel: 'Action', done: !owed, owed },
  ];
  return { kind: 'Walked', panels, done: panels.every((panel) => panel.done) };
}

// An owed-reflection card has the Reflections panel alone, and is done when that panel is (A90).
function owedCardProgress(reflections: ReflectionCounts): CardProgress {
  const panels = [reflectionsPanel(reflections)];
  return { kind: 'ReflectionsOwed', panels, done: panels.every((panel) => panel.done) };
}

// The first obligation still open; a Trade is completed with its form after the read.
type NextTask = Exclude<ReviewNextStep, { readonly kind: 'Trade' | 'OwedTrade' }> | { readonly kind: 'Trade'; readonly tradeId: string } | { readonly kind: 'OwedTrade'; readonly tradeId: string };

type ReadyReview = Extract<OpenDailyReviewResult, { kind: 'Ready' }>;

// What one pass returns before its binding is checked against the Workspace.
type Pass =
  | {
      readonly kind: 'Empty';
      readonly reviewDate: string;
      readonly cutoff: string;
      readonly owed: readonly OwedReflectionsTrade[];
      readonly evidence: Pick<ReviewBinding, 'marketDataSnapshotId' | 'factRevisions' | 'outstandingDebts'>;
    }
  | { readonly kind: 'Rejected'; readonly issues: readonly MarketDataIssue[] }
  | { readonly kind: 'Expired' }
  | {
      readonly kind: 'Ready';
      readonly review: Omit<ReadyReview, 'kind' | 'binding'>;
      readonly evidence: Pick<ReviewBinding, 'marketDataSnapshotId' | 'factRevisions' | 'outstandingDebts'>;
      // What a save continues from; `open` does not return it.
      readonly progress: ReviewProgress;
      readonly nextTask: NextTask;
    };

// What one Trade pass returns before its binding is checked against the Workspace.
type TradePass =
  | { readonly kind: 'Expired' }
  | { readonly kind: 'Rejected'; readonly issues: readonly MarketDataIssue[] }
  | { readonly kind: 'ReviewChanged' }
  | { readonly kind: 'ReflectionsOwed'; readonly reviewDate: string; readonly cutoff: string; readonly card: OwedReflectionsCard }
  // The save binding still lacks the Workspace's database name: that is read once the Workspace is settled.
  | { readonly kind: 'Ready'; readonly review: Omit<Extract<GetDailyTradeReviewResult, { kind: 'Ready' }>, 'kind' | 'trade'> & { readonly trade: Omit<DailyTradeReview, 'saveBinding'> & { readonly saveBinding: Omit<TradeSaveBinding, 'databaseName'> } } };

// One attempt at a read: retried (an expired cursor), returned as it is, or returned once the
// Workspace is confirmed unchanged, completed with the binding then current.
type Attempt<R> =
  | { readonly retry: true }
  | { readonly done: R }
  | { readonly settle: (binding: { workspace: WorkspaceSnapshotBinding; catalogRevision: number; journalRevision: number }) => R };

// Marks come first, then the first Trade of the walk that is not done: its Action is saved and it owes no due
// reflection (A68). The walk starts from the Trade just saved when there is one, and wraps around. Then the first card
// of the owed-reflection group, in its order, that is not done (A90).
function nextTaskOf(today: readonly MarkRow[], walkOrder: readonly string[], actions: Readonly<Record<string, unknown>>, dueTrades: ReadonlySet<string>, owed: readonly OwedReflectionsTrade[], from?: string): NextTask {
  const mark = today.find((row) => row.task === 'Manual');
  if (mark) return { kind: 'Mark', row: mark };
  const start = Math.max(0, from === undefined ? 0 : walkOrder.indexOf(from));
  const tradeId = [...walkOrder.slice(start), ...walkOrder.slice(0, start)].find((id) => !(id in actions) || dueTrades.has(id));
  if (tradeId !== undefined) return { kind: 'Trade', tradeId };
  const owedTrade = owed.find(({ progress }) => !progress.done);
  return owedTrade === undefined ? { kind: 'Done' } : { kind: 'OwedTrade', tradeId: owedTrade.tradeId };
}

export interface DailyReview {
  open(request: OpenDailyReviewRequest): Promise<OpenDailyReviewResult>;
  getTrade(request: GetDailyTradeReviewRequest): Promise<GetDailyTradeReviewResult>;
  // The Action and Debt saves keep their results; a Marks save (or any request) may also answer a bare ReviewChanged.
  // A property of overloaded call signatures, not a method, so the facade can forward it unbound.
  readonly save: {
    (request: SaveTradeActionRequest | ResolveReviewDebtRequest): Promise<SaveDailyReviewResult>;
    (request: SaveDailyReviewRequest): Promise<SaveReviewMarksResult>;
  };
}

// The Trade's place in the walk and, when its facts replay, its evaluation at the Review date, as the module valued it.
function reviewItem({ summary, analysis, derivation, integrity, valuation, before }: EligibleTrade, lastAction?: LastAction) {
  const identity = { tradeId: summary.tradeId, underlying: summary.underlying, lastActivity: summary.lastActivity ?? summary.planTime, ...(lastAction && { lastAction }) };
  // Facts that cannot be replayed at any time make the Trade incoherent, whichever derivation finds them.
  if (derivation.kind === 'IncoherentFacts') return { item: incoherentItem(identity, derivation), valuation: undefined, before: undefined };
  if (integrity.kind === 'IncoherentFacts') return { item: incoherentItem(identity, integrity), valuation: undefined, before: undefined };
  if (!valuation) throw new Error(`Trade ${summary.tradeId} was not valued`);
  const held = openTradeSummary(analysis.plan.legs[0]!.instrument, derivation);
  const item: ReviewTradeItem = { ...identity, ...(held && { summary: held }), ...attentionOf(derivation, valuation.evaluation, integrity.findings, lastAction) };
  return { item, valuation, before };
}

// The Trade's summary on an owed-reflection card, from all its facts: Closed with its realized figures and Close Reason,
// otherwise Open with the Position it holds (A90).
function owedSummary(lifecycle: LifecycleState, state: DerivedTradeState, analysis: TradeAnalysisRecord, closeReason?: { id: string; label: string }, closeReviewOutcome?: ObligationOutcome): OwedTradeSummary {
  if (lifecycle !== 'Closed') {
    const position = openTradeSummary(analysis.plan.legs[0]!.instrument, state);
    return { kind: 'Open', ...(position && { position }), entryResolution: state.entryResolution };
  }
  return {
    kind: 'Closed',
    realizedPnl: state.realizedToDate,
    realizedR: state.realizedR,
    terminalDisposition: state.terminalDisposition,
    ...(analysis.plan.legs[0]!.instrument.kind === 'Option' && { optionSide: analysis.plan.legs[0]!.side }),
    ...(closeReason && { closeReason }),
    ...(closeReviewOutcome && { closeReviewOutcome }),
    ...(analysis.terminalTime && { terminalTime: analysis.terminalTime }),
  };
}

// What replaying the Trade yields at the Review-date frame, with the dated line the module found (P83).
function figuresOf(analysis: TradeAnalysisRecord, valuation: ValuedTrade) {
  const contract = analysis.plan.legs[0]!.instrument;
  const summary = openTradeSummary(contract, valuation.state);
  // The card shows the Underlying's frame: a stock's own, an option's paired one.
  const frame = contract.kind === 'Stock' ? valuation.frame : valuation.underlyingFrame;
  const { evaluation, datedLine } = valuation;
  // After its expiration date an option requires no Mark, so the module read no frame (A110).
  if (!frame && contract.kind === 'Stock') throw new Error(`Market Data returned no frame for ${analysis.plan.underlying}`);
  return { ...(summary && { summary }), ...(frame && { frame }), evaluation, ...(datedLine && { datedLastClose: datedLine }) };
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
  // With a read session, each Trade whose facts replay is valued through the module at the session's close, which derives it
  // once (the cutoff derivation is the valuation's state); the integrity derivation stays here (A192). Without one, the cutoff
  // derivation is made here, for a read that only needs the Trades' requirements.
  // The open takes no dated line (decision 104) and, with `withGaps`, the gaps of each Trade's Instruments; every Trade is
  // valued in one synchronous run, so their frames and gap scans share the Review date's read snapshot.
  async function eligibleTrades(cutoff: string, reviewDate: string, read?: { readonly session: MarketDataReadSession; readonly beforeSession?: MarketDataReadSession; readonly withGaps: boolean }): Promise<EligibleTrade[] | undefined> {
    const records = await eligibleRecords(cutoff);
    if (!records) return undefined;
    const entries = await Promise.all(
      records.map(async ({ summary, analysis }): Promise<EligibleTrade> => {
        const integrity = derive({ record: analysis });
        if (!read || integrity.kind !== 'Derived') return { summary, analysis, integrity, derivation: derive({ record: analysis, cutoff, valuationDate: reviewDate }) };
        // Both valuations are asked in this one run, so the session before's Marks are read once for every Trade (P133).
        const [valuation, earlier] = await Promise.all([
          valueTrade(read.session, analysis, { factsAtClose: true, skipDatedLine: true, withGaps: read.withGaps }),
          read.beforeSession && valueTrade(read.beforeSession, analysis, { factsAtClose: true, skipDatedLine: true }),
        ]);
        if (valuation.kind === 'Unavailable') return { summary, analysis, integrity, derivation: { kind: 'IncoherentFacts', findings: valuation.findings } };
        const before = read.beforeSession && earlier?.kind === 'Valued' ? { tradingDate: read.beforeSession.tradingDate, evaluation: earlier.evaluation } : undefined;
        return { summary, analysis, integrity, derivation: valuation.state, valuation, ...(before && { before }) };
      }),
    );
    return entries.filter(({ derivation }) => derivation.kind !== 'Derived' || derivation.expectedLifecycle === 'Open');
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

  // The Review date's frames of the Instruments, each read once through the session, with the previous close and the snapshot
  // and evidence binding of what was read. The session has no frame to take the previous close from when no Instrument is
  // needed, so Market Data's frames for no Instrument give it. A save calls it on a session of its own that reads nothing
  // else, so the evidence binding it rechecks holds the frames' keys alone.
  async function reviewFrames(read: MarketDataReadSession, reviewDate: string, instruments: readonly string[]) {
    const frames = await read.frames([...instruments].sort());
    const [first] = frames;
    if (first) {
      const { evidenceBinding, snapshotIds } = read.binding();
      return { kind: 'Frames' as const, frames, previousCloseInstant: first.previousCloseInstant, snapshotId: snapshotIds[reviewDate]!, evidenceBinding };
    }
    const none = await deps.marketData.query({ kind: 'ResolveFrames', context: { kind: 'Review', reviewDate }, instruments: [] });
    if (none.kind === 'Rejected') return none;
    if (none.kind !== 'Frames') throw new Error(`unexpected frames result: ${none.kind}`);
    return { kind: 'Frames' as const, frames, previousCloseInstant: none.previousCloseInstant, snapshotId: none.snapshotId, evidenceBinding: none.evidenceBinding };
  }

  // The Trades outside the walk with an Outstanding reflection, due or not (P20, A89), in the group's order. Each is one
  // `getRecord` by identity, so the reads are bounded by the Trades that have Debt, never by Trade count or history.
  async function owedGroup(outstanding: readonly DebtProjection[], walked: ReadonlySet<string>, closes: SessionCloses) {
    const debtsByTrade = new Map<string, DebtProjection[]>();
    for (const debt of outstanding) {
      if (!walked.has(debt.anchor.tradeId)) debtsByTrade.set(debt.anchor.tradeId, [...(debtsByTrade.get(debt.anchor.tradeId) ?? []), debt]);
    }
    const found = await Promise.all(
      [...debtsByTrade].map(async ([tradeId, debts]) => {
        const stored = await deps.tradeRecord.getRecord({ tradeId, projection: 'Summary' });
        if (stored.kind !== 'Found') return [];
        const summary = stored.projection as BrowseRecord['summary'];
        const owed = debts.toSorted((a, b) => compareDueAnchors(a.dueAnchor, b.dueAnchor)).map(({ debtId, entryTypeKey, dueAnchor }) => ({ debtId, entryTypeKey, dueAnchor, classification: classifyDue(dueAnchor, closes) }));
        const due = owed.filter(({ classification }) => classification === 'Due').length;
        const trade: OwedReflectionsTrade = { tradeId, underlying: summary.underlying, lifecycle: summary.lifecycle, owed, progress: owedCardProgress({ due, later: owed.length - due }) };
        return [{ trade, factRevision: stored.factRevision, standing: owedStandingOf(tradeId, debts.map(({ dueAnchor }) => dueAnchor), closes) }];
      }),
    );
    const ordered = found.flat().sort((a, b) => compareOwed(a.standing, b.standing));
    return { trades: ordered.map(({ trade }) => trade), factRevisions: Object.fromEntries(ordered.map(({ trade, factRevision }) => [trade.tradeId, factRevision])) };
  }

  // The option contracts the walked Trades still hold at or past expiration, by expiration date then Trade identity (A112).
  // The module lists each Trade's items with their settlement times; they are put in that order here.
  const settlementItems = (ranked: readonly { readonly valuation: ValuedTrade | undefined }[]): SettlementItem[] =>
    ranked
      .flatMap(({ valuation }) => valuation?.settlement ?? [])
      .sort((a, b) => (a.expiration === b.expiration ? (a.tradeId < b.tradeId ? -1 : Number(a.tradeId > b.tradeId)) : a.expiration < b.expiration ? -1 : 1));

  // Each Instrument's gaps once, as one recovery over every walked Trade lists them: each Trade's answer is its Instrument's scan
  // narrowed to its own exposure, so the union of the answers is the one the earliest exposure gives.
  function gapsOf(entries: readonly EligibleTrade[]): HistoricalGaps[] {
    const byInstrument = new Map<string, HistoricalGaps[]>();
    for (const found of entries.flatMap(({ valuation }) => valuation?.gaps ?? [])) byInstrument.set(found.instrumentKey, [...(byInstrument.get(found.instrumentKey) ?? []), found]);
    const union = (lists: readonly (readonly string[])[]) => [...new Set(lists.flat())].sort();
    return [...byInstrument]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([instrumentKey, answers]) => ({
        instrumentKey,
        missing: union(answers.map((a) => a.missing)),
        acknowledged: union(answers.map((a) => a.acknowledged)),
        revisions: Object.assign({}, ...answers.map((a) => a.revisions)) as HistoricalGaps['revisions'],
        acknowledgments: Object.assign({}, ...answers.map((a) => a.acknowledgments)) as HistoricalGaps['acknowledgments'],
        closes: Object.assign({}, ...answers.map((a) => a.closes)) as HistoricalGaps['closes'],
      }));
  }

  // Each walked Trade past its Stop or Target at the Review Date, with the sessions of the current run (the replay's `since`) through the
  // Review Date. Only Trades the Review Date's conditions read as crossed are replayed, all in one run so their series share the session's scans.
  async function pastLineOf(ranked: readonly { readonly item: ReviewTradeItem; readonly valuation: ValuedTrade | undefined }[], eligible: readonly EligibleTrade[], read: MarketDataReadSession, reviewDate: string): Promise<DayPastLine> {
    const byId = new Map(eligible.map((entry) => [entry.analysis.tradeId, entry]));
    const crossedNow = (evaluation: TradeEvaluation, role: 'Stop' | 'Target') =>
      evaluation.conditions.some((condition) => {
        const status = condition.result.kind === 'Value' ? condition.result.value.status : condition.underlyingReading?.status;
        return condition.role === role && status !== undefined && status !== 'Active';
      });
    const runs = await Promise.all(
      ranked.map(async ({ item, valuation }) => {
        const entry = byId.get(item.tradeId)!;
        const roles = (['Stop', 'Target'] as const).filter((role) => valuation !== undefined && crossedNow(valuation.evaluation, role));
        if (roles.length === 0 || entry.integrity.kind !== 'Derived' || entry.analysis.positionChanges.length === 0) return [];
        const replayed = await assembleReplay(deps, entry.analysis, entry.integrity, read, { withJournal: false });
        const last = 'kind' in replayed ? undefined : replayed.sessions.at(-1);
        if (last?.date !== reviewDate) return [];
        return roles.flatMap((role) => {
          const since = last.crossings?.[role === 'Stop' ? 'stop' : 'target'].since?.date;
          const dates = since === undefined ? undefined : read.sessionDatesBetween(since, reviewDate);
          return dates?.kind === 'Sessions' ? [{ role, tradeId: item.tradeId, sessions: dates.dates.length }] : [];
        });
      }),
    );
    const listed = (role: 'Stop' | 'Target') => runs.flat().filter((run) => run.role === role).map(({ tradeId, sessions }) => ({ tradeId, sessions }));
    return { stop: listed('Stop'), target: listed('Target') };
  }

  // One pass over the module reads. Its Review carries what the pass itself learned of the binding.
  // `withGaps` false skips the historical Mark-gap scan: the frames and snapshot are the ones `recover` gives, the gaps are left empty.
  // `from` is the Trade a save just resolved: the next step is looked for from it.
  async function assemble(context: FrameContext, withGaps = true, from?: string, withFinished = false): Promise<Pass> {
    const session = await deps.marketData.query({ kind: 'ResolveSession', context });
    if (session.kind === 'Rejected') return session;
    if (session.kind !== 'Session') throw new Error(`unexpected session result: ${session.kind}`);
    const { tradingDate: reviewDate, closeInstant: cutoff } = session;
    // One read session for the whole pass: each Trade is valued through the module, and each date and Instrument is read once.
    const read = await deps.marketData.openReadSession({ kind: 'Review', reviewDate });
    // The session before the Review Date, read as a session of its own so the Review's binding holds only the Review date's Marks.
    const beforeSession = read.previousSessionDate ? await deps.marketData.openReadSession({ kind: 'Review', reviewDate: read.previousSessionDate }, { withoutStale: true }) : undefined;
    const derivations = await eligibleTrades(cutoff, reviewDate, { session: read, ...(beforeSession && { beforeSession }), withGaps });
    if (!derivations) return { kind: 'Expired' };
    const { requirements, earliest } = observationNeeds(derivations);
    // The frames the valuations read, in one answer; with no walked Trade there is no Instrument to scan for gaps, and the
    // answer still gives the previous close the owed group needs.
    const recovered = await reviewFrames(read, reviewDate, [...earliest.keys()]);
    if (recovered.kind === 'Rejected') throw new Error('Market Data rejected the Review frames request');
    const gaps = gapsOf(derivations);
    const resolutionRevisionOf = (key: string) => read.binding().evidenceBinding.find((bound) => bound.instrumentKey === key && bound.tradingDate === reviewDate)?.resolutionRevision ?? 'None';

    // Each key a frame or gap names is a requirement's Instrument, so the Instrument is the Trades' own (K18).
    const instrumentOfKey = (key: string): Instrument => requirements.find((r) => instrumentKey(r.instrument) === key)!.instrument;
    const today = recovered.frames.map(
      ({ instrumentKey: key, tradingDate, resolution }): MarkRow => ({
        instrumentKey: key,
        instrument: instrumentOfKey(key),
        tradingDate,
        trades: requirements.filter((r) => instrumentKey(r.instrument) === key).map((r) => r.tradeId),
        resolution,
        resolutionRevision: resolutionRevisionOf(key),
        task: resolution.kind === 'Missing' ? 'Manual' : null,
      }),
    );
    // One read of the Daily Trade Review Actions: the Review Date's, and each earlier one from the earliest first exposure on (P168).
    // An empty walk has no Trade to place an Action on, so it reads them later, only when the Review is not Empty.
    const savedActions = derivations.length === 0 ? undefined : await deps.journal.queryActions({ reviewDate, since: earliestExposureDate(derivations) });
    const lastActions = lastActionsOf(savedActions?.earlier ?? []);
    const ranked = derivations.map((entry) => reviewItem(entry, lastActions.get(entry.summary.tradeId))).sort((a, b) => byAttention(a.item, b.item));
    const settlement = settlementItems(ranked);
    const earlier = gaps
      .filter((g) => g.missing.length + g.acknowledged.length > 0)
      .map(
        (g): HistoricalGapGroup => ({
          // The closes only place each Trade's first date, so they do not pass through to the group.
          instrumentKey: g.instrumentKey,
          instrument: instrumentOfKey(g.instrumentKey),
          missing: g.missing,
          acknowledged: g.acknowledged,
          revisions: g.revisions,
          acknowledgments: g.acknowledgments,
          trades: ranked.flatMap(({ item }) =>
            requirements
              .filter((r) => r.tradeId === item.tradeId && instrumentKey(r.instrument) === g.instrumentKey)
              // A Trade after every listed date is listed from the Review date (decision 63).
              .map((r) => ({ tradeId: r.tradeId, from: firstRelevantGapDate(g.closes, r.earliestRelevance) ?? reviewDate })),
          ),
          blocking: false,
        }),
      );
    const previousSession = read.previousSessionDate;
    // The sessions a Trade's grid can show beyond the Review Date, with their closes: the previous session and each date a gap group of the
    // Trade's Instruments lists. A Trade's Instruments that have no gap there still show their Mark on those dates.
    const sessionsOf = (tradeId: string): Readonly<Record<string, string>> => ({
      ...(Object.assign({}, ...gaps.filter((g) => requirements.some((r) => r.tradeId === tradeId && instrumentKey(r.instrument) === g.instrumentKey)).map((g) => g.closes)) as HistoricalGaps['closes']),
      ...(previousSession !== undefined && { [previousSession]: recovered.previousCloseInstant }),
    });
    const earlierMarks = (
      previousSession === undefined
        ? []
        : await Promise.all(
            gaps.map(async ({ instrumentKey: key }): Promise<EarlierMarksGroup | undefined> => {
              const trades = ranked.flatMap(({ item }) =>
                requirements
                  .filter((r) => r.tradeId === item.tradeId && instrumentKey(r.instrument) === key)
                  .map((r) => ({ tradeId: r.tradeId, from: firstRelevantGapDate(sessionsOf(r.tradeId), r.earliestRelevance) ?? reviewDate })),
              );
              // An Instrument its Trades all opened on the Review Date with has no earlier session, so no call is made for it.
              const from = trades.map((trade) => trade.from).filter((date) => date < reviewDate).sort()[0];
              if (from === undefined) return undefined;
              const dates = new Set(trades.flatMap(({ tradeId }) => Object.keys(sessionsOf(tradeId))));
              const points = await read.series(key, from, previousSession);
              return {
                instrumentKey: key,
                instrument: instrumentOfKey(key),
                trades,
                marks: Object.fromEntries(
                  points.flatMap((point) =>
                    point.kind === 'Available' && dates.has(point.tradingDate)
                      ? [[point.tradingDate, { resolution: availableOf(key, point), resolutionRevision: point.resolutionRevision }]]
                      : [],
                  ),
                ),
              };
            }),
          )
    ).filter((group) => group !== undefined);
    // Outstanding Debt, read once (A63), classified against the close of the session before the Review Date (A75).
    const previousClose = recovered.previousCloseInstant;
    const outstanding = (await deps.journal.query({ scope: 'OutstandingDebt' })).debts;
    const closes = { previousClose, close: cutoff };
    const walkedIds = derivations.map(({ analysis }) => analysis.tradeId);
    const group = await owedGroup(outstanding, new Set(walkedIds), closes);
    const evidence = {
      marketDataSnapshotId: recovered.snapshotId,
      factRevisions: { ...Object.fromEntries(derivations.map(({ analysis }) => [analysis.tradeId, analysis.factRevision])), ...group.factRevisions },
      outstandingDebts: outstandingDebtsOf(outstanding, [...walkedIds, ...group.trades.map(({ tradeId }) => tradeId)]),
    };
    // Empty means no Trade to walk and no other required task: a due reflection of a Trade outside the walk is one (AC-REV-006).
    if (derivations.length === 0 && group.trades.every(({ progress }) => progress.done)) return { kind: 'Empty', reviewDate, cutoff, owed: group.trades, evidence };
    const dueDebtIds = (tradeId: string) =>
      outstanding.filter((debt) => debt.anchor.tradeId === tradeId && classifyDue(debt.dueAnchor, closes) === 'Due').map((debt) => debt.debtId);
    const reflectionsOf = (tradeId: string) => {
      const due = dueDebtIds(tradeId).length;
      return { due, later: outstanding.filter((debt) => debt.anchor.tradeId === tradeId).length - due };
    };
    const actions = savedActions ?? (await deps.journal.queryActions({ reviewDate }));
    const progressOf = (tradeId: string, settlementDue: boolean): CardProgress => {
      const rows = today.filter((row) => row.trades.includes(tradeId));
      const needed = rows.filter((row) => row.task === 'Manual').length;
      return cardProgress({ resolved: rows.length - needed, needed }, reflectionsOf(tradeId), !(tradeId in actions.actions), settlementDue);
    };
    const walked = ranked.map(
      ({ item, valuation, before }): WalkedTrade => ({
        ...item,
        progress: progressOf(item.tradeId, settlement.some((s) => s.tradeId === item.tradeId)),
        ...(valuation && { meter: meterReadingOf(valuation.evaluation, before), figures: { riskToStop: valuation.evaluation.ongoingRiskToStop, pnl: valuation.evaluation.currentMarkedPnl, rewardRiskNow: valuation.evaluation.rewardRiskNow } }),
      }),
    );
    const families: ReviewFamily[] = [
      { family: 'Marks', today, earlier, ...(previousSession !== undefined && { previousSession }), earlierMarks },
      ...(settlement.length > 0 ? [{ family: 'Settlement' as const, items: settlement }] : []),
      { family: 'Trades', trades: walked },
    ];

    const reasons: IncompleteReason[] = [
      ...today
        .filter((row) => row.task === 'Manual')
        .map((row): IncompleteReason => ({ code: 'MarkMissing', instrument: row.instrument, tradingDate: row.tradingDate, trades: row.trades })),
      // Then each due settlement (A112), before the walk.
      ...settlement.map((item): IncompleteReason => ({ code: 'SettlementDue', ...item })),
      ...walked.flatMap((item): IncompleteReason[] => [
        ...item.reasons.flatMap((reason): IncompleteReason[] => {
          if (reason.code === 'IntegrityDisagreement') return [{ ...reason, tradeId: item.tradeId }];
          if (reason.code === 'Unavailable' && reason.reason === 'FactsIncoherent') return [{ code: 'IncoherentFacts', tradeId: item.tradeId, findings: reason.findings }];
          return [];
        }),
        ...(item.tradeId in actions.actions ? [] : [{ code: 'ActionMissing' as const, tradeId: item.tradeId }]),
        ...(dueDebtIds(item.tradeId).length > 0 ? [{ code: 'ReflectionDue' as const, tradeId: item.tradeId, debtIds: dueDebtIds(item.tradeId) }] : []),
      ]),
      // Then the owed-reflection group, in its order (P20).
      ...group.trades.flatMap(({ tradeId, owed }): IncompleteReason[] => {
        const debtIds = owed.filter((reflection) => reflection.classification === 'Due').map((reflection) => reflection.debtId);
        return debtIds.length > 0 ? [{ code: 'ReflectionDue', tradeId, debtIds }] : [];
      }),
    ];
    const acknowledged = today.filter((row) => row.resolution.kind === 'AcknowledgedUnavailable');
    const affected = ranked.filter(({ item }) => acknowledged.some((row) => row.trades.includes(item.tradeId)));
    const completionOf = (): ReviewCompletion => {
      if (reasons.length > 0) return { kind: 'Incomplete', reasons };
      if (acknowledged.length === 0) return { kind: 'Complete' };
      return {
        kind: 'CompleteWithUnavailableMarks',
        instruments: acknowledged.map((row) => row.instrument),
        trades: affected.map(({ item }) => item.tradeId),
        families: unavailableFamilies(affected.flatMap(({ valuation }) => (valuation ? [valuation.evaluation] : []))),
      };
    };
    const completion = completionOf();
    const settlementTrades = new Set(settlement.map((item) => item.tradeId));
    const dueDebts = outstanding.filter((debt) => classifyDue(debt.dueAnchor, closes) === 'Due');
    const marksToGo = today.filter((row) => row.task === 'Manual').length;
    // The finished day's lists are read once nothing is to go, and by `open` alone: the replays they need stay out of the save passes.
    const finished =
      withFinished && completion.kind !== 'Incomplete'
        ? {
            pastLine: await pastLineOf(ranked, derivations, read, reviewDate),
            chosen: ranked.flatMap(({ item }) => (item.tradeId in actions.actions ? [{ tradeId: item.tradeId, action: actions.actions[item.tradeId]!.action }] : [])),
            due: {
              sales: ranked.filter(({ item }) => actions.actions[item.tradeId]?.action === 'Exit').map(({ item }) => item.tradeId),
              expirations: expirationsAhead(ranked, read, reviewDate),
            },
          }
        : undefined;
    const lastReviewed = savedActions?.earlier?.at(-1)?.reviewDate;
    // The count starts the day after the latest earlier Action, or with none at the first exposure's date; with nothing walked nothing is missed.
    const day: DaySummary = {
      ...(finished && { finished }),
      ...(read.nextSessionDate !== undefined && { nextReviewDate: read.nextSessionDate }),
      missed: derivations.length === 0 ? [] : missedSessions(read, lastReviewed === undefined ? earliestExposureDate(derivations) : dayAfter(lastReviewed), dayBefore(reviewDate)),
      trades: walked.length,
      change: dayChangeOf(ranked, marksToGo > 0),
      toGo: {
        marks: marksToGo,
        actions: walked.filter((item) => !(item.tradeId in actions.actions) && !settlementTrades.has(item.tradeId)).length,
        expirations: settlement.length,
        closeReviews: dueDebts.filter((debt) => debt.entryTypeKey === 'entry-type.close-review').length,
        reflections: dueDebts.filter((debt) => debt.entryTypeKey !== 'entry-type.close-review').length,
      },
      lines: [
        ...walked.map(({ tradeId, progress }) => ({
          tradeId,
          needs: progress.panels.flatMap((panel): DayNeed[] => {
            if (panel.panel === 'Marks') return panel.done ? [] : ['Marks'];
            if (panel.panel === 'Reflections') return panel.done ? [] : ['Reflection'];
            if (panel.panel === 'Settlement') return ['Settlement'];
            return panel.done || settlementTrades.has(tradeId) ? [] : ['Action'];
          }),
        })),
        ...group.trades.filter(({ progress }) => !progress.done).map(({ tradeId }) => ({ tradeId, needs: ['Reflection' as const] })),
      ],
    };

    return {
      kind: 'Ready',
      review: { reviewDate, cutoff, families, owed: group.trades, completion, day },
      evidence,
      nextTask: nextTaskOf(today, ranked.map(({ item }) => item.tradeId), actions.actions, new Set(walked.filter((item) => dueDebtIds(item.tradeId).length > 0).map((item) => item.tradeId)), group.trades, from),
      progress: { tradesWithAction: ranked.filter(({ item }) => item.tradeId in actions.actions).length, tradesEligible: ranked.length },
    };
  }

  // The same Review-date frames as the overview's, so its snapshot is comparable.
  async function boundFrames(read: MarketDataReadSession, eligible: readonly EligibleTrade[], reviewDate: string, binding: ReviewBinding) {
    const frames = await reviewFrames(read, reviewDate, [...observationNeeds(eligible).earliest.keys()]);
    if (frames.kind === 'Rejected') return frames;
    if (frames.snapshotId !== binding.marketDataSnapshotId) return { kind: 'ReviewChanged' as const };
    return frames;
  }

  // The labels a card shows; a reference the Catalog cannot resolve leaves them blank.
  async function labelsOf(summary: BrowseRecord['summary']) {
    const labels = await deps.catalog.resolve([
      { name: 'account', kind: 'Account', id: summary.accountId, mode: 'DisplayOnly' },
      { name: 'strategy', kind: 'Strategy', id: summary.strategyId, mode: 'DisplayOnly' },
    ]);
    const resolved = labels.kind === 'Resolved' ? labels.resolved : {};
    return { strategy: resolved['strategy']?.label ?? '', account: resolved['account']?.label ?? '', institution: resolved['account']?.institution?.label ?? '' };
  }

  // The Close Reason the Trade was closed with. It is resolved on its own, since the Catalog answers Unresolved for a whole
  // request when any reference in it fails: the identity stays with a blank label, and the other labels are unaffected.
  async function closeReasonOf(closeReasonId: string | undefined): Promise<{ id: string; label: string } | undefined> {
    if (closeReasonId === undefined) return undefined;
    const found = await deps.catalog.resolve([{ name: 'closeReason', kind: 'CloseReason', id: closeReasonId, mode: 'DisplayOnly' }]);
    return { id: closeReasonId, label: found.kind === 'Resolved' ? (found.resolved['closeReason']?.label ?? '') : '' };
  }

  // The Trade's Outstanding Debt as the overview listed it; undefined when a resolution since has changed the list.
  async function boundDebts(tradeId: string, binding: ReviewBinding): Promise<DebtProjection[] | undefined> {
    const outstanding = (await deps.journal.query({ scope: 'OutstandingDebt' })).debts.filter((debt) => debt.anchor.tradeId === tradeId);
    const bound = binding.outstandingDebts[tradeId] ?? [];
    if (outstanding.length !== bound.length || outstanding.some((debt, i) => debt.debtId !== bound[i])) return undefined;
    return outstanding;
  }

  // The current outcome of a Trade's Close Review obligation: the Trade narrative holds one item per obligation, and the
  // Close Review's is the one carrying its Entry Type key, never its label. One bounded read of this Trade.
  async function closeReviewOutcomeOf(tradeId: string): Promise<ObligationOutcome | undefined> {
    const { items } = await deps.journal.query({ scope: 'TradeNarrative', tradeId });
    const item = items.find((candidate) => candidate.entryTypeKey === 'entry-type.close-review');
    return item && { kind: item.kind, id: item.id };
  }

  // Each Debt as a form: its snapshot definition, the Position Change it follows, and how it is classified. In due-anchor order,
  // anchors compared as instants (A68, A89).
  async function reflectionsOf(debts: readonly DebtProjection[], analysis: TradeAnalysisRecord, closes: SessionCloses): Promise<OwedReflection[]> {
    const { positionChanges } = analysis;
    const legs = analysis.plan.legs.map(({ factId, side }) => ({ factId, side }));
    const reflections: OwedReflection[] = [];
    // The Entry Type labels come from the Trade's narrative, which is where Trade Detail reads them: one bounded read of this Trade.
    const tradeId = debts[0]?.anchor.tradeId;
    const narrative = tradeId === undefined ? [] : (await deps.journal.query({ scope: 'TradeNarrative', tradeId })).items;
    const entryTypes = new Map(narrative.flatMap((item) => (item.kind === 'Debt' ? [[item.id, item.entryType] as const] : [])));
    for (const debt of debts.toSorted((a, b) => compareDueAnchors(a.dueAnchor, b.dueAnchor))) {
      const definition = await deps.journal.getDefinitions({ revision: debt.definitionId });
      if (definition.kind !== 'Found') throw new Error(`no definition ${debt.definitionId}`);
      const positionChange = positionChanges.find((pc) => pc.factId === debt.origin.factId);
      reflections.push({
        debtId: debt.debtId,
        entryType: entryTypes.get(debt.debtId) ?? debt.entryTypeKey,
        definition: definition.definition,
        economicTime: debt.momentTime,
        executions: positionChange?.executions ?? [],
        legs,
        ...(positionChange?.settlements && { settlements: positionChange.settlements }),
        classification: classifyDue(debt.dueAnchor, closes),
        saveBinding: { debtId: debt.debtId, debtRevision: debt.revision, definitionRevision: debt.definitionId },
      });
    }
    return reflections;
  }

  // The card of a Trade outside the walk with an Outstanding reflection (A90): bound like a walked card, but with no evaluation.
  async function assembleOwedCard(request: GetDailyTradeReviewRequest, read: MarketDataReadSession, eligible: readonly EligibleTrade[], reviewDate: string, cutoff: string): Promise<TradePass> {
    const { tradeId, binding } = request;
    // A Trade the overview did not list as owing a reflection is no card of this Review.
    if ((binding.outstandingDebts[tradeId] ?? []).length === 0) return { kind: 'ReviewChanged' };
    const [stored, input] = await Promise.all([
      deps.tradeRecord.getRecord({ tradeId, projection: 'Summary' }),
      deps.tradeRecord.getRecord({ tradeId, projection: 'AnalysisInput' }),
    ]);
    if (stored.kind !== 'Found' || input.kind !== 'Found') return { kind: 'ReviewChanged' };
    const summary = stored.projection as BrowseRecord['summary'];
    const analysis = input.projection as TradeAnalysisRecord;
    if (input.factRevision !== binding.factRevisions[tradeId]) return { kind: 'ReviewChanged' };
    const frames = await boundFrames(read, eligible, reviewDate, binding);
    if (frames.kind !== 'Frames') return frames;
    const outstanding = await boundDebts(tradeId, binding);
    if (!outstanding) return { kind: 'ReviewChanged' };
    const reflections = await reflectionsOf(outstanding, analysis, { previousClose: frames.previousCloseInstant, close: cutoff });
    const labels = await labelsOf(summary);
    const closeReason = await closeReasonOf(analysis.closeReason?.closeReasonId);
    const state = derive({ record: analysis });
    const closeReviewOutcome = summary.lifecycle === 'Closed' ? await closeReviewOutcomeOf(tradeId) : undefined;
    const due = reflections.filter((reflection) => reflection.classification === 'Due').length;
    return {
      kind: 'ReflectionsOwed',
      reviewDate,
      cutoff,
      card: {
        tradeId,
        underlying: summary.underlying,
        lifecycle: summary.lifecycle,
        labels,
        ...(state.kind === 'Derived' && { summary: owedSummary(summary.lifecycle, state, analysis, closeReason, closeReviewOutcome) }),
        reflections,
        progress: owedCardProgress({ due, later: reflections.length - due }),
      },
    };
  }

  // One pass over the module reads for one Trade of an overview.
  async function assembleTrade(request: GetDailyTradeReviewRequest): Promise<TradePass> {
    const session = await deps.marketData.query({ kind: 'ResolveSession', context: { kind: 'Review', reviewDate: request.reviewDate } });
    if (session.kind === 'Rejected') return session;
    if (session.kind !== 'Session') throw new Error(`unexpected session result: ${session.kind}`);
    const { tradingDate: reviewDate, closeInstant: cutoff } = session;
    const read = await deps.marketData.openReadSession({ kind: 'Review', reviewDate });
    const eligible = await eligibleTrades(cutoff, reviewDate);
    if (!eligible) return { kind: 'Expired' };
    const found = eligible.find(({ analysis }) => analysis.tradeId === request.tradeId);
    if (!found) return assembleOwedCard(request, read, eligible, reviewDate, cutoff);
    const { summary, analysis } = found;
    if (analysis.factRevision !== request.binding.factRevisions[analysis.tradeId]) return { kind: 'ReviewChanged' };
    // Every eligible Trade's Instruments are read, so the snapshot is the overview's; only this Trade is valued.
    const frames = await boundFrames(read, eligible, reviewDate, request.binding);
    if (frames.kind !== 'Frames') return frames;
    const labels = await labelsOf(summary);
    const valued = found.derivation.kind === 'Derived' && found.integrity.kind === 'Derived' ? await valueTrade(read, analysis, { factsAtClose: true }) : undefined;
    const entry: EligibleTrade = valued?.kind === 'Valued' ? { ...found, valuation: valued } : found;
    // The Review Date's Actions and, in the same snapshot, this Trade's earlier ones: its most recent is the overview's last Action (P168).
    const actions = await deps.journal.queryActions({ reviewDate, tradeId: analysis.tradeId });
    const { item, valuation } = reviewItem(entry, lastActionsOf(actions.earlier ?? []).get(analysis.tradeId));
    // Facts that cannot be replayed have no figures.
    const figures = valuation ? figuresOf(analysis, valuation) : {};
    const settlement = settlementItems([{ valuation }]);
    const payoff = entry.derivation.kind === 'Derived' ? payoffOf(analysis, entry.derivation) : undefined;
    // A254: the Trade's replay to the Review Date, the read session's date; the whole-lifetime derivation is the integrity one.
    const replayed = found.integrity.kind === 'Derived' && analysis.positionChanges.length > 0 ? await assembleReplay(deps, analysis, found.integrity, read, { withJournal: false }) : undefined;
    const replay = replayed && !('kind' in replayed) ? replayed : undefined;
    const saved = actions.actions[analysis.tradeId];
    // The Trade's Outstanding Debt, each classified against the closes around the Review Date (A63).
    const outstanding = await boundDebts(analysis.tradeId, request.binding);
    if (!outstanding) return { kind: 'ReviewChanged' };
    const reflections = await reflectionsOf(outstanding, analysis, { previousClose: frames.previousCloseInstant, close: cutoff });
    // The same counts the overview's walked item holds: this Trade's Review-date rows, its Outstanding Debt, and its Action.
    const held = new Set(observationNeeds([entry]).requirements.map((r) => instrumentKey(r.instrument)));
    const rows = frames.frames.filter((frame) => held.has(frame.instrumentKey));
    const needed = rows.filter((frame) => frame.resolution.kind === 'Missing').length;
    const due = reflections.filter((reflection) => reflection.classification === 'Due').length;
    const progress = cardProgress({ resolved: rows.length - needed, needed }, { due, later: reflections.length - due }, !saved, settlement.length > 0);
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
          lifecycle: summary.lifecycle,
          attention: item,
          labels,
          ...figures,
          settlement,
          ...(payoff && { payoff }),
          ...(replay && { replay }),
          reflections,
          progress,
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

  // `atRevision` is the Workspace content revision the card must be read at: only a post-save assembly names it,
  // since a trader's `getTrade` is valid after unrelated writes. A card settled at another revision is `Moved`.
  const readTrade = (request: GetDailyTradeReviewRequest, atRevision?: number) =>
    coherently<GetDailyTradeReviewResult | { readonly kind: 'Moved' }>(async () => {
      const pass = await assembleTrade(request);
      if (pass.kind === 'Expired') return { retry: true };
      if (pass.kind === 'Rejected' || pass.kind === 'ReviewChanged') return { done: pass };
      // The overview's Workspace is the one this read must be in; its content revision moves with every write.
      return {
        settle: ({ workspace }) => {
          if (workspace.databaseName !== request.binding.workspace.databaseName) return { kind: 'ReviewChanged' };
          if (atRevision !== undefined && workspace.contentRevision !== atRevision) return { kind: 'Moved' };
          if (pass.kind === 'ReflectionsOwed') return pass;
          return { kind: 'Ready', ...pass.review, trade: { ...pass.review.trade, saveBinding: { ...pass.review.trade.saveBinding, databaseName: workspace.databaseName } } };
        },
      };
    });

  const getTrade = (request: GetDailyTradeReviewRequest) => readTrade(request) as Promise<GetDailyTradeReviewResult>;

  // A post-save assembly is one revision: when a card settles at another revision than the overview, the
  // whole assembly is read again, bounded like every other (A46).
  async function atOneRevision<R>(assemble: () => Promise<R | undefined>): Promise<R | { readonly kind: 'ChangedDuringAssembly' }> {
    for (let i = 0; i < ASSEMBLY_ATTEMPTS; i++) {
      const result = await assemble();
      if (result !== undefined) return result;
    }
    return { kind: 'ChangedDuringAssembly' };
  }

  // The prompts of the Daily Trade Review definition, by the option each Action chooses.
  const ACTION_PROMPT = 'prompt.daily-trade-review.action';
  const INTENT_PROMPT = 'prompt.daily-trade-review.intent';
  const CONVICTION_PROMPT = 'prompt.daily-trade-review.conviction';
  const CONSIDERED_PROMPT = 'prompt.daily-trade-review.considered';
  const NOTE_PROMPT = 'prompt.daily-trade-review.note';

  // An optional Text answer: blank is unanswered, and the text is trimmed.
  const optionalText = (promptId: string, text: string | undefined) => (text === undefined || text.trim() === '' ? {} : { [promptId]: { kind: 'Text' as const, text: text.trim() } });

  // The Trade's facts and the Review-date evidence as they are now, against what the form was rendered from.
  type Checked = { readonly kind: 'Checked'; readonly cutoff: string; readonly evidenceBinding: EvidenceBinding } | Extract<SaveDailyReviewResult, { kind: 'ReviewChanged' | 'Rejected' }>;
  async function checkBinding(binding: TradeSaveBinding): Promise<Attempt<Checked>> {
    const session = await deps.marketData.query({ kind: 'ResolveSession', context: { kind: 'Review', reviewDate: binding.reviewDate } });
    if (session.kind === 'Rejected') return { done: session };
    if (session.kind !== 'Session') throw new Error(`unexpected session result: ${session.kind}`);
    // Its own read session, which reads the Review date's frames of every eligible Instrument and nothing else, so the keys it
    // binds are the ones the save has always rechecked; no Trade is valued, since the check takes no figure from one.
    const read = await deps.marketData.openReadSession({ kind: 'Review', reviewDate: binding.reviewDate });
    const eligible = await eligibleTrades(session.closeInstant, binding.reviewDate);
    if (!eligible) return { retry: true };
    const entry = eligible.find(({ analysis }) => analysis.tradeId === binding.tradeId);
    // The same frames as the overview's, so its snapshot is comparable.
    const frames = await reviewFrames(read, binding.reviewDate, [...observationNeeds(eligible).earliest.keys()]);
    if (frames.kind === 'Rejected') return { done: frames };
    const stale = entry?.analysis.factRevision !== binding.factRevision || frames.snapshotId !== binding.marketDataSnapshotId;
    const evidence = { marketDataSnapshotId: frames.snapshotId, frames: frames.frames, ...(entry && { factRevision: entry.analysis.factRevision }) };
    // Settled through `coherently`, so the Workspace is also the same before and after; the binding's Workspace is compared by database name.
    return {
      settle: ({ workspace }) =>
        stale || workspace.databaseName !== binding.databaseName
          ? { kind: 'ReviewChanged', evidence }
          : { kind: 'Checked', cutoff: session.closeInstant, evidenceBinding: frames.evidenceBinding },
    };
  }

  // A commit refused on a binding re-reads and re-validates, so the answer names what changed; bounded (ADR 0011).
  async function saveTradeAction(request: SaveTradeActionRequest): Promise<SaveDailyReviewResult> {
    for (let i = 0; i < ASSEMBLY_ATTEMPTS; i++) {
      const result = await attemptSave(request);
      if (result.kind !== 'Retry') return result;
    }
    return { kind: 'Conflict' };
  }

  async function attemptSave(request: SaveTradeActionRequest): Promise<SaveDailyReviewResult | { readonly kind: 'Retry' }> {
    const { binding } = request;
    const checked = await coherently(() => checkBinding(binding));
    if (checked.kind !== 'Checked') return checked;
    const prepared = await deps.journal.prepareEffects({
      obligation: 'DailyTradeReview',
      disposition: {
        kind: 'Complete',
        form: {
          definitionId: binding.definitionRevision,
          answers: {
            [ACTION_PROMPT]: { kind: 'Option', optionId: `option.daily-trade-review.action.${request.action.toLowerCase()}` },
            ...(request.intent === undefined ? {} : { [INTENT_PROMPT]: { kind: 'Text', text: request.intent } }),
            ...(request.conviction === undefined ? {} : { [CONVICTION_PROMPT]: { kind: 'Scale', value: request.conviction } }),
            ...optionalText(CONSIDERED_PROMPT, request.considered),
            ...optionalText(NOTE_PROMPT, request.note),
          },
        },
      },
      anchor: { kind: 'Trade', ref: binding.tradeId },
      origin: { kind: 'DailyReview', ref: binding.tradeId, reviewDate: binding.reviewDate },
      momentTime: checked.cutoff,
      ...(binding.expectedEntryRevision === undefined ? {} : { expectedEntryRevision: binding.expectedEntryRevision }),
    });
    if (prepared.kind === 'Rejected' || prepared.kind === 'Conflict') return prepared;
    const tx = beginSemanticTransaction();
    // The Trade the Action was judged against, rechecked in the commit.
    tx.require({ name: `trade:${binding.tradeId}`, store: 'trades', key: binding.tradeId, verify: (current) => current?.['factRevision'] === binding.factRevision });
    // The Review-date evidence, bound by Market Data.
    deps.marketData.bindEvidence(tx, checked.evidenceBinding);
    // Journal's applyPreparedEffects binds the shared counter (ADR 0011): when it alone moved, the save is read again.
    const applied = deps.journal.applyPreparedEffects(tx, prepared, {});
    const committed = await deps.persistence.commit(tx.close());
    if (committed.kind === 'Conflict') return { kind: 'Retry' };
    if (committed.kind !== 'Committed') throw new Error(`unexpected commit result: ${committed.kind}`);
    // The Action this commit wrote, built when the save was prepared; no read follows the commit.
    const action = applied.action!;
    // The Action is committed; a read that fails from here on only costs the next step, never the save.
    const review = await postSaveReview(binding.reviewDate, binding.tradeId).catch((): PostSaveReview => ({ kind: 'ChangedDuringAssembly' }));
    return { kind: 'Saved', action, review };
  }

  // The Review under the facts the save left, read like `open`. A Review that is no longer Ready
  // (the Trade left the eligible set) is for the trader to open afresh.
  // Review-date frames only, no recovery or gap scan (P38). `trades` is the walk in attention order.
  type ReadAfterSave = Omit<Extract<PostSaveReview, { kind: 'Ready' }>, 'nextStep' | 'cards'> & { readonly nextTask: NextTask; readonly trades: readonly WalkedTrade[]; readonly owed: readonly OwedReflectionsTrade[] };
  async function readAfterSave(reviewDate: string, from?: string) {
    return coherently<ReadAfterSave | Extract<PostSaveReview, { kind: 'ChangedDuringAssembly' }>>(async () => {
      const pass = await assemble({ kind: 'Review', reviewDate }, false, from);
      if (pass.kind === 'Expired') return { retry: true };
      // Nothing walked and no reflection due: a settled, complete Review with nothing left to ask, never an unstable read.
      if (pass.kind === 'Empty') {
        return { settle: (binding) => ({ kind: 'Ready', progress: { tradesWithAction: 0, tradesEligible: 0 }, completion: { kind: 'Complete' }, nextTask: { kind: 'Done' }, trades: [], owed: pass.owed, binding: { ...binding, ...pass.evidence } }) };
      }
      if (pass.kind !== 'Ready') return { done: { kind: 'ChangedDuringAssembly' } };
      const walk = pass.review.families.find((family) => family.family === 'Trades');
      return {
        settle: (binding) => ({
          kind: 'Ready',
          progress: pass.progress,
          completion: pass.review.completion,
          nextTask: pass.nextTask,
          trades: walk?.family === 'Trades' ? walk.trades : [],
          owed: pass.review.owed,
          binding: { ...binding, ...pass.evidence },
        }),
      };
    });
  }

  function postSaveReview(reviewDate: string, from?: string): Promise<PostSaveReview> {
    return atOneRevision<PostSaveReview>(async () => {
      const read = await readAfterSave(reviewDate, from);
      if (read.kind !== 'Ready') return read;
      const { nextTask } = read;
      // The Trade the save resolved: walked, or owing a reflection outside the walk. A Trade that is neither has just
      // answered its last reflection, so it has left the group and its card is done (A165, A90).
      const listed = [...read.trades, ...read.owed].filter((trade) => trade.tradeId === from).map(({ tradeId, progress }) => ({ tradeId, progress }));
      const cards = listed.length > 0 || from === undefined ? listed : [{ tradeId: from, progress: owedCardProgress({ due: 0, later: 0 }) }];
      const review = { kind: read.kind, progress: read.progress, completion: read.completion, binding: read.binding, cards };
      if (nextTask.kind !== 'Trade' && nextTask.kind !== 'OwedTrade') return { ...review, nextStep: nextTask };
      const next = await readTrade({ reviewDate, tradeId: nextTask.tradeId, binding: read.binding }, read.binding.workspace.contentRevision);
      if (next.kind === 'Moved') return undefined;
      if (next.kind === 'ReflectionsOwed') return { ...review, nextStep: { kind: 'OwedTrade', card: next.card } };
      if (next.kind !== 'Ready') return { kind: 'ChangedDuringAssembly' };
      return { ...review, nextStep: { kind: 'Trade', trade: next.trade } };
    });
  }

  // The Review under the Marks a save left, in its new order, with the card of its first Trade (P38, A155, A303).
  function postMarksReview(reviewDate: string): Promise<PostMarksReview> {
    return atOneRevision<PostMarksReview>(async () => {
      const read = await readAfterSave(reviewDate);
      if (read.kind !== 'Ready') return read;
      // Nothing is walked: there is no card to refresh, and the caller reads the Review again.
      const tradeId = read.trades[0]?.tradeId;
      if (tradeId === undefined) return { kind: 'ChangedDuringAssembly' };
      const revision = read.binding.workspace.contentRevision;
      const card = await readTrade({ reviewDate, tradeId, binding: read.binding }, revision);
      if (card.kind === 'Moved') return undefined;
      if (card.kind !== 'Ready') return { kind: 'ChangedDuringAssembly' };
      const { nextTask } = read;
      const review = { kind: read.kind, progress: read.progress, completion: read.completion, binding: read.binding, trades: read.trades, trade: card.trade };
      if (nextTask.kind === 'Done') return { ...review, nextStep: nextTask };
      if (nextTask.kind === 'OwedTrade') {
        const owed = await readTrade({ reviewDate, tradeId: nextTask.tradeId, binding: read.binding }, revision);
        if (owed.kind === 'Moved') return undefined;
        if (owed.kind !== 'ReflectionsOwed') return { kind: 'ChangedDuringAssembly' };
        return { ...review, nextStep: { kind: 'OwedTrade', card: owed.card } };
      }
      // A Missing Mark is shown on the first card of the walk that holds its Instrument (P36).
      const nextId = nextTask.kind === 'Mark' ? read.trades.find(({ tradeId: id }) => nextTask.row.trades.includes(id))?.tradeId ?? tradeId : nextTask.tradeId;
      const next = nextId === tradeId ? card : await readTrade({ reviewDate, tradeId: nextId, binding: read.binding }, revision);
      if (next.kind === 'Moved') return undefined;
      if (next.kind !== 'Ready') return { kind: 'ChangedDuringAssembly' };
      return { ...review, nextStep: nextTask.kind === 'Mark' ? { kind: 'Mark', row: nextTask.row, trade: next.trade } : { kind: 'Trade', trade: next.trade } };
    });
  }

  // The Debt's resolution is prepared with Source Daily Review and staged in this coordinator's own commit (A64).
  async function resolveReviewDebt(request: ResolveReviewDebtRequest): Promise<SaveDailyReviewResult> {
    const { binding, resolution } = request;
    for (let i = 0; i < ASSEMBLY_ATTEMPTS; i++) {
      const prepared = await deps.journal.prepareEffects({
        obligation: 'ResolveDebt',
        debtId: binding.debtId,
        expectedDebtRevision: binding.debtRevision,
        resolution: resolution.kind === 'Answer' ? { kind: 'Answer', form: { definitionId: binding.definitionRevision, answers: resolution.answers } } : resolution,
      });
      if (prepared.kind !== 'Prepared') return prepared;
      const tx = beginSemanticTransaction();
      const applied = deps.journal.applyPreparedEffects(tx, prepared, {});
      const committed = await deps.persistence.commit(tx.close());
      // Only the Journal counter moved: prepare again, which reports a Debt resolved meanwhile.
      if (committed.kind === 'Conflict') continue;
      if (committed.kind !== 'Committed') throw new Error(`unexpected commit result: ${committed.kind}`);
      const [entry] = applied.entries;
      const [decline] = applied.declines;
      const review = await postSaveReview(request.reviewDate, applied.debts![0]!.anchor.tradeId).catch((): PostSaveReview => ({ kind: 'ChangedDuringAssembly' }));
      return { kind: 'DebtResolved', ...(entry && { entry }), ...(decline && { decline }), debt: applied.debts![0]!, review };
    }
    return { kind: 'ChangedDuringAssembly' };
  }

  // A correction of a Mark typed for the Review Date is a fix in the same Review: it carries the fixed reason, never one asked of the trader (A303).
  // The Review Date's frames are read only when such a correction is in the request.
  async function withSameReviewFixes(reviewDate: string, entries: readonly MarketDataPrepareEntry[]): Promise<readonly MarketDataPrepareEntry[]> {
    const corrections = entries.filter(({ key, intention }) => intention.kind === 'CorrectMark' && key.tradingDate === reviewDate);
    if (corrections.length === 0) return entries;
    const found = await deps.marketData.query({ kind: 'ResolveFrames', context: { kind: 'Review', reviewDate }, instruments: corrections.map(({ key }) => key.instrumentKey) });
    if (found.kind !== 'Frames') return entries;
    const typed = new Set(found.frames.filter(({ resolution }) => resolution.kind === 'Available' && resolution.mark.source === 'Manual').map(({ instrumentKey }) => instrumentKey));
    return entries.map((entry) =>
      entry.intention.kind === 'CorrectMark' && entry.key.tradingDate === reviewDate && typed.has(entry.key.instrumentKey)
        ? { ...entry, intention: { ...entry.intention, reason: SAME_REVIEW_FIX } }
        : entry,
    );
  }

  // The Marks are prepared by Market Data and staged in this coordinator's own commit (A155). A Conflict is
  // reported, never retried: Market Data has no shared counter to wait out (ADR 0011).
  async function saveReviewMarks(request: SaveReviewMarksRequest): Promise<SaveReviewMarksResult> {
    // Only the Workspace is bound: a request from another Workspace never writes here. The keys and the
    // content revision are not compared, since Market Data's per-key revision checks own them.
    const { workspace } = await currentBinding();
    if (workspace.databaseName !== request.binding.workspace.databaseName) return { kind: 'ReviewChanged' };
    const entries = await withSameReviewFixes(request.reviewDate, request.entries);
    const prepared = await deps.marketData.prepareEffects({ entries });
    if (prepared.kind !== 'Prepared') return prepared;
    const tx = beginSemanticTransaction();
    deps.marketData.applyPreparedEffects(tx, prepared);
    const committed = await deps.persistence.commit(tx.close());
    if (committed.kind === 'RuntimeNotWritable') return committed;
    if (committed.kind === 'Conflict') {
      // A key moved after preparation: prepare again to name which.
      const again = await deps.marketData.prepareEffects({ entries });
      return again.kind === 'Prepared' ? { kind: 'Conflict', keys: [] } : again;
    }
    if (committed.kind !== 'Committed') throw new Error(`unexpected commit result: ${committed.kind}`);
    const marks = prepared.entries.map(({ key, resolution, resolutionRevision, classification }): SavedMark => ({ key, resolution, resolutionRevision, classification }));
    // The Marks are committed; a read that fails from here on only costs the refreshed Review, never the save.
    const review = await postMarksReview(request.reviewDate).catch((): PostMarksReview => ({ kind: 'ChangedDuringAssembly' }));
    return { kind: 'MarksSaved', marks, review };
  }

  // The overloads (see the interface) narrow the result by request kind; the body answers the widest.
  function save(request: SaveTradeActionRequest | ResolveReviewDebtRequest): Promise<SaveDailyReviewResult>;
  function save(request: SaveDailyReviewRequest): Promise<SaveReviewMarksResult>;
  function save(request: SaveDailyReviewRequest): Promise<SaveReviewMarksResult> {
    return deps.guard.run('DailyReview.save', () => {
      if (request.kind === 'ResolveReviewDebt') return resolveReviewDebt(request);
      return request.kind === 'SaveReviewMarks' ? saveReviewMarks(request) : saveTradeAction(request);
    });
  }

  return {
    save,

    // A Review is accepted only if the Workspace is unchanged across its assembly (A46).
    open: (request) =>
      coherently<OpenDailyReviewResult>(async () => {
        const pass = await assemble({ kind: 'Current', asOf: request.asOf }, true, undefined, true);
        if (pass.kind === 'Expired') return { retry: true };
        if (pass.kind === 'Empty') {
          const { reviewDate, cutoff, owed, evidence } = pass;
          return { settle: (binding) => ({ kind: 'Empty', reviewDate, cutoff, owed, binding: { ...binding, ...evidence } }) };
        }
        if (pass.kind !== 'Ready') return { done: pass };
        return { settle: (binding) => ({ kind: 'Ready', ...pass.review, binding: { ...binding, ...pass.evidence } }) };
      }),

    getTrade,
  };
}
