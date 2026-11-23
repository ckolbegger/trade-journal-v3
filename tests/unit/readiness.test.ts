import { describe, expect, it } from 'vitest';
import {
  createRuntimeReadinessController,
  MINIMUM_REQUIRED_HEADROOM_BYTES,
  type ReadinessProbes,
} from '../../src/runtime/readiness';
import { verifyOfflineInventory } from '../../src/runtime/inventory';
import { createFixedClock } from '../../src/shared/clock';

function makePassingProbes(overrides: Partial<ReadinessProbes> = {}): ReadinessProbes {
  return {
    runStorageDiagnostic: async () => ({ ok: true }),
    inspectRoot: async () => ({ status: 'Empty' }),
    estimateCapacity: async () => ({
      supported: true,
      quotaBytes: 500 * 1024 * 1024,
      usageBytes: 10 * 1024 * 1024,
    }),
    checkServiceWorkerControl: async () => ({
      controlled: true,
      releaseId: 'rel-abc123',
    }),
    verifyOfflineInventory: async () => ({
      valid: true,
      releaseId: 'rel-abc123',
      assetCount: 4,
    }),
    checkStorageProtection: async () => ({ state: 'Protected' }),
    ...overrides,
  };
}

describe('RuntimeReadiness seam', () => {
  it('returns Writable when all four browser-neutral checks pass, even when storage protection is BestEffort', async () => {
    const controller = createRuntimeReadinessController({
      clock: createFixedClock('2026-11-23T12:00:00.000Z'),
      probes: makePassingProbes({
        checkStorageProtection: async () => ({
          state: 'BestEffort',
          reason: 'Browser has not granted persistent storage.',
        }),
      }),
    });

    const result = await controller.evaluate();
    expect(result.state).toBe('Writable');
    expect(result.integrityBlocked).toBe(false);
    expect(result.failedChecks).toEqual([]);
    expect(result.storageProtection.state).toBe('BestEffort');
    expect(result.showProtectionWarning).toBe(true);
    expect(controller.checkWritable()).toEqual({ writable: true });
  });

  it('reports every simultaneous failed check in Unsupported when no workspace exists', async () => {
    const controller = createRuntimeReadinessController({
      clock: createFixedClock('2026-11-23T12:00:00.000Z'),
      probes: makePassingProbes({
        estimateCapacity: async () => ({
          supported: true,
          quotaBytes: MINIMUM_REQUIRED_HEADROOM_BYTES - 1,
          usageBytes: 0,
        }),
        checkServiceWorkerControl: async () => ({
          controlled: false,
          reason: 'Service worker is not controlling this tab.',
        }),
        verifyOfflineInventory: async () => ({
          valid: false,
          reason: 'Asset /index.html digest mismatch.',
        }),
      }),
    });

    const result = await controller.evaluate();
    expect(result.state).toBe('Unsupported');
    expect(result.failedChecks).toEqual([
      'capacity_headroom',
      'service_worker_control',
      'offline_inventory',
    ]);
    expect(controller.checkWritable()).toEqual({
      writable: false,
      reason: 'Unsupported',
      failedChecks: ['capacity_headroom', 'service_worker_control', 'offline_inventory'],
    });
  });

  it('returns RecoveryOnly when a check fails but an existing workspace root remains readable', async () => {
    const controller = createRuntimeReadinessController({
      clock: createFixedClock('2026-11-23T12:00:00.000Z'),
      probes: makePassingProbes({
        inspectRoot: async () => ({
          status: 'Present',
          activeGeneration: 1,
          schemaVersion: 1,
          workspaceMeta: {
            key: 'singleton',
            schemaVersion: 1,
            timeZone: 'America/New_York',
            settingsRevision: 1,
            workspaceRevision: 1,
            initializedAt: '2026-11-22T00:00:00.000Z',
            updatedAt: '2026-11-22T00:00:00.000Z',
          },
        }),
        verifyOfflineInventory: async () => ({
          valid: false,
          reason: 'Missing cached asset /assets/index.js',
        }),
      }),
    });

    const result = await controller.evaluate();
    expect(result.state).toBe('RecoveryOnly');
    expect(result.integrityBlocked).toBe(false);
    expect(result.failedChecks).toEqual(['offline_inventory']);
    expect(controller.checkWritable()).toEqual({
      writable: false,
      reason: 'RecoveryOnly',
      failedChecks: ['offline_inventory'],
    });
  });

  it('marks Unsupported with integrityBlocked=true when existing storage root cannot be read and preserves integrityBlocked across invalidateWritable', async () => {
    const controller = createRuntimeReadinessController({
      clock: createFixedClock('2026-11-23T12:00:00.000Z'),
      probes: makePassingProbes({
        inspectRoot: async () => ({
          status: 'IntegrityBlocked',
          reason: 'Bootstrap pointer failed validation.',
        }),
      }),
    });

    const result = await controller.evaluate();
    expect(result.state).toBe('Unsupported');
    expect(result.integrityBlocked).toBe(true);
    expect(controller.checkWritable()).toEqual({
      writable: false,
      reason: 'IntegrityBlocked',
      failedChecks: ['storage_diagnostic'],
    });

    // invalidateWritable must never downgrade IntegrityBlocked to RecoveryOnly
    const afterInvalidate = controller.invalidateWritable(
      'offline_inventory',
      'Cache failure',
      true,
    );
    expect(afterInvalidate.integrityBlocked).toBe(true);
    expect(afterInvalidate.state).toBe('Unsupported');
    expect(controller.checkWritable().writable).toBe(false);
  });

  it('immediately invalidates Writable on a mid-session runtime fault and handles rejecting probes without leaving Writable stale', async () => {
    let shouldThrow = false;
    const controller = createRuntimeReadinessController({
      clock: createFixedClock('2026-11-23T12:00:00.000Z'),
      probes: makePassingProbes({
        estimateCapacity: async () => {
          if (shouldThrow) {
            throw new Error('StorageManager crashed');
          }
          return {
            supported: true,
            quotaBytes: 500 * 1024 * 1024,
            usageBytes: 10 * 1024 * 1024,
          };
        },
      }),
    });

    await controller.evaluate();
    expect(controller.checkWritable()).toEqual({ writable: true });

    shouldThrow = true;
    const afterThrow = await controller.evaluate();
    expect(afterThrow.state).toBe('Unsupported');
    expect(afterThrow.failedChecks).toContain('capacity_headroom');
    expect(controller.checkWritable().writable).toBe(false);

    const invalidated = controller.invalidateWritable(
      'storage_diagnostic',
      'QuotaExceededError during commit',
      true,
    );
    expect(invalidated.state).toBe('RecoveryOnly');
    expect(invalidated.failedChecks).toContain('storage_diagnostic');
  });
});

