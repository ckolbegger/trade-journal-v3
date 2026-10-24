import type { Envelope, LifecycleRow, Root, Runtime } from '../../infrastructure/storage';
import { Journal, planDefinition } from '../../domain/journal';
import { assessPlan } from '../../domain/trade-analysis';
import type { TradeSnapshot } from '../../domain/trade-record';
import type { JournalEntry } from '../../domain/journal';
import { longStock, type CatalogRecord } from '../../domain/reference-catalog';

// Migration alone scans history. Ordinary startup uses the bounded count receipt.
export function validateD1(rows: Envelope[], membership: LifecycleRow[], root: Root) {
  try {
  if (rows.some(row => !['Plan', 'JournalEntry', 'Institution', 'Account', 'Strategy', 'Definition', 'Source'].includes(row.kind) || !Number.isSafeInteger(row.commitOrdinal) || row.commitOrdinal < 1 || row.commitOrdinal > root.commitOrdinal)) return false;
  const plans = rows.filter(row => row.kind === 'Plan');
  const entries = rows.filter(row => row.kind === 'JournalEntry');
  const catalog = rows.filter(row => ['Institution', 'Account', 'Strategy'].includes(row.kind)).map(row => row.value as CatalogRecord);
  if (rows.length !== root.commitOrdinal + root.recordedSequence + 2 || plans.length !== root.recordedSequence || entries.length !== plans.length || membership.length !== plans.length) return false;
  if (new Set(rows.map(row => row.version)).size !== rows.length || new Set(plans.map(row => row.tradeId)).size !== plans.length) return false;
  if (new Set(plans.map(row => row.sequence)).size !== plans.length || plans.some(row => !Number.isSafeInteger(row.sequence) || row.sequence < 1 || row.sequence > root.recordedSequence)) return false;
  const members = new Map(membership.map(row => [row.tradeId, row]));
  const reflectionsByTrade = new Map<string, Envelope[]>();
  for (const row of entries) reflectionsByTrade.set(row.tradeId, [...(reflectionsByTrade.get(row.tradeId) ?? []), row]);
  const references = new Map(catalog.map(row => [row.id, row]));
  for (const row of plans) {
    const trade = row.value as TradeSnapshot;
    const assessment = assessPlan(trade.plan);
    const member = members.get(trade.tradeId);
    const reflections = reflectionsByTrade.get(trade.tradeId) ?? [];
    const entry = reflections[0]?.value as JournalEntry | undefined;
    const account = references.get(trade.accountId);
    if (entry?.definition.id !== 'plan-reflection' || JSON.stringify(entry.definition) !== JSON.stringify(planDefinition) || entry.source.id !== 'plan-confirmation' || entry.momentTime !== trade.economicTime || entry.responses.thesis?.kind !== 'Text' || entry.responses.thesis.value !== trade.plan.thesis || entry.responses.invalidation?.kind !== 'Text' || entry.responses.invalidation.value !== trade.plan.invalidation) return false;
    if (member?.sequence !== trade.sequence || member.economicTime !== trade.economicTime || entry.saveTime !== trade.saveTime || entry.firstAuthoredTime !== trade.saveTime || row.economicTime !== trade.economicTime || row.saveTime !== trade.saveTime || JSON.stringify(references.get(trade.strategyId)?.shape) !== JSON.stringify(longStock.shape)) return false;
    if (assessment.status !== 'Accepted' || JSON.stringify(assessment.baseline) !== JSON.stringify(trade.baseline) || trade.lifecycle !== 'Planned' || row.id !== trade.planFactId || row.version !== trade.planVersionId || row.sequence !== trade.sequence || member?.version !== row.version || member.revision !== trade.revision || member.lifecycle !== 'Planned' || reflections.length !== 1 || entry?.origin.factId !== trade.planFactId || entry.anchor.tradeId !== trade.tradeId || !account || account.kind !== 'Account' || references.get(account.parentId ?? '')?.kind !== 'Institution' || references.get(trade.strategyId)?.kind !== 'Strategy') return false;
  }
  return true;
  } catch { return false; }
}
export async function migrateD1(runtime: Runtime, source: Root, saveTime: string) {
  const store = runtime.store;
  const abandoned = await store.projections.where('key').startsWith('migration-staging:').toArray();
  for (const receipt of abandoned) {
    const staged = receipt.value as { generation: string };
    await store.transaction('rw', [store.roots, store.versions, store.lifecycle, store.projections], async () => {
      if ((await store.roots.get('active'))?.generation === staged.generation) return;
      await store.versions.where('[generation+kind]').between([staged.generation, ''], [staged.generation, '\uffff']).delete();
      await store.lifecycle.where('[generation+tradeId]').between([staged.generation, ''], [staged.generation, '\uffff']).delete();
      await store.projections.delete(`migration-seal:${staged.generation}`);
      await store.projections.delete(receipt.key);
    });
  }
  const snapshot = await store.transaction('r', [store.roots, store.versions, store.lifecycle], async () => ({
    root: await store.roots.get('active'),
    rows: await store.versions.where('[generation+kind]').between([source.generation, ''], [source.generation, '\uffff']).toArray(),
    membership: await store.lifecycle.where('[generation+tradeId]').between([source.generation, ''], [source.generation, '\uffff']).toArray(),
  }));
  if (snapshot.root?.revision !== source.revision) return { status: 'Conflict' as const, issues: ['WorkspaceChanged'] };
  if (!validateD1(snapshot.rows, snapshot.membership, source)) return { status: 'MigrationBlocked' as const, reason: 'InvalidSource', unchangedRevision: source.revision };
  const bytes = new TextEncoder().encode(JSON.stringify(snapshot)).byteLength;
  if (!await runtime.host.migrationCapacity?.(bytes * 2)) return { status: 'MigrationBlocked' as const, reason: 'MigrationCapacity', unchangedRevision: source.revision };
  const generation = crypto.randomUUID();
  const key = (old: string) => old.startsWith(`${source.generation}:`) ? generation + old.slice(source.generation.length) : `${generation}:${old}`;
  const rows = snapshot.rows.map(row => ({ ...row, generation, domainVersion: row.domainVersion ?? row.version, version: key(row.version) }));
  const membership = snapshot.membership.map(row => ({ ...row, generation, key: `${generation}:${row.tradeId}`, version: key(row.version) }));
  const candidate: Root = { ...source, schema: 2, generation, commitOrdinal: source.commitOrdinal + 1, revision: crypto.randomUUID(), recordCounts: { versions: rows.length + 2, lifecycle: membership.length } };
  await store.projections.put({ key: `migration-staging:${generation}`, value: { generation, sourceRevision: source.revision } });
  // Bounded writes yield between chunks; none can select this generation publicly.
  for (let offset = 0; offset < rows.length; offset += 500) await store.versions.bulkAdd(rows.slice(offset, offset + 500));
  for (let offset = 0; offset < membership.length; offset += 500) await store.lifecycle.bulkAdd(membership.slice(offset, offset + 500));
  await store.transaction('rw', store.versions, () => new Journal(store).seedDefaults(candidate, saveTime));
  const sealedRows = await store.versions.where('[generation+kind]').between([generation, ''], [generation, '\uffff']).toArray();
  const sealedByVersion = new Map(sealedRows.map(row => [row.version, row]));
  if (sealedRows.length !== candidate.recordCounts?.versions || !rows.every(row => JSON.stringify(sealedByVersion.get(row.version)) === JSON.stringify(row))) return { status: 'MigrationBlocked' as const, reason: 'CandidateValidation', unchangedRevision: source.revision };
  const seal = JSON.stringify(sealedRows);
  await store.projections.put({ key: `migration-seal:${generation}`, value: { sourceRevision: source.revision, candidate, seal } });
  return runtime.mutate(source.generation, async current => {
    if (current?.revision !== source.revision) return { status: 'Conflict' as const, issues: ['WorkspaceChanged'] };
    const durableSeal = await store.projections.get(`migration-seal:${generation}`);
    const staged = await store.versions.where('[generation+kind]').between([generation, ''], [generation, '\uffff']).toArray();
    const stagedMembership = await store.lifecycle.where('[generation+tradeId]').between([generation, ''], [generation, '\uffff']).toArray();
    if (JSON.stringify(durableSeal?.value) !== JSON.stringify({ sourceRevision: source.revision, candidate, seal }) || JSON.stringify(staged) !== seal || JSON.stringify(stagedMembership) !== JSON.stringify(membership)) return { status: 'MigrationBlocked' as const, reason: 'CandidateChanged', unchangedRevision: source.revision };
    await store.roots.put(candidate);
    await store.projections.delete(`migration-staging:${generation}`);
    return { status: 'Migrated' as const, root: candidate, migration: { from: 1, to: 2, sourceGeneration: source.generation, candidateGeneration: generation, sourceRevision: source.revision, sourceRows: snapshot.rows.length, candidateRows: sealedRows.length, serializedSourceBytes: bytes, candidateSealed: true } };
  }, 'Migration');
}
