import type { RuntimeHost, Store, HostChecks, CapacityEvidence } from './storage';
// Installed D1 envelope: 25,000 Plans/reflections plus metadata and index overhead.
// Future operations must preflight their own additional storage requirements.
const installedBudget = 2 * (25000 * 4096 + 25000 * 4096 + 64 * 1024 * 1024);
export class BrowserHost implements RuntimeHost {
  private registration?: Promise<ServiceWorkerRegistration>;
  async check(store: Store): Promise<HostChecks> {
    const [transaction, controlAndInventory, protection] = await Promise.all([
      store.diagnosticTransaction(), this.release(), this.protection(),
    ]);
    const capacity = await this.capacity(store);
    return { transaction, ...capacity, ...controlAndInventory, protection };
  }
  async getUpdate() {
    try {
      const registration = await this.registration;
      if (!registration) return { available: false };
      await registration.update();
      const installing = registration.installing;
      if (installing) await new Promise<void>(resolve => {
        const timeout = setTimeout(resolve, 6000);
        installing.addEventListener('statechange', () => { if (installing.state === 'installed' || installing.state === 'redundant') { clearTimeout(timeout); resolve(); } });
      });
      const worker = registration.waiting;
      if (!worker) return { available: false };
      return await new Promise<{ available: boolean; release?: string }>(resolve => {
        const channel = new MessageChannel();
        const timeout = setTimeout(() => { channel.port1.close(); resolve({ available: false }); }, 3000);
        channel.port1.onmessage = (event: MessageEvent<{ release: string; verified: boolean }>) => { clearTimeout(timeout); channel.port1.close(); resolve({ available: event.data.verified && event.data.release !== __RELEASE_ID__, release: event.data.release }); };
        worker.postMessage('VERIFY_RELEASE', [channel.port2]);
      });
    } catch { return { available: false }; }
  }
  async activateUpdate() {
    const registration = await this.registration;
    if (!registration?.waiting) return;
    let onChanged = () => {};
    const changed = new Promise<void>(resolve => { onChanged = resolve; navigator.serviceWorker.addEventListener('controllerchange', onChanged, { once: true }); });
    const permission = await new Promise<string>(resolve => {
      const channel = new MessageChannel();
      const timeout = setTimeout(() => { channel.port1.close(); resolve('Unavailable'); }, 3000);
      channel.port1.onmessage = (event: MessageEvent<string>) => { clearTimeout(timeout); channel.port1.close(); resolve(event.data); };
      registration.waiting?.postMessage('ACTIVATE_AT_SAFE_RELOAD', [channel.port2]);
    });
    if (permission !== 'Activating') { navigator.serviceWorker.removeEventListener('controllerchange', onChanged); return permission; }
    await changed;
    location.reload();
  }
  private async capacity(store: Store): Promise<{ capacity: boolean; capacityEvidence?: CapacityEvidence }> {
    try {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage; const quota = estimate.quota;
      const cacheNames = await caches.keys();
      let cacheBytes = 0;
      for (const name of cacheNames.filter(name => name.startsWith('trade-journal-release-'))) {
        const cache = await caches.open(name);
        const manifest = await cache.match('/offline-inventory.json');
        if (manifest) {
          const inventoryBytes = (await manifest.clone().arrayBuffer()).byteLength;
          const inventory = await manifest.json() as { assets: { bytes: number }[] };
          const receiptResponse = await cache.match('/__release-size');
          const receipt = receiptResponse ? await receiptResponse.clone().json() as { observedBytes?: number } : undefined;
          const observed = receipt?.observedBytes;
          cacheBytes = Math.max(cacheBytes, inventory.assets.reduce((sum, asset) => sum + asset.bytes, inventoryBytes), typeof observed === 'number' && Number.isFinite(observed) && observed >= 0 ? observed + (receiptResponse ? (await receiptResponse.arrayBuffer()).byteLength : 0) : 0);
        }
      }
      if (typeof usage !== 'number' || typeof quota !== 'number' || !Number.isFinite(usage) || !Number.isFinite(quota) || usage < 0 || quota < 0) return { capacity: false };
      const measurement = await store.transaction('r', [store.roots, store.projections], async () => store.storageMeasurement(await store.roots.get('active')));
      // Credit measured active serialized bytes once. Unmeasured index/allocation
      // overhead remains conservatively reserved; retired data/cache usage is never L.
      const live = Math.min(measurement.activeSerializedBytes, usage);
      const required = (Math.max(0, installedBudget - live) + cacheBytes) * 1.25;
      const capacityEvidence = { M: installedBudget, L: live, C: cacheBytes, Q: quota - usage, H: required, quota, usage, method: measurement.method };
      return { capacity: quota - usage >= required, capacityEvidence };
    } catch { return { capacity: false }; }
  }
  private async protection(): Promise<HostChecks['protection']> {
    try { return typeof navigator.storage.persisted === 'function' ? await navigator.storage.persisted() ? 'Protected' : 'BestEffort' : 'Unavailable'; }
    catch { return 'Unavailable'; }
  }
  async requestDurability(): Promise<HostChecks['protection']> {
    try { return typeof navigator.storage.persist === 'function' ? await navigator.storage.persist() ? 'Protected' : 'BestEffort' : 'Unavailable'; }
    catch { return 'Unavailable'; }
  }
  private async release(): Promise<{ control: boolean; inventory: boolean }> {
    if (!isSecureContext || !('serviceWorker' in navigator)) return { control: false, inventory: false };
    try {
      this.registration ??= navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
      const registration = await this.registration;
      if (!navigator.serviceWorker.controller) {
        await Promise.race([
          new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true })),
          new Promise<void>(resolve => setTimeout(resolve, 4000)),
        ]);
      }
      const controller = navigator.serviceWorker.controller;
      const worker = controller ?? registration.active;
      if (!worker) return { control: false, inventory: false };
      const result = await new Promise<{ release: string; verified: boolean } | undefined>(resolve => {
        const channel = new MessageChannel();
        const timeout = setTimeout(() => { channel.port1.close(); resolve(undefined); }, 3000);
        channel.port1.onmessage = (event: MessageEvent<{ release: string; verified: boolean }>) => { clearTimeout(timeout); channel.port1.close(); resolve(event.data); };
        worker.postMessage('VERIFY_RELEASE', [channel.port2]);
      });
      return { control: !!controller && result?.release === __RELEASE_ID__, inventory: result?.release === __RELEASE_ID__ && result.verified };
    } catch { return { control: false, inventory: false }; }
  }
}
