// I8.7 Repairs and rejections (AC-LIFE-003): a coherent disagreement is repaired in the candidate and disclosed; an
// incoherent artifact is rejected with every issue.
import { describe, expect, it } from 'vitest';
import type { Application } from '../../../src/app/compose.ts';
import { artifactOf, CONFIRM, DECLINE, dumpAll, editedArtifact, expectUnchangedWithoutCandidate, linesOf, prepare, prepared, restart, wtDevice } from './support.ts';

type Fact = { factId: string; kind: string; versions: { value: Record<string, unknown> }[] };

// The Detail of a Trade that has started (the Open and Closed forms carry findings and Entry Size occurrences).
async function startedDetail(app: Application, tradeId: string) {
  const detail = await app.TradeViewsAndReporting.getTradeDetail({ tradeId });
  if (detail.kind !== 'Ready' || !('findings' in detail.view) || !('deviations' in detail.view)) throw new Error(`getTradeDetail ${tradeId}: ${detail.kind}`);
  return detail.view;
}

const linesOfStore = (bytes: Uint8Array, store: string): string[] => linesOf(bytes).filter((line) => line.startsWith('{"r":') && line.endsWith(`,"t":"${store}"}`));

// Edits the records of one store of A7: `change` returns true when it changed the record.
function editStore(artifact: { lines: string[] }, store: string, change: (record: Record<string, unknown>) => boolean): void {
  artifact.lines.forEach((line, index) => {
    if (!line.startsWith('{"r":') || !line.endsWith(`,"t":"${store}"}`)) return;
    const envelope = JSON.parse(line) as { r: Record<string, unknown> };
    if (change(envelope.r)) artifact.lines[index] = JSON.stringify(envelope);
  });
}

describe('I8.7 Repairs and rejections', () => {
  it('should reject the artifact holding R-ref, R-anchor, R-dup and R-inc with four issues leaving W-t unchanged, then prepare and apply the artifact holding R-lc and R-dev with two disclosed repairs, T-A Closed in agreement and the occurrence present with its fingerprint', async () => {
    const { d, app } = await wtDevice();
    const a7 = artifactOf('backup-v7');
    const before = await dumpAll(d.factory);

    // R-ref: a Trade naming an unknown Account. R-inc: an Execution naming an unknown Planned Leg. R-dup: one fact identity
    // used by two Executions. R-anchor: a Position Change Reflection Entry anchored to an unknown fact.
    // R-dup takes one Execution identity of fx-0117 and gives it to the first Execution of fx-0132 (whose Position Change
    // follows it), so that the duplicate is the only thing wrong with fx-0132.
    let shared = '';
    for (const line of linesOfStore(a7, 'trades')) {
      const trade = JSON.parse(line) as { r: { tradeId: string; facts: Fact[] } };
      if (trade.r.tradeId === 'fx-0117') shared = trade.r.facts.find((fact) => fact.kind === 'Execution')!.factId;
    }
    const broken = editedArtifact(a7, (artifact) => {
      editStore(artifact, 'trades', (trade) => {
        const facts = trade['facts'] as Fact[];
        const executions = facts.filter((fact) => fact.kind === 'Execution');
        if (trade['tradeId'] === 'fx-0049') {
          trade['accountId'] = 'acct-unknown';
        } else if (trade['tradeId'] === 'fx-0092') {
          executions[0]!.versions[0]!.value['intent'] = { kind: 'ServesPlannedLeg', plannedLegId: 'no-such-leg' };
        } else if (trade['tradeId'] === 'fx-0132') {
          const original = executions[0]!.factId;
          executions[0]!.factId = shared;
          for (const change of facts.filter((fact) => fact.kind === 'PositionChange')) {
            const ids = change.versions[0]!.value['memberIds'] as string[];
            change.versions[0]!.value['memberIds'] = ids.map((id) => (id === original ? shared : id));
          }
        } else {
          return false;
        }
        return true;
      });
      let anchored = false;
      editStore(artifact, 'journalEntries', (entry) => {
        const origin = entry['origin'] as { kind: string; factId: string };
        if (anchored || origin.kind !== 'PositionChange') return false;
        anchored = true;
        origin.factId = 'no-such-fact';
        return true;
      });
    });
    const rejected = await prepare(app, broken);
    if (rejected.kind !== 'Rejected') throw new Error(`prepareRestore: ${JSON.stringify(rejected)}`);
    expect(rejected.issues).toHaveLength(4);
    expect(rejected.totalIssues).toBe(4);
    expect(rejected.issues).toEqual(
      expect.arrayContaining([
        { code: 'CrossSectionReference', kind: 'Account', identity: 'acct-unknown' },
        { code: 'CrossSectionReference', kind: 'PositionChange', identity: 'no-such-fact' },
        { code: 'IncoherentFacts', section: 'trades' },
        { code: 'DuplicateFactIdentity', section: 'trades' },
      ]),
    );
    expectUnchangedWithoutCandidate(await dumpAll(d.factory), before);

    // R-lc: T-A (fx-0145, Closed) stored as Open. R-dev: Open Trade fx-0075 with its recorded Entry Size occurrence removed.
    const repairable = editedArtifact(a7, (artifact) => {
      editStore(artifact, 'trades', (trade) => {
        if (trade['tradeId'] === 'fx-0145') trade['lifecycle'] = 'Open';
        else if (trade['tradeId'] === 'fx-0075') delete trade['deviations'];
        else return false;
        return true;
      });
    });
    const { token, preview } = await prepared(app, repairable);
    expect(preview.repairs.map(({ tradeId, kind, stored, expected }) => ({ tradeId, kind, stored, expected }))).toEqual([
      { tradeId: 'fx-0075', kind: 'EntrySizeDeviation', stored: 'None', expected: '20' },
      { tradeId: 'fx-0145', kind: 'Lifecycle', stored: 'Open', expected: 'Closed' },
    ]);
    const applied = await app.Workspace.applyPreparedRestore({ token, confirmation: CONFIRM, safety: DECLINE });
    expect(applied).toMatchObject({ kind: 'Restored', receipt: { repairs: preview.repairs } });

    // After a restart: T-A is Closed with lifecycle agreement and no integrity finding, and the occurrence is back with its fingerprint.
    const restored = await restart(app, d);
    const tA = await startedDetail(restored, 'fx-0145');
    expect(tA.lifecycle).toEqual({ stored: 'Closed', agreement: { kind: 'Agrees' } });
    expect(tA.findings).toEqual([]);
    const open = await startedDetail(restored, 'fx-0075');
    expect(open.findings).toEqual([]);
    expect(open.deviations.map((o) => o.versions.at(-1)!)).toEqual([
      expect.objectContaining({ fingerprint: { tradeId: 'fx-0075', plannedLegId: 'fx-0077', positionChangeId: 'fx-0087' }, quantityAbovePlan: '20' }),
    ]);
  }, 120_000);
});
