import {
  formatSessionDateShort,
  getExchangeDateForInstant,
} from '../market-data/session-calendar';
import type { DeviationRecord, ExecutionRecord, JournalEntryRecord } from '../persistence/idb';
import {
  add,
  cmp,
  div,
  ExactNumber,
  formatQuantityString,
  fromDecimalString,
  fromInteger,
  isNegative,
  isPositive,
  mul,
  neg,
  sub,
  toDecimalString,
  toMoneyString,
  toRatioString,
  type Rational,
  type SerializedRational,
} from '../shared/exact-number';
import { deriveLongStockPosition } from './derive';

export interface StopDisciplineEpisode {
  readonly episodeFingerprint: string;
  readonly startSessionDate: string;
  readonly endSessionDate: string;
  readonly sessionCount: number;
  readonly maxOverrunDollars: Rational;
  readonly maxOverrunDisplay: string;
  readonly message: string;
}

/**
 * Pure TradeAnalysis.replay reconciler for continuous Stop-Discipline episodes (AC-REV-004).
 * Groups consecutive sessions where the Trader held (`Hold` Review Action) while the Trade was
 * open at cutoff and its effective close Mark was at or below Stop into ONE Deviation episode.
 * Recovering above Stop or choosing Exit/closing ends or removes the episode cleanly.
 */
export function reconcileStopDisciplineEpisodes(input: {
  readonly tradeId: string;
  readonly stopPrice: SerializedRational;
  readonly executions: readonly ExecutionRecord[];
  readonly effectiveMarks: readonly {
    readonly sessionDate: string;
    readonly price: SerializedRational;
  }[];
  readonly reviewActions: readonly {
    readonly reviewDate: string;
    readonly action: 'Hold' | 'Exit';
  }[];
}): readonly StopDisciplineEpisode[] {
  const stopPrice = ExactNumber.fromJSON(input.stopPrice);
  const markByDate = new Map(input.effectiveMarks.map((m) => [m.sessionDate, m]));
  const actionByDate = new Map(input.reviewActions.map((a) => [a.reviewDate, a.action]));

  const sortedExecs = [...input.executions].sort((a, b) => {
    const byTime = a.economicTime.localeCompare(b.economicTime);
    return byTime !== 0 ? byTime : a.recordedSequence - b.recordedSequence;
  });

  const dummyPlan = {
    plannedQuantity: ExactNumber.toJSON(ExactNumber.fromInteger(1)),
    intendedEntryPrice: input.stopPrice,
    stopPrice: input.stopPrice,
    targetPrice: input.stopPrice,
  };

  const sortedDates = [...new Set([...markByDate.keys(), ...actionByDate.keys()])].sort();

  const episodes: StopDisciplineEpisode[] = [];
  let activeStart: string | null = null;
  let activeEnd: string | null = null;
  let activeCount = 0;
  let activeMaxOverrun: Rational | null = null;

  const flush = () => {
    if (activeStart && activeEnd && activeMaxOverrun !== null) {
      const display = toMoneyString(activeMaxOverrun, true);
      episodes.push({
        episodeFingerprint: `${input.tradeId}::stop::${activeStart}`,
        startSessionDate: activeStart,
        endSessionDate: activeEnd,
        sessionCount: activeCount,
        maxOverrunDollars: activeMaxOverrun,
        maxOverrunDisplay: display,
        message:
          activeCount === 1
            ? `Held past Stop on ${activeStart} (overrun ${display}).`
            : `Held past Stop for ${activeCount} consecutive sessions (${activeStart} to ${activeEnd}, max overrun ${display}).`,
      });
    }
    activeStart = null;
    activeEnd = null;
    activeCount = 0;
    activeMaxOverrun = null;
  };

  for (const sessionDate of sortedDates) {
    const execsAsOf = sortedExecs.filter(
      (ex) => getExchangeDateForInstant(new Date(ex.economicTime)) <= sessionDate,
    );
    if (execsAsOf.length === 0) {
      flush();
      continue;
    }

    const derived = deriveLongStockPosition({
      storedLifecycleState: 'Open',
      plan: dummyPlan,
      executions: execsAsOf,
    });
    if (!isPositive(derived.openShares)) {
      flush();
      continue;
    }

    const mark = markByDate.get(sessionDate);
    const action = actionByDate.get(sessionDate);
    if (mark) {
      const markPrice = ExactNumber.fromJSON(mark.price);
      if (cmp(markPrice, stopPrice) > 0) {
        // Mark recovered above Stop: ends any active breach episode regardless of whether reviewed
        flush();
        continue;
      }
    }
    if (!action) {
      // An unreviewed session (no Daily Review Action) ends a consecutive Hold-past-Stop streak
      flush();
      continue;
    }
    if (!mark) {
      if (action === 'Exit') flush();
      continue;
    }

    const markPrice = ExactNumber.fromJSON(mark.price);
    const breached = cmp(markPrice, stopPrice) <= 0;

    if (breached && action === 'Hold') {
      // Negative overrun relative to Stop = (markPrice - stopPrice) * openShares (<= 0)
      const overrun = mul(sub(markPrice, stopPrice), derived.openShares);
      if (!activeStart) {
        activeStart = sessionDate;
        activeEnd = sessionDate;
        activeCount = 1;
        activeMaxOverrun = overrun;
      } else {
        activeEnd = sessionDate;
        activeCount += 1;
        if (activeMaxOverrun === null || cmp(overrun, activeMaxOverrun) < 0) {
          activeMaxOverrun = overrun;
        }
      }
    } else {
      flush();
    }
  }

  flush();
  return episodes;
}

