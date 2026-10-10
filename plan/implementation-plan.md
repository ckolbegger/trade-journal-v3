# Trade Journal V3 implementation plan — `claude-opus-5.5`

**Status:** Draft 2 — D1–D4 detailed, D5–D13 outlined (PD-005, PD-010). Not frozen; nothing is implemented until the user approves the plan.
**Specification baseline:** `specs/` at commit `968bc2b` (includes ADR 0009 and ADR 0010).
**Process:** follows `specs/evaluation/planning-protocol.md`. Phase 1 (comprehension check) and Phase 2 (technology choice) are complete. This draft starts Phase 3.

## 1. Approved decisions

| ID | Decision | Approved |
|---|---|---|
| PD-001 | Technology profile A: TypeScript, React, React Aria Components, IndexedDB through `idb`, hand-written service worker, `decimal.js`, Temporal, Vitest, Playwright, GitHub Pages (hosting superseded by PD-007). | 2026-10-10 |
| PD-002 | Data safety: real data lives only at an address that serves released builds — the hosted HTTPS app or a fixed local release port. Development servers use other ports. Tests run only in temporary browser profiles and never open a saved browser profile on the user's machine. | 2026-10-10 |
| PD-003 | Primary browsers: Chrome and Vivaldi on macOS, Linux, and Android. Support is still decided only by the specified functional checks; Safari and Firefox are not blocked. Browser and OS versions are recorded as evidence provenance, not an allowlist. | 2026-10-10 |
| PD-004 | Backup and Restore follow Daily Review (D8). D1–D7 are intended for test data; if the user journals real trades before D8 ships, the user accepts the risk of data loss. | 2026-10-10 |
| PD-005 | Detail D1–D4 now (tasks, `it should …` cases, integration tests, critic flows, acceptance mapping). D5–D12 stay at outline level and are detailed and approved before each starts. This departs from the planning protocol's full-detail-before-freeze rule for this branch. | 2026-10-10 |
| PD-006 | U.S. market calendar generated from the open-source `exchange_calendars` library (XNYS), stored as a versioned data file covering 2000–2028; see §3. | 2026-10-10 |
| PD-007 | Hosting: a dedicated Cloudflare Pages project for this implementation, with `claude-opus-5.5` as its production branch. GitHub Actions builds and tests, then uploads `dist/` with Wrangler; repository secrets hold the Cloudflare API token and account ID, which the user creates. Free plan: static asset requests and bandwidth are not metered. The site's address is the data origin, so it must stay stable; a custom domain remains an option before real data (D8). | 2026-10-10 |
| PD-008 | Add a non-mutating Trade Workflows `previewPlan` operation to the spec (ADR 0011, a `main` spec change like ADR 0009/0010) so the New Plan form shows 1R and planned reward/risk live, computed by the same Trade Analysis `assessPlan` as `confirmPlan`. The UI never computes them itself. `confirmPlan` reassesses; the preview is never trusted as a stored value. D2 starts only after the spec change is on `main`. | 2026-10-10 |
| PD-009 | Deferred Journal-only Debt (Position Change Reflection, Close Review) is due at the Review cutoff of the first trading session that ends after the moment it was deferred. In Daily Review the trader answers it, declines it, or defers it again to the next session. At most 3 deferrals in total (the original Defer counts); once the limit is reached the Debt can only be answered, not declined or deferred. Workflow-bound management Debt cannot be re-deferred. Retirement by owning-workflow evidence is unchanged. Requires a `main` spec change (ADR 0012) to the Journal and Daily Review contracts; affects D3 (due time and deferral count stored with Debt), D4 (Debt answering), and D7 (re-deferral in Review). | 2026-10-10 |
| PD-010 | Addenda are deferred from D4 to a new final deliverable, D13. No spec change: until D13 the Installed Capability Manifest does not advertise Addenda and the UI does not offer them. AC-JOUR-002 is split (Edit and Void in D4, Addendum in D13). The Addendum's Entry Type (§7 question 5) is decided when D13 is detailed. | 2026-10-10 |

