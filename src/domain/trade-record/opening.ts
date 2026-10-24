import Dexie from 'dexie';
import { Temporal } from '@js-temporal/polyfill';
import { assessChange, derive, type OpeningInput } from '../trade-analysis';
import type { Envelope, Root, Store } from '../../infrastructure/storage';
import type { TradeSnapshot } from './index';
import type { ExecutionInput, Execution, OpeningAgreement, PositionChange } from './opening-types';
export interface TradeHead { tradeId: string; revision: string; lifecycle: 'Open'; planEnvelopeVersion: string; positionChangeVersion: string; executionVersions: string[]; agreementVersion: string }
export interface OpeningPreparation { kind: 'InitialStockEntry'; trade: TradeSnapshot; command: { economicTime: string; executions: ExecutionInput[] }; root: Root; saveTime: string }
export interface PreparedOpening { kind: 'InitialStockEntry'; input: OpeningPreparation; digest: string; candidate: { candidateId: string; revision: string; digest: string; plan: TradeSnapshot['plan']; storedLifecycle: string; exposureFacts: never[]; opening: OpeningInput } }
export function prepareOpening(input: OpeningPreparation): PreparedOpening {
  const change: PositionChange = { id: 'candidate:initial', version: 'candidate:initial-version', kind: 'InitialStockEntry', tradeId: input.trade.tradeId, originTradeId: input.trade.tradeId, economicTime: input.command.economicTime, saveTime: input.saveTime, sequence: input.root.recordedSequence + 1, executionIds: input.command.executions.map((_, index) => `candidate:execution:${index}`) };
  const executions: Execution[] = input.command.executions.map((execution, index) => ({ ...structuredClone(execution), id: change.executionIds[index] ?? '', version: `candidate:execution-version:${index}`, tradeId: input.trade.tradeId, positionChangeId: change.id, saveTime: input.saveTime, sequence: change.sequence + index + 1 }));
  const digest = JSON.stringify(input);
  return { kind: 'InitialStockEntry', input: structuredClone(input), digest, candidate: { candidateId: input.trade.tradeId, revision: input.root.revision, digest, plan: structuredClone(input.trade.plan), storedLifecycle: 'Planned', exposureFacts: [], opening: { plannedLegId: input.trade.plannedLegId, positionChange: change, executions } } };
}
export async function applyOpening(store: Store, prepared: PreparedOpening, reconciliation: ReturnType<typeof derive>, root: Root) {
  if (!Dexie.currentTransaction) throw new Error('SemanticTransactionRequired');
  if (JSON.stringify(prepared) !== JSON.stringify(prepareOpening(prepared.input)) || prepared.digest !== JSON.stringify(prepared.input) || prepared.candidate.digest !== prepared.digest || prepared.candidate.revision !== root.revision || reconciliation.status !== 'Derived' || reconciliation.reconciliation.digest !== prepared.digest || reconciliation.reconciliation.expectedLifecycle !== 'Open' || reconciliation.reconciliation.candidateId !== prepared.input.trade.tradeId || reconciliation.reconciliation.revision !== root.revision) throw new Error('ReconciliationConflict');
  const old = await store.lifecycle.get(`${root.generation}:${prepared.input.trade.tradeId}`);
  if (!old || old.revision !== prepared.input.trade.revision || old.lifecycle !== 'Planned') throw new Error('ReconciliationConflict');
  const positionChange: PositionChange = { ...prepared.candidate.opening.positionChange, id: crypto.randomUUID(), version: crypto.randomUUID(), executionIds: [] };
  const executions = prepared.candidate.opening.executions.map(execution => ({ ...execution, id: crypto.randomUUID(), version: crypto.randomUUID(), positionChangeId: positionChange.id }));
  positionChange.executionIds = executions.map(execution => execution.id);
  const assessment = assessChange({ ...prepared.candidate, opening: { plannedLegId: prepared.input.trade.plannedLegId, positionChange, executions } });
  if (assessment.status !== 'Accepted' || assessment.derivation.reconciliation.expectedLifecycle !== 'Open' || !('entryResolution' in assessment.derivation)) throw new Error('ReconciliationConflict');
  const revision = crypto.randomUUID();
  const agreement: OpeningAgreement = { factRevision: revision, lotMatches: assessment.derivation.lotMatches, deviations: assessment.derivation.deviations, entryResolution: assessment.derivation.entryResolution };
  const trade: TradeSnapshot = { ...prepared.input.trade, lifecycle: 'Open', revision, opening: { plannedLegId: prepared.input.trade.plannedLegId, positionChange, executions, recordedAgreement: agreement }, stateVersionId: crypto.randomUUID() };
  const derivation = derive({ ...prepared.candidate, revision, storedLifecycle: 'Open', opening: trade.opening });
  if (derivation.status !== 'Derived' || derivation.reconciliation.expectedLifecycle !== 'Open') throw new Error('ReconciliationConflict');
  const agreementVersion = crypto.randomUUID();
  const head: TradeHead = { tradeId: trade.tradeId, revision, lifecycle: 'Open', planEnvelopeVersion: old.version, positionChangeVersion: positionChange.version, executionVersions: executions.map(execution => execution.version), agreementVersion };
  const envelope = (version: string, id: string, kind: string, economicTime: string, sequence: number, value: unknown): Envelope => ({ version, id, kind, generation: root.generation, tradeId: trade.tradeId, economicTime, saveTime: prepared.input.saveTime, sequence, commitOrdinal: root.commitOrdinal + 1, value });
  await store.versions.add(envelope(positionChange.version, positionChange.id, 'PositionChange', positionChange.economicTime, positionChange.sequence, positionChange));
  for (const execution of executions) await store.versions.add(envelope(execution.version, execution.id, 'Execution', execution.economicTime, execution.sequence, execution));
  await store.versions.add(envelope(agreementVersion, trade.tradeId, 'Agreement', positionChange.economicTime, positionChange.sequence, agreement));
  await store.versions.add(envelope(trade.stateVersionId ?? '', trade.tradeId, 'TradeState', positionChange.economicTime, positionChange.sequence, head));
  await store.lifecycle.put({ ...old, lifecycle: 'Open', version: trade.stateVersionId ?? '', revision, economicTime: positionChange.economicTime, economicOrder: (Temporal.Instant.from(positionChange.economicTime).epochNanoseconds + 8640000000000000000000n).toString().padStart(23, '0'), sequence: positionChange.sequence });
  return { trade, derivation, positionChange, executions, lastSequence: executions.at(-1)?.sequence ?? positionChange.sequence, addedRecords: executions.length + 3 };
}
