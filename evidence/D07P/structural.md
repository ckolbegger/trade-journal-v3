# D7 prefactor structural verifications

Each entry records a structural task's exact verification (D7 prefactor breakdown, section 4), and each task ends with a complete cumulative suite run delegated to the `suite-runner` subagent, with full outputs in `suite-runs/`. Versions are in [provenance.md](provenance.md). Each task's `ocr-review` findings and bug tasks are recorded under the task's heading, with the raw outputs in `ocr/`.

## Start of the D7 prefactor

Location checks (prefactor handoff, section 1) on 2026-11-04:
- worktree `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5`, branch `claude-opus-5.5`: matched.
- `git status -sb`: `## claude-opus-5.5...origin/claude-opus-5.5 [ahead 2]`, clean except the untracked `.claude/settings.json`.
- `git log --oneline claude-opus-5.5-pre-d7p..HEAD`: empty. `HEAD` is `89e545b`.
- tags `claude-opus-5.5-plan-r42`, `claude-opus-5.5-d6`, `claude-opus-5.5-pre-d7p`: present. `claude-opus-5.5-d6` is `e10d55a225d19d70c5cb5923d6f45e0cb93b5a1b`.
- `git diff claude-opus-5.5-d6 -- src e2e tests tools`: empty.
- `DEV_PORT=5175`; Node v26.12.0.
- `npm ci`: exit 0. `npx vitest run src`: `Test Files 94 passed (94)`, `Tests 1188 passed (1188)`. `npx vitest run tests/integration`: `Test Files 76 passed (76)`, `Tests 154 passed (154)`.

Spec reading (decision 45, A181, scoped): `specs/glossary.md` "Market observations and valuation" (S251); ADR 0007 (S085); `specs/design/trade-analysis.md` "Shared values", `derive`, `evaluate` (S164, S166, S167); `specs/design/daily-review.md` "Date, eligibility, and ordering", `open`, "Completion and resumption" (S090, S091, S096); `specs/design/trade-views-and-reporting.md` `browseTrades`, `getTradeDetail` (S188, S189); `specs/design/ui-contract.md` "Trade and Journal presentation", "Numbers, availability, and graphs" (S211, S212); `specs/design/overview.md` "Calculation availability" (S137); acceptance rows AC-CALC-002, AC-LIFE-003, AC-REV-002, AC-REV-006, AC-UI-001, AC-UI-002, AC-RESP-001 (S051, S016, S039, S043, S074, S075, S011). No other spec section has been needed yet.

## T7P.1 The Calculation Result module and the reason unions

- `npm run typecheck`: exit 0. `npx tsc6 --noEmit`: exit 0. `npm run lint`: exit 0. `npm run lint:deps`: exit 0 (no dependency violations, 276 modules). `npx vitest run src/domain`: exit 0, 14 files, 151 tests.
- `npm run verify:fixtures`: exit 0 (workspace-v1 to v5, views equal). `npx vitest run src tests/integration`: exit 0, 170 files, 1342 tests.
- `git diff claude-opus-5.5-pre-d7p -- src/persistence`: empty. Fixture diff: `tests/fixtures/workspace-v5/expected-views.json` only.
- Snapshot shapes changed (decision 78), `workspace-v5/expected-views.json`, two `netCost` entries (next to `lastActivity` 2026-10-20T15:00:00Z and 2026-10-19T15:00:00Z): `"reason": "NoOpenQuantity"` to `"reason": "NoRemainingPosition"`.
- Case changed: `src/domain/trade-analysis/net-cost.test.ts`, name and expectation `reason: 'NoOpenQuantity'` to `reason: 'NoRemainingPosition'`.
- Temporary Unavailable form: `src/domain/calculation-result/index.ts` keeps `{ kind: 'Unavailable', reason, detail: UnavailableDetail }`; `UnavailableReason` lists today's five codes as reason-only cases. T7P.4 adds each case's fields, removes `detail` and `UnavailableDetail`.
- `NotApplicable` is flat: `{ kind: 'NotApplicable' } & NotApplicableReason` case.

### Cumulative run after T7P.1 (`t7p-1-calculation-result`, at `536616d6`)

