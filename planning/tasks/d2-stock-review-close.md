# D2 — Manually review and fully close the Stock Trade

Status: detailed planning draft, 2026-10-10. No implementation or tests have been run. Frozen product baseline: `specs/` at `968bc2b`; Profile A; worktree `codex-gpt-6.1-sol`.

[Planning index](../task-breakdown-d1-d3.md) · [Shared tests and evidence](test-evidence.md) · [Canonical acceptance map](../acceptance-map-d1-d3.md)

## User-visible outcome and scope

Open Stock Trade → exact-date Manual closing evidence → Management / explicit Daily Review Save → full exit + reflection/Close Review outcomes → Closed detail and historical Review.

Manual Mark/acknowledgment/reasoned evidence correction; Stock valuation/conditions/risk/reward; Management; exact-date Daily Review, Stop reconciliation and narrow reasoned Action Void; full closing decision including broker partial fills inside it. Provider is absent and recover returns NotConfigured with Manual work. Opening Review/getting detail does not capture writing.

Provider and single options arrive in D3. Roll/Exit/Adjust Review Actions express intent only; Roll execution remains D11/D12. Independent Stock partial exits/additional entries remain D8. Trade-fact correction is D13; general Journal Edit/Addendum/Void/custom forms are D16. The narrow Daily Review Action Void is included now because D2 completion must be reversible.

## Task order and blocking edges

Dependencies are prerequisites, not suggestions. Tasks inside this table are not independent releases. Every acceptance flow below also has the shared durable/failure proof required by the evidence guide.

