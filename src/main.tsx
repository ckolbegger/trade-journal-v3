import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createApplicationContext } from "./composition/root";
import { App } from "./ui/App";
import "./ui/styles.css";

const host = document.getElementById("root");
if (host === null) {
  throw new Error("The application host element is missing");
}

const context = createApplicationContext();

createRoot(host).render(
  <StrictMode>
    <App applicationName={context.applicationName} />
  </StrictMode>,
);
