# D8 execution record

## Status
Deliverable 8 (single option leg strategies) in progress. Task breakdown written before production code; all cumulative suites green; complete. First fresh browser-critic pass produced three defects, all repaired with RED tests first; the fresh repeat critic passed every flow and repair; two follow-up display observations were also repaired with RED tests and confirmed by a final focused fresh critic. All browser-critic gates are green with no remaining defects. Frozen baseline `plan/freeze.md` rev `c5d28a8a`; DEV-001 applies (loopback only, never relabelled production HTTPS). Frozen `specs/` and frozen plan files unchanged.

## Task breakdown first
`plan/d8-task-breakdown.md` was written before any D8 production code. It fixes structural tasks S1–S4 (capability manifest, durable representation, strategy shapes/vocabulary, public contract) and behaviour-bearing tasks T1–T6 (exact contract/shape resolution, option Plan assessment, expiration payoff, option position/fulfillment/deviations, atomic persistence, production UI), each with named seams, concrete `it should` cases, red/green commands and critic flows. No D8a work was started.

## Red/green evidence
Every case was added through its named seam, run to RED with the behaviour absent (module missing or assertion failing), then made GREEN with the smallest production change; earlier tests stayed green.

| Task | RED | GREEN |
|---|---|---|
| D8-S1 manifest | `npx vitest run tests/structural/d8-capability-manifest.test.ts` — module `capabilities-d8` absent | 2 passed |
| D8-S3 / T1 contract + shapes | `npx vitest run tests/unit/option-contract.test.ts tests/structural/d8-strategy-shapes.test.ts` — modules `option-contract`, `strategy-shapes` absent | 6 passed |
| D8-T2 option Plan | `npx vitest run tests/unit/option-plan.test.ts` — module `option-plan` absent; then quantity 0 produced spurious `NonPositiveRisk`/`NonPositiveBaseline` alongside `IncompleteLeg` | 5 passed |
| D8-T3 expiration payoff | `npx vitest run tests/unit/expiration-payoff.test.ts` — module absent; then `Decimal.min` instance misuse, slope formatting, short-put intercept sign and extremum-at-boundary errors | 6 passed |
| D8-T4 option position | `npx vitest run tests/unit/option-position.test.ts` — module `option-position` absent; then lifecycle not flat, P&L double-sign, fingerprint used underlying instead of leg id | 5 passed |
| D8-T5 persistence | `npx vitest run tests/integration/option-workflow.test.ts` — module `option-controller` absent; then opening executions and `lotMatches`/`closeReason` were not persisted | 5 passed |
| D8-S2 / S4 structural | `npx vitest run tests/structural/d8-durable-representation.test.ts tests/structural/d8-contracts.test.ts` — written against the now-fixed contract | 4 passed |
| D8-T6 UI | `npx playwright test e2e/d8-options.spec.ts` — 4 failed: strategy selector lacked option shapes; contract fields/live preview/option controller absent | 4 passed |

Loop findings fixed with a failing test first: nonpositive-risk leakage when quantity is invalid; payoff extremum evaluated at segment boundaries instead of raw intercepts; short-put low-branch premium sign; realized P&L sign for short exposure; stable leg-based deviation fingerprint; Open executions and close Lot Matches/Close Reason persisted in the atomic commit. No mocks are used in integration tests; `fake-indexeddb` (from `tests/setup.ts`) is the disclosed substitute for browser-owned IndexedDB. Browser tests use real IndexedDB in disposable Chromium contexts.

One frozen D1-era browser assertion (`e2e/d2-plan.spec.ts`) expected the Strategy selector to contain **only** Long Stock. D8's frozen scope explicitly makes the three seeded single-leg shapes selectable, so that assertion was updated to expect the four selectors while retaining its Long-Stock default and live 1R/R:R preview checks. No production stock behaviour changed.

## Verification commands and outcomes
- `npm run test:all` — 74 files, 277 tests passed (D7 baseline: 242).
- `npm run test:integration` — 14 files, 50 tests passed (D7 baseline: 44).
- `npx playwright test` — 46 browser tests passed (D7 baseline: 38; 4 D8 + 4 repair cases).
- `npx playwright test -c playwright.prod.config.ts` — 1 offline cold-restart test passed.
- `npm run lint` — exit 0 (one unused import introduced during UI wiring was removed).
- `npm run typecheck` (`tsc --noEmit`, TS 7) and `npm run typecheck:6` (`tsc6 --noEmit`, TS 6) — exit 0.
- `npm run build` — passed; Offline Release Inventory `sha256-538620273de57b019d583fdbe4f5d86e8bf947e234e79593edf734ab4d3ee8a5` with 6 assets.

