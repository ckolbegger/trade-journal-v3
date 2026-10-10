# D1 — Workspace, readiness, and reference setup

## Outcome

The trader opens the app from its address (or installs it), the app verifies the environment before allowing any write, and the trader chooses a time zone, creates Institutions and Accounts, manages Tags, and reviews the seeded Strategies and reasons. The app works offline after the first successful load, updates safely, and adapts live between narrow and wide layouts.

**Production-UI entry points:** startup verification screen; first-run time-zone screen; Settings (time zone, storage protection); Reference screens (Institutions and Accounts, Tags, Strategies, Close Reasons, Abandonment Reasons).

## Installed capabilities after D1

| Module | Operations / variants |
|---|---|
| Workspace | `initialize`, `getStatus`, `saveSettings`, `requestDurability` |
| Reference Catalog | `seedDefaults`; `save` (create, rename, archive/retire, reactivate for Institutions, Accounts, Tag Types, Tag Values, Close Reasons, Abandonment Reasons; rename, retire, reactivate for seeded Strategies); `query`; `resolve` (`NewSelection`, `RetainedReference`, `HistoricalSnapshot`, `DisplayOnly`) |
| Journal | `seedDefaults` (Workspace-only), `getDefinitions` |
| Delivery | Web App Manifest, Offline Release Inventory, service worker with safe update, Runtime Readiness and the persistence write gate, storage-protection notice |

Not installed: creating trader-defined Strategy shapes (D10), `NewTagValueSelectionUnderExistingBinding` (D4), backup and Restore (D8).

## Tasks

Type **S** = structural (exact verification), **B** = behavior (TDD). Seams are public module entry points.

### T1.1 Project scaffold (S)

- **Depends on:** —
- **Work:** `package.json` with the pinned versions in plan §2 and a lockfile; `tsconfig.json` with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`; `vite.config.ts` reading `DEV_PORT` from `.env.local` with `strictPort` for dev and preview (README); ESLint with `typescript-eslint` strict type-checked rules, `no-floating-promises`, `switch-exhaustiveness-check`, React hooks rules; Vitest projects `unit` (Node), `component` and `integration` (browser mode, Playwright Chromium, headless); `playwright.config.ts` with `baseURL` from `DEV_PORT` and a `webServer` running build plus preview; scripts `check`, `test:unit`, `test:component`, `test:integration`, `test:e2e`, `test:prod`, `test:all`, `build`, `preview`, and `serve:release` (serves the build on `RELEASE_PORT`, default 4173, never used by tests — PD-002).
- **Verification:** `npm ci` succeeds; `npm run check` exits 0; `npx playwright install chromium` completes on the development VM (Ubuntu 22.04 arm64) and a one-line smoke spec opens `about:blank`; one structural sanity test runs in each Vitest project. All commands exit 0.

### T1.2 Module boundary rules (S)

- **Depends on:** T1.1
- **Work:** `dependency-cruiser` rules encoding `specs/design/overview.md` "Who may call whom": `ui/` may import only coordinators and the permitted direct operations of Journal, Market Data, Reference Catalog, and Workspace; nothing outside `domain/` imports `persistence/`; `trade-analysis` and `performance-analysis` import only `shared/`; fact modules never import coordinators; Reference Catalog never imports Journal or Trade Record; Market Data never imports Trade modules.
- **Verification:** `npm run check:boundaries:selftest` runs the rules over `tools/boundary-fixtures/` (one violating file per rule) and must report every expected violation; `npm run check` passes on `src/`.

### T1.3 Shared kernel: identities, clock, time zones (B)

- **Depends on:** T1.1
- **Seam:** `src/shared/index.ts`

```text
describe("Stable identities")
  it should generate a distinct identity on every call for a given kind
  it should reject parsing an identity whose kind prefix does not match
describe("Clock")
  it should return the injected instant from a fixed test clock
describe("Workspace time zone")
  it should accept a rules-based IANA zone such as America/New_York
  it should reject an unknown zone with InvalidTimeZone
  it should reject a fixed offset such as +05:00 because a rules-based zone is required
```

### T1.4 Persistence seam and write gate (B)

- **Depends on:** T1.3
- **Seam:** `src/domain/persistence/index.ts` (internal; used by fact modules and coordinators only). Unit tests use `fake-indexeddb`.

```text
describe("Workspace root detection")
  it should report NoRoot without creating a database when none exists
  it should report ExistingRoot when the database exists
  it should report UnreadableRoot when an existing database fails to open
  it should report NewerSchema without upgrading when the stored version exceeds the installed schema
