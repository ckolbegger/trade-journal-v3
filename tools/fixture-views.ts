// Pure view functions of `verify-fixtures.ts`, apart from the script so they can be tested with plain data.

// D5R2 A167: a walked Trade no longer carries `reflections`; its Reflections panel holds the same counts.
// The committed views were frozen with the old field, so it is stated here from the panel and compared as before.
type WalkedItem = { reflections?: { due?: number; later?: number }; progress?: { panels?: { panel: string; dueNow?: number; later?: number }[] } };
export function withWalkedReflections(views: unknown): unknown {
  const review = (views as { review?: { families?: { family: string; trades?: WalkedItem[] }[] } }).review;
  if (!review?.families) return views;
  const families = review.families.map((family) => ({
    ...family,
    ...(family.family === 'Trades' && {
      trades: (family.trades ?? []).map((trade) => {
        const panel = trade.progress?.panels?.find((p) => p.panel === 'Reflections');
        return panel ? { ...trade, reflections: { due: panel.dueNow, later: panel.later } } : trade;
      }),
    }),
  }));
  return { ...(views as object), review: { ...review, families } };
}

// A73: a Workspace migrated from an earlier schema has no Debt, so every Debt list and count of the
// current release's views is empty. Each list must be present: a missing one is a violation, not a pass.
export function debtViolations(views: unknown, hasOpenTrades: boolean): string[] {
  const { debts, details, reviewTrades, review } = views as {
    debts?: unknown[];
    details?: { tradeId: string; journal?: { kind?: string; answeredLater?: unknown; declinedLater?: unknown }[] }[];
    reviewTrades?: { tradeId: string; reflections?: unknown[] }[];
    review?: { families?: { family: string; trades?: { tradeId: string; reflections?: { due?: number; later?: number } }[] }[] };
  };
  const out: string[] = [];
  if (!Array.isArray(debts) || debts.length > 0) out.push(`debts (${Array.isArray(debts) ? debts.length : 'missing'})`);
  for (const detail of details ?? []) {
    if (detail.journal === undefined) out.push(`${detail.tradeId}.journal (missing)`);
    // The Trade narrative marks a settled Debt on the Entry (answeredLater) or the Decline (declinedLater); it never exposes settledDebtId.
    if ((detail.journal ?? []).some((item) => item.kind === 'Debt' || item.answeredLater !== undefined || item.declinedLater !== undefined)) out.push(`${detail.tradeId}.journal (Debt item)`);
  }
  for (const trade of reviewTrades ?? []) {
    if (!Array.isArray(trade.reflections) || trade.reflections.length > 0) out.push(`${trade.tradeId}.reflections (${Array.isArray(trade.reflections) ? trade.reflections.length : 'missing'})`);
  }
  const walked = (review?.families ?? []).flatMap((family) => (family.family === 'Trades' ? (family.trades ?? []) : []));
  for (const trade of walked) {
    if (trade.reflections?.due !== 0 || trade.reflections.later !== 0) out.push(`${trade.tradeId}.review counts (${trade.reflections?.due ?? 'missing'}/${trade.reflections?.later ?? 'missing'})`);
  }
  // A fixture with Open Trades must show a Review walk; otherwise the empty counts above would pass unchecked.
  if (reviewTrades === undefined || (hasOpenTrades && walked.length === 0)) out.push('review (no walked Trades to check)');
  return out;
}

// D6 A98 (extends A73): a Workspace migrated from schema 1 to 4 has no exit, Close Reason, Close Review or
// Closed Trade. Its Closed list is Empty, every derived Lot Match list is empty and realized-to-date is 0.
// A missing list is a violation, not a pass.
export function closeViolations(views: unknown): string[] {
  const { closed, details, debts } = views as {
    closed?: unknown[];
    details?: {
      tradeId: string;
      closeReason?: unknown;
      terminalTime?: unknown;
      lotMatches?: unknown[];
      realizedToDate?: unknown;
      positionChanges?: { executions?: { action?: string }[] }[];
      journal?: { entryTypeKey?: string }[];
    }[];
    debts?: { entryTypeKey?: string }[];
  };
  const out: string[] = [];
  if (!Array.isArray(closed) || closed.length > 0) out.push(`closed list (${Array.isArray(closed) ? closed.length : 'missing'})`);
  if (!Array.isArray(details)) out.push('details (missing)');
  for (const detail of details ?? []) {
    if (detail.closeReason !== undefined || detail.terminalTime !== undefined) out.push(`${detail.tradeId} Close Reason or terminal time`);
    if ((detail.positionChanges ?? []).some((change) => (change.executions ?? []).some((e) => e.action === 'Sell'))) out.push(`${detail.tradeId} exit`);
    if ((detail.journal ?? []).some((item) => item.entryTypeKey === 'entry-type.close-review')) out.push(`${detail.tradeId} Close Review`);
    // Only a Trade with positions carries Lot Matches: there the derived list is empty and realized is exactly zero.
    if (detail.lotMatches !== undefined && detail.lotMatches.length > 0) out.push(`${detail.tradeId} Lot Matches (${detail.lotMatches.length})`);
    if (detail.realizedToDate !== undefined && detail.realizedToDate !== '0/1') out.push(`${detail.tradeId} realized-to-date (${JSON.stringify(detail.realizedToDate)})`);
  }
  if ((debts ?? []).some((debt) => debt.entryTypeKey === 'entry-type.close-review')) out.push('Close Review Debt');
  return out;
}
