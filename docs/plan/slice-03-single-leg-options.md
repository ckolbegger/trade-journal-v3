# Slice 3 — Single-leg options

Option contracts become plannable, tradeable, and reviewable: long calls/puts and cash-secured puts (the first short positions), Marks per contract *and* underlying, expiration surfacing in Daily Review, assignment/exercise landing stock in the same Trade, and IV display implied from Marks.

**Decided in this slice** (design gaps the stories need):

- **Contract multiplier is 100.** Option `qty` counts contracts; valuation, R/R, and position math multiply by 100. The multiplier lives in TradeMath, keyed off the instrument kind — never in the UI.
- **Projecting to an `underlyingPrice` Exit Level values the structure at intrinsic.** No pricing model exists (ADR 0009), so "risk to a $95 stop" on a put is the put's intrinsic value at 95. This understates long-option value at the stop (time value ignored) — accepted, display explains "at intrinsic".
- **Assignment/exercise/expiration are Execution kinds** (`ExecutionFacts.kind: 'fill' | 'expire' | 'assign' | 'exercise'`, default `'fill'`; the field is added now — Slice 1 records carry no kind and read as `'fill'`). They close the option Leg at price 0; assignment/exercise simultaneously opens the stock Leg at the strike price in the SAME Trade (ADR 0002 — schema already allows it). Trade-level P&L stays truthful: the option Leg realizes its full premium; the stock Leg carries strike-based basis.

**Out of scope (JIT):** multi-leg structures (Slice 7), naked short calls (no seeded strategy offers one — `'unlimited'` worst-case risk for shorts first arises in Slice 7 if ever), `trailing` Exit Levels (Slice 10), automated pricing (Slice 4).

Design references: [trademath.md](../design/trademath.md), [review.md](../design/review.md) (expiration sequence), [pricebook.md](../design/pricebook.md), ADRs 0008, 0009, 0010.

**Worked examples used throughout:**

*Long call* — Plan: Long Call, buy 1 `AAPL 2027-06-18 C 200` @ limit; Exit Levels: structureValue stop 6.00, target 24.00. Fill: buy 1 @ 12.00, fees $0.65. Marks: contract 14.00, underlying 205.
- currentValue $1,400 · unrealized $200 · fees $0.65 · total $199.35
- plannedRisk $800 (14→6) · worstCaseRisk $1,400 (option to zero) · plannedReward $1,000 (14→24) · maxReward `'unlimited'`
- original: risk $600 (12→6), reward $1,200 (12→24)

*Cash-secured put* — Plan: Cash-Secured Put, sell 1 `XYZ 2026-08-21 P 100`; Exit Levels: underlyingPrice stop 95, pctOfMaxProfit target 80%. Fill: sell 1 @ 2.50, fees $0.65. Marks: contract 1.25, underlying 103.
- Position −1 contract · currentValue −$125 · unrealized +$125 · total $124.35
- plannedRisk $375 (value −125 → intrinsic at 95 = −500) · worstCaseRisk $9,875 (stock to zero: put worth 100 → value −10,000)
- plannedReward $75 (target = buy back at 20% of 2.50 credit = 0.50) · maxReward $125 (to zero)

---

## ☐ Story S3.1 — Plan & manage a long option Trade

> As a trader, I want to plan, open, mark, review, and close a long call or put the same way I do a stock Trade, so that options are first-class campaigns, not workarounds.

**Deep interfaces**: option `Instrument` + `InstrumentKey` round-trip (deferred from Slice 1), `TradeMath.positionOf / valuation / riskReward / instrumentsOf` extended for contracts, `ExitLevel` kind `structureValue`, seeds: Strategies **Long Call**, **Long Put**.

**Seed content** — Strategy "Long Call": planned leg buy 1 call (strike/expiration asked at plan time); asks structureValue stop + target. "Long Put": same shape, put.

### Tasks

- [ ] **S3.1.T1 — Option instrument.**

  ```
  describe "InstrumentKey (options)"
  - it renders "AAPL 2027-06-18 C 200" from an option instrument
  - it parses the canonical string back including fractional strikes ("BRK.B 2026-12-18 P 447.50")
  - it extracts the underlying ticker from an option key
  ```

