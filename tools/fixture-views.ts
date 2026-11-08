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
export function closeViolations(views: unknown, hasOpenTrades: boolean): string[] {
  const { closed, details, debts } = views as {
    closed?: unknown[];
    details?: {
      tradeId: string;
      lifecycle?: { stored?: string };
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
  let openDetails = 0;
  for (const detail of details ?? []) {
    if (detail.closeReason !== undefined || detail.terminalTime !== undefined) out.push(`${detail.tradeId} Close Reason or terminal time`);
    if (!Array.isArray(detail.journal)) out.push(`${detail.tradeId}.journal (missing)`);
    if ((detail.positionChanges ?? []).some((change) => (change.executions ?? []).some((e) => e.action === 'Sell'))) out.push(`${detail.tradeId} exit`);
    if ((detail.journal ?? []).some((item) => item.entryTypeKey === 'entry-type.close-review')) out.push(`${detail.tradeId} Close Review`);
    // Only an Open Trade carries positions, so only it carries Lot Matches and position changes: the derived
    // list is empty and realized is exactly zero. A Planned Trade's detail has none of them.
    if (detail.lifecycle?.stored !== 'Open') continue;
    openDetails += 1;
    if (!Array.isArray(detail.positionChanges)) out.push(`${detail.tradeId}.positionChanges (missing)`);
    if (!Array.isArray(detail.lotMatches)) out.push(`${detail.tradeId} Lot Matches (missing)`);
    else if (detail.lotMatches.length > 0) out.push(`${detail.tradeId} Lot Matches (${detail.lotMatches.length})`);
    if (detail.realizedToDate === undefined) out.push(`${detail.tradeId} realized-to-date (missing)`);
    else if (detail.realizedToDate !== '0/1') out.push(`${detail.tradeId} realized-to-date (${JSON.stringify(detail.realizedToDate)})`);
  }
  // Where Open Trades exist, the checks above would pass unchecked on a view that holds none.
  if (hasOpenTrades && openDetails === 0) out.push('details (no Open Trades to check)');
  if ((debts ?? []).some((debt) => debt.entryTypeKey === 'entry-type.close-review')) out.push('Close Review Debt');
  return out;
}

// D7 A121 (extends A98): a Workspace migrated from schema 1 to 5 has no option Trade. Its Instruments read as
// Stock with multiplier 1, both payoff views of every Trade are NotApplicable(NoOptionExpirationAnchor), and the
// settlement family is empty. A missing field or list is a violation, not a pass.
type NotApplicable = { kind?: string; reason?: string };
const isNoAnchor = (view: unknown): boolean => (view as NotApplicable | undefined)?.kind === 'NotApplicable' && (view as NotApplicable).reason === 'NoOptionExpirationAnchor';

// Names each Instrument-shaped object of the views that is an option or a Stock whose multiplier is not 1,
// and counts the Stock Instruments, so a view with none is reported rather than passed.
function instrumentFindings(value: unknown, path: string, out: { bad: string[]; stocks: number }): void {
  if (Array.isArray(value)) {
    value.forEach((item, i) => instrumentFindings(item, `${path}[${i}]`, out));
  } else if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (record['kind'] === 'Option' && ('strike' in record || 'right' in record || 'expiration' in record)) out.bad.push(`${path} (option Instrument)`);
    else if (record['kind'] === 'Stock' && typeof record['symbol'] === 'string') {
      out.stocks += 1;
      if (record['multiplier'] !== undefined && record['multiplier'] !== 1) out.bad.push(`${path} (Stock multiplier ${JSON.stringify(record['multiplier'])})`);
    }
    for (const [key, inner] of Object.entries(record)) instrumentFindings(inner, `${path}.${key}`, out);
  }
}

export function optionViolations(views: unknown, hasOpenTrades: boolean, hasReview: boolean): string[] {
  const { details, open, review, reviewTrades } = views as {
    details?: { tradeId: string; lifecycle?: { stored?: string }; payoff?: { planned?: unknown; current?: unknown }; settlement?: unknown[] }[];
    open?: { tradeId: string; settlement?: unknown[] }[];
    review?: { families?: { family: string; items?: unknown[] }[] };
    reviewTrades?: { tradeId: string; settlement?: unknown[] }[];
  };
  const out: string[] = [];
  const found = { bad: [] as string[], stocks: 0 };
  instrumentFindings(views, 'views', found);
  out.push(...found.bad);
  if (found.stocks === 0) out.push('Instruments (no Stock Instrument to check)');
  if (!Array.isArray(details) || details.length === 0) out.push('details (none to check)');
  for (const detail of details ?? []) {
    if (!isNoAnchor(detail.payoff?.planned)) out.push(`${detail.tradeId}.payoff.planned (${JSON.stringify(detail.payoff?.planned) ?? 'missing'})`);
    if (!isNoAnchor(detail.payoff?.current)) out.push(`${detail.tradeId}.payoff.current (${JSON.stringify(detail.payoff?.current) ?? 'missing'})`);
    // Only a Trade with a Position (not a Planned one) carries a settlement list.
    if (detail.lifecycle?.stored === 'Planned') continue;
    if (!Array.isArray(detail.settlement)) out.push(`${detail.tradeId}.settlement (missing)`);
    else if (detail.settlement.length > 0) out.push(`${detail.tradeId}.settlement (${detail.settlement.length})`);
  }
  if (hasOpenTrades && (!Array.isArray(open) || open.length === 0)) out.push('open list (no Open Trades to check)');
  for (const row of open ?? []) {
    if (!Array.isArray(row.settlement)) out.push(`${row.tradeId}.open settlement (missing)`);
    else if (row.settlement.length > 0) out.push(`${row.tradeId}.open settlement (${row.settlement.length})`);
  }
  if (hasReview) {
    if (!Array.isArray(review?.families)) out.push('review.families (missing)');
    const settlement = (review?.families ?? []).filter((family) => family.family === 'Settlement');
    if (settlement.some((family) => !Array.isArray(family.items) || family.items.length > 0)) out.push('review Settlement family (not empty)');
    for (const trade of reviewTrades ?? []) {
      if (!Array.isArray(trade.settlement)) out.push(`${trade.tradeId}.review settlement (missing)`);
      else if (trade.settlement.length > 0) out.push(`${trade.tradeId}.review settlement (${trade.settlement.length})`);
    }
  }
  return out;
}