describe("Schema version 1")
  it should create the Workspace, Journal, and Reference Catalog stores and indexes on first initialization
  it should close its connection and report UpgradePending when a newer release requests a version change
describe("Semantic write transaction")
  it should commit every staged effect across stores when all participants succeed
  it should roll back every store when any participant fails
  it should increment the Workspace content revision exactly once per commit
  it should open authoritative writes with strict durability
  it should return Conflict and write nothing when an expected revision differs inside the transaction
describe("Write gate")
  it should return RuntimeNotWritable without opening a transaction when readiness is Recovery Only
  it should return RuntimeNotWritable without opening a transaction when readiness is Unsupported
  it should carry the readiness outcome, every failed check, the Workspace status, and safe actions in RuntimeNotWritable
  it should reject the next write after readiness is invalidated during the session
describe("Snapshot read")
  it should read several stores in one readonly transaction and return their common content revision
```

### T1.5 Runtime Readiness (B)

- **Depends on:** T1.3
- **Seam:** `src/domain/workspace/readiness.ts` — `evaluateReadiness(observations)` (pure) and `RuntimeReadiness` service over a `ReadinessHost` port.

```text
describe("Readiness decision")
  it should be Writable when the diagnostic transaction, capacity, service-worker control, and inventory checks all pass
  it should stay Writable and report BestEffort protection when storage is not persistent
  it should report Protected, BestEffort, or Unavailable protection exactly as observed
  it should be Unsupported and list every failed check when no readable Workspace exists
  it should list both failed checks when two checks fail together
  it should be Recovery Only when a readable Workspace exists and any check fails
  it should be Unsupported with Integrity Blocked status when an existing root cannot be read
  it should offer retry and recommend another browser when Unsupported
describe("Capacity check")
  it should fail when available bytes are below the derived minimum
  it should pass when available bytes equal the derived minimum
  it should fail with an Unavailable reason when the host cannot estimate capacity
describe("Release checks")
  it should fail service-worker control when no controller exists
  it should fail service-worker control when the controller reports a different release
  it should fail the inventory check when any listed asset is missing from the release cache
  it should fail the inventory check when any cached asset's digest differs
describe("Readiness lifecycle")
  it should invalidate Writable immediately when a storage failure is reported during the session
  it should become Pending after a release activation until it is evaluated again
describe("Diagnostic transaction")
  it should write and delete a probe record in the isolated probe database and leave every authoritative store unchanged
```

### T1.6 Capacity minimum (S)

- **Depends on:** T1.5
- **Work:** define `CAPACITY_MINIMUM_BYTES` with its derivation in code comments: estimated mature Workspace ≈ 0.95 GB (200,000 Execution facts × ~0.7 KB, 25,000 Trades × ~2.5 KB, ~400,000 Journal items × ~1 KB including about 250,000 Daily Trade Review Actions, ~400,000 Marks × ~0.3 KB, plus ~30% index overhead), doubled for migration headroom because an upgrade transaction can hold old and new records together, rounded to **2 GiB available**. Backup artifacts are built in memory and downloaded, so they add no origin storage. D3 replaces the estimate with a measurement (T3.11).
- **Verification:** unit test asserting the constant equals the documented formula's result; plan text and code comment agree.

### T1.7 Offline Release Inventory (B)

- **Depends on:** T1.1
- **Seam:** `build/inventory.ts` — `createInventory(assets)` and the Vite plugin that writes `inventory.json`.

```text
describe("Offline Release Inventory")
  it should list every emitted asset, the HTML entry, the Web App Manifest, and every icon
  it should record a SHA-256 digest for every listed asset
  it should derive the release identity from the complete sorted asset and digest set
  it should produce the same release identity for identical builds
  it should produce a different release identity when any asset changes
  it should exclude inventory.json and the service-worker script from the asset list
```

### T1.8 Service worker (B)

- **Depends on:** T1.7
- **Seam:** `src/sw/release.ts` functions with injected Cache Storage and fetch (unit tests use in-memory doubles); `src/sw/sw.ts` wires them to service-worker events.

```text
describe("Release installation")
  it should cache every inventory asset under a cache named for the release
  it should fail installation when any fetched asset's digest differs from the inventory
  it should fail installation when any asset cannot be fetched
  it should leave the previous release's cache untouched while a new release installs
