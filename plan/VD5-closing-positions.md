# VD5 — Closing positions

Working file for VD5 of `plan/implementation-plan.md` @ `477c8cd` (branch `zcode-glm-5.3`). Scope, sequence, and acceptance markings are the plan's; this file owns the detailed breakdown and living progress. Environment facts: see VD1 working file.

## Scope recap (authoritative source: plan §VD5)

- **User-visible outcome:** closing/reducing Position Changes for stock and single-leg option trades alike — FIFO Lot Matches consuming open lots, lot-aware opening/disposal fee allocation applied exactly once, realized P&L correct to the cent; partial closes leave the trade Open; terminal agency requires exactly one Close Reason; non-agency closes derive Terminal Disposition without one; Close Review completed/deferred/declined atomically with closure and never blocks it; lifecycle Open→Closed; Entry Resolution Point finalization and one-time Entry Quality; Entry/Exit Scaling classification; closed-trade browsing and detail.
- **Operations exercised:** `TradeWorkflows.recordPositionChange` (closing/terminal variants); `TradeAnalysis.derive` completion (lot matches, terminal disposition, entry quality, scaling classification).
- **Mechanisms:** decision-level scaling classification (not fill counts); Close Reason cardinality by agency; Close Review never blocks closure.
- **Seeds:** Close Reason selector offers **four** of five seeds (Target Reached, Stop Triggered, Thesis Invalidated, Time-Based Exit); `Rolled` waits for VD16.
- **Durable representation:** Lot-Match links, terminal facts, Close Reason/Close Review outcomes, lifecycle index transitions to Closed.
- **Acceptance (plan markings):** Full: AC-POS-001, AC-POS-004, AC-LIFE-001 (completes), AC-CALC-001 (completes), AC-POS-005 (completes for single-leg strategies; multi-leg at VD9/VD10). Partial: Option Disposition Timing limited to `Fully Disposed Pre-Expiration` (Held/Mixed complete VD16).

**Canonical numeric fixture (used across tasks, exact to the cent):** plan AAPL 100 @ 50.00, stop 45, target 60 → 1R $500.00. Opening (one decision): 100 @ 50.00 fee 1.00 + 100 @ 52.00 fee 1.00 → lots 5001.00 / 5201.00. Partial close (one decision): 150 @ 55.00 fee 0.90 → FIFO 100 from lot 1 + 50 from lot 2; opening-fee consumption 1.00 + 0.50 (0.50 stays with the open remainder); disposal fee proportional 0.60 + 0.30; realized 498.40 + 149.20 = **$647.60**; trade still Open with 50 shares (basis 2600.50 incl. unconsumed fee). Final close (one decision): 50 @ 58.00 fee 0.30 → realized 299.20; total realized **$946.80**; trade Closed; Realized R = 946.80 / 500 = 1.8936.

## Interface-freeze gate and parallel split

- **T1 pins the closing/terminal command/result types** (closing `PositionChangeCommand` variant with Close Reason and Close Review disposition, `DerivedTradeReconciliation` completion shapes, Entry Quality / Scaling / Disposition Timing value types). After T1:
  - **Track D (domain/persistence):** T2–T7.
  - **Track U (UI):** T8.
- Serialize at T10 (integration gate) and T11 (critic gate).

## Tasks

### T1 — Closing-variant interface freeze
**Type:** structural. **Depends:** VD4 complete.

**Verification:** `npm run typecheck` clean; the canonical fixture's commands/results compile against contract vocabulary.

### T2 — TradeAnalysis.derive: FIFO closing consumption and fee allocation
**Type:** behavior-bearing. **Depends:** T1.

Closing quantity consumes open Lots in FactOrder; opening fee's unconsumed portion stays with the remaining Lot; disposing fact's fee proportional across its Lot Matches; realized P&L includes both attributable portions; no price or P&L copied onto the match link; no future closing fee projected.

**Seam:** `TradeAnalysis.derive` (pure; fixtures via real commands).

```
describe("FIFO lot matching and fee allocation")
- it should match the partial close 150 @ 55.00 fee 0.90 as 100 against lot 1 and 50 against lot 2 in FactOrder and compute realized P&L of exactly $647.60 with lot-level breakdown (498.40 + 149.20)
- it should leave the 50-share remainder as an open lot carrying its 0.50 unconsumed opening fee
- it should allocate the final close 50 @ 58.00 fee 0.30 to the remaining lot and compute cumulative realized P&L of exactly $946.80 across both closing decisions
- it should store no price or P&L value on the Lot Match link itself (link + quantities + policy only)
- it should never project a closing fee onto an open lot (separately displayed incurred-fee totals are never double-subtracted)
```

