import {
  type OfflineReleaseInventory,
  type ReleaseInventoryVerificationResult,
  verifyOfflineReleaseInventory,
} from './release-inventory';

export type UpdateCoordinatorState =
  | {
      readonly status: 'CurrentReleaseActive';
      readonly activeReleaseId: string;
    }
  | {
      readonly status: 'UpdateAvailable';
      readonly activeReleaseId: string;
      readonly stagedReleaseId: string;
      readonly deferredReason?: string;
    };

export type StageUpdateResult =
  | {
      readonly kind: 'UpdateStaged';
      readonly activeReleaseId: string;
      readonly stagedReleaseId: string;
    }
  | {
      readonly kind: 'StagingFailed';
      readonly activeReleaseId: string;
      readonly verification: Extract<ReleaseInventoryVerificationResult, { valid: false }>;
    };

export type RequestUpdateActivationResult =
  | {
      readonly kind: 'Activated';
      readonly activeReleaseId: string;
    }
  | {
      readonly kind: 'Deferred';
      readonly activeReleaseId: string;
      readonly stagedReleaseId: string;
      readonly reason: 'UnsavedFormStateActive';
      readonly message: string;
    }
  | {
      readonly kind: 'NoStagedUpdate';
      readonly activeReleaseId: string;
    };

export interface UpdateCoordinatorOptions {
  readonly initialReleaseId: string;
  readonly hasUnsavedFormState: () => boolean;
  readonly onActivateStagedWorker?: (stagedReleaseId: string) => Promise<void> | void;
}

export class UpdateCoordinator {
  private activeReleaseId: string;
  private stagedInventory: OfflineReleaseInventory | null = null;
  private deferredReason: string | undefined = undefined;
  private readonly hasUnsavedFormState: () => boolean;
  private readonly onActivateStagedWorker?: (stagedReleaseId: string) => Promise<void> | void;
  private readonly listeners = new Set<(state: UpdateCoordinatorState) => void>();

  constructor(options: UpdateCoordinatorOptions) {
    this.activeReleaseId = options.initialReleaseId;
    this.hasUnsavedFormState = options.hasUnsavedFormState;
    this.onActivateStagedWorker = options.onActivateStagedWorker;
  }

  public getState(): UpdateCoordinatorState {
    if (this.stagedInventory) {
      return {
        status: 'UpdateAvailable',
        activeReleaseId: this.activeReleaseId,
        stagedReleaseId: this.stagedInventory.releaseId,
        deferredReason: this.deferredReason,
      };
    }
    return {
      status: 'CurrentReleaseActive',
      activeReleaseId: this.activeReleaseId,
    };
  }

  public subscribe(listener: (state: UpdateCoordinatorState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  public async stageCandidateRelease(
    candidateInventory: unknown,
    readCandidateAssetBytes: (path: string) => Promise<Uint8Array | null>,
  ): Promise<StageUpdateResult> {
    const verification = await verifyOfflineReleaseInventory(
      candidateInventory,
      readCandidateAssetBytes,
    );
    if (!verification.valid) {
      return {
        kind: 'StagingFailed',
        activeReleaseId: this.activeReleaseId,
        verification,
      };
    }

    this.stagedInventory = candidateInventory as OfflineReleaseInventory;
    this.deferredReason = undefined;
    this.notify();
    return {
      kind: 'UpdateStaged',
      activeReleaseId: this.activeReleaseId,
      stagedReleaseId: verification.releaseId,
    };
  }

  public async requestSafeActivation(): Promise<RequestUpdateActivationResult> {
    if (!this.stagedInventory) {
      return {
        kind: 'NoStagedUpdate',
        activeReleaseId: this.activeReleaseId,
      };
    }

    if (this.hasUnsavedFormState()) {
      const message =
        'Update activation is deferred because an active form has unsaved input. Save or cancel your form before reloading to activate the update.';
      this.deferredReason = message;
      this.notify();
      return {
        kind: 'Deferred',
        activeReleaseId: this.activeReleaseId,
        stagedReleaseId: this.stagedInventory.releaseId,
        reason: 'UnsavedFormStateActive',
        message,
      };
    }

    const nextReleaseId = this.stagedInventory.releaseId;
    if (this.onActivateStagedWorker) {
      await this.onActivateStagedWorker(nextReleaseId);
    }
    this.activeReleaseId = nextReleaseId;
    this.stagedInventory = null;
    this.deferredReason = undefined;
    this.notify();

    return {
      kind: 'Activated',
      activeReleaseId: this.activeReleaseId,
    };
  }
}