- [ ] **S3.1.T2 — TradeMath over contracts.** Multiplier applied; `instrumentsOf` returns the contract *and* its underlying (underlyingPrice Exit Levels and IV need underlying Marks).

  ```
  describe "TradeMath.instrumentsOf (options)"
  - it returns the contract and its underlying for an option Leg
  describe "TradeMath.positionOf (options)"
  - it returns +1 contract after buying 1
  describe "TradeMath.valuation (options)"
  - it values the long-call worked example: currentValue 1400.00, unrealized 200.00, total 199.35
  describe "TradeMath.riskReward (structureValue levels)"
  - it computes the long-call worked example: plannedRisk 800.00, worstCase 1400.00, plannedReward 1000.00
  - it returns maxReward 'unlimited' for a long call
  - it returns maxReward at intrinsic-at-zero for a long put (strike × 100 minus nothing)
  - it reports original risk 600.00 and reward 1200.00 from entry basis 12.00
  ```

- [ ] **S3.1.T3 — Plan form + seeds.** Strategy picker gains Long Call / Long Put; picking one asks ticker, expiration, strike, qty, structureValue stop/target. Trade detail and list render the contract position ("1 × AAPL Jun'27 200C").

  ```
  describe "PlanForm (options)"
  - it builds the option Planned Leg from ticker + expiration + strike
  - it asks structureValue stop and target per the strategy template
  describe "seeding (extension)"
  - it seeds Long Call and Long Put iff absent
  ```

- [ ] **S3.1.T4 — Marks for two instruments.** Trade detail and the review walk prompt for both the contract Mark and the underlying Mark (both come from `Valuations.marksNeeded` via the extended `instrumentsOf` — no new seams).

  ```
  describe "MarkEntry (options)"
  - it prompts for contract and underlying Marks
  - it computes valuation from the contract Mark alone when the underlying is unmarked (R/R shows marks-missing for underlying-anchored levels only)
  ```

- [ ] **S3.1.T5 — Integration tests**: full long-call lifecycle over Dexie — plan → fill → both marks → detail reproduces every worked-example number → close at 18.00 → realized correct with multiplier.
- [ ] **S3.1.T6 — Playwright e2e** (`e2e/s3-1-long-call.spec.ts`): worked example through the UI; assert the six dashboard numbers.
- [ ] **S3.1.T7 — Browser verification.** Drive the worked example in a real browser end-to-end including a Daily Review walk over the option Trade (both mark prompts appear once); verify every number against the table. All suites green.

---

## ☐ Story S3.2 — Cash-secured put (first short position)

> As a trader, I want to sell a put I'm willing to be assigned on and track what staying short risks from today's price, so that credit trades show honest mark-to-market risk, not "premium collected" comfort.

**Deep interfaces**: sell-to-open Executions (short Lots), short-position math throughout `positionOf / valuation / riskReward` (deferred from Slice 1), `ExitLevel` kind `pctOfMaxProfit`, intrinsic projection for `underlyingPrice` levels; seed: Strategy **Cash-Secured Put**.

**Seed content** — Strategy "Cash-Secured Put": planned leg sell 1 put; asks underlyingPrice stop + pctOfMaxProfit target.

### Tasks

- [ ] **S3.2.T1 — Short-position math.**

  ```
  describe "TradeMath.positionOf (short)"
  - it returns -1 contract after selling to open
  - it returns zero after selling 1 and buying 1 back
  describe "TradeMath.valuation (short)"
  - it values the CSP worked example: currentValue -125.00, unrealized +125.00, total 124.35
  - it realizes credit minus buyback on a buy-to-close at 0.60: realized 188.70 (250 - 60 - 1.30 fees)
  describe "TradeMath.riskReward (short put)"
  - it computes plannedRisk 375.00 via intrinsic at the 95 stop
  - it computes worstCaseRisk 9875.00 (stock to zero)
  - it resolves the 80% pctOfMaxProfit target to a 0.50 buyback and plannedReward 75.00
  - it computes maxReward 125.00 (mark to zero)
  ```