describe("Activation policy")
  it should activate and claim clients immediately when no previous release controls a client
  it should wait for an explicit activation request when a previous release is active
  it should delete older release caches only after the new release activates
describe("Request handling")
  it should answer navigations with the active release's HTML entry from cache
  it should answer asset requests from the active release's cache without using the network
  it should report its release identity when the page asks
```

### T1.9 Web App Manifest and icons (S)

- **Depends on:** T1.1
- **Work:** `manifest.webmanifest` with stable `id`, `name` "Trade Journal", `short_name`, `start_url`, `scope`, `display: standalone`, theme and background colors from the cream visual language, and 192 px, 512 px, and maskable icons; linked from the HTML entry.
- **Verification:** `npm run build` emits the manifest and icons; `npm run check:manifest` validates required fields and that each icon file exists with its declared size. E2E E1.2 asserts the served manifest.

### T1.10 Reference Catalog (B)

- **Depends on:** T1.4
- **Seam:** `src/domain/reference-catalog/index.ts`

```text
describe("Catalog seeding")
  it should seed exactly the eleven Strategies in specification order with their typed shapes
  it should seed Iron Condor roles as long Put, short Put, short Call, long Call in ascending strike order with equal absolute quantities
  it should seed Covered Call share coverage through the contract multiplier
  it should seed exactly the five Close Reasons with Rolled holding the workflow role
  it should seed exactly the five Abandonment Reasons
  it should seed one IdeaSource Tag Type with no values
  it should seed no Institution, Account, generic Custom Strategy, Other reason, or settlement-named reason
  it should create nothing on a repeated seed of the same manifest
  it should not overwrite a seeded value the trader renamed
  it should return SeedConflict and write nothing when a stable key exists with an incompatible meaning
  it should return the new Catalog snapshot and the selectable-Account summary
describe("Catalog save")
  it should create an Institution and return its identity, current record, history head, and new snapshot
  it should create an Account only under a selectable Institution
  it should keep an Account's Institution unchanged by every save variant
  it should append a revision on rename and keep the stable identity
  it should reject a label already used in its namespace (Institution globally, Account within Institution, Tag Value within Tag Type, each reason taxonomy within itself)
  it should reject archiving an Institution that still has selectable Accounts
  it should allow renaming the IdeaSource Tag Type and reject archiving it
  it should reject retiring a seeded Close or Abandonment Reason and allow renaming it
  it should allow retiring and reactivating a seeded Strategy
  it should allow retiring and reactivating trader-created Tag Values and reasons
  it should return Conflict and write nothing for a stale expected revision
  it should return RuntimeNotWritable when readiness is not Writable
describe("Catalog query")
  it should list only selectable records by default in deterministic label then identity order
  it should include inactive records with their Archived or Retired status when asked
  it should reject a cursor after the Catalog snapshot changes
  it should return the complete label and availability history for one identity
describe("Catalog resolve")
  it should accept active identities for NewSelection and reject inactive ones as InactiveForRequestedUse
  it should reject a NewSelection Account whose Institution is archived
  it should accept inactive identities for RetainedReference
  it should return the label effective at the requested time for HistoricalSnapshot
  it should return current labels without selection eligibility for DisplayOnly
  it should return a snapshot conflict when ExpectedCatalogSnapshot differs
```

### T1.11 Journal seeding and definitions (B)

- **Depends on:** T1.4
- **Seam:** `src/domain/journal/index.ts` (`seedDefaults`, `getDefinitions`)

```text
describe("Journal seeding")
  it should create the seven fixed Entry Types under stable product keys
  it should create the seven initial Sources under stable product keys
  it should seed the Plan Reflection definition with its four prompts, kinds, requiredness, options, and Thesis/Invalidation roles
  it should seed the Position Change Reflection definition exactly
  it should seed the Management Revision definition with its AllOrNone rule on the revised-thesis prompts
  it should seed the Close Review definition exactly
  it should seed the Daily Trade Review definition with Hold, Exit, Roll, Adjust and its RequireWhenOption Intent rule
  it should seed the Review Note definition exactly
  it should seed the Trader Reflection definition exactly
  it should create nothing on a repeated seed
  it should return SeedConflict and write nothing when a stable key exists with an incompatible meaning
