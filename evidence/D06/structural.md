# D6 structural verifications

Each entry records a structural task's exact verification (D6 breakdown, section 5), and each task ends with a complete cumulative suite run delegated to the `suite-runner` subagent, with full outputs in `suite-runs/`. Since decision 71 (P55) the browser stage after a task is `browser-auto <base>`, and each run records the tier it chose and why. Versions are in [provenance.md](provenance.md). Each task's `ocr-review` findings and bug tasks are recorded under the task's heading, with the raw outputs in `ocr/`.

## Start of D6

Location checks (D6 handoff, section 1) on 2026-11-01:
- worktree `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5`, branch `claude-opus-5.5`: matched.
- `git status -sb`: `## claude-opus-5.5...origin/claude-opus-5.5`, clean except the untracked `.claude/settings.json`. It shows no `[ahead N]` because the user has pushed since the handoff was written: `HEAD` and `origin/claude-opus-5.5` are both `1fb692dfd422242dda0184e36335e070607e0da9` (the retrospective's last commit, `docs(plan): D6 handoff after the prefactor retrospective`). The handoff allows this ("if the user has pushed since, N counts from that push").
- `git log --oneline claude-opus-5.5-pre-d6d..HEAD`: the seven prefactor-retrospective commits only, ending with `docs(plan): D6 handoff after the prefactor retrospective`. `git diff --stat claude-opus-5.5-pre-d6d HEAD -- src e2e package.json`: empty.
- tags `claude-opus-5.5-plan-r31`, `claude-opus-5.5-d5`, `claude-opus-5.5-d5r`, `claude-opus-5.5-d5r2`, `claude-opus-5.5-pre-d6d`: present. `git diff claude-opus-5.5-d5r2 claude-opus-5.5-pre-d6d -- src`: empty.
- `claude-opus-5.5-d5r2` is `765ac1ea59f36e7d9923362f655c94bbef90e404`, `claude-opus-5.5-d5r` is `72c742c1b6f393d432e533a7d65b84c45df933ff`, `claude-opus-5.5-d5` is `fbe3bb71dcc7114e7f0568272be48f0412cfeab8`.
- `DEV_PORT=5175`; Node v26.12.0.
- `npm ci`: exit 0. `npx vitest run src`: `Test Files 80 passed (80)`, `Tests 1051 passed (1051)`. `npx vitest run tests/integration`: `Test Files 60 passed (60)`, `Tests 117 passed (117)`.

Spec reading: `plan/spec-reading/D06.md`, as the handoff directs. No other spec section has been needed yet.

## T6.1 Trade Analysis: Sell replay, FIFO Lot Matches, fees, realized P&L

Base commit (for `browser-auto`): `1fb692dfd422242dda0184e36335e070607e0da9`.

Commit `30b20eb5` (T6.1, 5 cases red then green, no first-run pass).

### ocr review of `30b20eb5`

Session `a975500f-5c88-4ae8-8907-590deca5f919`, 3 files reviewed (`sell.test.ts` and `tdd-log.md` excluded), 3 comments. Raw output: [ocr/T6.1-30b20eb5.json](ocr/T6.1-30b20eb5.json).

| # | Severity | Location | Finding | Outcome |
|---|---|---|---|---|
| 1 | high | `derive.ts` `deviationsOf`, `legFulfillmentOf`, `entryWindowOf` | Every Execution's quantity counts as entered, so T-A after X1 counts 130 against 100 and expects a false Entry Size Excess of 30. | **Valid → bug task T6.1-B2.** No later planned case covers it (T6.3 owns only the window cut and the shortfall). |
| 2 | high | `derive.ts` 390–396, 689 | A Position of 0 still derives expected lifecycle Open. | **Covered by planned scope, not a bug task:** T6.2's first case ("expect Closed with terminal time Tuesday 14:00 … after X2") is this behavior's red. Listed for the final report. |
| 3 | medium | `derive.ts` 363 | A Sell beyond the open quantity drops its remainder silently and under-allocates its fee. | **Covered by planned scope, not a bug task:** T6.2's position-path cases (`ExceedsOpenQuantity`, `FlatBeforeLaterFacts`, P22) make such candidates typed rejections. T6.2's brief names the remainder. Listed for the final report. |

### T6.1-B1 Lot Match figures as Calculation Results

Found in T6.1's summary: `LotMatchResult`'s allocated opening fee, allocated disposal fee and realized amount were bare `Rational`s, where A78 says they are separate Calculation Results keyed to the match (and `specs/design/trade-analysis.md`, "Shared values"). Case: "should return each Lot Match's allocated opening fee, allocated disposal fee, and realized amount as Value calculation results, PC1 to X1 holding 1/2, 3/5 and 559/10 after X1". Commit `d78a0f02`: one invalid red (missing test helper, fixed and rerun), then a valid red and green. `realizedToDate` stays a `Rational` (T6.4 wraps realized-to-date in `evaluate`).

ocr review of `d78a0f02`: session `ae8a6afc-1d8a-431f-8b2c-78d29d48f96f`, 1 file reviewed, **no findings**. Raw output: [ocr/T6.1-B1-d78a0f02.json](ocr/T6.1-B1-d78a0f02.json).

### T6.1-B2 Sells are not entered quantity

From ocr finding 1. Case: "should count only Buy Executions as entered, so T-A after X1 and after X2 expects no Entry Size occurrence and Fulfillment FilledAsPlanned, with Entry Quality still resolved at PC2". Commit `3ccd80ce`: red (the false Excess occurrence), then green; no first-run pass. The fix filters `e.action === 'Buy'` in the three entered-quantity sums. Only `deviationsOf`'s filter is proven by this red: on T-A, fulfillment reaches plan at 100 or 130 alike, and the window resolves at PC2 before any Sell. T6.3's window-cut cases exercise `entryWindowOf`'s.

ocr review of `3ccd80ce`: session `1aa3a62f-6f24-4bd9-b838-f2997304a018`, 1 file reviewed, **no findings**. Raw output: [ocr/T6.1-B2-3ccd80ce.json](ocr/T6.1-B2-3ccd80ce.json). The reviewer noted that `entryWindowOf` still places a Sell inside the window (Buy 60, Sell 30, Buy 40 resolves at the third change); that is T6.3's planned cut (A82), not a defect here.

### Cumulative run after T6.1

Label `t6.1-fifo-lot-matches`, at `3ccd80ce` plus uncommitted evidence (2026-11-01 18:36 EST). Outputs in `suite-runs/t6.1-fifo-lot-matches-*.txt`.

| Suite | Result |
|---|---|
| Unit | 81 files, 1058 tests passed |
| Node integration | 60 files, 117 tests passed |
| Browser (Chromium) | **task tier**, printed reason "no changed path since 1fb692dfd422242dda0184e36335e070607e0da9 is on the full-tier list"; no `e2e/d6` yet, so only `@every-task`: 5 passed (9.9 s) |
| Static and verify checks | 12 of 12 exit 0 |

Ports 5175, 9341 and 9342 free before and after.

## T6.2 Trade Analysis: Closed lifecycle, Terminal Disposition, Realized R, close requirement, position paths

Base commit (for `browser-auto`): `3ccd80ce`.
