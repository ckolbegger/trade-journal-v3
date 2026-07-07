# Slice 16 — Rolls, Transfers & lineage

The signature monthly gesture arrives: close the short call, open next month's under a new linked Trade, and move the covering LEAP alongside — atomically. Underneath it, Transfers move Leg quantity between same-Account Trades at original basis (ADR 0004), and lineage links let a campaign's chapters read as one continuing story.

**Decided by design, proven here:** a successor Trade's P&L includes appreciation earned during its predecessor's tenure (the ADR 0004 consequence-to-remember) — tested explicitly, not discovered in production.

**Out of scope (JIT):** cross-account transfers (a different real-world event, ADR 0013 — rejected until it exists), lineage visualization beyond links on the Trade detail (no story asks for a graph).

Design references: ADR 0004, 0013, 0015, [tradebook.md](../design/tradebook.md) (`transfer`, `RollSpec`, both sequences).

**Worked example used throughout (the PMCC roll):**
Trade A: LEAP `AAPL 2028-01-21 C 150` bought @ 60.00 (basis $6,000), short `AAPL 2026-09-18 C 220` sold @ 3.00. Roll month-end, short call marked 1.00:
- Close: buy back Sep 220C @ 1.00, fees $0.65 → A realizes +$198.70 on the short leg.
- Successor Trade B (PMCC continuation plan): sell `AAPL 2026-10-16 C 230` @ 2.50, fees $0.65; Transfer the LEAP A→B at its **$6,000 original basis**.
- A is flat → Close Reason **Rolled** (seeded now — its selectable moment finally exists). B holds LEAP (basis 6,000) − Oct 230C. With the LEAP marked 65.00, B shows +$500 unrealized on a Leg it acquired mid-appreciation — the ADR 0004 consequence.

---

## ☐ Story S16.1 — Transfers & spin-offs

> As a trader, I want to move a holding into a different campaign — like a LEAP under a new thesis — so that my Trade boundaries match how I actually think, without faking market transactions.

**Deep interfaces**: `TradeBook.transfer(from, to, instrument, qty, date)` — same-Account enforced (ADR 0013), consumes FIFO Lots carrying original basis (ADR 0004/0015), auto-creates the lineage link; the composed spin-off flow (`confirmPlan` + `transfer` — deliberately not atomic, every intermediate state valid, [tradebook.md](../design/tradebook.md)); `TransferFacts` on both records.

### Tasks

- [ ] **S16.1.T1 — transfer.**

  ```
  describe "TradeBook.transfer"
  - it moves qty from source Leg to a Leg in the target Trade
  - it rejects Trades in different Accounts
  - it rejects more qty than the source holds
  - it consumes the source's oldest Lot first (FIFO)
  - it carries original basis (the 6000.00 LEAP is still a 6000.00 LEAP)
  - it records no realized P&L on either Trade (no market transaction)
  - it creates the lineage link source→target automatically
  describe "derived status through transfers"
  - it closes the source when the transfer empties it (transfer-out counts, ADR 0005)
  - it opens a planned target on transfer-in
  describe "valuation after transfer (ADR 0004 consequence)"
  - it shows the target's unrealized from original basis (+500.00 at LEAP mark 65)
  - it removes the transferred basis from the source
  ```

- [ ] **S16.1.T2 — Spin-off flow + lineage UI.** "Start a campaign from holdings" on a Trade's Leg: plan the successor (normal plan form + entry/debt), then transfer — two steps, resting state between is a valid open Trade awaiting its next fill. Both Trades' details show lineage ("LEAP transferred from A · Jul 15", linked both ways).

  ```
  describe "SpinOffFlow"
  - it confirms the successor plan then transfers in two explicit steps
  - it leaves a valid resting state between them (target open, holding the LEAP)
  describe "LineageDisplay"
  - it links predecessor and successor from both details
  - it shows the transfer's date, instrument, qty, and carried basis
  ```

- [ ] **S16.1.T3 — Integration tests**: the spin-off sequence over Dexie with reopen mid-flow — statuses, basis, lineage all correct; a partial transfer (1 of 2 LEAPs) leaves FIFO remainders provable on both sides.
- [ ] **S16.1.T4 — Playwright e2e** (`e2e/s16-1-spinoff.spec.ts`): spin the LEAP into a new Trade → both details show lineage; target's unrealized reads from original basis.
- [ ] **S16.1.T5 — Browser verification.** Real browser: full spin-off; verify same-account enforcement (attempt across accounts fails with the reason), the carried basis on the target's dashboard, and both lineage links. All suites green.

---

## ☐ Story S16.2 — The atomic roll

> As a trader, I want rolling my short call to be one gesture that can't half-happen, so that month after month the buyback, the new sale, the new plan, and the moved cover land together — or not at all.

**Deep interfaces**: `TradeBook.roll(spec)` — ONE storage transaction: closing Executions + successor `confirmPlan` + opening Executions + Transfers + rolled-from link ([tradebook.md](../design/tradebook.md) roll sequence); detection runs on both Trades; seed: Close Reason **Rolled** (its moment finally exists — deferred from Slice 1); successor thesis may land as Journal Debt.

### Tasks

- [ ] **S16.2.T1 — roll().**

  ```
  describe "TradeBook.roll"
  - it executes the worked example: A realizes 198.70, B opens with LEAP at 6000.00 basis and the Oct short
  - it commits everything in one transaction (a forced mid-roll failure leaves no trace of any part)
  - it returns the successor TradeId with the rolled-from link set
  - it runs deviation detection on both Trades within the transaction
  - it leaves A flat, awaiting Close Reason
  - it supports a no-transfer full roll (link comes from roll(), not transfer)
  describe "corrections inside a rolled pair (Slice 12 interplay)"
  - it heals A's realized P&L when the buyback price is corrected post-roll
  ```

- [ ] **S16.2.T2 — Roll wizard + seed.** From a short option Leg: gather buyback fill, successor Plan (pre-filled PMCC-style from the source, thesis writable or owed), opening sale, covering transfer (pre-selected LEAP) → one confirm → both Trades shown; A's Close Reason prompt offers **Rolled** (seeded, selectable at last — the Slice 1 deferral pays off here with its selection test).

  ```
  describe "RollWizard"
  - it pre-fills successor plan and covering transfer from the source Trade
  - it submits one RollSpec and lands on the successor
  - it prompts A's Close Reason with Rolled offered and records it
  - it writes the successor's plan entry or its placeholder (Journal Debt)
  describe "seeding (extension)"
  - it seeds the Rolled Close Reason iff absent
  ```

- [ ] **S16.2.T3 — Integration tests**: the worked roll over Dexie with reopen — both Trades' every number matches the example; lineage navigable; A closed Rolled; B walks in the next review.
- [ ] **S16.2.T4 — Playwright e2e** (`e2e/s16-2-roll.spec.ts`): the worked roll through the wizard; assert A's realized 198.70, Rolled reason, B's holdings and basis.
- [ ] **S16.2.T5 — Browser verification.** Real browser: perform the monthly gesture end-to-end; verify the numbers, the lineage chain reading as one story, next review walking B (not A), and the whole thing surviving reload. All suites green.
