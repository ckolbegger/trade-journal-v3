# D3 execution record

## Status
Deliverable 3 (Open a Long Stock position) complete. Fresh browser-critic gate passed 6/6 flows with no defects. Frozen baseline `plan/freeze.md` rev `c5d28a8a`; DEV-001 applies. Frozen file digests re-verified unchanged after implementation.

## Task breakdown first
`plan/d3-task-breakdown.md` was written before any production code. Structural tasks S1–S4 and behaviour-bearing tasks T1–T5 each name the public seam, concrete `it should` cases, red/green commands, mock-free integration cases and critic flows.

## Red/green evidence
Every `it should` case was added through its named seam, run to RED with the behaviour absent (not a syntax/fixture error), then made GREEN with the smallest production change. Earlier tests were kept green after each change.

| Task | RED command and outcome | GREEN command and outcome |
|---|---|---|
| D3-S1 manifest | `npx vitest run tests/structural/d3-capability-manifest.test.ts` — 1 failed suite, 0 tests, `Cannot find module '../../src/domain/capabilities-d3'` (behaviour absent) | same command — 2 passed |
| D3-S2 durable representation | `npx vitest run tests/structural/d3-durable-representation.test.ts tests/structural/d3-contracts.test.ts tests/structural/clock-calendar.test.ts` — implementation already present from T1–T4, 8 passed | same — 8 passed |
| D3-T1 derive | `npx vitest run tests/unit/derive.test.ts` — 1 failed suite, 0 tests, `Cannot find module '../../src/domain/derive'` | same command — 6 passed |
| D3-T2 reflection | `npx vitest run tests/unit/position-change-reflection.test.ts` — 1 failed suite, 0 tests, module absent | same command — 7 passed |
| D3-T3 recordPositionChange | `npx vitest run tests/unit/record-position-change.test.ts` — 1 failed suite, 0 tests, module absent | same command — 6 passed |
| D3-T4 reads (unit) | `npx vitest run tests/unit/open-views.test.ts` — 1 failed suite, 0 tests, module absent | same command — 4 passed |
| D3-T4 reads (integration) | `npx vitest run tests/integration/record-position-change.test.ts tests/integration/open-views.test.ts` — 2 failed suites, `Cannot find module '../../src/ui/position-controller'` | same command — 7 passed |
| D3-T5 UI | `npx playwright test e2e/d3-open.spec.ts --reporter=line` — 4 failed, all waiting for button `Add execution` (absent) | same command — 4 passed |

Defects/fixture issues caught by the loop:
- S1's first GREEN run had a false-positive assertion: the forbidden token `Report` matched the legitimate module name `TradeViewsAndReporting`. The test fixture (not the manifest) was corrected to check explicit operation tokens; production manifest was unchanged.
- `loadPlannedTrades()` had to skip the new `lifecycle-index` record and Open trades, otherwise the D2 Planned list would show non-Planned rows. This was a direct consequence of the D3 durable representation, fixed in the loader.
- The D2-confirmed Trade row is written without a `revision` field; the new coordinator defaults its expected revision to `'1'` so the write-gate/revision check remains honest.
- No mock is used in integration tests. `fake-indexeddb` (declared in `tests/setup.ts`) is the disclosed substitute for browser-owned IndexedDB. The e2e and critic drive the real production UI and real IndexedDB.

## Verification commands and outcomes (cumulative, all green)
- `npm run test:all` — 30 files, 112 tests passed (baseline before D3: 21 files, 75 tests).
- `npm run test:integration` — 5 files, 13 tests passed (mock-free real persistence).
- `npx playwright test` — 12 browser tests passed (8 D1/D2 + 4 D3).
- `npm run lint` — exit 0.
- `npm run typecheck` (`tsc --noEmit`, TS 7.0.2) — exit 0; `npm run typecheck:6` (`tsc6 --noEmit`, TS 6.0.3) — exit 0.
- `npm run build` — passed; Offline Release Inventory `sha256-af29754f659a7810cf99f067ee5ed4fd7beccf39821604be01a4c6c036d1bd9a`, 6 assets.

