# D5 execution record

## Status
Deliverable 5 (Daily Review Phase II — journaling and Action recording) complete. Fresh browser-critic gate passed 6/6 flows with no defects. Frozen baseline `plan/freeze.md` rev `c5d28a8a`; DEV-001 applies. Frozen file digests remain unchanged.

## Task breakdown first
`plan/d5-task-breakdown.md` was written before any production code, with structural S1–S4 and behaviour-bearing T1–T6, named seams, concrete `it should` cases, red/green commands, mock-free integration cases and critic flows.

## Red/green evidence
Every case was added through its named seam, run to RED with the behaviour absent (not a syntax/fixture error), then made GREEN with the smallest production change; earlier tests stayed green.

| Task | RED | GREEN |
|---|---|---|
| D5-S1 manifest | `npx vitest run tests/structural/d5-capability-manifest.test.ts` — module `capabilities-d5` absent | 2 passed |
| D5-S2 durable representation | `npx vitest run tests/structural/d5-durable-representation.test.ts` — modules absent | 2 passed |
| D5-S3 Action definition | `npx vitest run tests/structural/d5-action-definition.test.ts` — module `daily-action` absent | 2 passed |
| D5-S4 task order | `npx vitest run tests/structural/d5-task-order.test.ts` — module `review-order` absent | 3 passed |
| D5-T1 replay | `npx vitest run tests/unit/replay.test.ts` — module absent | 5 passed |
| D5-T2 Action form | `npx vitest run tests/unit/daily-action.test.ts` — module absent | 4 passed |
| D5-T3 completion/ranking | `npx vitest run tests/unit/review-completion.test.ts` — module absent | 5 passed |
| D5-T4/T5 save orchestration | `npx vitest run tests/integration/review-save.test.ts` — module `review-controller` absent | 5 passed |
| D5-T6 UI | `npx playwright test e2e/d5-review.spec.ts` — 4 failed, all waiting for the `Review` button (absent) | 4 passed |

Defects/fixture issues caught by the loop:
- Test imports omitted `unsavedActionView`, and an object-spread order overwrote the Action Entry `id`; both fixtures corrected.
- fake-indexeddb persists across tests in a file; integration fixtures were given unique Trade ids and Instruments so an earlier Action/Mark could not affect a later case.
- Save defaulted its `now` from the Review Date, shifting the cutoff a day earlier and causing a false `ReviewChanged`; the same explicit Review instant is now passed to both `open` and `save`.
- A Journal-only Debt whose route was `Journal.save(ResolveDebt)` was misclassified as workflow-routed; only `TradeWorkflows.*` routes now return `NeedsTradeWorkflow`, and settled Debt is excluded from due Debt.
- Earlier D1/D3 browser tests still forbade the word "Review"; updated now that D5 installs it.
- One responsive test raced the resize listener; it now waits for readiness before resizing.

No mocks are used in integration tests. `fake-indexeddb` (from `tests/setup.ts`) is the disclosed substitute for browser-owned IndexedDB. Browser tests use real IndexedDB in disposable Chromium contexts.

## Verification commands and outcomes
- `npm run test:all` — 50 files, 181 tests passed (D4 baseline: 42/153).
- `npm run test:integration` — 9 files, 26 tests passed.
- `npx playwright test` — 24 browser tests passed (20 prior + 4 D5).
- `npx playwright test --config=playwright.prod.config.ts` — 1 offline cold-restart test passed.
- `npm run lint` — exit 0.
- `npm run typecheck` (`tsc --noEmit`, TS 7.0.2) and `npm run typecheck:6` (`tsc6 --noEmit`, TS 6.0.3) — exit 0.
- `npm run build` — passed; Offline Release Inventory `sha256-f2cc5fa11d5dced514e218de09794d660cbcde9c744d1b143669e6eee011534a`, 6 assets.

## Browser-critic gate
Fresh independent general subagent (not this session) ran `plan/d5-critic-brief.md`: it started the app itself and drove the production UI with `playwright-cli`, editing nothing. Verdict: **6 PASS / 0 FAIL — no defects** (headless Chromium 158.0.0.0 / macOS 26.6.2, loopback `http://localhost:5182`, DEV-001). Confirmed: exact step order and no Review Session/flag; P1 gate wrote nothing until acknowledgment, then exactly one dated Action Entry with Daily Review source/origin and a distinct authored time; atomic Action + one Stop-Discipline fingerprint with no close control; changed-evidence rejection with no write; no-write-on-leave, resumption from facts and live resize; capability honesty and restart durability. Non-blocking observation (not reproduced, not classified): one same-tab attempt showed a stale Trade-detail Mark view after a Review Mark change; a reload and the clean reproduction did not reproduce it. Local loopback evidence is never relabelled production HTTPS.

## Acceptance scenario status for D5
- AC-REV-002 **full** — task families in Mark, Debt, Settlement, Trade order; resumption from saved facts; no Review Session/flag (unit, integration, browser).
- AC-REV-003 **full** — one-click Hold with P1 gate; nothing written on leave; exactly one dated Entry on Save; Intent required for Exit/Roll/Adjust (unit, browser, IndexedDB inspection).
- AC-REV-004 **full** — Action and one Stop-Discipline fingerprint reconciled atomically (integration, browser).
- AC-REV-005 **full** — changed Mark before Save returns ReviewChanged and writes nothing (integration).
- AC-REV-006 **full with P1/P2** — Incomplete, Complete and CompleteWithUnavailableMarks derived; settlement sub-state is a disclosed Incomplete (unit, browser).
- AC-JOUR-001 **full** — form open/type/navigate writes nothing; explicit Save is the only persistence boundary (unit, browser).
- AC-REV-007 **full** — P1 blocks Save on Missing Mark, acknowledgment resolves the gate, calculations stay Unavailable, and settlement/other outstanding obligations keep the day card honestly Incomplete (unit, browser).
- AC-REV-001 **partial** — cutoff eligibility uses current Open state in D5; corrections restate eligibility in D11a.

## Open items / carried forward
- No provider recovery/configuration (D9), correction of eligibility (D11a), replay visuals or Daily Bar candles (D8a), close (D6), full report families (D13+).
- Stock-only D5 has no Settlement Due facts; the day card's settlement sub-state is unit-covered but not browser-exercised until options arrive in D8/D10.
- Production HTTPS evidence remains deferred per DEV-001 until deployment.
- Carried non-defects: dev favicon 404; New Plan binds the first Account implicitly.
