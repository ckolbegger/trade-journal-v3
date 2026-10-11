# VD4 — Single-leg option positions & pricing provider

Working file for VD4 of `plan/implementation-plan.md` @ `477c8cd` (branch `zcode-glm-5.3`). Scope, sequence, and acceptance markings are the plan's; this file owns the detailed breakdown and living progress. Environment facts: see VD1 working file.

## Scope recap (authoritative source: plan §VD4)

- **User-visible outcome:** single-leg option trading end to end — the strategy selector adds **Long Call, Long Put, Cash-Secured Put** (exact contract terms — underlying, type, strike, expiration — as Planned Leg selection); option opening Position Changes with position/lots/fees under the contract multiplier; the MarketData.app Pricing Provider adapter (write-only credential; Disabled/Enabled/Needs Setup) with automatic bounded mark recovery honoring Manual precedence; evaluated option views (mark-to-market, Ongoing Risk to Stop, Worst-Case Ongoing Risk, Incremental/Maximum Reward, independent underlying-price and structure-value conditions under OR semantics); Planned and Current Expiration Payoff for the single expiration anchor; Daily Review walks open option trades automatically with option marks.
- **Operations exercised:** `confirmPlan`/`recordPositionChange`/`derive` extended to option instruments (option instrument keys); `TradeAnalysis.evaluate` structure-value condition paths and `TradeAnalysis.expirationPayoff`; `PricingProvider.fetchClosingObservations`; `MarketData.recover/configureProvider/getProviderConfiguration`; `MarketData.save/query` on option instruments.
- **Mechanisms:** contract multiplier in money calculations; provider response validation and partial-response handling as transient diagnostics; provider close seeds the initial Mark on empty keys; Manual marks remain authoritative and sticky.
- **Seeds:** selector additions only (three option strategies already seeded at VD1). Provider configuration records — credential excluded from all exports by construction (proven at VD6 with credentials present).
- **Durable representation:** option instrument keys in facts and observations; nonsecret provider settings; provider provenance on recovered marks.
- **Acceptance (plan markings):** Full: AC-MARK-005 (provider recovery partial and nonbehavioral), AC-CALC-003 (completes — both condition kinds), AC-CALC-004 (completes — single-expiration anchor). Partial: the VD2 partial chains (AC-POS-001/002/005, AC-LIFE-001) exercised on option instruments with unchanged completion points (VD5/VD9/VD10); Stop-Discipline episodes against option marks join Daily Review with no new review machinery.

## Interface-freeze gate and parallel split

- **T1 pins the option-domain and provider types** (option instrument key, contract terms on Planned Legs, option variants of plan/execution commands, `ExpirationPayoffViews`, `ProviderFetchRequest/Result`, provider configuration views). After T1:
  - **Track D (domain/persistence):** T2–T9.
  - **Track U (UI):** T10–T12.
- Serialize at T14 (integration gate) and T15 (critic gate).

## Tasks

### T1 — Option/provider interface freeze
**Type:** structural. **Depends:** VD3 complete.

**Verification:** `npm run typecheck` clean; fixtures for all three strategies and a provider fetch round-trip compile against the contract vocabulary.

### T2 — Option instrument keys and multiplier money math
**Type:** behavior-bearing. **Depends:** T1.

Exact option Instrument keys (underlying, type, strike, expiration) in facts and observations; the contract multiplier applied in every money calculation; quantity semantics in contracts.

**Seam:** instrument/money modules (pure + fact-store round-trip).

```
describe("option instrument keys and multiplier arithmetic")
- it should treat two keys differing only in strike or expiration as distinct exact Instruments everywhere (facts, marks, fulfillment)
- it should scale premium × 100 × contracts into dollars in every money calculation (fixture: 1 contract @ 3.00 → $300.00 debit, exact to the cent)
- it should carry quantities in contracts through lots and P&L without a silent share conversion
```

### T3 — TradeAnalysis.assessPlan for the three option strategies
**Type:** behavior-bearing. **Depends:** T2.

Exact contract terms as Planned Leg selection; leg coherence per immutable Strategy shape; baseline with positive 1R; independently available Planned Expiration Payoff; underlying-price Stops carry a frozen monetary loss boundary for measurement without being mislabeled as structure-value triggers.

**Seam:** `TradeAnalysis.assessPlan` (pure).

