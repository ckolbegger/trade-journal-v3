# Deliverable 1 Task Breakdown: Foundation — PWA Runtime Readiness, Workspace Initialization, and First Institution & Account Onboarding

**Deliverable:** D1 (from [`plan/implementation-plan.md`](./implementation-plan.md))  
**Approved Stack:** TypeScript 7 (`@typescript/native` / `tsgo` for typechecking + `"typescript": "npm:@typescript/typescript6@^6.0.2"` alias for `typescript-eslint`), React 19, Vite (strict port `DEV_PORT` / `5180`), Tailwind CSS v4, Native IndexedDB (`idb`) behind the internal `Persistence/Transaction` seam, `Intl` time-zone validation, custom versioned Service Worker + SHA-256 `Offline Release Inventory`, Vitest + `fake-indexeddb`, Playwright + `@axe-core/playwright`.

---

## Dependency & Parallelism Map Within Deliverable 1

1. **Task 1.1 (Project Toolchain, TypeScript 7 + ESLint Workaround, and Core Domain Contracts)** fixes the shared TypeScript interfaces (`Workspace`, `ReferenceCatalog`, `Persistence/Transaction`, `RuntimeReadiness`, `InstalledCapabilityManifest` v1) and test harnesses.
2. Once **Task 1.1** is complete, the following tracks can proceed in parallel:
   - **Infrastructure Track:** Task 1.2 (PWA Web App Manifest, Versioned Service Worker, and SHA-256 `Offline Release Inventory`) and Task 1.3 (`Persistence/Transaction` IndexedDB v1 Seam, Diagnostic Probe, and `RuntimeNotWritable` Gate).
   - **Domain Track:** Task 1.4 (`RuntimeReadiness` Gate, Capacity Headroom Derivation, and `Workspace.requestDurability`), Task 2.1–2.2 (`Workspace.initialize`, `Workspace.getStatus`, `Workspace.saveSettings`), and Task 3.1–3.2 (`ReferenceCatalog.save`, `query`, `resolve` for `Institution` and `Account` + onboarding state derivation).
   - **UI Shell Track:** Task 1.5, Task 2.3, and Task 3.3 (Responsive Narrow/Wide App Shell, Readiness/Recovery/Unsupported/Integrity-Blocked Screens, Time-Zone Initialization & Settings UI, and First Institution & Account Onboarding UI).
3. **Task 3.4 (End-to-End PWA Offline Restart, Update Deferral, Responsive Resize, and WCAG AA Verification)** closes Deliverable 1 across all D1 acceptance scenarios (`AC-DEL-001`–`AC-DEL-006`, `AC-RESP-001`, `AC-UI-001`, `AC-UI-002`, `AC-CAP-001`).

---

## Story 1: PWA Runtime Readiness, Host Storage Protection, and Write Gating

> **User Story 1:** **As a** trader launching the app, **I would like** the application to verify browser-neutral `Runtime Readiness`, display host storage protection status with an option to request stronger durability, and block writes whenever the runtime is not `Writable`, **so that** my local journal never accepts writes in an unsafe or unverified browser environment.

---

### Task 1.1: Project Toolchain, TypeScript 7 (`tsgo`) + ESLint Workaround, and Installed Capability Manifest v1

