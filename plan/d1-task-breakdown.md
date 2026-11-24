# Deliverable 1 — task breakdown

Scope: record institutions and accounts, with the full PWA/readiness/schema foundation. Frozen baseline: `plan/freeze.md`, revision `c5d28a8a`; deviation DEV-001 applies. No other capability is advertised.

## Structural tasks

Each structural task states its exact verification. No invented TDD cases.

### D1-S1 — Project scaffold
Set up `package.json`, Vite + React, TypeScript 7 via `@typescript/native` with the `@typescript/typescript6` alias for typescript-eslint, Vitest, fake-indexeddb, Playwright, and scripts: `lint`, `typecheck`, `typecheck:6`, `test:unit`, `test:integration`, `build`, `preview`.
**Verification:** `npx tsc --version` prints 7.x and `npx tsc6 --version` prints 6.x; `npm run lint`, `npm run typecheck`, `npm run typecheck:6`, `npm run build` all exit 0.

### D1-S2 — PWA identity and Offline Release Inventory
Web App Manifest with stable identity, name, icons, launch URL, scope, standalone display; versioned service worker; build-generated asset/digest inventory covering every asset required for offline restart.
**Verification:** a build script asserts every built asset appears in the inventory with a matching digest and that the service worker precaches exactly that set; `npm run build` exits 0.

### D1-S3 — Persistence schema v1 and transaction seam
One IndexedDB database with object stores for Workspace metadata, Trade Record, Journal, Market Data and Catalog; optimistic revision tokens; one atomic commit/rollback boundary; snapshot-consistent reads; isolated diagnostic transaction that leaves no authoritative fact.
**Verification:** `npx vitest run tests/structural/persistence-v1.test.ts` opens the schema, commits a multi-store transaction, rolls one back, reads a consistent snapshot, and runs a diagnostic transaction that leaves zero authoritative records; exits 0.

### D1-S4 — Installed Capability Manifest and navigation shell
An immutable manifest declaring only Institution/Account create and browse; responsive narrow-bottom/wide-sidebar shell with Loading/Ready/Empty/Error states.
**Verification:** `npx vitest run tests/structural/capability-manifest.test.ts` asserts the manifest equals the exact expected set and contains no Plan, Trade, Journal-entry, Mark, report, backup or Restore capability; `npx playwright-cli` check at two widths shows the shell switching without reload (structural smoke only).

## Behaviour-bearing tasks

Each task is implemented test-first, one behaviour at a time, with red then green recorded for every `it should` case. Unit tests may use mocks where isolation is useful; integration tests must not.

### D1-T1 — Runtime Readiness evaluation
**Seam:** `Workspace.getStatus` and the readiness evaluator's public result.
- `describe("Runtime Readiness functional checks")`
  - `it should return Writable only when the isolated diagnostic transaction, derived capacity headroom, service-worker control and complete digest-valid Offline Release Inventory all pass`
  - `it should report every failed check in a simultaneous-failure result rather than stopping at the first`
  - `it should return Unsupported with no Workspace created when no readable Workspace exists and any check fails`
  - `it should return Recovery Only when an existing Workspace is readable but a write-safety check fails`
  - `it should treat host storage protection as advisory and leave Writable unchanged when protection is not Protected`
  - `it should return Integrity Blocked without initializing when a known or possible existing root cannot be read`
  - `it should decide support without reading browser, OS, family or user-agent identity`
- **Red:** `npx vitest run tests/unit/readiness.test.ts -t "<case>"` fails because the behaviour is absent.
- **Green:** smallest implementation change; rerun the same command and the task's earlier green cases.
- **Integration:** `tests/integration/readiness.test.ts` uses fake-indexeddb with a real service-worker-controlled build; fixtures for each pass/failure combination prove no authoritative fact is created by the diagnostic transaction.
- **Critic flow:** launch the app in each readiness state and read the shell's view state; `B(readiness)`.

### D1-T2 — Persistence-level write gate
**Seam:** the transaction adapter's write-gate result directly, and `Workspace.initialize` / `ReferenceCatalog.save` results.
- `describe("RuntimeNotWritable write gate")`
  - `it should return the single cross-cutting RuntimeNotWritable branch from every authoritative mutation when the session is not Writable`
  - `it should carry readiness outcome, every failed check, Workspace status and safe actions in that branch`
  - `it should reject writes before beginning a write transaction`
  - `it should exempt requestDurability from the write gate`
- **Red/green:** `npx vitest run tests/unit/write-gate.test.ts -t "<case>"`.
- **Integration:** `tests/integration/write-gate.test.ts` drives the same failure through UI-facing mutations and the persistence seam, comparing before/after revisions.
- **Critic flow:** attempt initialization and account creation in a failed-readiness session; `B(write-gate)`.

### D1-T3 — Workspace initialization and atomic seed defaults
**Seam:** `Workspace.initialize`.
- `describe("Workspace.initialize")`
  - `it should create Workspace metadata and atomically seed the Catalog and Journal defaults from versioned manifests`
  - `it should return Needs Institution and Account when no real Account exists`
  - `it should be idempotent on repeated initialization without overwriting a trader rename`
  - `it should return Migration Blocked or Integrity Blocked with unchanged data when seeded contents fail validation`
  - `it should return RuntimeNotWritable and create no Workspace when readiness fails`