### T3 — TradeAnalysis.derive: terminal disposition and lifecycle Closed
**Type:** behavior-bearing. **Depends:** T2.

Partial realization leaves the trade Open; final flat exposure closes it; Terminal Disposition derived from actual disposing mechanisms as a complete set (mixed mechanisms preserved); expected lifecycle agreement; Close Reason remains a distinct trader-declared fact, never the disposition.

**Seam:** `TradeAnalysis.derive` (pure).

```
describe("terminal derivation")
- it should keep stored/expected lifecycle Open after the partial close and transition to Closed with the final flat close, index membership changing in the same commit
- it should derive Terminal Disposition for the closed fixture as the complete mechanism set (two disposing Executions with quantities), preserved as a set rather than collapsed to one label
- it should derive Terminal Disposition from mechanisms only, keeping any Close Reason a separate displayed concept
```

### T4 — Entry Resolution Point finalization and one-time Entry Quality
**Type:** behavior-bearing. **Depends:** T2.

Window ends immediately before the first exposure-reducing Position Change (or when all planned quantity is entered / explicitly Not Entered); Entry Quality aggregates opening Executions and allocated fees inside the window only; resolved once at that point and never rewritten by later adds or (future, VD11) management; actual-entry risk/reward compared against the frozen Plan Baseline.

**Seam:** `TradeAnalysis.derive` (pure).

```
describe("Entry Resolution Point and Entry Quality")
- it should end the entry window immediately before the partial close and resolve Entry Quality once there — for the fixture, actual initial entry of 200 shares at avg 51.005 (fees included) vs planned 100 @ 50, with the comparison returned as the one resolved Entry Quality result
- it should return the identical Entry Quality after the final close (resolution point already passed; later facts cannot rewrite it) — AC-CALC-001's one-time resolution aspect
- it should keep 1R at the frozen $500.00 throughout (frozen baseline never re-derived from actuals) — AC-CALC-001's frozen-baseline aspect
- it should record Entry Size shortfall at the resolution point when actual entry resolved below planned quantity (Not Entered as the untouched-leg zero form is multi-leg and first exercisable at VD9 — rule shipped now)
```

### T5 — Entry/Exit Scaling and Option Disposition Timing (partial)
**Type:** behavior-bearing. **Depends:** T3.

Scaling counts decision-level Position Changes, not fills or legs; Option Disposition Timing classifies from explicit quantity/mechanisms with `Fully Disposed Pre-Expiration` reachable now (an Execution on expiration day is still pre-settlement disposal); `Fully Held to Expiration Settlement` / `Mixed` require settlement facts (VD16); Open/non-option trades Not Applicable.

**Seam:** `TradeAnalysis.derive` (pure).

```
describe("Entry/Exit Scaling classification")
- it should classify the fixture (1 entry decision, 2 exit decisions) as Scaled and a one-entry/one-exit fixture as SingleEntrySingleExit, counting decisions rather than fills (the 2-fill opening is one entry)
- it should return Unavailable when historical grouping is insufficient to classify

describe("Option Disposition Timing (pre-expiration scope)"
- it should classify an option trade disposed entirely by Executions before expiration as Fully Disposed Pre-Expiration, including an Execution on the expiration date itself
- it should return Not Applicable for open and non-option trades
- it should leave Held/Mixed unassertable until settlement facts exist (VD16) rather than guessing from the calendar
```

### T6 — TradeWorkflows.recordPositionChange: closing and terminal variants
**Type:** behavior-bearing. **Depends:** T2–T4, VD2-T5.

Terminal trader-directed change requires exactly one Close Reason from the four offered seeds; non-agency cardinality rule (no Close Reason manufactured — see Flag F11 for its first exercisable evidence); Close Review as a distinct obligation (Source Trade Close, Trade Anchor, its own key) completed/deferred/declined atomically with closure; closure never waits for the review; typed no-write failures; `RuntimeNotWritable`; post-commit results rendering the closed trade and journal outcomes without read-back (AC-RESP-001 update aspect).

**Seam:** `TradeWorkflows.recordPositionChange` over real participants.

