import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createApplicationContext, harnessEnabled, readHarnessInstant } from "./composition/root";
import { createApplicationRuntime, type StartupOverride } from "./composition/application";
import {
  DATABASE_NAME,
  D2_SCHEMA_MANIFEST,
  D2_SCHEMA_VERSION,
  deleteDatabase,
  openDatabaseWithStores,
} from "./persistence/indexeddb/schema";
import { createTransactionSeam } from "./persistence/indexeddb/transaction";
import { createWriteGate } from "./persistence/indexeddb/writeGate";
import { establishApplicationReadiness } from "./composition/readiness";
import { validateReleaseInventory } from "./release/inventory";
import { App } from "./ui/App";
import "./ui/styles.css";

const host = document.getElementById("root");
if (host === null) {
  throw new Error("The application host element is missing");
}

const context = createApplicationContext({ fixedInstant: readHarnessInstant() });
const startupOverride = harnessEnabled()
  ? (globalThis as unknown as Window).__TRADE_JOURNAL_STARTUP_OVERRIDE__
  : undefined;
const runtime = createApplicationRuntime(context.host, context.clock, startupOverride ?? {});

if (import.meta.env.PROD) {
  void context.host.registerWorker("/sw.js");
}

declare global {
  interface Window {
    /** The browser harness may open and inspect the durable schema. */
    __TRADE_JOURNAL_SCHEMA__?: {
      open: () => Promise<IDBDatabase>;
      delete: typeof deleteDatabase;
      version: number;
      manifest: typeof D2_SCHEMA_MANIFEST;
    };
    /** The browser harness may drive the transaction seam with a Writable gate. */
    __TRADE_JOURNAL_TX__?: {
      commit: (request: unknown) => Promise<unknown>;
    };
    /** The browser harness may run the Offline Release Inventory validation. */
    __TRADE_JOURNAL_INVENTORY__?: {
      validate: (expectedReleaseId?: string) => Promise<unknown>;
    };
    /** The browser harness may run the complete Runtime Readiness gate. */
    __TRADE_JOURNAL_READINESS__?: {
      evaluate: () => Promise<unknown>;
    };
    /** A harness-only forcing seam for the startup view. */
    __TRADE_JOURNAL_STARTUP_OVERRIDE__?: StartupOverride;
  }
}

if (harnessEnabled()) {
  window.__TRADE_JOURNAL_HOST__ = context.host;
  window.__TRADE_JOURNAL_SCHEMA__ = {
    open: () => openDatabaseWithStores(D2_SCHEMA_MANIFEST, DATABASE_NAME, D2_SCHEMA_VERSION),
    delete: deleteDatabase,
    version: D2_SCHEMA_VERSION,
    manifest: D2_SCHEMA_MANIFEST,
  };
  window.__TRADE_JOURNAL_READINESS__ = {
    evaluate: () => establishApplicationReadiness(context.host),
  };
  window.__TRADE_JOURNAL_INVENTORY__ = {
    validate: (expectedReleaseId?: string) =>
      validateReleaseInventory(context.host, { expectedReleaseId }),
  };
  window.__TRADE_JOURNAL_TX__ = {
    commit: async (request) => {
      const database = await openDatabaseWithStores(
        D2_SCHEMA_MANIFEST,
        DATABASE_NAME,
        D2_SCHEMA_VERSION,
      );
      const seam = createTransactionSeam(
        database,
        createWriteGate({
          current: async () => ({ outcome: "Writable", failedChecks: [] }),
        }),
      );
      try {
        return await seam.commit(request as Parameters<typeof seam.commit>[0]);
      } finally {
        database.close();
      }
    },
  };
}

createRoot(host).render(
  <StrictMode>
    <App
      runtime={runtime}
      applicationName={context.applicationName}
      openingInstant={context.openingInstant}
    />
  </StrictMode>,
);
