# Deliverable 8a — task breakdown

Scope: one complete Trade Detail plus a mark-only session replay, with an advisory Black-Scholes implied-volatility explanation. Builds on D8 (released). Frozen baseline `plan/freeze.md` rev `c5d28a8a`; DEV-001 applies. The P3 spec reopening is already landed (`AC-IV-001` in `specs/acceptance/acceptance-contract.md`, the advisory exception in `specs/README.md`), so no `specs/` edit is needed. No D8a code was started before D8 was released.

Declared scope: no required candles, no manual OHLC, no bar store, no custom replay range, no combining replay with payoff, no composite adherence score or weighted grade. Advisory IV, Share Equivalent and Price-Move Decomposition are one declared advisory capability; absence removes those outputs rather than producing a domain `Unavailable`. They never change valuation, P&L, risk/reward, Stop/Target, expiration payoff, lifecycle, Deviations, Daily Review or any report, and no prediction/coaching is claimed. Navigation stays the five existing entries. `TradeAnalysis.replay` (D5) and `TradeAnalysis.expirationPayoff` (D8) are reused unchanged.

## Structural tasks

### D8A-S1 — Capability manifest
Add an additive `D8A_CAPABILITIES` / `D8A_NAVIGATION`: `TradeViewsAndReporting.getTradeDetail(Complete)`, `TradeViewsAndReporting.replayTrade(MarkOnly)`, `MarketData.query(ReadSeries)`, `Journal.query`, `ReferenceCatalog.resolve(LabelLens)` and one `TradeAnalysis.advisoryExplanation(IV)` capability. Keep the five navigation entries. No provider configuration/recovery, required Daily Bar, OHLC entry, custom range, combined replay+payoff, adherence, report, backup or restore capability appears.
**Verification:** `npx vitest run tests/structural/d8a-capability-manifest.test.ts`.

### D8A-S2 — Durable representation
No new authoritative facts and no persistence writes from any D8a view. Replay and detail are derived from persisted Marks, Trades and Journal rows; advisory values are never stored on a Trade, Mark, Journal row or payoff. Option payoff still contains no theoretical price even when the advisory capability is installed.
**Verification:** `npx vitest run tests/structural/d8a-durable-representation.test.ts`.

### D8A-S3 — Complete detail vocabulary
The complete detail exposes the required sections — identity/badges, Today against yesterday/entry, Stops and Targets, Position and Plan/entry, Payoff at expiration, Earlier Marks, deduplicated Journal, Needs you, session timeline and integrity banner — and closed descriptive figure slots: Planned Leg Fulfillment, Entry Quality, Realized R, the four Deviation categories, Plan conformance and coverage. No composite adherence score, grade or good/bad judgment exists.
**Verification:** `npx vitest run tests/structural/d8a-detail-vocabulary.test.ts`.

### D8A-S4 — Public contract
`TradeAnalysis.replay` and `expirationPayoff` expose no new parameters and keep D5/D8 signatures byte-for-byte. The advisory module exports only derivation, explanation and `Unavailable` results — no lifecycle setter, valuer, P&L/risk operation or theoretical price usable by a canonical calculation.
**Verification:** `npx vitest run tests/structural/d8a-contracts.test.ts`.

## Behaviour-bearing tasks

### D8A-T1 — Mark-only session series
**Seam:** `readSessionSeries(input)` in `src/domain/session-series.ts`, reusing `resolveFrames` and D5 `replay`.
- `describe("mark-only session replay")`
  - `it should produce one point per completed session from exact end-of-day Marks only`
  - `it should mark absent or acknowledged-unavailable sessions as explicit gaps without interpolation or carry-forward`
  - `it should attach Stop episodes and key moments from the reused replay operation`
  - `it should cap the series at the expected Mark date and never require a Daily Bar`
- **Red/green:** `npx vitest run tests/unit/session-series.test.ts -t "<case>"`.

