# Deliverable 8 — task breakdown

Scope: Single option leg strategies — Long Call, Long Put, Cash-Secured Put — plan/open/close. Builds on D7. Frozen baseline `plan/freeze.md` rev `c5d28a8a`; DEV-001 applies. The three Strategy shapes were seeded in D1 and become selectable here; they have exact contracts (underlying, Call/Put, strike, expiration, multiplier), a positive numeric Plan Baseline, Planned Leg fulfillment, and independent Planned/Current expiration payoff. Closing remains one explicit Position Change. Declared scope: no spreads, settlement, management revision, provider, reports or replay view (D8a). Stock behavior and all existing derive/plan tests stay byte-identical — option work lives in additive modules.

## Structural tasks

### D8-S1 — Capability manifest and strategy resolution
Add `TradeWorkflows.confirmPlan(LongCall|LongPut|CashSecuredPut)`, `TradeWorkflows.recordPositionChange(OptionLeg)`, `TradeAnalysis.assessPlan(OptionLeg)`, `TradeAnalysis.expirationPayoff`, `ReferenceCatalog.resolve(StrategyShape)` and `TradeViewsAndReporting.getTradeDetail(Payoff)`. Navigation keeps five entries. No spread, settlement, replay, provider, report, backup or restore capability appears.
**Verification:** `npx vitest run tests/structural/d8-capability-manifest.test.ts`.

### D8-S2 — Exact contract and durable representation
An option Planned Leg freezes the exact contract: underlying, `Call|Put`, strike, expiration date, positive integer multiplier. Execution facts carry that contract identity, signed open/close intent, quantity, price, fee and Economic Time; option Lots and FIFO Matches carry allocated fees but never copied price/P&L. Stored lifecycle/index move Planned→Open→Closed. Payoff views are derived, never stored.
**Verification:** `npx vitest run tests/structural/d8-durable-representation.test.ts`.

### D8-S3 — Strategy shapes and option vocabulary
`STRATEGY_SHAPES` maps the three seeded ids to one long Call, one long Put and one short Put role with exact contract requirements. Fulfillment vocabulary is `Unfilled | PartiallyFilled | FilledAsPlanned | FilledWithDeviation | NotEntered | NotVerifiable`; deviation categories are only Planned-Leg Terms, Entry Size, Unplanned Exposure and Stop Discipline.
**Verification:** `npx vitest run tests/structural/d8-strategy-shapes.test.ts`.

### D8-S4 — Public contract
Option confirmation and position-change modules expose no lifecycle setter, no generic `closeTrade` and no theoretical-price operation usable for valuation. One call returns a receipt and post-commit projection.
**Verification:** `npx vitest run tests/structural/d8-contracts.test.ts`.

## Behaviour-bearing tasks

### D8-T1 — Exact contract and strategy shape resolution
**Seam:** `parseOptionContract`, `canonicalInstrument`, `resolveStrategyShape` in `src/domain/option-contract.ts` / `strategy-shapes.ts`.
- `describe("option Strategy shapes")`
  - `it should resolve the three seeded single-leg shapes to their exact role and contract requirement`
  - `it should build one canonical Instrument identity from underlying, type, strike, expiration and multiplier`
  - `it should reject a missing strike, expiration or nonpositive multiplier with typed issues`
  - `it should reject an unseeded or multi-leg Strategy shape`
- **Red/green:** `npx vitest run tests/unit/option-contract.test.ts -t "<case>"`.

### D8-T2 — Option Plan assessment and positive Baseline
**Seam:** `assessOptionPlan(input)` in `src/domain/option-plan.ts`.
- `describe("option Plan assessment")`
  - `it should compute positive dollar 1R and a positive numeric Plan Baseline from exact contract economics`
  - `it should reject a nonpositive risk, invalid number or incomplete exact contract`
  - `it should freeze the Planned Leg and original management without a theoretical option price`
- **Red/green:** `npx vitest run tests/unit/option-plan.test.ts -t "<case>"`.
- **Critic flow:** changing Strategy to each of the three shapes shows a live positive 1R/Baseline; `B(op-plan)`.

