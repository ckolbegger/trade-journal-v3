# D5 structural verifications

Each entry records a structural task's exact verification (D5 breakdown, section 5), and each task ends with a complete cumulative suite run delegated to the `suite-runner` subagent, with full outputs in `suite-runs/`. Versions are in [provenance.md](provenance.md). Each task's `ocr-review` findings and bug tasks are recorded under the task's heading, with the raw outputs in `ocr/`.

## Start of D5

Location checks (D5 handoff, section 1) all matched on 2026-10-29: worktree and branch `claude-opus-5.5`, `ahead 292`, clean; `claude-opus-5.5-pre-d5` equals HEAD (`9131bf8`); `claude-opus-5.5-d4` is `4ab43d58931f2966d6a2d05f6b41be9bc239dd1c`; `DEV_PORT=5175`; Node v26.12.0. `npm ci && npx vitest run`: `Test Files 102 passed (102)`, `Tests 892 passed (892)`.

## T5.1-S1 Migration tests target the current schema

T5.1 raised `SCHEMA_VERSION` to 4, so 17 tests that pinned 3 as the migration chain's target (the current schema at D4) failed. Decision: a migration-to-current expectation asserts the current schema. Only target-version assertions changed (receipt `toVersion`, post-migration `schemaVersion`, Ready status); source-version and old-store assertions are untouched. The newer-schema case now stores schema 5 (newer than the release). No production code changed.

| Command | Result |
| --- | --- |
| `npx vitest run` | exit 0; `Test Files 103 passed (103)`, `Tests 895 passed (895)` |
| `npm run typecheck` | exit 0 |
| `npx tsc6 --noEmit` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run lint:deps` | exit 0 |
