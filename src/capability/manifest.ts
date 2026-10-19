/**
 * The immutable Installed Capability Manifest: exactly what this release can perform end to end.
 * Undelivered capability is absent, never a fabricated domain `Unavailable`.
 */
export interface CapabilityRange {
  readonly minSchemaVersion: number;
  readonly maxSchemaVersion: number;
}

export interface InstalledOperation {
  readonly id: string;
  readonly dependencies: readonly string[];
  /** The production entry point that makes the capability reachable. */
  readonly entryPoint: string;
}

export interface InstalledCapabilityManifest {
  readonly releaseId: string;
  readonly operations: readonly InstalledOperation[];
  readonly reportFamilies: readonly string[];
  readonly providerAdapters: readonly string[];
  readonly backup: "not-installed" | "installed";
  readonly schema: CapabilityRange;
  readonly navigation: readonly string[];
  readonly installSupport: "not-claimed";
  readonly feeApplication: "not-installed";
}

export interface CapabilityProblem {
  readonly capability: string;
  readonly detail: string;
}

const OPERATIONS: readonly InstalledOperation[] = [
  { id: "runtime.readiness", dependencies: [], entryPoint: "app.startup.readiness" },
  {
    id: "release.inventoryValidation",
    dependencies: [],
    entryPoint: "app.release.inventory",
  },
  {
    id: "workspace.getStatus",
    dependencies: ["runtime.readiness"],
    entryPoint: "app.startup.status",
  },
  {
    id: "workspace.initialize",
    dependencies: ["runtime.readiness", "workspace.getStatus"],
    entryPoint: "app.startup.initialize",
  },
  {
    id: "workspace.requestDurability",
    dependencies: ["runtime.readiness"],
    entryPoint: "app.settings.durability",
  },
  { id: "referenceCatalog.query", dependencies: [], entryPoint: "app.onboarding.catalog" },
  {
    id: "referenceCatalog.save",
    dependencies: ["referenceCatalog.query"],
    entryPoint: "app.onboarding.institution",
  },
  { id: "journal.getDefinitions", dependencies: [], entryPoint: "app.journal.definitions" },
];

/** The capabilities D1 actually installs end to end; every later capability is absent. */
export const D1_CAPABILITY_MANIFEST: Omit<InstalledCapabilityManifest, "releaseId"> = {
  operations: OPERATIONS,
  reportFamilies: [],
  providerAdapters: [],
  backup: "not-installed",
  schema: { minSchemaVersion: 1, maxSchemaVersion: 1 },
  navigation: ["startup", "onboarding"],
  installSupport: "not-claimed",
  feeApplication: "not-installed",
};

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const entry of Object.values(value as Record<string, unknown>)) deepFreeze(entry);
    Object.freeze(value);
  }
  return value;
}

export function installedCapabilities(releaseId: string): InstalledCapabilityManifest {
  return deepFreeze({ releaseId, ...D1_CAPABILITY_MANIFEST });
}

/** An omitted operation is absent: `undefined`, never a domain-level Unavailable result. */
export function installedOperation(
  manifest: InstalledCapabilityManifest,
  operationId: string,
): InstalledOperation | undefined {
  return manifest.operations.find((operation) => operation.id === operationId);
}

/** Dependency closure: every declared operation's dependencies must themselves be declared. */
export function closureProblems(manifest: InstalledCapabilityManifest): CapabilityProblem[] {
  const declared = new Set(manifest.operations.map((operation) => operation.id));
  return manifest.operations.flatMap((operation) =>
    operation.dependencies
      .filter((dependency) => !declared.has(dependency))
      .map((dependency) => ({
        capability: operation.id,
        detail: `depends on the undeclared capability ${dependency}`,
      })),
  );
}

/** The runtime self-check: closure, production entry points and navigation equality. */
export function selfCheck(
  manifest: InstalledCapabilityManifest,
  availableEntryPoints: readonly string[],
  reachableNavigation: readonly string[] = manifest.navigation,
): CapabilityProblem[] {
  const problems = closureProblems(manifest);
  for (const operation of manifest.operations) {
    if (!availableEntryPoints.includes(operation.entryPoint)) {
      problems.push({
        capability: operation.id,
        detail: `the production entry point ${operation.entryPoint} is missing`,
      });
    }
  }
  for (const destination of manifest.navigation) {
    if (!reachableNavigation.includes(destination)) {
      problems.push({
        capability: `navigation.${destination}`,
        detail: "the declared navigation destination is not reachable",
      });
    }
  }
  for (const destination of reachableNavigation) {
    if (!manifest.navigation.includes(destination)) {
      problems.push({
        capability: `navigation.${destination}`,
        detail: "the production navigation offers an undeclared destination",
      });
    }
  }
  return problems;
}

/** A stale manifest must not be readable after a different release activates. */
export function assertManifestRelease(
  manifest: InstalledCapabilityManifest,
  runningReleaseId: string,
): void {
  if (manifest.releaseId !== runningReleaseId) {
    throw new Error(
      `the capability manifest belongs to release ${manifest.releaseId}, not ${runningReleaseId}`,
    );
  }
}