### D8-T3 — Expiration payoff, not valuation
**Seam:** `expirationPayoff(input)` in `src/domain/expiration-payoff.ts`.
- `describe("expiration payoff")`
  - `it should derive the Planned payoff for a long Call, long Put and short Put from intrinsic settlement only`
  - `it should derive Current payoff as realized-to-date offset plus remaining exposure with no hypothetical closing fee`
  - `it should return all zero crossings, signed extrema and attainment sets for each available curve`
  - `it should return NotApplicable for flat exposure or a stock-only Trade and Unavailable for multiple expirations`
  - `it should accept no theoretical price, Mark or advisory IV as an input`
- **Red/green:** `npx vitest run tests/unit/expiration-payoff.test.ts -t "<case>"`.
- **Critic flow:** payoff panel shows intrinsic break-even and no model price; `B(op-payoff)`.

### D8-T4 — Option position, fulfillment and deviations
**Seam:** `deriveOptionPosition(input)` in `src/domain/option-position.ts`.
- `describe("option position and Planned Leg fulfillment")`
  - `it should derive open Lots, FEES and realized P&L for long and short single-leg exposure`
  - `it should classify Filled As Planned, Partially Filled and Not Entered from exact-contract fills`
  - `it should record one Planned-Leg Terms occurrence for all mismatched fields of one served leg`
  - `it should infer no Unplanned Exposure from a mismatch alone and no conformance from missing evidence`
  - `it should keep the four Deviation categories closed and fingerprint occurrences stably`
- **Red/green:** `npx vitest run tests/unit/option-position.test.ts -t "<case>"`.

### D8-T5 — Atomic option confirm/open/close persistence
**Seams:** `confirmOptionPlan`, `recordOptionPositionChange`, `recordOptionClose` in `src/ui/option-controller.ts`.
- `describe("option workflow integration (mock-free)")`
  - `it should atomically commit the option Trade, frozen Planned Leg and completed Plan Reflection`
  - `it should open a single option leg as one Position Change with the exact contract and one reflection outcome`
  - `it should close the leg with one Close Reason, FIFO Matches, realized P&L and Closed index membership`
  - `it should write nothing on stale revision, invalid contract or non-Writable readiness`
  - `it should survive a DB reopen with the same revision, contract and payoff inputs`
- **Red/green:** `npx vitest run tests/integration/option-workflow.test.ts -t "<case>"`.
- **Critic flow:** plan/open/close one Long Call through the UI and reload; `B(op-workflow)`.

### D8-T6 — Production UI
**Seam:** production React UI driven with `playwright-cli` and `@playwright/test`.
- `describe("single option leg UI")`
  - `it should select only the three single-leg Strategies with exact contract fields and a live positive Baseline`
  - `it should reject an incomplete contract with visible prose and no write`
  - `it should open and close a leg with exact contract, lot matches and a Close Reason`
  - `it should show the independent payoff panel without a theoretical price, adherence score or spread control`
- **Red/green:** `npx playwright test e2e/d8-options.spec.ts -g "<case>"`.
- **Critic flow:** all cases at `http://localhost:5182`; `B(op-ui-*)`.

## Evidence to capture for D8
- Per-case RED/GREEN, structural outputs, cumulative suites, fresh-critic report per `B(...)`.
- Exact Strategy id, canonical Instrument, strike/expiration/multiplier, Plan Baseline, leg fulfillment, deviation fingerprints, match ids, fee allocations, Close Reason and lifecycle/index revisions in every trace.
- No-write comparisons, DB reopen read-back, explicit clock and browser/OS provenance; local loopback only per DEV-001.
- Acceptance map: AC-PLAN-001 full for the three shapes, AC-CALC-004 full, AC-LIFE-001 full, AC-POS-002 full, AC-POS-005 partial (single-leg deviations).

## Parallelism and ownership
S1–S4 fixed before UI. T1/T2/T3 parallel once contracts are fixed; T4 depends on T1; T5 depends on T2–T4; T6 depends on T5. Single-owner resources: canonical option Instrument identity, `expirationPayoff` (D8 owns; D8a reuses unchanged), and strategy-shape resolution.