## Browser-critic gate
Fresh independent general subagent (not this session) ran with `plan/d3-critic-brief.md`; it started the app itself and drove the production UI at `http://localhost:5182` with `playwright-cli` 0.1.25, editing nothing. Verdict: **6 PASS / 0 FAIL** — no defects, so no repair loop was needed.

- Flow 1 grouped opening decision: PASS — two Executions in one decision appeared as Open with no refresh (Position 10, 2 Lots, fees 5.00, realized 0.00).
- Flow 2 Defer is not writing: PASS — one `Debt` with a `PositionChange:` obligation key and trigger-time D1 snapshot in IndexedDB; no blank/position-change Entry; factual Open state stored.
- Flow 3 validation and Decline: PASS — typed inline `Reflection:DecisionMode`/etc. errors with no write; explicit decline outcome with reason recorded after correction.
- Flow 4 capability honesty: PASS — only D1/D2 navigation, no Mark/Review/Report/Backup/Restore/close/Execution-operation, no fake Unavailable placeholder.
- Flow 5 durability and honesty: PASS — both Open trades and reflection outcomes persisted after reload; stored values agree with display; no `valuation`/`mark`/`lotMatches` fields.
- Flow 6 responsive: PASS — live 1200↔480 layout switch with unsaved Execution values and reflection disposition preserved.

Evidence provenance: HeadlessChrome 158.0.0.0 (UA macOS 10_15_7), macOS 26.6.2 (25G83), Node 26.12.0, npm 11.20.0, Vite 7.3.8, secure loopback context. Dev favicon 404 is the only console noise (carried non-defect). Per DEV-001 this is local loopback evidence only and is never relabelled production HTTPS evidence.

Neutral critic observation (not a defect): a Lot's `basis` includes its allocated opening fee while the allocated fee is also displayed separately. This is intended — the Lot carries its own fee in basis, and the separately displayed incurred fee is disclosure, not a second subtraction.

## Acceptance scenario status for D3
- AC-JOUR-003 **full** — Defer creates one Outstanding Debt with the trigger-time definition snapshot, no blank Entry; factual Open recording succeeds. Evidence: `position-change-reflection.test.ts`, `record-position-change.test.ts` (unit + integration), `e2e/d3-open.spec.ts` journal-store inspection.
- AC-RESP-001 **full** for `recordPositionChange` — one-call revision-bound result; `postCommit.trade` equals durable state at the returned revision; no required follow-up read. Evidence: unit and integration.
- AC-LIFE-001 **partial** (Planned→Open only) — stored `Open` agrees with derived expected state; lifecycle index membership changes in the same commit. Closed/terminal evidence belongs to D6.
- AC-POS-002 **partial** (one decision group) — several Executions share one Position Change identity and stable order, each keeps its identity/Trade ownership and Planned-Leg binding, and exactly one reflection obligation key/outcome is recorded. Multi-leg option decisions belong to D8/D10/D12.
- AC-JOUR-005 **partial** — one current outcome per obligation key; retry conflicts with no write; `reopenDebtOnVoid` is covered at unit level. Concurrency and Void-settlement reopen through the browser are D5 full.

## Open items / carried forward
- No valuation, Mark, Daily Review, Report, Backup, Restore, disposal or closing Lot Match in D3 (by declared scope).
- `reopenDebtOnVoid` is unit-covered but not yet browser-exercised; full settlement/Void behaviour is D5.
- Definition revision changes (AC-JOUR-004) are D12b.
- Production HTTPS evidence remains deferred per DEV-001 until deployment.
- Carried non-defects from D1/D2: dev favicon 404; Workspace nav has no dedicated handler (status inline); New Plan binds the first Account implicitly.
