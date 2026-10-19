/**
 * The immutable Installed Capability Manifest: exactly what this release can perform end to end.
 * Undelivered capability is absent, never a fabricated domain `Unavailable`.
 */
export interface CapabilityRange {
  readonly minSchemaVersion: number;
  readonly maxSchemaVersion: number;
}

export interface InstalledCapabilityManifest {
  readonly releaseId: string;
  readonly operations: readonly string[];
  readonly reportFamilies: readonly string[];
  readonly providerAdapters: readonly string[];
  readonly backup: "not-installed" | "installed";
  readonly schema: CapabilityRange;
  readonly navigation: readonly string[];
  readonly installSupport: "not-claimed";
  readonly feeApplication: "not-installed";
}

export const D1_CAPABILITY_MANIFEST: Omit<InstalledCapabilityManifest, "releaseId"> = {
  operations: [
    "workspace.initialize",
    "workspace.getStatus",
    "workspace.requestDurability",
    "referenceCatalog.save",
    "referenceCatalog.query",
    "journal.getDefinitions",
    "runtime.readiness",
    "release.inventoryValidation",
  ],
  reportFamilies: [],
  providerAdapters: [],
  backup: "not-installed",
  schema: { minSchemaVersion: 1, maxSchemaVersion: 1 },
  navigation: ["startup", "onboarding"],
  installSupport: "not-claimed",
  feeApplication: "not-installed",
};

export function installedCapabilities(releaseId: string): InstalledCapabilityManifest {
  return { releaseId, ...D1_CAPABILITY_MANIFEST };
}