```
describe("assessPlan — Long Call")
- it should accept AAPL 2026-12-18 150 C, 1 contract, intended entry 3.00, structure-value stop 1.50, target 6.00 and return 1R = $150.00 with Original Planned Reward = $300.00 and an available Planned Expiration Payoff
- it should reject a plan whose stop leaves Original Planned Risk nonpositive (stop premium ≥ entry premium) with a typed field-level rejection

describe("assessPlan — Long Put")
- it should accept AAPL 2026-11-20 140 P, 1 contract, entry 2.00, stop 1.00 with 1R = $100.00 and a bounded structural worst case

describe("assessPlan — Cash-Secured Put")
- it should accept AAPL 2026-11-20 140 P short 1 @ 2.50 credit, stop (buyback) 4.50 with 1R = $200.00, worst case bounded at (140 − 2.50) × 100 = $13,750.00, and payoff zero set {137.50} with maximum profit $250.00 attained at every underlying ≥ 140
- it should require an underlying-price option Stop to carry a frozen monetary loss boundary for measurement, distinct from structure-value trigger semantics

describe("assessPlan — exact-contract evidence")
- it should reject a leg missing strike, expiration, or option type as incomplete exact-contract evidence, naming every missing field
```

### T4 — recordPositionChange + derive on option instruments
**Type:** behavior-bearing. **Depends:** T3, VD2-T4/T6.

Option opening Position Changes: lots in contracts, fees, multiplier in P&L; fulfillment and fact-only Deviations on option legs; lifecycle Planned→Open; post-commit results per AC-RESP-001.

**Seam:** `TradeWorkflows.recordPositionChange` + `TradeAnalysis.derive` over the real store.

```
describe("option opening execution")
- it should record a two-fill opening decision on one option contract and derive the position in contracts with lot bases including allocated fees at multiplier scale (fixture: 1 @ 3.00 fee 0.65 + 1 @ 3.10 fee 0.65 → two lots, bases 300.65 and 310.65)
- it should derive Planned-Leg fulfillment for an option leg with the same evidence-bound values as stock (PartiallyFilled / FilledAsPlanned / FilledWithDeviation for a mismatched strike or expiration / Unplanned Exposure only on explicit intent)
- it should transition lifecycle Planned→Open with index membership and return post-commit projections without read-back
```

### T5 — Pricing Provider adapter (MarketData.app) and configuration
**Type:** behavior-bearing. **Depends:** T1.

`PricingProvider.fetchClosingObservations` against the MarketData.app API: bounded requests, response validation (shape/finiteness/date correctness), partial responses surfaced as data, failures as transient diagnostics; `configureProvider` (write-only credential input; Disabled / Enabled with redacted credential status / Needs Setup) and `getProviderConfiguration`; credential never returned, copied into diagnostics, or logged; historical provider provenance survives disablement.

**Seam:** provider adapter (HTTP boundary exercised against a recorded-shape local stub server; validation logic unit-tested against recorded MarketData.app response fixtures — disclosed test infrastructure).

```
describe("provider adapter validation")
- it should accept a well-formed closing-observation response and map it to provider-sourced observations without leaking provider-specific concepts beyond the port
- it should discard malformed rows (nonfinite price, wrong date, unknown symbol mapping) while keeping valid rows, reporting the partial result with transient diagnostics
- it should return a transient diagnostic — creating no Mark, acknowledgment, or provider-performance fact — on transport failure or full-response invalidity

describe("provider configuration")
- it should transition Disabled → Enabled with the credential stored write-only and the resulting view showing only redacted credential status at its new configuration revision
- it should return Needs Setup when an enabled adapter's credential is absent or unusable, without relabeling historical evidence
- it should never include the credential in any returned view, diagnostic, or log line (asserted by output scanning)
```

### T6 — MarketData.recover: bounded automatic recovery
**Type:** behavior-bearing. **Depends:** T5, VD3-T3/T4.

`recover(review date/as-of, per-Instrument earliest relevance bounds)`: enumerate completed sessions, find actual gaps, compress into bounded provider requests, preserve Manual keys, re-resolve effective status after partial response; result returns normalized snapshot-bound frames + `MarketDataSnapshotId`, current resolutions, gaps, and diagnostics without a second query; current-date Missing keys become Manual-resolution tasks; acknowledgments remain recoverable gaps; provider close seeds the initial Mark on an otherwise empty key.

**Seam:** `MarketData.recover` over the real store with the recorded-shape provider stub.