- **Red/green:** `npx vitest run tests/unit/initialize.test.ts -t "<case>"`.
- **Integration:** `tests/integration/initialize.test.ts` with real persistence verifies the eleven Strategy seeds, IdeaSource type, five Close Reasons, five Abandonment Reasons, seven fixed Entry Types, initial definitions and seven Sources, then restarts and repeats seeding.
- **Critic flow:** first load shows onboarding rather than an empty workspace; `B(onboarding)`.

### D1-T4 — Institution creation
**Seam:** `ReferenceCatalog.save`.
- `describe("ReferenceCatalog.save Institution")`
  - `it should create an Institution with a stable identity and return its complete current record without a follow-up query`
  - `it should append one administrative history revision and leave earlier revisions inspectable`
  - `it should reject a duplicate current label with a typed no-write result`
  - `it should require an expected revision for rename or availability changes`
- **Red/green:** `npx vitest run tests/unit/institution.test.ts -t "<case>"`.
- **Integration:** `tests/integration/institution.test.ts` proves durable state and post-restart query.
- **Critic flow:** create an Institution in the production UI and see it in the list without refresh; `B(institution)`.

### D1-T5 — Account creation
**Seam:** `ReferenceCatalog.save`.
- `describe("ReferenceCatalog.save Account")`
  - `it should create an Account under a selectable Institution with an immutable parent`
  - `it should reject creation when the parent Institution is not selectable`
  - `it should return onboarding Ready only after a real Account exists`
  - `it should prevent archiving an Institution that still has selectable Accounts`
- **Red/green:** `npx vitest run tests/unit/account.test.ts -t "<case>"`.
- **Integration:** `tests/integration/account.test.ts` verifies atomic save, parent immutability and restart durability.
- **Critic flow:** create an Account, confirm onboarding changes, attempt to archive its Institution; `B(account)`.

### D1-T6 — Typed reference browsing
**Seam:** `ReferenceCatalog.query` and `resolve`.
- `describe("ReferenceCatalog typed browse")`
  - `it should list one typed family with deterministic label/identity order and snapshot-bound pagination`
  - `it should show current and historical labels for an inactive reference`
  - `it should reject an inactive Institution or Account for NewSelection while keeping it valid as a retained reference`
  - `it should exhaust every page before returning a complete set`
- **Red/green:** `npx vitest run tests/unit/reference-browse.test.ts -t "<case>"`.
- **Integration:** `tests/integration/reference-browse.test.ts` uses real persistence and the UI list.
- **Critic flow:** browse both families at narrow and wide widths, resize without losing state; `B(reference-browse)`.

### D1-T7 — Workspace status, settings and durability request
**Seam:** `Workspace.getStatus`, `saveSettings`, `requestDurability`.
- `describe("Workspace settings and protection")`
  - `it should return Saved with complete settings and a new binding after a valid time-zone change`
  - `it should return Unchanged for an identical settings request and Conflict for a stale revision`
  - `it should explain the future effect of a time-zone change without rewriting stored instants`
  - `it should report host protection honestly and return NotImproved without deleting data when a durability request fails`
- **Red/green:** `npx vitest run tests/unit/workspace-settings.test.ts -t "<case>"`.
- **Integration:** `tests/integration/workspace-settings.test.ts` checks durable settings and the visible advisory warning.
- **Critic flow:** change time zone, inspect warning, request durability where the host supports it; `B(settings)`.

### D1-T8 — Installed capability honesty
**Seam:** `Workspace.getStatus` manifest plus navigation.
- `describe("D1 installed capability declaration")`
  - `it should declare only Institution and Account create and browse`
  - `it should omit Plan, Trade, Journal, Mark, report, backup and Restore from navigation`
  - `it should never return a domain Unavailable result for an undelivered capability`
- **Red/green:** `npx vitest run tests/unit/capability-declaration.test.ts -t "<case>"`.
- **Integration:** `tests/integration/capability-declaration.test.ts` checks navigation and manifest together.
- **Critic flow:** inspect navigation and attempt an undelivered route; `B(capabilities)`.

## Evidence to capture for D1

- Red and green command/outcome for every `it should` case above.
- Structural verification outputs for S1–S4.
- Cumulative `npm run test:unit` and `npm run test:integration` passing.
- Fresh-critic structured report for each `B(...)` flow using `playwright-cli`, with actions, observations, pass/fail and screenshots on failure. Any defect gets a failing test first, then a fix, then a fresh critic repeat.
- Acceptance scenarios from `plan/acceptance-evidence-matrix.md` rows AC-DEL-001/003/004, AC-REF-001, AC-RESP-001, AC-CAP-001 and the partial rows for AC-JOUR-007 and AC-DEL-005, updated from `planned` to `covered` only when evidence is recorded.

## Parallelism and ownership

- S1 blocks all tasks. S2 and S3 can then proceed in parallel. S4 depends on S1 and the capability list.
- T1 and T2 depend on S2 and S3. T3 depends on T1, T2, S3 and S4. T4–T6 depend on T3. T7 depends on T1 and T3. T8 depends on S4 and T3.
- Single-owner resources in D1: schema v1 (S3), seed manifests (T3), capability manifest (S4/T8), navigation shell (S4). Only one task changes each at a time.
