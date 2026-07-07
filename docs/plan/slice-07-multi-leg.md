# Slice 7 — Multi-leg Trades

One Trade, several Legs: covered calls, vertical spreads, and LEAP + short-call structures (the PMCC — the trader's bread and butter). Valuation sums signed Legs, structural extremes handle mixed expirations, and one universal formula covers debit and credit structures identically (ADR 0012 — direction carries the signs; nothing branches on Strategy).

**Decided in this slice:** a `PlannedLeg`'s strike/expiration may be **TBD** at plan time (the design allows it for legging plans); a TBD planned leg displays as such and is completed by reality (the fill), not by editing the Plan.

**Out of scope (JIT):** leg-scope Exit Levels (nothing consumes them until Slice 10's management alerts/discipline — templates here declare trade-scope levels only); Deviation detection against multi-leg plans (Slice 9 handles detection; its tests extend naturally); Transfers between Trades (Slice 16).

Design references: [trademath.md](../design/trademath.md) (structural extremes, signed values), ADR 0002, 0010, 0012.

**Worked examples used throughout:**

*Covered call* — buy 100 XYZ @ 50.00 fees $1.00; sell 1 `XYZ 2026-09-18 C 55` @ 1.50 fees $0.65. Marks: stock 52.00, call 1.00.
- currentValue $5,100 (5,200 − 100) · unrealized $250 (stock +200, call +50) · fees $1.65 · total $248.35
- Exit Levels (trade-scope): underlyingPrice stop 46, target 55. plannedRisk $500 (5,100 → intrinsic at 46 = 4,600) · plannedReward $400 (→ 5,500 at 55)
- worstCaseRisk $5,100 (S→0 → 0) · maxReward $400 (S→∞ intrinsic: 100·S − 100·(S−55) = 5,500 — capped)

*Bull put spread* — sell 1 `XYZ 2026-08-21 P 100` @ 2.60, buy 1 `XYZ 2026-08-21 P 90` @ 0.60; net credit 2.00, total fees $1.30. Marks: short put 1.10, long put 0.20 → structure −$90.
- unrealized +$110 · total $108.70
- Exit Levels: underlyingPrice stop 97, pctOfMaxProfit target 75% (buy back at 0.50).
- plannedRisk $210 (−90 → intrinsic at 97: −300 + 0) · plannedReward $40 (−90 → −50)
- worstCaseRisk $910 (S→0: −10,000 + 9,000 = −1,000) · maxReward $90 (→ 0)
- At the ADR 0010 marks (net 0.50): risking $950 to make $50 — the framing test.

*PMCC* — buy 1 `AAPL 2028-01-21 C 150` @ 60.00, sell 1 `AAPL 2026-09-18 C 220` @ 3.00, fees $1.30 total. Marks: LEAP 65.00, short call 2.00, underlying 210.
- currentValue $6,300 · unrealized $400 · total $398.70
- worstCaseRisk $6,300 (S→0 → 0) · maxReward $700 (S→∞ intrinsic, different expirations both to their limits: (S−150)·100 − (S−220)·100 = 7,000)

---

## ☐ Story S7.1 — Covered call

> As a trader, I want one Trade holding my stock and the call I sold against it, so that the campaign's income, risk, and obligations read as one position, the way I actually think about it.

**Deep interfaces**: multi-leg `PlanDraft` (two Planned Legs, TBD strike allowed), fills per Leg over time (legging in — the sequence already exists, [tradebook.md](../design/tradebook.md)), `TradeMath.valuation / riskReward` over signed multi-leg structures, `instrumentsOf` dedup (deferred from Slice 1); seed: Strategy **Covered Call**.

**Seed content** — Strategy "Covered Call": planned legs buy 100 stock + sell 1 call (strike/expiration may be TBD); asks underlyingPrice stop + target.

### Tasks

- [ ] **S7.1.T1 — Multi-leg math.**

  ```
  describe "TradeMath.instrumentsOf (multi-leg)"
  - it returns stock, contract, and underlying deduplicated (stock IS the underlying — once)
  describe "TradeMath.valuation (covered call)"
  - it values the worked example: currentValue 5100.00, unrealized 250.00, total 248.35
  - it reports per-Leg valuations (stock +200 gross, short call +50 gross)
  describe "TradeMath.riskReward (covered call)"
  - it computes plannedRisk 500.00 and plannedReward 400.00 via intrinsic projection
  - it computes worstCaseRisk 5100.00 and capped maxReward 400.00
  ```

- [ ] **S7.1.T2 — Multi-leg plan + TBD legs.**

  ```
  describe "PlanDraft (multi-leg)"
  - it confirms a Plan with two Planned Legs
  - it accepts TBD strike/expiration on the call leg
  describe "PlanForm (covered call)"
  - it pre-fills both legs from the template
  - it renders a TBD leg as "strike TBD"
  describe "legging in"
  - it opens the Trade at the stock fill and shows one planned leg unfilled
  - it attaches the later call fill as the second Leg of the same Trade
  ```

- [ ] **S7.1.T3 — Detail & walk UI.** Position block lists both Legs signed ("100 XYZ · −1 × Sep'26 55C"); per-Leg P&L rows; the review walk prompts Marks for stock and contract (dedup — stock asked once as itself and as underlying).
- [ ] **S7.1.T4 — Integration tests**: full covered-call lifecycle over Dexie — plan (TBD call) → stock fill → call fill → marks → worked-example numbers → call expires worthless (S3.3 path) → sell stock → closed; realized folds both legs.
- [ ] **S7.1.T5 — Playwright e2e** (`e2e/s7-1-covered-call.spec.ts`): worked example; assert the four R/R numbers and per-Leg rows.
- [ ] **S7.1.T6 — Browser verification.** Drive the covered call in a real browser across a legged entry and one review walk; verify each number against the table; confirm the capped maxReward reads as a number while stock-only Trades still show 'unlimited'. All suites green.

---

## ☐ Story S7.2 — Vertical spread

> As a trader, I want a credit spread tracked as one defined-risk structure, so that the app tells me what staying in actually risks — "risking $950 to make $50" — not what I collected once upon a time.

**Deep interfaces**: same math over two option Legs, `pctOfMaxProfit` resolved against *net* credit (structure-level, not per-leg); seed: Strategy **Bull Put Spread**.

**Seed content** — Strategy "Bull Put Spread": planned legs sell 1 put + buy 1 put (lower strike, same expiration); asks underlyingPrice stop + pctOfMaxProfit target.

### Tasks

- [ ] **S7.2.T1 — Spread math.**

  ```
  describe "TradeMath.valuation (bull put spread)"
  - it values the worked example: structure -90.00, unrealized +110.00, total 108.70
  describe "TradeMath.riskReward (bull put spread)"
  - it computes plannedRisk 210.00 (intrinsic at the 97 stop)
  - it resolves the 75% pctOfMaxProfit target against net credit 2.00 → plannedReward 40.00
  - it computes worstCaseRisk 910.00 (full width beyond the long strike, net of credit)
  - it computes maxReward 90.00
  - it frames the ADR 0010 marks as risking 950.00 to make 50.00
  - it produces identical formulas for a debit spread (signs carry direction — no credit/debit branch)
  ```

- [ ] **S7.2.T2 — UI + seeds.** Template plans both legs with linked expiration; dashboard shows net structure value and the credit framing.

  ```
  describe "PlanForm (spread)"
  - it plans two option legs sharing ticker and expiration
  describe "TradeDashboard (spread)"
  - it shows net structure value and all four R/R numbers per the worked example
  ```

- [ ] **S7.2.T3 — Integration tests**: spread lifecycle over Dexie — both fills same day → marks → numbers → buy back both legs → closed, realized $108.70 + remaining move.
- [ ] **S7.2.T4 — Playwright e2e** (`e2e/s7-2-spread.spec.ts`): worked example numbers on the dashboard.
- [ ] **S7.2.T5 — Browser verification.** Real-browser spread lifecycle including one review walk (two contract Marks + underlying prompt once); numbers verified against the table. All suites green.

---

## ☐ Story S7.3 — PMCC & multi-expiration structures

> As a trader, I want my LEAP and the call I sell against it valued as one campaign with honest extremes, so that my core monthly structure finally lives in the app the way it lives in my account.

**Deep interfaces**: structural extremes across different expirations (intrinsic in the limits is well-defined — [trademath.md](../design/trademath.md)), shared-Mark behavior across Trades holding the same contract (the roadmap's dedup requirement — mechanically present since Slice 1, *proven* here); seed: Strategy **PMCC**.

**Seed content** — Strategy "PMCC": planned legs buy 1 call (far expiration) + sell 1 call (near, strike/expiration TBD); asks structureValue stop + target.

### Tasks

- [ ] **S7.3.T1 — Multi-expiration extremes.**

  ```
  describe "TradeMath.riskReward (PMCC)"
  - it values the worked example: worstCaseRisk 6300.00, maxReward 700.00
  - it computes structureValue stop/target anchors over the combined structure
  - it handles the short leg expiring first (extremes over the remaining leg after the expire Execution)
  describe "TradeMath.valuation (PMCC)"
  - it values the worked example: currentValue 6300.00, total 398.70
  ```

- [ ] **S7.3.T2 — Shared-Mark proof.**

  ```
  describe "shared Marks across Trades (integration)"
  - it stores one Mark when two Trades hold the same contract
  - it prompts the contract once in a walk covering both Trades
  - it warns on manual edit naming both Trades (tradesHolding)
  - it revalues both Trades from the edited Mark
  ```

- [ ] **S7.3.T3 — UI + seeds.** PMCC template with TBD short leg; dashboard renders mixed expirations ("Jan'28 150C · −1 Sep'26 220C").
- [ ] **S7.3.T4 — Integration tests**: PMCC lifecycle over Dexie — LEAP fill → later short-call fill → marks → worked numbers → short call expires worthless → extremes recompute over the LEAP alone.
- [ ] **S7.3.T5 — Playwright e2e** (`e2e/s7-3-pmcc.spec.ts`): worked example; assert numbers and the mixed-expiration display.
- [ ] **S7.3.T6 — Browser verification.** Drive the PMCC in a real browser through a walk and the short call's expiration; verify the extremes shift when the short leg dies; verify the shared-Mark warning with a second Trade holding the same LEAP. All suites green.