export interface ReplayExtractedReviewAction {
  readonly reviewDate: string;
  readonly action: 'Hold' | 'Exit';
  readonly reason: string | null;
  readonly conviction: number | null;
  readonly recordedAt: string;
}

export function extractReplayReviewActions(
  entries: readonly JournalEntryRecord[],
  entryTypeId: string,
): readonly ReplayExtractedReviewAction[] {
  const result: ReplayExtractedReviewAction[] = [];
  for (const e of entries) {
    if (e.entryTypeId !== entryTypeId) continue;
    let reviewDate: string | null = null;
    if (e.origin.kind === 'DailyReview') {
      reviewDate = e.origin.reviewDate;
    } else if (e.obligationKey) {
      const parts = e.obligationKey.split(':');
      const last = parts[parts.length - 1];
      if (last && /^\d{4}-\d{2}-\d{2}$/.test(last)) reviewDate = last;
    }
    const action =
      e.responses.action === 'Exit' ? 'Exit' : e.responses.action === 'Hold' ? 'Hold' : null;
    if (reviewDate && action) {
      result.push({
        reviewDate,
        action,
        reason:
          typeof e.responses.reason === 'string' && e.responses.reason.trim()
            ? e.responses.reason.trim()
            : null,
        conviction: typeof e.responses.conviction === 'number' ? e.responses.conviction : null,
        recordedAt: e.recordedAt,
      });
    }
  }
  return result;
}

export function extractDailyReviewActions(
  entries: readonly JournalEntryRecord[],
  entryTypeId: string,
): readonly { readonly reviewDate: string; readonly action: 'Hold' | 'Exit' }[] {
  return extractReplayReviewActions(entries, entryTypeId).map(({ reviewDate, action }) => ({
    reviewDate,
    action,
  }));
}

/**
 * Pure helper to diff reconciled Stop-Discipline episodes against existing DeviationRecords,
 * producing exact put records (updates/inserts + voids) for atomic persistence in any coordinator.
 */
export function diffStopDisciplineDeviationRecords(input: {
  readonly tradeId: string;
  readonly stopPrice: SerializedRational;
  readonly executions: readonly ExecutionRecord[];
  readonly effectiveMarks: readonly {
    readonly sessionDate: string;
    readonly price: SerializedRational;
  }[];
  readonly reviewActions: readonly {
    readonly reviewDate: string;
    readonly action: 'Hold' | 'Exit';
  }[];
  readonly existingDeviations: readonly DeviationRecord[];
  readonly nowIso: string;
  readonly generateId: (prefix: string) => string;
}): readonly DeviationRecord[] {
  const desiredEpisodes = reconcileStopDisciplineEpisodes({
    tradeId: input.tradeId,
    stopPrice: input.stopPrice,
    executions: input.executions,
    effectiveMarks: input.effectiveMarks,
    reviewActions: input.reviewActions,
  });

  const existingStopDevs = input.existingDeviations.filter((d) => d.kind === 'StopDiscipline');
  const existingByFingerprint = new Map(
    existingStopDevs
      .filter((d) => d.episodeFingerprint)
      .map((d) => [d.episodeFingerprint!, d]),
  );
  const desiredFingerprints = new Set(desiredEpisodes.map((e) => e.episodeFingerprint));
  const writes: DeviationRecord[] = [];

  for (const ep of desiredEpisodes) {
    const prev = existingByFingerprint.get(ep.episodeFingerprint);
    if (
      prev &&
      !prev.voided &&
      prev.startSessionDate === ep.startSessionDate &&
      prev.endSessionDate === ep.endSessionDate &&
      prev.sessionCount === ep.sessionCount &&
      prev.maxOverrunDisplay === ep.maxOverrunDisplay &&
      prev.message === ep.message
    ) {
      continue;
    }
    writes.push({
      id: prev?.id ?? input.generateId('dev'),
      tradeId: input.tradeId,
      kind: 'StopDiscipline',
      episodeFingerprint: ep.episodeFingerprint,
      startSessionDate: ep.startSessionDate,
      endSessionDate: ep.endSessionDate,
      sessionCount: ep.sessionCount,
      maxOverrunDisplay: ep.maxOverrunDisplay,
      message: ep.message,
      voided: false,
      recordedAt: prev?.recordedAt ?? input.nowIso,
    });
  }
  for (const oldDev of existingStopDevs) {
    const staleOrMissingFp =
      !oldDev.episodeFingerprint || !desiredFingerprints.has(oldDev.episodeFingerprint);
    if (staleOrMissingFp && !oldDev.voided) {
      writes.push({ ...oldDev, voided: true });
    }
  }
  return writes;
}

export interface ReplayExecutionEvent {
  readonly id: string;
  readonly side: 'Buy' | 'Sell';
  readonly quantity: Rational;
  readonly quantityDisplay: string;
  readonly fillPrice: Rational;
  readonly fillPriceDisplay: string;
  readonly fee: Rational;
  readonly feeDisplay: string;
  readonly economicTime: string;
}

export type ReplayReviewActionState =
  | {
      readonly kind: 'Hold' | 'Exit';
      readonly reason: string | null;
      readonly conviction: number | null;
    }
  | { readonly kind: 'NoReview' | 'Pending' | 'Closed' };

export type ReplayStanding =
  | 'PastStop'
  | 'AtTarget'
  | 'InsideStop'
  | 'InsideTarget'
  | 'Closed'
  | 'Oversold'
  | 'Unmarked';