```
describe("closing recordPositionChange"
- it should record the partial close and leave the trade Open with correct remaining lots, then the final close transitioning to Closed — each decision committing facts, Lot Matches, lifecycle/index, deviations, and the one Position Change Reflection outcome atomically
- it should require exactly one Close Reason on the terminal trader-directed change and reject zero or two with typed validation, no write
- it should accept Close Review deferred alongside a committed closure, creating the Debt atomically (closure never blocked) and the distinct obligation key never merging with the Position Change Reflection key
- it should accept Close Review completed or declined with the same atomicity, returning journal outcome projections in the same result
- it should reject a closing quantity exceeding open lots as a typed no-write result
- it should return RuntimeNotWritable outside a Writable session, writing nothing

describe("non-agency close cardinality (rule level)"
- it should accept a terminal change with no trader agency without requiring any Close Reason, deriving Terminal Disposition from the disposing facts alone — exercised at the derivation seam with a synthetic no-agency disposing fact; the authoritative-command path (settlement recording) is VD16 (Flag F11)
```

### T7 — Trade Views: closed-trade browsing and detail
**Type:** behavior-bearing. **Depends:** T3–T5.

Closed list (Terminal Time descending) and closed Trade Detail: stored lifecycle, derived Terminal Disposition, optional Close Reason, realized P&L and Realized R, Lot Matches, Entry Quality, Entry/Exit Scaling, Option Disposition Timing (pre-expiration scope) — as separate concepts; integrity disagreement surfaced.

**Seam:** `TradeViewsAndReporting` over the real store.

```
describe("closed-trade browse and detail"
- it should list Closed trades sorted by terminal time and render one detail containing disposition, close reason, exact realized P&L ($946.80 / 1.8936R for the fixture), lot matches, entry quality, scaling, and disposition timing as separately labeled concepts
- it should render the not-yet-classifiable Option Disposition Timing states honestly (Not Applicable now; Held/Mixed only from VD16 facts)
```

### T8 — UI: close form, close review, closed surfaces
**Type:** behavior-bearing. **Depends:** T6 (built against frozen interfaces).

From an open trade: record a reducing or terminal close decision (fills, fees, Economic Time); Close Reason selector offering exactly the four seeds on the terminal change; Close Review complete/defer/decline without blocking; closed list + detail; reflection disposition as in VD2.

**Seam:** close/closed surfaces against real modules.

```
describe("closing UI"  — seam: close form + closed surfaces
- it should offer exactly four Close Reasons on a terminal trader-directed close and require one
- it should allow closure with Close Review deferred and show the created Debt
- it should show the saved closed outcome (disposition, realized P&L, R multiple) directly from the post-commit result
- it should keep partial and final closes as separate decisions with honest remaining-position display between them
```

### T9 — Schema migration v3→v4
**Type:** structural. **Depends:** T2.

Durable additions: Lot-Match links, terminal facts, Close Reason/Close Review outcome records, Closed lifecycle index transitions.

**Verification:** migration test v3→v4 over a VD4-populated fixture: atomic activation, prior data intact, re-query equivalence; failed migration leaves v3 usable.

### T10 — VD5 integration suite additions + cumulative gate
**Type:** structural. **Depends:** T2–T9.

### T11 — Fresh browser-critic gate
**Type:** structural gate. **Depends:** T10.

## Progress table

| Task | Status | Evidence |
|---|---|---|
| T1 interface freeze | planned | |
| T2 FIFO + fee allocation | planned | |
| T3 terminal disposition + Closed | planned | |
| T4 Entry Resolution/Quality | planned | |
| T5 Scaling + Disposition Timing | planned | |
| T6 closing variants e2e | planned | |
| T7 closed views | planned | |
| T8 closing UI | planned | |
| T9 migration v3→v4 | planned | |
| T10 integration gate | planned | |
| T11 critic gate | planned | |

## Mock-free real-stack integration cases (cumulative suite)

Disclosed infrastructure: `fake-indexeddb`; fixtures through authoritative commands only.

