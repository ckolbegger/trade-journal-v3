import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createApplicationContext, harnessEnabled, readHarnessInstant } from "./composition/root";
import { App } from "./ui/App";
import "./ui/styles.css";

const host = document.getElementById("root");
if (host === null) {
  throw new Error("The application host element is missing");
}

const context = createApplicationContext({ fixedInstant: readHarnessInstant() });

if (harnessEnabled()) {
  window.__TRADE_JOURNAL_HOST__ = context.host;
}

createRoot(host).render(
  <StrictMode>
    <App applicationName={context.applicationName} openingInstant={context.openingInstant} />
  </StrictMode>,
);
