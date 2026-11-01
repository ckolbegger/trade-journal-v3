# D5R2 structural verifications

Each entry records a structural task's exact verification (D5R2 breakdown, section 5), and each task ends with a complete cumulative suite run delegated to the `suite-runner` subagent, with full outputs in `suite-runs/`. Versions are in [provenance.md](provenance.md). Each task's `ocr-review` findings and bug tasks are recorded under the task's heading, with the raw outputs in `ocr/`. The record of carried-over expected values (breakdown, sections 6.1 and 6.1a) is kept under the task that moves each case.

## Start of D5R2

Location checks (D5R2 handoff, section 1) on 2026-11-01:
- worktree `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5`, branch `claude-opus-5.5`: matched.
- `git status -sb`: `## claude-opus-5.5...origin/claude-opus-5.5`, clean except the untracked `.claude/settings.json`. The handoff expected `[ahead 175]`; the branch reads `ahead 0` because the remote was pushed to exactly the starting point (the remote-tracking reflog's latest entry is "update by push" to `75f7f18`). `HEAD`, `claude-opus-5.5-pre-d5r2` and `origin/claude-opus-5.5` are all `75f7f18cc8f9bb3862bdfd1f124ceb2316d60aa8`, so the check's purpose (no unexpected commits, no uncommitted changes) holds. Recorded as an open question for the final report.
- `git log --oneline claude-opus-5.5-pre-d5r2..HEAD`: empty.
- tags `claude-opus-5.5-plan-r28`, `claude-opus-5.5-d5r`, `claude-opus-5.5-pre-d5r2`: present. `claude-opus-5.5-d5r` is `72c742c1b6f393d432e533a7d65b84c45df933ff`.
- `DEV_PORT=5175`; Node v26.12.0.
- `npm ci`: exit 0. `npx vitest run src`: `Test Files 75 passed (75)`, `Tests 1011 passed (1011)`. `npx vitest run tests/integration`: `Test Files 60 passed (60)`, `Tests 117 passed (117)`.

Spec reading: `plan/spec-reading/D05.md` (with the glossary entry "Due Classification"), as the handoff directs. No other spec section has been needed yet.

## Setup: tdd.sh accepts any deliverable suffix

Change in `.claude/scripts/tdd.sh`: the task-ID pattern is now `^T([0-9]+)([A-Z][A-Z0-9]*)?\.` (a number, then an optional suffix of an upper-case letter followed by upper-case letters or digits). The log path is still `evidence/D%02d%s/tdd-log.md` from `$match[1]` and `$match[2]`; the latter is empty when the optional group does not match, so the `printf` is unchanged and `T<n>.<m>` IDs map as before. So `T5R2.1` logs to `evidence/D05R2/tdd-log.md`, `T6R.1` to `evidence/D06R/tdd-log.md`, `T5R.1` to `evidence/D05R/tdd-log.md`. The usage comment and the rejection message describe `T<n>.<m>` or `T<n><suffix>.<m>`. Each command was run on its own from the repository root, while `evidence/D05R2/tdd-log.md` did not exist, so nothing was appended anywhere.

1. `.claude/scripts/tdd.sh red T5R2.1 x y`
   - Output: `no log at evidence/D05R2/tdd-log.md: create it with its header note first`
   - Exit code: 2
2. `.claude/scripts/tdd.sh red T6R.1 x y`
   - Output: `no log at evidence/D06R/tdd-log.md: create it with its header note first`
   - Exit code: 2
3. `.claude/scripts/tdd.sh red T99.1 x y`
   - Output: `no log at evidence/D99/tdd-log.md: create it with its header note first`
   - Exit code: 2
4. `.claude/scripts/tdd.sh red X5.1 x y` (malformed ID, still rejected)
   - Output: `task must look like T<n>.<m> or T<n><suffix>.<m> (suffix: an upper-case letter, then upper-case letters or digits), got: X5.1`
   - Exit code: 2

The IDs `T1.`, `T2.`, `T4.`, `T5.` and `T5R.` were not run, because those deliverables' logs exist and a run would append to them. Their mappings (`T2.2` to `D02`, `T12.4` to `D12`, `T5.1` to `D05`, `T5R.1` to `D05R`) are checked by reading the diff: the `printf` format and arguments are untouched, and an unmatched optional group leaves `$match[2]` empty.

### ocr review of `9cbbe55`

Session `627f05e6-a2f0-498c-a593-8a0af9de999c`, 1 file reviewed, no findings. Raw output: [ocr/setup-9cbbe55.json](ocr/setup-9cbbe55.json). The change is tooling only (no product code or test changed since the start-of-D5R2 run), so no cumulative run follows it; T5R2.1's is the first.

## T5R2.1 Domain: due classification

Behavioral; red and green rows in `tdd-log.md`. Commit `9ebeb83`: `src/domain/journal-debt/index.ts` (`DueRule`, `DueClassification`, `SessionCloses`, `classifyDue` with its `undefined` overload) and `classify-due.test.ts` (4 cases). No first-run passes. Implementation decision: `SessionCloses` and the anchor use the repository's `Instant` (an ISO-8601 UTC string from `src/domain/time`), which is what Journal and the coordinators already hold; the comparison is done with `temporal-polyfill`'s `Temporal.Instant.compare`, as A166 asks.

### ocr review of `9ebeb83`

Session `e9ee2433-1568-4db6-a85f-a52d09c6556b`, 1 file reviewed (the test file excluded), no findings. Raw output: [ocr/T5R2.1-9ebeb83.json](ocr/T5R2.1-9ebeb83.json).

### Cumulative suite at `9ebeb83` (T5R2.1 closed)

Date 2026-11-01 06:32 EST. The working tree's only uncommitted changes were evidence files.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 76 passed (76)`, `Tests 1015 passed (1015)`, exit 0 | `suite-runs/t5r2-1-classify-due-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 60 passed (60)`, `Tests 117 passed (117)`, exit 0 | `suite-runs/t5r2-1-classify-due-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `179 passed (7.4m)`, exit 0 | `suite-runs/t5r2-1-classify-due-browser.txt` |
| Static and verification checks (12 commands) | typecheck, `tsc6 --noEmit`, lint, `lint:deps`, build, `verify:release`, `verify:capabilities`, `verify:releases`, `verify:no-fault-hooks`, `verify:capacity`, `verify:fixtures`, `verify:session-policy` | 12 of 12 exit 0 | `suite-runs/t5r2-1-classify-due-checks.txt` |

Ports 9341, 9342 and 5175 free before and after.

## T5R2.2 Journal imports the due rule

Type-only change (A166, P44). `dueRule: 'OneSessionGrace'` became `dueRule: DueRule` (type imported from `src/domain/journal-debt/index.ts`) at three declarations: `src/modules/journal/journal.ts` (the Debt shape) and `src/modules/journal/effects.ts` (two effect shapes). The stored value `dueRule: 'OneSessionGrace'` written into a new Debt in `journal.ts` is unchanged. `.dependency-cruiser.js` allows modules to import `src/domain` (`lint:deps` passes).

| Command | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run lint:deps` | exit 0, no dependency violations (243 modules) |
| `npm run verify:fixtures` | exit 0, workspace-v1 to v4 open Ready at schema 4, views equal |
| `npm run test:unit -- src/modules/journal` | exit 0, 7 files, 69 tests passed |
| `npx tsc6 --noEmit` | exit 0 |
| `npm run lint` | exit 0 |
| `rg "'OneSessionGrace'" src --glob '!*.test.*'` | only `src/domain/journal-debt/index.ts` (`export type DueRule`) and `src/modules/journal/journal.ts` (value in a new Debt); no type declaration remains |
| `git diff claude-opus-5.5-d5r -- tests/fixtures` | empty (0 lines) |

The breakdown's A166 counts "four places"; at `claude-opus-5.5-d5r` there are three type declarations (`journal.ts:162`, `effects.ts:155`, `effects.ts:249`) plus the stored value at `journal.ts:409`, which stays a literal. Checked by the main session with `git grep -n OneSessionGrace claude-opus-5.5-d5r -- src ':!*.test.*'`.

### ocr review of `451b093`

Session `7b9a23a1-e187-496f-920a-e0da745a331a`, 2 files reviewed, no findings. Raw output: [ocr/T5R2.2-451b093.json](ocr/T5R2.2-451b093.json).

### Cumulative suite at `451b093` (T5R2.2 closed)

Date 2026-11-01 06:43 EST. The working tree's only uncommitted changes were evidence files.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 76 passed (76)`, `Tests 1015 passed (1015)`, exit 0 | `suite-runs/t5r2-2-journal-due-rule-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 60 passed (60)`, `Tests 117 passed (117)`, exit 0 | `suite-runs/t5r2-2-journal-due-rule-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `179 passed (7.1m)`, exit 0 | `suite-runs/t5r2-2-journal-due-rule-browser.txt` |
| Static and verification checks (12 commands) | as at T5R2.1 | 12 of 12 exit 0 | `suite-runs/t5r2-2-journal-due-rule-checks.txt` |

Ports 9341, 9342 and 5175 free before and after.

## T5R2.3 Coordinators classify through the domain module

Change: Daily Review's two-way `dueDebtIds` (Due when `classifyDue(dueAnchor, {previousClose, close: cutoff}) === 'Due'`) and its three-way reflection classification, and Trade Views' `withDueStatus`, now call `classifyDue` from `src/domain/journal-debt`. Trade Views keeps decision 56 (no status without a frame) through the `undefined` overload: no `resolution` in the frame passes `undefined`, and the Debt carries no `dueStatus`. `ReflectionClassification` and `DebtDueStatus` are removed; `OwedReflection.classification` and `TradeDetailDebt.dueStatus` take `DueClassification`, re-exported from `src/app/types.ts` for the UI (`ReviewReflections.tsx`, `TradeDetail.test.tsx` switched). `DUE_TEXT` stays in place (T5R2.6). No expectation, e2e file, or fixture changed.

| Command | Result |
| --- | --- |
| `npm run test:unit -- src/coordinators` | 16 files, 198 tests passed, exit 0 |
| `npm run test:integration -- d5 d5r` | 19 files, 44 tests passed, exit 0 |
| `npm run test:unit -- src/ui` | 24 files, 410 tests passed, exit 0 |
| `rg 'dueAnchor' src/coordinators --glob '!*.test.*'` | three lines, all `classifyDue(...)` calls; no `Temporal.Instant.compare` |
| `rg 'Temporal.Instant.compare' src/coordinators --glob '!*.test.*'` | two lines, neither on a Debt due anchor: `attention.ts` (lastActivity ordering) and `daily-review.ts` (exposure close lookup) |
| `rg 'ReflectionClassification\|DebtDueStatus' src tests e2e` | no matches (exit 1) |
| `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` | all exit 0 |

### ocr review of `b7ea170`

Session `25e0c99f-cdcc-4df7-b07f-3ae186982052`, 7 files reviewed, no findings. Raw output: [ocr/T5R2.3-b7ea170.json](ocr/T5R2.3-b7ea170.json). The commit's one test-file change (`TradeDetail.test.tsx`) renames the imported type `DebtDueStatus` to `DueClassification`; no expectation changed (checked by the main session in `git show b7ea170 -- src/ui/screens/TradeDetail.test.tsx`).

### Cumulative suite at `b7ea170` (T5R2.3 closed)

Date 2026-11-01 06:55 EST. The working tree's only uncommitted changes were evidence files.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 76 passed (76)`, `Tests 1015 passed (1015)`, exit 0 | `suite-runs/t5r2-3-coordinators-classify-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 60 passed (60)`, `Tests 117 passed (117)`, exit 0 | `suite-runs/t5r2-3-coordinators-classify-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `179 passed (7.1m)`, exit 0 | `suite-runs/t5r2-3-coordinators-classify-browser.txt` |
| Static and verification checks (12 commands) | as at T5R2.1 | 12 of 12 exit 0 | `suite-runs/t5r2-3-coordinators-classify-checks.txt` |

Ports 9341, 9342 and 5175 free before and after.

## T5R2.4 Daily Review: card progress in `open`

Behavioral; rows in `tdd-log.md`. Commit `987f6d7`: `CardProgress` and `PanelProgress` (A164) in `src/coordinators/daily-review/types.ts`, re-exported through `src/app/types.ts`; `progress` on each `WalkedTrade` from `open`; five cases in `daily-review.test.ts`, describe "card progress in open (A164)". **First-run passes (flagged):** cases 2–5 passed on their first run because case 1's expected-progress table needs the whole computation. Each has a mutation check in `tdd-log.md` (shared-row membership by first Trade only; only `Available` counts as resolved; `owed` always true; Reflections always done), each failing with an assertion. Implementation notes: `assemble` reads `queryActions` earlier (same single read; the query-count case passes unchanged). `WalkedTrade.reflections` stays until T5R2.5. A test-only change: the getTrade case "should return the same attention reasons as the overview" strips `progress` from the overview item before comparing it with `trade.attention`, which has none; its expected values are unchanged. Four UI test fixtures gained `progress` through a new helper, `tests/support/card-progress.ts`, so they still type-check; no UI expectation or UI code changed.

### ocr review of `987f6d7`

Session `73653cea-8a30-4056-817d-ff6d66191c14`, 5 files reviewed (6 test files excluded), no findings. Raw output: [ocr/T5R2.4-987f6d7.json](ocr/T5R2.4-987f6d7.json).

### Cumulative suite at `987f6d7` (T5R2.4 closed)

Date 2026-11-01 07:09 EST. The working tree's only uncommitted changes were evidence files.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 76 passed (76)`, `Tests 1020 passed (1020)`, exit 0 | `suite-runs/t5r2-4-progress-open-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 60 passed (60)`, `Tests 117 passed (117)`, exit 0 | `suite-runs/t5r2-4-progress-open-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `179 passed (7.1m)`, exit 0 | `suite-runs/t5r2-4-progress-open-browser.txt` |
| Static and verification checks (12 commands) | as at T5R2.1 | 12 of 12 exit 0 | `suite-runs/t5r2-4-progress-open-checks.txt` |

Ports 9341, 9342 and 5175 free before and after.

## T5R2.5 Daily Review: card progress in `getTrade` and every save result

Behavioral; rows in `tdd-log.md`. Commit `509f582`: `DailyTradeReview.progress`; `PostSaveReview.cards` (`{ tradeId, progress }[]`, the saved Trade after `SaveTradeAction`, the Debt's Trade after `ResolveReviewDebt` when walked; none for `ChangedDuringAssembly`); `PostMarksReview.trades` and `trade` carry progress; `WalkedTrade.reflections` and `ReflectionCounts` removed (A167). A shared internal `cardProgress(marks, reflections, owed)` serves `assemble` and `assembleTrade`. The post-save assemblies still call `assemble(..., withGaps = false)`; `d5r/query-count` passes unchanged.

**First-run passes (flagged):** cases 3, 4 and 5 passed on their first run: cases 3 and 4 share `postSaveReview` with case 2, and case 5's `PostMarksReview.trades` already carried T5R2.4's progress. Mutation checks in `tdd-log.md` (`cards` built from the other walked Trades: `TypeError`; Reflections `later` plus one; Marks `resolved` plus one: assertion failures). The invalid red rows that `tdd.sh` wrote for them (exit 0) stay in the log above their notes.

**Readers of the removed field** (A167 named the bench generator and `resolve-debt.test.ts`): also `reflections.test.ts` and six D5 integration files (`migration`, `query-count`, `resolve`, `review-debt`, `review`, `write-gate`). They read the Reflections panel through a test helper, `tests/support/reflection-counts.ts`, with unchanged expected values. The bench generator reads the panel's `dueNow`; its dataset and version are unchanged. UI test fixtures only dropped `reflections` and gained `progress` and `cards: []`; no UI expectation changed.

**Decision (user, 2026-11-01): the frozen v4 views and the removed field.** `tests/fixtures/workspace-v4/expected-views.json` holds `reflections` on every walked item, and D4 A51 requires the migrated views to equal the snapshot on every field it contains, while A167 removes the field and A168 changes no fixture. The subagent left every fixture unchanged (`git diff claude-opus-5.5-d5r -- tests/fixtures` empty) and added `withWalkedReflections` to `tools/verify-fixtures.ts`, which states the old `reflections: { due, later }` from the Reflections panel's `dueNow` and `later` before the comparison, so the same frozen counts are still checked against the new code. The main session asked the user, recommending this over keeping the field (against A167) or refreezing the fixture (against A51, a plan revision). **The user chose to keep the mapping.** It is an implementation note under A51, not a plan revision.

### ocr review of `509f582`

Session `c81d70b2-7c2b-4202-ad86-76a4f3a00aff`, 7 files reviewed, 1 finding. Raw output: [ocr/T5R2.5-509f582.json](ocr/T5R2.5-509f582.json).

| Severity | Category | Location | Claim | Assessment |
|---|---|---|---|---|
| medium | test | `tools/verify-fixtures.ts:64` | `?? 0` on the panel's `dueNow` and `later` lets a Reflections panel with missing counts pass `debtViolations`. | Valid, low impact: the check before T5R2.5 treated missing counts as a violation. |

### T5R2.5-B1 The fixture mapping keeps missing counts missing

- **Finding:** ocr's finding above.
- **Defect:** for a migrated pre-schema-4 Workspace, a walked item whose Reflections panel lacks `dueNow` or `later` is stated as `{ due: 0, later: 0 }`, so `debtViolations` reports it Debt-free where the old check flagged the missing count.
- **Case:** it should report a migrated Workspace's walked item as a Debt violation when its Reflections panel carries no `dueNow` or `later` count.

### Cumulative suite at `509f582`

Date 2026-11-01 07:28 EST. The working tree's only uncommitted changes were evidence files. T5R2.5 closes after T5R2.5-B1.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 76 passed (76)`, `Tests 1025 passed (1025)`, exit 0 | `suite-runs/t5r2-5-progress-saves-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 60 passed (60)`, `Tests 117 passed (117)`, exit 0 | `suite-runs/t5r2-5-progress-saves-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `179 passed (7.1m)`, exit 0 | `suite-runs/t5r2-5-progress-saves-browser.txt` |
| Static and verification checks (12 commands) | as at T5R2.1 | 12 of 12 exit 0 | `suite-runs/t5r2-5-progress-saves-checks.txt` |

Ports 9341, 9342 and 5175 free before and after.

## T5R2.5-B1 The fixture mapping keeps missing counts missing — verification

Seam: `withWalkedReflections` and `debtViolations` moved unchanged into `tools/fixture-views.ts` (imported by `tools/verify-fixtures.ts`), tested in `tools/fixture-views.test.ts`. `tools/` was in no vitest include, so `tools/**/*.test.ts` was added to the `unit` project in `vite.config.ts`. Fix: the panel's `dueNow` and `later` are no longer defaulted to 0, so a missing count stays `undefined` and `debtViolations` reports it.

| Command | Result |
|---|---|
| `npm run verify:fixtures` | exit 0; workspace-v1, v2, v3 migrated to 4, v4 opened without migration, all four "views equal" |
| `git diff claude-opus-5.5-d5r -- tests/fixtures` | empty |
| `npm run test:unit -- tools` | `Tests 1 passed (1)` |
| `npm run typecheck` | exit 0 |
| `npx tsc6 --noEmit` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run lint:deps` | exit 0 |

Main-session notes on T5R2.5-B1: the subagent appended its two evidence rows with `cat >>` heredocs, a slip against the Edit-only rule (content checked, correct). The new test lives in `tools/fixture-views.test.ts`, which `npm run test:unit` reaches (`vite.config.ts` adds `tools/**/*.test.ts` to the unit project) but the cumulative suite's `npx vitest run src` does not.

### ocr review of `dc004c4`

Session `c3e6814e-59e7-4f3b-8d29-efd0df73b9d6`, 3 files reviewed, no findings. Raw output: [ocr/T5R2.5-B1-dc004c4.json](ocr/T5R2.5-B1-dc004c4.json).

### Cumulative suite at `dc004c4`

Date 2026-11-01 07:39 EST. The working tree's only uncommitted changes were evidence files.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 1 failed, 75 passed (76)`, `Tests 1 failed, 1024 passed (1025)`, exit 1 | `suite-runs/t5r2-5-b1-fixture-mapping-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 60 passed (60)`, `Tests 117 passed (117)`, exit 0 | `suite-runs/t5r2-5-b1-fixture-mapping-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `179 passed (7.1m)`, exit 0 | `suite-runs/t5r2-5-b1-fixture-mapping-browser.txt` |
| Static and verification checks (12 commands) | as at T5R2.1 | 12 of 12 exit 0 | `suite-runs/t5r2-5-b1-fixture-mapping-checks.txt` |

**F1, the one unit failure:** `src/ui/screens/ReviewCards.test.tsx:607`, "links (A161) > should open the first card holding XYZ in attention order on its Marks panel, with focus on XYZ row, for /review?instrument=XYZ" (`AssertionError: expected false to be true`, the XYZ Mark region lookup). The commit changes no UI code (`tools/` and `vite.config.ts` only). Reproduction by the main session: the case alone passed (`npx vitest run src/ui/screens/ReviewCards.test.tsx -t "should open the first card holding XYZ in attention order on its Marks panel"`, 1 passed); its file passed (41 of 41); then `npx vitest run src` twice in a row passed both times (`Tests 1025 passed (1025)`). Treated as intermittent under the full run's load, not a defect of `dc004c4`. It passed in all five earlier D5R2 cumulative runs. If it recurs, it becomes a stability task like D5R's B4.13-F1. T5R2.5 is closed; T5R2.6's cumulative run covers this commit's code.

## T5R2.6 One due formatter

Change: new `src/ui/due-text.ts` exports `DUE_TEXT: Record<DueClassification, string>` (same keys and strings as before). `src/ui/screens/ReviewReflections.tsx` no longer defines it and imports it from `../due-text.ts`; `src/ui/screens/OwedDebtItem.tsx` imports it from `../due-text.ts` and nothing from `ReviewReflections.tsx`. No test, e2e or visible-text change.

| Command | Result |
|---|---|
| `npm run test:unit -- src/ui` | `Test Files 24 passed (24)`, `Tests 410 passed (410)`, exit 0 (no test changed) |
| `rg 'DUE_TEXT' src/ui` | defined only at `src/ui/due-text.ts:4`; the other hits are the two imports and the two uses |
| `rg "ReviewReflections" src/ui/screens/OwedDebtItem.tsx` | no match, exit 1 |
| `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` | each exit 0 |

### ocr review of `753bca9`

Session `93767b47-acb2-4f7a-88fe-86eafa152fa3`, 3 files reviewed, no findings. Raw output: [ocr/T5R2.6-753bca9.json](ocr/T5R2.6-753bca9.json).

### Cumulative suite at `753bca9` (T5R2.6 closed)

Date 2026-11-01 07:50 EST. The working tree's only uncommitted changes were evidence files. This run also covers T5R2.5-B1's code; F1 did not recur.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 76 passed (76)`, `Tests 1025 passed (1025)`, exit 0 | `suite-runs/t5r2-6-due-text-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 60 passed (60)`, `Tests 117 passed (117)`, exit 0 | `suite-runs/t5r2-6-due-text-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `179 passed (7.1m)`, exit 0 | `suite-runs/t5r2-6-due-text-browser.txt` |
| Static and verification checks (12 commands) | as at T5R2.1 | 12 of 12 exit 0 | `suite-runs/t5r2-6-due-text-checks.txt` |

Ports 9341, 9342 and 5175 free before and after.

## T5R2.7 UI: the held-Review module — carried values

Section 6.1a's mounted cases whose folding moves, each with its expected values and the table case in `src/ui/screens/held-review.test.ts` that now carries them. T5R2.8 and T5R2.9 remove the mounted cases; T5R2.7 removed none. The table cases use a miniature of the card fixture (T-A and T-F hold XYZ, T-A from Friday 2026-10-09 and T-F from Monday; T-C holds DEF), the shape `CardMarks.test.tsx` builds.

| Mounted case today | Expected values it checks | Carried by |
|---|---|---|
| `ReviewView.test.tsx`, "should keep an earlier-session Mark saved resolution when the Review re-renders without a newer revision" | DEF's Friday 2026-10-09 session saved at "$9.00" (Available, revision 1) with the Review not read; a second `open` lists the same date at revision `None`; the card still shows "$9.00", and a Correct sends `expectedResolutionRevision: 1`. | `standing`, third case: after `MarksSaved` (ChangedDuringAssembly) `standing` of XYZ Friday is Available "9" at revision 1; after an `Opened` Review listing the date Missing at revision `None`, it is still that standing. |
| `CardMarks.test.tsx`, "should send an earlier-session draft with the resolution and revision of the newest Review after Refresh, not those of the first snapshot" (standing part) | The first snapshot lists XYZ Friday as Missing at `None`; a refreshed Review lists it Acknowledged Unavailable at revision 4; the next save binds `expectedRevision: 4`. | `standing`, third case: after `Opened` listing XYZ Friday acknowledged at revision 4, `standing` is Acknowledged Unavailable at revision 4 (and the Review's at an equal revision 1). The mounted case stays for the entry it sends. |
| `ReviewCards.test.tsx`, "should open the first card in the Review order whose Trade is in the Mark row" | Row Trades `t-e`, `t-a`; the XYZ card (T-A, earlier in attention order than T-E) opens and no other. | `nextCard`, first case: row Trades `t-f`, `t-a` over the held order T-A, T-F, T-C gives `{ kind: 'Mark', tradeId: 't-a', instrumentKey: 'DEF' }`, the held order and not the row order choosing the card. |
| `ReviewCards.test.tsx`, "should keep the old behaviour when none of the row Trades is in the Review" | Row Trade `t-zzz`; the status reads "A Mark is needed before the next Trade. It is listed in its card." and no card opens. | `nextCard`, second case: row Trade `t-zzz` gives `{ kind: 'MarkNotHeld' }`. The message and the closed cards stay in the view (A173). |
| `ReviewView.test.tsx`, "should keep an earlier session listed with its saved Mark while the card stays open ..." and "should keep a value typed into a Mark entry ..."; `CardMarks.test.tsx`, "should keep an earlier session saved Mark when the trader pages away and back" | Rendering continuity and drafts. | Stay mounted (section 6.1a). The saved date leaving the gap list and its revision are in `fold`, fourth case: Friday leaves `missing`, `revisions` holds 1; a newly acknowledged date stays listed as acknowledged with its acknowledgment; a previously acknowledged date saved with an exact Mark leaves `acknowledged`. |

Plain-data cases for the fold and standing logic that the mounted cases exercise only through the screen: `fold` case 1 (new Trade order from `Opened`), 2 (Ready `ActionSaved` and `DebtResolved` replace completion and binding, ChangedDuringAssembly leaves the Review), 3 (saved key on its Review-date row, Manual task cleared, Trades, completion and binding replaced), 5 (ChangedDuringAssembly applies the saved keys only); `standing` case 1 (`MarkSaved`, `MarksConflict` moved keys: Available "33.10" at 1, Available "9" at 4); `marksOf` (T-A: XYZ row and Friday; T-F: XYZ row, no Friday).

### ocr review of `7359c21`

Session `d8033828-061d-4baa-aa58-6332892285ea`, 1 file reviewed, 2 findings. Raw output: [ocr/T5R2.7-7359c21.json](ocr/T5R2.7-7359c21.json). Main-session notes on the task: fold case 5 first passed because its `ChangedDuringAssembly` branch had been written with case 3; the subagent backed it out to a genuine red and restored it (a correction, not a first-run pass). The table cases use a small fixture built from the UI shapes (`CardMarks.test.tsx`, `cardProgress`), not the stack-backed `cardFixture`.

| Severity | Category | Location | Claim | Assessment |
|---|---|---|---|---|
| medium | bug | `src/ui/screens/held-review.ts:61` | `learn` overwrites a key's learned standing with whatever result arrives last, so a late `MarksConflict` at revision 1 replaces a `MarkSaved` at revision 2. | Doubtful, with a failure scenario: a Save Marks request in flight returns its `Conflict` after a per-row save of the same key has been folded. A172 says a key's revision never moves backward. Becomes T5R2.7-B1. |
| medium | bug | `src/ui/screens/held-review.ts:156` | A saved earlier session that resolves as `Missing` (a withdrawn acknowledgment) is dropped from both gap lists until the next `open`. | **Dismissed (Wrong as a defect of this task):** `ReviewView.withSavedMarks` at `claude-opus-5.5-d5r` does the same (it filters the saved dates out of `missing` and re-adds only `AcknowledgedUnavailable` ones; `ReviewView.tsx` lines 242–250), and A172 says "a saved earlier session leaves its gap list, and an acknowledged one stays". While the card is open, `CardMarks` keeps its list of earlier sessions as the card opened (A172), so the row stays visible there. Changing it would be a visible change, against D5R2's refactor rule. Listed for the final report. |

### T5R2.7-B1 A learned standing never moves backward

- **Finding:** ocr's first finding above.
- **Defect:** `learn` replaces a key's learned standing unconditionally, so a result carrying an older revision (a late `MarksConflict`, or a `MarksSaved` after a newer `MarkSaved`) moves the key's standing back, and `standing(held, key)` then returns the older resolution and revision (A172).
- **Case:** it should keep a key's learned standing when a later MarksConflict or MarksSaved reports it at a lower revision, and take the newer one at the same or a higher revision.

### Cumulative suite at `7359c21`

Date 2026-11-01 08:05 EST. The working tree's only uncommitted changes were evidence files. T5R2.7 closes after T5R2.7-B1.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 77 passed (77)`, `Tests 1037 passed (1037)`, exit 0 | `suite-runs/t5r2-7-held-review-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 60 passed (60)`, `Tests 117 passed (117)`, exit 0 | `suite-runs/t5r2-7-held-review-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `179 passed (7.1m)`, exit 0 | `suite-runs/t5r2-7-held-review-browser.txt` |
| Static and verification checks (12 commands) | as at T5R2.1 | 12 of 12 exit 0 | `suite-runs/t5r2-7-held-review-checks.txt` |

Ports 9341, 9342 and 5175 free before and after.

### T5R2.7-B1 result

Commit `bfc250a`: `learn` keeps a key's learned standing unless the incoming revision is at least as new (A172). One case in `held-review.test.ts`, describe "standing (A172)", red (`expected { resolution, revision: 1 } to deeply equal { resolution, revision: 2 }`) then green; the file's 13 cases pass. No first-run passes.

### ocr review of `bfc250a`

Session `b55b8037-a698-4420-8568-0e66b2970b2c`, 1 file reviewed, no findings. Raw output: [ocr/T5R2.7-B1-bfc250a.json](ocr/T5R2.7-B1-bfc250a.json).

### Cumulative suite at `bfc250a` (T5R2.7 closed)

Date 2026-11-01 08:15 EST. The working tree's only uncommitted changes were evidence files.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 77 passed (77)`, `Tests 1038 passed (1038)`, exit 0 | `suite-runs/t5r2-7-b1-standing-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 60 passed (60)`, `Tests 117 passed (117)`, exit 0 | `suite-runs/t5r2-7-b1-standing-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `179 passed (7.1m)`, exit 0 | `suite-runs/t5r2-7-b1-standing-browser.txt` |
| Static and verification checks (12 commands) | as at T5R2.1 | 12 of 12 exit 0 | `suite-runs/t5r2-7-b1-standing-checks.txt` |

Ports 9341, 9342 and 5175 free before and after.

## T5R2.8 ReviewView folds every result through the module

`ReviewView.tsx` now holds a `Held` (`{ review, standings }`) in state and in the `latest` ref. One `apply(result: HeldResult)` calls `fold`. `saved` applies `ActionSaved` (also on the unsaved-draft branch) and acts on `nextCard` (the `flushSync` Mark-card branch, scrolling and focus stay in the view); `reflectionResolved` applies `DebtResolved`; `marksSaved` applies `MarksSaved` once (the walked-Trade re-sort is in `fold`); `refreshTrade` applies `Opened`. `withSavedMarks` and the local `marksOf` are removed; the cards and `linkedCard` use the module's `marksOf`. The requests, shared in-flight `reopen`, opening counter, unsaved-state guards, after-save messages and effects stay.

### Removed mounted cases

Both in `src/ui/screens/ReviewCards.test.tsx`; carried by `src/ui/screens/held-review.test.ts`, describe "nextCard (P50)".

| Case removed | Expected values | Carried by |
|---|---|---|
| "should open the first card in the Review order whose Trade is in the Mark row" | Row Trades `t-e`, `t-a`; the XYZ card (T-A, earlier in attention order than T-E) opens and no other. | `nextCard`, first case: row Trades `t-f`, `t-a` over held order T-A, T-F, T-C gives `{ kind: 'Mark', tradeId: 't-a', instrumentKey: 'DEF' }`. |
| "should keep the old behaviour when none of the row Trades is in the Review" | Row Trade `t-zzz`; status reads "A Mark is needed before the next Trade. It is listed in its card." and no card opens. | `nextCard`, second case: row Trade `t-zzz` gives `{ kind: 'MarkNotHeld' }`. The message and closed cards stay in the view (it maps `MarkNotHeld` to the message and `collapse()`). |

Left for T5R2.9 (they depend on `CardMarks`' own `standings`, which T5R2.9 removes): `ReviewView.test.tsx` "should keep an earlier-session Mark saved resolution when the Review re-renders without a newer revision" and `CardMarks.test.tsx` "should send an earlier-session draft with the resolution and revision of the newest Review after Refresh ...". The three rendering-continuity cases of section 6.1a stay mounted.

### Verification (each on its own)

| Command | Result |
|---|---|
| `npm run test:unit -- src/ui` | `Test Files 25 passed (25)`, `Tests 421 passed (421)`, exit 0 (every remaining mounted case unchanged) |
| `npm run typecheck` | exit 0 |
| `rg 'withSavedMarks\|function marksOf' src/ui/screens/ReviewView.tsx` | no matches, exit 1 |
| `rg -n 'fold\(\|apply\(\|nextCard\(\|marksOf\(' src/ui/screens/ReviewView.tsx` | `apply` (which calls `fold`, line 221) is called for `Opened` (293, refreshTrade), `ActionSaved` (318, 330, `saved`), `DebtResolved` (355, `reflectionResolved`), `MarksSaved` (417, `marksSaved`); `nextCard(latest.current, post.nextStep)` at 332 in `saved`; `marksOf(heldReview, ...)` at 192 and 461 |
| `npx vitest run tests/integration/d5r` | `Test Files 7 passed (7)`, `Tests 12 passed (12)`, exit 0 |
| `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` | each exit 0 |

### ocr review of `74a1ca2`

Session `442faf74-be0b-4de7-9508-e8716bbadefb`, 1 file reviewed, no findings. Raw output: [ocr/T5R2.8-74a1ca2.json](ocr/T5R2.8-74a1ca2.json).

### Cumulative suite at `74a1ca2` (T5R2.8 closed)

Date 2026-11-01 08:30 EST. The working tree's only uncommitted changes were evidence files. The unit count falls by 2 (1038 to 1036): the two mounted cases removed above.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 77 passed (77)`, `Tests 1036 passed (1036)`, exit 0 | `suite-runs/t5r2-8-reviewview-fold-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 60 passed (60)`, `Tests 117 passed (117)`, exit 0 | `suite-runs/t5r2-8-reviewview-fold-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `179 passed (7.1m)`, exit 0 | `suite-runs/t5r2-8-reviewview-fold-browser.txt` |
| Static and verification checks (12 commands) | as at T5R2.1 | 12 of 12 exit 0 | `suite-runs/t5r2-8-reviewview-fold-checks.txt` |

Ports 9341, 9342 and 5175 free before and after.

## T5R2.9 CardMarks reads standings from the held Review

`CardMarks` no longer holds `standings`, `setStanding` or its own `Standing`/`rank`. It takes `held: Held` and `onResult: (result: HeldResult) => void` (passed down from `ReadyReview` through `ReviewCard` and `CardBody`; `held` is `heldReview`, `onResult` is the single `apply`). Each row's resolution and revision, and each Save Marks entry's `expectedRevision`, come from `standing(held, key) ?? listed` (the fallback is the row's listed values when the Review knows nothing of the key). A per-row Correct or Withdraw calls `onResult({ kind: 'MarkSaved', ... })`; a Save Marks `Conflict` calls `onResult({ kind: 'MarksConflict', moved })`, with each moved key taken from the sent entry at `entryIndex`. A `MarksSaved` result needs no call from `CardMarks`: `ReviewView.saveMarks` already folds it, and `fold` records its standings. `CardMarks` now imports `CardMarkRows` and `GapGroup` from `held-review.ts` (its own duplicates are gone; `ReviewCard` imports `CardMarkRows` from there too). The `opened` earlier list stays (A172: rendering). No progress wording, nothing under `e2e/`.

One module change: `HeldResult`'s `MarkSaved` and `MovedKey` now type `resolutionRevision` as `ExpectedResolutionRevision` (the type `MarkEntry` and the Conflict result carry), and `learn` compares with `rank(...)`. For numeric revisions the comparison is the same as before.

### Removed mounted case

`ReviewView.test.tsx`, "should keep an earlier-session Mark saved resolution when the Review re-renders without a newer revision". Carried by `held-review.test.ts`, describe "standing (A172)", third case ("should keep the learned standing when a later Opened Review lists the key at a lower revision ...").

| Mounted value | Carried by |
|---|---|
| DEF, Friday 2026-10-09, saved "9" through Save Marks at revision 1 (key left the gap list); a re-read lists it as missing at revision `None`; the row still shows `$9.00` and a Correct sends `expectedResolutionRevision: 1`. | Third `standing` case: XYZ, Friday, saved `available('9')` at revision 1, then `Opened` listing it missing at `None`: `standing` is `{ resolution: available('9'), revision: 1 }`. Listed at 4 or at 1 (acknowledged): the Review's standing wins. |

Kept unchanged, as the plan says: `CardMarks.test.tsx` "should send an earlier-session draft with the resolution and revision of the newest Review after Refresh, not those of the first snapshot" (its entry still sends `expectedRevision: 4`). Its standing part is carried by the same third `standing` case (listed at 4 beats the learned revision). The three rendering-continuity cases stay mounted, unchanged. No harness change was needed: every mounted case renders through `ReviewView`.

### Verification (each on its own)

| Command | Result |
|---|---|
| `npm run test:unit -- src/ui` | `Test Files 25 passed (25)`, `Tests 420 passed (420)` (421 less the one removed case), exit 0 |
| `npm run typecheck` | exit 0 |
| `rg 'standings\|setStanding' src/ui/screens/CardMarks.tsx` | no matches, exit 1 |
| `rg -n 'heldStanding\(\|standing\(\|onResult\(' src/ui/screens/CardMarks.tsx` | row standing: line 129 (`panel.standing(...)`, defined at 294 as `heldStanding(heldReview, key) ?? listed`); Save Marks entry expected revision: line 319 (`standing(...).revision`); per-row save folds `MarkSaved`: line 131; Save Marks Conflict folds `MarksConflict`: line 343 |
| `npx vitest run tests/integration/d5r` | `Test Files 7 passed (7)`, `Tests 12 passed (12)`, exit 0 |
| `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` | each exit 0 |

### ocr review of `7818001`

Session `628f3ba6-32af-4673-b71f-03d7ca9c377c`, 4 files reviewed, no findings. Raw output: [ocr/T5R2.9-7818001.json](ocr/T5R2.9-7818001.json). Main-session note: the subagent also widened `held-review.ts`'s `MarkSaved` and `MovedKey` revision to `ExpectedResolutionRevision` (`'None' | number`), comparing with `rank`; numeric behaviour unchanged.

### Cumulative suite at `7818001` (T5R2.9 closed)

Date 2026-11-01 08:42 EST. The working tree's only uncommitted changes were evidence files. The unit count falls by 1 (the mounted case removed above).

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 77 passed (77)`, `Tests 1035 passed (1035)`, exit 0 | `suite-runs/t5r2-9-cardmarks-standing-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 60 passed (60)`, `Tests 117 passed (117)`, exit 0 | `suite-runs/t5r2-9-cardmarks-standing-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `179 passed (7.1m)`, exit 0 | `suite-runs/t5r2-9-cardmarks-standing-browser.txt` |
| Static and verification checks (12 commands) | as at T5R2.1 | 12 of 12 exit 0 | `suite-runs/t5r2-9-cardmarks-standing-checks.txt` |

Ports 9341, 9342 and 5175 free before and after. The runner reported a stray zsh busy-loop (PID 46576, from an earlier D5 command on `evidence/D05/suite-runs`), not started by this session; left alone and reported to the user.

## T5R2.10 Cards and panels word the progress record — carried values

Section 6.1 of the breakdown, case by case. Apart from P46, no value is dropped. Every kept mounted case keeps its expected values and is fed progress by its fixture (the double's `cardProgress`, section 6.3).

| Case removed or replaced | Its expected values | Carried by |
|---|---|---|
| `ReviewCards.test.tsx`, "should show Done and Action saved on a card whose Marks are resolved, with no due reflection and a saved Action" | JKL (T-E) reads "Done · Action saved"; it keeps its place at index 4; no other header contains "Done" | `card header from progress (A169)`, "should read 2 Marks · 1 reflection due · Action for progress with 2 Marks needed, 1 reflection due now and the Action owed, and Done · Action saved for a done card, with no other input to the header": the same three expectations on T-E, whose progress is done while the completion still names its Action. The case adds DEF at "2 Marks · 1 reflection due · Action". The Done rule itself is T5R2.4's fourth case. |
| `ReviewCards.test.tsx`, "should render one card per walked Trade in attention order …" (stays) | ABC "Review ABC Action"; DEF "1 Mark · Action"; XYZ (T-A) "1 reflection due · Action" | Stays mounted; its fixture now gives T-C the progress of 1 Mark needed (the table's T-C row) and T-A 1 due now and 1 later. Values unchanged. |
| `ReviewCards.test.tsx`, "should open the first card that is not Done when the Review loads …" (stays) | ABC opens first with only getTrade for it; with every card Done none opens and getTrade is not called | Stays mounted; the "every card Done" half now gives every walked Trade done progress instead of a Complete completion. Values unchanged. The new case "should open on load the first card whose progress is not done" adds the disagreeing double. |
| `ReviewCard.test.tsx`, "should count the Marks that are done in the Marks panel summary, reading 1 of 2 with 1 needed after one of two Marks is saved, and 2 of 2 with Saved when both are" | "0 of 2 for Mon Oct 12" with "2 needed"; after the first save "1 of 2 for Mon Oct 12" with "1 needed"; after the second "2 of 2 for Mon Oct 12" with "Saved" | `panel headers from progress (A169)`, "should read the Marks panel as 1 of 2 for Mon Oct 12 with 1 needed, and 2 of 2 with Saved once its progress has none needed": the same five strings, from progress {0,2}, {1,1}, {2,0} on the walked Trades of the save results. The counting is T5R2.4 and T5R2.5. |
| `ReviewCard.test.tsx`, "should count only the reflections still owed in the Reflections panel summary, reading 1 owed, 0 due now and Not due after the due one of two is answered, and None owed and Resolved once both are" (D5R T5R.16-B4) | "2 owed, 1 due now"; then "1 owed, 0 due now" with "Not due"; then "None owed" with **"Resolved"** | `progress from save results (A165, P46)`, "should show the progress the Debt resolution result carries, None owed and None once the card last reflection is answered, with no reload": the same first four strings from the Debt resolutions' `cards`; the last expectation changes from "Resolved" to **"None"** (P46, the one sanctioned change), and the case asserts "Resolved" is absent. `panel headers from progress`, "should read the Reflections panel as 2 owed, 1 due now with 1 due, 1 owed, 0 due now with Not due, and None owed with None", also carries the three summaries and statuses. |
| `ReviewCard.test.tsx`, "should show Marks, Reflections, and Action panels in that order …" (stays) | Marks "0 of 2 for Mon Oct 12 · 1 earlier optional" with "2 needed"; Reflections "2 owed, 1 due now" with "1 due"; Action "Hold, Exit, Roll or Adjust" with "Needed"; open panels [Marks]; "None" on Reflections for a card that owes none | Stays mounted; `owingReview` now gives T-1 the progress of 2 Marks needed, 1 due now and 1 later. Values unchanged ("1 earlier optional" is still the length of the earlier rows listed, P49). |
| `ReviewCard.test.tsx`, "moving on", "moving on from Reflections", "moving on from the panel that finished" (stay) | Panel order Marks, Reflections, Action; the card named by the next step opens | Stay mounted; the walked Trades and save results carry the progress the panels move on (`cards`, `trades`). Values unchanged. |
| (new, no removed case) `held-review.test.ts`, "fold with progress" | An ActionSaved or DebtResolved Review's `cards` replace the held Trade's progress; other Trades and an unheld Trade are untouched | A165, A171. |

### T5R2.10 main-session notes

Commit `2439bcb`. All nine cases red then green, except **"progress from save results", the SaveTradeAction header case: a first-run pass, flagged** (built by the header case and the fold-with-progress case; mutation: `fold`'s `progressOf.get(t.tradeId)` replaced by a lookup that never matches; failure `AssertionError: expected 'Review XYZ Action Routine' to contain 'Done · Action saved'`). The Marks panel case's first green run failed on a test mistake (it read the rows before opening the panel), fixed in the test and rerun green. `rg 'remainingOf|isOwing|resolvedDebts|onDebtResolved|interface Remaining' src/ui` finds nothing; `git diff claude-opus-5.5-d5r -- e2e` is empty. The one sanctioned expectation change, "Resolved" to "None" (P46), is the only changed value; no `e2e/` file contains "Resolved".
- **Slip:** the subagent edited `CardMarks.test.tsx` once with a Python replace script (two replacements), against the Edit-only rule; the result matches what Edit would produce.
- **Implementation notes:** the Action panel's status reads `owed` from the progress record while its summary text still comes from the form (the saved Action's name, or "Hold, Exit, Roll or Adjust"); the subagent judged the gap between the two unobservable. The Marks "Saved" status keys on the record's `resolved + needed > 0`. Mounted fixtures now give each Trade progress consistent with its rows and reasons. The critic brief asks C5R.2 to look at the Action panel right after a save.

### ocr review of `2439bcb`

Session `50ceb0a1-8688-44e0-aee4-ce19e0729c88`, 5 files reviewed (7 test files excluded), no findings. Raw output: [ocr/T5R2.10-2439bcb.json](ocr/T5R2.10-2439bcb.json).

### Cumulative suite at `2439bcb` (T5R2.10 closed)

Date 2026-11-01 09:07 EST. The working tree's only uncommitted changes were evidence files.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 77 passed (77)`, `Tests 1041 passed (1041)`, exit 0 | `suite-runs/t5r2-10-progress-wording-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 60 passed (60)`, `Tests 117 passed (117)`, exit 0 | `suite-runs/t5r2-10-progress-wording-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `179 passed (7.5m)`, exit 0 | `suite-runs/t5r2-10-progress-wording-browser.txt` |
| Static and verification checks (12 commands) | as at T5R2.1 | 12 of 12 exit 0 | `suite-runs/t5r2-10-progress-wording-checks.txt` |

Ports 9341, 9342 and 5175 free before and after.

## T5R2.11 Journal: applyPreparedEffects binds its counter

Commit `ca04024`. `applyPreparedEffects` now requires `journalUnchanged(prepared.snapshot.journalRevision)` beside its counter write (ADR 0011: every write that advances a shared counter binds it). `save` drops its own copy of the check, and its counter-only retry recognizes the binding through the new export `isJournalCounterBinding`. New file `counter-binding.test.ts`, 3 cases. **Case 2, "should commit a prepared effect when no Journal write …", was a first-run pass, flagged** (mutation: the counter write `journalRevision + 1` became `+ 2`; failure `expected 5 to be 4`). Case 3's code was written ahead of its red by the first subagent, then reverted and given a genuine red.

- **Implementation decision (recommended and applied):** three existing cases apply one prepared effect twice and expect the uniqueness backstop's `ConstraintViolation`. With the binding, the second commit fails `journal@<n>` first, because checks run before writes. Each case keeps its expected values: only the second apply's input changes, to the same prepared effect with `snapshot.journalRevision` advanced by one, with a comment saying why. The cases are `daily-trade-review.test.ts`, "should return Conflict when the expected Entry revision is stale, and fail the transaction on a second new Entry for the same key"; `journal.test.ts`, "should fail the transaction when a Plan Reflection already exists for the same obligation key"; and `position-change-reflection.test.ts`, "should stage the Debt … fail the transaction when the key already has an outcome". Re-preparing was rejected because a fresh prepare gives a new Entry id, which moves the violation to `journalObligations` and changes the expected `store`.
- **Slip:** the second subagent made the three test edits with a Python script, against the Edit-only rule. The diff is those three inputs plus comments.

### ocr review of `ca04024`

Session `4847c15b-e225-4ccb-86a8-94873864a505`, 2 files reviewed (test files skipped), no findings. Raw output: [ocr/T5R2.11.json](ocr/T5R2.11.json).

### Cumulative suite at `ca04024` (T5R2.11 closed)

Date 2026-11-01 09:23 EST. The only untracked file was `.claude/settings.json`.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 78 passed (78)`, `Tests 1044 passed (1044)`, exit 0 | `suite-runs/T5R2.11-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 60 passed (60)`, `Tests 117 passed (117)`, exit 0 | `suite-runs/T5R2.11-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `179 passed (7.3m)`, exit 0 | `suite-runs/T5R2.11-browser.txt` |
| Static and verification checks (12 commands) | as at T5R2.1 | 12 of 12 exit 0 | `suite-runs/T5R2.11-checks.txt` |

## T5R2.12 Trade Workflows: retry a counter-only conflict

Commit `93dce82`. New helper `retryCounterConflict` in `src/coordinators/trade-workflows/counter-retry.ts` reruns a whole attempt (reads, preparation, commit) while the result is a `Conflict` whose only changed binding satisfies `isJournalCounterBinding`, up to 3 attempts in all (ADR 0011, A175), mirroring `Journal.save`. `recordPositionChange`'s old body is the private `attemptPositionChange`, wrapped by the helper; `confirmPlan` is wrapped inside its guard. A Trade or catalog binding conflict is returned at once; the existing D2 and D5 Conflict cases pass unchanged. New file `counter-conflict.test.ts`, 3 cases: cases 1 and 2 red (`expected 'Conflict' to be 'Recorded'` / `'Confirmed'`), then green after fixing two wrong counts in the tests themselves. **Case 3, "should return Conflict and write nothing when a Journal write lands before each of its three attempts", was a first-run pass, flagged** (mutation: `MAX_ATTEMPTS` 3 → 4; failure `expected { kind: 'Recorded', … } to deeply equal { kind: 'Conflict', … }`).
- **Slip:** the subagent appended two tdd-log rows with a heredoc and `echo >>` (evidence only; source and tests through Edit/Write).

### ocr review of `93dce82`

Session `fde8b206-32ff-4c0f-bb8b-f140938b1a61`, 3 files reviewed (test files skipped), no findings. Raw output: [ocr/T5R2.12.json](ocr/T5R2.12.json).

### Cumulative suite at `93dce82`: one intermittent unit failure (F2)

Date 2026-11-01 09:38 EST. Unit 1046 of 1047 (`ReviewCards.test.tsx` > "card-top scroll once the body shows (T5R.15-B1-B1)" > "should scroll the card top at the press and again once the body shows, for a plain header open": `expected [ { block: 'start' } ] to deeply equal [ { block: 'start' }, …(1) ]`); integration 117 of 117; browser 179 of 179; checks 12 of 12. Outputs `suite-runs/T5R2.12-*.txt`. The file passed 3 of 3 alone.

### F2 the card-top scroll case waits for the second scroll

Commit `479f8fb`, test only. Cause confirmed: `ReviewCard.tsx:87` scrolls at the press; `ReviewCard.tsx:100` scrolls again only once `bodyShown`, which can land a render after `findByRole('region', { name: 'XYZ review' })` resolves. The final assertion is now inside `waitFor`, with the same expected value. Mutation: line 100 commented out fails the case with the same assertion; restored. The file passed 40 of 40 five times. Not ocr-reviewed: ocr skips test files, so the commit has nothing for it to review. F1 (`ReviewCards.test.tsx:607`) left alone: no evidence its form renders asynchronously; if it recurs, a `findByRole` there is the likely fix.

### Cumulative suite at `479f8fb` (T5R2.12 closed)

Date 2026-11-01 09:48 EST.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 79 passed (79)`, `Tests 1047 passed (1047)`, exit 0 | `suite-runs/T5R2.12-F2-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 60 passed (60)`, `Tests 117 passed (117)`, exit 0 | `suite-runs/T5R2.12-F2-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `179 passed (7.2m)`, exit 0 | `suite-runs/T5R2.12-F2-browser.txt` |
| Static and verification checks (12 commands) | as at T5R2.1 | 12 of 12 exit 0 | `suite-runs/T5R2.12-F2-checks.txt` |

## T5R2.13 Daily Review drops its counter copies

Commit `1d48c14`. The two `journal@<revision>` requires in `daily-review.ts` (the Action save and the Debt resolution) are removed, since `applyPreparedEffects` stages the binding (A174, T5R2.11). The Action save's comment now says Journal binds the counter; the Retry-on-Conflict and `continue` behaviour is untouched. Verification as the plan states it: `npm run test:unit -- src/coordinators/daily-review` 6 files, 104 tests passed; `npm run test:integration -- d4 d5 d5r` 39 files, 68 tests passed; `rg 'journal@' src --glob '!*.test.*'` finds only `src/modules/journal/journal.ts:60` (the binding name) and `:70` (`isJournalCounterBinding`). No existing case changed.

### ocr review of `1d48c14`

Session `cdfc7f65-c116-468c-8774-e2d09eb3a053`, 1 file reviewed, no findings. Raw output: [ocr/T5R2.13.json](ocr/T5R2.13.json).

### Cumulative suite at `1d48c14` (T5R2.13 closed)

Date 2026-11-01 10:00 EST.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 79 passed (79)`, `Tests 1047 passed (1047)`, exit 0 | `suite-runs/T5R2.13-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 60 passed (60)`, `Tests 117 passed (117)`, exit 0 | `suite-runs/T5R2.13-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `179 passed (7.2m)`, exit 0 | `suite-runs/T5R2.13-browser.txt` |
| Static and verification checks (12 commands) | as at T5R2.1 | 12 of 12 exit 0 | `suite-runs/T5R2.13-checks.txt` |

Ports 9341, 9342 and 5175 free afterwards. The runner left three polling shells of its own (`pgrep -f full-suite.sh` loops, from this session's suite runs); the main session stopped them.

## T5R2.14 Market Data: Review frames carry an evidence binding

Commit `981e4fc`. The `Frames` result gains `evidenceBinding: EvidenceBinding` (`readonly BoundKey[]`, with `BoundKey { instrumentKey; tradingDate; resolutionRevision }` internal): per requested Instrument its Review-date key at the revision read (`None` when no record exists), plus the Stale-context source key at its revision when the frame selected one, all from `ResolveFrames`' existing read transaction (A176). `MarketData.bindEvidence(tx, evidenceBinding)` stages one require per key, named `mark:<instrument>@<date>`, store `observations`, key `[tradingDate, instrumentKey]`, verify `(current?.['resolutionRevision'] ?? 'None') === resolutionRevision` (Daily Review's rule). It is on the `MarketData` interface, like `prepareEffects`, not on the facade; `verify:capabilities` reports 19 operations. New file `evidence-binding.test.ts`, 4 cases. Case 1 red (`TypeError: marketData.bindEvidence is not a function`), then green.
- **Slip, flagged: code ahead of red.** The subagent wrote the whole implementation after case 1's red, so **cases 2–4 were first-run passes**. Each got a mutation check, restored exactly: case 2, the Review-date revision bound as `1` (failure: `expected { kind: 'Committed', … } to deeply equal { kind: 'Conflict', … }`); case 3, the Stale-context key dropped (same failure); case 4, an extra ABC key bound as `None` (`expected 'Conflict' to be 'Committed'`). Accepted without a redo, because each mutation removes exactly the code its case depends on and gives the same evidence a genuine red would.
- **Implementation decisions:** the Stale-context lookup is split into `staleSourceOf` (context plus the source's revision), with `staleContextOf` kept as a thin wrapper for its two other callers; `evidenceBinding` is on the `Frames` variant for every context, since `frameResult` is shared (`SnapshotChanged` and `recover` do not carry it); the evidence digest is unchanged; tech debt item 1 is unchanged.
- **Note:** the case names drop the plan's possessive apostrophes ("the frames evidence", "the XYZ Review-date Mark", "the DEF Review date", "the DEF frame") for `-t` filtering, as earlier tasks' names do. A no-op `python3` heredoc ran once and wrote no file.

### ocr review of `981e4fc`

Session `c4093c28-f23f-4551-b111-21e64d36bd14`, 2 files reviewed, no findings. Raw output: [ocr/T5R2.14.json](ocr/T5R2.14.json).

### Cumulative suite at `981e4fc` (T5R2.14 closed)

Date 2026-11-01 10:14 EST.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 80 passed (80)`, `Tests 1051 passed (1051)`, exit 0 | `suite-runs/T5R2.14-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 60 passed (60)`, `Tests 117 passed (117)`, exit 0 | `suite-runs/T5R2.14-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `179 passed (7.3m)`, exit 0 | `suite-runs/T5R2.14-browser.txt` |
| Static and verification checks (12 commands) | as at T5R2.1 | 12 of 12 exit 0 | `suite-runs/T5R2.14-checks.txt` |

## T5R2.15 Daily Review binds evidence through Market Data

Commit `3cdf1f2`. `checkBinding` drops its `readSnapshot(['observations'])` block, its `IDBKeyRange` Stale-context lookup and the "Read before the frames" comment; `Checked` carries `evidenceBinding` from the frames it already reads, and `attemptSave` stages it with `deps.marketData.bindEvidence(tx, checked.evidenceBinding)` (A176, P54). No test double changed (they spread `stack.marketData`). Verification as the plan states it: `npm run test:unit -- src/coordinators/daily-review` 6 files, 104 passed; `npm run test:integration -- d4 d5 d5r` 39 files, 68 passed, including the AC-REV-005 cases (`ReviewChanged`, nothing written). No existing case changed.

- **The `rg` check, scoped to Daily Review (user decision, 2026-11-01).** The plan's literal `rg "'observations'|IDBKeyRange" src/coordinators` cannot find nothing: it still matches `src/coordinators/workspace/workspace.ts:186–188` (the D5 schema-4 migration's read, present at `claude-opus-5.5-d5r`) and test files (`daily-review/save-marks.test.ts`, `workspace/migration.test.ts`), none of them in the task's scope. The plan's module table states the rule for Daily Review ("no counter copies and no `observations` reads"). The user approved recording this one-time check scoped to Daily Review, with no plan revision: `rg "'observations'|IDBKeyRange" src/coordinators/daily-review --glob '!*.test.*'` finds nothing (exit 1).
- **Read-only transactions before the Action save's commit: 3 at `981e4fc`, 2 at `3cdf1f2`, one fewer as the plan requires.** Measured with a throwaway test (deleted, not committed): the five-Trade fixture at Monday 17:00, the Review opened and `getTrade` called for trade A, then a counting wrapper around `persistence.readSnapshot` and `commit` passed to `createDailyReview`, and one `SaveTradeAction` (Hold) with nothing changed; `readSnapshot` calls counted up to the first `commit` (result `Saved`, one commit).

### ocr review of `3cdf1f2`

Session `2c626634-471a-434a-901e-7dbf33715962`, 1 file reviewed, no findings. Raw output: [ocr/T5R2.15.json](ocr/T5R2.15.json).

### Cumulative suite at `3cdf1f2`: one browser worker hang

Date 2026-11-01 10:46 EST. Unit 1051 of 1051; integration 117 of 117; checks 12 of 12; browser 178 of 179: `e2e/d2/ui-alignment.spec.ts:578` "T2.40 Trades tables > should pin Underlying, keep Underlying and Trade in view and show each figure once in both tables at 1280" hit the 30 s test timeout, followed by "Worker teardown timeout of 30000ms exceeded" (the worker's 74th test; run 8.3 min against the usual 7.2). Outputs `suite-runs/T5R2.15-*.txt`. T5R2.15 touches no Trades-table code. Run alone three times by the main session, all three viewports passed each time (9 of 9).

### Cumulative suite at `3cdf1f2`, rerun (T5R2.15 closed)

Date 2026-11-01 10:57 EST. The worker hang did not recur.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 80 passed (80)`, `Tests 1051 passed (1051)`, exit 0 | `suite-runs/T5R2.15-rerun-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 60 passed (60)`, `Tests 117 passed (117)`, exit 0 | `suite-runs/T5R2.15-rerun-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `179 passed (7.3m)`, exit 0 | `suite-runs/T5R2.15-rerun-browser.txt` |
| Static and verification checks (12 commands) | as at T5R2.1 | 12 of 12 exit 0 | `suite-runs/T5R2.15-rerun-checks.txt` |

The first runner left one self-matching `pgrep -f full-suite.sh` polling loop; the main session stopped it.

## T5R2.16 Query count and benchmark

Commit `ccff276`. `npm run test:integration -- d5r/query-count` passed unchanged (1 file, 3 tests; `suite-runs/T5R2.16-query-count.txt`): progress adds no request (A168). `npm run build:bench && npm run bench:run` passed on its fourth attempt, with `.cache/bench/profile` reused on every attempt (never regenerated) and every comparison equal; full results in [bench.md](bench.md), raw output `suite-runs/T5R2.16-bench.txt`.

- **Implementation decision (recommended and applied): the bench harness reads the Review's full Trade names.** Since D5R's T5R.15-I4 (`095e325`, inside `claude-opus-5.5-d5r`, after D5R's bench run of 2026-10-31), the Review names a Trade in full, e.g. "QAJ (Long 120 shares @ $300.97)" (A150). `tools/bench-run.ts` still expected the bare symbol in three places: the due-reflection comparison (now keyed on the underlying before " ("), `cardOf`'s region lookup (now `^SYMBOL(?: \(.*\))? review$`), and the in-page card selector of the save timings (now `aria-label^="SYM "` and `$=" review"`). Expected values (`bench/dataset.json`, `bench/expected-open-rows.json`) are unchanged; no `src/` or `e2e/` change. The first three attempts failed on these, one each (`suite-runs/T5R2.16-bench-first.txt`, `-second.txt`, `-third.txt`). Every other Trade-name selector in the harness was audited and is current. D5R2 changed no label: this is D5R's harness gap.
- `evidence/D05R/bench.md`, which `bench:run` overwrites, was restored unchanged.
- **Slip:** the subagent committed before its tdd-log row applied, then amended the local commit (nothing pushed).

| Measure | D5R | D5R2 |
|---|---|---|
| Cold start p95 (budget 2,500 ms) | 101.8 ms | 96.2 ms |
| Warm Planned-to-Open p95 (budget 1,500 ms) | 44.3 ms | 47.3 ms |
| Open first card, median / p95 | 1854.8 / 1895.4 ms | 1828.6 / 1869.0 ms |
| Save Marks, median / p95 | 79.8 / 81.3 ms | 82.8 / 85.5 ms |
| Trade Action save, median / p95 | 90.0 / 90.5 ms | 85.0 / 85.2 ms |

### ocr review of `ccff276`

Session `2fb1d585-a6d0-4cbc-869a-11a5f5c2999f`, 1 file reviewed, no findings. Raw output: [ocr/T5R2.16.json](ocr/T5R2.16.json).

### Cumulative suite at `ccff276` (T5R2.16 closed)

Date 2026-11-01 11:16 EST. `bench:run` was not running.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 80 passed (80)`, `Tests 1051 passed (1051)`, exit 0 | `suite-runs/T5R2.16-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 60 passed (60)`, `Tests 117 passed (117)`, exit 0 | `suite-runs/T5R2.16-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `179 passed (7.4m)`, exit 0 | `suite-runs/T5R2.16-browser.txt` |
| Static and verification checks (12 commands) | as at T5R2.1 | 12 of 12 exit 0 | `suite-runs/T5R2.16-checks.txt` |

The runner left two self-matching polling loops; the main session stopped them.

## T5R2.17 Node integration suite

At `ccff276` (no code commit follows it): `npm run test:integration` (`vitest run --project integration`), `Test Files 60 passed (60)`, `Tests 117 passed (117)`, exit 0 (`suite-runs/T5R2.17-integration.txt`). Every case in sections 6.1 of D1, D2, D4, D5 and D5R passes.

## T5R2.18 Browser suite

At `ccff276`: `npm run test:e2e` (Chromium), 179 passed, exit 0 (the T5R2.16 cumulative run, `suite-runs/T5R2.16-browser.txt`; no code change since). `git diff claude-opus-5.5-d5r -- e2e` is empty (0 bytes) (P47). AC-REV-002 and AC-REV-006 re-proved by those cases.
