# D3 — Single options, optional provider recovery and factual settlement

Status: detailed planning draft, 2026-10-10. No implementation or tests have been run. Frozen product baseline: `specs/` at `968bc2b`; Profile A; worktree `codex-gpt-6.1-sol`.

[Planning index](../task-breakdown-d1-d3.md) · [Shared tests and evidence](test-evidence.md) · [Canonical acceptance map](../acceptance-map-d1-d3.md)

## User-visible outcome and scope

Optional provider setup → single-option Plan/opening → provider recovery or Manual evidence / Review → full ordinary exit or explicit settlement → option and resulting Stock detail.

One actual exact Call/Put Instrument per Trade; supported exact/objective selection and multiplier evidence; Plan/open/Management/full remaining ordinary exit; independent observed valuation and mark-free payoff; one selected provider for Stock/Underlying/options and available Bars; explicit expiration/cash/physical settlement, linked Stock allocation, resulting management or routed Debt. Draft scope admits factual partial settlement because a real partial assignment cannot be represented as a fabricated full event; deliberate partial Execution exits/additional entries remain D9. Provider is optional for the trader but actual selected-adapter evidence is required to release advertised recovery.

Multi-leg starts with D4 verticals; independent option scaling D9; Roll execution D11; linked correction D14. D3 creates no general contract discovery chain, theoretical pricing, synchronization, custom report, generic multi-provider framework or automatic expiration.

## Task order and blocking edges

Dependencies are prerequisites, not suggestions. Tasks inside this table are not independent releases. Every acceptance flow below also has the shared durable/failure proof required by the evidence guide.

D3-T01 is a planning prerequisite: provider feasibility/selection must be resolved before the complete plan is frozen and can be investigated before D1/D2 implementation. D3 implementation starts only after the D2 release gate; D3-T02 carries that blocking edge.