## 2. Stack and pinned versions

Versions checked against the npm registry on 2026-10-10. Exact versions are pinned in `package.json` with a lockfile.

| Concern | Choice | Version | Notes |
|---|---|---|---|
| Language | TypeScript, `strict` | 6.0.3 | TypeScript 7.0 is out, but `typescript-eslint` 8.71 supports only `<6.1`. Revisit when it does. |
| Build | Vite | 8.3.4 | With `@vitejs/plugin-react` 6.1.2. |
| UI | React, React DOM | 19.3.0 | |
| Accessible components | React Aria Components | 1.22.1 | Radio groups, dialogs/sheets/drawers, focus management, keyboard behavior. |
| Charts | Hand-written SVG | — | Candles, close-only points, true gaps, and text equivalents exactly as the UI contract requires. |
| Storage | IndexedDB through `idb` | 8.0.4 | One database; see §3. |
| Exact decimals | `decimal.js` | 10.6.0 | No `number` arithmetic for Money, Price, or Quantity. |
| Dates and times | `temporal-polyfill` | 1.0.5 | Imported explicitly everywhere (not as a global polyfill) so Node tests and every browser use identical behavior. |
| Unit tests | Vitest (Node environment) | 5.0.3 | |
| Integration tests | Vitest browser mode with `@vitest/browser-playwright` | 5.0.3 | Real Chromium and real IndexedDB in a temporary profile; no fake storage. |
| Browser/PWA tests and critic | `@playwright/test` | 1.64.0 | Install, offline restart, update, readiness failures, responsive and accessibility flows. |
| UI component tests | `vitest-browser-react` | 2.3.0 | Components rendered in real Chromium with mocked services. |
| Accessibility checks | `@axe-core/playwright` | 4.13.0 | Supports, never replaces, manual keyboard verification. |
| Persistence unit tests | `fake-indexeddb` | 6.2.5 | Unit tests only; integration tests use real IndexedDB. |
| Routing | React Router (library mode) | 8.4.0 | Approved 2026-10-10 over TanStack Router; URL routes keep deep links and the back button working. Route and search parameters are validated by hand. |
| Lint | ESLint and `typescript-eslint` | 10.12.0 / 8.71.1 | Notably `no-floating-promises` and exhaustive-switch checks. |
| Module boundaries | `dependency-cruiser` | 18.5.0 | Enforces the spec's who-may-call-whom table in CI. |
| Hosting | Cloudflare Pages, deployed from GitHub Actions with Wrangler | — | Production HTTPS origin (PD-007). Wrangler 4.149.0 as a dev dependency. |
| Dev runtime | Node | 26.0.0 (development machine: Mac, macOS 26.6.2, arm64) | Vite 8 accepts Node ^20.19 or >=22.12; Vitest 5 accepts ^22.12, ^24, or >=26. |

## 3. Architecture mapping

### Code layout

```text
src/
  shared/              values: Money, Price, Quantity (decimal), identities, CalculationResult, Temporal helpers
  domain/
    trade-analysis/        pure — 6 operations
    performance-analysis/  pure — 4 operations
    trade-record/          fact module — 9 operations
    journal/               fact module — 10 operations
    market-data/           fact module — 8 operations, plus the Pricing Provider port
    reference-catalog/     fact module — 7 operations
    trade-workflows/       coordinator — 6 operations
    daily-review/          coordinator — 4 operations
    trade-views/           read coordinator — 5 operations
    workspace/             lifecycle coordinator — 8 operations
    persistence/           internal seam, never imported by ui/
  ui/                  React application; calls coordinators and the permitted direct module operations
  sw/                  service worker
build/                 Offline Release Inventory generator, Installed Capability Manifest emitter
```

Each module exposes one `index.ts`. `dependency-cruiser` rules mirror the call table in `specs/design/overview.md`: pure modules import nothing with I/O, fact modules never import coordinators, `ui/` never imports `persistence/` or module internals.