Run by `suite-runner` on 2026-11-04, browser stage `browser-auto 6b39c035` (the commit T7P.1 started from; the handoff's section 7 named the setup commit `72ad430a`, and the commits between are plan-only, so the tier is the same).

| Suite | Result | Output |
|---|---|---|
| Unit | 94 files, 1188 passed, exit 0 | `suite-runs/t7p-1-calculation-result-unit.txt` |
| Node integration | 76 files, 154 passed, exit 0 | `suite-runs/t7p-1-calculation-result-integration.txt` |
| Browser (Chromium), task tier | 5 passed (10.9 s), exit 0 | `suite-runs/t7p-1-calculation-result-browser.txt` |
| Static and verification checks | 12 of 12 exit 0 | `suite-runs/t7p-1-calculation-result-checks.txt` |

Tier: task, printed reason "browser tier: task (no changed path since 6b39c035 is on the full-tier list)". The breakdown's section 2 expected the full tier for T7P.1; the commit touched no P55 path (no `src/ui/` file needed a change, since nothing there branched on `NoOpenQuantity`), so `browser-auto` chose the task tier, as decision 71 prescribes. No `e2e/d7p` folder exists yet, so only the `@every-task` call ran. Ports 5175, 9341, 9342 free before and after.

### ocr review of `536616d6`

Not yet run: the first attempt failed before reviewing, with `ChatGPT OAuth request failed: status=400 code=invalid_grant` (expired `ocr` sign-in). Waiting for the user to sign in again (`ocr auth login`).

Rerun on 2026-11-05 after the user signed in again: session `43bb23fe-33e5-4e50-aef7-020599e47c86`, model gpt-6.1-sol, 6 files reviewed in place (test files excluded), **no findings**. Raw output: [ocr/T7P.1-536616d6.json](ocr/T7P.1-536616d6.json). T7P.1 is complete.

## T7P.2 Domain: the Instrument module

Behavioral; commit `c240a6db`. 2 cases red then green (`tdd-log.md`); no first-run pass. `src/domain/instrument/` exports `Instrument` (Stock only), `instrumentKey` and `instrumentOf`. `calculation-result` now imports `Instrument` type-only for its temporary `UnavailableDetail`; `lint:deps` needed no new rule.

### ocr review of `c240a6db`

Session `c4a65bc5-501c-4e84-ab75-17945007526d`, model gpt-6.1-sol, 2 files reviewed in place (the test file excluded), **no findings**. Raw output: [ocr/T7P.2-c240a6db.json](ocr/T7P.2-c240a6db.json).

### Cumulative run after T7P.2 (`t7p-2-instrument`, at `882ff8ae`)

| Suite | Result | Output |
|---|---|---|
| Unit | 95 files, 1190 passed, exit 0 | `suite-runs/t7p-2-instrument-unit.txt` |
| Node integration | 76 files, 154 passed, exit 0 | `suite-runs/t7p-2-instrument-integration.txt` |
| Browser (Chromium), task tier | 5 passed (11.3 s), exit 0 | `suite-runs/t7p-2-instrument-browser.txt` |
| Static and verification checks | 12 of 12 exit 0 | `suite-runs/t7p-2-instrument-checks.txt` |

Stage `browser-auto 7e13d28b`; tier: task, printed reason "browser tier: task (no changed path since 7e13d28b is on the full-tier list)". Ports free before and after.

## T7P.3 Domain: self-describing findings

Behavioral; commit `763e5353`. 4 cases red then green (`tdd-log.md`, new `src/domain/trade-analysis/findings.test.ts`); no first-run pass. `IncoherentFact` stays in `derive.ts` (re-exported from `trade-analysis`): an Execution finding carries `factId`, `kind: 'Execution'`, `instrument` (`ExecutionFact['instrument']`, structurally `Instrument`), `economicTime` (Instant), `side`, `quantity` (the recorded decimal string, since a nonpositive quantity may not parse as a positive Rational) and `reason`; `ExceedsOpenQuantity` keeps `available` (Rational); a Position Change duplicate is `{ factId, kind: 'PositionChange', economicTime, reason: 'DuplicateFactId' }`.

Existing cases changed by added fields only, no value changes (A185): `closed.test.ts`, `replay.test.ts`, `record-position-change.test.ts` (lines 340, 849), `src/modules/trade-record/section.test.ts`, `tests/integration/d2/integrity-incoherent.test.ts` (line 62); type-only literals in `closed-views.test.ts`, `PositionChangeForm.test.tsx` and `TradeDetail.test.tsx`. No `expected-views.json` changed (added fields pass the snapshot rule).

### ocr review of `763e5353`

Session `1a867925-2eae-4eb8-ab10-befaef5a465a`, model gpt-6.1-sol, 1 file reviewed in place (`derive.ts`; 10 test and evidence files excluded), **no findings**. Raw output: [ocr/T7P.3-763e5353.json](ocr/T7P.3-763e5353.json).

### Cumulative run after T7P.3 (`t7p-3-findings`, at `763e5353`)

| Suite | Result | Output |
|---|---|---|
| Unit | 96 files, 1194 passed, exit 0 | `suite-runs/t7p-3-findings-unit.txt` |
| Node integration | 76 files, 154 passed, exit 0 | `suite-runs/t7p-3-findings-integration.txt` |
| Browser (Chromium), full tier | 163 passed (7.7 min), exit 0 | `suite-runs/t7p-3-findings-browser.txt` |
| Static and verification checks | 12 of 12 exit 0 | `suite-runs/t7p-3-findings-checks.txt` |

Stage `browser-auto a50ae8d8`; tier: full, printed reason "first matching path since a50ae8d8: src/ui/screens/PositionChangeForm.test.tsx". Ports free before and after.

## T7P.4 Trade Analysis and Trade Views return the typed reasons

Structural. `UnavailableReason` in `src/domain/calculation-result/index.ts` is now section 1.3's union, carried flat (`{ kind: 'Unavailable' } & U`): `MarkMissing`, `AcknowledgedUnavailable`, `SessionPolicyNotCovered` with `instrument: Instrument` and `date`; `AwaitingClose` with `after`; `FactsIncoherent` with `findings: readonly IncoherentFact[]`. `UnavailableDetail` is deleted. `IncoherentFact` and `ExecutionDescription` moved into `calculation-result` (a type import from `trade-analysis` would be a cycle) and `trade-analysis` re-exports them; a finding's instrument is `Instrument`. `evaluate` returns `{ reason, instrument, date }` and `{ reason: 'AwaitingClose', after }`. Trade Views' `IncoherentFactFinding` is removed; `IncoherentTradeDetail.findings` is `readonly IncoherentFact[]`.

| Command | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npx tsc6 --noEmit` | exit 0 |
| `npx vitest run src/domain src/coordinators/trade-views` | 22 files, 202 passed, exit 0 |
| `npm run test:integration` | 76 files, 154 passed, exit 0 |
| `npx vitest run src` | 96 files, 1194 passed, exit 0 |
| `npm run verify:fixtures` | exit 0, views equal for v1 to v5 |
| `npm run lint` / `npm run lint:deps` | exit 0 / exit 0 |
| `git diff claude-opus-5.5-pre-d7p -- src/persistence` | empty; no `dump.json` changed |

Snapshot shapes changed (A185, decision 78), values kept: `workspace-v4/expected-views.json` 23 Unavailable results (`"reason": "AwaitingClose", "detail": { "after": "2026-10-19" }` becomes `"reason": "AwaitingClose", "after": "2026-10-19"`); `workspace-v5/expected-views.json` 200 (`"reason": "MarkMissing", "detail": { "instrument": { "kind": "Stock", "symbol": "CSCO" }, "date": "2026-10-20" }` becomes `"reason": "MarkMissing", "instrument": { ... }, "date": "2026-10-20"`).

Test files changed, old to new: `detail: { instrument, date }` / `detail: { after }` beside `reason` becomes the fields beside `reason`, in `src/domain/trade-analysis/evaluate.test.ts` (6), `src/coordinators/trade-views/current-evaluation.test.ts` (3), `src/coordinators/daily-review/daily-review.test.ts` (2, embedded `marketValue`), `src/coordinators/workspace/migration.test.ts`, `src/ui/figures.test.ts` (2), `src/ui/screens/TradeList.test.tsx` (5), `ReviewCard.test.tsx` (2), `CardFigures.test.tsx`, `tests/integration/d4/intraday.test.ts` (2), `d4/expected-mark.test.ts`, `d6/missing-mark.test.ts`, `tests/support/views-fixtures.ts` (2); `tests/support/open-detail-fixtures.ts` renames the findings type only.