| Task | Work | Blocking prerequisites |
| --- | --- | --- |
| [D3-T01](#d3-t01) | Select and verify the single pricing provider before freezing D3 (structural planning prerequisite) | Approved Profile A; provider decision/evidence before complete-plan freeze |
| [D3-T02](#d3-t02) | Add exact option identities, durable formats and honest scope | [D2-T12](d2-stock-review-close.md#d2-t12), [D3-T01](d3-single-option-provider.md#d3-t01), [D2-T01](d2-stock-review-close.md#d2-t01) |
| [D3-T03](#d3-t03) | Assess single-option Plans and entry conformance | [D3-T02](d3-single-option-provider.md#d3-t02), [D1-T08](d1-stock-open.md#d1-t08) |
| [D3-T04](#d3-t04) | Extend confirmation, opening, management and full ordinary exit | [D3-T03](d3-single-option-provider.md#d3-t03), [D2-T05](d2-stock-review-close.md#d2-t05), [D2-T06](d2-stock-review-close.md#d2-t06) |
| [D3-T05](#d3-t05) | Calculate exact Planned and Current Expiration Payoff | [D3-T03](d3-single-option-provider.md#d3-t03), [D3-T04](d3-single-option-provider.md#d3-t04) |
| [D3-T06](#d3-t06) | Extend observed valuation and option/Underlying conditions independently | [D3-T03](d3-single-option-provider.md#d3-t03), [D3-T05](d3-single-option-provider.md#d3-t05), [D2-T04](d2-stock-review-close.md#d2-t04) |
| [D3-T07](#d3-t07) | Implement the selected provider adapter and response validation | [D3-T01](d3-single-option-provider.md#d3-t01), [D3-T02](d3-single-option-provider.md#d3-t02) |
| [D3-T08](#d3-t08) | Configure optional recovery with private write-only credentials | [D3-T07](d3-single-option-provider.md#d3-t07), [D1-T02](d1-stock-open.md#d1-t02) |
| [D3-T09](#d3-t09) | Recover bounded actual gaps with sticky Manual precedence | [D3-T07](d3-single-option-provider.md#d3-t07), [D3-T08](d3-single-option-provider.md#d3-t08), [D2-T02](d2-stock-review-close.md#d2-t02), [D2-T03](d2-stock-review-close.md#d2-t03) |
| [D3-T10](#d3-t10) | Add honest Daily Bars and extend exact-date option Review | [D3-T06](d3-single-option-provider.md#d3-t06), [D3-T09](d3-single-option-provider.md#d3-t09), [D2-T08](d2-stock-review-close.md#d2-t08), [D2-T09](d2-stock-review-close.md#d2-t09) |
| [D3-T11](#d3-t11) | Record physical settlement, explicit allocation and Stock management | [D3-T04](d3-single-option-provider.md#d3-t04), [D3-T06](d3-single-option-provider.md#d3-t06), [D3-T10](d3-single-option-provider.md#d3-t10), [D2-T05](d2-stock-review-close.md#d2-t05) |
| [D3-T12](#d3-t12) | Record explicit expiration/cash settlement and terminal semantics | [D3-T04](d3-single-option-provider.md#d3-t04), [D3-T05](d3-single-option-provider.md#d3-t05), [D3-T10](d3-single-option-provider.md#d3-t10) |
| [D3-T13](#d3-t13) | Expose the complete option/provider/settlement journey in the UI | [D3-T04](d3-single-option-provider.md#d3-t04), [D3-T05](d3-single-option-provider.md#d3-t05), [D3-T08](d3-single-option-provider.md#d3-t08), [D3-T10](d3-single-option-provider.md#d3-t10), [D3-T11](d3-single-option-provider.md#d3-t11), [D3-T12](d3-single-option-provider.md#d3-t12), [D2-T10](d2-stock-review-close.md#d2-t10) |
| [D3-T14](#d3-t14) | Extend portable Restore, update safety and reconstruction to D3 | [D3-T11](d3-single-option-provider.md#d3-t11), [D3-T12](d3-single-option-provider.md#d3-t12), [D3-T13](d3-single-option-provider.md#d3-t13), [D2-T11](d2-stock-review-close.md#d2-t11) |
| [D3-T15](#d3-t15) | Close D3 with live-provider evidence, cumulative suites and a fresh critic (structural) | [D3-T13](d3-single-option-provider.md#d3-t13), [D3-T14](d3-single-option-provider.md#d3-t14) |

## Detailed tasks and unit tests

Every case below follows the per-case red → minimal green → next case procedure in the shared guide. Dependencies may be isolated in unit tests; they are real in integration and acceptance. Case IDs are literal test-title selectors. Proposed unit path: `tests/unit/<Task-ID>.test.ts`.

### D3-T01

**Select and verify the single pricing provider before freezing D3** — structural task

**Public/confirmed test seam:** External Pricing Provider.fetch contract and browser-host/network boundary.

**Work:** Research and record one provider's official Stock/Underlying and exact option historical coverage, timestamps/session dates, Daily Bars, adjusted-contract/multiplier treatment, entitlement/cost, request/batch/rate limits, CORS and credentials. Choose direct browser access only if technically supported and credentials are not embedded in shipped assets. If a stateless relay is required, record its hosting, credential/ownership and no-journal-data boundary as a reviewed implementation decision before full-plan freeze. Trader provider setup remains optional; no vendor is chosen by this draft.

**Reproducible verification and expected result:** Save a provider decision record with primary-source URLs and verified actual requests for one Stock and one exact listed option on completed dates, plus available Bar evidence and documented unsupported case. Use a disposable credential without logging its value. Record normalization/date/coverage limits, browser feasibility and a reproducible live acceptance procedure. Cost/CORS/session policy or relay uncertainty prevents freezing D3, not writing this draft.

**Real-stack acceptance:** [D3-A07](d3-single-option-provider.md#d3-a07), [D3-A08](d3-single-option-provider.md#d3-a08).

### D3-T02

**Add exact option identities, durable formats and honest scope**

**Public/confirmed test seam:** Reference Catalog.save/resolve; Workspace migration; Trade Record option facts.

**Work:** Install one actual option Instrument per Trade: exact Underlying, Call/Put, expiration, strike, contract terms and multiplier; exact or complete objective selector evidence; physical/cash settlement facts and typed allocation lineage. Permit valid custom single-option shapes, including short Call, without inventing extra canonical seeds. Capture all future conformance and disposition inputs now. Additional deliberate entry/partial exit and multi-leg trading remain absent. Factual partial settlement is admitted because a real assignment/settlement may be partial.

**Unit group:** `describe("D3-T02 Add exact option identities, durable formats and honest scope")`

- `D3-T02-U01` — `it should normalize two contracts differing in strike, expiry, right, multiplier or terms as distinct Instruments and keep the exact Underlying reference`.
- `D3-T02-U02` — `it should reject incomplete exact identity or contradictory Plan selector criteria, but retain a truthful actual fill with absent selector-observation evidence as Not Verifiable without presumed conformance or deviation`.
- `D3-T02-U03` — `it should validate installed single-option Strategy shape by typed role/direction rather than label and preserve the canonical seed set unchanged`.
- `D3-T02-U04` — `it should preserve D1/D2 Stock identities and all audit/evidence through the lossless D2→D3 migration`.
- `D3-T02-U05` — `it should allow one actual contract key, including a truthful planned-term mismatch, but reject a second actual key or multi-leg decision outside installed scope`.
- `D3-T02-U06` — `it should persist partial factual settlement and stock allocation lineage without enabling independent option scaling or Roll execution`.

**Real-stack acceptance:** [D3-A01](d3-single-option-provider.md#d3-a01), [D3-A04](d3-single-option-provider.md#d3-a04), [D3-A05](d3-single-option-provider.md#d3-a05), [B-07](test-evidence.md#b-07), [B-12](test-evidence.md#b-12).

### D3-T03

**Assess single-option Plans and entry conformance**

**Public/confirmed test seam:** Trade Analysis.assessPlan, derive, evaluate.

**Work:** Validate single Call/Put terms, whole contract quantity, exact premium/fees and positive frozen monetary 1R. Preserve exact/objective selection criteria and actual trigger-time selection evidence. An Underlying-price Stop needs its frozen monetary loss boundary; no option valuation is inferred from Underlying movement. Capture explicit long-option Exercise Intent; short-option physical obligation is planned by confirmation. Extend initial-entry resolution and the four defined deviations without expanding their vocabulary.

**Unit group:** `describe("D3-T03 Assess single-option Plans and entry conformance")`

- `D3-T03-U01` — `it should assess F-C1 with one long Call and a coherent monetary loss boundary of 100 as a positive frozen original 1R while deriving planned premium/payoff separately`.
- `D3-T03-U02` — `it should reject zero/nonpositive baseline, fractional contract count, incomplete objective selector, inconsistent terms or an Underlying-price Stop lacking its required frozen money-loss boundary`.
- `D3-T03-U03` — `it should compare actual terms against reproducible retained selector evidence and emit one terms occurrence for all mismatches on a leg; absent required observation evidence yields Not Verifiable, never presumed conformance or deviation`.
- `D3-T03-U04` — `it should attribute an excess quantity immediately and a shortfall only when entry resolves, retaining one decision reflection across broker partial fills`.
- `D3-T03-U05` — `it should keep original baseline and entry assessment unchanged by later market observations, management and provider configuration`.
- `D3-T03-U06` — `it should record confirmed short-option underlying obligation as planned settlement, and require explicit Exercise Intent to treat a long-option exercise as authorized`.
- `D3-T03-U07` — `it should admit a valid one-leg short Call with finite positive original Stop baseline while reporting its structural worst-case risk as Unbounded rather than silently reject or cap it`.

**Real-stack acceptance:** [D3-A01](d3-single-option-provider.md#d3-a01), [D3-A03](d3-single-option-provider.md#d3-a03), [D3-A05](d3-single-option-provider.md#d3-a05).

### D3-T04

**Extend confirmation, opening, management and full ordinary exit**

**Public/confirmed test seam:** Trade Workflows.confirmPlan/recordPositionChange/reviseManagement; Journal effects.

**Work:** Reuse semantic coordinators for single-option Plan Reflection, grouped opening fills, Management, full remaining ordinary exit and distinct closing Journal obligations. Retain contract provenance, Economic Time, exact fees/Lots, terminal agency and active Close Reason. No independent partial Execution exit or additional entry before D9.

**Unit group:** `describe("D3-T04 Extend confirmation, opening, management and full ordinary exit")`

- `D3-T04-U01` — `it should confirm one immutable option Plan and completed Plan Reflection atomically, including contract/selector evidence and Exercise Intent`.
- `D3-T04-U02` — `it should open F-C1 with premium 2, multiplier 100 and fee 1 as one decision with one reflection outcome and correct remaining cost 201`.
- `D3-T04-U03` — `it should group broker partial fills for one option contract/decision with exclusive ownership and exact fee allocation rather than separate behavioral decisions`.
- `D3-T04-U04` — `it should revise option management with a completed rationale while preserving Plan Baseline, original Exercise Intent and prior versions`.
- `D3-T04-U05` — `it should close F-C1's full contract at premium 3 with fee 1 as realized P&L 98 and 0.98 original R with Closed lifecycle and the required agency Close Reason`.
- `D3-T04-U06` — `it should keep Position Change Reflection and Close Review complete/decline/defer outcomes distinct and retain trigger-time forms on any Debt`.
- `D3-T04-U07` — `it should reject stale definitions/facts, a missing active Close Reason, invalid contract or independent scaling input without any Trade/Journal partial effect`.
- `D3-T04-U08` — `it should return all changed Trade identities, post-commit analysis and Journal outcomes directly; roll back every participant on a closing/management failure`.

**Real-stack acceptance:** [D3-A01](d3-single-option-provider.md#d3-a01), [D3-A02](d3-single-option-provider.md#d3-a02), [D3-A06](d3-single-option-provider.md#d3-a06), [B-01](test-evidence.md#b-01), [B-11](test-evidence.md#b-11).

### D3-T05

**Calculate exact Planned and Current Expiration Payoff**

**Public/confirmed test seam:** Trade Analysis.expirationPayoff.

**Work:** Implement mark-free piecewise curves over nonnegative Underlying prices, exact zeros/crossing/touch/zero ranges, signed extrema and all attainment sets. Planned uses intended contracts and its defined assumptions; Current uses remaining Lots, unconsumed opening fees and realized offsets, without hypothetical future closing fees. Preserve independent applicability/coverage states.

**Unit group:** `describe("D3-T05 Calculate exact Planned and Current Expiration Payoff")`

- `D3-T05-U01` — `it should derive F-C1 Current payoff minimum -201 over Underlying prices 0 through 100, zero 102.01, and Unbounded Above maximum without needing any option or Underlying Mark`.
- `D3-T05-U02` — `it should derive the corresponding long Put minimum -201 at every price at or above 100, maximum 9799 at zero, and zero 97.99`.
- `D3-T05-U03` — `it should derive short Call/Put sign and extrema correctly, including Unbounded Below for short Call, without a chart display range clipping the result`.
- `D3-T05-U04` — `it should keep Planned payoff independent of Current actual premium, fee, remaining quantity and realized offset changes`.
- `D3-T05-U05` — `it should derive F-C2 after factual partial cash settlement with realized 298 and remaining cost 201 as minimum 97 and no zero, rather than omit realized offset or double-consume fees`.
- `D3-T05-U06` — `it should classify exact Cross, Touch and zero interval/range cases and return every minimizing/maximizing interval instead of choosing one sample`.
- `D3-T05-U07` — `it should return Not Applicable for flat Current or Stock-only exposure while missing option/Underlying Marks do not make applicable single-expiration payoff unavailable`.

**Real-stack acceptance:** [D3-A03](d3-single-option-provider.md#d3-a03), [D3-A04](d3-single-option-provider.md#d3-a04).

### D3-T06

**Extend observed valuation and option/Underlying conditions independently**

**Public/confirmed test seam:** Trade Analysis.derive/evaluate/replay; Market Data exact requirement projection.

**Work:** Require exact contract Marks for premium valuation and exact Underlying evidence only for dependent conditions. Add option risk/reward/Overrun and applicability while retaining independent known realized results and mark-free payoff. Respect actual contract multiplier. No theoretical option pricing or fill-price fallback.

**Unit group:** `describe("D3-T06 Extend observed valuation and option/Underlying conditions independently")`

- `D3-T06-U01` — `it should value F-C1 at option Mark 3 as open marked P&L 99 and 0.99 original R with exact opening-fee allocation`.
- `D3-T06-U02` — `it should retain option valuation when its Mark is available but Underlying evidence is absent, withholding only the dependent condition calculation`.
- `D3-T06-U03` — `it should retain Underlying-condition evidence and Planned/Current payoff when option Mark is absent while withholding observed premium P&L`.
- `D3-T06-U04` — `it should report acknowledged missing option/Underlying inputs and structural Unbounded risk explicitly instead of using zero, stale prices or theoretical premium`.
- `D3-T06-U05` — `it should combine independent applicable Stop/Target conditions with OR and choose the nearest nonnegative money boundary without converting an Underlying move into an invented option price`.
- `D3-T06-U06` — `it should preserve realized results from factual partial settlement and calculate F-C2 total current P&L 397 at remaining option Mark 3`.

**Real-stack acceptance:** [D3-A03](d3-single-option-provider.md#d3-a03), [D3-A04](d3-single-option-provider.md#d3-a04), [D3-A09](d3-single-option-provider.md#d3-a09).

### D3-T07

**Implement the selected provider adapter and response validation**

**Public/confirmed test seam:** External Pricing Provider.fetch; adapter transport/normalization boundary.

**Work:** Implement only the selected provider's recorded supported scope. Normalize exact Stock/option keys, completed dates, exact closes and valid available Daily Bars; bound requests and validate each item independently. Separate transport/rate/entitlement/unsupported/malformed diagnostics from facts. Unit isolation may fake transport, but live acceptance must exercise the actual selected provider.

**Unit group:** `describe("D3-T07 Implement the selected provider adapter and response validation")`

- `D3-T07-U01` — `it should encode one exact listed option's Underlying/right/expiry/strike/terms according to the verified vendor convention without fetching a similarly named contract`.
- `D3-T07-U02` — `it should normalize a valid completed-date Stock/option response to exact decimal prices and typed source provenance without binary-floating-point roundoff`.
- `D3-T07-U03` — `it should map actual timestamps and session dates under the recorded instrument-specific policy, including holiday/early-close/DST boundaries, and reject incomplete-session observations`.
- `D3-T07-U04` — `it should return valid items from a partially malformed or incomplete response alongside bounded transient diagnostics rather than discard all valid coverage`.
- `D3-T07-U05` — `it should validate finite OHLC values and their ordering and emit a Daily Bar only when the provider supplied actual range evidence`.
- `D3-T07-U06` — `it should bound instrument/date batches, pagination and retries by the recorded limits without issuing an unbounded history request`.
- `D3-T07-U07` — `it should classify unsupported contract, entitlement, rate-limit, network and malformed payload failures without fabricating a zero Mark or unavailable acknowledgment`.
- `D3-T07-U08` — `it should redact credential/query authentication material and raw response payloads from every returned diagnostic and logger path`.

**Real-stack acceptance:** [D3-A07](d3-single-option-provider.md#d3-a07), [D3-A08](d3-single-option-provider.md#d3-a08), [D3-A09](d3-single-option-provider.md#d3-a09).

### D3-T08

**Configure optional recovery with private write-only credentials**

**Public/confirmed test seam:** Market Data.getConfiguration/configure/export/prepareRestore/applyRestore.

**Work:** Expose zero/one enabled provider, Disabled/Enabled/Needs Setup and redacted credential status. Persist current credential material in a private physical store excluded from semantic backups/audit, using the same transaction where needed to make configuration/credential save atomic. Never ship credentials, return their value, retain old-secret history or promise browser encryption not supplied by the chosen design. Restored configuration cannot silently inherit a prior target credential.

**Unit group:** `describe("D3-T08 Configure optional recovery with private write-only credentials")`

- `D3-T08-U01` — `it should save configuration and supplied private credential atomically and return only redacted status plus a revision-bound configuration result`.
- `D3-T08-U02` — `it should support Disabled and Needs Setup without blocking any Manual workflow or turning provider failure into Journal Debt`.
- `D3-T08-U03` — `it should reject a stale/nonWritable configuration change before either configuration or credential material changes`.
- `D3-T08-U04` — `it should omit current and replaced credentials from semantic export, audit, query results, errors and diagnostics while retaining historical observation sources`.
- `D3-T08-U05` — `it should restore saved provider metadata as Needs Setup when its usable adapter/credential is absent and do not reuse an unrelated prior target credential`.
- `D3-T08-U06` — `it should leave both configuration and prior credential state unchanged when the private-store/configuration transaction aborts`.

**Real-stack acceptance:** [D3-A07](d3-single-option-provider.md#d3-a07), [D3-A10](d3-single-option-provider.md#d3-a10), [B-01](test-evidence.md#b-01), [B-02](test-evidence.md#b-02), [B-11](test-evidence.md#b-11).

### D3-T09

**Recover bounded actual gaps with sticky Manual precedence**

**Public/confirmed test seam:** Market Data.recover/save/query.

**Work:** Enumerate completed sessions from each exact Instrument's earliest relevant bound, fetch actual gaps and return coherent resolutions/frames/snapshot in one result. Ingest valid partial items; Manual Mark heads remain effective, provider refresh retains source/audit, and identical observations need no redundant revision. Acknowledgment never prevents later recovery. Current missing keys remain Manual tasks and historical gaps remain visible but nonblocking.

**Unit group:** `describe("D3-T09 Recover bounded actual gaps with sticky Manual precedence")`

- `D3-T09-U01` — `it should derive bounded missing-session requests from per-Instrument earliest relevance without a trader-selected arbitrary date range or refetching complete coverage`.
- `D3-T09-U02` — `it should ingest valid Stock and exact-option observations from a partial response while leaving unsupported/missing items as explicit Manual tasks`.
- `D3-T09-U03` — `it should keep a Manual Mark effective through successful provider recovery and append no hidden replacement of its authoritative head`.
- `D3-T09-U04` — `it should avoid a redundant provider Mark revision for identical effective price and record a changed effective provider price with its correction relevance`.
- `D3-T09-U05` — `it should recover an acknowledged slot to a factual available Mark without deleting its acknowledgment history`.
- `D3-T09-U06` — `it should return current resolutions, explicit historical gaps, snapshot binding and transient diagnostics without a mandatory second query`.
- `D3-T09-U07` — `it should create no acknowledgment, Journal evidence, provider-performance fact or default zero after disabled/unsupported/network failure`.
- `D3-T09-U08` — `it should commit valid returned evidence coherently and invalidate a bound Review Save after new observations, Bars or previously absent requirements arrive`.

**Real-stack acceptance:** [D3-A07](d3-single-option-provider.md#d3-a07), [D3-A08](d3-single-option-provider.md#d3-a08), [D3-A09](d3-single-option-provider.md#d3-a09), [B-11](test-evidence.md#b-11).

### D3-T10

**Add honest Daily Bars and extend exact-date option Review**

**Public/confirmed test seam:** Market Data.query; Trade Analysis.evaluate/replay; Daily Review.open/getTrade/save.

**Work:** Aggregate option and Underlying requirements, recover before one coherent Review view, and add pending factual settlement and resulting Stock management blockers. Use same-date Bar high for long single-Instrument trailing evidence, low for short, otherwise exact Mark. Gaps remain explicit; no independent intraday extrema combination for future multi-leg structures. Open creates no Review or Journal session facts; valid recovered observations are its only permissible writes.

**Unit group:** `describe("D3-T10 Add honest Daily Bars and extend exact-date option Review")`

- `D3-T10-U01` — `it should include both exact option and required Underlying keys and use earliest condition relevance bounds when opening Review`.
- `D3-T10-U02` — `it should order current Missing Marks, global due Debt, pending settlement, then trade attention with the documented reasons and stable pressure order`.
- `D3-T10-U03` — `it should create no Action, placeholder, Debt or deviation while opening Review, even when provider recovery adds legitimate market observations`.
- `D3-T10-U04` — `it should use actual same-date Bar high for a long trailing condition and low for a short one, falling back to the exact Mark when no Bar exists`.
- `D3-T10-U05` — `it should never use a Bar from another date or a historical gap as evidence of compliance or interpolate a missing session`.
- `D3-T10-U06` — `it should reject a bound Action Save when recovery adds a relevant Bar even if the close Mark price did not change, rolling back Action and reconciliation together`.
- `D3-T10-U07` — `it should keep Review Incomplete until explicit expiration/settlement and any required resulting Stock management fact are resolved, not merely described in prose`.
- `D3-T10-U08` — `it should resume Complete/Complete With Unavailable Marks/Incomplete from saved facts after offline restart with no durable session stage`.

**Real-stack acceptance:** [D3-A06](d3-single-option-provider.md#d3-a06), [D3-A08](d3-single-option-provider.md#d3-a08), [D3-A09](d3-single-option-provider.md#d3-a09), [B-01](test-evidence.md#b-01), [B-06](test-evidence.md#b-06), [B-11](test-evidence.md#b-11).

### D3-T11

**Record physical settlement, explicit allocation and Stock management**

**Public/confirmed test seam:** Trade Workflows.recordPositionChange; Trade Analysis derivation; linked Trade Record/Journal effects.

**Work:** Record explicit Assignment/Exercise at a Settlement Price. Allocate to explicitly selected compatible existing Stock Trades; only residual creates a successor with settlement-origin Plan context, not a fabricated deliberate Plan confirmation. Support resulting increase/reduction/closure/reversal. Apply option premium and opening/settlement fees exactly once in adjusted Stock basis/proceeds, preserve raw Settlement Price, typed lineage, original planning context and one originating decision reflection. Capture complete management now or routed Management Debt.

**Unit group:** `describe("D3-T11 Record physical settlement, explicit allocation and Stock management")`

- `D3-T11-U01` — `it should derive zero-fee K100/premium2 delivered-share basis/proceeds of 98 short Put, 102 long Call, 102 short Call proceeds and 98 long Put proceeds`.
- `D3-T11-U02` — `it should allocate opening fee 1 and settlement fee 2 across 100 delivered shares exactly once, producing adjusted 98.03, 102.03, 101.97 and 97.97 respectively`.
- `D3-T11-U03` — `it should allocate 40 of a short Put's 100 delivered shares to explicitly selected existing Stock and only 60 to a residual successor, preserving total adjusted basis 9800 in the zero-fee fixture; successor Stock money remains calculable with exact evidence while R discloses absent Plan Baseline rather than inventing 1R`.
- `D3-T11-U04` — `it should return Needs Resolution with no writes when destinations are ambiguous or an allocation is missing/incompatible rather than guess a Stock Trade`.
- `D3-T11-U05` — `it should apply explicitly allocated Stock additions, reductions, closures and reversals with correct lifecycle/Lots and all required terminal consequences`.
- `D3-T11-U06` — `it should treat short-option delivery as planned obligation, long-option delivery as planned only with recorded Exercise Intent, and preserve truthful typed lineage for an unplanned automatic exercise`.
- `D3-T11-U07` — `it should create only one originating Position Change Reflection and require actual resulting Stock Management or routed workflow Debt; settling that Debt with prose leaves it unresolved`.
- `D3-T11-U08` — `it should roll back option disposition, every linked Stock allocation/successor, fees, lineage, lifecycle, Journal and Debt on stale linked revisions or any participant failure`.

**Real-stack acceptance:** [D3-A05](d3-single-option-provider.md#d3-a05), [D3-A06](d3-single-option-provider.md#d3-a06), [B-01](test-evidence.md#b-01), [B-11](test-evidence.md#b-11).

### D3-T12

**Record explicit expiration/cash settlement and terminal semantics**

**Public/confirmed test seam:** Trade Workflows.recordPositionChange; Trade Analysis.derive; Journal effects.

**Work:** Support explicit worthless Expiration, cash settlement, and factual partial settlement for one contract key. A passed date creates a pending settlement task, never an automatic fact or zero-price Execution. Derive Terminal Disposition as the complete set of actual mechanisms and disposed quantities, separately from lifecycle, agency Close Reason and Option Disposition Timing. Full remaining ordinary exit after partial factual settlement remains admitted; deliberate partial Execution exit is still D9.

**Unit group:** `describe("D3-T12 Record explicit expiration/cash settlement and terminal semantics")`

- `D3-T12-U01` — `it should leave an expired but undisposed option factually Open with a blocking settlement task until explicit evidence is saved`.
- `D3-T12-U02` — `it should record worthless Expiration as its typed settlement fact and no zero-price Execution, consuming remaining Lots/fees correctly`.
- `D3-T12-U03` — `it should record F-C2's one-contract cash settlement payout of 5 with fee 1 as realized P&L 298, one contract remaining and Open lifecycle`.
- `D3-T12-U04` — `it should derive Terminal Disposition as all disposing mechanisms and quantities, and classify Option Disposition Timing separately as Fully Disposed Pre-Expiration, Fully Held to Expiration Settlement or Mixed; an expiration-day Execution remains pre-settlement disposal and Open/non-option timing is Not Applicable`.
- `D3-T12-U05` — `it should require an active Close Reason for a terminal agency decision but do not invent one for a genuinely nonagency settlement; require separate Close Review disposition in either case`.
- `D3-T12-U06` — `it should reject over-settlement, missing physical/cash outcome/Settlement Price, stale contract evidence or a failed Journal participant with no partial disposition`.

**Real-stack acceptance:** [D3-A04](d3-single-option-provider.md#d3-a04), [D3-A06](d3-single-option-provider.md#d3-a06), [B-01](test-evidence.md#b-01), [B-11](test-evidence.md#b-11).

### D3-T13

**Expose the complete option/provider/settlement journey in the UI**

**Public/confirmed test seam:** Production UI to Trade Workflows, Market Data, Daily Review and Trade Views and Reporting.

**Work:** Add single-option Plan/open/full-exit/management, provider settings with write-only credential replacement, option/Underlying evidence and independent payoff view, recovery/fallback messages, explicit cash/expiration/physical allocation forms, and routed resulting Stock management. Reuse returned post-commit state. Provide textual payoff/extrema/gaps, full keyboard support, no fake multi-leg or scaling controls.

**Unit group:** `describe("D3-T13 Expose the complete option/provider/settlement journey in the UI")`

- `D3-T13-U01` — `it should render exact contract/selector, multiplier and Exercise Intent fields with all missing/incoherent errors and one atomic confirmation gesture`.
- `D3-T13-U02` — `it should show Planned/Current payoff separately from observed P&L, preserving exact text/extrema/coverage when graph sampling or Marks are limited`.
- `D3-T13-U03` — `it should accept a supplied credential without revealing its saved value and show only redacted configuration/Needs Setup plus transient recovery context`.
- `D3-T13-U04` — `it should offer Manual resolution after partial/failed recovery and preserve the trader's Manual Mark/source through a provider refresh`.
- `D3-T13-U05` — `it should require explicit allocation and settlement mechanism/price, display adjusted basis/proceeds separately, and route actual management Debt to its factual form`.
- `D3-T13-U06` — `it should preserve active option, credential-replacement, Review and allocation fields through resize/conflict; display accepted linked results without read-back and hide uninstalled multi-leg/scaling/Roll execution`.

**Real-stack acceptance:** [D3-A01](d3-single-option-provider.md#d3-a01), [D3-A02](d3-single-option-provider.md#d3-a02), [D3-A03](d3-single-option-provider.md#d3-a03), [D3-A05](d3-single-option-provider.md#d3-a05), [D3-A06](d3-single-option-provider.md#d3-a06), [D3-A07](d3-single-option-provider.md#d3-a07), [D3-A08](d3-single-option-provider.md#d3-a08), [D3-A09](d3-single-option-provider.md#d3-a09), [B-08](test-evidence.md#b-08), [B-12](test-evidence.md#b-12).

### D3-T14

**Extend portable Restore, update safety and reconstruction to D3**

**Public/confirmed test seam:** Workspace backup/verification/Restore; all installed participant validation; private rebuild.

**Work:** Round-trip option/stock linked history, contract provenance, payoff inputs, provider-sourced observations/Bars and nonsecret provider metadata. Exclude credentials/raw payloads/transients. Validate option/allocation/fee/lineage agreement without provider I/O; all-section replace remains atomic and requires exact-target safety binding or explicit decline. Extend readiness/capacity indexes and D2→D3 migration evidence.

**Unit group:** `describe("D3-T14 Extend portable Restore, update safety and reconstruction to D3")`

- `D3-T14-U01` — `it should round-trip Manual/provider observation source history, Bars, option terms/provenance, settlement allocations, management Debt and Journal definitions with exact IDs and values`.
- `D3-T14-U02` — `it should exclude credentials, raw provider payloads and diagnostics from the actual exported file, even after provider failure or credential replacement`.
- `D3-T14-U03` — `it should prepare/restore without a provider request and land in Needs Setup without copying prior target secrets or changing historical source labels`.
- `D3-T14-U04` — `it should reject an incoherent option/multiplier/allocation/fee/lineage candidate with no writes and abort every section on replacement failure`.
- `D3-T14-U05` — `it should rebuild private projections and safely activate D3 with observationally identical Stock/option detail, payoff, Review, lineage and Debt; preserve prior compatible root/release on migration failure`.

**Real-stack acceptance:** [D3-A10](d3-single-option-provider.md#d3-a10), [D3-A11](d3-single-option-provider.md#d3-a11), [B-02](test-evidence.md#b-02), [B-03](test-evidence.md#b-03), [B-04](test-evidence.md#b-04), [B-05](test-evidence.md#b-05), [B-07](test-evidence.md#b-07), [B-09](test-evidence.md#b-09).

### D3-T15

**Close D3 with live-provider evidence, cumulative suites and a fresh critic** — structural task

**Public/confirmed test seam:** Production single-option and Stock UI; actual IndexedDB and selected provider.

**Work:** Execute D3-A01…A11, every applicable shared B flow and cumulative D1/D2 suites. Run deterministic pure-unit cases plus real-stack Manual/browser transactions and actual selected-provider integration. Run offline Manual journeys and target-scale mixed installed history. A missing vendor/entitlement/credential or untested live branch is an explicit release blocker for advertised recovery, not a passing skip. Fresh critic starts runtime and exercises every current flow, including supported live-provider flows.

**Reproducible verification and expected result:** Run shared typecheck/lint/build and cumulative unit/integration/acceptance, live-provider and D3 benchmark commands. Preserve request-date/contract/source evidence with secrets redacted, actual partial recovery and unsupported/failure Manual fallback, migration/Restore/update and rollback proof. Require the latency/correctness targets and all fresh-critic flows passing; any defect enters the test-first repair/full-rerun/new-critic loop.

**Real-stack acceptance:** [D3-A01](d3-single-option-provider.md#d3-a01), [D3-A02](d3-single-option-provider.md#d3-a02), [D3-A03](d3-single-option-provider.md#d3-a03), [D3-A04](d3-single-option-provider.md#d3-a04), [D3-A05](d3-single-option-provider.md#d3-a05), [D3-A06](d3-single-option-provider.md#d3-a06), [D3-A07](d3-single-option-provider.md#d3-a07), [D3-A08](d3-single-option-provider.md#d3-a08), [D3-A09](d3-single-option-provider.md#d3-a09), [D3-A10](d3-single-option-provider.md#d3-a10), [D3-A11](d3-single-option-provider.md#d3-a11), [B-01](test-evidence.md#b-01), [B-02](test-evidence.md#b-02), [B-03](test-evidence.md#b-03), [B-04](test-evidence.md#b-04), [B-05](test-evidence.md#b-05), [B-06](test-evidence.md#b-06), [B-07](test-evidence.md#b-07), [B-08](test-evidence.md#b-08), [B-09](test-evidence.md#b-09), [B-10](test-evidence.md#b-10), [B-11](test-evidence.md#b-11), [B-12](test-evidence.md#b-12).

## Real-stack acceptance and fresh-critic flows

These are both automated integration/production-browser flow specifications and the fresh critic's reproducible checklist. Use the fixtures in the shared guide. Every applicable B flow is repeated at the deliverable gate, not merely tested once in D1. Failure/nonmutation proof compares authoritative data, not just an error banner. Commands and evidence paths are specified in the shared guide; their scripts are to be created during authorized implementation.

### D3-A01

**Single-option Plan/opening and conformance**

**Fixture:** F-C1 synthetic Manual case; exact and objective-selector variants; Long Call, Long Put, Cash Secured Put, and valid custom one-leg short Call.

**Given:** D3 has losslessly upgraded D2 and single-option scope is installed.

**When:** Confirm with completed Plan Reflection, exact terms or complete objective evidence and explicit Exercise Intent where appropriate; record one opening decision; try incomplete contracts/selectors and a planned-term mismatch.

**Then:** One immutable Plan/baseline and one owned actual contract key are saved. F-C1 opening cost is 201; exactly one reflection outcome and truthful terms/size/intent evidence. Invalid Plan/identity inputs write nothing; absent actual selector observations remain Not Verifiable, and mismatches do not silently relabel actual contracts. A short Call can have unbounded structural risk and valid finite Stop 1R.

**Durable/failure/critic evidence:** Response/identity/revision/provenance comparison, no-write invalid cases and persisted form/contract terms after restart. Multi-leg and independent scaling are absent.

**Tasks:** [D3-T02](d3-single-option-provider.md#d3-t02), [D3-T03](d3-single-option-provider.md#d3-t03), [D3-T04](d3-single-option-provider.md#d3-t04), [D3-T13](d3-single-option-provider.md#d3-t13).

### D3-A02

**Single-option management and full ordinary exit**

**Fixture:** F-C1: premium 2, opening fee 1; exit premium 3, closing fee 1.

**Given:** One option contract is Open and ordinary terminal agency is deliberate.

**When:** Save a valid Management Revision, then full remaining exit with active Close Reason and separate reflection/Close Review dispositions.

**Then:** Original R100 remains fixed; net realized 98/0.98R, Closed lifecycle and sold disposition. Management and each Journal obligation are retained; stale/missing-reason or participant failures have no partial effects.

**Durable/failure/critic evidence:** Exact fee/Lot totals and immutable Plan, accepted linked state, B-11 aborts and restarted history.

**Tasks:** [D3-T04](d3-single-option-provider.md#d3-t04), [D3-T13](d3-single-option-provider.md#d3-t13).

### D3-A03

**Independent valuation, conditions and mark-free payoff**

**Fixture:** F-C1, analogous long Put and short Call; separate option/Underlying Missing/acknowledged/available variants.

**Given:** Option and Underlying are independent exact-date requirements.

**When:** Inspect observed P&L with option Mark 3, vary coverage through separate fixtures, inspect Planned/Current payoff and textual extrema/zeros without any Mark, and evaluate an Underlying-price condition.

**Then:** Open P&L is 99/0.99R when option Mark exists; missing Underlying withholds only its dependent condition. Payoff needs no Mark: Call minimum -201 on [0,100], zero 102.01, maximum Unbounded Above; Put maximum 9799 at zero, zero 97.99. No theoretical premium or stale fill fallback.

**Durable/failure/critic evidence:** Exact outputs against UI/accessible text, Planned-vs-Current independence, zero/extrema attainment sets and restart. Coverage and structural unboundedness are explicit.

**Tasks:** [D3-T05](d3-single-option-provider.md#d3-t05), [D3-T06](d3-single-option-provider.md#d3-t06), [D3-T13](d3-single-option-provider.md#d3-t13).

### D3-A04

**Factual partial cash settlement and remaining payoff**

**Fixture:** F-C2: two long Calls, premium 2, total opening fee 2; one contract cash payout 5, fee 1.

**Given:** A factual partial settlement occurred; deliberate partial Execution exits remain uninstalled.

**When:** Record cash settlement of one contract, inspect remaining Lots and realized/current results, then dispose of the entire remainder ordinarily.

**Then:** First result is Open with one contract, realized 298 and remaining cost 201. Current payoff minimum is 97 with no zero; total P&L is 397 at remaining Mark 3. Final result is Closed with both mechanisms and their quantities in Terminal Disposition; Option Disposition Timing is a separately derived classification. No zero-price Execution, new baseline or duplicate fee.

**Durable/failure/critic evidence:** Settlement/remaining Lot identities, exact realized/unconsumed fees, payoff outputs and one reflection per occurrence; B-11 over-settlement/abort and restart.

**Tasks:** [D3-T02](d3-single-option-provider.md#d3-t02), [D3-T05](d3-single-option-provider.md#d3-t05), [D3-T06](d3-single-option-provider.md#d3-t06), [D3-T12](d3-single-option-provider.md#d3-t12).

### D3-A05

**Physical delivery, explicit Stock allocation and lineage**

**Fixture:** F-SET: four option directions, zero-fee and fee variants, 40/60 existing/residual split, ambiguous destinations, and existing Stock addition/reduction/closure/reversal variants.

**Given:** Actual Assignment/Exercise requires delivered Stock allocation.

**When:** Record physical mechanism/Settlement Price and choose compatible destination quantities; exercise variants with and without prior intent, and complete management or defer factual management.

**Then:** Adjusted basis/proceeds are 98/102/102/98 before fees and 98.03/102.03/101.97/97.97 with fees 1+2. Apply premium/fees once; raw Settlement Price stays 100. Only residual creates successor, with no fabricated Plan confirmation/reflection. Planning lineage is truthful; management is factual or routed Debt. Ambiguous allocation writes nothing.

**Durable/failure/critic evidence:** All linked Trade/Lot/fee/lineage/Journal identities and totals, explicit destination proof, B-11 linked-revision/participant abort and restart. Linked correction remains D14.

**Tasks:** [D3-T03](d3-single-option-provider.md#d3-t03), [D3-T11](d3-single-option-provider.md#d3-t11), [D3-T13](d3-single-option-provider.md#d3-t13).

### D3-A06

**Explicit expiration and settlement-blocked Review**

**Fixture:** Expired undisposed option; worthless Expiration; cash/physical outcomes with deferred Close Review or resulting Stock Management Debt.

**Given:** Expiration has passed but no disposition fact exists.

**When:** Open Review, try to complete with prose alone, record explicit settlement/Expiration and Journal outcomes, route and complete Stock management, then restart.

**Then:** No calendar-generated settlement or zero Execution. Review stays Incomplete for pending factual settlement/management Debt. Nonagency settlement creates no invented Close Reason; terminal agency requires one. Close Review remains a separate outcome; resolving all requirements gives honest completion from facts.

**Durable/failure/critic evidence:** No-write open and no manufactured facts, routed Debt refusal, accepted terminal/management facts, preserved writing and restarted completion.

**Tasks:** [D3-T04](d3-single-option-provider.md#d3-t04), [D3-T10](d3-single-option-provider.md#d3-t10), [D3-T11](d3-single-option-provider.md#d3-t11), [D3-T12](d3-single-option-provider.md#d3-t12), [D3-T13](d3-single-option-provider.md#d3-t13).

### D3-A07

**Optional provider setup, sticky Manual and fallback**

**Fixture:** Selected actual provider, verified Stock/option keys and completed dates, existing Manual Mark, private credential supplied outside recorded artifacts.

**Given:** Manual journeys work with Disabled/Needs Setup; a trader then enables the selected provider.

**When:** Save settings, recover Stock/option observations, refresh a key with Manual evidence, disable provider and exercise failure fallback.

**Then:** Configuration returns redacted status only. Actual provider evidence has exact key/date/source; Manual head remains authoritative. Disabled/failure gives Manual tasks and transient diagnostics, no acknowledgment, Journal or provider analytics. Secrets never appear in logs/views/exports.

**Durable/failure/critic evidence:** Live adapter requests and normalized value/source evidence with authentication redacted; configuration/private-store abort checks; Manual head and no-Journal-change comparison. Vendor/entitlement is required for live evidence.

**Tasks:** [D3-T01](d3-single-option-provider.md#d3-t01), [D3-T07](d3-single-option-provider.md#d3-t07), [D3-T08](d3-single-option-provider.md#d3-t08), [D3-T09](d3-single-option-provider.md#d3-t09), [D3-T13](d3-single-option-provider.md#d3-t13).

### D3-A08

**Actual partial recovery and Review evidence race**

**Fixture:** Verified provider coverage for several keys/dates, documented unsupported case, acknowledged recoverable slot, and real network isolation between bounded requests.

**Given:** Current and historical gaps exist under Instrument-specific relevance bounds.

**When:** Recover covered and unsupported requirements, cut real transport between batches, inspect partial coverage, recover an acknowledged slot, and try to Save Review using its earlier binding.

**Then:** Valid items persist; current missing keys stay Manual tasks and historical gaps remain visible/nonblocking. No fabricated price/acknowledgment. Returned snapshot describes the result directly. New Mark/Bar/absence evidence invalidates old Save with no partial Action/reconciliation.

**Durable/failure/critic evidence:** Actual provider calls with key/date/source, bounded request trace, gap table, B-11 stale Save/rollback and restart. Canned unit responses do not satisfy this live flow; missing credential/coverage is an explicit blocker.

**Tasks:** [D3-T01](d3-single-option-provider.md#d3-t01), [D3-T07](d3-single-option-provider.md#d3-t07), [D3-T09](d3-single-option-provider.md#d3-t09), [D3-T10](d3-single-option-provider.md#d3-t10).

### D3-A09

**Actual Bars and honest trailing/series evidence**

**Fixture:** Verified provider-supplied same-date OHLC for long/short single Instrument; close-only date and missing historical session.

**Given:** Bar and Mark availability differ.

**When:** Recover Bars, inspect Review/replay frames and text, evaluate high/low trailing variants, then Save against a view whose Bar was updated.

**Then:** Use actual same-date high for long/low for short; absent Bar falls back to exact Mark, never another date or unsynchronized extrema. Close-only is a point; gaps remain unjoined. A Bar revision can cause stale Save even if close is unchanged.

**Durable/failure/critic evidence:** Provider OHLC normalization/order/source, outputs against UI, explicit gaps and B-11 Bar-binding no-write rejection. Unsupported Bar coverage stays Missing; prove a real Bar case on supported coverage.

**Tasks:** [D3-T06](d3-single-option-provider.md#d3-t06), [D3-T07](d3-single-option-provider.md#d3-t07), [D3-T09](d3-single-option-provider.md#d3-t09), [D3-T10](d3-single-option-provider.md#d3-t10), [D3-T13](d3-single-option-provider.md#d3-t13).

### D3-A10

**Secret-free option/Stock Restore and safe upgrade**

**Fixture:** Actual export with Manual/provider history, Bars, linked settlement, Management Debt and credential replacement/failure diagnostics; D2 installed Workspace.

**Given:** Source has all D3 fact families; target has a different prior provider secret.

**When:** Run B-04/B-05/B-07/B-09, inspect backup bytes, replace under exact safety binding, then stop/restart offline.

**Then:** Credentials/raw payloads/diagnostics are absent. Terms/lineage/audit/calculations round-trip without provider I/O. Restored config Needs Setup and does not inherit target secret. Failed migration/replacement preserves prior root/release; successful replacement freshly gates writes.

**Durable/failure/critic evidence:** Content/digest scan, no network during preparation/apply, exact all-section ID/value comparison, redacted credential status, rollback/readiness receipts and rebuilt views.

**Tasks:** [D3-T08](d3-single-option-provider.md#d3-t08), [D3-T14](d3-single-option-provider.md#d3-t14).

### D3-A11

**Offline option journey, scale and fresh D3 critic**

**Fixture:** Installed D3; Manual option/settlement fixtures; 25,000 Trades/200 Open/about 200,000 legal Stock/option facts plus installed Market/Journal history.

**Given:** Cumulative D1–D3 suites pass; live flows D3-A07…A09 pass separately.

**When:** Stop all processes and disable network; perform Plan/open/Manual Review/full exit/settlement with keyboard and resizing; run B-10 and fresh critic for all D3/shared flows.

**Then:** Manual functionality works durably offline; provider failure does not block it. Meet target latency with complete calculations/coverage/integrity and no N+1/all-history replay. Future correction/form history is disclosed; multi-leg/scaling/Roll/report capabilities are absent.

**Durable/failure/critic evidence:** B-06/B-08 process/offline/accessibility evidence, dataset/raw timings/query/correctness manifest, cumulative suites and fresh per-flow critic including real provider coverage. Defects require red test then another full current-flow critic.

**Tasks:** [D3-T14](d3-single-option-provider.md#d3-t14), [D3-T15](d3-single-option-provider.md#d3-t15).

## Completion gate

The last task is the release gate. All 15 tasks, 89 per-case unit specifications, 11 current acceptance flows and applicable shared B flows require actual recorded passing evidence. Earlier deliverables remain protected by cumulative tests. Migration/Restore/rebuild/capacity checks cover every newly installed fact family. No flow is currently covered and no future capability is advertised by this document.
