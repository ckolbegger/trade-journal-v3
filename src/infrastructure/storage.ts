import Dexie, { type Table, type Transaction } from 'dexie';
import { Temporal } from '@js-temporal/polyfill';
const serializedBytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength;
interface SizeReceipt { revision: string; serializedRowsBytes: number }
export interface Root {
  key: 'active'; generation: string; revision: string; schema: number;
  timeZone: string; catalogRevision: string; definitionRevision: string;
  commitOrdinal: number; recordedSequence: number; recordCounts?: { versions: number; lifecycle: number };
}
export function rootHeaderFailure(root: Root) {
  if (root.schema !== 1 && root.schema !== 2) return 'UnsupportedSchema';
  if (!root.generation || !root.revision || !root.catalogRevision || !root.definitionRevision || !Number.isSafeInteger(root.commitOrdinal) || root.commitOrdinal < 1 || !Number.isSafeInteger(root.recordedSequence) || root.recordedSequence < 0 || (root.schema === 1 && root.commitOrdinal <= root.recordedSequence) || /^[+-]/.test(root.timeZone)) return 'InvalidRoot';
  try { Temporal.Instant.from('2026-01-01T00:00:00Z').toZonedDateTimeISO(root.timeZone); } catch { return 'InvalidRoot'; }
  return undefined;
}
export interface Envelope {
  version: string; domainVersion?: string; id: string; generation: string; kind: string;
  tradeId: string; economicTime: string; saveTime: string; sequence: number; commitOrdinal: number;
  value: unknown;
}
export interface LifecycleRow { key: string; generation: string; tradeId: string; lifecycle: string; accountId: string; symbol: string; economicTime: string; economicOrder: string; sequence: number; version: string; revision: string }
export class Store extends Dexie {
  private upgradeBlocked = false;
  private measured = new WeakMap<Transaction, number>();
  roots!: Table<Root, string>;
  versions!: Table<Envelope, string>;
  lifecycle!: Table<LifecycleRow, string>;
  projections!: Table<{ key: string; value: unknown }, string>;
  diagnostic!: Table<{ key: string; value: string }, string>;
  constructor(name: string) {
    super(name);
    this.version(1).stores({ roots: 'key', versions: 'version, [generation+kind], [generation+id], [generation+tradeId], [generation+kind+economicTime+sequence]', lifecycle: 'key, [generation+lifecycle+economicOrder+sequence], [generation+tradeId]', projections: 'key', diagnostic: 'key' });
    this.version(2).stores({ versions: 'version, [generation+kind], [generation+id], [generation+tradeId], [generation+kind+economicTime+sequence], [generation+kind+id+commitOrdinal]' });
    const observe = (_key: unknown, row: unknown, transaction: Transaction) => {
      const prior = this.measured.get(transaction);
      if (prior !== undefined) this.measured.set(transaction, prior + serializedBytes(row));
    };
    this.versions.hook('creating', observe);
    this.lifecycle.hook('creating', observe);
    this.on('blocked', () => { this.upgradeBlocked = true; this.close(); });
    this.on('versionchange', () => this.close());
  }
  async storageMeasurement(root: Root | undefined) {
    const hint = root ? await this.projections.get(`active-size:${root.generation}`) : undefined;
    const value = hint?.value as SizeReceipt | undefined;
    if (!root || !value || value.revision !== root.revision || !Number.isSafeInteger(value.serializedRowsBytes) || value.serializedRowsBytes < 0) return { activeSerializedBytes: 0, method: 'UnmeasuredConservative' as const };
    return { activeSerializedBytes: value.serializedRowsBytes + serializedBytes(root) + serializedBytes(hint), method: 'SerializedActiveLowerBound' as const };
  }
  async measureMutation<T>(root: Root | undefined, effect: () => Promise<T>): Promise<T> {
    const transaction = Dexie.currentTransaction;
    if (!transaction) throw new Error('SemanticTransactionRequired');
    this.measured.set(transaction, 0);
    try {
      const old = root ? await this.projections.get(`active-size:${root.generation}`) : undefined;
      const result = await effect();
      const added = this.measured.get(transaction) ?? 0;
      if (added > 0) {
        const next = await this.roots.get('active');
        const prior = old?.value as SizeReceipt | undefined;
        if (next) await this.projections.put({ key: `active-size:${next.generation}`, value: { revision: next.revision, serializedRowsBytes: (prior?.revision === root?.revision && Number.isSafeInteger(prior?.serializedRowsBytes) && (prior?.serializedRowsBytes ?? -1) >= 0 ? prior?.serializedRowsBytes ?? 0 : 0) + added } satisfies SizeReceipt });
      }
      return result;
    } finally { this.measured.delete(transaction); }
  }
  async inspect() {
    if (this.upgradeBlocked) return { status: 'IntegrityBlocked' as const };
    try { return { status: 'Readable' as const, root: await this.roots.get('active') }; }
    catch { return { status: 'IntegrityBlocked' as const }; }
  }
  async diagnosticTransaction(): Promise<boolean> {
    const retryBlockedOpen = this.upgradeBlocked;
    this.upgradeBlocked = false;
    try {
      if (retryBlockedOpen) await this.open();
      await this.transaction('rw', this.diagnostic, async () => {
        await this.diagnostic.put({ key: 'probe', value: 'probe' });
        if ((await this.diagnostic.get('probe'))?.value !== 'probe') throw new Error('Diagnostic read mismatch');
        await this.diagnostic.delete('probe');
      });
      return true;
    } catch { return false; }
  }
}
export interface CapacityEvidence { M: number; L: number; C: number; Q: number; H: number; quota: number; usage: number; method: 'SerializedActiveLowerBound' | 'UnmeasuredConservative' }
export interface HostChecks { transaction: boolean; capacity: boolean; control: boolean; inventory: boolean; protection: 'Protected' | 'BestEffort' | 'Unavailable'; capacityEvidence?: CapacityEvidence }
export interface RuntimeHost {
  check(store: Store): Promise<HostChecks>;
  migrationCapacity?(candidateBytes: number): Promise<boolean>;
  requestDurability(): Promise<HostChecks['protection']>;
}
export interface RuntimeNotWritable {
  status: 'RuntimeNotWritable'; runtimeReadiness: 'RecoveryOnly' | 'Unsupported';
  failedChecks: string[]; workspaceStatus: 'RecoveryOnly' | 'IntegrityBlocked' | 'None'; safeActions: string[];
  capacityEvidence?: CapacityEvidence;
}
export type Readiness = { status: 'Writable'; protection: HostChecks['protection']; epoch: number; capacityEvidence?: CapacityEvidence } | RuntimeNotWritable;
export class Runtime {
  private state: Readiness = { status: 'RuntimeNotWritable', runtimeReadiness: 'Unsupported', failedChecks: ['NotChecked'], workspaceStatus: 'None', safeActions: ['Retry'] };
  private epoch = 0;
  constructor(readonly store: Store, readonly host: RuntimeHost) {}
  async establish(): Promise<Readiness> {
    const checks = await this.host.check(this.store);
    const inspection = await this.store.inspect();
    const rootProblem = inspection.status === 'Readable' && inspection.root ? rootHeaderFailure(inspection.root) : undefined;
    const integrityBlocked = inspection.status === 'IntegrityBlocked' || !!rootProblem;
    const readable = inspection.status === 'Readable' && !!inspection.root && !rootProblem;
    const failedChecks: string[] = (['transaction', 'capacity', 'control', 'inventory'] as const).filter(key => !checks[key]);
    if (inspection.status === 'IntegrityBlocked') failedChecks.push('UnreadableRoot');
    if (rootProblem) failedChecks.push(rootProblem);
    this.state = failedChecks.length
      ? { status: 'RuntimeNotWritable', runtimeReadiness: readable ? 'RecoveryOnly' : 'Unsupported', failedChecks, workspaceStatus: integrityBlocked ? 'IntegrityBlocked' : readable ? 'RecoveryOnly' : 'None', safeActions: ['Retry', 'Try another browser; its storage is separate'], capacityEvidence: checks.capacityEvidence }
      : { status: 'Writable', protection: checks.protection, epoch: ++this.epoch, capacityEvidence: checks.capacityEvidence };
    return this.state;
  }
  invalidate(failure: string): void {
    ++this.epoch;
    this.state = { status: 'RuntimeNotWritable', runtimeReadiness: 'Unsupported', failedChecks: [failure], workspaceStatus: 'None', safeActions: ['Retry'] };
  }
  current() { return this.state; }
  async mutate<T>(expectedGeneration: string | undefined, effect: (root: Root | undefined) => Promise<T>, purpose: 'Ordinary' | 'Migration' = 'Ordinary'): Promise<T | RuntimeNotWritable | { status: 'Conflict'; reason: 'GenerationChanged' }> {
    const readiness = await this.establish();
    if (readiness.status !== 'Writable') return readiness;
    return this.store.transaction('rw', [this.store.roots, this.store.versions, this.store.lifecycle, this.store.projections], async () => {
      if (this.state.status !== 'Writable' || this.state.epoch !== readiness.epoch) return this.state as RuntimeNotWritable;
      const root = await this.store.roots.get('active');
      if (root?.generation !== expectedGeneration) return { status: 'Conflict' as const, reason: 'GenerationChanged' as const };
      if (root?.schema === 1 && purpose !== 'Migration') {
        this.state = { status: 'RuntimeNotWritable', runtimeReadiness: 'RecoveryOnly', failedChecks: ['MigrationRequired'], workspaceStatus: 'RecoveryOnly', safeActions: ['Retry startup to migrate', 'Read retained history; backup is not installed'] };
        return this.state;
      }
      const rootProblem = root && rootHeaderFailure(root);
      if (rootProblem) {
        ++this.epoch;
        this.state = { status: 'RuntimeNotWritable', runtimeReadiness: 'Unsupported', workspaceStatus: 'IntegrityBlocked', failedChecks: [rootProblem], safeActions: ['Retry'] };
        return this.state;
      }
      return this.store.measureMutation(root, () => effect(root));
    });
  }
}

export function addedRecords(root: Root, versions: number, lifecycle = 0) {
  return root.recordCounts ? { versions: root.recordCounts.versions + versions, lifecycle: root.recordCounts.lifecycle + lifecycle } : undefined;
}
