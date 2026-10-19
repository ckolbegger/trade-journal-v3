import { describe, expect, it } from "vitest";
import { createHostPort } from "../../src/platform/host";

describe("the browser-host port reports typed absence and never throws", () => {
  it("should return typed NotExposed for every capability the host does not implement", async () => {
    const absent = createHostPort({});

    await expect(absent.protection()).resolves.toEqual({ kind: "NotExposed" });
    await expect(absent.capacity()).resolves.toEqual({ kind: "NotExposed" });
    await expect(absent.requestDurability()).resolves.toEqual({ kind: "NotExposed" });
    await expect(absent.workerControl()).resolves.toEqual({ kind: "NotExposed" });
    await expect(absent.cachedAsset("/index.html")).resolves.toEqual({
      kind: "NotExposed",
      assetUrl: "/index.html",
    });
    await expect(absent.download("a.txt", new Uint8Array(), "text/plain")).resolves.toEqual({
      kind: "NotExposed",
    });
    await expect(absent.readSelectedFile()).resolves.toEqual({ kind: "NotExposed" });
  });

  it("should report protection exactly as the host reports it and never throw", async () => {
    const granted = createHostPort({ storageManager: { persisted: async () => true } });
    await expect(granted.protection()).resolves.toEqual({ kind: "Protected" });

    const bestEffort = createHostPort({ storageManager: { persisted: async () => false } });
    await expect(bestEffort.protection()).resolves.toEqual({
      kind: "BestEffort",
      reason: "The host did not confirm persistent storage.",
    });

    const unavailable = createHostPort({
      storageManager: {
        persisted: async () => {
          throw new Error("denied by policy");
        },
      },
    });
    await expect(unavailable.protection()).resolves.toEqual({
      kind: "Unavailable",
      reason: "denied by policy",
    });
  });

  it("should measure free capacity from the host estimate and refuse to invent one", async () => {
    const measured = createHostPort({
      storageManager: { estimate: async () => ({ quota: 1000, usage: 250 }) },
    });
    await expect(measured.capacity()).resolves.toEqual({
      kind: "Measured",
      freeBytes: 750,
      quotaBytes: 1000,
    });

    const noQuota = createHostPort({ storageManager: { estimate: async () => ({}) } });
    await expect(noQuota.capacity()).resolves.toEqual({
      kind: "Unavailable",
      reason: "The host reported no quota.",
    });
  });

  it("should report the durability request exactly as granted or denied", async () => {
    const granted = createHostPort({ storageManager: { persist: async () => true } });
    await expect(granted.requestDurability()).resolves.toEqual({ kind: "Granted" });

    const denied = createHostPort({ storageManager: { persist: async () => false } });
    await expect(denied.requestDurability()).resolves.toEqual({
      kind: "Denied",
      reason: "The host denied the durability request.",
    });
  });

  it("should report service-worker control state without deciding anything about it", async () => {
    const uncontrolled = createHostPort({ serviceWorker: { controller: null } });
    await expect(uncontrolled.workerControl()).resolves.toEqual({
      kind: "NotControlled",
      reason: "No service worker controls this page.",
    });

    const controlled = createHostPort({
      serviceWorker: { controller: { scriptURL: "http://127.0.0.1:5177/sw.js" } },
    });
    await expect(controlled.workerControl()).resolves.toEqual({
      kind: "Controlled",
      scriptURL: "http://127.0.0.1:5177/sw.js",
    });
  });

  it("should read a cached asset's exact bytes or report it missing", async () => {
    const bytes = new TextEncoder().encode("cached");
    const present = createHostPort({
      cacheStorage: {
        match: async () => ({ arrayBuffer: async () => bytes.buffer as ArrayBuffer }),
      },
    });
    await expect(present.cachedAsset("/index.html")).resolves.toEqual({
      kind: "Present",
      assetUrl: "/index.html",
      bytes,
    });

    const missing = createHostPort({ cacheStorage: { match: async () => undefined } });
    await expect(missing.cachedAsset("/index.html")).resolves.toEqual({
      kind: "Missing",
      assetUrl: "/index.html",
    });
  });
});