export interface ReplaySessionPoint {
  readonly index: number;
  readonly sessionDate: string;
  readonly sessionDateShort: string;
  readonly hasEntered: boolean;
  readonly inProgress: boolean;
  readonly mark: Rational | null;
  readonly markDisplay: string | null;
  readonly missingMark: boolean;
  readonly unavailableAcknowledged: boolean;
  readonly executionsToday: readonly ReplayExecutionEvent[];
  readonly openShares: Rational;
  readonly openSharesDisplay: string;
  readonly isClosed: boolean;
  readonly realizedPnl: Rational;
  readonly realizedPnlDisplay: string;
  readonly openPnl: Rational | null;
  readonly openPnlDisplay: string | null;
  readonly totalPnl: Rational | null;
  readonly totalPnlDisplay: string | null;
  readonly totalPnlR: Rational | null;
  readonly totalPnlRDisplay: string | null;
  readonly bankedPart: Rational;
  readonly changeSincePriorPnl: Rational | null;
  readonly changeSincePriorPnlDisplay: string | null;
  readonly priorMarkedSessionDate: string | null;
  readonly priorMarkedSessionDateShort: string | null;
  readonly atStopPnl: Rational | null;
  readonly atStopPnlDisplay: string | null;
  readonly atTargetPnl: Rational | null;
  readonly atTargetPnlDisplay: string | null;
  readonly stopStatus: 'Active' | 'Breached' | 'Closed' | 'Unavailable';
  readonly targetStatus: 'Active' | 'Reached' | 'Closed' | 'Unavailable';
  readonly riskToStop: Rational | null;
  readonly riskToStopDisplay: string | null;
  readonly stopOverrun: Rational | null;
  readonly stopOverrunDisplay: string | null;
  readonly rewardToTarget: Rational | null;
  readonly rewardToTargetDisplay: string | null;
  readonly targetOverrun: Rational | null;
  readonly targetOverrunDisplay: string | null;
  readonly standing: ReplayStanding;
  readonly standingPct: number | null;
  readonly reviewAction: ReplayReviewActionState;
  readonly actionCode: 'H' | 'E' | '–' | '';
}

export type ReplayMomentKind = 'Entry' | 'Low' | 'Stop' | 'Target' | 'High' | 'Sale' | 'Buy' | 'Now' | 'End';

export interface ReplayKeyMoment {
  readonly sessionIndex: number;
  readonly sessionDate: string;
  readonly sessionDateShort: string;
  readonly kinds: readonly ReplayMomentKind[];
  readonly label: string;
  readonly text: string;
}

export interface LongStockReplayInput {
  readonly tradeId: string;
  readonly symbol: string;
  readonly sessions: readonly string[];
  readonly reviewDate?: string;
  readonly inProgressSessionDate?: string;
  readonly plan: {
    readonly plannedQuantity: SerializedRational;
    readonly intendedEntryPrice: SerializedRational;
    readonly stopPrice: SerializedRational;
    readonly targetPrice: SerializedRational;
  };
  readonly originalPlannedRisk: SerializedRational;
  readonly originalPlannedReward?: SerializedRational;
  readonly executions: readonly ExecutionRecord[];
  readonly effectiveMarks: readonly {
    readonly sessionDate: string;
    readonly price: SerializedRational;
  }[];
  readonly acknowledgedUnavailableDates?: readonly string[];
  readonly reviewActions?: readonly {
    readonly reviewDate: string;
    readonly action: 'Hold' | 'Exit';
    readonly reason?: string | null;
    readonly conviction?: number | null;
    readonly recordedAt?: string;
  }[];
}

/**
 * Shared input assembler for `replayLongStockTrade`, ensuring Daily Review and Trade Views
 * apply identical cutoff filtering, Mark/Ack projections, and session bounds.
 */
export function assembleLongStockReplayInput(params: {
  readonly tradeId: string;
  readonly symbol: string;
  readonly plan: LongStockReplayInput['plan'];
  readonly originalPlannedRisk: SerializedRational;
  readonly originalPlannedReward?: SerializedRational;
  readonly sortedExecutions: readonly ExecutionRecord[];
  readonly sessions: readonly string[];
  readonly cutoffDate: string;
  readonly inProgressSessionDate?: string;
  readonly effectiveMarks: readonly {
    readonly sessionDate: string;
    readonly price: SerializedRational;
  }[];
  readonly acknowledgedUnavailableDates: readonly string[];
  readonly reviewActions: readonly ReplayExtractedReviewAction[];
}): LongStockReplayInput {
  const firstExecDate = getExchangeDateForInstant(
    new Date(params.sortedExecutions[0]!.economicTime),
  );
  return {
    tradeId: params.tradeId,
    symbol: params.symbol,
    sessions: params.sessions.length > 0 ? params.sessions : [firstExecDate],
    reviewDate: params.cutoffDate,
    ...(params.inProgressSessionDate ? { inProgressSessionDate: params.inProgressSessionDate } : {}),
    plan: params.plan,
    originalPlannedRisk: params.originalPlannedRisk,
    originalPlannedReward: params.originalPlannedReward,
    executions: params.sortedExecutions,
    effectiveMarks: params.effectiveMarks.filter((m) => m.sessionDate <= params.cutoffDate),
    acknowledgedUnavailableDates: params.acknowledgedUnavailableDates.filter(
      (d) => d <= params.cutoffDate,
    ),
    reviewActions: params.reviewActions.filter((a) => a.reviewDate <= params.cutoffDate),
  };
}

