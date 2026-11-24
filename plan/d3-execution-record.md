# D3 execution record

## Status
Deliverable 3 (Open a Long Stock position) complete. Initial fresh browser-critic gate passed 6/6 flows; after the reported visual gap, a final fresh browser-critic gate also passed 6/6 flows with no defects. Frozen baseline `plan/freeze.md` rev `c5d28a8a`; DEV-001 applies. Frozen file digests re-verified unchanged after implementation.

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
- `npx playwright test` — 12 browser tests passed at initial D3 completion (8 D1/D2 + 4 D3); 14 after the visual pass (adds 2 visual-language cases); 15 final (adds a narrow-width action-overlap case).
- `npm run lint` — exit 0.
- `npm run typecheck` (`tsc --noEmit`, TS 7.0.2) — exit 0; `npm run typecheck:6` (`tsc6 --noEmit`, TS 6.0.3) — exit 0.
- `npm run build` — passed; Offline Release Inventory `sha256-af29754f659a7810cf99f067ee5ed4fd7beccf39821604be01a4c6c036d1bd9a`, 6 assets at initial completion; final `sha256-f5fb483bf591639b7375e1e69619615e67bcb3000405f5e634dcd937362c75b3`, 6 assets.

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

## Visual-fidelity follow-up (reported defect)
After the first critic, the trader reported that the Open Trades list and Trade Detail did not look like the prototype. This was a real gap against the normative Visual language section of `specs/design/ui-contract.md`: the D3 screens were a functional scaffold without cream/white cards, small-caps section labels, semantic badges, monogram rows, pill chips or right-aligned tabular numerals, and the Add Execution form was inline rather than a sheet/drawer. Prototype content that the screenshot index marks non-authoritative (adherence, `+$0`/`+0%`, "Close position", Insights, stock multiplier arithmetic) was deliberately not copied.

Repair loop: `e2e/d3-visual.spec.ts` was added first and run to RED — body background `rgba(0,0,0,0)` vs expected cream, and Add Execution form `position: static` vs expected `fixed` — proving the absent visual behaviour rather than a fixture error. Then `src/ui/styles.css` and the D3 markup in `src/ui/App.tsx` were restyled; every accessible name, label, test id and behavioural seam was preserved. GREEN: both visual cases pass. All cumulative suites were re-run green (`test:all` 112, `test:integration` 13, `playwright` 14, lint/typecheck/typecheck:6/build). A second fresh critic is running with `plan/d3-visual-critic-brief.md`; its verdict is recorded below once returned.

## Acceptance scenario status for D3
- AC-JOUR-003 **full** — Defer creates one Outstanding Debt with the trigger-time definition snapshot, no blank Entry; factual Open recording succeeds. Evidence: `position-change-reflection.test.ts`, `record-position-change.test.ts` (unit + integration), `e2e/d3-open.spec.ts` journal-store inspection.
- AC-RESP-001 **full** for `recordPositionChange` — one-call revision-bound result; `postCommit.trade` equals durable state at the returned revision; no required follow-up read. Evidence: unit and integration.
- AC-LIFE-001 **partial** (Planned→Open only) — stored `Open` agrees with derived expected state; lifecycle index membership changes in the same commit. Closed/terminal evidence belongs to D6.
- AC-POS-002 **partial** (one decision group) — several Executions share one Position Change identity and stable order, each keeps its identity/Trade ownership and Planned-Leg binding, and exactly one reflection obligation key/outcome is recorded. Multi-leg option decisions belong to D8/D10/D12.
- AC-JOUR-005 **partial** — one current outcome per obligation key; retry conflicts with no write; `reopenDebtOnVoid` is covered at unit level. Concurrency and Void-settlement reopen through the browser are D5 full.

## Second fresh critic (visual fidelity)
Verdict: **5 PASS / 1 FAIL**. Flows 2–6 passed, including behaviour/durability, responsive drawer↔bottom-sheet switching, Cancel writing nothing and typed validation errors. Flow 1 failed on a real visual defect: Trade row title and subtitle were inline (`display: inline`) with no separator, rendering as `AAPLLong Stock · 1R 50.00` instead of stacked lines. Non-blocking observations: the `Buy` chip stretched to the drawer width, and revealed Complete-reflection fields laid out inline at narrow width.

