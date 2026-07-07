# Slice 5 — Scaling in & out

A Trade's size becomes dynamic: repeat fills build the position across multiple Lots, partial closes realize P&L against the oldest Lots first (FIFO, ADR 0015), and the Trade stays open — with honest per-Leg realized/unrealized — until it's actually flat. This slice introduces the Lot internals Slice 1 deliberately deferred, refactoring valuation behind Slice 1's green tests.

**Decided in this slice:**

- **Opening fees travel with their Lot, consumed proportionally.** A partial close's realized P&L is net of the closing Execution's fees plus the consumed fraction of each consumed Lot's opening fees. (Slice 1's full-close math is the degenerate case — its tests stay green.)
- **A closing Execution may not cross through zero.** Selling 120 when holding 80 long is rejected; flattening and reversing are two Executions (a flip is a new direction, and silently splitting one fill would invent history).

**Out of scope (JIT):** sizing Deviations (Slice 9 — scaling beyond plan is *recorded* there; here it's just possible), Transfers (Slice 16), trader-picked specific lots (rejected in ADR 0015; FIFO only).

Design references: [trademath.md](../design/trademath.md), ADR 0015, ADR 0004 (basis language).

**Worked example used throughout:**
Buy 100 AAPL @ $150.00 fees $1.00 (Lot A) · buy 100 @ $160.00 fees $1.00 (Lot B) → position 200, basis $31,000, average $155.00.
Sell 120 @ $165.00 fees $1.00 → consumes all of Lot A + 20 of Lot B:
- realized = 19,800 − (15,000 + 3,200) − 1.00 closing − 1.20 consumed opening fees (A's $1.00 + 20% of B's) = **$1,597.80**
- remaining: 80 shares, basis $12,800, Lot B's unconsumed $0.80 of fees · at mark 165: unrealized $400 (gross)
Sell 80 @ $170.00 fees $1.00 → realized adds 13,600 − 12,800 − 1.80 = **$798.20**; Trade flat; total realized $2,396.00.

---

## ☐ Story S5.1 — Scaling in

> As a trader, I want to add to a position over multiple fills, so that legging into size is recorded as it actually happens instead of as one invented average fill.

**Deep interfaces**: `TradeBook.recordExecution` repeat fills on an existing Leg (deferred from Slice 1), Lot creation per opening Execution (ADR 0015), `TradeMath.positionOf / valuation` across Lots, per-Leg basis display.

### Tasks

- [ ] **S5.1.T1 — Lots on opening Executions.** Valuation internals refactor from basis-sum to Lot list — behavior-identical for single-Lot Trades (all Slice 1/3 tests stay green untouched; that is the regression gate for this refactor).

  ```
  describe "TradeBook.recordExecution (repeat fills)"
  - it appends a second opening Execution to the same Leg
  - it keeps each fill's own price, fees, and timestamp (no averaging in storage)
  describe "TradeMath.positionOf (multi-lot)"
  - it returns 200 after the two worked-example buys
  describe "TradeMath.valuation (multi-lot, no closes)"
  - it reports basis 31000.00 and average cost 155.00
  - it reports unrealized 2000.00 at mark 165 (gross of fees)
  - it reports fees 2.00
  ```

- [ ] **S5.1.T2 — UI.** "Record fill" already exists; the detail page's position block gains average cost and a per-fill history that reads as building blocks ("100 @ 150 · 100 @ 160"). Adding to a closed Trade is impossible (closed Trades offer no record-fill; a new campaign is a new Plan).

  ```
  describe "TradeDetail (scaling in)"
  - it shows total quantity and average cost across fills
  - it lists each fill separately in history
  - it offers no record-fill on a closed Trade
  ```

- [ ] **S5.1.T3 — Integration tests**: two buys over Dexie → reopen → position 200, average 155, both fills intact.
- [ ] **S5.1.T4 — Playwright e2e** (`e2e/s5-1-scale-in.spec.ts`): worked-example buys → position and average cost assert.
- [ ] **S5.1.T5 — Browser verification.** Scale into a Trade in a real browser across two days (change marks between); history, average cost, and valuation all coherent; Slice 1 e2e specs still green (the refactor broke nothing visible). All suites green.

---

## ☐ Story S5.2 — Partial close with FIFO

> As a trader, I want to take some off and see exactly what that realized and what's still at risk, so that scaling out is a recorded decision with honest numbers, not a mystery until flat.

**Deep interfaces**: FIFO Lot consumption in `TradeMath.valuation` (ADR 0015 — realized P&L reproducible from the Execution record alone), `LegValuation` per-Leg realized/unrealized split, `ExecutionOutcome.nowFlat` correctness through partials, cross-zero rejection.

### Tasks

- [ ] **S5.2.T1 — FIFO consumption.**

  ```
  describe "TradeMath.valuation (FIFO partial close)"
  - it realizes 1597.80 on the worked-example sell of 120 (Lot A fully, Lot B 20)
  - it reports remaining basis 12800.00 over 80 shares
  - it reports unrealized 400.00 at mark 165 on the remainder
  - it realizes 798.20 on the final sell of 80, totaling 2396.00
  - it reproduces identical numbers recomputed from the Execution record alone
  - it consumes short Lots FIFO symmetrically (partial buy-to-close of a -2 contract position)
  describe "TradeBook.recordExecution (partial close)"
  - it returns nowFlat=false after the partial sell of 120
  - it returns nowFlat=true only at the final sell
  - it rejects a close larger than held quantity (no crossing zero)
  ```

- [ ] **S5.2.T2 — UI.** Detail page shows realized-so-far alongside unrealized-on-remainder (the split is the story of scaling out); no Close Reason prompt until actually flat; history renders partial closes plainly.

  ```
  describe "TradeDetail (scaling out)"
  - it shows realized 1597.80 and unrealized 400.00 after the partial
  - it does not prompt Close Reason on a partial close
  - it prompts Close Reason at the flattening fill as usual
  - it rejects an oversized close with a message naming held quantity
  ```

- [ ] **S5.2.T3 — Integration tests**: the full worked example over Dexie with a reopen mid-sequence → every number matches; review walk between the sells values the 80-share remainder correctly.
- [ ] **S5.2.T4 — Playwright e2e** (`e2e/s5-2-scale-out.spec.ts`): full worked example; assert realized/unrealized at each step and the final total.
- [ ] **S5.2.T5 — Browser verification.** Drive the worked example end-to-end in a real browser, checking each on-screen number against the table above (this is the slice's arithmetic proof); include one Daily Review walk mid-position. All suites green.

---

## Slice complete when

- [ ] Both stories checked.
- [ ] Slice 1's and Slice 3's Playwright specs pass unmodified (the Lot refactor changed no existing behavior).
- [ ] The worked example's $2,396.00 total realized P&L reproduces after export-grade recompute (delete the Marks cache is not needed — just re-open the app and confirm derivation from Executions alone).