## Browser-critic gate — first pass
A fresh independent critic (not this session) ran `plan/d8-critic-brief.md`, starting the app itself and driving the production UI with `playwright-cli` (headless Chromium 158.0.8127.37 / macOS 26.6.2, loopback only per DEV-001). Flows 1, 2 and 6 **PASS**; flows 3, 4 and 5 **FAIL**. It edited nothing. Chromium console showed only the carried favicon 404.

Defects found and repaired (each RED test added first):
- **Same-day identical option Plans collided.** The deterministic Trade id had no uniqueness token, so a second identical Plan overwrote the first Trade and its journal Entry. RED: `tests/integration/option-workflow.test.ts` "should give two identical same-day option Plans distinct Trade ids without overwriting the first". Fixed by appending a short `crypto.randomUUID()` token while keeping the readable contract prefix; both rows and both journal Entries now survive.
- **Closed detail showed 0 FIFO Lot Matches until reload.** The in-memory `trade` returned by `recordOptionClose` omitted `lotMatches` even though the atomic commit stored them. RED: same integration file asserted `result.value.trade.lotMatches` has length 1. Fixed by including `position.value.lotMatches` on the returned projection.
- **Put payoff extrema were inverted/unbounded.** `expirationPayoff` hard-coded attainment ranges and treated any positive segment slope as unbounded above, so long Puts reported the minimum on `0..K` and short Puts reported an unbounded maximum. RED: `tests/unit/expiration-payoff.test.ts` "should bound Put extrema at their correct attainment ranges". Fixed by deriving boundedness from the tail slope alone and computing attainment from the segment where each extremum actually occurs.

All three GREEN after repair. Added `e2e/d8-repairs.spec.ts` with three browser regression cases covering exactly these defects (distinct ids, immediate Lot Match, bounded Long Put extrema). All cumulative suites re-run green: 277 Vitest, 50 integration, 45 browser, 1 offline, lint, both typechecks, build. Offline Release Inventory `sha256-1086db933eece30acd45aaea914e4957387f28c93e9a1dfad7033578b0188e42`.

## Browser-critic gate — repeat pass
A fresh repeat critic (new session, not this session) re-ran the updated `plan/d8-critic-brief.md`: **6 PASS / 0 FAIL plus all three repairs PASS — no defects** (headless Chromium 158.0.0.0 / macOS 26.6.2 arm64, loopback `http://localhost:5182` per DEV-001). It verified the four selectors and live positive Baselines, no-write on an incomplete contract, exact frozen contracts and two distinct ids for identical same-day Plans, the full open/close flow with `398.00` realized and immediate one FIFO Lot Match plus reload durability, intrinsic Planned/Current payoff with correct Put extrema and no model price, and correct long/short direction for Put and Cash-Secured Put with no inferred settlement facts. It edited nothing.

Two non-blocking observations were raised rather than failed: the read-only Action pill on the Add-execution form was hardcoded `Buy` even for a Cash-Secured Put, and option FIFO Lot Matches carried no allocated fee fields so the Closed detail rendered dashes. Both were repaired test-first with two new `e2e/d8-repairs.spec.ts` cases: the pill now resolves `plannedLeg.openingAction` for the frozen shape (Sell for Cash-Secured Put), and `deriveOptionPosition` now persists `allocatedOpeningFee`/`allocatedDisposalFee` on each match while still storing no price or P&L on the link. All cumulative suites re-run green: 277 Vitest, 50 integration, 46 browser, 1 offline, lint, both typechecks, build. Offline Release Inventory `sha256-538620273de57b019d583fdbe4f5d86e8bf947e234e79593edf734ab4d3ee8a5`. A fresh focused critic (`plan/d8-display-critic-brief.md`) then confirmed both display repairs in the production UI: **2 PASS / 0 FAIL** (headless Chrome 158.0.8127.37 / macOS 26.6.2 arm64, loopback per DEV-001). It observed `Sell` on the Cash-Secured Put pill with a stored `action: Sell, opening: true` and net `-2`, `Buy` on Long Call and Long Stock pills, and immediate + durable Closed detail rows with `opening fee 1.00 · disposal fee 1.00`, one FIFO match carrying only fee fields (no price/P&L), and realized P&L `398.00`. It edited nothing.