describe("Definition reads")
  it should return the latest definition for each fixed Entry Type
  it should return an exact retained definition revision by identity
```

### T1.12 Workspace lifecycle (B)

- **Depends on:** T1.4, T1.5, T1.10, T1.11
- **Seam:** `src/domain/workspace/index.ts`

```text
describe("Workspace initialize")
  it should return RuntimeNotWritable with Unsupported and every failed check and create nothing when readiness fails in a fresh environment
  it should return TimeZoneSelectionRequired for a fresh Writable environment without a time zone
  it should create metadata and seed Journal and Catalog defaults in one transaction and return Opened with Needs Institution and Account
  it should reopen an existing Workspace without rewriting seeded data
  it should return Ready for Trade Planning once a selectable Account exists
  it should return Migration Blocked with unchanged-data evidence when the stored schema is newer than the installed release
  it should return Integrity Blocked when readiness passes but stored contents fail validation
  it should never initialize over a root that could not be read
  it should include readiness evidence, fresh/existing status, and seed additions in the receipt
describe("Workspace status")
  it should report Ready only when readiness is Writable
  it should report Initialization Required only after a writable store proved no Workspace exists
  it should report Recovery Only with readable status when a readable Workspace exists and readiness fails
  it should report Integrity Blocked with safe actions when a possible existing root cannot be read
describe("Workspace settings")
  it should save a new time zone and return the complete settings, status, and new binding
  it should return Unchanged when the submitted settings equal the current settings
  it should return Conflict with current settings for a stale settings revision
  it should reject an invalid time zone without writing
  it should leave every stored instant and date unchanged when the time zone changes
describe("Durability request")
  it should return Improved with Protected when the host grants persistence
  it should return AlreadyProtected when persistence was already granted
  it should return NotImproved with BestEffort or Unavailable when the host declines or cannot persist
  it should leave readiness unchanged whatever the durability result
```

### T1.13 Browser readiness host (B)

- **Depends on:** T1.5, T1.8
- **Seam:** `src/ui/platform/browser-readiness-host.ts` — tested in the `component` project in real Chromium; the absent-API cases inject a stub `navigator`.

```text
describe("Browser readiness host")
  it should report protection from navigator.storage.persisted()
  it should report Unavailable protection when the Storage API is absent
  it should report available bytes as quota minus usage from navigator.storage.estimate()
  it should report no controller when the page is not controlled by a service worker
  it should request persistence through navigator.storage.persist() and map the answer to a durability result
  it should verify cached assets against the inventory by recomputing SHA-256 digests
```

### T1.14 Application services and Installed Capability Manifest (B)

- **Depends on:** T1.10, T1.11, T1.12, T1.13
- **Seam:** `src/app/services.ts` — `createAppServices(host)`; `src/app/capabilities.ts`.

```text
describe("Installed Capability Manifest")
  it should declare exactly the D1 operations and variants listed in this plan
  it should be frozen at runtime
describe("Application services")
  it should expose only operations declared in the Installed Capability Manifest
  it should return RuntimeNotWritable from a mutation at the service boundary before reaching persistence when readiness is not Writable
  it should return each mutation's revision-bound post-commit result without a follow-up read
```

### T1.15 Shell, navigation, and view states (B)

- **Depends on:** T1.14
- **Seam:** React components, `component` project with mocked services.

```text
describe("Responsive shell")
  it should show bottom navigation below the breakpoint and the left sidebar at or above it
  it should keep the route, selected record, and unsaved field values when the viewport crosses the breakpoint
  it should show only destinations for installed capabilities
describe("Startup gate")
  it should show startup verification, never an empty Workspace, while readiness is Pending
  it should disable every mutating control until readiness is Writable
describe("Unsupported view")
  it should name every failed readiness check
  it should offer retry and recommend another browser
  it should offer no initialization or import control
describe("Recovery Only view")
  it should keep read navigation available and disable every mutating control with one stated reason
  it should explain that another browser has separate storage and needs a completed backup and Restore to move data
describe("Integrity Blocked view")
  it should warn that journal data may already exist and offer only retry
describe("Storage protection notice")
  it should show a visible warning when protection is BestEffort or Unavailable
  it should offer the durability request only when the host can request persistence
  it should recommend creating a backup
  it should disappear when protection becomes Protected
  it should never disable another control