### Mechanisms required by the protocol

| Mechanism | Approach |
|---|---|
| Atomic semantic commands | One IndexedDB database with object stores per fact module. Each semantic command runs as one `readwrite` transaction spanning every affected store, with `durability: 'strict'` (Chrome defaults to `relaxed`, which can lose the last writes on power loss). All preparation, analysis, and hashing finish before the transaction opens, because IndexedDB auto-commits when a transaction waits on anything else. This matches the spec's prepare/apply design. |
| `RuntimeNotWritable` write gate | The persistence seam checks current Runtime Readiness before opening any `readwrite` transaction and returns the cross-cutting branch without touching storage. Coordinators also check, so the UI receives the same result. |
| Revisions and snapshot reads | Per-subject revision counters plus a Workspace content revision bumped in every commit. Optimistic checks run inside the write transaction. Multi-module reads load everything in one `readonly` transaction before computing. |
| Exact decimals | `Money`, `Price`, `Quantity` wrap `Decimal` (34 significant digits, half-even rounding only where a division requires it); persisted as canonical strings. |
| Clock and calendar | Injected `Clock`; Temporal for all instants, dates, and zones. U.S. session calendar as described under *Market calendar* below. |
| Identities and ordering | Random UUIDs for stable identities; Recorded Sequence is a separate monotonic counter per Economic Time tie. |
| Web App Manifest | Static `manifest.webmanifest` with stable `id`, name, icons, `start_url`, `scope`, `display: standalone`. |
| Offline Release Inventory | A build step emits `inventory.json` (release ID plus every asset URL and SHA-256). The service worker caches and verifies every asset before reporting the release ready; activation waits for a safe moment. |
| Runtime Readiness | Four gating checks: an isolated diagnostic transaction on a dedicated probe store, `navigator.storage.estimate()` against the derived capacity minimum, service-worker control by this release, and launch-time digest verification of the cached inventory. Storage protection (`navigator.storage.persisted()`) is reported and warned about, not gated (ADR 0009). |
| Capacity minimum | Derived from the generated mature dataset (25,000 Trades, 200,000 facts) measured in storage, plus migration and backup headroom. |
| Migrations | Each schema version is an IndexedDB database version. A migration runs entirely inside IndexedDB's upgrade transaction, which is atomic: it restructures stores, transforms records, and runs the per-section validators (the same validators Restore uses in D8). Any failure aborts the upgrade and leaves the previous version byte-for-byte intact; the app reports Migration Blocked and offers retry. Validators are synchronous, so the upgrade never waits on non-IndexedDB work. |
| Backup and receipt | Canonical JSON artifact with section and full SHA-256 digests (`crypto.subtle`). Download via a Blob; verification via an ordinary file input that reads the saved file back (ADR 0010). |
| Installed Capability Manifest | A typed constant per release, emitted at build; navigation is derived from it. |

### Market calendar (PD-006)

- **Source:** the open-source Python library `exchange_calendars` (version 4.13.2, calendar `XNYS`), run once by a development script to produce `src/shared/calendar/xnys.json`: every weekday closure and every early close with its close time. Python is needed only to regenerate the file, never to build or run the app.
- **Verified:** its 2026–2028 output matches NYSE's official announcement of 23 December 2025 exactly (29 closures, 5 early closes at 1:00 p.m.). It also contains past one-off closures such as 11 September 2001, Hurricane Sandy (29–30 October 2012), and the national days of mourning on 5 December 2018 and 9 January 2025.
- **Coverage:** sessions from 3 January 2000 through 29 December 2028. The file's version is the session-policy revision that Market Data binds into its snapshots.
- **Outside coverage:** session-dependent results (Expected Mark Date, Review Date, completed-session ranges) return an explicit *calendar not covered* reason naming the coverage dates; the app never guesses sessions.
- **Maintenance:** regenerate and re-check against NYSE's announcement each December, when NYSE publishes the next three years, and immediately after any unscheduled closure. A missed unscheduled closure would surface as a Missing Mark the trader can acknowledge until the update ships.
- **Assumption:** the Review Cutoff is the equities close (4:00 p.m. ET, or 1:00 p.m. on early-close days). The 15-minute-later close of some options is not modeled.

