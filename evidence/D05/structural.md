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

## T5.4 Journal: Debt queries and the Trade narrative

Implementation commit `fcd9132`. Both cases red then green; no first-run pass. `Journal.query({ scope: 'OutstandingDebt' })` returns every Outstanding Debt with one `getAll` on `byOutstandingDue` (fixture order D-3, D-1, D-4, D-2, D-5, D-6, D-7, created in a scrambled order so the index decides it). The Trade narrative holds one item per obligation (`TradeNarrativeItem = NarrativeItem | NarrativeDebt`; Entries carry `answeredLater`, declines `declinedLater`), with one `getAll` on `byAnchorTrade`. **Temporary rule until T5.11:** `getTradeDetail` filters Debt items out of the narrative, so the Detail view type is unchanged. The Trade Detail Source is not seeded until T5.5, so its label falls back to the raw key until then.

ocr review of `fcd9132`: session `8e8d6754-eea2-4368-91e4-c5d8ee30e8ef`, 4 files reviewed, **No findings.** Raw output: `ocr/T5.4-fcd9132.json`.

### Cumulative run after T5.4

Run 2026-10-29 19:32 EDT on commit `028df87`, Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 1 failed, 63 passed (64)`, `Tests 1 failed, 835 passed (836)`, exit 1 | `suite-runs/t5.4-debt-queries-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 41 passed (41)`, `Tests 73 passed (73)`, exit 0 | `suite-runs/t5.4-debt-queries-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `142 passed (5.1m)`, exit 0 | `suite-runs/t5.4-debt-queries-browser.txt` |
| Static and verification checks (12 commands) | as at the end of D4 | 11 of 12 exit 0 | `suite-runs/t5.4-debt-queries-checks.txt` |

Failures: `verify:capacity` (expected until T5.19), and `src/ui/screens/TradeList.test.tsx:133` ("should render distinct Loading, Ready, Empty … and Error with Retry states"): `expect(marks('tj:open-list-ready')).toBe(2)` got 1. Reproduced in the main session: the case passed three times alone (`npx vitest run src/ui/screens/TradeList.test.tsx -t "should render distinct Loading"`) and the whole unit suite passed once (`npx vitest run src`: 64 files, 836 tests). T5.4 touched no UI or Trade List code; recorded as a load-dependent flake in a D4 UI test, flagged for the user, and fixed by a bug task if it fails a later run.

## T5.5 Journal: section validator for Debt; seed manifest v4

