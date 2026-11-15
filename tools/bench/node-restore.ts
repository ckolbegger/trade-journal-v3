// The benchmark generator's Node seams (D8 T8.18-F2, Q25): the artifact restored through the production first-run Restore
// on fake-indexeddb, with the application opened over the restored Workspace, so the generator reads the Open list and
// the Daily Review through the application itself. A full-size Restore takes about 13 minutes here.
import { IDBFactory } from 'fake-indexeddb';
import type { Application } from '../../src/app/compose.ts';
import { launchOn } from '../fixtures/workspace-fixture.ts';

export async function restoreInNode(bytes: Uint8Array, asOf: string): Promise<Application> {
  const factory = new IDBFactory();
  const first = await launchOn(factory, asOf);
  const prepared = await first.Workspace.prepareRestore({ file: new File([bytes as BlobPart], 'benchmark.tjbackup') });
  if (prepared.kind !== 'Prepared') throw new Error(`the benchmark artifact did not prepare: ${JSON.stringify(prepared).slice(0, 600)}`);
  if (prepared.preview.repairs.length > 0) throw new Error(`the benchmark artifact needed ${prepared.preview.repairs.length} repairs`);
  const applied = await first.Workspace.applyPreparedRestore({ token: prepared.token, confirmation: { kind: 'ReplaceEntireWorkspace' } });
  if (applied.kind !== 'Restored') throw new Error(`the benchmark artifact was not restored: ${JSON.stringify(applied).slice(0, 600)}`);
  // As a browser restart does: a new application over the same database.
  return launchOn(factory, asOf);
}
