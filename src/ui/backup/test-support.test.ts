import { describe, expect, it } from 'vitest';
import { createBackupFacadeDouble } from './test-support.ts';

describe('backup facade double', () => {
  it('should return a rejected promise when a configured responder throws', async () => {
    const double = createBackupFacadeDouble();
    double.respond('exportBackup', () => {
      throw new Error('responder failed');
    });
    let returned: Promise<unknown> | undefined;
    expect(() => {
      returned = double.facade.exportBackup(undefined as never);
    }).not.toThrow();
    await expect(returned).rejects.toThrow('responder failed');
  });

  it('should reject an unconfigured operation with the operation name', async () => {
    const double = createBackupFacadeDouble();
    await expect(double.facade.prepareRestore(undefined as never)).rejects.toThrow('No result configured for prepareRestore');
  });
});