export interface LongStockReplayModel {
  readonly tradeId: string;
  readonly symbol: string;
  readonly isClosed: boolean;
  readonly plannedQuantityDisplay: string;
  readonly intendedEntryPrice: Rational;
  readonly intendedEntryDisplay: string;
  readonly stopPrice: Rational;
  readonly stopPriceDisplay: string;
  readonly targetPrice: Rational;
  readonly targetPriceDisplay: string;
  readonly oneR: Rational;
  readonly oneRDisplay: string;
  readonly planRails: {
    readonly stop: Rational;
    readonly target: Rational;
  };
  readonly sessions: readonly ReplaySessionPoint[];
  readonly keyMoments: readonly ReplayKeyMoment[];
  readonly initialSelectedIndex: number;
  readonly summaryLine: string;
  readonly highlightPrimary: boolean;
  readonly stopDisciplineEpisodes: readonly StopDisciplineEpisode[];
  readonly missingMarkCount: number;
}

function clampStandingPct(part: Rational, whole: Rational): number {
  if (!isPositive(whole)) return 0;
  const raw = Number(toDecimalString(div(part, whole), 4));
  return Math.max(0, Math.min(99, Math.round(raw * 100)));
}

function computeBankedPart(realizedPnl: Rational, totalPnl: Rational | null): Rational {
  if (totalPnl === null) return fromInteger(0);
  if (isPositive(realizedPnl) && isPositive(totalPnl)) {
    return cmp(realizedPnl, totalPnl) <= 0 ? realizedPnl : totalPnl;
  }
  if (isNegative(realizedPnl) && isNegative(totalPnl)) {
    return cmp(realizedPnl, totalPnl) >= 0 ? realizedPnl : totalPnl;
  }
  return fromInteger(0);
}

function buildNowSentence(point: ReplaySessionPoint): string {
  if (!point.hasEntered) {
    return 'Not entered yet.';
  }
  if (point.standing === 'Oversold') {
    return 'Position oversold (derived integrity block).';
  }
  if (point.inProgress) {
    return "Session still open — waiting for today's close.";
  }
  if (point.totalPnl === null || !point.totalPnlDisplay) {
    return 'A Mark is missing.';
  }
  const rPart = point.totalPnlRDisplay ? ` (${point.totalPnlRDisplay})` : '';
  let statusClause = '';
  if (point.standing === 'PastStop') {
    statusClause =
      point.stopOverrun && isPositive(point.stopOverrun)
        ? `, past the Stop by ${point.stopOverrunDisplay}`
        : ', at the Stop';
  } else if (point.standing === 'AtTarget') {
    statusClause =
      point.targetOverrun && isPositive(point.targetOverrun)
        ? `, past the Target by ${point.targetOverrunDisplay}`
        : ', at the Target';
  } else if (point.standing === 'InsideStop' && point.standingPct !== null) {
    statusClause = `, ${point.standingPct}% of the way to the Stop`;
  } else if (point.standing === 'InsideTarget' && point.standingPct !== null) {
    statusClause = `, ${point.standingPct}% of the way to the Target`;
  }
  let text = `P&L ${point.totalPnlDisplay}${rPart}${statusClause}.`;
  if (point.realizedPnl.num !== 0n && point.openPnlDisplay) {
    text += ` Realized ${point.realizedPnlDisplay}, open ${point.openPnlDisplay}.`;
  }
  if (
    point.changeSincePriorPnl !== null &&
    point.priorMarkedSessionDateShort
  ) {
    let dir = 'Unchanged';
    if (isPositive(point.changeSincePriorPnl)) {
      dir = `Up ${toMoneyString(point.changeSincePriorPnl)}`;
    } else if (isNegative(point.changeSincePriorPnl)) {
      dir = `Down ${toMoneyString(neg(point.changeSincePriorPnl))}`;
    }
    text += ` ${dir} since ${point.priorMarkedSessionDateShort}.`;
  }
  return text;
}

interface ExecWithDate {
  readonly exec: ExecutionRecord;
  readonly sessionDate: string;
}

