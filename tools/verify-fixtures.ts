// npm run verify:fixtures: every committed Workspace fixture opens with the current release and
// presents views equal to its committed snapshot (D1 T1.31). A fixture at the current schema opens
// Ready without migrating; an older one migrates to the current schema first (D2 T2.19). Equal means
// field by field over the fields the snapshot holds; a field the current release adds is allowed and
// its defined value is asserted elsewhere (D4 A51, brought forward by D2 T2.56, plan revision 8).
// For a fixture older than schema 3 that defined value is asserted here: every current figure of an
// Open Trade is Unavailable(MarkMissing), since no Mark exists (D4 T4.29).
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { SCHEMA_VERSION } from '../src/persistence/schema.ts';
import { sequentialIds } from '../tests/support/workspace.ts';
import { compareSnapshot } from './fixtures/snapshot-compare.ts';
import { debtViewsOf, FIXTURES_DIR, launchOn, loadDump, viewsOf, type WorkspaceDump } from './fixtures/workspace-fixture.ts';

// The D4 fields of an Open list row: the Mark's resolution and every figure and condition result.
const CURRENT_FIGURES = [
  'remainingOpenPnl',
  'currentMarkedPnl',
  'currentMarkedPnlInPlanR',
  'ongoingRiskToStop',
  'ongoingRiskToStopInPlanR',
  'worstCaseOngoingRisk',
  'worstCaseOngoingRiskInPlanR',
  'incrementalRewardToTarget',
  'incrementalRewardToTargetInPlanR',
] as const;

const isMarkMissing = (figure: unknown): boolean =>
  (figure as { kind?: string; reason?: string } | undefined)?.kind === 'Unavailable' &&
  (figure as { reason?: string }).reason === 'MarkMissing';

// Names each Open Trade figure of a pre-schema-3 fixture's migrated views that is not Unavailable(MarkMissing).
function markMissingViolations(views: unknown): string[] {
  const { open = [], details = [] } = views as {
    open?: { tradeId: string; current?: Record<string, unknown> }[];
    details?: { tradeId: string; plan?: { stops?: unknown[]; targets?: unknown[] } }[];
  };
  return open.flatMap((row) => {
    const current = row.current;
    if (!current) return [`${row.tradeId}: no current figures`];
    const bad = CURRENT_FIGURES.filter((name) => !isMarkMissing(current[name])).map((name) => `${row.tradeId}.${name}`);
    // One result per Stop and Target of the Trade's plan; a missing or short list is a violation, not an empty pass.
    const plan = details.find((d) => d.tradeId === row.tradeId);
    const planned = (plan?.plan?.stops?.length ?? 0) + (plan?.plan?.targets?.length ?? 0);
    const conditions = (current['conditions'] as { id: string; result: unknown }[] | undefined) ?? [];
    const missingConditions = planned > 0 && conditions.length === planned ? [] : [`${row.tradeId}.conditions (${conditions.length} of ${planned} plan conditions)`];
    const badConditions = conditions.filter((c) => !isMarkMissing(c.result)).map((c) => `${row.tradeId}.conditions.${c.id}`);
    const resolution = (current['markResolution'] as { kind?: string } | undefined)?.kind === 'Missing' ? [] : [`${row.tradeId}.markResolution`];
    return [...bad, ...missingConditions, ...badConditions, ...resolution];
  });
}

// A73: a Workspace migrated from an earlier schema has no Debt, so every Debt list and count of the
// current release's views is empty. Each list must be present: a missing one is a violation, not a pass.
function debtViolations(views: unknown, hasOpenTrades: boolean): string[] {
  const { debts, details, reviewTrades, review } = views as {
    debts?: unknown[];
    details?: { tradeId: string; journal?: { kind?: string; answeredLater?: unknown; declinedLater?: unknown }[] }[];
    reviewTrades?: { tradeId: string; reflections?: unknown[] }[];
    review?: { families?: { family: string; trades?: { tradeId: string; reflections?: { due: number; later: number } }[] }[] };
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

const problems: string[] = [];
const verified: string[] = [];
const fixtures = (await readdir(FIXTURES_DIR)).filter((name) => name.startsWith('workspace-v')).sort();
if (fixtures.length === 0) problems.push(`no Workspace fixtures in ${FIXTURES_DIR}`);
for (const name of fixtures) {
  const dir = path.join(FIXTURES_DIR, name);
  const dump = JSON.parse(await readFile(path.join(dir, 'dump.json'), 'utf8')) as WorkspaceDump;
  const expected: unknown = JSON.parse(await readFile(path.join(dir, 'expected-views.json'), 'utf8'));
  if (dump.schemaVersion > SCHEMA_VERSION) {
    problems.push(`${name}: schema ${dump.schemaVersion} is newer than this release's ${SCHEMA_VERSION}`);
    continue;
  }
  // Identities the release mints here (a migration's seeds and candidate) must not repeat the
  // fixture's own `fx-` identities.
  const app = await launchOn(await loadDump(dump), dump.asOf, sequentialIds('verify'));
  // Opening runs any migration an older fixture needs (D2 T2.10).
  const opened = await app.Workspace.initialize({});
  if (opened.kind !== 'Opened') {
    problems.push(`${name}: initialize is ${opened.kind}, not Opened`);
    continue;
  }
  const migration = opened.receipt.migration;
  if (dump.schemaVersion < SCHEMA_VERSION && (migration?.fromVersion !== dump.schemaVersion || migration.toVersion !== SCHEMA_VERSION)) {
    problems.push(`${name}: opening did not migrate it from schema ${dump.schemaVersion} to ${SCHEMA_VERSION}`);
    continue;
  }
  if (dump.schemaVersion === SCHEMA_VERSION && migration !== undefined) {
    problems.push(`${name}: opening migrated a Workspace already at schema ${SCHEMA_VERSION}`);
    continue;
  }
  const status = await app.Workspace.getStatus();
  if (status.kind !== 'Ready') {
    problems.push(`${name}: getStatus is ${status.kind}, not Ready`);
    continue;
  }
  const views = await viewsOf(app, dump.schemaVersion, dump.asOf);
  if (dump.schemaVersion < 3) {
    const open = (views as { open?: unknown[] }).open;
    if (dump.schemaVersion >= 2 && (open?.length ?? 0) === 0) {
      problems.push(`${name}: migrated views have no Open Trades to check`);
      continue;
    }
    const violations = markMissingViolations(views);
    if (violations.length > 0) {
      problems.push(`${name}: not Unavailable(MarkMissing) after migration: ${violations.join(', ')}`);
      continue;
    }
  }
  if (dump.schemaVersion < 4) {
    const debtViolation = debtViolations({ ...(views as object), ...(await debtViewsOf(app, dump.asOf) as object) }, dump.schemaVersion >= 2);
    if (debtViolation.length > 0) {
      problems.push(`${name}: not Debt-free after migration: ${debtViolation.join(', ')}`);
      continue;
    }
  }
  const differences = compareSnapshot(views, expected);
  if (differences.length > 0) {
    problems.push(`${name}: views differ from expected-views.json at ${differences.join(', ')}`);
    continue;
  }
  verified.push(`${name}: schema ${dump.schemaVersion}, ${migration ? `migrated to ${migration.toVersion} into ${migration.databaseName}` : 'opened without migration'}, views equal`);
}
if (problems.length > 0) {
  for (const p of problems) console.error(`FAIL ${p}`);
  process.exit(1);
}
for (const line of verified) console.log(line);
console.log(`verify:fixtures OK: ${fixtures.join(', ')} open Ready at schema ${SCHEMA_VERSION} with views equal to their snapshots`);