describe("Install affordance")
  it should offer installation when the host exposes an install prompt
  it should show platform instructions when it does not
  it should not require installation when the browser tab is Writable
describe("Update notice")
  it should announce an available update when a verified waiting release is reported
  it should defer activation and explain why while any form has unsaved values
  it should activate and reload when the trader confirms and no form has unsaved values
describe("View states")
  it should never show Empty while a request is Loading
  it should keep context and offer retry in the Error state
```

### T1.16 Onboarding and settings screens (B)

- **Depends on:** T1.15

```text
describe("First-run time zone")
  it should preselect the browser's zone when it is a valid rules-based zone
  it should initialize the Workspace with the chosen zone and show onboarding next
describe("Settings time zone")
  it should explain before Save that past dates and instants are not rewritten
  it should show the saved settings from the Save result without reloading
  it should keep the entered zone and show the current settings after a Conflict
describe("Onboarding")
  it should prompt for an Institution and Account while onboarding is Needs Institution and Account
  it should move to Ready for Trade Planning when the first Account is created
```

### T1.17 Reference management screens (B)

- **Depends on:** T1.15

```text
describe("Institutions and Accounts")
  it should create an Institution and show it from the Save result
  it should create an Account under a selected Institution
  it should show a namespace-duplicate error next to the label field and keep the input
  it should explain why archiving an Institution with selectable Accounts is refused
  it should show Archived status and keep archived records visible when inactive records are included
describe("Tags")
  it should create Tag Types and Tag Values
  it should allow renaming the IdeaSource Tag Type and offer no archive action for it
describe("Strategies")
  it should list the seeded Strategies with a readable description of each shape
  it should retire and reactivate a Strategy
describe("Reasons")
  it should offer rename but no retire for seeded Close and Abandonment Reasons
  it should create, retire, and reactivate trader-created reasons
describe("Form controls")
  it should give every control an accessible name and announce validation errors
