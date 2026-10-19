// The dependency shape of specs/design/overview.md:98-121, expressed as data so that a new
// module must declare its layer and permitted edges instead of inheriting permission.
//
// `dir` is a project-root-relative directory. A file belongs to the declared module with the
// longest matching directory prefix, so `src/ui/App.tsx` is `ui`, not the `src` entry module.

export const modules = [
  { name: "entry", dir: "src", layer: "composition", direct: true },
  { name: "composition", dir: "src/composition", layer: "composition" },
  { name: "ui", dir: "src/ui", layer: "presentation" },

  { name: "values", dir: "src/values", layer: "value" },
  // The frozen Plan-fact shapes shared by Trade Record (which persists them) and Trade Analysis
  // (which assesses them). A contract module, so both layers that need it may import it without
  // either depending on the other.
  { name: "plan", dir: "src/plan", layer: "contract" },
  { name: "clock", dir: "src/platform/clock", layer: "platform" },
  { name: "host", dir: "src/platform/host", layer: "platform" },
  { name: "results", dir: "src/results", layer: "contract" },
  { name: "capability", dir: "src/capability", layer: "contract" },
  { name: "calendar", dir: "src/calendar", layer: "domain-pure" },

  { name: "persistence", dir: "src/persistence", layer: "persistence" },
  { name: "journal", dir: "src/journal", layer: "fact" },
  { name: "catalog", dir: "src/catalog", layer: "fact" },
  // Declared for the frozen architecture and used by the forbidden-symbol rule below. D1 does
  // not implement it; the directory is empty until the deliverable that owns Trade facts.
  { name: "trade-record", dir: "src/trade-record", layer: "fact" },

  { name: "capacity", dir: "src/capacity", layer: "analysis" },
  { name: "trade-analysis", dir: "src/analysis/trade", layer: "analysis" },
  { name: "performance-analysis", dir: "src/analysis/performance", layer: "analysis" },

  { name: "release", dir: "src/release", layer: "delivery" },
  { name: "delivery", dir: "src/delivery", layer: "delivery" },

  { name: "readiness", dir: "src/readiness", layer: "coordinator" },
  { name: "workspace", dir: "src/workspace", layer: "coordinator" },
  { name: "onboarding", dir: "src/onboarding", layer: "coordinator" },
  { name: "trade-workflows", dir: "src/trade-workflows", layer: "coordinator" },

  { name: "tests", dir: "tests", layer: "test" },
];

// Which target layers a source layer may import. `*` means anything.
export const layerEdges = {
  value: [],
  platform: [],
  contract: [],
  "domain-pure": ["value", "contract"],
  persistence: ["value", "contract"],
  fact: ["value", "contract", "persistence"],
  // Trade Analysis and Performance Analysis read no storage, clock, calendar or other module.
  analysis: ["value", "contract"],
  delivery: ["value", "contract", "platform"],
  coordinator: [
    "value",
    "contract",
    "platform",
    "domain-pure",
    "persistence",
    "fact",
    "analysis",
    "delivery",
    // Coordinators compose other coordinators (Workspace drives readiness).
    "coordinator",
  ],
  // Presentation may read a fact module directly (overview.md:102-113) but never the
  // persistence seam, and never joins authoritative records itself.
  presentation: ["contract", "fact", "coordinator"],
  composition: ["*"],
  test: ["*"],
};

// A declared module may widen or narrow its layer's edges. The session calendar needs the
// clock's pure instant conversion while still reading no storage and consulting no host clock.
export const moduleEdges = {
  calendar: ["value", "contract", "platform"],
  // The Plan-fact shapes carry the value layer's exact `Money`/`Price`/`Quantity`.
  plan: ["value"],
};

// Analysis must not obtain raw Executions and repeat Trade Analysis arithmetic.
export const forbiddenSymbols = {
  "performance-analysis": [{ symbol: "Execution", fromLayer: "fact" }],
};

// Only the value layer may import the decimal library.
export const valuePackage = "decimal.js";

// Global host identifiers that may appear only inside the browser-host port.
export const hostIdentifiers = [
  { pattern: /\bnavigator\s*\./, name: "navigator." },
  { pattern: /\bserviceWorker\b/, name: "serviceWorker" },
  { pattern: /\bshowSaveFilePicker\b/, name: "showSaveFilePicker" },
  { pattern: /\bshowOpenFilePicker\b/, name: "showOpenFilePicker" },
  { pattern: /\bcaches\s*\./, name: "caches." },
];

export const protectedDirectories = {
  indexedDB: "src/persistence/indexeddb/",
  hostIdentifiers: "src/platform/host/",
  valueLayer: "src/values/",
};
