import { describe, expect, it } from 'vitest';
import { getInstalledCapabilityManifest } from '../capability-manifest';

describe('Task 1.1: Installed Capability Manifest v1 & Toolchain Contracts (AC-CAP-001)', () => {
  describe('getInstalledCapabilityManifest()', () => {
    it('should return an immutable manifest bound to release v1 and schema version 1', () => {
      const manifest = getInstalledCapabilityManifest();
      expect(manifest.manifestId).toBe('cap-manifest-d01-v1');
      expect(manifest.releaseVersion).toBe('1.0.0-d01');
      expect(manifest.deliverableSlice).toBe('D01');
      expect(manifest.schemaVersion).toBe(1);
      expect(manifest.supportedBackupSchemaRange).toEqual({ minVersion: 1, maxVersion: 1 });
    });

    it('should declare only Deliverable 1 operations (Workspace.initialize, getStatus, saveSettings, requestDurability, and ReferenceCatalog Institution/Account creation, query, and NewSelection resolution)', () => {
      const manifest = getInstalledCapabilityManifest();
      expect(manifest.operations).toEqual([
        'Workspace.initialize',
        'Workspace.getStatus',
        'Workspace.saveSettings',
        'Workspace.requestDurability',
        'ReferenceCatalog.save',
        'ReferenceCatalog.query',
        'ReferenceCatalog.resolve',
      ]);
      expect(manifest.catalogOperations).toEqual([
        'ReferenceCatalog.save:CreateInstitution',
        'ReferenceCatalog.save:CreateAccount',
        'ReferenceCatalog.query:Institution',
        'ReferenceCatalog.query:Account',
        'ReferenceCatalog.resolve:NewSelection:Account',
      ]);
    });

    it('should be dependency-closed so every declared operation has its required persistence store and UI entry point', () => {
      const manifest = getInstalledCapabilityManifest();
      expect(manifest.dependencyClosureVerified).toBe(true);
      expect(manifest.navigationRoutes).toEqual(['overview', 'accounts', 'settings']);
    });

    it('should omit undelivered capabilities (Tradeplanning, Executions, Daily Review, Reports, Backup/Restore, Catalog rename/archive) rather than advertising partial operations or domain-level Unavailable states', () => {
      const manifest = getInstalledCapabilityManifest();
      const allDeclared = [...manifest.operations, ...manifest.catalogOperations];
      expect(allDeclared).not.toContain('TradeWorkflows.confirmPlan');
      expect(allDeclared).not.toContain('TradeWorkflows.recordPositionChange');
      expect(allDeclared).not.toContain('DailyReview.open');
      expect(allDeclared).not.toContain('Workspace.exportBackup');
      expect(allDeclared).not.toContain('Workspace.prepareRestore');
      expect(allDeclared).not.toContain('ReferenceCatalog.save:Rename');
      expect(allDeclared).not.toContain('ReferenceCatalog.save:Archive');
      expect(manifest.strategyShapes).toHaveLength(0);
      expect(manifest.reportFamilies).toHaveLength(0);
      expect(manifest.settlementVariants).toHaveLength(0);
      expect(manifest.providerAdapters).toHaveLength(0);
    });

    it('should freeze the manifest object deeply so callers cannot mutate or toggle capabilities at runtime (boundary/error case)', () => {
      const manifest = getInstalledCapabilityManifest();
      expect(Object.isFrozen(manifest)).toBe(true);
      expect(Object.isFrozen(manifest.operations)).toBe(true);
      expect(Object.isFrozen(manifest.catalogOperations)).toBe(true);
      expect(Object.isFrozen(manifest.supportedBackupSchemaRange)).toBe(true);

      expect(() => {
        (manifest as { schemaVersion: number }).schemaVersion = 99;
      }).toThrow(TypeError);
      expect(() => {
        (manifest.operations as string[]).push('Workspace.exportBackup');
      }).toThrow(TypeError);
    });
  });
});
