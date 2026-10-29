# D5 structural verifications

Each entry records a structural task's exact verification (D5 breakdown, section 5), and each task ends with a complete cumulative suite run delegated to the `suite-runner` subagent, with full outputs in `suite-runs/`. Versions are in [provenance.md](provenance.md). Each task's `ocr-review` findings and bug tasks are recorded under the task's heading, with the raw outputs in `ocr/`.

## Start of D5

Location checks (D5 handoff, section 1) all matched on 2026-10-29: worktree and branch `claude-opus-5.5`, `ahead 292`, clean; `claude-opus-5.5-pre-d5` equals HEAD (`9131bf8`); `claude-opus-5.5-d4` is `4ab43d58931f2966d6a2d05f6b41be9bc239dd1c`; `DEV_PORT=5175`; Node v26.12.0. `npm ci && npx vitest run`: `Test Files 102 passed (102)`, `Tests 892 passed (892)`.

## T5.1 Persistence: schema v4

Implementation commit `ec8e6c1`. `SCHEMA_VERSION` 4; store `journalDebts` (key path `debtId`) with indexes `byOutstandingDue` on `[outstandingDue, debtId]` and `byAnchorTrade` on `anchorTradeId`; `v3-to-v4.ts` copies v3 stores (private Trade fields stripped, as earlier steps do) and adds an empty `journalDebts`. The two index fields are private and recomputed only by `rebuildPrivateState`, which also derives `journalObligations` outcomes from Debt (`{ kind: 'Debt', id }` for Outstanding; the settling Entry or decline otherwise). No first-run pass stood: case 2 first passed because case 1's green had added the transform ahead of it; the transform was removed, rerun to a genuine red, and restored (note row in `tdd-log.md`). Case 3 adds obligation assertions beyond its planned wording, each proven red first. **For T5.2:** Journal Debt writes must set `outstandingDue` and `anchorTradeId` themselves (or the index misses them until a rebuild). **Expected failures until T5.18 and T5.19:** `verify:releases` with the browser case expecting `d4` at schema 3, and `verify:capacity`.

Implementation-level decision: 16 existing tests pinned the literal `3` as the migration chain's target, meaning "the current schema" at D4; T5.1-S1 (below) moves them to the current schema, as I5.1 expects schema 4.

### ocr review of `ec8e6c1`

Session `f8978970-cf3e-4732-8833-2bd786ef60cc`, model gpt-6.1-sol, 4 files reviewed (8 excluded), 1 comment. Raw output: `ocr/T5.1-ec8e6c1.json`.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| medium | `src/persistence/schema.ts:9` | The bump leaves migration tests expecting schema 3 and a newer-schema fixture at 4 | Valid at `ec8e6c1` (the reviewer marked it Wrong because it read the working tree while T5.1-S1 was editing those tests) | Resolved by T5.1-S1 (`fc2dfd7`), which covers exactly these tests, including the newer-schema fixture moved to 5 |

T5.1-S1 changes test files only; ocr excludes test files, so it gets no separate review.

## T5.1-S1 Migration tests target the current schema

T5.1 raised `SCHEMA_VERSION` to 4, so 17 tests that pinned 3 as the migration chain's target (the current schema at D4) failed. Decision: a migration-to-current expectation asserts the current schema. Only target-version assertions changed (receipt `toVersion`, post-migration `schemaVersion`, Ready status); source-version and old-store assertions are untouched. The newer-schema case now stores schema 5 (newer than the release). No production code changed.

| Command | Result |
| --- | --- |
| `npx vitest run` | exit 0; `Test Files 103 passed (103)`, `Tests 895 passed (895)` |
| `npm run typecheck` | exit 0 |
| `npx tsc6 --noEmit` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run lint:deps` | exit 0 |

### Cumulative run after T5.1

Run 2026-10-29 18:30 EDT on commit `fc2dfd7` (uncommitted: evidence only), Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 62 passed (62)`, `Tests 822 passed (822)`, exit 0 | `suite-runs/t5.1-schema-v4-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 41 passed (41)`, `Tests 73 passed (73)`, exit 0 | `suite-runs/t5.1-schema-v4-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `1 failed`, `141 passed (5.2m)`, exit 1 | `suite-runs/t5.1-schema-v4-browser.txt` |
| Static and verification checks (12 commands) | as at the end of D4 | 11 of 12 exit 0 | `suite-runs/t5.1-schema-v4-checks.txt` |

Failures, both consequences of `SCHEMA_VERSION` becoming 4, neither a T5.1 defect:
- `e2e/d4/update.spec.ts:6` (B4.7): About shows schema 4, expected 3, because the harness's `d4` folder is built from current source. Fixed by T5.18 (build `d4` from the `claude-opus-5.5-d4` tag, add a current `d5`), which runs next, ahead of graph order, as T4.27 did in D4. `verify:releases` itself passed, since it checks `d4` against the current `SCHEMA_VERSION`.
- `verify:capacity`: "basis measured at schema version 3, current is 4" — expected until T5.19.
