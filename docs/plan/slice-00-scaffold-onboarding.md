# Slice 0 — Scaffold & Onboarding

Foundation that isn't tied to trading functionality (S0.1), plus the one piece of setup every Trade depends on: the trader's Institutions and Accounts (S0.2). Everything else foundational is deferred into the Slice 1 story that first needs it.

Design references: [overview.md](../design/overview.md) (module rules, StorageBinding seam), [workspace.md](../design/workspace.md) (init sequence), ADR 0011 (stack), ADR 0013 (Accounts).

---

## ☑ Story S0.1 — App shell

> As a trader, I want the app to load in my browser with working navigation, so that every later story has a running application to land in.

**Deep interfaces**: none (scaffolding). Establishes the module layout and test harnesses every story uses.

### Tasks

- [x] **S0.1.T1 — Project scaffold.** Vite + React + TypeScript strict; Vitest configured with two projects (unit: `src/**/*.test.ts`, integration: `tests/integration/**` with `fake-indexeddb` auto-loaded); Playwright configured with its own `webServer` (starts the Vite dev server itself) and **excluded from `npm test`** — e2e runs only when explicitly invoked via `npm run test:e2e` (locally or as a separate CI step); ESLint + Prettier; `dexie` dependency. npm scripts: `dev`, `build`, `test` (unit + integration only), `test:integration`, `test:e2e`, `lint`.
- [x] **S0.1.T2 — Module boundary lint rule.** ESLint `no-restricted-imports` (or `eslint-plugin-boundaries`) encoding the dependency rules from the index: `src/domain/**` imports nothing from `src/`; `src/books/**` may not import `src/coordinators/**` or `src/ui/**`; `src/ui/**` may not import `src/domain/trademath` internals or `src/storage/**`.

  ```
  describe "module boundaries"
  - it fails lint when a ui file imports from src/storage
  - it fails lint when trademath imports from src/books
  - it passes lint on the scaffold as committed
  ```

- [x] **S0.1.T3 — App shell & routing.** React Router shell: top-level nav (Trades, Review — both stub pages), an app header, and a route-not-found page. Composition root (`src/ui/main.tsx`) exists as the single place Books/coordinators will later be wired.

  ```
  describe "AppShell"
  - it renders the header and nav links
  - it renders the Trades stub at /
  - it renders the Review stub at /review
  - it renders not-found for an unknown route
  ```

- [x] **S0.1.T4 — Playwright e2e: shell smoke** (`e2e/s0-1-shell.spec.ts`): app loads, nav to Review and back works, no console errors.
- [x] **S0.1.T5 — Browser verification.** `npm run dev`; open the app in a real browser. Expected observations:
  - Shell renders with header and nav; Trades and Review pages reachable; unknown URL shows not-found.
  - No console errors or warnings.
  - `npm test` and `npm run test:e2e` both green.

---

## ☐ Story S0.2 — Onboarding: Institutions & Accounts

> As a trader, I want to record my brokerage Institutions and Accounts on first run, so that every Trade I plan can bind to the Account that holds it.

**Deep interfaces**: `TradeBook.registries.institutions` / `.accounts` (`ListRegistry<T>` — [tradebook.md](../design/tradebook.md)); `StorageBinding` (internal seam, both bindings); first-run flow per [workspace.md](../design/workspace.md) init sequence (no fictional brokerages are ever seeded).

### Tasks

- [ ] **S0.2.T1 — StorageBinding interface + in-memory implementation.** Narrow keyed-record primitives (`get`, `put`, `delete`, `list`/`where` by index, `transaction`) in `src/storage/`. The in-memory implementation is the unit-test binding for every Book.

  ```
  describe "InMemoryBinding"
  - it returns undefined for a missing key
  - it round-trips a put record by key
  - it lists all records in a store
  - it lists records matching an indexed value
  - it deletes by key
  - it rolls back every write in a transaction when the callback throws
  - it isolates stores (a put in one store is invisible to another)
  ```

- [ ] **S0.2.T2 — Dexie schema v1 + Dexie StorageBinding.** Dexie database with stores for `institutions` and `accounts` (later stories add stores via schema versions, never reshaping these). DexieBinding implements the same interface; integration tests run the *same behavioral suite* as T1 against it (shared test-suite factory — write once, run per binding).

  ```
  describe "DexieBinding (integration, fake-indexeddb)"
  - it passes the entire StorageBinding behavioral suite
  - it persists records across a database close and reopen
  - it upgrades an empty v0 database to schema v1
  ```

- [ ] **S0.2.T3 — ListRegistry generic.** One implementation reused by every registry (design: "one generic shape, reused five times"): `list(includeArchived?)`, `save` (create or update by id), `archive` (never delete).

  ```
  describe "ListRegistry"
  - it save() creates an item with a generated id when absent
  - it save() updates in place when the id exists
  - it list() returns items in insertion order
  - it list() excludes archived items by default
  - it list(true) includes archived items
  - it archive() marks an item archived without removing the record
  - it archive() of an unknown id rejects
  ```

- [ ] **S0.2.T4 — TradeBook registries (institutions, accounts).** TradeBook constructed over a StorageBinding, exposing `registries.institutions` and `registries.accounts`. `Account` references its `institutionId`.

  ```
  describe "TradeBook.registries"
  - it lists no institutions or accounts on a fresh book
  - it saves and lists an institution
  - it saves an account referencing an existing institution
  - it rejects an account whose institutionId does not exist
  - it archives an institution while its accounts remain readable
  ```

- [ ] **S0.2.T5 — Onboarding UI.** On load, the composition root checks for any non-archived Account; none → onboarding flow (create Institution: name; create Account: name, institution) → lands on Trades page. Accounts exist → straight to Trades. A Settings-lite page lists institutions/accounts and allows adding more (full management UI comes later).

  ```
  describe "Onboarding"
  - it shows onboarding when no accounts exist
  - it requires an institution name and an account name to proceed
  - it saves the institution and account via TradeBook.registries
  - it skips onboarding when an account already exists
  ```

- [ ] **S0.2.T6 — Integration tests** (`tests/integration/onboarding.test.ts`): full flow over Dexie + fake-indexeddb — fresh DB → registries empty → save institution + account → close/reopen DB → both present, onboarding check passes.
- [ ] **S0.2.T7 — Playwright e2e** (`e2e/s0-2-onboarding.spec.ts`): fresh browser context → onboarding appears → create "Schwab" + "Taxable" → lands on Trades; reload → no onboarding, Settings shows both.
- [ ] **S0.2.T8 — Browser verification.** Run the app in a real browser with cleared site data. Expected observations:
  - Onboarding appears; creating an Institution and Account lands on the Trades page.
  - Reload skips onboarding (data persisted in IndexedDB — verify in DevTools → Application).
  - Settings-lite lists the created Institution and Account; adding a second Account works.
  - All test suites green.