## 4. Vertical deliverables (outline)

Each deliverable is usable through the production UI, runs through the real domain and storage, adds migrations for any changed durable data, and ends with mock-free integration tests and a fresh browser-critic pass. Detailed tasks and `it should …` cases follow after this outline is reviewed.

| # | Deliverable | User-visible outcome | Main capabilities | Acceptance scenarios | Depends on |
|---|---|---|---|---|---|
| D1 | Workspace, readiness, and reference setup | Open the installable app, pass the safety checks (or see why not), choose a time zone, create Institutions and Accounts, browse seeded Strategies and reasons, manage Tags. | Web App Manifest, Offline Release Inventory, Runtime Readiness and write gate, storage-protection warning, update flow; Workspace `initialize`, `getStatus`, `saveSettings`, `requestDurability`; Journal `seedDefaults`, `getDefinitions`; Reference Catalog `save`, `query`, `resolve`, `seedDefaults`; responsive shell. | AC-DEL-001–004, AC-DEL-005 (except backup export), AC-DEL-006, AC-REF-001–002, AC-JOUR-007, AC-UI-001–002, AC-CAP-001, AC-RESP-001 | — |
| D2 | Stock Plans | Plan a Long Stock trade with Stops, Targets, Plan Reflection, tags, and Idea Source; see 1R; abandon a Plan. | Trade Workflows `confirmPlan`, `abandonPlan`; Trade Record (prepare/apply/get/query/history); Trade Analysis `assessPlan` (stock); Trade Views `browseTrades`, `getTradeDetail` (Planned/Abandoned). First schema migration, with the per-section validation that Restore later reuses. | AC-PLAN-001–002, AC-LIFE-002 (no-execution case), AC-REST-004 | D1 |
| D3 | Stock trading | Record buys and sells as Position Changes; see Positions, FIFO lots, fees, realized P&L; close with a Close Reason; reflect now, decline, or defer. | `recordPositionChange` (stock); Trade Analysis `derive`; Position Change Reflection, Close Review, Journal Debt; lifecycle Open/Closed. Mature-dataset generator and startup/open-list benchmark. | AC-LIFE-001, AC-LIFE-002 (execution case), AC-LIFE-003, AC-POS-001, AC-POS-004 (agency), AC-POS-005 (stock cases), AC-JOUR-003, AC-JOUR-005, AC-PERF-001 | D2 |
| D4 | Journal | Journal timeline; Review Notes and Trader Reflections; Edit and Void; answer or decline Debt; edit prompt definitions. | Journal `save`, `query`, `reviseDefinition`. | AC-JOUR-001, -002 (Edit and Void parts), -004, -005 (Void reopens Debt), -007 (reseed after revision), AC-REF-002 (Journal Tag case) | D3 |
| D5 | Corrections | Fix a mistaken fill (Replace), remove a fill that never happened (Void), rebuild a Trade; see View history and the impact preview. | Trade Workflows `previewCorrection`, `commitCorrection` (stock); history views. | AC-CORR-001–003, -005 (fact case), AC-LIFE-002 (Void case) | D4 |
| D6 | Marks and live risk | Enter closing Marks or mark them unavailable; see valuation, risk to Stop, reward to Target, Overrun; revise management. | Market Data manual `save`, `query`; session calendar; Trade Analysis `evaluate`; Trade Workflows `reviseManagement`; Management Debt. | AC-MARK-001–003, AC-CALC-001–003 | D5 |
| D7 | Daily Review | Run the guided after-close review, with one-click Hold and saved Actions. | Daily Review (all 4); Stop Discipline reconciliation; `previewMarkChange`. | AC-REV-001–006, AC-CORR-005 (Mark case) | D6 |
| D8 | Backup and Restore | Download a backup of everything recorded so far, verify it, and restore it on another installation, including from the read-only recovery mode. | Workspace `exportBackup`, `confirmBackup`, `prepareRestore`, `applyPreparedRestore`; export/prepare/apply for the Trade Record, Journal, Market Data, and Reference Catalog sections. | AC-BACK-001, AC-REST-001–003, AC-DEL-005 (backup export) | D7 |
| D9 | Single-leg options and settlement | Plan and trade Long Call/Put, Cash-Secured Put, Covered Call; record Expiration, Assignment, Exercise, cash settlement; see Expiration Payoff. | Option instruments; settlement facts and allocation; `expirationPayoff`; Settlement Due in Review. | AC-SET-001–004, AC-POS-004 (non-agency), AC-CALC-004, AC-CORR-004 (settlement), AC-JOUR-006 (first workflow-routed Management Debt) | D8 |
| D10 | Multi-leg strategies and Rolls | Verticals, PMCC, Iron Condor, trader-defined Strategy shapes; partial Rolls with lineage. | Multi-leg Plans and Position Changes; Roll; Planned-Leg fulfillment for objective selectors. | AC-POS-002, AC-POS-003, AC-POS-005 (remaining), AC-CORR-004 (Roll) | D9 |
| D11 | Reports | Outcomes, Current Exposure, Process Scorecard, Journal Field, with Report Periods and Break Down By. | Performance Analysis (all 4); Trade Views `runReport`. | AC-RPT-001–006 | D10 |
| D12 | Replay, Daily Bars, and pricing provider | Per-Trade replay chart with candles and gaps; optional automatic closing prices. | Trade Views `replayTrade`; Daily Bars; Pricing Provider adapter; Market Data `recover`, provider configuration. | AC-MARK-004–006, AC-REBUILD-001 | D11 |
| D13 | Journal Addenda | Add a later, linked thought to any saved Journal Entry without rewriting it; see Addendum relationships in the timeline and View history. | Journal `save` Addendum variant; optional parent link with migration; Journal backup section and Restore validation extended (parent link, acyclicity). | AC-JOUR-002 (Addendum part) | D12 (PD-010) |