```
describe("bounded recovery")
- it should fetch only actual gaps within the supplied earliest-relevance bounds, compressing adjacent sessions into bounded requests
- it should seed the initial provider Mark on an otherwise empty key from a valid provider close, appending provenance
- it should skip keys whose effective evidence is Manual (sticky precedence) while independently retaining any valid Daily-Bar-shaped response data for later VD7 use, per AC-MARK-002's Bar carve-out
- it should leave acknowledged keys as recoverable gaps and keep their acknowledgment history intact
- it should return frames/resolutions/gaps/diagnostics in one result, with no Journal or provider-performance fact created (AC-MARK-005)
- it should return safe NotConfigured context with Manual-resolution tasks when no provider is enabled, never reporting the domain unavailable
```

### T7 — Manual stickiness vs provider refresh (AC-MARK-002 completion)
**Type:** behavior-bearing. **Depends:** T6.

Once effective evidence is Manual, later provider closes neither replace it nor become hidden Mark revisions; identical provider price creates no redundant revision; changed provider-sourced price appends a refresh revision with correction relevance.

**Seam:** `MarketData.save`/`recover` interplay over the real store.

```
describe("Manual precedence against recovery")
- it should keep a Manual override effective when recovery later returns a different provider close, appending no hidden provider Mark revision for that key
- it should append no redundant revision when recovery returns an identical provider-sourced price
- it should append a refresh revision with correction relevance when a provider-sourced effective price changes
- it should keep the override/correction meaning identifiable in history (deliberate override ≠ believed-wrong correction)
```

### T8 — TradeAnalysis.evaluate: option paths
**Type:** behavior-bearing. **Depends:** T4, VD3-T5.

