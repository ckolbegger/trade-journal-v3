// The update side of A5: a newer release that installed and verified itself waits; the trader
// is told, and activation happens only when no tab has unsaved work.

export interface WorkerPort {
  postMessage(message: unknown): void;
}

export interface RegistrationPort extends EventTarget {
  readonly waiting: WorkerPort | null;
  readonly installing?: (EventTarget & { readonly state?: string }) | null;
  update(): Promise<unknown>;
}

export interface UpdateState {
  readonly notice: 'None' | 'Ready';
  // Unsaved values are never written anywhere; they only defer activation.
  readonly unsavedHere: boolean;
  // Another tab of this app reported unsaved work over the shared channel.
  readonly unsavedElsewhere: boolean;
  // Another tab activated a newer release while this tab held unsaved values.
  readonly superseded: boolean;
}

type ChannelMessage =
  | { readonly type: 'unsaved'; readonly tabId: string; readonly unsaved: boolean }
  // A newly opened tab asks the others to repeat any unsaved state they announced earlier.
  | { readonly type: 'query'; readonly tabId: string };

export interface ReleaseUpdateControllerDeps {
  readonly registration: RegistrationPort;
  readonly container: EventTarget;
  readonly channel: EventTarget & { postMessage(data: unknown): void };
  readonly reload: () => void;
}

export interface ReleaseUpdateController {
  // Function properties, so React can subscribe without binding.
  readonly state: () => UpdateState;
  readonly subscribe: (listener: () => void) => () => void;
  // Forms report whether any value differs from its initial value.
  setUnsaved(unsaved: boolean): void;
  // The tab is closing: its form is abandoned, so it no longer holds the update back.
  dispose(): void;
  // The trader's explicit Reload: the waiting release takes control, then this tab reloads.
  applyUpdate(): void;
  // Asks the host to look for a newer release; it installs and verifies itself before waiting.
  checkForUpdates(): Promise<'NoUpdate' | 'UpdateWaiting'>;
}

export function createReleaseUpdateController(deps: ReleaseUpdateControllerDeps): ReleaseUpdateController {
  let state: UpdateState = { notice: deps.registration.waiting ? 'Ready' : 'None', unsavedHere: false, unsavedElsewhere: false, superseded: false };
  const tabId = crypto.randomUUID();
  let reloading = false;
  let applying = false;
  deps.container.addEventListener('controllerchange', () => {
    if (reloading) return;
    // Another tab activated the update: a tab with nothing unsaved follows it at once, while a
    // tab with unsaved values keeps them on screen until the trader reloads.
    if (!applying && state.unsavedHere) {
      set({ ...state, superseded: true });
      return;
    }
    reloading = true;
    deps.reload();
  });
  const elsewhere = new Map<string, boolean>();
  const listeners = new Set<() => void>();
  const set = (next: UpdateState) => {
    state = next;
    for (const listener of listeners) listener();
  };
  deps.channel.addEventListener('message', (event) => {
    const message = (event as MessageEvent<ChannelMessage>).data;
    if (message.tabId === tabId) return;
    if (message.type === 'query') {
      if (state.unsavedHere) deps.channel.postMessage({ type: 'unsaved', tabId, unsaved: true } satisfies ChannelMessage);
      return;
    }
    elsewhere.set(message.tabId, message.unsaved);
    set({ ...state, unsavedElsewhere: [...elsewhere.values()].some(Boolean) });
  });
  deps.channel.postMessage({ type: 'query', tabId } satisfies ChannelMessage);
  deps.registration.addEventListener('updatefound', () => {
    if (deps.registration.waiting) set({ ...state, notice: 'Ready' });
  });
  return {
    state: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setUnsaved(unsaved) {
      if (unsaved === state.unsavedHere) return;
      set({ ...state, unsavedHere: unsaved });
      deps.channel.postMessage({ type: 'unsaved', tabId, unsaved } satisfies ChannelMessage);
    },
    async checkForUpdates() {
      await deps.registration.update();
      // A release found by the check may still be installing and verifying; wait for it to
      // finish (waiting) or be discarded (redundant) before answering.
      const installing = deps.registration.installing;
      if (installing) {
        await new Promise<void>((resolve) => {
          const settle = () => {
            if (installing.state === 'installing') return;
            installing.removeEventListener('statechange', settle);
            resolve();
          };
          installing.addEventListener('statechange', settle);
        });
      }
      return deps.registration.waiting ? 'UpdateWaiting' : 'NoUpdate';
    },
    applyUpdate() {
      applying = true;
      deps.registration.waiting?.postMessage({ type: 'ApplyUpdate' });
    },
    dispose() {
      if (state.unsavedHere) deps.channel.postMessage({ type: 'unsaved', tabId, unsaved: false } satisfies ChannelMessage);
    },
  };
}
