# D4 execution record

## Status
Deliverable 4 (Daily Review Phase I — current pricing, Marks and ongoing Risk/Reward) complete. Fresh browser-critic gate passed 6/6 flows with no defects. Frozen baseline `plan/freeze.md` rev `c5d28a8a`; DEV-001 applies. Frozen file digests remain unchanged.

## Task breakdown first
`plan/d4-task-breakdown.md` was written before any production code, with structural S1–S4 and behaviour-bearing T1–T5, named seams, concrete `it should` cases, red/green commands, mock-free integration cases and critic flows.

## Red/green evidence
Every case was added through its named seam, run to RED with the behaviour absent (not a syntax/fixture error), then made GREEN with the smallest production change; earlier tests stayed green.

| Task | RED | GREEN |
|---|---|---|
| D4-S1 manifest | `npx vitest run tests/structural/d4-capability-manifest.test.ts` — module `capabilities-d4` absent | 2 passed |
| D4-S2 durable representation | `npx vitest run tests/structural/d4-durable-representation.test.ts` — module `market-data` absent | 2 passed |
| D4-S3 sessions/gaps | `npx vitest run tests/structural/d4-session-gaps.test.ts` — `completedSessionsBetween is not a function`, market-frames absent | 3 passed |
| D4-S4 Calculation Result | `npx vitest run tests/structural/d4-calculation-result.test.ts` — module `calculation` absent | 2 passed |
| D4-T1 MarketData.save | `npx vitest run tests/unit/market-data.test.ts` — module absent | 6 passed |
| D4-T2 ResolveFrames | `npx vitest run tests/unit/market-frames.test.ts` — module absent | 4 passed |
| D4-T3 evaluate | `npx vitest run tests/unit/evaluate.test.ts` — module absent | 6 passed |
| D4-T4 persistence | `npx vitest run tests/integration/market-data.test.ts tests/integration/market-frames.test.ts tests/integration/evaluate.test.ts` — controller absent | 8 passed |
| D4-T5 UI | `npx playwright test e2e/d4-marks.spec.ts` — 4 failed on missing `expected-mark-date`, `Manual Mark price`, `Unavailability reason` | 4 passed |
| Offline cold restart | `npx playwright test --config=playwright.prod.config.ts` — `net::ERR_FAILED`, then `main` not found offline | 1 passed |

Defects/fixture issues caught by the loop:
- D4 manifest test's forbidden token `Report` matched the legitimate module name `TradeViewsAndReporting`; fixture changed to explicit operation tokens.
- Withdrawal of an acknowledgment rewrote the original version; changed to append an immutable withdrawn version.
- `evaluate` read `position.quantity` instead of `position.netQuantity`; corrected.
- Frame ranges included the still-active same-day session; capped enumeration at the Expected Mark Date.
- The Open-detail Mark draft was cleared *after* an async evaluation load, wiping a price typed during that load; reset moved before the await.
- Generated service worker did not precache `/offline-inventory.json`, had no `/index.html` navigation fallback, and needed `ignoreVary` for offline asset matches; all three fixed in `scripts/build-offline.mjs`.
- D3's browser test forbade the word "Mark" in Open detail; updated now that D4 installs Marks there.

No mocks are used in integration tests. `fake-indexeddb` (from `tests/setup.ts`) is the disclosed substitute for browser-owned IndexedDB. Browser and production-offline tests use real IndexedDB in disposable Chromium contexts.

## Verification commands and outcomes
- `npm run test:all` — 42 files, 153 tests passed (D3 baseline: 30/112).
- `npm run test:integration` — 8 files, 21 tests passed.
- `npx playwright test` — 20 browser tests passed (16 prior + 4 D4).
- `npx playwright test --config=playwright.prod.config.ts` — 1 offline cold-restart test passed on the production build.
- `npm run lint` — exit 0.
- `npm run typecheck` (`tsc --noEmit`, TS 7.0.2) and `npm run typecheck:6` (`tsc6 --noEmit`, TS 6.0.3) — exit 0.
- `npm run build` — passed; final Offline Release Inventory `sha256-b2c9a7e2a6453ec6682457966a86af2ed65cde4c3e6e4c92f0abc6ed54d2477e`, 6 assets.

## Browser-critic gate
Fresh independent general subagent (not this session) ran `plan/d4-critic-brief.md`: it started the app itself and drove the production UI with `playwright-cli`, editing nothing. Verdict: **6 PASS / 0 FAIL — no defects** (Chrome 158.0.0.0 / macOS 26.6.2, loopback `http://localhost:5182`, DEV-001). All six flows passed: Missing-before-Mark availability, Manual Mark Values with right-aligned tabular numerals and independent conditions, acknowledgment with no price and later exact Mark, Stop Overrun without lifecycle change or later-capability controls, restart durability with Stale context as context only, and live resize preserving unsaved values with a visible non-colour validation alert and no write. The only non-UI action was a test-setup IndexedDB injection to exercise the conditional Stale clause; it did not change any result. The critic noted the invalid-price alert used a raw token; `formatIssues` was extended with market-data prose (`InvalidPrice`, `MissingReason`, `ExactMarkExists`, etc.) test-first and all cumulative suites re-run green. Local loopback evidence is never relabelled production HTTPS.

## Acceptance scenario status for D4
- AC-MARK-001 **full** — Expected Mark Date is the latest completed session; noon Tuesday/Monday case Available, not Stale (unit, integration, browser).
- AC-MARK-002 **full** — Manual Mark sticky against a later provider close; distinct override/correction intentions in the revision chain (unit).
- AC-MARK-003 **full** — acknowledgment has reason and no price; later exact Mark becomes Available while history remains (unit, browser, IndexedDB inspection).
- AC-CALC-001 **full** — 1R and Plan Baseline unchanged; current risk uses remaining Position (unit, integration, browser).
- AC-CALC-002 **full** — realized-to-date remains a Value while mark-dependent figures are Unavailable with Instrument/date (unit, integration, browser).
- AC-CALC-003 **full** — independent Stop/Target conditions, Plan-R conversions and disclosed Stop Overrun without a Deviation (unit, browser).
- AC-DEL-001 **full for installed manual workflows** — production build re-establishes Writable offline and records a Manual Mark after a full stop (production-config browser test).
- AC-MARK-004 **partial** — explicit gaps and Stale context in `ResolveFrames`; replay/Daily Bar candles belong to D8a.

## Open items / carried forward
- No provider recovery/configuration (D9), no replay or Daily Bar candle (D8a), no Review ritual (D5), no Mark correction (D11a), no close (D6).
- `Unbounded` is used for long-stock maximum reward; later deliverables add option-specific bounds and payoff.
- Production HTTPS evidence remains deferred per DEV-001 until deployment.
- Carried non-defects: dev favicon 404; New Plan binds the first Account implicitly.
