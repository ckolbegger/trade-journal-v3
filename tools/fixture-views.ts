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
    if (!Array.isArray(reviewTrades)) out.push('reviewTrades (missing)');
    for (const trade of reviewTrades ?? []) {
      if (!Array.isArray(trade.settlement)) out.push(`${trade.tradeId}.review settlement (missing)`);
      else if (trade.settlement.length > 0) out.push(`${trade.tradeId}.review settlement (${trade.settlement.length})`);
    }
  }
  return out;
}

// The number of StructureValue Stop and Target conditions in the Plans of a snapshot's Open details (A204).
export function openStructureValueCount(expected: unknown): number {
  const held = expected as { details?: { lifecycle?: { stored?: string }; plan?: { stops?: { kind?: string }[]; targets?: { kind?: string }[] } }[] };
  return (held.details ?? []).filter((detail) => detail.lifecycle?.stored === 'Open').flatMap((detail) => [...(detail.plan?.stops ?? []), ...(detail.plan?.targets ?? [])]).filter((condition) => condition.kind === 'StructureValue').length;
}

// What the seed-6 fixture holds that a snapshot emptied of it could not (D9.5 T95.63): the Review Date's saved Actions of each kind with
// and without a reason, a Settle Later, the Plan Departure Reason and the Expiration Reason answered, and Close Reviews owed under the
// earlier form and under manifest 6's and answered. Each missing item is named.
export function seed6ContentViolations(expected: unknown): string[] {
  type Response = { prompt: string; answer: { kind: string } };
  const held = expected as {
    reviewTrades?: { form?: { action?: { action: string; responses: Response[] } } }[];
    details?: { journal?: { entryTypeKey?: string; responses?: Response[] }[] }[];
    debts?: { entryTypeKey: string; definitionId: string }[];
  };
  const actions = (held.reviewTrades ?? []).flatMap((trade) => (trade.form?.action ? [trade.form.action] : []));
  const answered = (responses: Response[], prompt: string) => responses.some((r) => r.prompt === prompt && r.answer.kind === 'Text');
  const withReason = (name: string, yes: boolean) => actions.some((a) => a.action === name && answered(a.responses, 'Why?') === yes);
  const entries = (held.details ?? []).flatMap((detail) => detail.journal ?? []);
  const answersOf = (prompt: string) => entries.filter((entry) => answered(entry.responses ?? [], prompt)).length;
  const closeDebts = (held.debts ?? []).filter((debt) => debt.entryTypeKey === 'entry-type.close-review');
  // A form revision a manifest added is named `<type>.revision-<n>`; the earlier ones keep the identity they were seeded with.
  const isNewForm = (debt: { definitionId: string }) => /\.revision-\d+$/.test(debt.definitionId);
  const missing: [string, boolean][] = [
    ['Hold with a reason', withReason('Hold', true)],
    ['Hold without a reason', withReason('Hold', false)],
    ['Exit with a reason', withReason('Exit', true)],
    ['Exit without a reason', withReason('Exit', false)],
    ['Roll', actions.some((a) => a.action === 'Roll')],
    ['Adjust', actions.some((a) => a.action === 'Adjust')],
    ['Settle Later', actions.some((a) => a.action === 'Settle Later')],
    ['Plan Departure Reason answered twice', answersOf('Why did you leave the Plan?') >= 2],
    ['Expiration Reason answered', answersOf('Why did it expire worthless?') >= 1],
    ['Close Review owed under the earlier form', closeDebts.some((debt) => !isNewForm(debt))],
    ['Close Review owed under manifest 6', closeDebts.some(isNewForm)],
    // Two answered Close Reviews came from workspace-v7; the third is the one answered under manifest 6's form.
    ['Close Review answered', entries.filter((entry) => entry.entryTypeKey === 'entry-type.close-review').length >= 3],
  ];
  return missing.filter(([, held]) => !held).map(([name]) => name);
}
