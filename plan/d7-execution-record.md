# D7 execution record

## Status
Deliverable 7 (Close Review) complete. Fresh browser-critic gates passed (6/6 full brief, then 4/4 focused repair brief) with no defects. Frozen baseline `plan/freeze.md` rev `c5d28a8a`; DEV-001 applies. Frozen file digests unchanged.

## Task breakdown first
`plan/d7-task-breakdown.md` was written before any production code, with structural S1–S4 and behaviour-bearing T1–T6, named seams, concrete `it should` cases, red/green commands, mock-free integration cases and critic flows.

## Red/green evidence
Every case was added through its named seam, run to RED with the behaviour absent (module missing, function missing or assertion failing), then made GREEN with the smallest production change; earlier tests stayed green.

| Task | RED | GREEN |
|---|---|---|
| D7-S1 manifest | `npx vitest run tests/structural/d7-capability-manifest.test.ts` — module `capabilities-d7` absent | 2 passed |
| D7-S3 definition / S4 contract / T1+T2 | `npx vitest run tests/structural/d7-definition.test.ts tests/structural/d7-contracts.test.ts tests/unit/close-review.test.ts` — module `close-review` absent | 15 passed |
| D7-T3 persistence | `npx vitest run tests/integration/close-review.test.ts` — module `close-review-controller` absent | 6 passed |
| D7-T4 P5 due Debt | `npx vitest run tests/integration/close-review-debt.test.ts` — `isDebtDueAt` not a function; future Debt incorrectly due; Review cannot answer Close Review Debt | 6 passed |
| D7-T5 narrative | `npx vitest run tests/unit/journal-narrative.test.ts` — module absent; then `tests/integration/close-review-narrative.test.ts` — `detail.narrative` undefined | 4 + 1 passed |
| D7-T6 UI | `npx playwright test e2e/d7-close-review.spec.ts` — 5 failed, all waiting for the absent `Start Close Review` button | 5 passed |

Defects/fixture issues caught by the loop:
- The first `close-review` draft stored `dueAt` only as a top-level Debt field, so void-reopen produced an empty date; added `dueAt` to the trigger-time snapshot.
- Integration fixtures expected `source`/`definitionRevision` at the Entry top level; added them alongside the snapshot copies for queryability.
- `answerDeferredCloseReview` initially rejected the current Debt as an existing outcome; changed the duplicate check to target an existing Entry only.
- Narrative unit fixtures used row ids as obligation keys and an origin pointing back at the test Trade; corrected the fixtures rather than weakening the projection.
- The browser Close Review test expected an unsuffixed Trade id; changed to a stable prefix match.
- The UI hardcoded `2026-11-25T20:00:00Z` as the close `economicTime`, so a deferred Close Review was not due at the Review cut-off; the close now uses the trader-entered economic time.
- A narrative browser case raced the journal write before reload; replaced debug output with a `expect.poll` on the persisted row.

No mocks are used in integration tests. `fake-indexeddb` (from `tests/setup.ts`) is the disclosed substitute for browser-owned IndexedDB. Browser tests use real IndexedDB in disposable Chromium contexts.

## Verification commands and outcomes
- `npm run test:all` — 65 files, 242 tests passed (D6 baseline: 57/208).
- `npm run test:integration` — 13 files, 44 tests passed.
- `npx playwright test` — 36 browser tests passed (31 prior + 5 D7).
- `npx playwright test --config=playwright.prod.config.ts` — 1 offline cold-restart test passed.
- `npm run lint` — exit 0.
- `npm run typecheck` (`tsc --noEmit`, TS 7.0.2) and `npm run typecheck:6` (`tsc6 --noEmit`, TS 6.0.3) — exit 0.
- `npm run build` — passed; Offline Release Inventory `sha256-7bd236af2117b2bcda75667aeee705d7467abe7645c5eb0119ee7bc97eb3bd76` with 6 assets.

## Browser-critic gate — first pass
Fresh independent general subagent (not this session) ran `plan/d7-critic-brief.md`, starting the app itself and driving the production UI with `playwright-cli` (headless Chromium 158.0.0.0 / macOS 26.6.2, loopback only per DEV-001). Flows 1–5 and 5's narrative checks **PASS**; one ancillary defect was found; it edited nothing.