- [ ] **S3.2.T2 — Sell-to-open UI + seeds.** Plan form supports the CSP template; record-fill handles sell-to-open and buy-to-close; dashboard renders short positions ("−1 × XYZ Aug'26 100P") and labels intrinsic-projected risk "at intrinsic".

  ```
  describe "CSP flow"
  - it plans and fills a sell-to-open from the template
  - it shows negative position and credit-style P&L
  - it labels the underlying-stop risk figure "at intrinsic"
  - it closes via buy-to-close and prompts Close Reason on flat
  describe "seeding (extension)"
  - it seeds Cash-Secured Put iff absent
  ```

- [ ] **S3.2.T3 — Integration tests**: CSP lifecycle over Dexie — sell 2.50 → marks → detail matches worked example → buy back 0.60 → realized 188.70, closed.
- [ ] **S3.2.T4 — Playwright e2e** (`e2e/s3-2-csp.spec.ts`): worked example; assert the ADR-0010-style framing (risking 375 to make 75).
- [ ] **S3.2.T5 — Browser verification.** Worked example in a real browser; confirm the giveback framing (unrealized gain counted in risk), the "at intrinsic" label, and full close flow. All suites green.

---

## ☐ Story S3.3 — Expiration surfacing

> As a trader, I want Saturday's review to tell me my Friday options expired and record what happened, so that a Trade never sits "open" on a contract that no longer exists.

**Deep interfaces**: `Valuations.expiredHoldings` (facts + `positionOf`, no Marks), `ReviewAgenda.expiredLegs`, `recordExecution` kind `'expire'` at price 0 ([review.md](../design/review.md) expiration sequence — the outcome goes through the ordinary Execution path, deviation-free until Slice 9).

### Tasks

- [ ] **S3.3.T1 — Execution kinds + expiredHoldings.**

  ```
  describe "ExecutionFacts.kind"
  - it defaults absent kind to 'fill' when reading Slice 1 records
  describe "Valuations.expiredHoldings"
  - it lists Legs past expiration still holding quantity, with trade, qty, expiredOn
  - it ignores expired Legs already closed to zero
  - it ignores stock Legs and unexpired contracts
  - it consults no Marks
  describe "recordExecution (kind 'expire')"
  - it closes the Leg quantity at price 0 with kind 'expire'
  - it realizes full premium as profit for a short Leg
  - it realizes full premium as loss for a long Leg
  - it returns nowFlat=true when expiration empties the Trade
  ```

- [ ] **S3.3.T2 — Agenda + outcome UI.** `Review.agenda` gains `expiredLegs`; the agenda lists them ("1 × XYZ Aug'26 100P expired Friday — record the outcome") with an **expired worthless** action recording the expire Execution; flattening triggers the normal Close Reason flow. (The in-the-money choices join in S3.4.)

  ```
  describe "ReviewAgenda (expired)"
  - it lists expired holdings with expiry date
  - it records expired-worthless via the ordinary Execution path
  - it flows into Close Reason when the Trade goes flat
  ```

- [ ] **S3.3.T3 — Integration tests**: CSP whose put expired yesterday over Dexie → agenda surfaces it → record worthless → Trade flat, realized = full credit, Close Reason set → agenda clean next run.
- [ ] **S3.3.T4 — Playwright e2e** (`e2e/s3-3-expiration.spec.ts`): seeded expired-put scenario → review → record worthless → closed Trade with correct P&L.
- [ ] **S3.3.T5 — Browser verification.** In a real browser with a past-expiry contract: agenda surfaces it (and nothing else notices it — trade still read "open" before); record the outcome; verify P&L and that the next agenda no longer lists it. All suites green.

---

## ☐ Story S3.4 — Assignment & exercise

> As a trader, I want an in-the-money expiration to record assignment (or exercise) and land the resulting stock in the same Trade, so that the campaign's economics stay in one place.

**Deep interfaces**: `recordExecution` kinds `'assign'` / `'exercise'`; the paired stock Execution opens a new Leg in the SAME Trade at the strike price (ADR 0002; decided semantics above).

### Tasks