function buildReplayKeyMoments(params: {
  readonly symbol: string;
  readonly sessions: readonly ReplaySessionPoint[];
  readonly execsWithDates: readonly ExecWithDate[];
  readonly stopPrice: Rational;
  readonly stopPriceDisplay: string;
  readonly targetPrice: Rational;
  readonly targetPriceDisplay: string;
  readonly oneR: Rational;
  readonly isClosed: boolean;
}): {
  readonly keyMoments: readonly ReplayKeyMoment[];
} {
  const {
    symbol,
    sessions,
    execsWithDates,
    stopPrice,
    stopPriceDisplay,
    targetPrice,
    targetPriceDisplay,
    oneR,
    isClosed,
  } = params;
  const endIndex = sessions.length - 1;
  const sessionIndexByDate = new Map(sessions.map((s) => [s.sessionDate, s.index]));
  const buckets = new Map<number, { kinds: ReplayMomentKind[]; texts: string[] }>();

  const addMoment = (idx: number, kind: ReplayMomentKind, text: string) => {
    const existing = buckets.get(idx);
    if (!existing) {
      buckets.set(idx, { kinds: [kind], texts: [text] });
      return;
    }
    if (!existing.kinds.includes(kind)) {
      existing.kinds.push(kind);
    }
    existing.texts.push(text);
  };

  const first = execsWithDates[0]!;
  const firstQty = formatQuantityString(ExactNumber.fromJSON(first.exec.quantity));
  const firstPrice = toMoneyString(ExactNumber.fromJSON(first.exec.fillPrice));
  const firstIdx = sessionIndexByDate.get(first.sessionDate) ?? 0;
  addMoment(
    firstIdx,
    'Entry',
    `Bought ${firstQty} ${firstQty === '1' ? 'share' : 'shares'} at ${firstPrice}. Out if ${symbol} at or below ${stopPriceDisplay}. Target: ${symbol} at or above ${targetPriceDisplay}.`,
  );

  const endPoint = sessions[endIndex]!;
  const endRes = endPoint.totalPnl;

  let loVal = fromInteger(0);
  let loIdx: number | null = null;
  let hiVal = fromInteger(0);
  let hiIdx: number | null = null;
  for (let i = 0; i < endIndex; i += 1) {
    const v = sessions[i]!.totalPnl;
    if (v === null) continue;
    if (cmp(v, loVal) < 0) {
      loVal = v;
      loIdx = i;
    }
    if (cmp(v, hiVal) > 0) {
      hiVal = v;
      hiIdx = i;
    }
  }
  if (!isClosed && endRes !== null && loIdx !== null && cmp(endRes, loVal) <= 0) {
    loIdx = null;
  }
  if (loIdx !== null) {
    const loR = isPositive(oneR) ? ` (${toRatioString(div(loVal, oneR), true)})` : '';
    addMoment(loIdx, 'Low', `The worst session: ${toMoneyString(loVal, true)}${loR}.`);
  }

  let firstStopIndex: number | null = null;
  let firstTargetIndex: number | null = null;
  for (const s of sessions) {
    if (
      firstStopIndex === null &&
      (s.stopStatus === 'Breached' ||
        (isClosed &&
          s.index === endIndex &&
          s.mark !== null &&
          cmp(s.mark, stopPrice) <= 0 &&
          execsWithDates.some((e) => e.sessionDate === s.sessionDate)))
    ) {
      firstStopIndex = s.index;
    }
    if (
      firstTargetIndex === null &&
      (s.targetStatus === 'Reached' ||
        (isClosed &&
          s.index === endIndex &&
          s.mark !== null &&
          cmp(s.mark, targetPrice) >= 0 &&
          execsWithDates.some((e) => e.sessionDate === s.sessionDate)))
    ) {
      firstTargetIndex = s.index;
    }
  }
  if (firstStopIndex !== null) {
    addMoment(firstStopIndex, 'Stop', 'First session past the Stop.');
  }
  if (firstTargetIndex !== null) {
    addMoment(firstTargetIndex, 'Target', 'Target first reached.');
  }

  const quarterR = mul(oneR, fromDecimalString('0.25'));
  if (hiIdx !== null && endRes !== null && cmp(hiVal, add(endRes, quarterR)) > 0) {
    const drop = toMoneyString(sub(hiVal, endRes));
    addMoment(
      hiIdx,
      'High',
      `The best session: ${toMoneyString(hiVal, true)}. ${isClosed ? 'It ended' : 'It is now'} ${drop} lower.`,
    );
  }

  for (const { exec, sessionDate } of execsWithDates.slice(1)) {
    const idx = sessionIndexByDate.get(sessionDate);
    if (idx === undefined) continue;
    if (idx === endIndex && isClosed && exec.side === 'Sell') continue;
    const qty = formatQuantityString(ExactNumber.fromJSON(exec.quantity));
    const price = toMoneyString(ExactNumber.fromJSON(exec.fillPrice));
    addMoment(
      idx,
      exec.side === 'Sell' ? 'Sale' : 'Buy',
      `${exec.side === 'Sell' ? 'Sold' : 'Bought'} ${qty} ${qty === '1' ? 'share' : 'shares'} at ${price}.`,
    );
  }

  if (!isClosed) {
    addMoment(endIndex, 'Now', buildNowSentence(endPoint));
  } else {
    const endDaySells = execsWithDates
      .filter(({ exec, sessionDate }) => exec.side === 'Sell' && sessionIndexByDate.get(sessionDate) === endIndex)
      .map(({ exec }) => exec);
    const resStr = endPoint.totalPnlDisplay ?? '$0.00';
    const resR = endPoint.totalPnlRDisplay ? ` (${endPoint.totalPnlRDisplay})` : '';
    if (endDaySells.length > 1) {
      const parts = endDaySells.map((ex) => {
        const q = formatQuantityString(ExactNumber.fromJSON(ex.quantity));
        const p = toMoneyString(ExactNumber.fromJSON(ex.fillPrice));
        return `${q} at ${p}`;
      });
      addMoment(endIndex, 'End', `Sold ${parts.join(', ')}. Result ${resStr}${resR}.`);
    } else {
      const closingSell =
        endDaySells[0] ??
        [...execsWithDates].reverse().find(({ exec }) => exec.side === 'Sell')?.exec ??
        null;
      if (closingSell) {
        const lastQty = formatQuantityString(ExactNumber.fromJSON(closingSell.quantity));
        const lastPrice = toMoneyString(ExactNumber.fromJSON(closingSell.fillPrice));
        addMoment(endIndex, 'End', `Sold the last ${lastQty} at ${lastPrice}. Result ${resStr}${resR}.`);
      } else {
        addMoment(endIndex, 'End', `Closed. Result ${resStr}${resR}.`);
      }
    }
  }

  const keyMoments: ReplayKeyMoment[] = [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([idx, entry]) => {
      const s = sessions[idx]!;
      return {
        sessionIndex: idx,
        sessionDate: s.sessionDate,
        sessionDateShort: s.sessionDateShort,
        kinds: entry.kinds,
        label: entry.kinds.join(' + '),
        text: entry.texts.join(' '),
      };
    });

  return { keyMoments };
}

