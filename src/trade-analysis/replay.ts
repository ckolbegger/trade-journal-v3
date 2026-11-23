import { getExchangeDateForInstant } from '../market-data/session-calendar';
import type { DeviationRecord, ExecutionRecord, JournalEntryRecord } from '../persistence/idb';
import {
  cmp,
  ExactNumber,
  isPositive,
  mul,
  sub,
  toMoneyString,
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

export function extractDailyReviewActions(
  entries: readonly JournalEntryRecord[],
  entryTypeId: string,
): readonly { readonly reviewDate: string; readonly action: 'Hold' | 'Exit' }[] {
  const result: { reviewDate: string; action: 'Hold' | 'Exit' }[] = [];
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
      result.push({ reviewDate, action });
    }
  }
  return result;
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
