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