#### Scope & Implementation Details
- Configure `package.json` with:
  - `"@typescript/native": "npm:typescript@^7.0.2"` (invoking `tsgo --noEmit` for fast TypeScript 7 typechecking)
  - `"typescript": "npm:@typescript/typescript6@^6.0.2"` (Microsoft's side-by-side npm alias workaround so `typescript-eslint` resolves the synchronous JS compiler API)
  - Vite configured to read `DEV_PORT` from `.env.local` (`5180`) with `strictPort: true`
  - Tailwind CSS v4, React 19, `idb`, `decimal.js`, Vitest (`fake-indexeddb`), and Playwright (`@axe-core/playwright`)
- Define the immutable **Installed Capability Manifest v1** (`src/domain/workspace/capability-manifest.ts`) declaring only Deliverable 1 capabilities:
  - Schema version: `1` (supported backup/migration range `[1, 1]`)
  - Installed operations: `Workspace.initialize`, `Workspace.getStatus`, `Workspace.saveSettings`, `Workspace.requestDurability`, `ReferenceCatalog.save` (`CreateInstitution`, `CreateAccount`), `ReferenceCatalog.query` (`Institution`, `Account`), `ReferenceCatalog.resolve` (`NewSelection` for `Account`)
  - Omit all undelivered operations (`confirmPlan`, `recordPositionChange`, `DailyReview.*`, `PerformanceAnalysis.*`, `exportBackup`, `prepareRestore`, etc.) rather than exposing stubs or returning domain-level `Unavailable` (`AC-CAP-001`).

#### Test Specifications (`describe` / `it should`)

```ts
describe('Task 1.1: Installed Capability Manifest v1 & Toolchain Contracts (AC-CAP-001)', () => {
  describe('getInstalledCapabilityManifest()', () => {
    it('should return an immutable manifest bound to release v1 and schema version 1', () => {});

    it('should declare only Deliverable 1 operations (Workspace.initialize, getStatus, saveSettings, requestDurability, and ReferenceCatalog Institution/Account creation, query, and NewSelection resolution)', () => {});

    it('should be dependency-closed so every declared operation has its required persistence store and UI entry point', () => {});

    it('should omit undelivered capabilities (Tradeplanning, Executions, Daily Review, Reports, Backup/Restore, Catalog rename/archive) rather than advertising partial operations or domain-level Unavailable states', () => {});

    it('should freeze the manifest object deeply so callers cannot mutate or toggle capabilities at runtime (boundary/error case)', () => {});
  });
});
```

---

### Task 1.2: Web App Manifest, Versioned Service Worker, and Digest-Verified `Offline Release Inventory`

#### Scope & Implementation Details
- Create the Web App Manifest (`public/manifest.webmanifest`) with stable application identity (`id`), `name`, `short_name`, icons, `start_url`, navigation `scope`, and `display: "standalone"`.
- Build a Vite build/dev plugin and versioned Service Worker (`src/pwa/service-worker.ts`, `src/pwa/release-inventory.ts`) that generates and verifies an immutable `OfflineReleaseInventory` containing every application asset URL and its SHA-256 hex digest.
- Implement staged update handling in the Service Worker and client coordinator (`src/pwa/update-coordinator.ts`):
  - A new Service Worker verifies all assets in the new `OfflineReleaseInventory` against their SHA-256 digests before advertising `UpdateAvailable`.
  - Never calls `skipWaiting()` automatically while an active release controls a client with unsaved form state (`AC-DEL-002`).
  - Activates only on explicit user-confirmed safe reload/restart, or defers activation with a clear reason when an active form has unsaved input.

#### Test Specifications (`describe` / `it should`)

```ts
describe('Task 1.2: Web App Manifest, Service Worker & Offline Release Inventory (AC-DEL-002, AC-DEL-003)', () => {
  describe('Web App Manifest contract', () => {
    it('should expose a stable application id, name, icons, start_url, navigation scope, and standalone display mode', () => {});

    it('should contain zero trader data or mutable workspace state', () => {});
  });

  describe('OfflineReleaseInventory verification', () => {
    it('should validate when every listed release asset is present in cache storage and its SHA-256 digest matches exactly (happy path)', () => {});

    it('should handle single-byte and zero-byte asset edge cases with exact SHA-256 digest verification (boundary condition)', () => {});

    it('should fail verification and report the exact missing asset path when any required entry in the Offline Release Inventory is absent (error case)', () => {});

    it('should fail verification and report a digest mismatch when any cached asset payload differs from its declared SHA-256 digest by even 1 byte (error case)', () => {});

    it('should reject an empty or malformed Offline Release Inventory manifest (error case)', () => {});
  });

  describe('Service Worker update staging and deferral (AC-DEL-002)', () => {
    it('should advertise UpdateAvailable only after the candidate release inventory is completely cached and all SHA-256 digests pass (happy path)', () => {});

    it('should keep the current release in control and defer update activation with an explicit reason when the trader has dirty/unsaved form state (boundary/edge case)', () => {});

    it('should activate the staged service worker only upon an explicit safe reload/restart request when no unsaved form state is at risk (happy path)', () => {});

    it('should discard the candidate update and leave the running release and Workspace untouched when candidate asset staging or digest verification fails (error case)', () => {});
  });
});
```

---

### Task 1.3: Internal `Persistence/Transaction` IndexedDB Seam (Schema v1), Isolated Diagnostic Probe, and `RuntimeNotWritable` Gate

#### Scope & Implementation Details
- Implement the internal `Persistence/Transaction` seam (`src/persistence/transaction-manager.ts`, `src/persistence/schema-v1.ts`) wrapping IndexedDB (`idb`):
  - **Schema v1 stores:**
    - `workspace_meta`: stores Workspace metadata, `WorkspaceSnapshotBinding`, time-zone setting + revision, schema version (`1`), and latest initialization/migration receipt.
    - `reference_catalog`: stores `Institution` and `Account` records, their immutable parent relationships, current selection availability, and append-only revision histories.
    - `_diagnostic_probe`: isolated diagnostic object store used exclusively by the `Runtime Readiness` check; never stores authoritative facts.
  - **Isolated Diagnostic Transaction:** opens the database, writes and deletes a transient diagnostic probe key inside `_diagnostic_probe` in an isolated readwrite transaction, and verifies that zero authoritative records or audit trail entries are created or modified.
  - **Existing-Root Integrity Detection:** distinguishes between:
    1. A genuinely empty fresh store (writable store opened cleanly, zero `workspace_meta` and zero `reference_catalog` records).
    2. An existing readable Workspace (`workspace_meta` present and schema-valid).
    3. A known or possible existing storage root that cannot be read or fails structural/checksum validation (`IntegrityBlocked` — never treated as an empty store and never overwritten).
  - **Persistence-Level Write Gate:** every readwrite transaction entry point checks current `RuntimeReadiness` and immediately aborts/returns `{ kind: 'RuntimeNotWritable', readiness }` without touching storage whenever readiness is not `Writable`.

#### Test Specifications (`describe` / `it should`)

```ts
describe('Task 1.3: Persistence/Transaction Seam, Diagnostic Probe & Write Gate (AC-DEL-004, AC-DEL-005, AC-DEL-006)', () => {
  describe('runDiagnosticProbeTransaction()', () => {
    it('should open IndexedDB, complete an isolated readwrite probe in _diagnostic_probe, and leave zero records in workspace_meta, reference_catalog, or _diagnostic_probe (happy path)', () => {});

    it('should not increment any WorkspaceSnapshotBinding, settings revision, or catalog snapshot token when the diagnostic probe runs (edge case)', () => {});

    it('should return a structured DiagnosticTransactionFailed check failure when IndexedDB open or readwrite commit throws or aborts (error case)', () => {});
  });

  describe('inspectStorageRoot()', () => {
    it('should report FreshEmptyRoot only when the database opens cleanly and both workspace_meta and reference_catalog are proven empty (happy path)', () => {});

    it('should report ExistingReadableWorkspace with its snapshot binding when valid workspace_meta exists (happy path)', () => {});

    it('should report IntegrityBlockedRoot when workspace_meta is missing/corrupt but reference_catalog contains records (partial/corrupt root edge case)', () => {});

    it('should report IntegrityBlockedRoot when a known storage root marker exists or IndexedDB read throws an unexpected DOMException, never falling through to FreshEmptyRoot (error case)', () => {});

    it('should report IntegrityBlockedRoot when stored schemaVersion is higher than the installed release schema version (unknown newer data boundary condition)', () => {});
  });

  describe('Persistence-level RuntimeNotWritable write gate', () => {
    it('should commit all participating object stores atomically when RuntimeReadiness is Writable (happy path)', () => {});

    it('should reject any write transaction with RuntimeNotWritable and leave all store revisions unchanged when RuntimeReadiness is Unsupported or RecoveryOnly (error case)', () => {});

    it('should immediately invalidate Writable status and block the next write transaction if a storage or release-integrity failure occurs mid-session (AC-DEL-006 edge case)', () => {});

    it('should roll back all changes across workspace_meta and reference_catalog if any step inside a multi-store transaction throws or aborts (atomicity error case)', () => {});
  });
});
```

---

### Task 1.4: Browser-Neutral `RuntimeReadiness` Evaluator, Plan-Derived Capacity Headroom, and `Workspace.requestDurability`

#### Scope & Implementation Details
- Implement `evaluateRuntimeReadiness` (`src/domain/workspace/runtime-readiness.ts`) using strictly functional checks (never reading `navigator.userAgent`, `navigator.vendor`, platform name, or vendor install-prompt presence):
  1. **Diagnostic Transaction Check:** isolated `_diagnostic_probe` readwrite transaction succeeds.
  2. **Capacity & Headroom Check:** compares available storage quota (`navigator.storage.estimate()`) against a disclosed plan-derived minimum constant (`MIN_REQUIRED_STORAGE_BYTES`, e.g., `150 * 1024 * 1024` bytes / 150 MiB, derived from mature 5-year 25,000-Trade / 200,000-fact dataset footprint ~45 MiB + 2x isolated migration candidate and full backup staging headroom).
  3. **Service Worker Controller Check:** verifies that the intended versioned Service Worker controls the client.
  4. **Offline Release Inventory Check:** verifies that the current release's complete `OfflineReleaseInventory` is present and SHA-256 digest-valid.
- Evaluate all 4 checks without short-circuiting so simultaneous failures report every failed check at once (`AC-DEL-004`).
- Query host storage protection (`navigator.storage.persisted()`) and report `Protected`, `BestEffort`, or `Unavailable` as advisory state that never fails `RuntimeReadiness`.
- Implement `Workspace.requestDurability` (`src/domain/workspace/request-durability.ts`) invoking `navigator.storage.persist()` on explicit user gesture and returning `Improved { currentProtection: 'Protected' }`, `AlreadyProtected { currentProtection: 'Protected' }`, or `NotImproved { currentProtection: 'BestEffort' | 'Unavailable', reason }`.

#### Test Specifications (`describe` / `it should`)

```ts
describe('Task 1.4: RuntimeReadiness Evaluator & Workspace.requestDurability (AC-DEL-003, AC-DEL-004, AC-DEL-005, AC-DEL-006)', () => {
  describe('evaluateRuntimeReadiness() — browser-neutral functional checks', () => {
    it('should return Writable when all four functional checks pass regardless of user-agent, OS, or absence of beforeinstallprompt (happy path)', () => {});

    it('should return Writable when all four checks pass even if host storage protection is BestEffort or Unavailable (advisory protection edge case)', () => {});

    it('should pass capacity check at the exact boundary where availableBytes === MIN_REQUIRED_STORAGE_BYTES (boundary condition)', () => {});

    it('should fail capacity check with InsufficientCapacity when availableBytes === MIN_REQUIRED_STORAGE_BYTES - 1 (boundary condition)', () => {});

    it('should return Unsupported with DiagnosticTransactionFailed when no Workspace exists and the diagnostic probe fails (error case)', () => {});

    it('should return Unsupported with ServiceWorkerNotControlling when no Workspace exists and the versioned service worker does not control the page (error case)', () => {});

    it('should return Unsupported with ReleaseInventoryInvalid when no Workspace exists and an asset is missing or fails SHA-256 verification (error case)', () => {});

    it('should evaluate all four checks without short-circuiting and return every failed check when two or more checks fail simultaneously (AC-DEL-004 error case)', () => {});

    it('should return RecoveryOnly (preserving read access) when an existing Workspace is readable but any of the four readiness checks fails (AC-DEL-005 edge case)', () => {});

    it('should return Unsupported paired with IntegrityBlocked Workspace status when a known or possible existing storage root cannot be read (AC-DEL-005 error case)', () => {});
  });

  describe('Workspace.requestDurability()', () => {
    it('should return AlreadyProtected when host storage is already persistent before requesting (happy path)', () => {});

    it('should return Improved with currentProtection: Protected when navigator.storage.persist() grants persistence (happy path)', () => {});

    it('should return NotImproved with currentProtection: BestEffort and reason when navigator.storage.persist() returns false, while keeping RuntimeReadiness Writable (edge case)', () => {});

    it('should return NotImproved with currentProtection: Unavailable and reason when StorageManager.persist API is absent or throws, without deleting or mutating data (error case)', () => {});
  });
});
```

---

### Task 1.5: Startup Verification UI, Advisory Durability Banner, and `Unsupported` / `Recovery Only` / `Integrity Blocked` Screens

#### Scope & Implementation Details
- Build the startup readiness gate UI and advisory storage-protection banner (`src/ui/readiness/`):
  - **Loading / Startup Verification State:** displays explicit startup verification progress without showing a false Empty state or enabling mutating controls (`AC-UI-002`).
  - **Advisory Storage Protection Banner:** shown whenever `localDataProtection` is `BestEffort` or `Unavailable`; warns that the browser may clear local data, recommends creating a backup, and provides an explicit `Request Stronger Durability` button wired to `Workspace.requestDurability` where supported. Never disables controls.
  - **`Unsupported` View:** lists every failed readiness check, explains that the app will not risk journal data in the current environment, offers `Retry Readiness Check`, and recommends trying another browser (explaining browser storage isolation).
  - **`Recovery Only` View:** preserves read access to existing Workspace settings and catalog records while disabling all mutating controls with one clear reason (`RuntimeNotWritable`) and explaining that another browser has separate storage.
  - **`Integrity Blocked` View:** warns that local journal data may already exist on the unreadable/corrupt storage root, offers only safe retry/recovery guidance, and hides/blocks fresh initialization or overwrite.

#### Test Specifications (`describe` / `it should`)

```ts
describe('Task 1.5: Readiness UI States & Advisory Protection Banner (AC-DEL-004, AC-DEL-005, AC-UI-002)', () => {
  describe('Startup Loading vs Ready states', () => {
    it('should render an accessible Loading verification indicator while RuntimeReadiness is pending without showing false Empty states or enabled Save buttons (happy path)', () => {});

    it('should render the advisory storage-protection warning banner with a Request Durability button when readiness is Writable and protection is BestEffort (happy path)', () => {});

    it('should update the banner to Protected and hide the warning when clicking Request Durability returns Improved (happy path)', () => {});

    it('should keep the warning banner visible and display the non-blocking reason when clicking Request Durability returns NotImproved (edge case)', () => {});
  });

  describe('Unsupported, RecoveryOnly, and IntegrityBlocked views', () => {
    it('should render every failed check, a Retry button, and browser-isolation guidance when readiness is Unsupported with multiple simultaneous failures (error case)', () => {});

    it('should render RecoveryOnly mode allowing read navigation of existing Institutions/Accounts while disabling all creation and settings-save controls with a clear RuntimeNotWritable explanation (AC-DEL-005)', () => {});

    it('should render IntegrityBlocked warning that existing journal data may be present and must never render the fresh Workspace initialization form (AC-DEL-005 boundary/error case)', () => {});
  });
});
```

---

## Story 2: Device-Local Workspace Initialization and Time-Zone Settings

> **User Story 2:** **As a** trader opening a fresh installation, **I would like** to initialize my device-local Workspace by choosing my rules-based time zone (and later update that time zone in settings), **so that** session cutoffs and calendar dates resolve consistently in my local time zone.

---

### Task 2.1: `Workspace.getStatus` and `Workspace.initialize` Operations

#### Scope & Implementation Details
- Implement `Workspace.getStatus(request: GetWorkspaceStatus)` (`src/domain/workspace/workspace-service.ts`):
  - Non-mutating inspection at `currentObservationInstant`.
  - Returns `InitializationRequired` only when `RuntimeReadiness` is `Writable` and storage inspection proves no Workspace exists.
  - Returns `Ready` with full `WorkspaceSnapshotBinding`, `timeZone` + `settingsRevision`, `InstalledCapabilityManifest` v1, `onboardingState` (`NeedsInstitutionAndAccount` or `ReadyForTradePlanning`), `runtimeReadiness`, `localDataProtection`, `schemaVersion: 1`, and latest initialization receipt.
  - Returns `RecoveryOnly` when an existing Workspace is readable but readiness is not `Writable`.
  - Returns `Unsupported` when no Workspace exists and readiness failed.
  - Returns `IntegrityBlocked` whenever a known or possible existing storage root cannot be read or validated.
- Implement `Workspace.initialize(request: InitializeWorkspace)`:
  - Re-establishes `RuntimeReadiness` first; if not `Writable`, returns `RuntimeNotWritable` (`RecoveryOnly` or `Unsupported` / `IntegrityBlocked`) with zero writes.
  - Validates `proposedTimeZone` as a canonical IANA rules-based time-zone identifier (`Intl.DateTimeFormat(undefined, { timeZone })`, rejecting empty strings, fixed UTC offsets like `"+05:00"`, or invalid identifiers).
  - If no Workspace exists and `proposedTimeZone` is omitted, returns `TimeZoneSelectionRequired` with zero writes.
  - When a fresh store and valid `proposedTimeZone` are provided, atomically commits `workspace_meta` (with initial `WorkspaceSnapshotBinding`, `settingsRevision: 1`, `schemaVersion: 1`, and initialization receipt) and derives `onboardingState: 'NeedsInstitutionAndAccount'` in one transaction, returning `Opened` with complete post-commit status so the caller needs no follow-up `getStatus` (`AC-RESP-001`).
  - When an existing valid v1 Workspace is already present, `initialize` re-establishes readiness and returns `Opened` idempotently without overwriting existing settings or catalog records.

#### Test Specifications (`describe` / `it should`)

```ts
describe('Task 2.1: Workspace.getStatus & Workspace.initialize (AC-DEL-004, AC-DEL-005, AC-DEL-006, AC-RESP-001)', () => {
  describe('Workspace.getStatus()', () => {
    it('should return InitializationRequired when RuntimeReadiness is Writable and the storage root is proven empty (happy path)', () => {});

    it('should return Ready with WorkspaceSnapshotBinding, timeZone, InstalledCapabilityManifest v1, and NeedsInstitutionAndAccount after initialization (happy path)', () => {});

    it('should never mutate storage or create diagnostic artifacts when getStatus is called repeatedly (idempotency edge case)', () => {});

    it('should return RecoveryOnly with readable Workspace status when a Workspace exists but a readiness check fails (error case)', () => {});

    it('should return IntegrityBlocked and never InitializationRequired when storage read fails or metadata is corrupt (error case)', () => {});
  });

  describe('Workspace.initialize()', () => {
    it('should initialize a fresh Workspace atomically with a valid IANA time zone (e.g., "America/New_York") and return Opened with complete post-commit status and receipt without requiring a follow-up getStatus (happy path, AC-RESP-001)', () => {});

    it('should return TimeZoneSelectionRequired and write nothing when initializing a fresh store without a proposedTimeZone (boundary condition)', () => {});

    it('should open an already-initialized v1 Workspace idempotently without overwriting its stored timeZone or Catalog records (edge case)', () => {});

    it('should reject invalid or non-IANA time-zone strings (e.g., "", "Mars/Phobos", "+04:00", "   ") with a typed validation rejection and zero writes (error case)', () => {});

    it('should return RuntimeNotWritable and write nothing when called while RuntimeReadiness is Unsupported or RecoveryOnly (error case, AC-DEL-004)', () => {});

    it('should return IntegrityBlocked and refuse to initialize or overwrite when an unreadable or partially corrupt existing root is detected (error case, AC-DEL-005)', () => {});
  });
});
```

---

### Task 2.2: `Workspace.saveSettings` with Optimistic Revision Binding

#### Scope & Implementation Details
- Implement `Workspace.saveSettings(command: SaveWorkspaceSettings)` (`src/domain/workspace/workspace-service.ts`):
  - Enforces `RuntimeReadiness === 'Writable'` at both service and persistence boundaries.
  - Validates the complete `settings.timeZone` IANA identifier and `expectedSettingsRevision`.
  - When `settings.timeZone` equals the currently stored time zone and `expectedSettingsRevision` matches, returns `Unchanged` with the current status/binding and performs no write.
  - When `expectedSettingsRevision` does not match the stored `settingsRevision`, returns `Conflict` with the current stored settings/revision and performs no write.
  - When valid and changed, atomically updates `timeZone`, increments `settingsRevision`, generates a new `WorkspaceSnapshotBinding`, and returns `Saved` with complete post-commit `WorkspaceStatus` and `WorkspaceSnapshotBinding` so no follow-up `getStatus` is needed (`AC-RESP-001`).

#### Test Specifications (`describe` / `it should`)

```ts
describe('Task 2.2: Workspace.saveSettings (AC-RESP-001, AC-DEL-004)', () => {
  describe('saveSettings() happy path & revision binding', () => {
    it('should save a new valid IANA time zone (e.g., "America/Chicago"), increment settingsRevision from 1 to 2, advance WorkspaceSnapshotBinding, and return complete post-commit status in one call (happy path, AC-RESP-001)', () => {});

    it('should return Unchanged without incrementing settingsRevision or writing to storage when the submitted timeZone is identical to the current timeZone at the expected revision (edge case)', () => {});

    it('should accept rare but valid multi-segment IANA zones such as "America/Indiana/Indianapolis" and "UTC" (boundary condition)', () => {});
  });

  describe('saveSettings() conflict, validation, and readiness errors', () => {
    it('should return Conflict with the current stored settings and revision when expectedSettingsRevision is stale (0 or 99), leaving storage unchanged (error case)', () => {});

    it('should return Rejected with typed validation issues and leave storage unchanged when timeZone is blank or invalid (error case)', () => {});

    it('should return RuntimeNotWritable and leave storage unchanged when readiness transitions to RecoveryOnly before saveSettings is called (error case, AC-DEL-006)', () => {});
  });
});
```

---

### Task 2.3: First-Run Time-Zone Initialization Flow and Workspace Settings View

#### Scope & Implementation Details
- Build the **Workspace Initialization Screen** (`src/ui/workspace/InitializeWorkspaceView.tsx`):
  - Defaults the rules-based IANA time-zone selector to the browser's detected IANA zone (`Intl.DateTimeFormat().resolvedOptions().timeZone`) when valid, while allowing selection/search of any valid IANA time zone.
  - Explains that market session dates stay U.S. exchange-defined while the Workspace time zone governs local View Moments, Daily Review selection, and named Report Period calendar boundaries.
  - On explicit `Initialize Workspace` submission, renders the returned `Opened` post-commit state directly (transitioning to the `Needs Institution and Account` onboarding screen without issuing a redundant `getStatus` read).
- Build the **Workspace Settings View** (`src/ui/workspace/WorkspaceSettingsView.tsx`):
  - Displays current `timeZone`, `settingsRevision`, `RuntimeReadiness` per-check status, `localDataProtection` status (with `Request Stronger Durability` action), and the installed release/capability summary.
  - Explains before Save that changing the time zone affects how future View Moments, Daily Review selection, and named Report Period boundaries resolve without rewriting stored instants or historical records.
  - Preserves user input and explains what changed if a `Conflict` occurs.

#### Test Specifications (`describe` / `it should`)

```ts
describe('Task 2.3: Workspace Initialization & Settings UI (AC-RESP-001, AC-UI-001, AC-UI-002)', () => {
  describe('First-run initialization flow', () => {
    it('should prefill the detected IANA time zone, allow changing it, and transition directly to Needs Institution and Account onboarding on submit using the initialize post-commit response (happy path)', () => {});

    it('should not persist any Workspace data if the trader changes the time-zone input and closes or refreshes before clicking Initialize Workspace (unsaved form boundary)', () => {});
  });

  describe('Workspace Settings time-zone update flow', () => {
    it('should display the prospective time-zone effect explanation before Save and update the displayed timeZone and revision immediately from the saveSettings response (happy path)', () => {});

    it('should show an Unchanged notice when saving the already-active time zone (edge case)', () => {});

    it('should surface a clear Conflict banner preserving user context when another tab has already updated settingsRevision (error case)', () => {});
  });
});
```

---

## Story 3: First Institution & Account Onboarding and Responsive Shell

> **User Story 3:** **As a** trader onboarding into an initialized Workspace, **I would like** to create my first `Institution` and brokerage `Account`, **so that** my Workspace transitions from `Needs Institution and Account` to `Ready for Trade Planning`.

---

### Task 3.1: `ReferenceCatalog` Operations for `Institution` and `Account` (`save`, `query`, `resolve`)

#### Scope & Implementation Details
- Implement the Deliverable 1 scope of `ReferenceCatalog` (`src/domain/reference-catalog/reference-catalog-service.ts`):
  - **No fictional Institutions or Accounts are ever seeded.**
  - **`save(command: CatalogSaveCommand)`** for `CreateInstitution` and `CreateAccount`:
    - Validates `expectedCatalogSnapshot` (optimistic concurrency binding).
    - Normalizes labels (trimming leading/trailing whitespace and collapsing internal whitespace runs for comparison while preserving display text) and enforces namespace distinguishability:
      - `Institution` current labels must be unique globally (case-insensitive normalized match).
      - `Account` current labels must be unique within the same parent `Institution` (an `Account` with the same label as an `Account` under a *different* `Institution` is valid!).
    - Validates that `CreateAccount` references an existing, selectable `Institution` parent (`parentInstitutionId`), which becomes immutable on the `Account`.
    - Appends revision `1` to the item's history chain, advances `CatalogSnapshotId`, updates Workspace onboarding status to `ReadyForTradePlanning` as soon as at least one selectable `Account` under a selectable `Institution` exists, and returns the generated stable identity, complete current record, appended history head, and new `CatalogSnapshotId` (`AC-RESP-001`).
  - **`query(request: CatalogQuery)`** for `Institution` and `Account`:
    - Lists `SelectableOnly` or `IncludeInactive` items in deterministic `(normalizedLabel ASC, id ASC)` order with snapshot-bound pagination, or returns complete revision history for one identity.
  - **`resolve(request: ResolveCatalogReferences)`** for `NewSelection` on `Account`:
    - Verifies `expectedCatalogSnapshot` (when supplied) and confirms both the `Account` and its parent `Institution` exist and are currently selectable.

#### Test Specifications (`describe` / `it should`)

```ts
describe('Task 3.1: ReferenceCatalog Institution & Account Operations (AC-RESP-001, AC-DEL-004)', () => {
  describe('ReferenceCatalog.save() — CreateInstitution & CreateAccount', () => {
    it('should create an Institution with a stable identity, revision 1 history head, and new CatalogSnapshotId while keeping Workspace onboarding at NeedsInstitutionAndAccount (happy path)', () => {});

    it('should create an Account under a selectable Institution, return the complete Account record, history head, and new CatalogSnapshotId in one call, and transition Workspace onboarding to ReadyForTradePlanning (happy path, AC-RESP-001)', () => {});

    it('should allow two Accounts with the same label (e.g., "Margin") when they belong to different parent Institutions (namespace boundary condition)', () => {});

    it('should reject creating an Institution whose normalized label collides case-insensitively with an existing Institution (e.g., "  fidelity  " vs "Fidelity") with DuplicateLabelInNamespace and zero writes (boundary/error case)', () => {});

    it('should reject creating an Account whose normalized label collides case-insensitively with an existing Account under the same Institution with DuplicateLabelInNamespace and zero writes (error case)', () => {});

    it('should reject creating an Institution or Account with an empty or whitespace-only label with InvalidLabel and zero writes (boundary/error case)', () => {});

    it('should reject creating an Account when parentInstitutionId does not exist or refers to a non-Institution identity with InvalidParentReference and zero writes (error case)', () => {});

    it('should return Conflict and write nothing when expectedCatalogSnapshot does not match the current catalog snapshot (concurrency error case)', () => {});

    it('should return RuntimeNotWritable and write nothing when called while RuntimeReadiness is not Writable (error case, AC-DEL-004)', () => {});
  });

  describe('ReferenceCatalog.query() & resolve()', () => {
    it('should list Institutions and Accounts in deterministic label-then-identity order bound to the current CatalogSnapshotId (happy path)', () => {});

    it('should paginate deterministically using snapshot-bound cursors and reject a cursor bound to a stale CatalogSnapshotId (boundary/error case)', () => {});

    it('should return complete revision history for a created Institution or Account identity (happy path)', () => {});

    it('should resolve a selectable Account and its selectable parent Institution as valid for NewSelection (happy path)', () => {});

    it('should reject NewSelection resolution when AccountId is unknown or when expectedCatalogSnapshot is stale (error case)', () => {});
  });
});
```

---

### Task 3.2: Responsive App Shell (Narrow Bottom Navigation / Wide Left Sidebar) and Onboarding Workflow UI

#### Scope & Implementation Details
- Implement the responsive application shell (`src/ui/shell/AppShell.tsx`) adhering to `specs/design/ui-contract.md`:
  - Visual language: warm cream page ground (`#FAF7F2`), white rounded content cards with restrained borders, near-black pill-shaped primary actions, small-caps section labels, compact semantic badges, and right-aligned tabular numerals (`font-variant-numeric: tabular-nums`).
  - Live viewport-width adaptation at the disclosed breakpoint (`768px` / `md`):
    - **Narrow view (`< 768px`):** single-column layout with bottom navigation bar.
    - **Wide view (`>= 768px`):** left sidebar navigation with centered main content container.
  - Keeps navigation honest to `InstalledCapabilityManifest` v1 (showing only installed D1 surfaces: **Overview / Onboarding**, **Accounts & Institutions**, and **Workspace Settings**—no dead links or fake `Unavailable` tabs for undelivered capabilities).
  - Preserves active route, selected Institution/Account, and any entered-but-unsaved form input across live viewport resizes without page reload (`AC-UI-001`).
- Implement the **Onboarding & Accounts View** (`src/ui/onboarding/OnboardingAccountsView.tsx`):
  - When `onboardingState === 'NeedsInstitutionAndAccount'`, displays a clear Empty/Onboarding state explaining that at least one `Institution` and one `Account` are required before Trade planning can begin (and never seeds fictional brokerage data).
  - Supports creating an `Institution` and creating an `Account` under a selected `Institution`, updating UI state directly from the `ReferenceCatalog.save` post-commit result without re-querying (`AC-RESP-001`).
  - Once the first `Account` is created, transitions the Workspace banner and status immediately to `Ready for Trade Planning`.
  - Cancelling or navigating away from an unsaved Institution/Account form records zero evidence.

#### Test Specifications (`describe` / `it should`)

```ts
describe('Task 3.2: Responsive App Shell & Onboarding UI (AC-UI-001, AC-UI-002, AC-CAP-001, AC-RESP-001)', () => {
  describe('Onboarding workflow from NeedsInstitutionAndAccount to ReadyForTradePlanning', () => {
    it('should display an explicit Empty state with zero seeded Institutions or Accounts on a freshly initialized Workspace (happy path)', () => {});

    it('should create a first Institution and then a first Account under it, rendering each directly from the save response and transitioning Workspace status to Ready for Trade Planning (happy path, AC-RESP-001)', () => {});

    it('should display accessible inline validation errors and keep entered text intact when submitting a duplicate Institution or Account label (error case)', () => {});

    it('should discard unsaved Institution or Account form input on Cancel without writing to IndexedDB (boundary condition)', () => {});
  });

  describe('Capability-honest navigation & live responsive adaptation (AC-CAP-001, AC-UI-001)', () => {
    it('should render only D1-installed navigation items and omit undelivered surfaces (Daily Review, Reports, Backup/Restore) from both narrow bottom nav and wide left sidebar (AC-CAP-001)', () => {});

    it('should switch live between wide left-sidebar layout (1280x800) and narrow bottom-navigation layout (390x844) without reloading or losing unsaved Institution/Account form text or validation state (AC-UI-001)', () => {});
  });
});
```

---

### Task 3.3: End-to-End Playwright Verification — Offline Cold Restart, Update Deferral, Readiness Matrix, and WCAG AA Accessibility

#### Scope & Implementation Details
- Write end-to-end Playwright verification tests (`e2e/d01-foundation.spec.ts`) running against the production-built PWA served on `DEV_PORT` (`5180`):
  - **`AC-DEL-001` (Offline Cold Restart):** Load online until `Writable`, initialize Workspace (`America/New_York`), create Institution (`Interactive Brokers`) and Account (`U1234567 Margin`), close browser context, set context offline, reopen app cold, verify `Writable` readiness is re-established offline with zero network requests, verify existing Institution and Account load, and create a second Account (`U1234567 IRA`) completely offline.
  - **`AC-DEL-002` (Update Safety & Active Form Deferral):** Open the Add Account form with unsaved input, stage a new Service Worker release inventory in the background, verify the Update Available banner appears while the current release stays in control and unsaved form input is preserved, and verify activation waits for explicit safe reload.
  - **`AC-DEL-003` & `AC-DEL-004` (Manifest, Browser-Neutral Readiness, Multi-Failure Matrix & Advisory Protection):** Inspect `manifest.webmanifest` and `OfflineReleaseInventory` SHA-256 digests; verify `BestEffort` protection warning + `Request Stronger Durability`; verify simultaneous failure reporting (`InsufficientCapacity` + `ReleaseInventoryInvalid`) returns `Unsupported` and blocks writes at both UI and persistence boundaries.
  - **`AC-DEL-005` & `AC-DEL-006` (`Recovery Only`, `Integrity Blocked`, and Mid-Session Failure):** Verify a readable Workspace under failed readiness enters `Recovery Only` (reads work, writes return `RuntimeNotWritable`); verify an unreadable existing store enters `Integrity Blocked` and blocks fresh initialization/overwrite; verify mid-session readiness failure immediately blocks the next mutation.
  - **`AC-UI-001` & `AC-UI-002` (Live Resize, Keyboard-Only Completion & WCAG AA Contrast):** Complete initialization and Institution/Account onboarding using keyboard only (`Tab`, `Shift+Tab`, `Enter`, `Escape`), verify live viewport resize (`1280x800` ↔ `390x844`) preserves unsaved form values, and run `@axe-core/playwright` WCAG 2.1 AA scans across Loading, Ready, Empty, Error, Unsupported, Recovery Only, and Integrity Blocked views.

#### Test Specifications (`describe` / `it should`)

```ts
describe('Task 3.3: E2E Playwright Verification for Deliverable 1 (AC-DEL-001..006, AC-RESP-001, AC-UI-001..002, AC-CAP-001)', () => {
  describe('AC-DEL-001 & AC-DEL-003: PWA Manifest, Offline Cold Restart, and Offline Mutation', () => {
    it('should serve a valid Web App Manifest and digest-verified Offline Release Inventory, reach Writable on first load, and complete Workspace initialization and Account onboarding', () => {});

    it('should reopen after a full browser stop with network disabled, re-establish Writable RuntimeReadiness offline, display stored Institutions and Accounts, and create a new Account offline', () => {});
  });

  describe('AC-DEL-002: Service Worker Update Safety', () => {
    it('should notify when a digest-valid new release is staged, defer activation while an unsaved Account form has input, and preserve all entered text', () => {});
  });

  describe('AC-DEL-004, AC-DEL-005 & AC-DEL-006: Readiness Failure Matrix, Recovery Only & Integrity Blocked', () => {
    it('should report all failed readiness checks simultaneously when capacity and release-inventory checks both fail on a fresh store, blocking initialization', () => {});

    it('should enter Recovery Only when an initialized Workspace remains readable but a readiness check fails, allowing Account viewing while blocking new Account creation with RuntimeNotWritable', () => {});

    it('should enter Integrity Blocked when an existing storage root is unreadable/corrupt and refuse to offer fresh initialization or overwrite existing bytes', () => {});

    it('should immediately block the next saveSettings or ReferenceCatalog.save mutation when a storage/integrity failure is injected mid-session', () => {});
  });

  describe('AC-UI-001 & AC-UI-002: Responsive Live Adaptation, Keyboard Navigation & WCAG AA Contrast', () => {
    it('should switch between wide left-sidebar and narrow bottom-navigation layouts on live viewport resize without losing route or unsaved form values', () => {});

    it('should complete Workspace initialization and Institution/Account creation using keyboard navigation alone with logical focus order and pass axe-core WCAG AA checks across all D1 states', () => {});
  });
});
```

---

## Deliverable 1 Verification Checklist

- [ ] `npm run typecheck` (`tsgo --noEmit`) passes with zero errors.
- [ ] `npm run lint` (`eslint` with `@typescript/typescript6` alias) passes with zero warnings/errors.
- [ ] `npm run test` (`vitest run`) passes all unit and persistence integration tests across Tasks 1.1–3.2.
- [ ] `npm run test:e2e` (`playwright test`) passes all end-to-end PWA, offline restart, readiness matrix, responsive, and WCAG AA accessibility checks on port `5180`.
