# D1 test-suite refactor plan

Status: proposed and being executed in place. Scope: **tests only** — no file under `src/`, `specs/` or
the frozen plan changes. Every `it should` phrase is preserved verbatim; only file boundaries, imports
and the shared fixture modules move.

## Why

The D1 suite is 168 test files (139 Vitest + 29 Playwright) and 6,563 lines, but only **35 distinct
`describe` blocks**. The suite is split roughly one case per file: 100 of the 139 Vitest files are
≤40 lines and the same `describe` title appears in up to 8 files. Setup is consequently repeated —
`deleteDatabase(` has 49 call sites, `seedDefaults(` 43, `openCatalog(`/`establishReadiness(` 28 each,
`openSeam(` 21, `startWith(` 22 — and 108 files import a per-directory `support` module, several of
which open the same database and seed the same rows. At the current ratio (≈4.9 files per task), D2–D7's
121 tasks would add ~590 files, reaching ~760.

## Principle

**One file per `describe`/seam; one `it` per planned case.** The case phrases do not change, so
`-t "<case phrase>"` and the recorded red/green evidence remain valid; only the file path in each
recorded command changes. Shared fixtures consolidate into six modules under `tests/support/`.

## Target layout

### Vitest — 139 → 29 files

| Refactored file | Consolidates (old `.test.ts`) | Cases |
|---|---|---|
| `tests/calendar/calendar.test.ts` | after-close, revision-range, session-date, timezone-invariance | 8 |
| `tests/capability/manifest.test.ts` | manifest-closure, manifest-immutable, manifest-omission, manifest-profile, manifest-reachability, manifest-release | 9 |
| `tests/capacity/capacity.test.ts` | derive-minimum, determinism, scaling, shortfall, sufficient, unavailable | 8 |
| `tests/catalog/save-query.test.ts` | account-parent, archive-reactivation, create, query, rename-history, resolution-modes, save-conflict | 9 |
| `tests/catalog/seed.test.ts` | seed-absences, seed-atomic, seed-idempotent, seed-manifest, seed-rename, seed-shape-conflict, seed-snapshot | 7 |
| `tests/harness/disclosure.test.ts` | mock-free, substitution-registry | 3 |
| `tests/integration/foundation.test.ts` | d1-end-to-end, failure-matrix, three-launches, rollback-matrix | 4 |
| `tests/integration/mock-guard.test.ts` | mock-guard (kept alone: it scans its own directory) | 1 |
| `tests/journal/seed.test.ts` | seed-atomic, seed-conflict, seed-idempotent, seed-manifest, seed-retain, seed-seven, seed-stable-key | 8 |
| `tests/onboarding/institution.test.ts` | archived-view, institution-onboarding, institution-validation | 6 |
| `tests/onboarding/account.test.ts` | account-label, account-parent-conflict, account-selectable-query, account-validation, ready-state | 6 |
| `tests/persistence/lifecycle-index.test.ts` | lifecycle-bounded, lifecycle-cutoff, lifecycle-disagreement, lifecycle-index-atomic, lifecycle-rebuild | 7 |
| `tests/persistence/migration.test.ts` | migration, migration-interrupted, migration-lossy, migration-projection, migration-receipt, migration-rollback, migration-seed-additions, migration-unsupported | 8 |
| `tests/persistence/revisions.test.ts` | revision-committed, revision-conflict, revision-content, revision-kind, revision-postcommit, revision-unchanged, revision-versions | 7 |
| `tests/persistence/schema.test.ts` | schema, schema-boundedness, schema-manifest, schema-rebuild | 8 |
| `tests/persistence/snapshot.test.ts` | snapshot-coherent, snapshot-nonmutating, snapshot-torn | 6 |
| `tests/persistence/transaction.test.ts` | transaction, transaction-rollback, transaction-single, transaction-snapshot, transaction-write-gate | 6 |
| `tests/persistence/write-gate.test.ts` | write-gate, write-gate-exemption, write-gate-integrity, write-gate-no-root, write-gate-no-transaction, write-gate-recheck, write-gate-revisions | 9 |
| `tests/platform/clock.test.ts` | clock-injection | 2 |
| `tests/platform/host-port.test.ts` | host-port, host-port-no-gate | 8 |
| `tests/readiness/gate.test.ts` | all-pass, diagnostic-nonmutating, failed-check-details, no-allowlist, protection-advisory, simultaneous | 10 |
| `tests/readiness/lifecycle.test.ts` | boundary-receipts, invalidate, per-launch | 6 |
| `tests/release/inventory.test.ts` | inventory-artifact, inventory-corrupt, inventory-evidence, inventory-missing, inventory-multiple, inventory-release-mismatch, inventory-valid | 8 |
| `tests/results/results.test.ts` | codec-round-trip, discriminator, empty-failed-checks, integrity-blocked, mutation-union, runtime-not-writable | 7 |
| `tests/smoke/shell.test.tsx` | shell (unchanged) | 1 |
| `tests/values/values.test.ts` | codec-round-trip, currency, money-add, non-exact-input, scale, zero | 7 |
| `tests/workspace/durability.test.ts` | durability-absent, durability-advisory, durability-denied, durability-improved | 8 |
| `tests/workspace/initialize.test.ts` | initialize-existing, initialize-fresh, initialize-integrity, initialize-migration-blocked, initialize-recovery, initialize-refused, initialize-timezone | 8 |
| `tests/workspace/status.test.ts` | status-initialization, status-integrity, status-nonmutating, status-ready, status-recovery | 8 |

### Playwright — 29 → 8 specs