### D8A-T2 — Advisory implied volatility
**Seam:** `advisoryImpliedVolatility(input)` in `src/domain/advisory-iv.ts`, using the stated deterministic Black-Scholes inversion (rate 0.04, calendar days/365, cent-rounded prices, bisection 0.0001–5).
- `describe("advisory implied volatility")`
  - `it should invert an observed option Mark to a stable volatility with its exact inputs`
  - `it should return stable Unavailable reasons for a missing Mark, expiration-day intrinsic Mark, no fit and negligible volatility sensitivity`
  - `it should be removed when the advisory capability is absent without changing any canonical result`
  - `it should never be an input to payoff, evaluation, P&L, risk, Stop/Target, lifecycle, Deviations, Daily Review or reports`
- **Red/green:** `npx vitest run tests/unit/advisory-iv.test.ts -t "<case>"`.

### D8A-T3 — Share equivalent and price-move decomposition
**Seam:** `advisoryShareEquivalent` and `priceMoveDecomposition` in `src/domain/advisory-decomposition.ts`.
- `describe("advisory explanation outputs")`
  - `it should return a share-equivalent sensitivity beside IV that is never a Position or hedge instruction`
  - `it should split an option price change into underlying, time and volatility contributions and label the split an estimate`
  - `it should return no partial split when either session has no reliable volatility`
  - `it should leave canonical results byte-equivalent with the advisory capability present or absent`
- **Red/green:** `npx vitest run tests/unit/advisory-decomposition.test.ts -t "<case>"`.

### D8A-T4 — Complete Trade Detail assembly
**Seam:** `buildCompleteTradeDetail(input)` in `src/domain/complete-detail.ts`, reusing `buildTradeNarrative`, `expirationPayoff`, `readSessionSeries` and the stored Trade/Journal/Mark rows with no writes.
- `describe("complete Trade Detail")`
  - `it should assemble identity, Plan, position, Lots, conditions, payoff, Earlier Marks, narrative, Needs you, timeline and integrity from persisted rows`
  - `it should populate descriptive figure slots without a composite adherence score or grade`
  - `it should show each Journal outcome once and disclose coverage and gaps without inventing facts`
- **Red/green:** `npx vitest run tests/unit/complete-detail.test.ts -t "<case>"`.

### D8A-T5 — Production UI
**Seam:** read-only React detail + replay views driven by `playwright-cli` and `@playwright/test`.
- `describe("complete detail and mark-only replay UI")`
  - `it should present one complete Trade Detail with all required sections and descriptive figure slots`
  - `it should replay session by session with a slider, explicit gaps and no interpolation or OHLC entry`
  - `it should show advisory IV, share-equivalent chips and an estimate-labelled decomposition only when installed`
  - `it should keep navigation read-only and write nothing on any detail or replay action`
- **Red/green:** `npx playwright test e2e/d8a-detail-replay.spec.ts -g "<case>"`.

### D8A-T6 — No-write and capability-gating persistence
**Seam:** `src/ui/detail-controller.ts` read assembly only.
- `describe("detail read boundary (mock-free)")`
  - `it should open a complete detail and replay after a DB reopen without writing any store`
  - `it should produce byte-equivalent canonical calculations with advisory explanation on and off`
- **Red/green:** `npx vitest run tests/integration/d8a-read-boundary.test.ts -t "<case>"`.

## Evidence to capture for D8a
- Per-case RED/GREEN, structural outputs, cumulative suites and a fresh-critic report per flow.
- Exact session dates, Mark prices/statuses, gap dates, episode fingerprints, advisory inputs, IV, share equivalent, each `Unavailable` reason and the estimate label.
- Byte-equivalence of canonical results with advisory on/off; no-write comparisons across every store; explicit clock and browser/OS provenance; loopback only per DEV-001.
- Acceptance map: AC-CALC-004 full, AC-MARK-004 full, AC-MARK-006 partial (Bar range evidence only when a Bar exists), AC-UI-002 partial, AC-RESP-001 full, AC-IV-001 provisional/advisory-only.

## Parallelism and ownership
S1–S4 fixed before UI. T1–T3 parallel once the view contracts are fixed; T4 depends on T1; T5 depends on T4; T6 depends on T2–T4. Single-owner seams: the advisory explanation capability (D8a owns), the complete detail projection (D8a owns), and the session-series read (D8a owns). `TradeAnalysis.replay` and `expirationPayoff` remain reused and unmodified.
