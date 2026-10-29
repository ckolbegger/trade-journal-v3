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

## T5.18 Previous-release harness

Change: `tools/build-releases.ts` builds `d4` with `buildTaggedRelease('d4')` from `PREVIOUS_RELEASE_TAG` (now `claude-opus-5.5-d4`, commit `4ab43d58931f2966d6a2d05f6b41be9bc239dd1c`; `git archive` into scratch `tj-release-d4-4ab43d58931f`, cached by commit, never a worktree), keeps `d2` on the new `D2_RELEASE_TAG` constant, and builds `d5` from the current source with build label d5. `tools/verify-releases.ts` verifies d4 reports schema 3 and d5 reports `SCHEMA_VERSION` (4), with distinct identities across v1, v2, d1, d2, d4, d5. `tools/release-server.ts` comment lists d5.

e2e uses of the `d4` folder:
- `e2e/d4/update.spec.ts` lines 22 and 40 (B4.7, switch d2 to d4, About schema 3, `identity('d4')`): meant "the previous release"; unchanged, now exercises the real D4.
- `e2e/d4/support.ts` line 14 (auto fixture serving the routine build): meant "the current release"; switched to `dist-releases/d5`.
- No other e2e file refers to the d4 folder. `test:e2e` left at `e2e/d1 e2e/d2 e2e/d4` (T5.24 extends it).

Commands and results:
- `npm run build:releases && npm run verify:releases`: d4 built in `tj-release-d4-4ab43d58931f` (claude-opus-5.5-d4 at 4ab43d58931f2966d6a2d05f6b41be9bc239dd1c); `verify:releases OK: ... d1 9c8b5b3d... schema 1, d2 01736544... schema 2, d4 ecd9bbff... schema 3, d5 8a968f9d... schema 4`.
- `npx playwright test e2e/d4/update.spec.ts --project=chromium`: 1 passed (B4.7 passes again).
- `npx playwright test e2e/d1 e2e/d2 e2e/d4 --project=chromium`: run twice, each 141 passed, 1 failed: `e2e/d4/responsive-a11y.spec.ts:68` (B4.13 chips), "Hold radio inside its chip at 375". It passes alone (`-g`), as the whole file (5 passed) and as all of `e2e/d4` (18 passed), and it passed in the T5.1 cumulative run on the same source. The assertion reads bounding boxes straight after `page.setViewportSize` with no wait, so it looks like a layout race that appears only after d1 and d2 have run; not investigated further (outside T5.18). Flagged for the main session.
- `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`: exit 0.
- `verify:capacity` not run or touched (fails until T5.19).

ocr review of `f901511`: session `4a9fb436-0d5b-4c15-b5f0-893776443508`, 4 files reviewed, **No findings.** Raw output: `ocr/T5.18-f901511.json`.

The implementer's combined run (`e2e/d1 e2e/d2 e2e/d4`) failed B4.13's "Hold radio inside its chip at 375" (`e2e/d4/responsive-a11y.spec.ts:68`) twice, while it passes alone, with its file, and with all of `e2e/d4`; suspected layout race after `setViewportSize`. Handled through the cumulative run below.

### Cumulative run after T5.18

Run 2026-10-29 18:51 EDT on commit `ffafa07`, Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 62 passed (62)`, `Tests 822 passed (822)`, exit 0 | `suite-runs/t5.18-d4-release-build-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 41 passed (41)`, `Tests 73 passed (73)`, exit 0 | `suite-runs/t5.18-d4-release-build-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `142 passed (4.9m)`, exit 0 | `suite-runs/t5.18-d4-release-build-browser.txt` |
| Static and verification checks (12 commands) | as at the end of D4 | 11 of 12 exit 0 | `suite-runs/t5.18-d4-release-build-checks.txt` |

Failure: `verify:capacity` only, "basis measured at schema version 3, current is 4" — expected until T5.19. B4.13's chip case passed here; it is recorded as a load-dependent flake (failed twice in the implementer's combined run, passed alone and here), flagged for the user, and fixed if it fails a cumulative run.

## T5.2 Journal: Defer creates Debt

