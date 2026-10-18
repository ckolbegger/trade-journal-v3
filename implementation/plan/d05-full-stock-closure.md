# D5 — Full Stock closure: detailed task breakdown

Status: planning draft; implementation and claimed passing evidence are not authorized. Provisional under the [trader-approved per-deliverable planning approach, 2026-10-17](../delivery-plan.md#accepted-planning-approach--2026-10-17); review before this deliverable is implemented.
Authority: [D5 in the delivery plan](../delivery-plan.md#5-close-a-long-stock-trade), [Trade Workflows](../../specs/design/trade-workflows.md), [Trade Analysis](../../specs/design/trade-analysis.md) and [D1 shared rules](d01-long-stock-plan.md). Prerequisite: completed D4. Test seams/cases are proposed for review.

## Outcome, stories and boundaries

- As a trader, I would like to close my entire Long Stock position, so that I can see the realized result and the factual Closed lifecycle.
- As a trader, I would like to complete or explicitly defer or decline my Close Review, so that I can close the position without losing the reflection obligation.

Production flow: Open Trade Detail → record full-exit Position Change → one or multiple sell Executions disposing of the entire remaining position → select one active Close Reason → choose separate Position Change Reflection and Close Review dispositions → Save → returned Closed Trade with realized P&L/R, FIFO links, reason, terminal mechanism and Journal outcomes. Queue remains reachable for both deferred obligations. Factual closure never waits for prose.

Complete Stock exit only; broker partial fills inside one complete decision are not scaled exits. Quantity must exactly flatten the current Long Stock Position. No partial-exit control, reversal, options/non-agency settlement, Rolled reason, Abandon, correction or management revision. These remain D11/D7/D15/D27/D9/D18/D16. Historical Review reads include earlier Open-at-cutoff exposure after today's closure. Backup follows in D6 and Restore in D17 under the approved timing exception.

## Durable effects, decimals and migration

Add logical representation version D5: sell Execution/disposal facts, active quantity-only FIFO Lot Matches and agreement history, Closed lifecycle binding/index transition, terminal Close Reason fact and close economic instant, and a separate Close Review obligation/outcome chain. Recorded links contain opening/disposal identity and quantity; basis, price, P&L and fee allocation are derived from immutable facts. Persist stable realization ordering and causal metadata needed by later Outcomes. Terminal Disposition derives from disposing facts, never a captured label.

Seed four protected Close Reasons exactly: Target Reached, Stop Triggered, Thesis Invalidated, Time-Based Exit. Rolled stays absent until D27. Add exact Close Review definition and Source Trade Close. Each Position Change still has one Position Change Reflection; terminal Close Review has its own obligation key/Entry identity, Trade Anchor and Source Trade Close. Complete/Defer/Decline for each is explicitly submitted (UI may preselect Defer). Due-time policy for deferred Close Review is terminal Economic Time; completing/declining through D2's Journal-only route retains trigger form and origin. Definitions contain no Close Reason prompt that replaces the Trade fact.

Migrate D4 through isolated candidate generation and atomic activation; preserve Action keys, anchors, Stop episode evidence and all prompt snapshots. Rebuild private open/terminal/realization indexes from facts after validation. Authoritative lifecycle and active Lot links are checked by Trade Analysis and changed only in the owning command. On migration failure, prior compatible release/data remain usable; D6 adds backup recovery.

Full-exit transaction rechecks exact Trade revision/remaining quantities, active retained references and new reason selection/catalog snapshot, both definitions and outcome absence/revisions, generation/readiness/Workspace binding. Commit disposal members, sequences, FIFO links/agreement, lifecycle/index, terminal reason, fact-only deviations, Journal outcomes and applicable workflow-bound Debt retirement if factual exposure is removed, private invalidation and Workspace revision together. Ordinary Journal-only reflection Debt remains owed; closure does not erase it. There is no management Debt created through D1–D5 ordinary Stock flows. Return all directly changed Trade/Journal projections, exact net realized P&L/R and Terminal Disposition only after durable commit; no read-back to render success.

## Explicit task completion edges

These are blocking edges for task completion. UI work may start after the contract-fixing task, as described under parallelism, but cannot finish before its real domain/persistence prerequisites. Review/freeze prerequisites remain external to this implementation graph.

| Task | Required predecessor tasks |
|---|---|
| D5-T01 | D4-T07 |
| D5-T02 | D5-T01 |
| D5-T03 | D5-T01 |
| D5-T04 | D5-T02, D5-T03 |
| D5-T05 | D5-T04 |
| D5-T06 | D5-T04, D5-T05 |
| D5-T07 | D5-T01, D5-T02, D5-T03, D5-T04, D5-T05, D5-T06 |

## Ordered tasks and concrete cases

D1's one-case Red → minimal Green → next-case evidence applies to each behavior below. Structural checks state verifiable outcomes. All tasks are inside the closure slice.

### D5-T01 — Fix disposal/terminal contracts and stage D4→D5 (structural)

Blocked by D4-T07. Single schema/seed/transaction owner extends the installed recordPositionChange variant without a separate closeTrade API. Fix quantity/FIFO/terminal outcome rules, indexes and exact receipts before parallel tasks.

Verification: eventual typecheck/build; exact normalized four-reason/Close Review seed comparison; migrate command-populated D4 fixtures and run I04, including failure/crash/retry and nonoverwriting seed behavior. No new reason/definition appears without its consuming closure capability.

### D5-T02 — Derive FIFO whole-disposal and terminal results

Blocked by D5-T01. Owner: Trade Analysis; seams `derive/assessChange` on supplied candidate Stock facts.

`describe("full Stock FIFO disposal")`

Use D2 opening: 40 shares at 49 fee 1, 60 at 51 fee 2. Exit in one decision: 30 at 54 fee 0.3, then 70 at 56 fee 0.7.

- it should match first sale to 30 of first Lot, then second sale to remaining 10 of first and 60 of second; quantities consume exactly 100, position becomes flat and expected lifecycle Closed.
- it should return net realizations 148.95, 69.65 and 297.4 in economic/Recorded Sequence order, totaling 516, incurred fees 4 and Realized R 1.032 using unchanged frozen 1R 500.
- it should conserve every opening and disposing fee exactly once; a 3-share opening with fee 1 and 1/2-share disposal members retains exact 1/3 and 2/3 portions, summing to 1 without rounded residual bookkeeping.
- it should derive Execution-only Terminal Disposition for all disposed quantities, independent of trader Close Reason or Close Review answers; current flat valuation/payoff/risk states are independently Not Applicable where their installed semantics require.
- it should reject a sell total below or above current remaining quantity, wrong Instrument, negative fee or disposal preceding its opening in economic order, with no accepted candidate.
- it should retain resolved initial Entry Quality and frozen Plan Baseline after exit; multiple broker fills in each of the single entry/exit decisions classify Single Entry / Single Exit, not Scaled.

### D5-T03 — Prepare distinct terminal Journal outcomes and reason validation

Blocked by D5-T01. Owners: Journal/Reference Catalog; public seams `prepareEffects`, definition reads, reason `query/resolve` and Journal-only Debt.save.

`describe("Close Review is a separate obligation")`

- it should require exactly one active Close Reason for the trader-directed terminal candidate, rejecting zero, two or invalid/wrong-kind/inactive selections, and bind that Catalog revision.
- it should validate completed Close Review's required take-again option and optional worked/lesson text against the exact displayed definition, without altering Close Reason.
- it should prepare distinct Complete/Defer/Decline outcomes for Position Change Reflection and Close Review, each with its own key/source/origin and no placeholder Entry.
- it should retain preexisting ordinary reflection Debt through closure; an applicable workflow-routed management obligation may retire only with owning-workflow flat-exposure evidence.
- it should answer/decline deferred Close Review using its original snapshot and return the complete outcome/transition under one revision, conflict on stale duplicate resolution.

### D5-T04 — Atomically record full-exit Position Change

Blocked by D5-T02/D5-T03. Owner: Trade Workflows/Transaction. Seam `recordPositionChange` full Stock disposal variant.

`describe("durable terminal Stock command")`

- it should commit disposal Executions, FIFO quantity links, Closed membership, one reason and both Journal outcomes together, returning all direct subjects and required derivation at exact committed revisions.
- it should close with Defer or Decline independently for either reflection even while earlier Journal-only Debt is outstanding; factual closure does not depend on prose.
- it should reject stale quantities/fact revision, a reason changed between resolve and commit, or competing whole exits, with no new fact/outcome/index writes.
- it should roll back all disposal, agreement, lifecycle/reason, sequence and Journal changes on induced participant failure; restart observes the full pre-state or full committed post-state.
- it should reject at persistence boundary with RuntimeNotWritable after a late readiness failure, even if UI previously enabled Save.

### D5-T05 — Extend terminal views and historical Review eligibility

Blocked by D5-T04. Owner: Trade Views and Reporting/Daily Review, using analysis outputs rather than duplicated arithmetic. Seams `browseTrades/getTradeDetail` and Review `open/getTrade`.

`describe("Closed detail and historical Review")`

- it should show final net P&L/R, all FIFO links/fees, reason, derived Terminal Disposition, Plan/Entry Quality and both reflection outcomes in one coherent Closed Detail; current Marks are not required for final result.
- it should remove Closed Trade from current Open list and show it in Closed list atomically, while a Review at an earlier completed cutoff still includes it if it was Open then.
- it should exclude the Trade at a cutoff after its whole exit, without erasing any saved prior Action or outstanding global due Debt.
- it should surface lifecycle/lot/deviation integrity disagreement without read repair, and preserve stable execution/Journaling navigation after restart.

### D5-T06 — Deliver full-exit and terminal-review UI

Blocked by D5-T01 for fixed contracts; integrates after T04/T05. Owner: UI/shell.

`describe("complete exit production UI")`

- it should capture several disposal fills under one decision, show exact remaining quantity validation and separate Close Reason/Position Change Reflection/Close Review controls.
- it should preserve input on validation/conflict and live resize; Cancel or unsubmitted Defer preselection produces no Exit, Debt or Entry.
- it should render returned Closed state and both outcome projections without a command-required read-back, with explicit net result/fees and distinct lifecycle/reason/mechanism labels.
- it should expose deferred Close Review in the existing queue and support keyboard/focus/radio/zoom behavior; no partial-reduction or Rolled option appears.

### D5-T07 — Cumulative integration and fresh browser gate (structural)

Blocked by D5-T01–D5-T06. Verify all installed D1–D5 regressions, release/capability inventory and evidence below. A fresh critic starts its own strict-port production runtime and runs B01–B04 without editing. Each defect needs a reproducing failed regression before production fix, complete cumulative rerun and a new critic repeating all D5 flows. Ambiguity goes to user; missing critic/browser/runtime blocks completion.

## Mock-free real-stack evidence

Only fast test infrastructure may use fake-indexeddb; no coordinator, analysis, Journal or transaction mocks. Fixtures call real initialize/Catalog/confirmPlan/opening/Mark/Action commands. Native IndexedDB verifies transaction abort/restart, competing tabs and readiness independently.

| Case | Procedure / expected proof |
|---|---|
| D5-I01 | Execute exact 40/60 opening and 30/70 full exit with real modules; compare literal FIFO links, fee/P&L/R and returned revisions to reopened Trade/Journal state. Query authoritative Open/Closed membership and anchors. |
| D5-I02 | Exercise all nine independent reflection disposition combinations on separate command-created Trades. Exactly two obligation keys with legal outcomes persist; outstanding earlier Debt does not prevent closure. Answer/decline Close Review; no duplicate Entry. |
| D5-I03 | Competing full exits from one revision; induced abort after Trade staging/before Journal; controlled late storage/readiness failure. Compare complete normalized participant histories and Workspace binding before/after failure/restart; no mixed state or response issued before commit. |
| D5-I04 | D4→D5 candidate migration, blocked/failure/crash/retry; delete only private realization/terminal/Journal projections and reconstruct equivalent terminal views. All facts/anchors/prompts/episode links survive. |
| D5-I05 | Open Trade through a prior cutoff; save dated Action, then whole exit after cutoff. Exact historical Review includes it while latest post-exit Review excludes it; global due Debt remains. No Mark is required to inspect final Closed P&L. |

## Planned browser flows

- **D5-B01:** Complete multi-fill exit, choose a reason, complete both forms, inspect returned Closed result/fee/FIFO detail; stop browser, disconnect network and reopen history/final result.
- **D5-B02:** Defer/decline Close Review independently of Position Change Reflection; factual closure succeeds. Resolve due Close Review through queue, demonstrate required fields, cancel and no placeholder entries.
- **D5-B03:** Two tabs compete on exit; wrong total/invalid reason/late readiness blocks save with preserved input. Inspect earlier exact Review eligibility and unchanged earlier Action after closure.
- **D5-B04:** B01/B02 keyboard-only and axe/manual checks at 390/1440 px, live 767/768 resize and 200% zoom; final signs, unavailable states, reason/mechanism distinctions and Loading/Empty/Error/Conflict remain accessible.

## Acceptance mapping

Every row **planned**, never a claimed pass; D1's shared reproducible commands/provenance apply.

| Scenario | Scope / later full completion | Tasks; evidence |
|---|---|---|
| AC-LIFE-001, AC-POS-001 | Partial: full Stock closure and FIFO from multiple broker fills in complete decisions. Scaling/full fixture D11 | T02/T04/T05; I01/I03/I04; B01/B03 |
| AC-POS-004 | Partial: terminal trader agency/exact one reason and independent Close Review. Non-agency full fixture D7 | T03/T04; I02/I03; B01/B02 |
| AC-CALC-001 | Partial: initial comparison and frozen 1R survive closure. Scaling D10–D11; management/full D16 | T02/T05; I01; B01 |
| AC-JOUR-007, AC-REF-001 | Partial: exact Close Review/source and four usable reason seeds. Fixed Journal D15/customization full D23; complete Catalog/Rolled D27 | T01/T03; I02/I04; B02 |
| AC-REV-001–002 | Partial: later-closed historical eligibility/resumption/global Debt. Full corrected eligibility D18; settlement task ordering D15 | T05; I05; B03 |
| AC-LIFE-003 | Full inherited for installed terminal agreement/no read repair | T02/T05; I01/I04; B01/B03 |
| AC-RESP-001 | Partial globally, complete installed terminal multi-subject receipt. Multi-Trade full D15 | T04/T06; I01/I02; B01/B02 traces |
| AC-JOUR-003, AC-JOUR-001 | Full inherited: closure unblocked by Debt, explicit Save only | T03/T04/T06; I02; B02 |
| AC-JOUR-005 | Partial distinct terminal keys/retries; sole-answer Void/reopen full D19 | T03/T04; I02/I03; B02/B03 |
| AC-DEL-001–004, AC-CAP-001, AC-UI-001 | Full installed release under backup/Restore timing exception | T01/T04/T06/T07; I01–I05; B01–B04; D1 repeated readiness/update matrix |
| AC-DEL-005–006, AC-REST-004 | Partial read-only recovery/gated writes and safe migration; D6 export; Restore/full D17 | T04/T07; I03/I04; B03 |
| AC-UI-002 | Partial globally, complete installed exit/terminal screens; full Restore D17 | T06/T07; B04 |
| AC-REBUILD-001, AC-PERF-001 | Partial installed full-Stock history/reconstruction and target-scale correctness/latency; mixed full D28 | T01/T05/T07; I04; D1 timing/equivalence procedure |

Other canonical scenarios stay intentionally unadvertised under D1's full disposition ledger; a full exit is not permission to implement scaling or settlement.

## Ownership and parallel edges

After T01, Analysis T02 and Journal/reason T03 can proceed independently; T04 joins both. T05 follows real commit, UI T06 can start from fixed types but cannot pass without integrated runtime, T07 waits for all. Single owners control fee/analysis policy, Trade agreement and schema/generation, Journal obligation keys/seeds, transaction/Workspace revisions and shell/release manifests. No blanket parallel work across deliverables.
