# D1 test-suite refactor log

Incremental record of the consolidation in `plan/D1-refactor-tests.md`. Each row is one consolidated
file: the sources removed, the verification run immediately afterwards, and the commit. Case phrases
are unchanged throughout; only file boundaries move.

| Step | Consolidated file | Sources removed | Verification | Commit |
|---|---|---|---|---|
| 1 | `tests/capability/manifest.test.ts` | manifest-closure, manifest-immutable, manifest-omission, manifest-profile, manifest-reachability, manifest-release | `tsc` 0; `eslint` 0; `npx vitest run` 134 files / 190 tests passed | see the commit table at the end |
| 2 | `tests/calendar/calendar.test.ts` | after-close, revision-range, session-date, timezone-invariance | `tsc` 0; `eslint` 0; `npx vitest run` 131 files / 190 tests passed | see the commit table at the end |
| 3 | `tests/capacity/capacity.test.ts` | derive-minimum, determinism, scaling, shortfall, sufficient, unavailable | `tsc` 0; `eslint` 0; `npx vitest run` 126 files / 190 tests passed | see the commit table at the end |
| 4 | `tests/catalog/save-query.test.ts` | account-parent, archive-reactivation, create, query, rename-history, resolution-modes, save-conflict | `tsc` 0; `eslint` 0; `npx vitest run` 120 files / 190 tests passed | see the commit table at the end |
| 5 | `tests/catalog/seed.test.ts` | seed-absences, seed-atomic, seed-idempotent, seed-manifest, seed-rename, seed-shape-conflict, seed-snapshot | `tsc` 0; `eslint` 0; `npx vitest run` 114 files / 190 tests passed | see the commit table at the end |
| 6 | `tests/harness/disclosure.test.ts` | mock-free, substitution-registry | `tsc` 0; `eslint` 0; `npx vitest run` 113 files / 190 tests passed | see the commit table at the end |
| 7 | `tests/journal/seed.test.ts` | seed-atomic, seed-conflict, seed-idempotent, seed-manifest, seed-retain, seed-seven, seed-stable-key | `tsc` 0; `eslint` 0; `npx vitest run` 107 files / 190 tests passed | see the commit table at the end |
| 8 | `tests/onboarding/institution.test.ts` | archived-view, institution-onboarding, institution-validation | `tsc` 0; `eslint` 0; `npx vitest run` 105 files / 190 tests passed | see the commit table at the end |
| 9 | `tests/onboarding/account.test.ts` | account-label, account-parent-conflict, account-selectable-query, account-validation, ready-state | `tsc` 0; `eslint` 0; `npx vitest run` 101 files / 190 tests passed | see the commit table at the end |
| 10 | `tests/persistence/lifecycle-index.test.ts` | lifecycle-bounded, lifecycle-cutoff, lifecycle-disagreement, lifecycle-index-atomic, lifecycle-rebuild | `tsc` 0; `eslint` 0; `npx vitest run` 97 files / 190 tests passed | see the commit table at the end |
| 11 | `tests/persistence/migration.test.ts` | migration, migration-interrupted, migration-lossy, migration-projection, migration-receipt, migration-rollback, migration-seed-additions, migration-unsupported | `tsc` 0; `eslint` 0; `npx vitest run` 90 files / 190 tests passed | see the commit table at the end |
| 12 | `tests/persistence/revisions.test.ts` | revision-committed, revision-conflict, revision-content, revision-kind, revision-postcommit, revision-unchanged, revision-versions | `tsc` 0; `eslint` 0; `npx vitest run` 84 files / 190 tests passed | see the commit table at the end |
| 13 | `tests/persistence/schema.test.ts` | schema-boundedness, schema-manifest, schema-rebuild, schema | `tsc` 0; `eslint` 0; `npx vitest run` 81 files / 190 tests passed | see the commit table at the end |
| 14 | `tests/persistence/snapshot.test.ts` | snapshot-coherent, snapshot-nonmutating, snapshot-torn | `tsc` 0; `eslint` 0; `npx vitest run` 79 files / 190 tests passed | see the commit table at the end |
| 15 | `tests/persistence/transaction.test.ts` | transaction-rollback, transaction-single, transaction-snapshot, transaction-write-gate, transaction | `tsc` 0; `eslint` 0; `npx vitest run` 75 files / 190 tests passed | see the commit table at the end |
| 16 | `tests/persistence/write-gate.test.ts` | write-gate-exemption, write-gate-integrity, write-gate-no-root, write-gate-no-transaction, write-gate-recheck, write-gate-revisions, write-gate | `tsc` 0; `eslint` 0; `npx vitest run` 69 files / 190 tests passed | see the commit table at the end |
| 17 | `tests/platform/clock.test.ts` | clock-injection | `tsc` 0; `eslint` 0; `npx vitest run` 69 files / 190 tests passed | see the commit table at the end |
| 18 | `tests/platform/host-port.test.ts` | host-port, host-port-no-gate | `tsc` 0; `eslint` 0; `npx vitest run` 68 files / 190 tests passed | see the commit table at the end |
| 19 | `tests/readiness/gate.test.ts` | all-pass, diagnostic-nonmutating, failed-check-details, no-allowlist, protection-advisory, simultaneous | `tsc` 0; `eslint` 0; `npx vitest run` 63 files / 190 tests passed | see the commit table at the end |
| 20 | `tests/readiness/lifecycle.test.ts` | boundary-receipts, invalidate, per-launch | `tsc` 0; `eslint` 0; `npx vitest run` 61 files / 190 tests passed | see the commit table at the end |
| 21 | `tests/release/inventory.test.ts` | inventory-artifact, inventory-corrupt, inventory-evidence, inventory-missing, inventory-multiple, inventory-release-mismatch, inventory-valid | `tsc` 0; `eslint` 0; `npx vitest run` 55 files / 190 tests passed | see the commit table at the end |
| 22 | `tests/results/results.test.ts` | codec-round-trip, discriminator, empty-failed-checks, integrity-blocked, mutation-union, runtime-not-writable | `tsc` 0; `eslint` 0; `npx vitest run` 50 files / 190 tests passed | see the commit table at the end |
| 23 | `tests/values/values.test.ts` | codec-round-trip, currency, money-add, non-exact-input, scale, zero | `tsc` 0; `eslint` 0; `npx vitest run` 45 files / 190 tests passed | see the commit table at the end |
| 24 | `tests/workspace/durability.test.ts` | durability-absent, durability-advisory, durability-denied, durability-improved | `tsc` 0; `eslint` 0; `npx vitest run` 42 files / 190 tests passed | see the commit table at the end |
| 25 | `tests/workspace/initialize.test.ts` | initialize-existing, initialize-fresh, initialize-integrity, initialize-migration-blocked, initialize-recovery, initialize-refused, initialize-timezone | `tsc` 0; `eslint` 0; `npx vitest run` 36 files / 190 tests passed | see the commit table at the end |
| 26 | `tests/workspace/status.test.ts` | status-initialization, status-integrity, status-nonmutating, status-ready, status-recovery | `tsc` 0; `eslint` 0; `npx vitest run` 32 files / 190 tests passed | see the commit table at the end |
| 27 | `tests/integration/foundation.test.ts` | d1-end-to-end, failure-matrix, three-launches, rollback-matrix | `tsc` 0; `eslint` 0; `npx vitest run` 29 files / 190 tests passed | see the commit table at the end |
| 28 | `tests/browser/startup.spec.ts` | startup-pending, startup-writable, startup-protection, startup-unsupported, startup-recovery, startup-integrity, startup-view-states | `tsc` 0; `eslint` 0; `npx vitest run` 190 tests; `npx playwright test` 132 tests | see the commit table at the end |
| 29 | `tests/browser/onboarding.spec.ts` | onboarding-account, onboarding-empty, onboarding-resize | `tsc` 0; `eslint` 0; `npx vitest run` 190 tests; `npx playwright test` 132 tests | see the commit table at the end |
| 30 | `tests/browser/responsive-a11y.spec.ts` | a11y-d1, a11y-smoke, responsive-state, responsive-switch | `tsc` 0; `eslint` 0; `npx vitest run` 190 tests; `npx playwright test` 132 tests | see the commit table at the end |
| 31 | `tests/browser/seams.spec.ts` | clock, harness, host-port, shell | `tsc` 0; `eslint` 0; `npx vitest run` 190 tests; `npx playwright test` 132 tests | see the commit table at the end |
| 32 | `tests/browser/readiness.spec.ts` | readiness, inventory-offline | `tsc` 0; `eslint` 0; `npx vitest run` 190 tests; `npx playwright test` 132 tests | see the commit table at the end |
| 33 | `tests/browser/persistence.spec.ts` | schema, transaction | `tsc` 0; `eslint` 0; `npx vitest run` 190 tests; `npx playwright test` 132 tests | see the commit table at the end |
| 34 | `tests/browser/offline-durability.spec.ts` | offline-restart, durability-real-engine | `tsc` 0; `eslint` 0; `npx vitest run` 190 tests; `npx playwright test` 132 tests | see the commit table at the end |