Defect: after completing/deferring a Close Review and then creating and closing a second Trade without reloading, the auto-opened Closed detail showed the previous Trade's Close Review status and narrative (e.g. `Outstanding Debt`, or MSFT's narrative row on a TSLA trade), and the stale status removed the `Start Close Review` button. RED: new `e2e/d7-close-review.spec.ts` case expected `Not started` and received `Saved`. Root cause: `onRecordClose` auto-opens the new Closed detail without clearing the prior trade's `closeReviewStatus`/`narrative`. Fixed by resetting Close Review status, narrative, open form, draft and error on that path. GREEN 6/6 D7 browser cases.

All cumulative suites re-run green: 242 Vitest, 44 integration, 37 browser, 1 offline, lint, both typechecks, build. Offline Release Inventory `sha256-cfb47c1c912a7d34b295a23788a507e543d763bd2458a418a37dca14a607d951`.

## Browser-critic gate — repeat pass
A fresh repeat critic (not this session) ran the updated `plan/d7-critic-brief.md`: **6 PASS / 0 FAIL — no defects** (headless Chromium 158.0.0.0 / macOS 26.6.2, loopback `http://localhost:5182`, DEV-001). It verified capability honesty and no-write-on-leave, the exact D1 Entry with Source Trade Close and unchanged Trade facts, deferral becoming a due Debt settled atomically from Review, a distinct Decline, deduplicated narrative with reload durability, and the repaired no-stale-status behaviour on a newly closed Trade. It edited nothing.

## Second repair (critic's non-gating observation)
The repeat critic noted that an already-mounted Closed detail still showed `Outstanding Debt` after its deferred Debt was answered in Review. RED: new `e2e/d7-close-review.spec.ts` case expected `Saved` and received `Outstanding Debt`. Two contributing causes were fixed: (1) `onOpenTrades` did not recompute Close Review state for a mounted Closed detail — it now re-derives via a shared `loadCloseReviewState`; (2) that loader picked the first row sharing the obligation key (the historical Settled Debt) rather than the effective Entry/Decline — it now prefers Entry, then JournalDecline, then an unsettled Debt. GREEN 7/7 D7 browser cases; all cumulative suites re-run green (242 Vitest, 44 integration, 38 browser, 1 offline, lint, both typechecks, build). Offline Release Inventory `sha256-42f722743a33c015cfde464f9de42e2ad32eade13b2ecdf15282beb7d52feee2`. A focused fresh critic (not this session) ran `plan/d7-stale-status-critic-brief.md`: **4 PASS / 0 FAIL — no defects** (headless Chromium 158.0.0.0 / macOS 26.6.2, loopback per DEV-001). It confirmed the debt appears in Review, that answering it settles the Debt and creates one D1 Entry, that returning to Trades without reloading shows `Saved` and exactly one narrative row, and that reload/reopen preserves the same state. It edited nothing.

## Acceptance scenario status for D7
- AC-JOUR-005 **full** — one current outcome per `CloseReview:` key, retry conflict with no duplicate, Debt-settlement Entry with atomic Debt settlement and pure void-reopen support (unit, integration, browser).
- AC-JOUR-001 **full** — opening, typing and leaving the Close Review form writes no Entry, Debt, decline, draft or keystroke evidence (browser, IndexedDB before/after).
- AC-JOUR-003 **full** — deferral creates one Outstanding Debt with trigger-time snapshot and no blank Entry; due Debt blocks Review completion but never blocks a later factual Journal recording (integration, browser).
- AC-POS-004 **full** — Close Review never blocks closure and writes no Trade fact; the Close Reason is unchanged by any Close Review outcome (browser, IndexedDB).
- AC-JOUR-002 **partial** — immutable Entry versions and definition snapshots are stored; Edit, Addendum and Void surfaces remain later deliverables.

## Open items / carried forward
- Entry Edit/Addendum/Void UI and full version-history surface remain later (AC-JOUR-002 full).
- Options, spreads, settlement, management revision, provider recovery/configuration, replay visuals/Daily Bars and reports remain uninstalled.
- Production HTTPS evidence remains deferred per DEV-001 until deployment.
- Carried non-defects: dev favicon 404; New Plan binds the first Account implicitly.