Test-first repair: `e2e/d3-visual.spec.ts` was strengthened to assert the subtitle's bounding box starts below the title's — RED with subtitle `y = 216.375` vs required `>= 230.375`. Then `.row-main` became a grid with block title/subtitle lines, `.action-pill` was given `justify-self: start`, and the Complete fields were wrapped in paired `.field-grid` cells. GREEN: 2/2 visual cases. All cumulative suites re-run green (`test:all` 112, `test:integration` 13, `playwright` 14, lint/typecheck/typecheck:6/build). Third fresh critic verdict: **5 PASS / 1 FAIL** — Flows 1–5 passed; the row-title repair, compact Buy chip and paired narrow-width Complete fields were confirmed. Flow 6 found a real defect (D3-CRIT-1): at 480×800 the fixed bottom nav covered the Planned-detail "Add execution" button, leaving only a ~10px clickable sliver. Test-first repair: a new case in `e2e/d3-open.spec.ts` scrolls to the bottom at 480px and asserts the button's bottom edge is above the nav; RED (`781.09 > 704`) then GREEN after narrow `.shell` bottom padding was raised from 4.5rem to 10rem. All cumulative suites re-run green (`test:all` 112, `test:integration` 13, `playwright` 15, lint/typecheck/typecheck:6/build); one transient `main`-not-found startup flake in a 4-worker run passed on immediate rerun. Fourth fresh critic verdict: **6 PASS / 0 FAIL — no defects** (Google Chrome 158.0.8127.37 / macOS 26.6.2, exact high-entropy version, loopback `http://localhost:5182`, DEV-001). It confirmed stacked Trade rows, compact Buy chip, Planned/Open card hierarchy, drawer↔bottom-sheet switching with preserved values, Cancel writing nothing, Defer→Debt with no blank Entry, and durable state after reload. The repaired narrow-width overlap was re-checked with `elementFromPoint` and a physical centre click: "Add execution" bottom 640 vs nav top 703 (63px clear), hit-testing to the button. No failure screenshots were needed. The visual defect is closed; the follow-up is committed separately as `282e318b`, and at the user's request `hy4-flash-d3-complete` was moved to the later polish commit `fe053492`.

## Post-D3 polish (user-requested)
1. **Human-readable validation copy.** RED: `tests/unit/issue-copy.test.ts` could not resolve `src/ui/issue-copy`, and the D3 browser test still expected the raw token `DecisionMode`. Added `formatIssues()` mapping stable domain tokens to prose while leaving domain results unchanged; GREEN 3/3 unit cases and the browser test now expects "Decision mode is required.". Unknown future tokens are surfaced verbatim, never swallowed.
2. **Production-build readiness.** The built app previously hard-coded `offlineInventoryValid: false` and required an already-controlling service worker, so a local production preview could never become `Writable`. Added `src/domain/offline-inventory.ts` (test-first RED/GREEN: `tests/unit/offline-inventory-validation.test.ts`, 4 cases) that recomputes the release and every asset digest from delivered bytes; `establish()` now probes the generated inventory for real, waits briefly for worker control, re-establishes readiness on `controllerchange` without disturbing unsaved form state, and the error view names each failed check. The generated worker is registered immediately so `clients.claim()` can take effect without a reload.
   - Verified on the production build at `http://localhost:5182` (loopback, DEV-001 — **not** production HTTPS evidence): `main[data-view]=empty`, `serviceWorker.controller=true`, `isSecureContext=true`; adding an Institution through the UI persisted it and moved the view to `ready`. The earlier RecoveryOnly display is resolved. Production HTTPS evidence remains deferred until deployment.
3. **Workspace navigation and labels.** The D1 `Workspace` nav button was a dead affordance (status was shown inline on the Accounts screen). RED: `e2e/d1-ui.spec.ts` failed on nav text `Status` missing and the new Status-view case timed out waiting for the button. Wired a real `Status` view showing Runtime Readiness, storage protection, failed checks, the data-clearing warning and an explicit `Workspace.requestDurability` action (honestly reporting `NotImproved` here) with no authoritative write. Renamed nav buttons to `Accounts` and `Status`, updating `D2_NAVIGATION`, `D3_NAVIGATION`, `navigationFor()` and their tests. GREEN 6/6 D1 browser cases.
   - Final cumulative suites after polish: `test:all` 32 files/119 tests, `playwright` 16, `lint`, `typecheck` (7.0.2), `typecheck:6` (6.0.3), `build` — all green. Final Offline Release Inventory `sha256-2d3cefe393c6ac3e1bc6fa31913c424aacc9e10f0ecd4df51f282886a5286cef`, 6 assets.

## Open items / carried forward
- Visual fidelity was initially missing, then repaired and critic-confirmed; validation alerts now use human prose. Both were user-requested polish after the D3 gate.
- No valuation, Mark, Daily Review, Report, Backup, Restore, disposal or closing Lot Match in D3 (by declared scope).
- `reopenDebtOnVoid` is unit-covered but not yet browser-exercised; full settlement/Void behaviour is D5.
- Definition revision changes (AC-JOUR-004) are D12b.
- Local production-build readiness now reaches `Writable` after real checks; production HTTPS evidence remains deferred per DEV-001 until deployment.
- Carried non-defects from D1/D2: dev favicon 404; New Plan binds the first Account implicitly. The dead Workspace nav item is now a working `Status` view and is no longer carried.