| Refactored spec | Consolidates |
|---|---|
| `tests/browser/startup.spec.ts` | startup-pending, startup-writable, startup-protection, startup-unsupported, startup-recovery, startup-integrity, startup-view-states |
| `tests/browser/onboarding.spec.ts` | onboarding-account, onboarding-empty, onboarding-resize |
| `tests/browser/responsive-a11y.spec.ts` | a11y-d1, a11y-smoke, responsive-state, responsive-switch |
| `tests/browser/seams.spec.ts` | clock, harness, host-port, shell |
| `tests/browser/readiness.spec.ts` | readiness, inventory-offline |
| `tests/browser/persistence.spec.ts` | schema, transaction |
| `tests/browser/service-worker.spec.ts` | sw-control, sw-offline, sw-staging-failure, sw-two-releases, sw-update (serial, one shared variant build) |
| `tests/browser/offline-durability.spec.ts` | offline-restart, durability-real-engine |

### Shared fixtures — 10 per-directory modules → 6 (+ the integration adapter and `bootstrap.ts`)

| Module | Consolidates | Purpose |
|---|---|---|
| `tests/support/store.ts` | persistence/revision-support, the open/close half of catalog/support and journal/support, workspace/support's `rowsOf`/`close`, integration/support's `openStore`/`closeAll` | open DB + seam + gate, seed, fingerprint, close |
| `tests/support/domains.ts` | catalog/support's rows, journal/support's rows, values/support | seeded catalog/journal reads and value fixtures |
| `tests/support/readiness.ts` | readiness/support, integration/support's `readinessPorts`/`ReadinessOptions`/`MINIMUM_BYTES` | passing/failing ports, mutable state, stepping clock |
| `tests/support/release.ts` | release/support, integration/support's `buildRelease`/`hostOf`/`ReleaseCache` | inventory fixtures, real in-memory cache |
| `tests/support/workspace.ts` | workspace/support, workspace/status-support, integration/support's `initializeWorkspace`/`TRIVIAL_MIGRATION` | initialized Workspace + status ports |
| `tests/support/browser.ts` | browser/startup-support, browser/worker-support | `startWith`, `initializeJournal`, worker probes |

Kept as-is: `tests/lint-fixtures/` (12 intentional fixture files + `expected.json`),
`tests/substitutions.md`, `tests/harness/bootstrap.ts`, `tests/integration/mock-guard.test.ts` and
`tests/integration/support.ts` (the integration-specific adapter, which is not duplicated by the shared
modules).

## Execution policy — incremental, per file

1. **One consolidated file per step.** Create the target file, delete its sources, then run the
   verification immediately. Never batch several consolidations and test at the end.
2. **Verification after each consolidated file.**
   - Vitest consolidation: `npx tsc --noEmit`, `npx eslint <new file>`, and the **full Vitest suite**
     (`npx vitest run`, all 190 tests). The Playwright suite is unaffected by moving Vitest files
     (no `src/`, no `tests/browser/` change); it is still run at each phase boundary and after every
     consolidated browser spec, so a cross-layer surprise cannot go unnoticed.
   - Browser consolidation: `npx playwright test` (all 132 tests, four projects) plus the full Vitest
     suite at the phase boundary.
3. **Record each run** in `artifacts/evidence/D1-refactor-log.md`: step, refactored file, sources
   removed, exact commands, counts, commit.
4. **Commit per consolidated file** (one commit per step) once its run is green. A red run is fixed
   before the next step; it is never skipped or batched.
5. **Evidence paths.** After the Vitest and browser phases, retarget the filtered commands (`-t`/`-g`)
   to the consolidated file — the case phrase still selects exactly one case, so the recorded result
   stays true — and append a full old→new mapping table. Commands without a filter stay as recorded:
   the consolidated file now runs several cases, so rewriting them would make a "1 passed"
   observation false. Every mapping target was verified to exist.
6. **Final gate**: 190 Vitest tests and 132 browser tests, `tsc` 0, `eslint` 0,
   `lint:layers` 0 violations, the freeze manifest 11/11, and no `src/` diff. Record the numbers and
   commit the docs (plan, log, D2 kickoff note) as the last, docs-only step.

## Risks and handling

- **Case drift**: the merger copies `it` bodies and titles verbatim; the case counts must stay
  190 — a mismatch stops the phase.
- **Duplicate top-level helpers** (e.g. two sources declaring the same `const`): the merger fails
  loudly and the collision is resolved by hand before the run.
- **Large files**: if a consolidated file exceeds ~400 lines (`migration.test.ts` is the likely one),
  split it by failure mode, never by case.
- **Playwright serial state**: the three release-manipulating SW specs merge into one serial block with
  one variant build so the active-release file cannot be mutated concurrently.
- **Rollback**: every step is one commit; `git revert` of that commit restores the previous file
  layout without touching production code.

## Result

Executed incrementally: one consolidated file per step, each followed by `tsc`, `eslint` and the full
Vitest suite; each browser step additionally ran the full Playwright suite (132 tests). The support
modules were consolidated in one step after the file moves, with both suites rerun. The per-step record,
including the exact commands and counts, is `artifacts/evidence/D1-refactor-log.md`.

| Measure | Before | After |
|---|---|---|
| Vitest test files | 139 | 29 |
| Playwright specs | 29 | 8 |
| Total test files | 168 | 37 |
| Shared fixture modules | 10 per-directory + integration adapter | 6 + integration adapter |
| Vitest tests | 190 | 190 |
| Browser tests (4 projects) | 132 | 132 |

Case phrases are unchanged. `artifacts/evidence/D1-red-green.md` carries the old→new mapping and the
retargeted filtered commands. No file under `src/` was modified.