function findTrailingStandingRun(
  sessions: readonly ReplaySessionPoint[],
  kind: 'PastStop' | 'AtTarget',
): { readonly runStartIdx: number; readonly streak: number } {
  const endIdx = sessions.length - 1;
  let runStartIdx = endIdx;
  let streak = 0;
  for (let i = endIdx; i >= 0; i -= 1) {
    const s = sessions[i]!;
    if (s.missingMark || s.standing !== kind) {
      break;
    }
    runStartIdx = i;
    streak += 1;
  }
  return { runStartIdx, streak };
}

function buildReplaySummary(params: {
  readonly sessions: readonly ReplaySessionPoint[];
  readonly isClosed: boolean;
}): { readonly summaryLine: string; readonly highlightPrimary: boolean } {
  const { sessions, isClosed } = params;
  const count = sessions.length;
  const sessionWord = count === 1 ? 'session' : 'sessions';

  if (isClosed) {
    let lo = fromInteger(0);
    let loDateShort: string | null = null;
    for (const s of sessions) {
      if (s.totalPnl !== null && cmp(s.totalPnl, lo) < 0) {
        lo = s.totalPnl;
        loDateShort = s.sessionDateShort;
      }
    }
    return {
      summaryLine: `${count} ${sessionWord} · ${loDateShort ? `low ${toMoneyString(lo, true)} on ${loDateShort}` : 'never under water'}. See the path.`,
      highlightPrimary: false,
    };
  }

  const endSession = sessions[count - 1]!;
  if (endSession.standing === 'PastStop') {
    const { runStartIdx, streak } = findTrailingStandingRun(sessions, 'PastStop');
    const startShort = sessions[runStartIdx]!.sessionDateShort;
    return {
      summaryLine: `Past the Stop since ${startShort} · ${streak} ${streak === 1 ? 'session' : 'sessions'}. See how it got here.`,
      highlightPrimary: true,
    };
  }

  if (endSession.standing === 'AtTarget') {
    const { runStartIdx } = findTrailingStandingRun(sessions, 'AtTarget');
    const firstReached = sessions.find((s) => s.targetStatus === 'Reached');
    const startShort = sessions[runStartIdx]!.sessionDateShort;
    const firstNote =
      firstReached && firstReached.index < runStartIdx
        ? ` · first reached ${firstReached.sessionDateShort}`
        : '';
    return {
      summaryLine: `At the Target since ${startShort}${firstNote}. See the run.`,
      highlightPrimary: true,
    };
  }

  if (endSession.missingMark) {
    const latestMarked = [...sessions].reverse().find((s) => s.mark !== null) ?? null;
    if (latestMarked) {
      return {
        summaryLine: `${count} ${sessionWord} · Mark missing for ${endSession.sessionDateShort} (latest Mark ${latestMarked.sessionDateShort}). See the path.`,
        highlightPrimary: false,
      };
    }
  }

  let lo = fromInteger(0);
  let hi = fromInteger(0);
  let anyMarked = false;
  for (const s of sessions) {
    if (s.totalPnl !== null) {
      anyMarked = true;
      if (cmp(s.totalPnl, lo) < 0) lo = s.totalPnl;
      if (cmp(s.totalPnl, hi) > 0) hi = s.totalPnl;
    }
  }
  return {
    summaryLine: anyMarked
      ? `${count} ${sessionWord} · low ${toMoneyString(lo, true)}, high ${toMoneyString(hi, true)}. See the path.`
      : `${count} ${sessionWord} · no Marks yet. See the path.`,
    highlightPrimary: false,
  };
}

/**
 * Pure TradeAnalysis.replay Corridor model over a caller-supplied completed-session lifetime.
 * Never selects dates, interpolates across missing Marks, or mutates durable state.
 */