Implementation commit `cf85b93`. Both cases red then green; no first-run pass. Case 1 is D2 T2.5's "reject Defer" test changed in place (section 1.2). Case 2 also checks that both indexes find the Debt right after commit, without a rebuild, and that the Journal counter advances. Implementer's choices: the snapshot reference is named `definitionId`, as on Entries (A61 calls it `definitionRevision`); `debts` is optional on `PreparedJournalEffects` and `JournalApplyResult`; `DebtProjection.status` is `'Outstanding'` only until T5.3 widens it. **Process slip:** the first test edit was made with a script against the Edit-only rule, then reverted and redone with Edit; the text is identical, so the first red row stands.

ocr review of `cf85b93`: session `9acabd75-158a-44ec-bccc-6f93c9e6d5e6`, 3 files reviewed, **No findings.** Raw output: `ocr/T5.2-cf85b93.json`.

### Cumulative run after T5.2

Run 2026-10-29 19:01 EDT on commit `fb9b8b3`, Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 62 passed (62)`, `Tests 823 passed (823)`, exit 0 | `suite-runs/t5.2-defer-creates-debt-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 41 passed (41)`, `Tests 73 passed (73)`, exit 0 | `suite-runs/t5.2-defer-creates-debt-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `142 passed (5.0m)`, exit 0 | `suite-runs/t5.2-defer-creates-debt-browser.txt` |
| Static and verification checks (12 commands) | as at the end of D4 | 11 of 12 exit 0 | `suite-runs/t5.2-defer-creates-debt-checks.txt` |

Failure: `verify:capacity` only — expected until T5.19.

## T5.3 Journal: Debt resolution

Implementation commit `ce6d64f`. Nine planned cases red then green, plus one added case (ADR 0011 counter retry: retried when only the Journal counter moves, up to 3 attempts, then Conflict with nothing resolved), red first. **First-run pass, flagged:** "validate the answers against the Debt snapshot revision" passed first because the Answer case already reads the Debt's own definition revision; mutation (read the Entry Type's latest revision instead) failed with an assertion, logged in `tdd-log.md`. The A74 definition-revision fixture writer is `tests/support/definition-revision.ts` (Reactive relabelled "Impulsive", one required Text prompt "Lesson" added; id `fixture-position-change-reflection-2`). Apply binds `obligation@<key>:<debtId>` and `debt@<debtId>:<expectedRevision>` as subject bindings; `Journal.save` adds the Journal counter binding. The mutation-boundary readiness recheck is the facade's guard (T5.13); the module returns `commit`'s `RuntimeNotWritable`. **Process slip:** two here-doc appends (one to the test file, one to the log) against the Edit-only rule; text as intended.

### ocr review of `ce6d64f`

Session `b1d0ae38-e669-4c74-987c-c0f7e321f528`, model gpt-6.1-sol, 4 files reviewed, 1 comment. Raw output: `ocr/T5.3-ce6d64f.json`.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| medium | `src/modules/journal/journal.ts:767` | Each Debt resolution links to the batch's first Entry or decline, not its own outcome | Doubtful (one resolution per prepared batch today; wrong when a batch carries several) | Bug task T5.3-B1 |

### T5.3-B1 Each resolution links its own outcome

Defect: when one prepared batch carries several Debt resolutions (or an Answer and a Decline), every Debt's Settled or Declined version and every obligation outcome link to `entries[0] ?? declines[0]`, so a Debt can be marked settled by another Debt's Entry.
- it should link each Debt resolution in one applied batch to the Entry or decline that carries its settledDebtId

Implemented in `56f4dc9`: `applyPreparedEffects` finds each resolution's outcome by `settledDebtId`. Red then green. (Process slip: the test was appended with a here-doc.)

ocr review of `56f4dc9`: session `77d92327-f414-4cf2-b362-dcc69f001bf7`, 1 file reviewed, **No findings.** Raw output: `ocr/T5.3-B1-56f4dc9.json`.

### Cumulative run after T5.3

Run 2026-10-29 19:20 EDT on commit `c54e4c2`, Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 63 passed (63)`, `Tests 834 passed (834)`, exit 0 | `suite-runs/t5.3-debt-resolution-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 41 passed (41)`, `Tests 73 passed (73)`, exit 0 | `suite-runs/t5.3-debt-resolution-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `142 passed (5.0m)`, exit 0 | `suite-runs/t5.3-debt-resolution-browser.txt` |
| Static and verification checks (12 commands) | as at the end of D4 | 11 of 12 exit 0 | `suite-runs/t5.3-debt-resolution-checks.txt` |

Failure: `verify:capacity` only — expected until T5.19.
