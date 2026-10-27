import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  type OfflineReleaseInventory,
  verifyOfflineReleaseInventory,
  verifyWebAppManifest,
} from '../release-inventory';
import { UpdateCoordinator } from '../update-coordinator';

// Independent NIST FIPS 180-4 known SHA-256 test vectors (never recomputed by the system under test):
const SHA256_EMPTY = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const SHA256_SINGLE_A = 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb';
const SHA256_ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const SHA256_HELLO = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';

describe('Task 1.2: Web App Manifest, Service Worker & Offline Release Inventory (AC-DEL-002, AC-DEL-003)', () => {
  describe('Web App Manifest contract', () => {
    it('should expose a stable application id, name, icons, start_url, navigation scope, and standalone display mode', () => {
      const manifestRaw = JSON.parse(
        readFileSync(join(process.cwd(), 'public', 'manifest.webmanifest'), 'utf8'),
      );
      const validation = verifyWebAppManifest(manifestRaw);
      expect(validation.valid).toBe(true);
      expect(validation.issues).toEqual([]);
      expect(manifestRaw.id).toBe('/trade-journal-v3');
      expect(manifestRaw.name).toBe('Trade Journal V3');
      expect(manifestRaw.display).toBe('standalone');
      expect(manifestRaw.start_url).toBe('/');
      expect(manifestRaw.scope).toBe('/');
      expect(manifestRaw.icons.length).toBeGreaterThanOrEqual(2);
    });

    it('should contain zero trader data or mutable workspace state', () => {
      const manifestRaw = JSON.parse(
        readFileSync(join(process.cwd(), 'public', 'manifest.webmanifest'), 'utf8'),
      );
      const pollutedManifest = {
        ...manifestRaw,
        accounts: [{ id: 'acc-1' }],
      };
      const pollutedResult = verifyWebAppManifest(pollutedManifest);
      expect(pollutedResult.valid).toBe(false);
      expect(pollutedResult.issues[0]).toContain('must not contain trader data');
    });
  });

  describe('OfflineReleaseInventory verification', () => {
    it('should validate when every listed release asset is present in cache storage and its SHA-256 digest matches exactly (happy path)', async () => {
      const abcBytes = new TextEncoder().encode('abc');
      const helloBytes = new TextEncoder().encode('hello');

      const inventory: OfflineReleaseInventory = {
        releaseId: 'v1.0.0-abc123',
        generatedAt: '2026-10-27T00:00:00.000Z',
        cacheName: 'trade-journal-v3-release-v1.0.0-abc123',
        assets: [
          { path: '/index.html', sha256: SHA256_ABC, sizeBytes: 3 },
          { path: '/assets/app.js', sha256: SHA256_HELLO, sizeBytes: 5 },
        ],
      };

      const store = new Map<string, Uint8Array>([
        ['/index.html', abcBytes],
        ['/assets/app.js', helloBytes],
      ]);

      const result = await verifyOfflineReleaseInventory(
        inventory,
        async (path) => store.get(path) ?? null,
      );
      expect(result).toEqual({
        valid: true,
        releaseId: 'v1.0.0-abc123',
        cacheName: 'trade-journal-v3-release-v1.0.0-abc123',
        verifiedAssetCount: 2,
      });
    });

    it('should handle single-byte and zero-byte asset edge cases with exact SHA-256 digest verification (boundary condition)', async () => {
      const emptyBytes = new Uint8Array(0);
      const singleByteA = new TextEncoder().encode('a');

      const inventory: OfflineReleaseInventory = {
        releaseId: 'v1.0.0-boundary',
        generatedAt: '2026-10-27T00:00:00.000Z',
        cacheName: 'trade-journal-v3-release-v1.0.0-boundary',
        assets: [
          { path: '/empty.txt', sha256: SHA256_EMPTY, sizeBytes: 0 },
          { path: '/one.bin', sha256: SHA256_SINGLE_A, sizeBytes: 1 },
        ],
      };

      const store = new Map<string, Uint8Array>([
        ['/empty.txt', emptyBytes],
        ['/one.bin', singleByteA],
      ]);

      const result = await verifyOfflineReleaseInventory(
        inventory,
        async (path) => store.get(path) ?? null,
      );
      expect(result.valid).toBe(true);
    });

    it('should fail verification and report the exact missing asset path when any required entry in the Offline Release Inventory is absent (error case)', async () => {
      const helloBytes = new TextEncoder().encode('hello');

      const inventory: OfflineReleaseInventory = {
        releaseId: 'v1.0.0-missing',
        generatedAt: '2026-10-27T00:00:00.000Z',
        cacheName: 'trade-journal-v3-release-v1.0.0-missing',
        assets: [
          { path: '/index.html', sha256: SHA256_HELLO, sizeBytes: 5 },
          { path: '/assets/missing.js', sha256: SHA256_ABC, sizeBytes: 3 },
        ],
      };

      const result = await verifyOfflineReleaseInventory(inventory, async (path) =>
        path === '/index.html' ? helloBytes : null,
      );
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe('MissingAssets');
        expect(result.missingAssets).toEqual(['/assets/missing.js']);
      }
    });

    it('should fail verification and report a digest mismatch when any cached asset payload differs from its declared SHA-256 digest by even 1 byte (error case)', async () => {
      const tamperedBytes = new TextEncoder().encode('abd'); // 1 byte different from 'abc'

      const inventory: OfflineReleaseInventory = {
        releaseId: 'v1.0.0-tampered',
        generatedAt: '2026-10-27T00:00:00.000Z',
        cacheName: 'trade-journal-v3-release-v1.0.0-tampered',
        assets: [{ path: '/assets/main.js', sha256: SHA256_ABC, sizeBytes: 3 }],
      };

      const result = await verifyOfflineReleaseInventory(inventory, async () => tamperedBytes);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe('DigestMismatch');
        expect(result.digestMismatches).toHaveLength(1);
        expect(result.digestMismatches[0]?.path).toBe('/assets/main.js');
        expect(result.digestMismatches[0]?.expectedSha256).toBe(SHA256_ABC);
      }
    });

    it('should reject an empty or malformed Offline Release Inventory manifest (error case)', async () => {
      const resultNull = await verifyOfflineReleaseInventory(null, async () => null);
      expect(resultNull.valid).toBe(false);
      if (!resultNull.valid) {
        expect(resultNull.reason).toBe('MalformedInventory');
      }

      const resultEmptyAssets = await verifyOfflineReleaseInventory(
        { releaseId: 'v1', cacheName: 'c1', assets: [] },
        async () => null,
      );
      expect(resultEmptyAssets.valid).toBe(false);
    });
  });

  describe('Service Worker update staging and deferral (AC-DEL-002)', () => {
    it('should advertise UpdateAvailable only after the candidate release inventory is completely cached and all SHA-256 digests pass (happy path)', async () => {
      const abcBytes = new TextEncoder().encode('abc');
      const candidateInventory: OfflineReleaseInventory = {
        releaseId: 'v1.0.1-next',
        generatedAt: '2026-10-27T01:00:00.000Z',
        cacheName: 'trade-journal-v3-release-v1.0.1-next',
        assets: [{ path: '/index.html', sha256: SHA256_ABC, sizeBytes: 3 }],
      };

      const coordinator = new UpdateCoordinator({
        initialReleaseId: 'v1.0.0-current',
        hasUnsavedFormState: () => false,
      });

      const stageResult = await coordinator.stageCandidateRelease(
        candidateInventory,
        async () => abcBytes,
      );
      expect(stageResult).toEqual({
        kind: 'UpdateStaged',
        activeReleaseId: 'v1.0.0-current',
        stagedReleaseId: 'v1.0.1-next',
      });
      expect(coordinator.getState()).toEqual({
        status: 'UpdateAvailable',
        activeReleaseId: 'v1.0.0-current',
        stagedReleaseId: 'v1.0.1-next',
        deferredReason: undefined,
      });
    });

    it('should keep the current release in control and defer update activation with an explicit reason when the trader has dirty/unsaved form state (boundary/edge case)', async () => {
      const abcBytes = new TextEncoder().encode('abc');
      const candidateInventory: OfflineReleaseInventory = {
        releaseId: 'v1.0.1-next',
        generatedAt: '2026-10-27T01:00:00.000Z',
        cacheName: 'trade-journal-v3-release-v1.0.1-next',
        assets: [{ path: '/index.html', sha256: SHA256_ABC, sizeBytes: 3 }],
      };

      let formDirty = true;
      const onActivate = vi.fn();
      const coordinator = new UpdateCoordinator({
        initialReleaseId: 'v1.0.0-current',
        hasUnsavedFormState: () => formDirty,
        onActivateStagedWorker: onActivate,
      });

      await coordinator.stageCandidateRelease(candidateInventory, async () => abcBytes);
      const activation = await coordinator.requestSafeActivation();

      expect(activation.kind).toBe('Deferred');
      if (activation.kind === 'Deferred') {
        expect(activation.reason).toBe('UnsavedFormStateActive');
        expect(activation.activeReleaseId).toBe('v1.0.0-current');
        expect(activation.message).toContain('unsaved input');
      }
      expect(onActivate).not.toHaveBeenCalled();

      formDirty = false;
      const secondTry = await coordinator.requestSafeActivation();
      expect(secondTry).toEqual({
        kind: 'Activated',
        activeReleaseId: 'v1.0.1-next',
      });
      expect(onActivate).toHaveBeenCalledWith('v1.0.1-next');
    });

    it('should activate the staged service worker only upon an explicit safe reload/restart request when no unsaved form state is at risk (happy path)', async () => {
      const abcBytes = new TextEncoder().encode('abc');
      const candidateInventory: OfflineReleaseInventory = {
        releaseId: 'v1.0.1-next',
        generatedAt: '2026-10-27T01:00:00.000Z',
        cacheName: 'trade-journal-v3-release-v1.0.1-next',
        assets: [{ path: '/index.html', sha256: SHA256_ABC, sizeBytes: 3 }],
      };

      const onActivate = vi.fn();
      const coordinator = new UpdateCoordinator({
        initialReleaseId: 'v1.0.0-current',
        hasUnsavedFormState: () => false,
        onActivateStagedWorker: onActivate,
      });

      await coordinator.stageCandidateRelease(candidateInventory, async () => abcBytes);
      expect(onActivate).not.toHaveBeenCalled();

      const res = await coordinator.requestSafeActivation();
      expect(res.kind).toBe('Activated');
      expect(onActivate).toHaveBeenCalledTimes(1);
    });

    it('should discard the candidate update and leave the running release and Workspace untouched when candidate asset staging or digest verification fails (error case)', async () => {
      const candidateInventory: OfflineReleaseInventory = {
        releaseId: 'v1.0.1-corrupt',
        generatedAt: '2026-10-27T01:00:00.000Z',
        cacheName: 'trade-journal-v3-release-v1.0.1-corrupt',
        assets: [{ path: '/index.html', sha256: SHA256_ABC, sizeBytes: 3 }],
      };

      const coordinator = new UpdateCoordinator({
        initialReleaseId: 'v1.0.0-current',
        hasUnsavedFormState: () => false,
      });

      const stageResult = await coordinator.stageCandidateRelease(
        candidateInventory,
        async () => new TextEncoder().encode('wrong bytes'),
      );
      expect(stageResult.kind).toBe('StagingFailed');
      expect(coordinator.getState()).toEqual({
        status: 'CurrentReleaseActive',
        activeReleaseId: 'v1.0.0-current',
      });
    });
  });
});