export function replayLongStockTrade(input: LongStockReplayInput): LongStockReplayModel {
  if (input.sessions.length === 0 || input.executions.length === 0) {
    throw new Error('TradeAnalysis.replay requires at least one session and one execution.');
  }

  const plannedQty = ExactNumber.fromJSON(input.plan.plannedQuantity);
  const intendedEntryPrice = ExactNumber.fromJSON(input.plan.intendedEntryPrice);
  const stopPrice = ExactNumber.fromJSON(input.plan.stopPrice);
  const targetPrice = ExactNumber.fromJSON(input.plan.targetPrice);
  const oneR = ExactNumber.fromJSON(input.originalPlannedRisk);
  const plannedReward = input.originalPlannedReward
    ? ExactNumber.fromJSON(input.originalPlannedReward)
    : mul(sub(targetPrice, intendedEntryPrice), plannedQty);

  const sortedExecs = [...input.executions].sort((a, b) => {
    const byTime = a.economicTime.localeCompare(b.economicTime);
    return byTime !== 0 ? byTime : a.recordedSequence - b.recordedSequence;
  });
  const execsWithDates: readonly ExecWithDate[] = sortedExecs.map((exec) => ({
    exec,
    sessionDate: getExchangeDateForInstant(new Date(exec.economicTime)),
  }));

  const markByDate = new Map(input.effectiveMarks.map((m) => [m.sessionDate, m]));
  const ackSet = new Set(input.acknowledgedUnavailableDates ?? []);
  const sortedReviewActions = [...(input.reviewActions ?? [])].sort((a, b) => {
    const byRec = (a.recordedAt ?? '').localeCompare(b.recordedAt ?? '');
    if (byRec !== 0) return byRec;
    const byAct = a.action.localeCompare(b.action);
    if (byAct !== 0) return byAct;
    const byReason = (a.reason ?? '').localeCompare(b.reason ?? '');
    if (byReason !== 0) return byReason;
    return (a.conviction ?? -1) - (b.conviction ?? -1);
  });
  const actionByDate = new Map(sortedReviewActions.map((a) => [a.reviewDate, a]));
  const lastSessionDate = input.sessions[input.sessions.length - 1]!;
  const reviewCutoffDate = input.reviewDate ?? lastSessionDate;

  let priorMarked: {
    readonly sessionDate: string;
    readonly sessionDateShort: string;
    readonly totalPnl: Rational;
  } | null = null;

  const sessions: ReplaySessionPoint[] = input.sessions.map((sessionDate, index) => {
    const sessionDateShort = formatSessionDateShort(sessionDate);
    const execsAsOf: ExecutionRecord[] = [];
    const executionsToday: ReplayExecutionEvent[] = [];
    for (const item of execsWithDates) {
      if (item.sessionDate <= sessionDate) {
        execsAsOf.push(item.exec);
        if (item.sessionDate === sessionDate) {
          const ex = item.exec;
          const q = ExactNumber.fromJSON(ex.quantity);
          const p = ExactNumber.fromJSON(ex.fillPrice);
          const f = ExactNumber.fromJSON(ex.fee);
          executionsToday.push({
            id: ex.id,
            side: ex.side,
            quantity: q,
            quantityDisplay: formatQuantityString(q),
            fillPrice: p,
            fillPriceDisplay: toMoneyString(p),
            fee: f,
            feeDisplay: toMoneyString(f),
            economicTime: ex.economicTime,
          });
        }
      }
    }

    const derived = deriveLongStockPosition({
      storedLifecycleState: 'Open',
      plan: input.plan,
      originalPlannedRisk: input.originalPlannedRisk,
      executions: execsAsOf,
    });

    const hasEntered = execsAsOf.length > 0;
    const isOversold = hasEntered && derived.oversold;
    const isClosed = hasEntered && !isPositive(derived.openShares) && !derived.oversold;
    const inProgress = !isClosed && sessionDate === input.inProgressSessionDate;
    const markRec = markByDate.get(sessionDate);
    const mark = !inProgress && markRec ? ExactNumber.fromJSON(markRec.price) : null;
    const missingMark = hasEntered && !isClosed && !inProgress && mark === null;
    const unavailableAcknowledged = missingMark && ackSet.has(sessionDate);
    const realizedPnl = derived.realizedPnl;

    let openPnl: Rational | null = null;
    let totalPnl: Rational | null = null;
    let atStopPnl: Rational | null = null;
    let atTargetPnl: Rational | null = null;
    let stopStatus: ReplaySessionPoint['stopStatus'] = 'Unavailable';
    let targetStatus: ReplaySessionPoint['targetStatus'] = 'Unavailable';
    let riskToStop: Rational | null = null;
    let stopOverrun: Rational | null = null;
    let rewardToTarget: Rational | null = null;
    let targetOverrun: Rational | null = null;
    let standing: ReplayStanding = 'Unmarked';
    let standingPct: number | null = null;

    if (!hasEntered) {
      atStopPnl = neg(oneR);
      atTargetPnl = plannedReward;
    } else if (isOversold) {
      standing = 'Oversold';
    } else if (isClosed) {
      openPnl = fromInteger(0);
      totalPnl = realizedPnl;
      stopStatus = 'Closed';
      targetStatus = 'Closed';
      standing = 'Closed';
    } else if (derived.averageEntryPrice && isPositive(derived.openShares)) {
      const avg = derived.averageEntryPrice;
      const qty = derived.openShares;
      const unconsumedFee = derived.feeReconciliation.openingFeesUnconsumed;
      atStopPnl = add(realizedPnl, sub(mul(sub(stopPrice, avg), qty), unconsumedFee));
      atTargetPnl = add(realizedPnl, sub(mul(sub(targetPrice, avg), qty), unconsumedFee));

      if (mark !== null) {
        openPnl = sub(mul(sub(mark, avg), qty), unconsumedFee);
        totalPnl = add(realizedPnl, openPnl);
        const stopBreached = cmp(mark, stopPrice) <= 0;
        const targetReached = cmp(mark, targetPrice) >= 0;
        stopStatus = stopBreached ? 'Breached' : 'Active';
        targetStatus = targetReached ? 'Reached' : 'Active';
        if (stopBreached) {
          stopOverrun = sub(atStopPnl, totalPnl);
        } else {
          riskToStop = sub(totalPnl, atStopPnl);
        }
        if (targetReached) {
          targetOverrun = sub(totalPnl, atTargetPnl);
        } else {
          rewardToTarget = sub(atTargetPnl, totalPnl);
        }

        if (stopBreached) {
          standing = 'PastStop';
        } else if (targetReached) {
          standing = 'AtTarget';
        } else if (isNegative(openPnl)) {
          standing = 'InsideStop';
          const negOpen = neg(openPnl);
          standingPct = clampStandingPct(negOpen, add(negOpen, riskToStop!));
        } else {
          standing = 'InsideTarget';
          standingPct = clampStandingPct(openPnl, add(openPnl, rewardToTarget!));
        }
      }
    }

    const totalPnlR =
      totalPnl !== null && isPositive(oneR) ? div(totalPnl, oneR) : null;
    const bankedPart = computeBankedPart(realizedPnl, totalPnl);

    let changeSincePriorPnl: Rational | null = null;
    let priorMarkedSessionDate: string | null = null;
    let priorMarkedSessionDateShort: string | null = null;
    if (totalPnl !== null) {
      if (priorMarked !== null) {
        changeSincePriorPnl = sub(totalPnl, priorMarked.totalPnl);
        priorMarkedSessionDate = priorMarked.sessionDate;
        priorMarkedSessionDateShort = priorMarked.sessionDateShort;
      }
      priorMarked = { sessionDate, sessionDateShort, totalPnl };
    }

    const foundAction = actionByDate.get(sessionDate);
    let reviewAction: ReplayReviewActionState;
    let actionCode: ReplaySessionPoint['actionCode'];
    if (foundAction) {
      reviewAction = {
        kind: foundAction.action,
        reason: foundAction.reason ?? null,
        conviction: foundAction.conviction ?? null,
      };
      actionCode = foundAction.action === 'Hold' ? 'H' : 'E';
    } else if (isClosed) {
      reviewAction = { kind: 'Closed' };
      actionCode = '';
    } else if (sessionDate < reviewCutoffDate) {
      reviewAction = { kind: 'NoReview' };
      actionCode = '–';
    } else {
      reviewAction = { kind: 'Pending' };
      actionCode = '';
    }

    return {
      index,
      sessionDate,
      sessionDateShort,
      hasEntered,
      inProgress,
      mark,
      markDisplay: mark ? toMoneyString(mark) : null,
      missingMark,
      unavailableAcknowledged,
      executionsToday,
      openShares: derived.openShares,
      openSharesDisplay: derived.openSharesDisplay,
      isClosed,
      realizedPnl,
      realizedPnlDisplay: toMoneyString(realizedPnl, true),
      openPnl,
      openPnlDisplay: openPnl !== null ? toMoneyString(openPnl, true) : null,
      totalPnl,
      totalPnlDisplay: totalPnl !== null ? toMoneyString(totalPnl, true) : null,
      totalPnlR,
      totalPnlRDisplay: totalPnlR !== null ? toRatioString(totalPnlR, true) : null,
      bankedPart,
      changeSincePriorPnl,
      changeSincePriorPnlDisplay:
        changeSincePriorPnl !== null ? toMoneyString(changeSincePriorPnl, true) : null,
      priorMarkedSessionDate,
      priorMarkedSessionDateShort,
      atStopPnl,
      atStopPnlDisplay: atStopPnl !== null ? toMoneyString(atStopPnl, true) : null,
      atTargetPnl,
      atTargetPnlDisplay: atTargetPnl !== null ? toMoneyString(atTargetPnl, true) : null,
      stopStatus,
      targetStatus,
      riskToStop,
      riskToStopDisplay: riskToStop !== null ? toMoneyString(riskToStop) : null,
      stopOverrun,
      stopOverrunDisplay: stopOverrun !== null ? toMoneyString(stopOverrun) : null,
      rewardToTarget,
      rewardToTargetDisplay: rewardToTarget !== null ? toMoneyString(rewardToTarget) : null,
      targetOverrun,
      targetOverrunDisplay: targetOverrun !== null ? toMoneyString(targetOverrun) : null,
      standing,
      standingPct,
      reviewAction,
      actionCode,
    };
  });

  const endSession = sessions[sessions.length - 1]!;
  const tradeIsClosed = endSession.isClosed;

  const { keyMoments } = buildReplayKeyMoments({
    symbol: input.symbol,
    sessions,
    execsWithDates,
    stopPrice,
    stopPriceDisplay: toMoneyString(stopPrice),
    targetPrice,
    targetPriceDisplay: toMoneyString(targetPrice),
    oneR,
    isClosed: tradeIsClosed,
  });

  let initialSelectedIndex = sessions.length - 1;
  if (!tradeIsClosed) {
    if (endSession.standing === 'PastStop') {
      initialSelectedIndex = findTrailingStandingRun(sessions, 'PastStop').runStartIdx;
    } else if (endSession.standing === 'AtTarget') {
      initialSelectedIndex = findTrailingStandingRun(sessions, 'AtTarget').runStartIdx;
    }
  }

  const { summaryLine, highlightPrimary } = buildReplaySummary({
    sessions,
    isClosed: tradeIsClosed,
  });

  const stopDisciplineEpisodes = reconcileStopDisciplineEpisodes({
    tradeId: input.tradeId,
    stopPrice: input.plan.stopPrice,
    executions: sortedExecs,
    effectiveMarks: input.effectiveMarks,
    reviewActions: sortedReviewActions.map((a) => ({
      reviewDate: a.reviewDate,
      action: a.action,
    })),
  });

  return {
    tradeId: input.tradeId,
    symbol: input.symbol,
    isClosed: tradeIsClosed,
    plannedQuantityDisplay: formatQuantityString(plannedQty),
    intendedEntryPrice,
    intendedEntryDisplay: toMoneyString(intendedEntryPrice),
    stopPrice,
    stopPriceDisplay: toMoneyString(stopPrice),
    targetPrice,
    targetPriceDisplay: toMoneyString(targetPrice),
    oneR,
    oneRDisplay: toMoneyString(oneR),
    planRails: {
      stop: neg(oneR),
      target: plannedReward,
    },
    sessions,
    keyMoments,
    initialSelectedIndex,
    summaryLine,
    highlightPrimary,
    stopDisciplineEpisodes,
    missingMarkCount: sessions.filter((s) => s.missingMark).length,
  };
}
