import type { RuntimeStorageProtection } from './runtime-readiness';

export interface DurabilityRequestAdapters {
  readonly getCurrentProtection: () => Promise<RuntimeStorageProtection>;
  readonly requestPersistentStorage: () => Promise<boolean>;
}

export interface DurabilityRequestResult {
  readonly outcome: 'Improved' | 'NotImproved';
  readonly previousProtection: RuntimeStorageProtection;
  readonly currentProtection: RuntimeStorageProtection;
  readonly message: string;
}

export async function requestWorkspaceDurability(
  adapters: DurabilityRequestAdapters,
): Promise<DurabilityRequestResult> {
  const previousProtection = await adapters.getCurrentProtection();
  if (previousProtection === 'PersistentGranted') {
    return {
      outcome: 'NotImproved',
      previousProtection: 'PersistentGranted',
      currentProtection: 'PersistentGranted',
      message: 'Persistent storage protection is already granted by the browser.',
    };
  }

  if (previousProtection === 'Unavailable') {
    return {
      outcome: 'NotImproved',
      previousProtection: 'Unavailable',
      currentProtection: 'Unavailable',
      message:
        'Persistent storage API is unavailable in this browser. Your workspace remains Writable under best-effort local storage.',
    };
  }

  try {
    const granted = await adapters.requestPersistentStorage();
    if (granted) {
      return {
        outcome: 'Improved',
        previousProtection,
        currentProtection: 'PersistentGranted',
        message: 'Browser granted persistent storage protection for this workspace.',
      };
    }
    return {
      outcome: 'NotImproved',
      previousProtection,
      currentProtection: 'BestEffort',
      message:
        'Browser kept best-effort storage protection. Your workspace remains Writable; consider regular backups once export is available.',
    };
  } catch {
    const current = await adapters.getCurrentProtection().catch(() => 'Unavailable' as const);
    return {
      outcome: 'NotImproved',
      previousProtection,
      currentProtection: current,
      message:
        'Could not upgrade storage durability in this browser. Your workspace remains Writable under current storage settings.',
    };
  }
}