Structure-value condition paths alongside underlying-price conditions; option-mark MTM; Worst-Case Ongoing Risk bounded for long-premium and short-put cases (long call: paid premium + fees; long put: bounded at strike-less-premium scale; CSP: bounded strike-less-credit); `Unbounded` worst case where a short call arises (selectable strategies can't produce it — domain rule shipped now, exercised at VD9).

**Seam:** `TradeAnalysis.evaluate` (pure).

```
describe("evaluated option views")
- it should value the long-call fixture (1 @ 3.00, mark 4.00) at $100.00 marked gain and compute structure-value risk to stop ((4.00 − 1.50) × 100 = $250.00) with the underlying-price condition independently visible with its own basis
- it should compute Worst-Case Ongoing Risk as the bounded paid-premium case for a long call/put and the bounded strike-less-credit case for the CSP fixture ($13,750.00 at the current mark's remaining exposure), never conflating it with risk-to-stop
- it should return headline values under the same nearest-nonnegative-boundary and zero-on-crossing policy with Overrun disclosure when the option mark crosses the structure-value stop
- it should keep Plan-R conversions independent of dollar Values per the availability rules
```

### T9 — TradeAnalysis.expirationPayoff: Planned and Current
**Type:** behavior-bearing. **Depends:** T3, T4.

Piecewise-linear segments over nonnegative underlying through +∞; normalized zero set (Crossings, Touches, Zero Ranges); signed extrema with complete attainment sets or Unbounded; Planned uses frozen confirmed facts; Current = realized-to-date net P&L constant offset + remaining open Lots and unconsumed opening fees, no hypothetical closing fee; Current Not Applicable when flat; stock-only Not Applicable; multiple expirations Unavailable (domain rule shipped; exercisable case arrives VD10).

**Seam:** `TradeAnalysis.expirationPayoff` (pure).

```
describe("Planned payoff")
- it should return the long-call payoff as segments with zero set {153.00}, minimum −$300.00 attained on [0, 150], and maximum Unbounded Above with its attainment set expressed exactly as the contract's attainment-notation requires for the open interval above 150
- it should return the CSP payoff with zero set {137.50}, maximum $250.00 with its complete attainment set [140, ∞), and minimum −$13,750.00 attained at 0
- it should return Not Applicable for stock-only exposure without an option expiration anchor

describe("Current payoff")
- it should return the current curve as the realized-to-date offset plus remaining lots (fixture: long call 1 @ 3.00 with mark 4.00 still open → curve shifted by the realized constant and unconsumed fees, with no projected closing fee)
- it should return Not Applicable when the position is flat
- it should produce no theoretical option price anywhere in the result (mark-free by construction)
```

### T10 — UI: option plan/execution forms and selector widening
**Type:** behavior-bearing. **Depends:** T3, T4.

Strategy selector adds exactly Long Call, Long Put, Cash-Secured Put (four values total; still no two-leg/complex entries); contract-term entry (underlying, type, strike, expiration) as Planned Leg selection; premium stop/target entry distinguishing structure-value from underlying-price conditions; option opening execution via the existing record-opening form; evaluated option sections in detail.

**Seam:** plan/execution surfaces against real modules.

```
describe("option plan and execution UI")  — seam: plan form + opening form
- it should offer exactly the four VD4 strategies in the selector (Long Stock + three single-leg options) and require exact contract terms for an option leg
- it should require the frozen monetary loss boundary when an underlying-price stop is chosen on an option plan
- it should record option fills with fees and show contract-scaled position/lots/P&L in the saved outcome
```

### T11 — UI: provider settings and payoff views
**Type:** behavior-bearing. **Depends:** T5, T6, T9.

Provider settings screen (credential input masked/write-only, enable/disable, Needs Setup presentation with safe diagnostics); automatic recovery visible in the review (marks arriving with provider provenance); Expiration Payoff view for option trades with Planned/Current as separate views, accessible textual equivalents, and unrounded read-model values.

**Seam:** provider settings + trade-detail surfaces against real modules and the recorded-shape provider stub.

```
describe("provider and payoff UI")  — seam: settings + detail surfaces
- it should show Disabled/Enabled(redacted)/Needs Setup states truthfully and never echo the credential after entry
- it should expose recovery diagnostics as transient context without domain Unavailable claims
- it should render Planned and Current payoff as distinct views with zero set, extrema, and attainment sets in readable text alongside any chart, and Not Applicable honestly when flat
```

### T12 — Daily Review on option trades + Settlement Due surfacing
**Type:** behavior-bearing. **Depends:** T6, T8, VD3-T9–T11.

Open option trades join the walk automatically with option marks (structure-value conditions in per-condition status); an option past its expiration date with no settlement fact surfaces Settlement Due as the top-band blocker in review and Trade Detail, with no inferred Expiration or Closed lifecycle — first end-to-end exercise of the VD3 machinery (AC-SET-003 blocker half).

**Seam:** `DailyReview` + Trade Detail over the real stack.

```
describe("review over option trades")  — seam: DailyReview.open/getTrade/save
- it should include an open option trade in the attention walk with its option marks and both condition kinds in the per-trade view, with no new review machinery
- it should keep a review with an expired-but-unsettled option Incomplete, showing Settlement Due with its route, and infer no Expiration fact or lifecycle change
- it should let Manual option marks entered in the review feed structure-value conditions identically to provider marks under precedence
```

### T13 — Schema migration v2→v3
**Type:** structural. **Depends:** T5.

Durable additions: nonsecret provider settings records, provider provenance fields on marks, option keys are values (no store change); verify migration v2→v3 over a VD3-populated fixture.

**Verification:** migration test: isolated candidate, atomic activation, prior data intact; failed migration leaves v2 usable; credential absent from the migrated authoritative stores by construction.

### T14 — VD4 integration suite additions + cumulative gate
**Type:** structural. **Depends:** T2–T13.

### T15 — Fresh browser-critic gate
**Type:** structural gate. **Depends:** T14.

## Progress table

| Task | Status | Evidence |
|---|---|---|
| T1 interface freeze | planned | |
| T2 option keys + multiplier | planned | |
| T3 assessPlan (3 strategies) | planned | |
| T4 option execution + derive | planned | |
| T5 provider adapter + config | planned | |
| T6 recover (bounded) | planned | |
| T7 Manual stickiness | planned | |
| T8 evaluate option paths | planned | |
| T9 expirationPayoff | planned | |
| T10 option plan/execution UI | planned | |
| T11 provider + payoff UI | planned | |
| T12 review on options + Settlement Due | planned | |
| T13 migration v2→v3 | planned | |
| T14 integration gate | planned | |
| T15 critic gate | planned | |

## Mock-free real-stack integration cases (cumulative suite)

Disclosed infrastructure: `fake-indexeddb`; a local HTTP stub server serving recorded MarketData.app response shapes (the adapter's real HTTP path runs against it); provider-validation unit fixtures recorded from MarketData.app documentation. No application module is mocked.

| ID | Case | Real-stack path and durable-state proof |
|---|---|---|
| INT-VD4-01 | Option plan → open → evaluate | confirmPlan(Long Call fixture) → recordPositionChange (2 fills w/ fees) → Manual mark 4.00 → evaluate: contract-scaled MTM $100.00, both condition kinds, bounded worst case; restart re-query identical (VD2 chains on option instruments) |
| INT-VD4-02 | Provider recovery, happy + partial | Configure provider (stub) → DailyReview.open with gaps → recovery seeds initial marks with provenance on empty keys; partial stub response → valid rows appended, invalid rows transient diagnostics, no Journal/provider-performance facts (AC-MARK-005) |
| INT-VD4-03 | Manual stickiness vs provider (AC-MARK-002 completes) | Manual override then recovery returning a different close → Manual remains effective, no hidden provider revision; identical provider price → no redundant revision; changed provider price on provider-sourced key → refresh revision |
| INT-VD4-04 | Payoff correctness (AC-CALC-004 completes) | Planned + Current payoff for the three strategies: segments, zero sets, signed extrema, attainment sets; flat → Not Applicable; stock-only → Not Applicable; current MTM sourced separately from payoff |
| INT-VD4-05 | Conditions (AC-CALC-003 completes) | Underlying-price + structure-value stops/targets with one crossed stop and one reached target on an option fixture → independent OR statuses, headline zero + Overrun, no Deviation classification for targets |
| INT-VD4-06 | Settlement Due blocker | Open short put whose expiration passed (fixture date) with no settlement fact → review Incomplete with Settlement Due; Trade Detail shows no inferred Expiration/Closed; facts unchanged |
| INT-VD4-07 | Disabled/Needs Setup honesty | Recovery with no provider → NotConfigured context + Manual tasks; manual everything works (delivery-contract Manual-before-automated rule) |

## Browser-critic flows

| ID | Flow | Pass condition |
|---|---|---|
| CRIT-VD4-01 | Plan + open a Long Call via UI | Selector offers exactly four strategies; contract terms required; saved outcome shows contract-scaled position/lots/fees |
| CRIT-VD4-02 | Configure the provider | Credential entered write-only (masked, never echoed); Enabled shows redacted status; Needs Setup shown truthfully when stub key invalid |
| CRIT-VD4-03 | Review with automatic marks | Open review on option positions → provider marks arrive with provenance; walk completes with structure-value conditions visible |
| CRIT-VD4-04 | Manual override stickiness in UI | Override a provider mark in the review; re-open/refresh recovery → Manual stays effective, history shows override meaning |
| CRIT-VD4-05 | Payoff views | Planned and Current payoff render distinctly with textual zero set/extrema/attainment; Not Applicable honest when flat |
| CRIT-VD4-06 | Settlement Due | Expired open option in review → top-band blocker + Trade Detail banner; no lifecycle inference; recording not offered (VD16) |
| CRIT-VD4-07 | Resize/keyboard pass over new surfaces | New forms/views equivalent at both widths, keyboard-completable |

## Acceptance-scenario coverage

| Scenario | Plan marking @VD4 | VD4 owns | Tasks | Integration | Critic |
|---|---|---|---|---|---|
| AC-MARK-005 | Full | entire scenario | T5, T6 | INT-VD4-02 | CRIT-VD4-03 |
| AC-CALC-003 | Completes | both condition kinds, OR semantics, Overrun, headline policy | T8 | INT-VD4-05 | CRIT-VD4-03 |
| AC-CALC-004 | Completes | single-anchor Planned/Current payoff, zero sets, extrema, attainment, N/A paths | T9 | INT-VD4-04 | CRIT-VD4-05 |
| AC-MARK-002 | (completes here per Flag F6 recommendation in the VD3 file) | provider-interaction stickiness evidence | T6, T7 | INT-VD4-03 | CRIT-VD4-04 |
| AC-POS-001/002/005, AC-LIFE-001 | Partial (unchanged completion points) | exercised on option instruments; completion still VD5/VD9/VD10 | T4 | INT-VD4-01 | CRIT-VD4-01 |
| AC-SET-003 | Partial (blocker half) | first end-to-end blocker evidence; recording completes VD16 | T12 | INT-VD4-06 | CRIT-VD4-06 |

## Flagged for review

- **F9 — Short-call `Unbounded` worst case.** Plan §VD4 names "`Unbounded` short-call where it arises"; no VD4-selectable strategy is short a call (Covered Call arrives VD9). T8 ships the domain rule; its first exercisable evidence is VD9. Confirm this reading.
- **F10 — Provider-stub evidence class.** AC-MARK-005/AC-BACK-001-adjacent provider behavior is proven against a local stub serving recorded MarketData.app response shapes (real adapter HTTP path, canned wire data), because integration tests must not depend on a live paid API. Live-API provenance evidence can be captured once as a manual record. Confirm the stub approach as the standing integration fixture.