| ID | Case | Real-stack path and durable-state proof |
|---|---|---|
| INT-VD5-01 | Full stock scaling lifecycle (AC-POS-001, AC-LIFE-001 completes) | The canonical fixture through real commands: each decision committed separately; positions/lots/matches/fees exact to the cent at each step; partial stays Open, final closes; lifecycle + index transitions per commit; restart re-query identical; histories complete |
| INT-VD5-02 | Close Reason cardinality (AC-POS-004 agency half) | Terminal trader-directed close with zero / two reasons → typed rejections, unchanged revisions; with exactly one → committed with disposition derived from mechanisms; Close Review deferred/declined/completed alongside without ever blocking (F11 covers the non-agency half) |
| INT-VD5-03 | Entry Quality one-time + frozen baseline (AC-CALC-001 completes to its VD5 scope) | Scaled-entry fixture: Entry Quality resolved at the resolution point and byte-identical after the final close; 1R $500.00 unchanged throughout; current risk computed from remaining position (management-revision aspect accrues VD11 — F12) |
| INT-VD5-04 | Option close | Long-call fixture closed by execution before expiration: multiplier-scaled realized P&L, Fully Disposed Pre-Expiration, Terminal Disposition from the execution mechanism |
| INT-VD5-05 | AC-POS-005 completes (single-leg) | End-of-trade fulfillment for the single-leg shapes: partial fill at end → PartiallyFilled with Entry Size shortfall at resolution; mismatched terms → FilledWithDeviation; explicit unplanned → Unplanned Exposure; objective-selector-no-evidence → Not Verifiable; Not Entered noted unreachable for single-leg (zero form is multi-leg, VD9) |
| INT-VD5-06 | Scaling classification | Decision-count fixtures → Scaled vs SingleEntrySingleExit; multi-fill opening counts once |

## Browser-critic flows

| ID | Flow | Pass condition |
|---|---|---|
| CRIT-VD5-01 | Partial then final close with reason + deferred review | Two decisions recorded; trade Open→Closed; realized P&L/R correct in detail; Close Review Debt appears and is resolvable |
| CRIT-VD5-02 | Close Review completed and declined paths | Both atomic with closure; decline distinct from Debt |
| CRIT-VD5-03 | Option close via UI | Contract-scaled results; disposition timing shown as pre-expiration |
| CRIT-VD5-04 | Closed browsing | Closed list/detail show disposition, reason, entry quality, scaling as separate labeled concepts |
| CRIT-VD5-05 | Validation honesty | Over-close quantity, zero/two reasons → typed rejections, values preserved |
| CRIT-VD5-06 | Resize/keyboard over new surfaces | Equivalent at both widths, keyboard-completable |

## Acceptance-scenario coverage

| Scenario | Plan marking @VD5 | VD5 owns | Tasks | Integration | Critic |
|---|---|---|---|---|---|
| AC-POS-001 | Full | entire scenario | T2, T3, T6 | INT-VD5-01 | CRIT-VD5-01 |
| AC-POS-004 | Full | agency half end-to-end + non-agency cardinality rule (F11) | T3, T6 | INT-VD5-02 | CRIT-VD5-01/05 |
| AC-LIFE-001 | Completes | full Planned→Open→(scaling)→Closed chain with agreement | T2–T4, T6 | INT-VD5-01 | CRIT-VD5-01 |
| AC-CALC-001 | Completes | frozen baseline + one-time Entry Quality + current-risk-on-remaining (management aspect accrues VD11 — F12) | T4 | INT-VD5-03 | CRIT-VD5-04 |
| AC-POS-005 | Completes (single-leg) | every single-leg-reachable fulfillment value | T2–T4 | INT-VD5-05 | CRIT-VD5-03 |
| Option Disposition Timing | Partial | FullyDisposedPreExpiration only; Held/Mixed at VD16 | T5 | INT-VD5-04 | CRIT-VD5-03 |

## Flagged for review (cited passages; no silent choice made)

- **F11 — AC-POS-004's non-agency half cannot be exercised at VD5.** Plan §VD5 marks AC-POS-004 Full; its Given requires "one terminal non-agency settlement," but settlement recording (Expiration/Assignment/Exercise/cash settlement) is a VD16 capability — decision 5: "until VD16 … expiration/assignment/exercise cannot be recorded." VD5 as drafted proves the agency half end-to-end and the no-agency cardinality rule at the derivation seam (T6). Proposed resolution: AC-POS-004's non-agency evidence completes at VD16; or accept the derivation-seam proof as satisfying the Full marking at VD5.
- **F12 — AC-CALC-001's management-revision aspect.** The scenario's Given includes "later Management Revisions"; Management Revisions arrive VD11 (decision 10). VD5 proves the frozen baseline, one-time Entry Quality, and current-risk-on-remaining-position aspects; the revisions-never-rewrite aspect accrues at VD11. Same proposed treatment: record the accrual rather than claim it now.
- **F13 — Not Entered for single-leg plans.** The untouched-leg zero form of Entry Size requires another executed leg, so it is unreachable in single-leg trades; first exercisable at VD9. The domain rule ships in T4 now. Noted so AC-POS-005's "completes for single-leg" is read as "every single-leg-reachable value."
