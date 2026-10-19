import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createApplicationContext, harnessEnabled, readHarnessInstant } from "./composition/root";
import {
  SCHEMA_MANIFEST,
  SCHEMA_VERSION,
  deleteDatabase,
  openDatabase,
} from "./persistence/indexeddb/schema";
import { createTransactionSeam } from "./persistence/indexeddb/transaction";
import { createWriteGate } from "./persistence/indexeddb/writeGate";
import { App } from "./ui/App";
import "./ui/styles.css";

const host = document.getElementById("root");
if (host === null) {
  throw new Error("The application host element is missing");
}

const context = createApplicationContext({ fixedInstant: readHarnessInstant() });

declare global {
  interface Window {
    /** The browser harness may open and inspect the durable schema. */
    __TRADE_JOURNAL_SCHEMA__?: {
      open: typeof openDatabase;
      delete: typeof deleteDatabase;
      version: number;
      manifest: typeof SCHEMA_MANIFEST;
    };
    /** The browser harness may drive the transaction seam with a Writable gate. */
    __TRADE_JOURNAL_TX__?: {
      commit: (request: unknown) => Promise<unknown>;
    };
  }
}

if (harnessEnabled()) {
  window.__TRADE_JOURNAL_HOST__ = context.host;
  window.__TRADE_JOURNAL_SCHEMA__ = {
    open: openDatabase,
    delete: deleteDatabase,
    version: SCHEMA_VERSION,
    manifest: SCHEMA_MANIFEST,
  };
  window.__TRADE_JOURNAL_TX__ = {
    commit: async (request) => {
      const database = await openDatabase();
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
    <App applicationName={context.applicationName} openingInstant={context.openingInstant} />
  </StrictMode>,
);
