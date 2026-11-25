# D6 execution record

## Status
Deliverable 6 (Close a Long Stock position) complete. Fresh browser-critic gate passed 5/5 flows with no defects. Frozen baseline `plan/freeze.md` rev `c5d28a8a`; DEV-001 applies. Frozen file digests unchanged.

## Task breakdown first
`plan/d6-task-breakdown.md` was written before any production code, with structural S1–S4 and behaviour-bearing T1–T5, named seams, concrete `it should` cases, red/green commands, mock-free integration cases and critic flows.

## Red/green evidence
Every case was added through its named seam, run to RED with the behaviour absent (module missing or assertion failing), then made GREEN with the smallest production change; earlier tests stayed green.

| Task | RED | GREEN |
|---|---|---|
| D6-S1 manifest | `npx vitest run tests/structural/d6-capability-manifest.test.ts` — module `capabilities-d6` absent | 2 passed |
| D6-S2 durable representation | ran after T4 introduced the Closed projection; 2 structural assertions passed | 2 passed |
| D6-S3 terminal vocabulary | `npx vitest run tests/unit/close.test.ts tests/structural/d6-terminal-vocabulary.test.ts` — module `close` absent | 6 passed |
| D6-S4 contract | `npx vitest run tests/unit/record-close.test.ts tests/structural/d6-contracts.test.ts` — module `record-close` absent | 6 passed |
| D6-T1 FIFO derivation | `npx vitest run tests/unit/derive.test.ts -t "FIFO"` — 5 failed: no matches, no fee allocation, realized 0.00, no Closed lifecycle, no match agreement | 11 passed (6 opening + 5 FIFO) |
| D6-T2 Close Reason / disposition | module `close` absent | 6 passed with S3 |
| D6-T3 terminal command | module `record-close` absent | 6 passed with S4 |
| D6-T4 atomic persistence | `npx vitest run tests/integration/record-close.test.ts` — module `close-controller` absent | 5 passed |
| D6-T5 UI | `npx playwright test e2e/d6-close.spec.ts` — 4 failed, all waiting for the absent `Close position` button | 4 passed |

Defects/fixture issues caught by the loop:
- The S1 substring guard matched "Report" inside `TradeViewsAndReporting`; tightened to `Report(`.
- The S2 structural test initially used CommonJS `require` inside an ESM test; replaced with a top-level import.
- `derive`'s first draft carried scratch expressions for fee allocation; replaced with a single tracked original-quantity/original-fee model before running GREEN.
- The browser expectation used a 5.00 disposal fee while the fixture used 4.00; corrected realized P&L from 80.00 to 81.00 (the production arithmetic was right).
- Earlier D1/D3/D4 browser assertions still forbade the word "Close position"; updated now that D6 installs it.

No mocks are used in integration tests. `fake-indexeddb` (from `tests/setup.ts`) is the disclosed substitute for browser-owned IndexedDB. Browser tests use real IndexedDB in disposable Chromium contexts.

## Verification commands and outcomes
- `npm run test:all` — 57 files, 207 tests passed (D5 baseline: 50/181).
- `npm run test:integration` — 10 files, 31 tests passed.
- `npx playwright test` — 30 browser tests passed (26 prior + 4 D6).
- `npx playwright test --config=playwright.prod.config.ts` — 1 offline cold-restart test passed.
- `npm run lint` — exit 0.
- `npm run typecheck` (`tsc --noEmit`, TS 7.0.2) and `npm run typecheck:6` (`tsc6 --noEmit`, TS 6.0.3) — exit 0.
- `npm run build` — passed; Offline Release Inventory `sha256-a70fb03daecb1c34d0bb05d6934a9f230d207b6da102c7abbe7142ec77e5204f`, 6 assets.

## Browser-critic gate — first pass
Fresh independent general subagent (not this session) ran `plan/d6-critic-brief.md`, starting the app itself and driving the production UI with `playwright-cli` (headless Chromium 158.0.0.0 / macOS 26.6.2, loopback only per DEV-001). Flows 1–4 **PASS**; flow 5 **FAIL**; it edited nothing.

Defects found:
1. An unsubmitted Close draft survived navigation and the sheet auto-opened on return; the sheet had no Cancel control and its backdrop swallowed nav clicks. RED: new `e2e/d6-close.spec.ts` case failed on the absent Cancel button. Fixed by adding a Cancel button, a dismissing backdrop, and resetting `closingId`/`closeForm` on both nav handlers and `showOpen`. GREEN 5/5 D6 browser cases.
2. Every successful close stored a false `StoredLotDisagreement`: `recordClose` compared pre-close stored Lots against the post-close (empty) derived set. RED: new `tests/unit/record-close.test.ts` case expected `agreement.findings === []` and received `['StoredLotDisagreement']`. Fixed by checking pre-close agreement against the pre-close facts and deriving the final state with `storedLots: []`. GREEN 5/5.
3. `npm run lint` then flagged the `body` variable orphaned by removing a stale D4 assertion; the assertion was replaced with checks for remaining forbidden capabilities. GREEN.

All cumulative suites re-run green: 208 Vitest, 31 integration, 31 browser, 1 offline, lint, both typechecks, build. Offline Release Inventory `sha256-8af9cc8a257f1c349a7151798faafe494547a27362a1e7c8f213389c25751a48`.

## Browser-critic gate — repeat pass
A fresh repeat critic (not this session) ran the updated `plan/d6-critic-brief.md`: **5 PASS / 0 FAIL — no defects** (headless Chromium 158.0.0.0 / macOS 26.6.2, loopback `http://localhost:5182`, DEV-001). It confirmed capability honesty; the Close Reason gate writing nothing; FIFO 6/4 matches with 3.00/2.40 and 2.00/1.60 fee splits, realized 81.00, separate Close Reason and "Closed via", and `agreement.findings === []`; closure independent of Decline reflection with reload durability; and Cancel/backdrop dismissal, no auto-open after navigation and a clean form on reopen. No screenshots were needed. It edited nothing.

## Acceptance scenario status for D6
- AC-LIFE-001 **full** — Planned→Open→Closed with stored/indexed lifecycle agreement at each revision; Terminal Disposition derived only from effective disposing facts and separate from Close Reason (unit, integration, browser, IndexedDB inspection).
- AC-POS-001 **full** — FIFO matches by Economic Time then Recorded Sequence, exact proportional opening/disposal fees allocated once, partial close remains Open, final flat closes, no price/P&L duplicated onto a match (unit, integration, browser).
- AC-POS-004 **partial** — exactly one active seeded Close Reason required for trader agency; option disposition timing not applicable to stock (unit, browser).
- AC-JOUR-003 **full** — closing Position Change Reflection is a Debt/Decline/Entry distinct from the trade fact; no blank Entry; no Close Review written (integration, browser).
- AC-RESP-001 **full** — one command call returns a revision-bound receipt, Closed projection and reflection outcome with no read-back (unit, integration).

## Open items / carried forward
- Close Review obligation with its own key and deferred-Debt-at-next-Review semantics is D7.
- Options, settlement, management revision, provider recovery/configuration, replay visuals/Daily Bars and reports remain uninstalled.
- Production HTTPS evidence remains deferred per DEV-001 until deployment.
- Carried non-defect: dev favicon 404; New Plan binds the first Account implicitly.