```

### T1.18 Deployment pipeline (S)

- **Depends on:** T1.1; hosting decision (plan §7 question 2).
- **Work:** GitHub Actions workflow running `npm ci`, `npm run check`, `npm run test:unit`, `npm run build`, then deploying `dist/` to the chosen HTTPS host for this branch.
- **Verification:** a push to `claude-opus-5.5` produces a deployment; `npm run test:prod` (P1.1) passes against its address.

## Integration tests (Vitest browser mode, real IndexedDB, temporary profile)

Disclosed replacement: `TestReleaseHost` (service-worker control and inventory only).

| ID | Scenario | Durable-state proof |
|---|---|---|
| I1.1 | Fresh `initialize` creates metadata plus seeded Journal and Catalog in one commit and returns Opened with Needs Institution and Account. | Close and reopen the database connection; query Catalog and definitions; compare with the result. |
| I1.2 | A second `initialize` returns Opened (existing) with no seed additions. | Content revision unchanged. |
| I1.3 | Create Institution and Account through services; status becomes Ready for Trade Planning. | Each mutation result equals an independent read at the returned revision (AC-RESP-001). |
| I1.4 | Rename with a stale revision returns Conflict. | Full store dump before and after is identical. |
| I1.5 | Readiness invalidated mid-session; a Catalog save returns RuntimeNotWritable at the service boundary, and a direct persistence write also returns it. | Store dump unchanged. |
| I1.6 | `saveSettings` changes the time zone. | Stored instants and revisions of other records unchanged. |
| I1.7 | A database at a newer schema version yields Migration Blocked. | Database version and records unchanged. |
| I1.8 | Rename a seeded Close Reason, then reseed. | Renamed label retained; no new records. |

## End-to-end tests (Playwright, production build, real service worker, temporary profiles)

| ID | Scenario | Acceptance |
|---|---|---|
| E1.1 | First launch online: verification, Writable, time zone, Opened, create Institution and Account, Ready. | AC-DEL-003 (browser tab), AC-DEL-004 (all pass) |
| E1.2 | Served manifest has `id`, name, icons, `start_url`, `scope`, `display: standalone`; every inventory digest matches the served asset; the controlling worker reports the same release. | AC-DEL-003 |
| E1.3 | Offline cold restart: persistent temporary profile directory; close the browser; relaunch with the network disabled; readiness Writable, data present; create a Tag offline; restart again and confirm it persists. | AC-DEL-001 |
| E1.4 | Fresh-environment readiness matrix, each failing alone: service workers blocked (`serviceWorkers: 'block'`); capacity below minimum (CDP `Storage.overrideQuotaForOrigin`); a cached asset tampered in Cache Storage; diagnostic transaction failing (disclosed init-script fault injection on the probe database); two failures at once. Each yields Unsupported naming every failed check, offers retry and another browser, creates no authoritative database, and services return RuntimeNotWritable. Storage not persisted yields Writable plus the notice. Three different user-agent strings produce identical decisions. | AC-DEL-004, AC-DEL-003 |
| E1.5 | Existing Workspace, then each failure above: Recovery Only; reads work; mutating controls disabled with one reason; services return RuntimeNotWritable; revisions unchanged; other-browser explanation shown. | AC-DEL-005 (backup part in D8) |
| E1.6 | Existing database made unreadable (disclosed init-script fault injection on open): Unsupported plus Integrity Blocked; no initialization offered; after removing the injection the original records are intact. | AC-DEL-005 |
| E1.7 | Repeated launches each produce a fresh readiness receipt; a storage failure injected mid-session makes the next mutation return RuntimeNotWritable and the app enter Recovery Only. | AC-DEL-006 |
| E1.8 | Update: release A active with an unsaved Institution form; the server switches to release B; notice appears only after B's inventory verifies; A stays in control; the form keeps its values; activation is deferred with an explanation while the form is dirty; after the form is cancelled, activation reloads into B and readiness runs again. A second case serves B with a corrupted asset: no notice, A remains. An offline page keeps A. | AC-DEL-002, AC-DEL-006 |
| E1.9 | Live resize wide → narrow → wide on the Institution form with partial input: layout switches; route, values, and validation messages persist. | AC-UI-001 |
| E1.10 | Keyboard-only onboarding; axe scan of every D1 view with no serious or critical findings; Loading, Ready, Empty, and Error distinguishable; focus moves to the first error after failed validation. | AC-UI-002 |
| E1.11 | Navigation and services offer only D1 capabilities; no Trades, Journal, or Backup destinations. | AC-CAP-001 |
| P1.1 | Production smoke on the deployed HTTPS address: manifest, worker control, Writable in a fresh profile; exact browser version recorded. | AC-DEL-003 |
| M1.1 | Manual: install the app in Chrome and Vivaldi on macOS and Linux and in Chrome on Android; capture the installed launch and record exact versions. | AC-DEL-003 |

## Critic flows

| ID | Flow |
|---|---|
| C1.1 | First run in a wide window: verification, time zone, onboarding, first Institution and Account. |
| C1.2 | The same first run in a narrow window. |
| C1.3 | Institutions and Accounts: duplicate label, archive refused while Accounts are selectable, archive after archiving its Accounts, inactive listing. |
| C1.4 | Tags and IdeaSource rules. |
| C1.5 | Strategies and reasons: shapes readable, seeded-reason protection, trader-created reason lifecycle. |
| C1.6 | Time-zone change with its explanation. |
| C1.7 | Storage-protection notice and durability request. |
| C1.8 | Service workers blocked: Unsupported view content and actions. |
| C1.9 | Update available with an unsaved form. |
| C1.10 | Offline relaunch and an offline edit. |
| C1.11 | Keyboard-only pass through every D1 screen, and a live resize. |

## Acceptance mapping

| Scenario | Coverage in D1 |
|---|---|
| AC-RESP-001 | I1.3 (Catalog, Settings, Workspace mutation families) |
| AC-REF-001 | T1.10 seeding cases, I1.1 |
| AC-REF-002 | T1.10 resolve cases (inactive history, new-selection block, concurrent retirement); Trade and Journal history parts in D2 and D4 |
| AC-JOUR-007 | T1.11, I1.1, I1.2; reseed after a trader revision in D4 |
| AC-DEL-001 | E1.3 |
| AC-DEL-002 | E1.8 |
| AC-DEL-003 | E1.1, E1.2, E1.4, P1.1, M1.1 |
| AC-DEL-004 | T1.5, E1.4 |
| AC-DEL-005 | E1.5, E1.6 (backup export in D8) |
| AC-DEL-006 | T1.5, E1.7, E1.8 |
| AC-UI-001 | T1.15, E1.9 |
| AC-UI-002 | T1.15–T1.17, E1.10 |
| AC-CAP-001 | T1.14, E1.11 |
