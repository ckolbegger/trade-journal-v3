/**
 * The one narrow port for browser-host delivery capabilities. Only this module touches host APIs;
 * every other module receives typed results and never a raw host object. Nothing here decides
 * Runtime Readiness — the port reports host facts and the readiness gate judges them.
 */
export interface StorageManagerLike {
  persisted?(): Promise<boolean>;
  persist?(): Promise<boolean>;
  estimate?(): Promise<{ readonly quota?: number; readonly usage?: number }>;
}

export interface WorkerLike {
  readonly scriptURL?: string;
  postMessage?(message: unknown): void;
  addEventListener?(type: "message", listener: (event: { data?: unknown }) => void): void;
  removeEventListener?(type: "message", listener: (event: { data?: unknown }) => void): void;
}

export interface RegistrationLike {
  readonly scope: string;
  readonly active: WorkerLike | null;
  readonly waiting: WorkerLike | null;
  readonly installing: WorkerLike | null;
  update(): Promise<unknown>;
}

export interface ServiceWorkerContainerLike {
  readonly controller: WorkerLike | null;
  register?(scriptURL: string): Promise<RegistrationLike>;
  getRegistration?(): Promise<RegistrationLike | undefined>;
  readonly ready?: Promise<RegistrationLike>;
  // Replies to a worker message arrive on the container, not on the controller object.
  addEventListener?(
    type: "message" | "controllerchange",
    listener: (event: { data?: unknown }) => void,
  ): void;
  removeEventListener?(
    type: "message" | "controllerchange",
    listener: (event: { data?: unknown }) => void,
  ): void;
}