| Task | Work | Blocking prerequisites |
| --- | --- | --- |
| [D2-T01](#d2-t01) | Extend durable schema and installed capability boundaries | [D1-T16](d1-stock-open.md#d1-t16) |
| [D2-T02](#d2-t02) | Save and resolve exact-date Manual closing evidence | [D2-T01](d2-stock-review-close.md#d2-t01) |
| [D2-T03](#d2-t03) | Provide honest series and nonmutating Manual-correction preview | [D2-T02](d2-stock-review-close.md#d2-t02), [D1-T08](d1-stock-open.md#d1-t08), [D1-T11](d1-stock-open.md#d1-t11) |
| [D2-T04](#d2-t04) | Calculate Stock valuation, conditions, ongoing risk and reward | [D2-T02](d2-stock-review-close.md#d2-t02), [D1-T08](d1-stock-open.md#d1-t08) |
| [D2-T05](#d2-t05) | Revise Stock management with its completed Journal evidence | [D2-T01](d2-stock-review-close.md#d2-t01), [D2-T04](d2-stock-review-close.md#d2-t04), [D1-T06](d1-stock-open.md#d1-t06), [D1-T09](d1-stock-open.md#d1-t09) |
| [D2-T06](#d2-t06) | Record the full Stock exit and separate Journal outcomes | [D2-T01](d2-stock-review-close.md#d2-t01), [D2-T04](d2-stock-review-close.md#d2-t04), [D1-T10](d1-stock-open.md#d1-t10) |
| [D2-T07](#d2-t07) | Assemble exact-date Daily Review and transparent task ordering | [D2-T02](d2-stock-review-close.md#d2-t02), [D2-T04](d2-stock-review-close.md#d2-t04), [D2-T05](d2-stock-review-close.md#d2-t05), [D2-T06](d2-stock-review-close.md#d2-t06) |
| [D2-T08](#d2-t08) | Save the dated Action and reconcile Stop Discipline atomically | [D2-T03](d2-stock-review-close.md#d2-t03), [D2-T04](d2-stock-review-close.md#d2-t04), [D2-T07](d2-stock-review-close.md#d2-t07), [D1-T06](d1-stock-open.md#d1-t06) |
| [D2-T09](#d2-t09) | Derive resumable and reversible Review completion | [D2-T06](d2-stock-review-close.md#d2-t06), [D2-T07](d2-stock-review-close.md#d2-t07), [D2-T08](d2-stock-review-close.md#d2-t08) |
| [D2-T10](#d2-t10) | Build the complete Manual Review and full-exit UI | [D2-T03](d2-stock-review-close.md#d2-t03), [D2-T05](d2-stock-review-close.md#d2-t05), [D2-T06](d2-stock-review-close.md#d2-t06), [D2-T08](d2-stock-review-close.md#d2-t08), [D2-T09](d2-stock-review-close.md#d2-t09), [D1-T12](d1-stock-open.md#d1-t12) |
| [D2-T11](#d2-t11) | Extend backup, Restore, readiness and scale projections to D2 | [D2-T09](d2-stock-review-close.md#d2-t09), [D2-T10](d2-stock-review-close.md#d2-t10), [D1-T13](d1-stock-open.md#d1-t13), [D1-T14](d1-stock-open.md#d1-t14), [D1-T15](d1-stock-open.md#d1-t15) |
| [D2-T12](#d2-t12) | Close D2 with cumulative integration and a fresh browser critic (structural) | [D2-T10](d2-stock-review-close.md#d2-t10), [D2-T11](d2-stock-review-close.md#d2-t11) |

## Detailed tasks and unit tests

Every case below follows the per-case red → minimal green → next case procedure in the shared guide. Dependencies may be isolated in unit tests; they are real in integration and acceptance. Case IDs are literal test-title selectors. Proposed unit path: `tests/unit/<Task-ID>.test.ts`.

### D2-T01

**Extend durable schema and installed capability boundaries**

**Public/confirmed test seam:** Workspace initialization/migration; Trade Record and Market Data persisted contracts.

**Work:** Add Stock disposal facts, Management Revisions, Manual Mark revisions/acknowledgments, dated Review obligations, and their indexes. Preserve D1 identities, immutable Plan/Journal snapshots, economic ordering, and exact values. Advertise Stock full exit, management, Manual evidence and Review only; no provider retrieval, scaling, Roll execution, or Trade correction controls.

**Unit group:** `describe("D2-T01 Extend durable schema and installed capability boundaries")`

- `D2-T01-U01` — `it should migrate a valid D1 Workspace losslessly and rebuild the new indexes without changing any authoritative identity, exact value, or Plan Baseline`.
- `D2-T01-U02` — `it should preserve the prior root and compatible release when candidate migration, capacity, or agreement validation fails`.
- `D2-T01-U03` — `it should reject an unknown newer schema with a recovery explanation rather than initialize an empty replacement`.
- `D2-T01-U04` — `it should include every new fact and audit revision in the installed-scope backup and Restore participant validation`.
- `D2-T01-U05` — `it should hide uninstalled provider/scaling/Roll-execution/correction capabilities while allowing a Review Action labelled Roll to record intent only`.

**Real-stack acceptance:** [B-07](test-evidence.md#b-07), [B-09](test-evidence.md#b-09), [B-12](test-evidence.md#b-12), [D2-A01](d2-stock-review-close.md#d2-a01).

### D2-T02

**Save and resolve exact-date Manual closing evidence**

**Public/confirmed test seam:** Market Data.save, query, recover.

**Work:** Implement Initial Manual Mark, Manual override, reasoned evidence correction, and explicit unavailable acknowledgment with immutable source/revision history. Resolve exact Instrument/completed date first, then acknowledgment, otherwise Missing with older observations as Stale Context. D2 recover performs no networking and returns NotConfigured diagnostics and Manual-resolution tasks. All accepted results carry directly usable snapshot-bound resolution.

**Unit group:** `describe("D2-T02 Save and resolve exact-date Manual closing evidence")`

- `D2-T02-U01` — `it should save F-S1's Manual 104 Mark for the exact completed session and return its identity, revision, source and effective resolution without a read-back query`.
- `D2-T02-U02` — `it should reject a future/incomplete-session date, invalid Instrument, blank/nonfinite price or stale expected revision without changing authoritative evidence`.
- `D2-T02-U03` — `it should keep an older valid Mark as Stale Context and never substitute its price, fill price, zero, or a carried close for the required date`.
- `D2-T02-U04` — `it should record an unavailable acknowledgment without a price and let a later exact-date Mark take precedence while preserving the acknowledgment history`.
- `D2-T02-U05` — `it should distinguish initial entry, override, and correction intentions and require the correction reason and matching impact binding for correction`.
- `D2-T02-U06` — `it should return a typed conflict when two writers replace the same effective head, leaving exactly one accepted revision`.
- `D2-T02-U07` — `it should return Manual tasks and transient NotConfigured context from recover without creating provider configuration, acknowledgments, Journal evidence, or network requests`.
- `D2-T02-U08` — `it should invalidate a bound evidence view when a Mark, acknowledgment, or previously absent required slot changes`.

**Real-stack acceptance:** [D2-A02](d2-stock-review-close.md#d2-a02), [D2-A07](d2-stock-review-close.md#d2-a07), [B-01](test-evidence.md#b-01), [B-11](test-evidence.md#b-11).

### D2-T03

**Provide honest series and nonmutating Manual-correction preview**

**Public/confirmed test seam:** Market Data.query ResolveFrames/ResolveReadSeries; Trade Views and Reporting.previewMarkChange.

**Work:** Return completed-session point/gap frames; no candles from close-only observations. Preview a candidate Manual evidence change across affected installed Stock calculations, Review intervals and Stop occurrences. Bind save to exact Trade/evidence revisions and require material-impact acknowledgment. This is evidence correction, not the later Trade-fact correction workflow.

**Unit group:** `describe("D2-T03 Provide honest series and nonmutating Manual-correction preview")`

- `D2-T03-U01` — `it should enumerate each completed session and emit a gap for every absent date without interpolation, carry-forward, or a line connecting across absence`.
- `D2-T03-U02` — `it should render a close-only Mark as a point and an acknowledgment as unavailable evidence rather than a fabricated OHLC candle`.
- `D2-T03-U03` — `it should return hypothetical candidate frames and a Stock/Review impact footprint while leaving all authoritative revisions and saved Actions unchanged`.
- `D2-T03-U04` — `it should require explicit acknowledgment when the candidate changes a Stop episode or Review conclusion and allow a nonmaterial change under its valid preview binding`.
- `D2-T03-U05` — `it should reject a preview-bound save after a concurrent Trade, Management, Mark, acknowledgment, or missing-slot change`.
- `D2-T03-U06` — `it should retain the original Manual revision, reason and source in history after an accepted evidence correction`.

**Real-stack acceptance:** [D2-A02](d2-stock-review-close.md#d2-a02), [D2-A07](d2-stock-review-close.md#d2-a07), [D2-A10](d2-stock-review-close.md#d2-a10), [B-11](test-evidence.md#b-11).

### D2-T04

**Calculate Stock valuation, conditions, ongoing risk and reward**

**Public/confirmed test seam:** Trade Analysis.derive, evaluate, replay.

**Work:** Extend pure Stock analysis with exact-date observed P&L, independent calculation states, active original/revised Stops and Targets, monetary/value/distance/percentage/ratio condition bases supported for Stock, Overrun and ongoing risk/reward. Retain original 1R and realized results when current observation is missing. No theoretical prices or hidden rounding.

**Unit group:** `describe("D2-T04 Calculate Stock valuation, conditions, ongoing risk and reward")`

- `D2-T04-U01` — `it should derive F-S1 at Mark 104 as open marked P&L 359, ongoing risk 900 and incremental reward 600 with exact R values 0.718, 1.8 and 1.2`.
- `D2-T04-U02` — `it should retain known realized amounts and frozen baseline when an exact-date Mark is Missing or acknowledged Unavailable while withholding only dependent calculations`.
- `D2-T04-U03` — `it should report Stock-only Expiration Payoff as Not Applicable instead of Unavailable or an invented option curve`.
- `D2-T04-U04` — `it should combine independent Stop and Target conditions with OR and choose the nearest nonnegative monetary boundary without combining unrelated inputs`.
- `D2-T04-U05` — `it should report a reached boundary as reached and calculate Overrun separately rather than create negative ongoing risk or treat a Target as a Stop deviation`.
- `D2-T04-U06` — `it should evaluate absolute, percentage, ratio and distance conditions with exact arithmetic and expose zero-denominator/absent-basis limitations explicitly`.
- `D2-T04-U07` — `it should replay a continuous Stop breach as one stable episode and keep historical gaps from proving compliance, breach, or a connection across dates`.

**Real-stack acceptance:** [D2-A03](d2-stock-review-close.md#d2-a03), [D2-A05](d2-stock-review-close.md#d2-a05), [D2-A07](d2-stock-review-close.md#d2-a07), [D2-A10](d2-stock-review-close.md#d2-a10).

### D2-T05

**Revise Stock management with its completed Journal evidence**

**Public/confirmed test seam:** Trade Workflows.reviseManagement; Journal.prepareEffects/applyEffects.

**Work:** Capture explicit effective time, new management conditions and completed rationale/reflection in one command. Support required paired Thesis/Invalidation rules. Keep the confirmed Plan and baseline immutable and retain all prior Management versions. Return the resulting Trade and Journal state in the accepted response.

**Unit group:** `describe("D2-T05 Revise Stock management with its completed Journal evidence")`

- `D2-T05-U01` — `it should save a valid Stock Management Revision and its completed reflection atomically and return the revision-bound post-commit Trade`.
- `D2-T05-U02` — `it should preserve original Thesis/Invalidation, original Stop/Target and frozen 1R while current management and future condition evaluation change`.
- `D2-T05-U03` — `it should reject missing rationale, an incomplete Thesis/Invalidation pair, incoherent conditions or inactive required reference with no writes`.
- `D2-T05-U04` — `it should apply management by Economic Time then recorded sequence, preserving authored time as audit rather than ordering economics by Save time`.
- `D2-T05-U05` — `it should reject a stale Trade or rendered form revision and roll back both management and writing if either participant fails`.
- `D2-T05-U06` — `it should leave fulfilled opening evidence and prior saved Stop occurrences intact unless the authorized Review reconciliation changes the latter`.

**Real-stack acceptance:** [D2-A04](d2-stock-review-close.md#d2-a04), [D2-A07](d2-stock-review-close.md#d2-a07), [B-01](test-evidence.md#b-01), [B-11](test-evidence.md#b-11).

### D2-T06

**Record the full Stock exit and separate Journal outcomes**

**Public/confirmed test seam:** Trade Workflows.recordPositionChange; Trade Analysis.derive; Journal effects.

**Work:** Dispose of all remaining shares in one explicit closing decision, which may have multiple broker partial fills. Match FIFO Lots and opening/disposal fees exactly, close lifecycle/index atomically, derive Terminal Disposition, and require an active Close Reason for terminal agency. Position Change Reflection and Close Review each have a distinct complete/decline/defer obligation. Independent partial exits remain D8.

**Unit group:** `describe("D2-T06 Record the full Stock exit and separate Journal outcomes")`

- `D2-T06-U01` — `it should close F-S1's full 100 shares at 110 with fee 2 and derive realized net P&L 957, total incurred fees 3, and 1.914 original R`.
- `D2-T06-U02` — `it should allocate two broker partial disposal fills in the same closing decision across the opening Lots with exact FIFO and no lost or duplicated fee residue`.
- `D2-T06-U03` — `it should derive Closed with no remaining exposure and one terminal agency Close Reason rather than accept an independent closeTrade or lifecycle setter`.
- `D2-T06-U04` — `it should reject an over-disposal, independent partial exit outside installed scope, missing/inactive Close Reason or stale fact/form binding without a partial close`.
- `D2-T06-U05` — `it should resolve F-S2's short initial entry at the first exposure reduction, recording the 40-share shortfall once under the original Plan`.
- `D2-T06-U06` — `it should create exactly one Position Change Reflection outcome and a separate Close Review outcome; deferred outcomes are Debt, never blank Entries`.
- `D2-T06-U07` — `it should roll back Executions, lifecycle/index, Lot Matches, deviations, Close Reason and both Journal obligations when any participant fails`.
- `D2-T06-U08` — `it should return final calculations, identities, Journal outcomes and lifecycle directly in the accepted result and preserve them across restart`.

**Real-stack acceptance:** [D2-A06](d2-stock-review-close.md#d2-a06), [D2-A08](d2-stock-review-close.md#d2-a08), [B-01](test-evidence.md#b-01), [B-11](test-evidence.md#b-11).

### D2-T07

**Assemble exact-date Daily Review and transparent task ordering**

**Public/confirmed test seam:** Daily Review.open, getTrade, getDebt; Trade Record.query StateAtEconomicCutoff.

**Work:** Resolve LatestCompleted or one exact completed date, select Trades Open at that cutoff, aggregate exact requirements and read one coherent snapshot. Present current Missing Marks, global due Debt, then applicable trade attention bands with disclosed pressure bases. D2 has no option settlement task. Merely opening/refreshing Review creates no Action, placeholder, Debt or Stop occurrence.

**Unit group:** `describe("D2-T07 Assemble exact-date Daily Review and transparent task ordering")`

- `D2-T07-U01` — `it should select a Stock Trade that is Closed now but was Open at the chosen historical cutoff, and exclude one first opened after that cutoff`.
- `D2-T07-U02` — `it should resolve the previous completed session correctly on weekends, holidays, intraday launch and an equity early-close day under the explicit calendar policy`.
- `D2-T07-U03` — `it should order current missing observations before global due Debt, including Debt on a currently Closed Trade, before trade attention tasks`.
- `D2-T07-U04` — `it should rank comparable attention within its band by selected pressure, then Last Activity descending and stable identity; disclose Not Comparable rather than manufacture a zero`.
- `D2-T07-U05` — `it should handle positive/unbounded risk against nonpositive reward as Highest and finite risk against unbounded reward as Zero without losing a reached-boundary band`.
- `D2-T07-U06` — `it should return coherent snapshot-bound details and exact-date Action status in bounded batches without one Trade query per row`.
- `D2-T07-U07` — `it should leave all authoritative revisions unchanged on open/get/refresh when D2 recovery is NotConfigured`.
- `D2-T07-U08` — `it should route Journal-only Debt to its retained form and factual workflow Debt to the required operation instead of permitting prose settlement`.

**Real-stack acceptance:** [D2-A01](d2-stock-review-close.md#d2-a01), [D2-A05](d2-stock-review-close.md#d2-a05), [D2-A08](d2-stock-review-close.md#d2-a08), [B-10](test-evidence.md#b-10).

### D2-T08

**Save the dated Action and reconcile Stop Discipline atomically**

**Public/confirmed test seam:** Daily Review.save; Trade Analysis.replay; Trade Record and Journal participants.

**Work:** Save Hold/Exit/Roll/Adjust as explicit intent under one obligation per Trade/Review Date. Hold preselection is unsaved; non-Hold requires Intent. Re-read normalized evidence, replay conditions and reconcile only the dated Stop-Discipline occurrences in the same transaction as the Action. Use review cutoff as Moment Time and actual authored Save time. Retry/revision addresses the same Entry identity.

**Unit group:** `describe("D2-T08 Save the dated Action and reconcile Stop Discipline atomically")`

- `D2-T08-U01` — `it should create no writing or reconciliation for a preselected unsaved Hold and capture both only when Save is requested`.
- `D2-T08-U02` — `it should require Intent for Exit, Roll and Adjust while allowing it to be absent for Hold, and never create trading facts from any Action`.
- `D2-T08-U03` — `it should save an Action with Daily Review Source/Trade Anchor/date origin, cutoff Moment Time and actual authored time`.
- `D2-T08-U04` — `it should atomically create or reconcile the expected continuous Stop episode and its stable fingerprint with the Action without duplicating it on a same-date retry`.
- `D2-T08-U05` — `it should update the same Action/Entry obligation under its expected revision rather than append a duplicate on retry or revision`.
- `D2-T08-U06` — `it should reject stale Trade, Market including Bar/acknowledgment/missing absence, Action, or rendered definition bindings without changing Action or occurrences`.
- `D2-T08-U07` — `it should abort both Action and Stop reconciliation on any participant failure and permit a fresh-bound retry afterward`.
- `D2-T08-U08` — `it should return saved Action, reconciliation result, completion/progress and next task directly without a mandatory reopen/read-back`.

**Real-stack acceptance:** [D2-A05](d2-stock-review-close.md#d2-a05), [D2-A07](d2-stock-review-close.md#d2-a07), [B-01](test-evidence.md#b-01), [B-11](test-evidence.md#b-11).

### D2-T09

**Derive resumable and reversible Review completion**

**Public/confirmed test seam:** Daily Review.open/save; Journal.save narrow Daily Review Action Void.

**Work:** Derive progress from facts without a saved Review session or Finish command. Incomplete means an unresolved required slot, absent valid Action, due Debt, factual blocker, unreconciled Stop occurrence or integrity issue. Explicit unavailable acknowledgments permit Complete With Unavailable Marks with named limitations. Include a reasoned visible Void of a dated Action so completion is reversible; general Journal amendments remain D16.

**Unit group:** `describe("D2-T09 Derive resumable and reversible Review completion")`

- `D2-T09-U01` — `it should remain Incomplete while any exact-date Mark lacks an acknowledgment, a required Action is absent, or due Debt remains`.
- `D2-T09-U02` — `it should become Complete only when all installed requirements are satisfied and become Complete With Unavailable Marks when acknowledged slots still prevent named dependent calculations`.
- `D2-T09-U03` — `it should resume at the same saved facts and next unresolved task after restart without a durable session stage, draft, placeholder or Finish mutation`.
- `D2-T09-U04` — `it should reopen a completed date after a reasoned Void of its sole saved Action while preserving the Entry and Void in visible audit`.
- `D2-T09-U05` — `it should reject an unreasoned/stale Action Void atomically and constrain the UI capability to Daily Review Action rather than expose uninstalled general amendments`.
- `D2-T09-U06` — `it should make current completion and Action freshness honest after a material evidence/management change, preserving prior writing and requiring authorized reconciliation rather than repairing on read`.

**Real-stack acceptance:** [D2-A05](d2-stock-review-close.md#d2-a05), [D2-A07](d2-stock-review-close.md#d2-a07), [D2-A08](d2-stock-review-close.md#d2-a08), [B-09](test-evidence.md#b-09).

### D2-T10

**Build the complete Manual Review and full-exit UI**

**Public/confirmed test seam:** Production UI calling Market Data, Trade Workflows, Daily Review and Trade Views and Reporting.

**Work:** Add required-date Manual Mark/acknowledgment forms, history and correction preview, Stock Management, Review task flow with explicit Save, full exit with both Journal outcomes, and Closed Trade detail. Show independent coverage, gap text and pressure basis. Keep Roll Action intent distinct from absent Roll-execution controls. Use returned mutation state and preserve field/focus state across narrow/wide layouts and conflicts.

**Unit group:** `describe("D2-T10 Build the complete Manual Review and full-exit UI")`

- `D2-T10-U01` — `it should show required Instrument/date, Manual source and limitations and present material correction impact before its Save acknowledgment`.
- `D2-T10-U02` — `it should render initial Hold as unsaved and call Daily Review.save once only after explicit Save with the rendered bindings`.
- `D2-T10-U03` — `it should render full-exit and Management outcomes from accepted responses without querying directly changed state to finish the command`.
- `D2-T10-U04` — `it should preserve Mark, Intent, management and close-form values/focus on resize and typed conflict without silently resubmitting`.
- `D2-T10-U05` — `it should distinguish Loading, Empty, Error, Ready partial coverage, Stale, Missing, acknowledged Unavailable and Not Applicable with accessible names and textual graph equivalents`.
- `D2-T10-U06` — `it should show a completed or reopened date from facts and route due Journal Debt, while hiding provider settings/retrieval, independent scaling and Roll execution`.

**Real-stack acceptance:** [D2-A01](d2-stock-review-close.md#d2-a01), [D2-A02](d2-stock-review-close.md#d2-a02), [D2-A04](d2-stock-review-close.md#d2-a04), [D2-A05](d2-stock-review-close.md#d2-a05), [D2-A06](d2-stock-review-close.md#d2-a06), [D2-A07](d2-stock-review-close.md#d2-a07), [D2-A10](d2-stock-review-close.md#d2-a10), [B-08](test-evidence.md#b-08), [B-12](test-evidence.md#b-12).

### D2-T11

**Extend backup, Restore, readiness and scale projections to D2**

**Public/confirmed test seam:** Workspace.exportBackup/confirmBackup/prepareRestore/applyRestore; private projection rebuild.

**Work:** Include new facts/audit, recompute derived agreement in Restore validation, rebuild date/lifecycle/lot/evidence/debt indexes, and refresh capacity/headroom for the installed schema. Recheck readiness after D1→D2 activation and Restore; existing facts remain recoverable on every failure. Add the 25,000-Trade/200,000-fact installed dataset plus Journal/Manual/management history, explicitly disclosing absent future correction/custom-form history.

**Unit group:** `describe("D2-T11 Extend backup, Restore, readiness and scale projections to D2")`

- `D2-T11-U01` — `it should round-trip D2 Mark correction/acknowledgment, Management, closed Lots/fees, deferred Journal and Action/Void history with exact identities and calculations`.
- `D2-T11-U02` — `it should reject incoherent lot/lifecycle/evidence/obligation references in preparation with no writes and disclose any permitted derived rebuild`.
- `D2-T11-U03` — `it should restore all installed sections atomically with the exact-target safety receipt or explicit warned decline and leave the target unchanged on section failure`.
- `D2-T11-U04` — `it should invalidate old Review/correction/restore bindings and re-establish readiness after successful replacement or activation`.
- `D2-T11-U05` — `it should reconstruct only private indexes from unchanged authoritative facts and return observationally identical lists, detail, Debt, Review and evidence`.

**Real-stack acceptance:** [D2-A09](d2-stock-review-close.md#d2-a09), [D2-A11](d2-stock-review-close.md#d2-a11), [B-02](test-evidence.md#b-02), [B-03](test-evidence.md#b-03), [B-04](test-evidence.md#b-04), [B-05](test-evidence.md#b-05), [B-07](test-evidence.md#b-07), [B-09](test-evidence.md#b-09), [B-10](test-evidence.md#b-10).

### D2-T12

**Close D2 with cumulative integration and a fresh browser critic** — structural task

**Public/confirmed test seam:** Production Stock UI, real browser storage, evidence harness.

**Work:** Execute D2-A01…A11, shared B flows for every D2 mutation and the cumulative D1 suites. Prove manual-only offline Review/closure, all semantic abort/race boundaries, actual D1→D2 migration, reconstruction and installed target-scale performance. Complete a fresh independent browser-critic attempt after tests pass; each defect requires a reproducing red test, minimal fix, cumulative rerun and another fresh complete current-flow critic.

**Reproducible verification and expected result:** Run the shared typecheck/lint/build, cumulative unit/integration/acceptance commands, D2 benchmark and named failure suites. Record all raw evidence, p95 ≤2,500 ms cold and ≤1,500 ms warm, exact counts/versions, no all-history replay or N+1, and every D2/shared critic flow passing. Do not claim future correction/custom-definition benchmark coverage.

**Real-stack acceptance:** [D2-A01](d2-stock-review-close.md#d2-a01), [D2-A02](d2-stock-review-close.md#d2-a02), [D2-A03](d2-stock-review-close.md#d2-a03), [D2-A04](d2-stock-review-close.md#d2-a04), [D2-A05](d2-stock-review-close.md#d2-a05), [D2-A06](d2-stock-review-close.md#d2-a06), [D2-A07](d2-stock-review-close.md#d2-a07), [D2-A08](d2-stock-review-close.md#d2-a08), [D2-A09](d2-stock-review-close.md#d2-a09), [D2-A10](d2-stock-review-close.md#d2-a10), [D2-A11](d2-stock-review-close.md#d2-a11), [B-01](test-evidence.md#b-01), [B-02](test-evidence.md#b-02), [B-03](test-evidence.md#b-03), [B-04](test-evidence.md#b-04), [B-05](test-evidence.md#b-05), [B-06](test-evidence.md#b-06), [B-07](test-evidence.md#b-07), [B-08](test-evidence.md#b-08), [B-09](test-evidence.md#b-09), [B-10](test-evidence.md#b-10), [B-11](test-evidence.md#b-11), [B-12](test-evidence.md#b-12).

## Real-stack acceptance and fresh-critic flows

These are both automated integration/production-browser flow specifications and the fresh critic's reproducible checklist. Use the fixtures in the shared guide. Every applicable B flow is repeated at the deliverable gate, not merely tested once in D1. Failure/nonmutation proof compares authoritative data, not just an error banner. Commands and evidence paths are specified in the shared guide; their scripts are to be created during authorized implementation.

### D2-A01

**D1 upgrade and manual-only Review entry**

**Fixture:** Preserved D1-A01/A03 Workspace and real D1 installed release.

**Given:** Stock data exists under D1 and provider capability is absent.

**When:** Stage/activate D2 safely, open LatestCompleted Review, then open an exact earlier completed date.

**Then:** D1 identities/writing/baseline remain intact. Exact cutoff eligibility is correction-aware within installed factual history. Missing observations become Manual tasks with safe NotConfigured context and no networking or placeholder Action.

**Durable/failure/critic evidence:** B-07 migration identity/receipt evidence; compare revisions around Review open/get; saved date policy and capability manifest show Manual-only scope.

**Tasks:** [D2-T01](d2-stock-review-close.md#d2-t01), [D2-T07](d2-stock-review-close.md#d2-t07), [D2-T10](d2-stock-review-close.md#d2-t10).

### D2-A02

**Manual evidence, acknowledgment and correction**

**Fixture:** F-S1; previous completed session with a point; next required date initially missing.

**Given:** Only an older Mark exists for the required Stock.

**When:** Open Review, enter Manual 104 on the required date, inspect history, acknowledge an unavailable date in a separate case, later save its factual Mark, and preview/save a reasoned material correction.

**Then:** Older price is Stale Context only. Available exact-date Manual price drives dependent values; acknowledgment has no price and is superseded effectively by a later Mark while remaining in history. Preview is hypothetical/nonmutating and material correction requires explicit impact acknowledgment.

**Durable/failure/critic evidence:** Resolution/snapshot receipts, B-11 stale preview branch, no-write preview comparison and immutable observation revision history after restart.

**Tasks:** [D2-T02](d2-stock-review-close.md#d2-t02), [D2-T03](d2-stock-review-close.md#d2-t03), [D2-T10](d2-stock-review-close.md#d2-t10).

### D2-A03

**Stock arithmetic and independent availability**

**Fixture:** F-S1 at Mark 104; missing and acknowledged variants; fixed exact Stop/Target conditions.

**Given:** The Stock Trade is Open with two FIFO opening Lots and frozen R500.

**When:** Inspect detail and Review, then remove required coverage only through separate valid fixture variants and evaluate representative active conditions.

**Then:** 104 produces P&L359/0.718R, ongoing risk900/1.8R, reward600/1.2R. Missing inputs withhold only dependent results; baseline/realized remain. Stop/Target OR boundaries, reached state and Overrun are truthful. Stock payoff is Not Applicable.

**Durable/failure/critic evidence:** Exact public analysis outputs matched to browser text/accessible labels; no value sourced from stale context; restart/detail results identical.

**Tasks:** [D2-T04](d2-stock-review-close.md#d2-t04), [D2-T10](d2-stock-review-close.md#d2-t10).

### D2-A04

**Management revision preserves original Plan**

**Fixture:** F-S1 with original Stop95/Target110 and baseline500.

**Given:** Current management can be revised with required rationale.

**When:** Change current Stop to97/Target112 at an explicit Economic Time with completed reflection; try an incomplete pair and stale save.

**Then:** Current management changes while original Stop/Target, Plan Thesis/Invalidation and R500 remain frozen. History/Entry retain their own times and form. Invalid/stale saves leave both facts and Journal unchanged.

**Durable/failure/critic evidence:** Accepted post-commit result, original/current side-by-side values, B-11 participant abort and restart audit.

**Tasks:** [D2-T05](d2-stock-review-close.md#d2-t05), [D2-T10](d2-stock-review-close.md#d2-t10).

### D2-A05

**Review ordering, saved intent and completion**

**Fixture:** Two Open Stock Trades, one closed Trade with due Journal Debt, Missing exact Mark, a later available slot and a Stop breach.

**Given:** Daily Review has several distinct tasks.

**When:** Open/refresh, resolve Missing Marks then global due Debt, inspect attention reasons, observe unsaved Hold, Save Hold on one Trade and Save Exit/Roll/Adjust with Intent on others, then restart.

**Then:** Task order/reasons and pressure bases are disclosed. Only explicit Save captures a dated Action and reconciliation; Action is intent and creates no disposal/Roll. Required Actions/debt determine completion from facts; restart resumes the next unresolved task. Acknowledged slots permit Complete With Unavailable Marks with named limitations.

**Durable/failure/critic evidence:** Before/open and before/save manifests, same-date Action identity and cutoff/authored times, exact one continuous Stop episode, direct returned progress and durable restarted view.

**Tasks:** [D2-T07](d2-stock-review-close.md#d2-t07), [D2-T08](d2-stock-review-close.md#d2-t08), [D2-T09](d2-stock-review-close.md#d2-t09), [D2-T10](d2-stock-review-close.md#d2-t10).

### D2-A06

**Full Stock exit and distinct closing writing**

**Fixture:** F-S1 with opening fee1; full exit100@110 fee2 split into optional broker partial fills of one decision.

**Given:** Remaining 100 shares exist and a full disposal is deliberate.

**When:** Record the full closing decision with an active Close Reason, complete/decline/defer the two distinct Journal obligations in separate cases, then inspect Closed detail.

**Then:** FIFO net P&L957, fees3 and1.914R; no exposure remains, lifecycleClosed and derived sold disposition. One Position Change Reflection outcome and a separate Close Review outcome exist. Broker partials remain one decision; independent partial exit is absent.

**Durable/failure/critic evidence:** Owned Execution/Lot Match exact fee totals, response state, Journal IDs/Debt and history after restart; over-disposal/missing reason tests compare no-write manifests.

**Tasks:** [D2-T06](d2-stock-review-close.md#d2-t06), [D2-T10](d2-stock-review-close.md#d2-t10).

### D2-A07

**Evidence races, atomic Stop reconciliation and reversible Action**

**Fixture:** Exact-date Review with one saved Stop episode and material Manual correction candidates; second browser writer.

**Given:** A Review view is bound to Trade/Market/Action/form revisions.

**When:** Change a relevant Mark, acknowledgment, missing slot or Management in the other writer; attempt stale Save. Inject participant abort, retry fresh, revise same-date Action, reasoned Void its saved Action, and reopen.

**Then:** Stale/aborted saves change neither Action nor Stop occurrences. Valid save reconciles exactly once under stable fingerprints; retries/revisions retain Entry identity. Reasoned visible Action Void makes the date Incomplete with history intact; read never repairs it.

**Durable/failure/critic evidence:** B-11 every-binding fault table and before/after manifests, no duplicate occurrence/Entry, visible audit and restarted progress. Bar-specific race extends in D3; Trade-fact correction extends in D13.

**Tasks:** [D2-T02](d2-stock-review-close.md#d2-t02), [D2-T03](d2-stock-review-close.md#d2-t03), [D2-T05](d2-stock-review-close.md#d2-t05), [D2-T08](d2-stock-review-close.md#d2-t08), [D2-T09](d2-stock-review-close.md#d2-t09).

### D2-A08

**Initial shortfall, full closure and historical eligibility**

**Fixture:** F-S2 Plan100, one opening60, later full exit60; earlier cutoff while Open.

**Given:** Initial entry has not resolved before the first exposure reduction.

**When:** Record the full exit, resolve or defer closing writing, then open the earlier Review and a cutoff after terminal time.

**Then:** Entry resolves once with shortfall40; frozen baseline stays original. Earlier Review includes the currently Closed Trade and its date-specific requirements; later cutoff excludes it from eligible Open Trades. Global due Debt remains reachable regardless of current lifecycle.

**Durable/failure/critic evidence:** Entry Resolution/Quality/Deviation IDs, economic ordering/cutoff membership and Journal Debt after restart.

**Tasks:** [D2-T06](d2-stock-review-close.md#d2-t06), [D2-T07](d2-stock-review-close.md#d2-t07), [D2-T09](d2-stock-review-close.md#d2-t09).

### D2-A09

**D2 backup/Restore, update failure and private rebuild**

**Fixture:** D2 Manual revision/acknowledgment, Management, Closed Trade, Action/Void and Debt history; actual exported files.

**Given:** All new installed fact families are present.

**When:** Run B-04/B-05/B-07/B-09, including exact-target safety binding, section failure and D1→D2 migration failure in isolated specimens.

**Then:** Round trips preserve facts/audit/exact values and reproduce Lots/fees/Review. No provider request occurs. Failed validation/migration/replacement preserves prior target/root/release; successful replacement discards old forms and reruns readiness.

**Durable/failure/critic evidence:** All-section equality manifest, source/digest/receipt provenance, no-write/rollback/restart results and observational reconstruction diff.

**Tasks:** [D2-T01](d2-stock-review-close.md#d2-t01), [D2-T11](d2-stock-review-close.md#d2-t11).

### D2-A10

**Stopped offline Stock review/closure and accessible gaps**

**Fixture:** D2 installed production inventory and valid Stock history with a missing historical session.

**Given:** The application has been completely stopped and network is disabled.

**When:** Reopen same-profile application, enter Manual evidence, revise management, save Review and full exit; resize forms and inspect point/gap chart using keyboard/text.

**Then:** Every Manual D2 workflow succeeds durably offline. Historical gap remains explicit and is not joined or made into a candle. Required-date source/availability, pressure and validation are accessible and survive live layout changes.

**Durable/failure/critic evidence:** B-06/B-08 offline process/network evidence, source inventory hash, actual browser mutations and post-restart comparison.

**Tasks:** [D2-T03](d2-stock-review-close.md#d2-t03), [D2-T10](d2-stock-review-close.md#d2-t10), [D2-T11](d2-stock-review-close.md#d2-t11).

### D2-A11

**Installed target scale and independent D2 release gate**

**Fixture:** 25,000 Trades with200Open and200,000 legal Stock Execution facts plus realistic installed Journal/Manual/Management/Action history.

**Given:** Cumulative D1/D2 suites and all current flows pass.

**When:** Run B-10 with offline timings/query traces and a fresh critic starting the runtime and executing D2-A01…A11 and applicable shared flows.

**Then:** Meet p95 limits with full corrected-cutoff eligibility, calculations, integrity and coverage. No all-history replay/N+1; disclose absent future correction/custom-definition history rather than certify it.

**Durable/failure/critic evidence:** Dataset counts/provenance, raw latency samples, exact source/runtime environment, cumulative evidence and fresh per-flow report; test-first repair loop for any defect.

**Tasks:** [D2-T11](d2-stock-review-close.md#d2-t11), [D2-T12](d2-stock-review-close.md#d2-t12).

## Completion gate

The last task is the release gate. All 12 tasks, 73 per-case unit specifications, 11 current acceptance flows and applicable shared B flows require actual recorded passing evidence. Earlier deliverables remain protected by cumulative tests. Migration/Restore/rebuild/capacity checks cover every newly installed fact family. No flow is currently covered and no future capability is advertised by this document.