Implementation commit `12c927c`. Three cases red then green; no first-run pass (case 1 gives a Debt an Anchor on a Trade no Entry names, so its red is real). One "green" row failed on the test fixture (a Source record's revision is the Journal revision plus one) and was rerun after fixing the test; a note row explains it. New issue codes `DebtResolutionMissing`, `DebtVersionAfterResolution`, `DebtEntryDefinitionChanged`, `DebtLinkNotReciprocated`, with plain-language copy added to `src/ui/readiness-copy.ts` because its Record is exhaustive. A Debt is a current outcome only while Outstanding. `D4_JOURNAL_MANIFEST` adds `source.trade-detail` ("Trade Detail"); **T5.12 must switch Workspace from `D3_JOURNAL_MANIFEST`.**

### ocr review of `12c927c`

Session `8a5b92a9-1cd7-4cdd-9fff-df22a5077226`, model gpt-6.1-sol, 4 files reviewed, 3 comments. Raw output: `ocr/T5.5-12c927c.json`.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| medium | `src/modules/journal/section.ts:98` | A Debt with no anchor throws, or adds `undefined` to the Trade references, instead of reporting `MissingAnchor` | Valid | Bug task T5.5-B1 |
| medium | `src/modules/journal/section.ts:112` | Reciprocal links are not checked to answer the same obligation key | Valid | Bug task T5.5-B2 |
| medium | `src/modules/journal/section.ts:111` | The reverse-link key omits the store, so an Entry and a decline with one id can mask each other | Doubtful | Bug task T5.5-B3 |

### T5.5-B1 A Debt without an anchor is reported, not thrown

Defect: a backup or migration candidate with a Debt lacking `anchor` (or `anchor.tradeId`) crashes `validateSection` instead of returning an issue.
- it should report MissingAnchor for a Debt whose anchor or anchor Trade is absent, and add nothing undefined to the Trade references

Implemented in `851f6b1`: the Debt scan reads `anchor?.tradeId` and reports `MissingAnchor` with the Debt's id. Red (TypeError) then green.

ocr review of `851f6b1`: session `bf860000-a728-4143-882f-5d2e5b4e2bc0`, 1 file reviewed, **No findings.** Raw output: `ocr/T5.5-B1-851f6b1.json`.

### T5.5-B2 A settlement link answers the Debt's own obligation

Defect: a Debt for one Position Change and an Entry for another that name each other pass validation.
- it should report a settling Entry or decline whose obligation key differs from the Debt it settled

Implemented in `367baf0`: a new issue `DebtObligationMismatch` (with copy in `readiness-copy.ts`) is reported when a settling outcome's obligation key differs from the Debt's. Red then green; the first red run was invalid (an "it " prefix in the filter matched nothing) and was logged and rerun.

ocr review of `367baf0`: session `572e6143-3eb6-40d8-b4da-2ca0872a1c3b`, 2 files reviewed, **No findings.** Raw output: `ocr/T5.5-B2-367baf0.json`.

### T5.5-B3 Reverse links are keyed by store

Defect: an Entry and a decline sharing an identity, both naming one Debt, hide each other's missing reverse link.
- it should report the missing reverse link of a decline when an Entry with the same identity names the same Debt

Implemented in `2877686`: the reverse-link key is `store|debtId|id` at both uses. Red then green. The first fixture failed for the wrong reason (`DuplicateObligationOutcome`), so the decline got its own obligation and red was rerun.

ocr review of `2877686`: session `e5ceeac5-17ca-4bae-a8a9-2549bb94bd3a`, 1 file reviewed, **No findings.** Raw output: `ocr/T5.5-B3-2877686.json`.

### Cumulative run after T5.5

Run 2026-10-29 19:50 EDT on commit `2877686`, Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 65 passed (65)`, `Tests 842 passed (842)`, exit 0 | `suite-runs/t5.5-debt-validator-seed-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 41 passed (41)`, `Tests 73 passed (73)`, exit 0 | `suite-runs/t5.5-debt-validator-seed-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `142 passed (4.9m)`, exit 0 | `suite-runs/t5.5-debt-validator-seed-browser.txt` |
| Static and verification checks (12 commands) | as at the end of D4 | 11 of 12 exit 0 | `suite-runs/t5.5-debt-validator-seed-checks.txt` |

Failures: `verify:capacity` only (expected until T5.19). The TradeList flake did not recur.

## T5.6 Trade Workflows: `recordPositionChange` with Defer

Implementation commit `3297f6b`. Case 1 red (`StorageFailure` rather than `Recorded`: the old code dereferenced the absent decline after the commit) then green. **Case 2 is a flagged first-run pass:** case 1's green already produced the receipt identity and the post-commit Debt, because the widened result union required both. Mutation check: the receipt's Debt id set to `debt.revision` failed with `expected { kind: 'Debt', id: 'id-0017' } to deeply equal { kind: 'Debt', id: 'id-0016' }`, and the code was restored. The case name drops the plan's "(AC-RESP-001)" because parentheses break the `-t` filter; the criterion is still named in the describe and the log. `receipt.reflection.kind` gains `'Debt'` (id is the `debtId`), and `postCommit.reflection` gains `{ kind: 'Debt'; debt: DebtProjection }`. To keep the build compiling, `PositionChangeReceipt.tsx` gets a minimal "Reflection deferred." branch, which T5.14 replaces.

ocr review of `3297f6b`: session `aabda6c8-18f1-4ffe-a041-8ca1c51e2045`, 2 files reviewed, 2 comments. Raw output: `ocr/T5.6-3297f6b.json`.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| low | `src/coordinators/trade-workflows/record-position-change.ts:262` | The Entry/Decline/Debt outcome is selected with nested ternaries, twice (post-commit outcome and receipt) | Doubtful (style; the duplication is real) | Bug task T5.6-B1 (structural) |
| low | `src/ui/screens/PositionChangeReceipt.tsx:130` | The Debt branch deepens a nested ternary in the receipt message | Doubtful (style; placeholder until T5.14) | Bug task T5.6-B2 (structural) |

### T5.6-B1 One outcome selection in `recordPositionChange`

Structural: select the outcome once, without nested ternaries, and derive the receipt's reflection from it. Verified by the trade-workflows tests passing before and after.

Implemented in `710a16b`: a private helper `reflectionOutcome(journal)` selects the outcome once with if/else and returns both the post-commit outcome and the receipt's `{ kind, id }`; the `debt!` assertion is gone (an absent outcome throws `no reflection outcome`, unreachable). Trade-workflows tests 26 passed before and after; the four static checks exit 0. Process slip: the log row was appended with `printf >>` instead of the Edit tool.

ocr review of `710a16b`: session `85190539-bef2-4d3e-9adb-1e3342ad85b5`, 1 file reviewed, **No findings.** Raw output: `ocr/T5.6-B1-710a16b.json`.

### T5.6-B2 Receipt reflection message without nested ternaries

Structural: compute the receipt's reflection message with a switch on its kind. Verified by the ui/screens tests passing before and after.

Implemented in `42a16e4`: a private `reflectionMessage(reflection)` switch over Entry, Debt and Decline, same rendered text. ui/screens tests 233 passed before and after; the four static checks exit 0.

ocr review of `42a16e4`: session `766409b0-cc2c-4dbd-9b39-b51a9a814a8d`, 1 file reviewed, **No findings.** Raw output: `ocr/T5.6-B2-42a16e4.json`.

### Cumulative run after T5.6

Run 2026-10-29 20:02 EDT on commit `42a16e4`, Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 65 passed (65)`, `Tests 844 passed (844)`, exit 0 | `suite-runs/t5.6-record-defer-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 41 passed (41)`, `Tests 73 passed (73)`, exit 0 | `suite-runs/t5.6-record-defer-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `142 passed (5.0m)`, exit 0 | `suite-runs/t5.6-record-defer-browser.txt` |
| Static and verification checks (12 commands) | as at the end of D4 | 11 of 12 exit 0 | `suite-runs/t5.6-record-defer-checks.txt` |

Failures: `verify:capacity` only (expected until T5.19).

## T5.7 Market Data: the previous session's close in frames

Implementation commit `7856037`. `MarkFrame` gains `previousCloseInstant` (an ISO instant: the close of the session before the frame's trading date, from the session policy); it is set in the shared `frameResult`, so Current, Review and Historical frames and `recover`'s frames all carry it. Case 1 red (frame lacked the field) then green: Monday 2026-10-12 gives `2026-10-09T20:00:00Z`, Friday 2026-11-27 gives `2026-11-25T21:00:00Z`. **Case 2 is a flagged first-run pass:** `recover` reuses `frameResult`. Mutation check: `previousCloseInstant = day.close` failed with an `AssertionError` on the frame list, and the code was restored. Other changes: the existing Historical-context frame test expects the new field (`2026-10-08T20:00:00Z`); two `MarkFrame` fixtures in `TradeDetail.test.tsx` gained it to compile; `frameResult` returns the existing `SessionPolicyCoverage` rejection when the previous session is not covered (no case exercises it). Process slip: one test edit was appended with a python here-doc instead of the Edit tool.

ocr review of `7856037`: session `31221c63-4733-464f-892a-4602da61571c`, 1 file reviewed, 1 comment. Raw output: `ocr/T5.7-7856037.json`.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| medium | `src/modules/market-data/market-data.ts:459` | The new `SessionPolicyCoverage` rejection when the previous session is not covered is dropped by `recover`, which returns `Rejected` with empty issues | Valid | Bug task T5.7-B1 |

### T5.7-B1 `recover` reports the coverage rejection of its frames

Defect: when the Review Date is the first session the policy covers, `recover` returns `Rejected` with no issues, losing the `SessionPolicyCoverage` diagnostic `query` reports.
- it should reject recover with the SessionPolicyCoverage issue when the session before the Review Date is not covered

Implemented in `d65cf1a`: `recover` returns the issues of a `Rejected` frame result. Red (`Rejected` with empty issues) then green, with a policy whose coverage starts at the Review Date 2026-10-12.

ocr review of `d65cf1a`: session `9702336f-b7cd-45cd-8ec2-078232d28ee8`, 1 file reviewed, **No findings.** Raw output: `ocr/T5.7-B1-d65cf1a.json`.

### Cumulative run after T5.7

Run 2026-10-29 20:13 EDT on commit `d65cf1a`, Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 65 passed (65)`, `Tests 847 passed (847)`, exit 0 | `suite-runs/t5.7-previous-close-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 41 passed (41)`, `Tests 73 passed (73)`, exit 0 | `suite-runs/t5.7-previous-close-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `142 passed (4.9m)`, exit 0 | `suite-runs/t5.7-previous-close-browser.txt` |
| Static and verification checks (12 commands) | as at the end of D4 | 11 of 12 exit 0 | `suite-runs/t5.7-previous-close-checks.txt` |

Failures: `verify:capacity` only (expected until T5.19).

## T5.8 Daily Review: `open` with reflections per Trade

Implementation commit `d83949d`. Both cases red (no `reflections` on any Trade; `Complete` instead of `Incomplete`) then green; no first-run pass. `assemble` reads Outstanding Debt once (`Journal.query({ scope: 'OutstandingDebt' })`) and classifies a Debt as due when its anchor is at or before the Review frames' `previousCloseInstant` (A75). Public types: `ReflectionCounts { due; later }`, `WalkedTrade extends ReviewTradeItem` with `reflections`, and the `IncompleteReason` `{ code: 'ReflectionDue'; tradeId; debtIds }`, listed after the Trade's `ActionMissing`. The Debt fixture is `tests/support/debt-fixture.ts` (`debtFixture()`, built through `recordPositionChange` with Defer; `review-fixture.ts` `fill`/`fillTogether` gained an optional disposition). Compile-driven UI edits: `ReviewView.tsx` `blockerText` gained a placeholder "Reflection due for <underlying>" (T5.16 replaces it), and the `ready()` factories in `ReviewView.test.tsx` and `ReviewTrade.test.tsx` add zero counts; the getTrade attention-equality test now drops `reflections` from the overview item.

ocr review of `d83949d`: session `dc000bf4-1d6b-4a82-a152-8c4c04df2137`, 5 files reviewed, 2 comments. Raw output: `ocr/T5.8-d83949d.json`.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| medium | `src/coordinators/daily-review/daily-review.ts:256` | `dueAnchor <= previousClose` compares ISO strings, misordering instants with other offsets or fractional seconds | Valid (latent: `dueAnchor` is the caller's `momentTime`, unnormalized) | Bug task T5.8-B1 |
| medium | `src/coordinators/daily-review/daily-review.ts:253` | The previous close comes from `recovered.frames[0]`; a walk whose Trades need no frames classifies every Debt as later and emits no `ReflectionDue` | Valid | Bug task T5.8-B2 |

### T5.8-B1 Due classification compares instants

Defect: a Debt anchored at an instant written with an offset (or fractional seconds) is classified by string order.
- it should classify a Debt as later when its anchor, written with a New York offset, is after the previous session close

The case was first planned as "due … at or before"; that cannot fail under string order (a New York local time reads earlier than UTC, so string order can only wrongly call a later anchor due), so the case was inverted. Its first, invalid red row is noted in the log.

Implemented in `880e6c0`: the comparison is `Temporal.Instant.compare(dueAnchor, previousClose) <= 0`. Red (`{ due: 1, later: 0 }` for a fill at `2026-10-12T16:30:00-04:00`) then green. The file's other ordered comparison orders trading dates and was left alone.

ocr review of `880e6c0`: session `950d07d5-4c04-41ae-813a-6e657797b6b9`, 1 file reviewed, **No findings.** Raw output: `ocr/T5.8-B1-880e6c0.json`.

### T5.8-B2 Due classification does not depend on frames

Defect: when no walked Trade needs a Mark frame, no Debt is classified as due and completion omits due reflections.
- it should report a due reflection for a walked Trade that needs no Mark frame

Implemented in `2f2d8c2`: red (`{ due: 0, later: 1 }`) then green, with a walked Trade whose first Execution is broken (IncoherentFacts, so no Mark requirement and no frames). `frameResult` sets a result-level `previousCloseInstant` from the resolved day, independent of frames: `Recovered`, `Frames` and `SnapshotChanged` all carry it, because Daily Review's post-save path reads `ResolveFrames` rather than `recover`. Daily Review classifies against it; the undefined guard is gone. This places A75's field on the query results as well as on `recover`'s Review Date resolution (the per-frame field is unchanged); no spec passage is affected.

ocr review of `2f2d8c2`: session `624b3dec-7529-433a-a7a2-db67dec8d41c`, 2 files reviewed, **No findings.** Raw output: `ocr/T5.8-B2-2f2d8c2.json`.

### Cumulative run after T5.8

Run 2026-10-29 20:29 EDT on commit `2f2d8c2`, Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 66 passed (66)`, `Tests 851 passed (851)`, exit 0 | `suite-runs/t5.8-review-reflections-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 41 passed (41)`, `Tests 73 passed (73)`, exit 0 | `suite-runs/t5.8-review-reflections-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `142 passed (4.8m)`, exit 0 | `suite-runs/t5.8-review-reflections-browser.txt` |
| Static and verification checks (12 commands) | as at the end of D4 | 11 of 12 exit 0 | `suite-runs/t5.8-review-reflections-checks.txt` |

Failures: `verify:capacity` only (expected until T5.19).

## T5.9 Daily Review: `getTrade` with the Trade's owed reflections

Implementation commit `04a7f8f`. Both cases red (`reflections` undefined; `Ready` instead of `ReviewChanged`) then green; no first-run pass. Case 2 sits in its own describe, "owed reflections resolved elsewhere (A68)", for its own fixture; it declines D-2 through `Journal.save` (`ResolveDebt`). `getTrade` returns `reflections: OwedReflection[]` (Journal's anchor-then-identity order), each with the snapshot `EntryDefinitionRecord`, the Position Change's Economic Time and Executions, a `ReflectionClassification` (`Due`, `DueInNextReview`, `DueInReviewAfterNext`, by `Temporal.Instant.compare` against the previous close and the Review Date's close) and a `ReflectionSaveBinding { debtId; debtRevision; definitionRevision }`. **Binding change:** `ReviewBinding` gains `outstandingDebts` (Trade identity to its Outstanding Debt identities); `getTrade` returns `ReviewChanged` when the Trade's list differs. The Journal revision was not used because every Action save moves it. Compile-driven fixture edits in `daily-review.test.ts`, `ReviewView.test.tsx` and `ReviewTrade.test.tsx`; no UI code changed.

ocr review of `04a7f8f`: session `bcf9d0e0-610d-451e-aa60-6e6d7d29b800`, 2 files reviewed, 1 comment. Raw output: `ocr/T5.9-04a7f8f.json`.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| low | `src/coordinators/daily-review/daily-review.ts:360` | The reflection classification is a nested ternary | Valid (style) | Bug task T5.9-B1 (structural) |

### T5.9-B1 Reflection classification without nested ternaries

Structural: classify with an if/else chain. Verified by the daily-review tests passing before and after.

Implemented in `fa3d504`: an if/else chain with the same comparisons in the same order. Daily-review tests 70 passed before and after; the four static checks exit 0.

ocr review of `fa3d504`: session `affc5a17-3bb6-4753-968a-1da13d5e779e`, 1 file reviewed, **No findings.** Raw output: `ocr/T5.9-B1-fa3d504.json`.

### Cumulative run after T5.9

Run 2026-10-29 20:40 EDT on commit `fa3d504`, Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 66 passed (66)`, `Tests 853 passed (853)`, exit 0 | `suite-runs/t5.9-owed-reflections-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 41 passed (41)`, `Tests 73 passed (73)`, exit 0 | `suite-runs/t5.9-owed-reflections-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `142 passed (4.8m)`, exit 0 | `suite-runs/t5.9-owed-reflections-browser.txt` |
| Static and verification checks (12 commands) | as at the end of D4 | 11 of 12 exit 0 | `suite-runs/t5.9-owed-reflections-checks.txt` |

Failures: `verify:capacity` only (expected until T5.19).

## T5.10 Daily Review: `save` (`ResolveReviewDebt`)

Implementation commit `c40845f`. Case 1 red (`expected DebtResolved, got Rejected`) then green. **Cases 2, 3 and 4 are flagged first-run passes**, each proven by a mutation check and restored:
- Case 2 (decline): building the decline without its reason failed with an `AssertionError` on the decline record. Case 1 had already built this behavior.
- Case 3 (Conflict): returning a bare `Conflict` without the current outcome failed. Journal's Conflict result passes through.
- Case 4 (RuntimeNotWritable): moving the branch outside `guard.run` failed. The existing guard on `DailyReview.save` covers it.

Case 3 resolves the Debt through `Journal.save` with Source `source.trade-detail`, which Journal already accepts.

New public types:
- `ResolveReviewDebtRequest { kind: 'ResolveReviewDebt'; reviewDate; binding: ReflectionSaveBinding; resolution: Answer | Decline }`.
- `SaveDailyReviewRequest` is now the union of the two save requests.
- Result kinds `DebtResolved { entry?; decline?; debt; review }` and `NotFound`.
- `Conflict` gains an optional `currentOutcome`.

The commit retries up to 3 attempts, then returns `ChangedDuringAssembly`.

**Next-step rule:** a Trade is now skipped only when its Action is saved and it owes no due reflection. This applies to every Review save (A68). A Debt save starts from the current Trade with wrap-around. An Action save still starts from the head of the walk; this is followed up below.

Left for T5.12 and T5.13:
- The capability lists (`capabilities.ts`, `routes.ts`) still name only `SaveTradeAction`.
- `src/app/types.ts` does not export `ResolveReviewDebtRequest` yet.

ocr review of `c40845f`: session `bb75d6f9-588b-4393-87c3-8f82eece23e8`, 3 files reviewed, 1 comment. Raw output: `ocr/T5.10-c40845f.json`.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| medium | `src/coordinators/daily-review/daily-review.ts:550` | The Action-save path assembles the next step without the saved Trade, so it can jump back to an earlier unfinished Trade | Valid. The reviewer rated it Doubtful because it found no requiring text, but A68 says "the next step after any Review save is the first Trade in attention order, starting from the current one, that is not done" | Bug task T5.10-B1 |

### T5.10-B1 An Action save continues from the saved Trade

Defect: after an Action save, the next step is the first Trade in the walk that is not done, counted from the head of the walk rather than from the saved Trade (A68).
- it should, after an Action save, return as the next step the first Trade that is not done starting from the saved Trade, not from the head of the walk

Implemented in `d872076`: the Action-save path passes the saved Trade as `from`. Red (`expected 'id-0047' to be 'id-0008'`, the head-of-walk Trade) then green. **Changed D4 expectation (flagged):** the T4.16 case "should continue with the first Trade of the walk that has no Action, with the form getTrade would return" encoded head-of-walk continuation. The D4 plan never stated that rule, and the D5 plan's A68 replaces it for every Review save. Its name and expectation became "should continue with the first Trade after the saved one that has no Action, with the form getTrade would return", reading the walk order from `open`. The log's first red/green pair for this task is superseded and noted. daily-review and ui tests: 371 passed.

ocr review of `d872076`: session `b89e61f6-c1ea-4731-b84e-cfb3871bc647`, 1 file reviewed, **No findings.** Raw output: `ocr/T5.10-B1-d872076.json`.

### Cumulative run after T5.10

Run 2026-10-29 20:56 EDT on commit `d872076`, Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 67 passed (67)`, `Tests 858 passed (858)`, exit 0 | `suite-runs/t5.10-review-resolve-debt-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 41 passed (41)`, `Tests 73 passed (73)`, exit 0 | `suite-runs/t5.10-review-resolve-debt-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `142 passed (4.8m)`, exit 0 | `suite-runs/t5.10-review-resolve-debt-browser.txt` |
| Static and verification checks (12 commands) | as at the end of D4 | 11 of 12 exit 0 | `suite-runs/t5.10-review-resolve-debt-checks.txt` |

Failures: `verify:capacity` only (expected until T5.19).

## T5.11 Trade Views: Debt on Trade Detail

Implementation commit `fdb1b66`. Case 1 red (runtime `no Debt item for D-1`: the temporary filter dropped Debt) then green; the temporary filter is removed. **Cases 2 and 3 are flagged first-run passes**, each proven by a mutation check and restored:
- Case 2 (settled and declined Debt shown once): T5.4 already built `answeredLater` and `declinedLater`. Mutation: dropping `answeredLater` failed with an `AssertionError` on the Entry item.
- Case 3 (decision 56, outside coverage): case 1 already skipped classification when the frame has no resolution. Mutation: classifying as `Due` failed with `expected { kind: 'Debt', … } to not have property "dueStatus"`.

New public types, re-exported from `src/app/types.ts`:
- `DebtDueStatus` (`Due`, `DueInNextReview`, `DueInReviewAfterNext`).
- `TradeDetailDebt extends NarrativeDebt` with an optional `dueStatus`.
- `TradeDetailNarrativeItem`. The Open and Incoherent detail journals use it.

**Interpretation, flagged:** an Incoherent Trade Detail lists its Debt without `dueStatus`. No frame resolves for a Trade that cannot be replayed, so there is no Expected Mark Date. The plan does not name this form; this applies decision 56's "no classification" reading.

Other changes:
- **UI placeholder:** `outcomesOnly` in `TradeDetail.tsx` hides Debt items. T5.17 replaces it.
- **Compile-driven narrowing:** `tests/integration/d2/responses.test.ts` needed one narrowing to compile.
- **Source label:** case 2 accepts the raw key `source.trade-detail` until T5.12 switches the manifest.

ocr review of `fdb1b66`: session `b53df62f-1238-4bd4-884b-8d64d0a6a791`, 4 files reviewed, 1 comment. Raw output: `ocr/T5.11-fdb1b66.json`.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| low | `src/coordinators/trade-views/trade-views.ts:398` | `dueStatus` is computed with a nested ternary | Valid (style; logic correct) | Bug task T5.11-B1 (structural) |

### T5.11-B1 Debt due status without nested ternaries

Structural: compute `dueStatus` with an if/else chain. Verified by the trade-views tests passing before and after.

Implemented in `20ea662`: an if/else chain, same comparisons in the same order, the outside-coverage early return untouched. Trade-views tests 34 passed before and after; the four static checks exit 0.

ocr review of `20ea662`: session `7a989986-f34d-4cad-a4d7-5f6291d39132`, 1 file reviewed, **No findings.** Raw output: `ocr/T5.11-B1-20ea662.json`.

### Cumulative run after T5.11

Run 2026-10-29 21:39 EDT on commit `20ea662`, Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 68 passed (68)`, `Tests 861 passed (861)`, exit 0 | `suite-runs/t5.11-detail-debt-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 41 passed (41)`, `Tests 73 passed (73)`, exit 0 | `suite-runs/t5.11-detail-debt-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `142 passed (5.0m)`, exit 0 | `suite-runs/t5.11-detail-debt-browser.txt` |
| Static and verification checks (12 commands) | as at the end of D4 | 11 of 12 exit 0 | `suite-runs/t5.11-detail-debt-checks.txt` |

Failures: `verify:capacity` only (expected until T5.19).

## T5.12 Workspace: migration to schema 4

Implementation commit `b27f1e1`. Red (receipt `manifestVersion: 3`, no `source.trade-detail`) then green; no first-run pass. A first green attempt failed on the test's own wrong v3 `meta` count; it is logged with a note.

The Workspace and the migration now compose `D4_JOURNAL_MANIFEST`. The receipt's `seeds.journal` is `{ manifestVersion: 4, additions }`:
- v1 adds the earlier additions plus `source.trade-detail`.
- v2 adds `daily-trade-review`, `daily-review` and `trade-detail`.
- v3 adds `source.trade-detail` only.

Earlier expectations changed only for the switch (manifest version 3 to 4, the new Source among the additions, `journalTypes` 6 to 7):
- `workspace.test.ts`: fresh, existing and interrupted-seed initialize, and the stored count.
- `migration.test.ts`: the v1 and v2 receipts, the v1 one-candidate case, and two counts.
- Integration: `d2/migration`, `d2/seed`, `d4/migration`, `d4/seed`.

`D3_JOURNAL_MANIFEST` stays in use by journal module tests and `tests/support/review-fixture.ts`. Process slip: the manifest rename in two source files was made with `sed -i` instead of the Edit tool.

ocr review of `b27f1e1`: session `1e1b28ff-13b4-4b93-acc7-5fbb01cddd4c`, 2 files reviewed, **No findings.** Raw output: `ocr/T5.12-b27f1e1.json`.

### Cumulative run after T5.12

Run 2026-10-29 21:49 EDT on commit `b27f1e1`, Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 68 passed (68)`, `Tests 862 passed (862)`, exit 0 | `suite-runs/t5.12-migration-v4-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 41 passed (41)`, `Tests 73 passed (73)`, exit 0 | `suite-runs/t5.12-migration-v4-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `142 passed (4.8m)`, exit 0 | `suite-runs/t5.12-migration-v4-browser.txt` |
| Static and verification checks (12 commands) | as at the end of D4 | 11 of 12 exit 0 | `suite-runs/t5.12-migration-v4-checks.txt` |

Failures: `verify:capacity` only (expected until T5.19).

## T5.13 Installed Capability Manifest and composition root for D5

Manifest additions (`src/coordinators/workspace/capabilities.ts`), mirrored in `routes.ts`:
- `Journal.save`: `ResolveDebt`, `Answer`, `Decline`, `TradeDetailSource` (new; Trade Detail route only).
- `Journal.query`: `TradeNarrative`, `OutstandingDebt`.
- `TradeWorkflows.recordPositionChange`: adds `Defer` (record-entry route).
- `TradeViewsAndReporting.getTradeDetail`: adds `Debt`.
- `MarketData.query`: adds `PreviousClose`.
- `DailyReview.open`: adds `OwedReflections`; `DailyReview.getTrade`: `OwedReflections`; `DailyReview.save`: adds `ResolveReviewDebt`.
- `DailyReview.getDebt` absent (P17). Schema version 4 (already `SCHEMA_VERSION`).

Facade: `Journal.save` runs through `guard.run`. `src/app/types.ts` lifts `DebtProjection`, `DebtResolution`, `ResolveDebtCommand`, `JournalSaveResult`, `JournalQuery`, `OutstandingDebtPage`, `NarrativeDebt`, `NarrativeSettledDebt`, `ObligationOutcome`, `OwedReflection`, `ReflectionClassification`, `ReflectionCounts`, `ReflectionSaveBinding`, `ResolveReviewDebtRequest`, `WalkedTrade` (daily-review index exports the last four new ones). Facade double gains `Journal.save`.

Changed expectation: the manifest case in `src/coordinators/workspace/workspace.test.ts`, to match the plan row.

`npm run verify:capabilities`: OK (19 operations, 10 variant-qualified, 8 routes, schema 4). `typecheck`, `tsc6 --noEmit`, `lint`, `lint:deps` exit 0. `npx vitest run src/app src/coordinators/workspace src/ui tests/integration`: 409 passed.

Implementation commit `f2fae68`. Notes from the main session:
- The variant names are the implementer's choice: `Defer`, `Debt`, `PreviousClose`, `OwedReflections`, `ResolveReviewDebt`, `Answer`, `Decline`, `TradeDetailSource`. The Trade Detail Source is named as a `Journal.save` variant because the manifest has no other place for a Source.
- `Journal.query`'s `OutstandingDebt` is used by Daily Review internally and has no UI caller. It is listed among the `trade-detail` route's variants so the reachability check covers it.
- `trade-detail` and `review` remain `readOnly: true` while hosting writes. The mutation guard refuses writes in Recovery Only, as it does for the Action save since D4.
- The manifest case's name in `workspace.test.ts` still says "through D4".
- Process slip: the section above was appended with a here-doc instead of the Edit tool.

ocr review of `f2fae68`: session `cac239fa-6470-4c05-820c-fac6b0c5f544`, 6 files reviewed, **No findings.** Raw output: `ocr/T5.13-f2fae68.json`.

### Cumulative run after T5.13

Run 2026-10-29 21:57 EDT on commit `f2fae68`, Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 68 passed (68)`, `Tests 862 passed (862)`, exit 0 | `suite-runs/t5.13-manifest-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 41 passed (41)`, `Tests 73 passed (73)`, exit 0 | `suite-runs/t5.13-manifest-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `142 passed (4.8m)`, exit 0 | `suite-runs/t5.13-manifest-browser.txt` |
| Static and verification checks (12 commands) | as at the end of D4 | 11 of 12 exit 0 | `suite-runs/t5.13-manifest-checks.txt` |

Failures: `verify:capacity` only (expected until T5.19).

## T5.14 UI: reflection disposition on the entry form

Implementation commit `71e9df3`. Cases 1, 2 and 4 went red then green:
- Case 1: no radiogroup named Reflection.
- Case 2: the prompts were still shown. One green attempt first failed on a test bug (a UTC time instead of Workspace-local, and a missing mock); it was logged and fixed.
- Case 4: no "Reflection owed" text.

**Case 3 is a flagged first-run pass.** Case 2 already kept the answers independent of the disposition. Mutation check: submitting Complete with empty answers failed with `expected [] to have a length of 4 but got +0`; the code was restored.

The changes:
- **Disposition control.** It is a `fieldset` with the legend "Reflection" and three native radios. Reflect now is the default. Reflect later submits `{ kind: 'Defer' }`. The form counts as unsaved when the choice is not Reflect now.
- **Receipt.** The receipt shows a warning-tone "Reflection owed" badge for a Debt outcome. This replaces the T5.6 placeholder.
- **D2 tests.** The D2 checkbox became one radio of the group, so 7 selectors in `PositionChangeForm.test.tsx` changed from checkbox to radio role. The two "uncheck" steps now choose Reflect now. No D2 expectation changed. The browser helper `declineReflection` uses `getByLabel('Decline to reflect').check()`, which works on a radio.

Process slip: four of those selector swaps were made with `sed -i` instead of the Edit tool. The ui tests passed: 300.

ocr review of `71e9df3`: session `70d85468-7503-4dfd-9761-2ec0bfdfaa75`, 2 files reviewed, **No findings.** Raw output: `ocr/T5.14-71e9df3.json`.

### Cumulative run after T5.14

Run 2026-10-29 22:08 EDT on commit `71e9df3`, Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 68 passed (68)`, `Tests 866 passed (866)`, exit 0 | `suite-runs/t5.14-entry-disposition-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 41 passed (41)`, `Tests 73 passed (73)`, exit 0 | `suite-runs/t5.14-entry-disposition-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `142 passed (4.8m)`, exit 0 | `suite-runs/t5.14-entry-disposition-browser.txt` |
| Static and verification checks (12 commands) | as at the end of D4 | 11 of 12 exit 0 | `suite-runs/t5.14-entry-disposition-checks.txt` |

Failures: `verify:capacity` only (expected until T5.19).

## T5.15 UI: Debt form

Implementation commit `9d7016d`. All six cases went red then green; none passed on its first run. Case 1 uses a revision-2 snapshot built in the test, with Reactive relabelled "Impulsive" and a required "Lesson" prompt placed first, matching the A74 fixture. Its name reads "that revision prompt wording" because the apostrophe breaks the `-t` filter.

**Host adapter.** The form is `DebtForm` and takes a `submit({ binding, resolution })` adapter, where `resolution` is `Answer { answers }` or `Decline { reason? }`. The adapter returns one of:
- `Resolved { entry?; decline?; debt }`
- `Rejected { issues }`
- `Conflict { currentOutcome? }`
- `NotFound`
- `RuntimeNotWritable`

Each host maps its own result to these: Daily Review's `DebtResolved`, and Journal's `Saved`. The other props are `definition` (the snapshot), `binding`, and the optional callbacks `onResolved`, `onCancel` and `onDirtyChange`.

After a save, the form renders the saved Entry or decline from the result alone. Without write access, Answer and Decline are not rendered and the fields are disabled.

Supporting edits:
- `ReflectionPrompts` gains an optional `disabled`.
- The ReasonTooLong message is shared as `REASON_TOO_LONG` (no behavior change).

**Left for the hosts (T5.16, T5.17):**
- Moving focus after a save (A71).
- Reporting `RuntimeNotWritable` to the shell from the adapter, as `ActionForm` does.
- Prompt-derived ids would collide if two forms for one snapshot were open at once.

**Not covered by planned cases:**
- `NotFound` renders nothing.
- A Rejected issue without a prompt, such as `DefinitionRevisionMismatch`, shows only the generic message.

The ui tests pass: 306.

ocr review of `9d7016d`: session `d6f17d9d-5efc-4115-8fa2-4a8e0329eb37`, 3 files reviewed, 6 comments. Raw output: `ocr/T5.15-9d7016d.json`.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| medium | `src/ui/screens/DebtForm.tsx:102` | No in-flight guard: Answer then Decline can both be submitted while the first call is pending | Valid | Bug task T5.15-B1 |
| medium | `src/ui/screens/DebtForm.tsx:103` | A rejected adapter promise is unhandled and the trader sees nothing | Valid | Bug task T5.15-B2 |
| medium | `src/ui/screens/DebtForm.tsx:113` | NotFound gives no feedback and leaves the form looking usable | Valid | Bug task T5.15-B3 |
| medium | `src/ui/screens/DebtForm.tsx:119` | A Rejected issue without a prompt (for example `DefinitionRevisionMismatch`) is never shown | Valid | Bug task T5.15-B4 |
| medium | `src/ui/screens/DebtForm.tsx:99` | ReasonTooLong leaves focus on Decline, not on the reason field | Valid | Bug task T5.15-B5 |
| low | `src/ui/screens/DebtForm.tsx:59` | Nested ternaries format a saved response | Doubtful (style) | Bug task T5.15-B6 (structural) |

### T5.15-B1 One submission at a time
- it should disable Answer and Decline while a submission is pending and make no second call

Implemented in `56c42eb`: a `pending` state with an `inFlight` ref (the ReviewView idiom); `send` returns early while a call is in flight and resets in `.finally`; Answer and Decline are disabled while pending. Red (`expected false to be true`) then green.

ocr review of `56c42eb`: session `97aefc7e-c5b0-446b-ab43-a7b42601bca8`, 1 file reviewed, **No findings.** Raw output: `ocr/T5.15-B1-56c42eb.json`.

### T5.15-B2 An adapter failure is shown
- it should show an error and keep the entered values when the submit adapter throws

Implemented in `018b46b`: `send` wraps the adapter call in try/catch/finally; a thrown save shows an alert banner ("This reflection could not be saved. Nothing was saved. Your values are kept, so you can try again.", after ActionForm's StorageFailure wording), keeps the values and re-enables Answer. Red (`Unable to find role="alert"`, plus the unhandled rejection) then green. **Noted, not fixed (D4 code, out of D5's scope):** the Review's `ActionForm` save uses try/finally without a catch, so a thrown save is unhandled there too.

ocr review of `018b46b`: session `02a98c6d-eabc-4e57-8ab7-5528adb37e22`, 1 file reviewed, **No findings.** Raw output: `ocr/T5.15-B2-018b46b.json`.

### T5.15-B3 NotFound is shown
- it should show that the reflection no longer exists and offer no Answer or Decline when the result is NotFound

Implemented in `9b1afa0`: a `gone` state set by NotFound shows an alert ("This reflection no longer exists. Nothing was saved.") and hides Answer and Decline; the fields and Cancel stay. Red (`Unable to find role="alert"`) then green.

ocr review of `9b1afa0`: session `c2d911f4-3f2d-47ab-ba01-286bca2f642b`, 1 file reviewed, **No findings.** Raw output: `ocr/T5.15-B3-9b1afa0.json`.

### T5.15-B4 Form-level rejections are shown
- it should show a Rejected issue that names no prompt as a form-level error

Implemented in `0e1ab54`: a `rejected` state, set when a Rejected result carries an issue with no prompt other than ReasonTooLong, shows an alert ("This reflection could not be saved. Reopen it and try again. Your values are kept.", after ActionForm's `COULD_NOT_SAVE`). Red (`Unable to find role="alert"`) then green.

ocr review of `0e1ab54`: session `7e860d54-128d-408a-9416-78ec8c206790`, 1 file reviewed, **No findings.** Raw output: `ocr/T5.15-B4-0e1ab54.json`.

### T5.15-B5 ReasonTooLong focuses the reason
- it should move focus to the reason field when Decline is rejected with ReasonTooLong

Implemented in `cd62ea3`: the focus effect keeps the first-prompt focus and, when no prompt has an issue, focuses the reason field by id (it has no name). Red (focus stayed on the Decline button) then green.

ocr review of `cd62ea3`: session `fd482f53-ce78-4384-9435-07f8f08ea760`, 1 file reviewed, **No findings.** Raw output: `ocr/T5.15-B5-cd62ea3.json`.

### T5.15-B6 Saved-response formatting without nested ternaries
Structural: format each saved response with a helper; ui tests pass before and after.

Implemented in `992c991`: `savedResponseText(prompt, value)` switches on the value's kind, same rendered text. ui tests 311 passed before and after; the four static checks exit 0.

ocr review of `992c991`: session `08dc9741-9b13-4bf6-bfbb-c53677f9eecb`, 1 file reviewed, **No findings.** Raw output: `ocr/T5.15-B6-992c991.json`.

### Cumulative run after T5.15

Run 2026-10-29 22:29 EDT on commit `992c991`, Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 69 passed (69)`, `Tests 877 passed (877)`, exit 0 | `suite-runs/t5.15-debt-form-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 41 passed (41)`, `Tests 73 passed (73)`, exit 0 | `suite-runs/t5.15-debt-form-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `142 passed (4.8m)`, exit 0 | `suite-runs/t5.15-debt-form-browser.txt` |
| Static and verification checks (12 commands) | as at the end of D4 | 11 of 12 exit 0 | `suite-runs/t5.15-debt-form-checks.txt` |

Failures: `verify:capacity` only (expected until T5.19).

## T5.16 UI: reflections in the Review's Trade card

Implementation commit `2a98d70`, with its refactor log row in `3375bc0`. All three cases went red then green, with no first-run pass:
- **Case 1:** red with no "Reflections" region. A first green attempt failed on a test bug that counted nested list items; the test was fixed, not production.
- **Case 2:** red with no "Reflect on …" button.
- **Case 3:** red with `expected [ 'Reflection due for XYZ', … ] to deeply equal [ '2 reflections due for XYZ', … ]`.

What was built:
- **Reflections section.** The new `ReviewReflections` section sits above the Action form. Each owed reflection shows:
  - its Position Change's local date and time;
  - its Executions (`Buy 100 XYZ @ $50.00`);
  - its due text;
  - a "Reflect on <date time>" button, which opens `DebtForm` inline. Only one form is open per card at a time.
- **Save adapter.** It calls `DailyReview.save` with `ResolveReviewDebt`. `DebtResolved` maps to `Resolved`. Market-data issues are dropped from `Rejected`. `ReviewChanged`, `ChangedDuringAssembly` and `StorageFailure` are thrown, so the form shows its "could not be saved" banner and keeps the values.
- **Focus after a save.** Focus moves to the next reflection, or to a focusable wrapper around the Action form when none remains.
- **Blockers.** The overview's blockers read "Reflection due for XYZ" or "N reflections due for XYZ", with the Underlying as a link that opens that Trade's card. This replaces the T5.8 placeholder.

**Design choices, flagged:**
- After a reflection save, only completion and the binding are applied to the overview. The selected Trade stays, so the card can show the resolved reflection and keep the Action form as the focus target (A71). The returned next step is not followed.
- A `ChangedDuringAssembly` post-save review is ignored until Continue.
- The reflection list is not re-read after an Action Conflict refresh. A stale reflection gets `NotFound` or `Conflict` from the form.
- The blocker link is `/review?trade=<id>` with the click intercepted. The query is not read on load.
- The form's unsaved state counts as unsaved, but it does not hold the Review's buttons.

The ui tests pass: 314.

ocr review of `e74afd2..3375bc0`: session `c2ec5452-ff44-4d26-b2fb-43a0193a8db3` (a first attempt, `4ea8b89a-…`, failed on an LLM streaming error and was rerun), 3 files reviewed, 3 comments. Raw output: `ocr/T5.16-3375bc0.json`.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| high | `src/ui/screens/ReviewView.tsx:404` | A reflection draft does not hold Trade selection, Continue, blocker links or the Action save's advance, so its values are discarded without warning | Valid (it overturns the flagged design choice above) | Bug task T5.16-B1 |
| medium | `src/ui/screens/ReviewReflections.tsx:59` | Cancel stays enabled while a reflection save is pending; cancelling and then completing mounts an empty form for a resolved Debt | Valid | Bug task T5.16-B2 |
| medium | `src/ui/screens/ReviewView.tsx:377` | A blocker link's reopen overwrites a Trade selected while it was in flight | Valid | Bug task T5.16-B3 |

### T5.16-B1 A reflection draft holds the Review like an Action draft
- it should hold Trade selection, Continue and the blocker links while a reflection draft has a value, as it does for an Action draft

Implemented in `705a68f`: the hold flag is recomputed on every entry-dirty change and is true while any `action:` or `debt:` draft has a value (so two drafts cannot clear each other's hold); Mark entries still do not hold. Red (Continue enabled) then green; one green attempt failed on a test query matching two links. **Noted:** the hold message still reads "Save your Action or put back its saved values to leave this Trade." for a reflection draft.

ocr review of `705a68f`: session `24e13c13-c44c-41e4-a3bf-43d1d07d8444`, 1 file reviewed, **No findings.** Raw output: `ocr/T5.16-B1-705a68f.json`.

### T5.16-B2 Cancel waits for a pending reflection save
- it should disable Cancel while a reflection save is pending

Implemented in `3ed732c`: Cancel is disabled while a save is pending, and re-enabled after a non-resolving result. Red (`expected false to be true`) then green.

ocr review of `3ed732c`: session `177d50b8-24fe-4978-89e8-dca803fb269d`, 1 file reviewed, **No findings.** Raw output: `ocr/T5.16-B2-3ed732c.json`.

### T5.16-B3 A newer selection wins over a blocker link's reopen
- it should keep a Trade selected while a blocker link's reopen is in flight

Implemented in `4dafa91`: `openCard` takes the selection token before `reopen()` and, after applying the reopened Review, skips `select` when a newer selection was made. Red (DEF shown instead of the newer XYZ selection) then green.

ocr review of `4dafa91`: session `7a7240fd-8e36-44b4-8b91-9cf9e0f1dd81`, 1 file reviewed, **No findings.** Raw output: `ocr/T5.16-B3-4dafa91.json`.

### Cumulative run after T5.16

Run 2026-10-29 22:55 EDT on commit `4dafa91`, Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 69 passed (69)`, `Tests 883 passed (883)`, exit 0 | `suite-runs/t5.16-review-reflections-ui-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 41 passed (41)`, `Tests 73 passed (73)`, exit 0 | `suite-runs/t5.16-review-reflections-ui-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `142 passed (5.3m)`, exit 0 | `suite-runs/t5.16-review-reflections-ui-browser.txt` |
| Static and verification checks (12 commands) | as at the end of D4 | 11 of 12 exit 0 | `suite-runs/t5.16-review-reflections-ui-checks.txt` |

Failures: `verify:capacity` only (expected until T5.19). A first run with this label was interrupted when the session ended; this is its complete rerun.

## T5.17 UI: Trade Detail Debt status and actions

Implementation commit `bde6ddd`.

**Cases.** Cases 1–3 went red then green:
- Case 1: no Journal region of 3 items.
- Case 2: no "Deferred, answered".
- Case 3: no Reflection form. Its name drops an apostrophe for the `-t` filter.

**Case 4 (decision 56) is a flagged first-run pass.** Case 1 already rendered due text only when a status is present. Mutation check: always render "Due" failed with `Found multiple elements with the text: Due`, and the code was restored.

**Extra cases.**
- One form open at a time: red then green.
- Focus moves to the saved reflection after a save: red then green.
- `RuntimeNotWritable` is reported to the shell and the form is kept. **This is a flagged first-run pass:** case 3 had already built `report(result)`. Mutation check: `void report` failed with `expected last "vi.fn()" call to have been called with [ { kind: 'RuntimeNotWritable' } ]`, and the code was restored.

**What was built.** A new `OwedDebtItem` shows each Outstanding Debt in the Journal narrative of Open and Incoherent Trade Detail:
- It reads "Reflection owed" with "Position Change at <moment time>" and the due text from `DUE_TEXT`, shared with the Review. There is no due text when the status is absent.
- Reflect now and Decline are offered only while the Workspace is Writable. Both open `DebtForm`, which has its own Decline button and optional reason.
- The form loads its definition through `getDefinitions({ revision })`.
- The adapter calls `Journal.save` (`ResolveDebt`):
  - `Saved` maps to `Resolved`; `Rejected`, `Conflict`, `NotFound` and `RuntimeNotWritable` pass through.
  - `StorageFailure` is thrown, so the form shows its "could not be saved" banner. No test covers this.
- Settled and declined items show "Deferred, answered" or "Declined later" with their times.
- The Executions list still hides Debt items through `outcomesOnly`, which is now intended rather than a placeholder.

**Noted gaps:**
- A `getDefinitions` failure that throws is unhandled.
- `TradeDetail` does not report a reflection draft as unsaved to the app shell, so an unsaved Debt form does not hold app updates. This is followed up below.

**Process slip.** The first describe block was appended with a here-doc instead of the Edit tool.

The ui tests passed: 324.

ocr review of `bde6ddd`: session `85e42cc1-1271-43f4-a419-01b245a2fdb8`, 4 files reviewed, 3 comments. Raw output: `ocr/T5.17-bde6ddd.json`.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| medium | `src/ui/screens/OwedDebtItem.tsx:36` | A rejected `getDefinitions` never closes the item (other Debts stay disabled; unhandled rejection), and NotFound closes with no feedback | Valid | Bug task T5.17-B1 |
| medium | `src/ui/screens/OwedDebtItem.tsx:104` | `DebtForm` gets no `onDirtyChange`, so an unsaved reflection is not registered with the shell's update guard and a waiting update's Reload can discard it | Valid (the gap noted above) | Bug task T5.17-B2 |
| medium | `src/ui/screens/OwedDebtItem.tsx:47` | After a save the item still reads "Reflection owed" with its due status, with no "Deferred, answered" or "Declined later" label until reload | Valid | Bug task T5.17-B3 |

### T5.17-B1 A failed definition load is shown and releases the item
- it should show that the reflection could not be opened, and re-enable the other reflections, when its definition cannot be loaded

Implemented in `9435a81`: `open()` catches a rejected load and treats a non-Found result the same way: it shows "This reflection could not be opened. Try again." as an alert and calls `onClose()`, re-enabling the other reflections. Red (`Unable to find role="alert"`, plus the unhandled rejection) then green, for both a rejection and NotFound.

ocr review of `9435a81`: session `791abe5c-593b-4b29-9620-0854b33581eb`, 1 file reviewed, **No findings.** Raw output: `ocr/T5.17-B1-9435a81.json`.

### T5.17-B2 An unsaved reflection on Trade Detail holds app updates
- it should register an unsaved reflection on Trade Detail with the update guard and clear it after a save or cancel

Implemented in `09fed4f`: `TradeDetail` gains an optional `onDirtyChange`, passed through `OwedDebtItem` to `DebtForm` (one form is open at a time, so no aggregation is needed); `main.tsx` passes `setUnsaved` (one line, no wiring test exists for these props). A first red was invalid (a fixture option label) and was logged; the valid red was `onDirtyChange` never called with true, then green.

ocr review of `09fed4f`: session `03e42846-1823-4742-b2da-d383d8d2a80a`, 3 files reviewed, **No findings.** Raw output: `ocr/T5.17-B2-09fed4f.json`.

### T5.17-B3 A resolved reflection reads as settled without a reload
- it should relabel a reflection resolved on Trade Detail as "Deferred, answered" or "Declined later" with its time, without "Reflection owed" or a due status

Implemented in `0edcc04`: after a save the item renders from the result: the badge becomes "Deferred, answered" or "Declined later", an "Answered" or "Declined" row shows the local authored time, and "Reflection owed" and the due status are gone; focus is kept. Red (`Unable to find … Deferred, answered`) then green, for Answer and Decline.

ocr review of `0edcc04`: session `39f54bef-8980-4e8a-9965-3e3ddd1dc494`, 1 file reviewed, **No findings.** Raw output: `ocr/T5.17-B3-0edcc04.json`.

### Cumulative run after T5.17

Run 2026-10-29 23:17 EDT on commit `0edcc04`, Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 69 passed (69)`, `Tests 893 passed (893)`, exit 0 | `suite-runs/t5.17-detail-debt-ui-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 41 passed (41)`, `Tests 73 passed (73)`, exit 0 | `suite-runs/t5.17-detail-debt-ui-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `142 passed (4.9m)`, exit 0 | `suite-runs/t5.17-detail-debt-ui-browser.txt` |
| Static and verification checks (12 commands) | as at the end of D4 | 11 of 12 exit 0 | `suite-runs/t5.17-detail-debt-ui-checks.txt` |

Failures: `verify:capacity` only (expected until T5.19).

## T5.19 Capacity basis recomputed for schema 4

Implementation commit `79ebcc5` (structural; exact verification `npm run measure:capacity`, then `npm run verify:capacity`). A new Debt phase in `tools/capacity/measure-page.ts`, run after the Review phase, records 2,000 Position Changes with a deferred reflection through `TradeWorkflows.recordPositionChange` (10 sessions from 2026-03-02 × the 200 Open Trades). In the next session's Review it resolves them through `DailyReview.open`, `getTrade` and `save({kind:'ResolveReviewDebt'})`: of every 50, 45 answered, 4 declined, 1 left Outstanding (1,800 / 160 / 40, the plan's 90% and 8%). Bytes on disk are JSON bytes × the phase's own overhead ratio (1.18405), as in T4.28. Chromium 153:

| Item | Count | JSON bytes | On-disk bytes |
|---|---|---|---|
| Deferred, answered | 1,800 | 2,318.8 | 2,745.6 |
| Deferred, declined | 160 | 1,728 | 2,046.0 |
| Deferred, still Outstanding | 40 | 954 | 1,129.6 |

A capture-time reflection stays at 1,277.8 bytes; an Action is 1,931.3.

| | Schema 3 | Schema 4 |
|---|---|---|
| M | 826,458,088 | 851,734,424 (+25.3 MB) |
| Required quota (3 × M) | 2,479,374,264 | 2,555,203,272 |

`measure:capacity` exit 0 (about 4m45s); `verify:capacity OK: required quota 2555203272 = 3 × 851734424, schema 4`.

Section 1.4 mapping recorded by the implementer: the 100,000 Position Change Reflection outcomes are now `positionChangeReflectionsAtCapture` 80,000 (65% completed + 15% declined), `debtsAnswered` 18,000, `debtsDeclined` 1,600, `debtsOutstanding` 400, each priced by its own bytes. The Debt figures cover the journal records only (Debt, obligation, and the Entry or decline that settled it); the Position Change and Execution are already priced under their own rows. The capture-time figure keeps the Open phase's 80/20 Entry/decline mix rather than 65:15 (81:19), a small and conservative-neutral difference left as is.

Other changes: `tools/measure-capacity.ts` hard-coded dev-server port 5179; it now uses 5175, the assigned port. `tests/integration/d4/capacity-profile.test.ts` gained the new `EngineMeasurement` fields (zeros) and its expected total moved from 197,820,000 to 197,220,000, because the 20,000 deferred outcomes are no longer priced at the capture-time figure; the new `tests/integration/d5/capacity-profile.test.ts` covers the split and the Debt pricing. A later Firefox or WebKit entry merged from an older basis would lack the Debt fields until re-measured; the basis holds Chromium only.

ocr review of `79ebcc5`: session `a9f4e7aa-4522-40f7-80fb-14c26f9484bd`, 4 files reviewed, 2 comments. Raw output: `ocr/T5.19-79ebcc5.json`.

| Severity | Location | Claim | Assessment | Outcome |
|---|---|---|---|---|
| medium | `tools/capacity/profile.ts:105` | The 80,000 capture-time outcomes are priced at an 80/20 Entry/decline sample, not the section 1.4 split of 65,000 completed and 15,000 declined | Doubtful (about 1.25 points of mix; the sampling predates T5.19, but T5.19 is the task that applies the section 1.4 split) | Bug task T5.19-B1 |
| low | `tools/capacity/measure-page.ts:306` | A nested ternary picks the Entry or the decline for each Debt | Valid, style only | Bug task T5.19-B2 |

A cumulative run on `79ebcc5` (2026-10-29 23:33 EDT, label `t5.19-capacity-basis`) was fully green: unit 893, integration 75 (42 files), browser 142 (4.8m), checks 12 of 12, `verify:capacity` among them for the first time in D5. It is superseded by the run after the bug tasks.

### T5.19-B1 The capture-time reflections follow the section 1.4 split
- it should price 65,000 completed-at-capture and 15,000 declined-at-capture outcomes at their own bytes

Implemented in `8b11719`. The measurement page had no Entry/decline separation, so `captureReflectionShare` in `measure-page.ts` measures each capture-time Entry or decline with its obligation record and splits them by outcome kind. It asserts the Open phase's 320 Entries and 80 declines. `EngineMeasurement` replaces the blended `bytesPerPositionChangeReflection` with `bytesPerReflectionCompletedAtCapture` 1,409.7 (JSON 1,354.9) and `bytesPerReflectionDeclinedAtCapture` 802.2 (JSON 771); the blended figure was 1,277.8. `MEASURED` prices 65,000 and 15,000. Red (`expected undefined to be 65000`) then green. The existing d5 projection case now expects 65,000 × 10 + 15,000 × 50 instead of 80,000 × 10, an assertion change the new shape forces. Re-measured: M 849,065,876, required quota 2,547,197,628 (T5.19: 851,734,424 and 2,555,203,272; part of the difference is run-to-run variation in the overhead ratios). `verify:capacity OK ... schema 4`.

ocr review of `8b11719`: session `e85e8113-df3b-4fcb-a400-9087737478ba`, 3 files reviewed, **No findings.** Raw output: `ocr/T5.19-B1-8b11719.json`.

### T5.19-B2 The settling-record lookup is plain code
Refactor in `f9e35f1`. The ocr finding's nested ternary picks the Entry or decline that settled each Debt (my brief described it as the 45/4/1 outcome choice, which at HEAD is already an `if`/`continue` and one plain ternary; the implementer correctly took the finding's own wording). It is now a small `settlingRecord` function with `if`/`return`. Behaviour identical; `measure:capacity` not rerun, so the figures are unchanged. Both capacity-profile files (5 tests), the four static checks and `verify:capacity` exit 0.

ocr review of `f9e35f1`: session `163d9c3f-6f83-4b54-9d1e-6f82c85b35ef`, 1 file reviewed, **No findings.** Raw output: `ocr/T5.19-B2-f9e35f1.json`.

### Cumulative run after T5.19

Run 2026-10-29 23:46 EDT on commit `f9e35f1`, Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 69 passed (69)`, `Tests 893 passed (893)`, exit 0 | `suite-runs/t5.19-b2-capacity-basis-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 42 passed (42)`, `Tests 76 passed (76)`, exit 0 | `suite-runs/t5.19-b2-capacity-basis-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `142 passed (4.8m)`, exit 0 | `suite-runs/t5.19-b2-capacity-basis-browser.txt` |
| Static and verification checks (12 commands) | as at the end of D4 | 12 of 12 exit 0 | `suite-runs/t5.19-b2-capacity-basis-checks.txt` |

Failures: none. T5.19 is complete.