describe('Offline Release Inventory SHA-256 verification', () => {
  it('passes when every asset matches SHA-256 and byte size, and rejects tampering, missing assets, size mismatch, or protocol-relative URLs', async () => {
    const htmlBytes = new TextEncoder().encode('<!doctype html><title>TJ</title>');
    const digestBuf = await crypto.subtle.digest('SHA-256', htmlBytes);
    const expectedHex = Array.from(new Uint8Array(digestBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const inventory = {
      schemaVersion: 1 as const,
      releaseId: 'rel-test-1',
      assets: [{ url: '/index.html', sha256: expectedHex, size: htmlBytes.byteLength }],
    };

    const validResult = await verifyOfflineInventory(inventory, async (url) =>
      url === '/index.html' ? htmlBytes : null,
    );
    expect(validResult).toEqual({
      valid: true,
      releaseId: 'rel-test-1',
      assetCount: 1,
    });

    const sizeMismatch = await verifyOfflineInventory(
      {
        ...inventory,
        assets: [{ url: '/index.html', sha256: expectedHex, size: htmlBytes.byteLength + 1 }],
      },
      async () => htmlBytes,
    );
    expect(sizeMismatch.valid).toBe(false);

    const protocolRelative = await verifyOfflineInventory(
      {
        ...inventory,
        assets: [{ url: '//evil.example/index.html', sha256: expectedHex, size: htmlBytes.byteLength }],
      },
      async () => htmlBytes,
    );
    expect(protocolRelative.valid).toBe(false);

    const tamperedResult = await verifyOfflineInventory(inventory, async () =>
      new TextEncoder().encode('<!doctype html><title>TAMPERED</title>'),
    );
    expect(tamperedResult.valid).toBe(false);

    const missingResult = await verifyOfflineInventory(inventory, async () => null);
    expect(missingResult.valid).toBe(false);
  });
});
