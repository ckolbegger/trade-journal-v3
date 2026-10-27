export interface SchemaRange {
  readonly minVersion: number;
  readonly maxVersion: number;
}

export interface InstalledCapabilityManifest {
  readonly manifestId: string;
  readonly releaseVersion: string;
  readonly deliverableSlice: 'D01';
  readonly schemaVersion: 1;
  readonly supportedBackupSchemaRange: SchemaRange;
  readonly operations: readonly string[];
  readonly catalogOperations: readonly string[];
  readonly strategyShapes: readonly string[];
  readonly settlementVariants: readonly string[];
  readonly reportFamilies: readonly string[];
  readonly providerAdapters: readonly string[];
  readonly navigationRoutes: readonly ('overview' | 'accounts' | 'settings')[];
  readonly dependencyClosureVerified: true;
}

function deepFreeze<T extends object>(obj: T): Readonly<T> {
  Object.freeze(obj);
  for (const key of Reflect.ownKeys(obj)) {
    const value = (obj as Record<PropertyKey, unknown>)[key];
    if (
      value !== null &&
      (typeof value === 'object' || typeof value === 'function') &&
      !Object.isFrozen(value)
    ) {
      deepFreeze(value as object);
    }
  }
  return obj;
}

const INSTALLED_CAPABILITY_MANIFEST_V1: InstalledCapabilityManifest = deepFreeze({
  manifestId: 'cap-manifest-d01-v1',
  releaseVersion: '1.0.0-d01',
  deliverableSlice: 'D01',
  schemaVersion: 1,
  supportedBackupSchemaRange: {
    minVersion: 1,
    maxVersion: 1,
  },
  operations: [
    'Workspace.initialize',
    'Workspace.getStatus',
    'Workspace.saveSettings',
    'Workspace.requestDurability',
    'ReferenceCatalog.save',
    'ReferenceCatalog.query',
    'ReferenceCatalog.resolve',
  ],
  catalogOperations: [
    'ReferenceCatalog.save:CreateInstitution',
    'ReferenceCatalog.save:CreateAccount',
    'ReferenceCatalog.query:Institution',
    'ReferenceCatalog.query:Account',
    'ReferenceCatalog.resolve:NewSelection:Account',
  ],
  strategyShapes: [],
  settlementVariants: [],
  reportFamilies: [],
  providerAdapters: [],
  navigationRoutes: ['overview', 'accounts', 'settings'],
  dependencyClosureVerified: true,
});

export function getInstalledCapabilityManifest(): InstalledCapabilityManifest {
  return INSTALLED_CAPABILITY_MANIFEST_V1;
}