## Acceptance scenario status for D8
- **AC-PLAN-001 full** — three option shapes with exact contracts, frozen Planned Leg and management, positive dollar 1R equal to the Plan Baseline, completed Plan Reflection committed atomically (unit, integration, browser).
- **AC-CALC-004 full** — independent Planned/Current intrinsic payoff with zero crossings, signed extrema, attainment sets, realized offset, no theoretical price/Mark/IV input, `NotApplicable` flat and stock-only, `Unavailable` multiple expirations (unit, browser).
- **AC-LIFE-001 full** — lifecycle index Planned→Open→Closed moves atomically with the reflection outcome and survives DB reopen (integration, browser).
- **AC-POS-002 full** — one Position Change identity, stable execution order, exact-contract intent and one reflection outcome per open/close (unit, integration, browser).
- **AC-POS-005 partial** — Filled As Planned / Partially Filled / Not Entered / Not Verifiable and one Planned-Leg Terms occurrence for all mismatched fields, with no Unplanned inference from a mismatch alone (unit). Multi-leg and objective-selector evidence remain later.

## Open items / carried forward
- Spreads, settlement (assignment/exercise/expiration facts), management revision, replay and provider/reports/backup/restore remain uninstalled.
- D8a (complete Trade Detail + mark-only replay, advisory IV) not started; per P3, `AC-IV-001` must be added to `specs/` before 8a freezes and advisory IV must never feed valuation, P&L, risk/reward, Stop/Target, payoff, Daily Review or reports.
- Production HTTPS evidence remains deferred per DEV-001 until deployment.
- Carried non-defects: New Plan binds the first Account implicitly; the Open detail caption still reads `shares` below an option contract (the contract line and net exposure figures are correct and critic-confirmed); favicon 404.

## Post-release defect — silent Confirm failure (found by manual use)
A user reported that clicking **Confirm plan** for a Long Call did nothing: no trade appeared, no alert was shown and no error appeared in the dev-server console. Reproduced in the browser by removing `crypto.randomUUID`: `confirmOptionPlan` threw `crypto.randomUUID is not a function` before returning a `Result`; `onConfirmPlan` did not catch it, so the form stayed unchanged with no message. The dev-server terminal cannot show browser exceptions.

Why the critic gates missed it: every critic fixture ran in headless Chrome 158 on secure `http://localhost:5182`, where `crypto.randomUUID` always exists, and always filled a complete valid plan. The critics exercised the typed `Result` failure paths (all of which do show an alert) but never a thrown exception or a browser where that API is absent. No critic was asked to vary the browser capability surface.

RED tests added first: `tests/unit/option-unique-id.test.ts` (unique token with and without `crypto.randomUUID`) and `e2e/d8-plan-robustness.spec.ts` (confirm succeeds without `crypto.randomUUID`; an unexpected storage throw surfaces as a visible alert). Fixes: `tradeIdToken()` in `src/ui/option-controller.ts` uses `crypto.randomUUID()` when available and a timestamp/counter/random fallback otherwise, so Trade ids stay unique without depending on that API; `onConfirmPlan`, `onRecordPosition` and `onRecordClose` now catch unexpected exceptions and render the message in their existing alert surfaces instead of leaving a dead button. All cumulative suites re-run green: 306 Vitest, 54 integration, 52 browser, 1 offline, lint, both typechecks, build. Offline Release Inventory `sha256-09a2988236216b21857a41caf6ae609a4e41b831245f46120c3053890f804565`.

## Release
D8 released as a follow-up commit `feat(d8): ...` with tag `hy4-flash-d8-complete`; the silent-Confirm fix was committed afterwards as `fix(d8): ...` on the same branch. D8a (complete Trade Detail + mark-only replay, advisory IV) started only after D8 was released, and was released as `feat(d8a): ...` with tag `hy4-flash-d8a-complete`. Both pushed and verified with `git ls-remote`.