D1–D7 hold test data only (PD-004). From D8 onward, every deliverable that adds durable data also extends backup and Restore to cover it.

AC-RESP-001, AC-CAP-001, AC-UI-001–002, AC-PERF-001, and backup/Restore round-trip coverage stay in the cumulative suites from the deliverable that introduces them onward.

## 5. Delivery conventions (all deliverables)

### Test layers

| Layer | Command | Runs in | Mocks |
|---|---|---|---|
| Unit | `npm run test:unit` | Vitest, Node | Allowed. Persistence unit tests use `fake-indexeddb`. |
| Component | `npm run test:component` | Vitest browser mode, real Chromium | Services mocked; these are the UI's unit tests. |
| Integration | `npm run test:integration` | Vitest browser mode, real Chromium, temporary profile | None for application dependencies. Real modules, persistence, and IndexedDB. One disclosed replacement: `TestReleaseHost` reports service-worker control and inventory state, because a Vitest page is not served by the app's service worker. The diagnostic transaction, capacity, and protection checks run for real. Release behavior is covered by E2E. |
| E2E | `npm run test:e2e` | Playwright against `npm run build && npm run preview` on `DEV_PORT` (loopback secure context), real service worker, temporary profiles | None. Failure conditions are produced through Chrome DevTools Protocol controls or disclosed fault-injection init scripts, named in each test. |
| Production smoke | `npm run test:prod` | Playwright against the deployed HTTPS address, fresh profile | None. |

`npm run check` runs `tsc --noEmit`, ESLint, and dependency-cruiser. `npm run test:all` runs every layer in order.

### Red/green evidence