export interface CachedResponseLike {
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface CacheStorageLike {
  match(request: string): Promise<CachedResponseLike | undefined>;
}

export interface FileLike {
  readonly name: string;
  text(): Promise<string>;
}

export interface InputLike {
  type?: string;
  accept?: string;
  style?: { display: string };
  files?: { readonly length: number; item(index: number): FileLike | null } | null;
  addEventListener?(type: "change" | "cancel", listener: () => void): void;
  removeEventListener?(type: "change" | "cancel", listener: () => void): void;
  click?(): void;
  remove?(): void;
}

export interface AnchorLike {
  href?: string;
  download?: string;
  click?(): void;
  remove?(): void;
}

export interface DocumentLike {
  createElement(tagName: string): AnchorLike & InputLike;
  appendChild?(node: unknown): unknown;
  readonly body?: { appendChild(node: unknown): unknown } | null;
}

export interface UrlLike {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
}

export interface HostEnvironment {
  readonly storageManager?: StorageManagerLike;
  readonly serviceWorker?: ServiceWorkerContainerLike;
  readonly cacheStorage?: CacheStorageLike;
  readonly document?: DocumentLike;
  readonly url?: UrlLike;
}

export type StorageProtection =
  | { readonly kind: "Protected" }
  | { readonly kind: "BestEffort"; readonly reason: string }
  | { readonly kind: "Unavailable"; readonly reason: string }
  | { readonly kind: "NotExposed" };

export type CapacityEstimate =
  | { readonly kind: "Measured"; readonly freeBytes: number; readonly quotaBytes: number }
  | { readonly kind: "Unavailable"; readonly reason: string }
  | { readonly kind: "NotExposed" };

export type DurabilityRequest =
  | { readonly kind: "Granted" }
  | { readonly kind: "Denied"; readonly reason: string }
  | { readonly kind: "NotExposed" };

export type WorkerControl =
  | { readonly kind: "Controlled"; readonly scriptURL: string; readonly releaseId?: string }
  | { readonly kind: "NotControlled"; readonly reason: string }
  | { readonly kind: "NotExposed" };

export type WorkerRegistrationResult =
  | { readonly kind: "Registered"; readonly scope: string }
  | { readonly kind: "Failed"; readonly reason: string }
  | { readonly kind: "NotExposed" };

export type WorkerStatusResult =
  | {
      readonly kind: "Reported";
      readonly controllerReleaseId?: string;
      readonly waitingReleaseId?: string;
      readonly installing: boolean;
    }
  | { readonly kind: "NotExposed" };

export type WorkerUpdateResult =
  | { readonly kind: "Checked" }
  | { readonly kind: "Failed"; readonly reason: string }
  | { readonly kind: "NotExposed" };

export type WorkerReadyResult =
  | { readonly kind: "Controlled" }
  | { readonly kind: "Failed"; readonly reason: string }
  | { readonly kind: "NotExposed" };

export type WorkerActivationResult =
  | { readonly kind: "Requested" }
  | { readonly kind: "NoWaitingWorker" }
  | { readonly kind: "Failed"; readonly reason: string }
  | { readonly kind: "NotExposed" };

export type CachedAsset =
  | { readonly kind: "Present"; readonly assetUrl: string; readonly bytes: Uint8Array }
  | { readonly kind: "Missing"; readonly assetUrl: string }
  | { readonly kind: "Unavailable"; readonly assetUrl: string; readonly reason: string }
  | { readonly kind: "NotExposed"; readonly assetUrl: string };

export type DownloadOutcome =
  | { readonly kind: "Offered" }
  | { readonly kind: "Failed"; readonly reason: string }
  | { readonly kind: "NotExposed" };

export type SelectedFile =
  | { readonly kind: "Selected"; readonly name: string; readonly text: string }
  | { readonly kind: "Cancelled" }
  | { readonly kind: "Failed"; readonly reason: string }
  | { readonly kind: "NotExposed" };

export interface HostPort {
  protection(): Promise<StorageProtection>;
  capacity(): Promise<CapacityEstimate>;
  requestDurability(): Promise<DurabilityRequest>;
  workerControl(): Promise<WorkerControl>;
  cachedAsset(assetUrl: string): Promise<CachedAsset>;
  download(fileName: string, bytes: Uint8Array, mediaType: string): Promise<DownloadOutcome>;
  readSelectedFile(): Promise<SelectedFile>;
  registerWorker(scriptUrl: string): Promise<WorkerRegistrationResult>;
  /** Wait for the installed worker of this scope to take control before the first readiness gate. */
  awaitWorkerControl(): Promise<WorkerReadyResult>;
  workerStatus(): Promise<WorkerStatusResult>;
  updateWorker(): Promise<WorkerUpdateResult>;
  activateWaitingWorker(): Promise<WorkerActivationResult>;
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// A protocol guard for a worker that never answers, not a performance measurement.
const RELEASE_REPLY_WINDOW_MS = 1500;

function askRelease(
  worker: WorkerLike | null,
  container: ServiceWorkerContainerLike,
): Promise<string | undefined> {
  if (
    worker === null ||
    worker.postMessage === undefined ||
    container.addEventListener === undefined
  ) {
    return Promise.resolve(undefined);
  }
  return new Promise<string | undefined>((resolve) => {
    let settled = false;
    const finish = (value?: string): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      container.removeEventListener?.("message", listener);
      resolve(value);
    };
    const listener = (event: { data?: unknown }): void => {
      const data = event.data as { type?: unknown; releaseId?: unknown } | undefined;
      if (data?.type === "RELEASE_ID" && typeof data.releaseId === "string") {
        finish(data.releaseId);
      }
    };
    const timer = setTimeout(() => finish(undefined), RELEASE_REPLY_WINDOW_MS);
    container.addEventListener?.("message", listener);
    worker.postMessage?.({ type: "RELEASE_ID" });
  });
}

export function createHostPort(environment: HostEnvironment): HostPort {
  async function protection(): Promise<StorageProtection> {
    const persisted = environment.storageManager?.persisted;
    if (persisted === undefined) return { kind: "NotExposed" };
    try {
      return (await persisted.call(environment.storageManager)) === true
        ? { kind: "Protected" }
        : { kind: "BestEffort", reason: "The host did not confirm persistent storage." };
    } catch (error) {
      return { kind: "Unavailable", reason: reasonOf(error) };
    }
  }

  async function capacity(): Promise<CapacityEstimate> {
    const estimate = environment.storageManager?.estimate;
    if (estimate === undefined) return { kind: "NotExposed" };
    try {
      const measured = await estimate.call(environment.storageManager);
      if (measured.quota === undefined) {
        return { kind: "Unavailable", reason: "The host reported no quota." };
      }
      const usage = measured.usage ?? 0;
      return {
        kind: "Measured",
        freeBytes: Math.max(0, measured.quota - usage),
        quotaBytes: measured.quota,
      };
    } catch (error) {
      return { kind: "Unavailable", reason: reasonOf(error) };
    }
  }

  async function requestDurability(): Promise<DurabilityRequest> {
    const persist = environment.storageManager?.persist;
    if (persist === undefined) return { kind: "NotExposed" };
    try {
      return (await persist.call(environment.storageManager)) === true
        ? { kind: "Granted" }
        : { kind: "Denied", reason: "The host denied the durability request." };
    } catch (error) {
      return { kind: "Denied", reason: reasonOf(error) };
    }
  }

  async function workerControl(): Promise<WorkerControl> {
    const container = environment.serviceWorker;
    if (container === undefined) return { kind: "NotExposed" };
    const controller = container.controller;
    if (controller === null) {
      return { kind: "NotControlled", reason: "No service worker controls this page." };
    }
    return {
      kind: "Controlled",
      scriptURL: controller.scriptURL ?? "",
      releaseId: await askRelease(controller, container),
    };
  }

  async function registration(): Promise<RegistrationLike | undefined> {
    const container = environment.serviceWorker;
    if (container === undefined) return undefined;
    if (container.getRegistration !== undefined) return container.getRegistration();
    if (container.ready !== undefined) return container.ready;
    return undefined;
  }

  async function registerWorker(scriptUrl: string): Promise<WorkerRegistrationResult> {
    const container = environment.serviceWorker;
    if (container?.register === undefined) return { kind: "NotExposed" };
    try {
      const registered = await container.register(scriptUrl);
      return { kind: "Registered", scope: registered.scope };
    } catch (error) {
      return { kind: "Failed", reason: reasonOf(error) };
    }
  }

  async function awaitWorkerControl(): Promise<WorkerReadyResult> {
    const container = environment.serviceWorker;
    if (container === undefined || container.ready === undefined) return { kind: "NotExposed" };
    try {
      await container.ready;
      if (container.controller !== null) return { kind: "Controlled" };
      if (container.addEventListener === undefined) {
        return { kind: "Failed", reason: "no service worker took control" };
      }
      return await new Promise<WorkerReadyResult>((resolve) => {
        let settled = false;
        const finish = (value: WorkerReadyResult): void => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          container.removeEventListener?.("controllerchange", listener);
          resolve(value);
        };
        const listener = (): void => finish({ kind: "Controlled" });
        const timer = setTimeout(
          () => finish({ kind: "Failed", reason: "the worker did not take control" }),
          RELEASE_REPLY_WINDOW_MS,
        );
        container.addEventListener?.("controllerchange", listener);
        if (container.controller !== null) finish({ kind: "Controlled" });
      });
    } catch (error) {
      return { kind: "Failed", reason: reasonOf(error) };
    }
  }

