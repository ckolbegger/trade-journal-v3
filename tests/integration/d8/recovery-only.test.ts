// I8.5 Recovery Only (AC-DEL-005): backup and verification work in Recovery Only, preparation and apply do not.
import { describe, expect, it } from 'vitest';
import type { ReadinessCheckName } from '../../../src/delivery/runtime-not-writable.ts';
import { artifactOf, CONFIRM, dumpAll, exportBackup, file, launch, oldToken, restart, verify, w7Device } from './support.ts';

const FAILURES: readonly (readonly ReadinessCheckName[])[] = [['diagnostic'], ['inventory'], ['capacity'], ['control'], ['inventory', 'capacity']];

describe('I8.5 Recovery Only', () => {
  for (const failing of FAILURES) {
    it(`should export, verify and receipt in Recovery Only but refuse preparation and apply naming the failed checks, creating no candidate, when the host fails ${failing.join(' and ')}`, async () => {
      const d = await w7Device();
      const healthy = await launch(d);
      expect((await healthy.Workspace.getStatus()).kind).toBe('Ready');
      d.testHost.fail(failing);
      const app = await restart(healthy, d);
      const status = await app.Workspace.getStatus();
      expect(status.kind).toBe('RecoveryOnly');
      const before = await dumpAll(d.factory);

      // Export and verification keep working, and verification issues a receipt.
      const exported = await exportBackup(app, d);
      const verified = await verify(app, exported);
      expect(verified).toMatchObject({ kind: 'Completed', receipt: { sourceBinding: exported.result.sourceBinding } });

      // Preparation and apply are refused with the failed checks, and nothing is created.
      const a7 = artifactOf('backup-v7');
      const prepared = await app.Workspace.prepareRestore({ file: file(a7) });
      const applied = await app.Workspace.applyPreparedRestore({ token: oldToken(exported.result.fullDigest), confirmation: CONFIRM });
      const named = expect.arrayContaining(failing.map((check): unknown => expect.objectContaining({ check }))) as unknown;
      expect(prepared).toMatchObject({ kind: 'RuntimeNotWritable', failedChecks: named });
      expect(applied).toMatchObject({ kind: 'RuntimeNotWritable', failedChecks: named });
      expect(prepared.kind === 'RuntimeNotWritable' && prepared.failedChecks).toHaveLength(failing.length);
      expect(await dumpAll(d.factory)).toEqual(before);
    }, 60_000);
  }
});
