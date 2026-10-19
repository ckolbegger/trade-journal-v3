# D1 test-suite refactor log

Incremental record of the consolidation in `plan/D1-refactor-tests.md`. Each row is one consolidated
file: the sources removed, the verification run immediately afterwards, and the commit. Case phrases
are unchanged throughout; only file boundaries move.

| Step | Consolidated file | Sources removed | Verification | Commit |
|---|---|---|---|---|
| 1 | `tests/capability/manifest.test.ts` | manifest-closure, manifest-immutable, manifest-omission, manifest-profile, manifest-reachability, manifest-release | `tsc` 0; `eslint` 0; `npx vitest run` 134 files / 190 tests passed | see the commit table at the end |
| 2 | `tests/calendar/calendar.test.ts` | after-close, revision-range, session-date, timezone-invariance | `tsc` 0; `eslint` 0; `npx vitest run` 131 files / 190 tests passed | see the commit table at the end |
