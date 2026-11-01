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