- [ ] **S3.4.T1 — Assignment/exercise recording.** One TradeBook operation call per event: the option Leg closes at 0 (kind assign/exercise) and the stock Leg opens at strike, atomically in one storage transaction.

  ```
  describe "recordExecution (assign)"
  - it closes the short put Leg at 0 and opens a buy of 100 shares at the 100 strike in the same Trade
  - it commits both Executions in one transaction (neither exists alone after a failure)
  - it leaves the Trade open (nowFlat=false) holding the stock
  - it realizes the full 250.00 credit on the option Leg
  describe "recordExecution (exercise)"
  - it closes the long call Leg at 0 and opens a buy of 100 shares at the strike
  describe "valuation after assignment"
  - it carries strike-based stock basis: XYZ marked 97 shows -300.00 unrealized on the stock Leg
  - it shows Trade totalPnL as option credit plus stock unrealized (-51.30 with fees at mark 97)
  ```

- [ ] **S3.4.T2 — Outcome UI.** The expired-leg agenda item (S3.3) gains the in-the-money choices: **assigned** (short) / **exercised** (long); the Trade detail now shows both Legs with per-Leg P&L; the review walk prompts for the new stock Mark next session.

  ```
  describe "AssignmentFlow"
  - it offers assigned/exercised for an ITM expired leg
  - it shows the stock Leg on the Trade after recording
  - it keeps the Trade in the open-Trades walk (still holding)
  ```

- [ ] **S3.4.T3 — Integration tests**: assigned CSP over Dexie → reopen DB → both Legs present, option realized +250, stock basis 10,000, statusOf 'open'; then sell the stock → flat → Close Reason.
- [ ] **S3.4.T4 — Playwright e2e** (`e2e/s3-4-assignment.spec.ts`): ITM expired put → assigned → Trade shows 100 shares @ 100; sell at 99 → closed with total P&L correct.
- [ ] **S3.4.T5 — Browser verification.** Drive assignment in a real browser: the stock appears in the same Trade, per-Leg P&L reads sensibly (option +250, stock negative), and the following review walks the Trade with a stock Mark prompt. All suites green.

---

## ☐ Story S3.5 — IV display

> As a trader, I want to see the implied volatility my Marks imply, so that I build intuition about what I'm paying or collecting — without the app ever predicting anything.

**Deep interfaces**: `TradeMath.impliedVol(contract, mark, underlying, riskFreeRate)` (display-only, ADR 0009), `Workspace.settings.get/set` (first settings: `riskFreeRate`), a minimal Settings page section.

### Tasks

- [ ] **S3.5.T1 — Workspace.settings + impliedVol.** Typed settings over a Dexie store; Black-Scholes inversion (bisection is fine), no dividend modeling (accepted display error, [trademath.md](../design/trademath.md) open item resolved caller-supplies-rate).

  ```
  describe "Workspace.settings"
  - it returns a default riskFreeRate (0.04) before any set
  - it round-trips a set value
  describe "TradeMath.impliedVol"
  - it recovers ~0.25 vol from a mark priced with 0.25 vol (round-trip within 0.001)
  - it returns undefined when no vol reproduces the mark (deep-ITM below intrinsic)
  - it returns undefined for an expired contract
  ```

- [ ] **S3.5.T2 — Display + setting UI.** Option Legs on Trade detail show IV next to the contract Mark ("14.00 · IV 31%"); Settings gains a risk-free-rate field. IV appears nowhere in any computation path — display only.

  ```
  describe "IV display"
  - it shows IV for a marked option Leg with a marked underlying
  - it shows nothing when either Mark is missing or impliedVol is undefined
  - it updates when the risk-free-rate setting changes
  ```

- [ ] **S3.5.T3 — Integration tests**: set rate → mark contract + underlying over Dexie → detail carries the IV figure; unmarking the underlying drops it.
- [ ] **S3.5.T4 — Playwright e2e** (`e2e/s3-5-iv.spec.ts`): marked long call shows an IV percentage; changing the rate in Settings changes it.
- [ ] **S3.5.T5 — Browser verification.** Sanity-check one displayed IV against an external calculator (same inputs, within a percent); confirm IV never appears in R/R or P&L figures. All suites green.