Every `it should …` case is implemented one at a time: add the test, run it, confirm it fails for the right reason (red), make the smallest change, rerun to green, rerun the task's earlier tests. Each step is appended to `plan/evidence/D<n>.md` with the exact command, the test name, and a short excerpt of the outcome. Refactoring happens after the task is green, followed by a rerun.

Structural tasks list an exact verification command and expected result instead.

### Deliverable completion gate

1. `npm run check` and `npm run test:all` pass.
2. A fresh critic agent receives `specs/`, this plan, and the current deliverable's scope. It builds and starts the app itself, drives Playwright against the production UI in a temporary profile for every critic flow listed, does not edit code, and returns a structured report per flow (actions, observed result, pass/fail, evidence). Reports are saved as `plan/evidence/D<n>-critic-<attempt>.md`.
3. Each implementation defect gets a failing automated test first, then the fix, then the full suites, then a new fresh critic. Spec or plan ambiguities pause work for the user.
4. The deliverable is complete only when a fresh critic passes every flow.

### Commits

Commits happen only after the user explicitly approves them. Proposed cadence: one commit per completed task, plus one for the deliverable's evidence.

## 6. Detailed deliverables

- [D1 — Workspace, readiness, and reference setup](deliverables/D1-workspace.md)
- [D2 — Stock Plans](deliverables/D2-stock-plans.md)
- [D3 — Stock trading](deliverables/D3-stock-trading.md)
- [D4 — Journal](deliverables/D4-journal.md)
- D5–D13: outline only (PD-005).

## 7. Open questions for review

1. **Market calendar (PD-006):** approve the proposed source and coverage in §3. **Resolved 2026-10-10:** approved as written.
2. **Hosting:** GitHub Pages publishes one site per repository, but this repository holds several competing implementations. Options: (a) Cloudflare Pages or Netlify, which give every branch its own stable HTTPS address (needs a free account and one deploy token in GitHub); (b) a separate repository per implementation just for its Pages site; (c) GitHub Pages for this branch only. Recommendation: (a). Decide before D1's deployment task. **Resolved 2026-10-10:** Cloudflare Pages (PD-007).
3. **Plan preview (product question):** the spec has no non-mutating "assess this Plan" operation, and the UI may not compute 1R itself, so the New Plan form can show 1R and risk/reward only after confirmation (or in the rejection). The prototype showed them live. Adding a preview means a spec change like `previewCorrection`. Affects D2. **Resolved 2026-10-10:** add `previewPlan` (PD-008).
4. **Routing:** React Router 8 is proposed (§2); say so if you prefer another. **Resolved 2026-10-10:** React Router 8 confirmed.
5. **Interpretations to confirm** (details in the deliverable files):
   - D3: Entry Quality is Below Plan when the actual reward/risk ratio at the Entry Resolution Point (including allocated opening fees) is below the planned ratio. **Resolved 2026-10-10:** confirmed.
   - D3: a deferred reflection is due at its Position Change's Economic Time. **Resolved 2026-10-10:** replaced by PD-009 (due in the next session's Review after deferral; up to 3 deferrals).
   - D4: an Addendum is a Review Note or Trader Reflection linked to its parent, using the current definition. **Resolved 2026-10-10:** deferred with Addenda to D13 (PD-010); decided when D13 is detailed.
   - D4: Void is offered only for voluntary Entries and Debt-settling Entries until the spec says what Voiding a workflow-completed Entry does to its obligation. **Resolved 2026-10-10:** confirmed. Workflow-completed reflections are Edit-only; Voiding a Daily Trade Review Action (which the spec requires) arrives in D7.

## 8. Known risks

- Playwright's Chromium must download and run on the development Mac (macOS 26.6.2, arm64); verify in D1's first structural task.
- `durability: 'strict'` costs write latency; measured by the D3 benchmark.
- All Time reports over 25,000 Trades may need a rebuildable per-Trade results cache.
- Service-worker update safety is the hardest browser test to automate.