  async function workerStatus(): Promise<WorkerStatusResult> {
    const container = environment.serviceWorker;
    if (container === undefined) return { kind: "NotExposed" };
    try {
      const current = await registration();
      if (current === undefined) {
        return { kind: "Reported", installing: false };
      }
      return {
        kind: "Reported",
        controllerReleaseId: await askRelease(container.controller, container),
        waitingReleaseId: await askRelease(current.waiting, container),
        installing: current.installing !== null,
      };
    } catch {
      return { kind: "NotExposed" };
    }
  }

  async function updateWorker(): Promise<WorkerUpdateResult> {
    if (environment.serviceWorker === undefined) return { kind: "NotExposed" };
    try {
      const current = await registration();
      if (current === undefined) return { kind: "Failed", reason: "no registration" };
      await current.update();
      return { kind: "Checked" };
    } catch (error) {
      return { kind: "Failed", reason: reasonOf(error) };
    }
  }

  async function activateWaitingWorker(): Promise<WorkerActivationResult> {
    if (environment.serviceWorker === undefined) return { kind: "NotExposed" };
    try {
      const current = await registration();
      if (current?.waiting === null || current?.waiting === undefined) {
        return { kind: "NoWaitingWorker" };
      }
      current.waiting.postMessage?.({ type: "ACTIVATE_UPDATE" });
      return { kind: "Requested" };
    } catch (error) {
      return { kind: "Failed", reason: reasonOf(error) };
    }
  }

  async function cachedAsset(assetUrl: string): Promise<CachedAsset> {
    const cacheStorage = environment.cacheStorage;
    if (cacheStorage === undefined) return { kind: "NotExposed", assetUrl };
    try {
      const response = await cacheStorage.match(assetUrl);
      if (response === undefined) return { kind: "Missing", assetUrl };
      return { kind: "Present", assetUrl, bytes: new Uint8Array(await response.arrayBuffer()) };
    } catch (error) {
      return { kind: "Unavailable", assetUrl, reason: reasonOf(error) };
    }
  }

  async function download(
    fileName: string,
    bytes: Uint8Array,
    mediaType: string,
  ): Promise<DownloadOutcome> {
    const { document, url } = environment;
    if (document === undefined || url === undefined) return { kind: "NotExposed" };
    try {
      const buffer = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(buffer).set(bytes);
      const href = url.createObjectURL(new Blob([buffer], { type: mediaType }));
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = fileName;
      document.body?.appendChild(anchor);
      anchor.click?.();
      anchor.remove?.();
      setTimeout(() => url.revokeObjectURL(href), 0);
      return { kind: "Offered" };
    } catch (error) {
      return { kind: "Failed", reason: reasonOf(error) };
    }
  }

  async function readSelectedFile(): Promise<SelectedFile> {
    const document = environment.document;
    if (document === undefined) return { kind: "NotExposed" };
    const input = document.createElement("input");
    input.type = "file";
    document.body?.appendChild(input);
    try {
      const file = await new Promise<FileLike | null>((resolve) => {
        input.addEventListener?.("change", () => resolve(input.files?.item(0) ?? null));
        input.addEventListener?.("cancel", () => resolve(null));
        input.click?.();
      });
      if (file === null) return { kind: "Cancelled" };
      return { kind: "Selected", name: file.name, text: await file.text() };
    } catch (error) {
      return { kind: "Failed", reason: reasonOf(error) };
    } finally {
      input.remove?.();
    }
  }

  return {
    protection,
    capacity,
    requestDurability,
    workerControl,
    cachedAsset,
    download,
    readSelectedFile,
    registerWorker,
    awaitWorkerControl,
    workerStatus,
    updateWorker,
    activateWaitingWorker,
  };
}

/** The production environment. This is the only place browser host globals are read. */
export function createBrowserHostPort(): HostPort {
  return createHostPort({
    storageManager: globalThis.navigator?.storage,
    serviceWorker: globalThis.navigator?.serviceWorker,
    cacheStorage: globalThis.caches,
    document:
      typeof document === "undefined" ? undefined : (document as unknown as DocumentLike),
    url: typeof URL === "undefined" ? undefined : URL,
  });
}
