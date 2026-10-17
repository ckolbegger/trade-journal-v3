# D7 — Single-leg options: happy path: task breakdown

Definition: [implementation plan, D7](implementation-plan.md#d7--single-leg-options-happy-path). The definition (stories, capability set, introductions, acceptance claims) stays there and is not repeated here. D7 builds on D1's Plan facts and `assessPlan` (A1, T1.13); D2's Executions, Lots, Entry window, and Deviation reconciliation (A18–A28); D4's Marks, `evaluate`, dated and at-entry lines, and Review (A35–A60); D5's Debt and due rule (A61–A75, plan decision 28); and D6's exits, derived FIFO, Close Reason, Close Review, position paths, and owed-reflection group (A76–A98, P19–P23, plan decision 30) ([D6](D06-close-a-long-stock-position.md), [D5](D05-deferred-reflection-and-journal-debt.md), [D4](D04-daily-review.md), [D2](D02-open-a-long-stock-position.md), and [D1](D01-start-a-workspace-and-confirm-a-long-stock-plan.md) breakdowns).

Status: **breakdown agreed by the user on 2026-10-17** (the plan as a whole is still a draft). Decisions P24–P28 were agreed on 2026-10-17; P24 and P27 are recorded as plan decisions 31 and 32. The amendments in section 1.2 were agreed on 2026-10-17 and applied to the plan index and the D4 breakdown. Everything else is written against those decisions and the working assumptions listed below.

---

## 1. Decisions and clarifications

### 1.1 Decisions for this breakdown

Numbering continues from D6's P19–P23.

| # | Question | Recommendation | Alternatives and tradeoff |
|---|---|---|---|
| P24 | **The frozen monetary loss boundary for an underlying-price option Stop.** "An underlying-price option Stop must also contain a frozen monetary loss boundary for measurement, without being mislabeled as a structure-value trigger" (Trade Analysis, `assessPlan`). 1R is that loss, and Original Planned Reward needs the same kind of boundary at the Target. Without theoretical pricing (README, "Explicitly outside the MVP"; ADR 0007), the application cannot work out what an option will be worth when the Underlying reaches a price before expiration. | **Agreed 2026-10-17, as the user proposed: measure each condition by the contract's value at expiration at its trigger price, and also show the position's value at expiration at the Underlying's latest close.** The user rejected a trader-entered exit price because it would require a good understanding of option prices. (1) Each Stop and Target on an option Plan has only its Underlying trigger (for example "XYZ at or below 48.00"). Its measurement price is derived, never entered: the contract's intrinsic value at that price, `max(0, price − strike)` for a Call and `max(0, strike − price)` for a Put (A100). It is a point on the Planned Expiration Payoff, needs no Mark or pricing model, and is frozen because the trigger and contract are frozen. 1R = planned contracts × 100 × (entry − Stop value) for a long option, and × (Stop value − entry) for the Cash-Secured Put; the Target mirrors it. Ongoing Risk to Stop, Reward to Target, Overrun, Entry Quality, and the at-entry line use the same derived values (A105, A109). (2) Trade Detail and the Review card show "If XYZ is at 52.00 at expiration: −$401.30", the Current payoff read at the Underlying's exact Mark for the Expected Mark Date, labelled as an expiration value and kept apart from Mark-to-Market figures (A122). Whether a condition is crossed is decided by the Underlying's exact Mark, so **an option Trade needs two Marks per session, the contract's and the Underlying's**, until D11's provider fills them. **Accepted tradeoff:** expiration values ignore the time value left at an early exit. For a long option, a Stop below a Call's strike (above a Put's) always gives 1R equal to the whole premium wherever it sits, and Risk to Stop then equals the option's current value; for the Cash-Secured Put the boundary understates the cost of buying back before expiration. Validation: a long option's Target must be beyond breakeven (strike ± entry) and its Stop value below the entry; a Cash-Secured Put's Stop must be below breakeven (strike − entry) and its Target value below the entry; the Underlying Stop must be below the Target for a Long Call and a Cash-Secured Put and above it for a Long Put. | (a) The trader enters an expected option exit price for each condition (the first recommendation; rejected by the user, because it needs a good understanding of option prices). (b) Default the boundary to the whole premium: no Target rule and no meaning for the Cash-Secured Put. (c) Option-price conditions instead of underlying-price ones in D7 (declined by the user). (d) Both kinds in D7. |
| P25 | **When does Settlement Due arise, and what does the option need after it?** "When an option reaches a factual settlement point without an explicit outcome, Review reports Settlement Due and remains incomplete" (Daily Review, "Settlement Due"); AC-SET-003 requires it on Trade Detail too. The spec does not say which session is the settlement point. | **Agreed 2026-10-17: from the session whose date is the contract's expiration date, while open quantity remains.** For Review Date R (and for Trade Detail's Expected Mark Date), an option is Settlement Due when its expiration date is on or before that date and the Trade still holds it at that date's cutoff with no settlement fact. On the expiration date itself the contract still has a real closing price, so it is valued normally with that day's Marks. From the next session on, there is no honest Mark for an expired contract: no Mark is required for it or for its Underlying's conditions, and every current figure is `Unavailable(SettlementDue)`. The trader can record the Expiration in the expiration evening's Review. | (a) From the first session **after** the expiration date: the expiration-day Review is never blocked by settlement, but it then asks for a Mark of a contract that has just expired, and the trader cannot record the outcome until the next evening. (b) From the expiration date, and also ask for Marks after it: needs a fabricated or acknowledged-unavailable price for a contract that no longer trades. |
| P26 | **The Expiration's Economic Time.** Every Position Change carries one explicit Economic Time (Trade Workflows, "Common command rules"), and settlement facts are "never inferred from the calendar" (Trade Workflows, "Invariants"). | **Agreed 2026-10-17: fixed at the close of the expiration session (16:00 New York time, or 13:00 on an early-close day), supplied by the Settlement Due item and shown read-only in the expiration form.** Trade Analysis and Trade Workflows have no calendar, so Daily Review and Trade Views resolve that close from Market Data, as they already resolve Review cutoffs (A111). Trade Workflows checks what it can without a calendar: the time's New York date is on or before the expiration date, it is after every Execution on the contract, and it is not in the future (A106). **Consequence:** an Expiration dated at the cutoff is at or before it, so once recorded the Trade is Closed at that session's cutoff and leaves that evening's walk (D6 A88); a deferred Close Review then appears in the owed-reflection group. | (a) Trader-entered: flexible, but any time can be entered, including one before the last Execution or after a later session's close. (b) After the close (for example OCC's 17:30 exercise deadline, or 23:59): the Trade would stay in the expiration evening's walk as Closed after the cutoff and need an Action for a contract that has already expired. |
| P27 | **May a Mark be exactly 0?** D4 A37 left the option case to D7. Market Data validates "finite prices" (Market Data, "Backup and Restore"); the spec does not require a positive Mark. D4 rejects a stock Mark of 0 (A37, I4.8). | **Agreed 2026-10-17: allow 0 for every Mark, option or stock** (the user's choice, because a stock can also become worthless). An option far out of the money near expiration often closes with no bid, and a stock can be worth nothing after a bankruptcy or delisting; in both cases 0 is the honest closing value, and forcing 0.01 would fabricate a price. A Mark is still a finite decimal with at most 6 fractional digits and never negative (`PriceNegative`). Fill prices on Executions and intended entry prices stay positive, because a fill at 0 does not occur. The Review's Mark entry shows the note "0 means it closed with no value" for any Instrument. This amends D4 (section 1.2). | (a) Positive for every Mark: the trader enters 0.01 or acknowledges the Mark as unavailable, which misstates a known value. (b) Zero for options only (the first recommendation): keeps D4 unchanged, but cannot record a worthless stock honestly. |
| P28 | **Confirm the "missed Review" reading of AC-REV-002** (D4 review-queue item 2). The scenario's Given is "a missed Review", and its When says "the same exact date reopens". Under plan decision 27 only the latest completed session can be opened, and exact past dates arrive in D15. | **Agreed 2026-10-17: read it as reopening an unfinished Review while its date is still the latest completed session.** The fixture is a Review left unfinished on Friday evening and reopened on Saturday, when Friday is still the latest session. Every element of the Given (shared Missing Marks, due reflections, Settlement Due, several eligible Trades) is present, and resumption from facts after a full stop is proven. Under decision 27 a session that was never reviewed is not reviewed later; its owed reflections and Settlement Due carry into the next Review, so nothing is lost. | (a) Mark AC-REV-002 full only in D15, when exact past dates can be opened, and claim it partial here. (b) Reopen decision 27 so that missed sessions can be reviewed. |

### 1.2 Amendments to other plan sections (agreed 2026-10-17 and applied)

- **D7 definition.** Add four sentences: an underlying-price Stop and Target are measured by the contract's value at expiration at their trigger prices (P24); Trade Detail and the Review show the position's value at expiration at the Underlying's latest close (P24, A122); an Expiration that closes a Trade still creates a Close Review obligation, with no Close Reason (D6 review-queue item 1); Settlement Due also appears on Trade Detail (review-queue "Deferred to task breakdown", item 5).
- **D7 acceptance list.** Add AC-CALC-003 (partial: underlying-price conditions on options, measured by the contract's value at expiration at each trigger), AC-REF-001 (partial: the Long Call, Long Put, and Cash-Secured Put seeds), AC-CALC-002 (partial: an option Trade whose Underlying Mark is Missing keeps its valuation), and AC-REST-004 (partial: re-proven for the schema-6 migration).
- **D4 (P27).** A37 becomes "a nonnegative finite decimal with at most 6 fractional digits"; T4.13's Market Data validator reports a negative price instead of "a price that is not a positive finite decimal"; I4.8's "price 0" becomes "price −1" (`PriceNegative`); C4.12's "Enter price 0" becomes "Enter price −1". D7's T7.8 case is the valid red for accepting 0.
- **Review queue.** Mark "Deferred to task breakdown" item 5, D4 item 2, D5 item 2, and D6 item 1 as resolved in D7.

### 1.3 Working assumptions

Numbering continues from D6's A76–A98. These are implementation-level choices that do not reopen product semantics. They stand unless you object.

| # | Assumption |
|---|---|
| A99 | **Option Instrument:** Underlying symbol (D1 A9 format), expiration date (an ISO date), strike (a positive finite decimal with at most 6 fractional digits, normalized), right (Call or Put), and multiplier. The multiplier is **fixed at 100**; adjusted and nonstandard contracts are out of scope and not offered. The Instrument key is `OPT:<symbol>:<expiration>:<C|P>:<strike>`, for example `OPT:XYZ:2026-11-20:C:55`. A colon cannot appear in a stock symbol, so stock keys stay the bare symbol and no observation key is migrated. The display label is "XYZ 20 Nov 2026 55 Call". A stock Instrument has multiplier 1, so every money formula uses `quantity × multiplier × price`. |
| A100 | **Option Plan facts:** exactly one Planned Leg naming the exact contract, with a signed whole number of contracts (positive for Long Call and Long Put, negative for the Cash-Secured Put) and an intended entry premium per share (positive). Exactly one underlying-price Stop and one underlying-price Target, each holding only its trigger price on the Underlying, stored as conditions with their own fact identities (D1 A1). Each condition's measurement value is derived, never stored or entered: the contract's intrinsic value at the trigger, `max(0, trigger − strike)` for a Call and `max(0, strike − trigger)` for a Put, written `sE` for the Stop and `tE` for the Target (P24). Rejections name the breakeven, for example "The Target must be above the breakeven, 57.00". Long options carry **Exercise Intent**, `Authorized` or `NotAuthorized`, as a Plan fact; the Cash-Secured Put carries none. The expiration date must be on or after the Plan's New York date (`ContractAlreadyExpired`). Plan Economic Time follows decision 20. |
| A101 | **Strategy seeds (Catalog manifest v3):** Long Call (one long Call role), Long Put (one long Put role), and Cash-Secured Put (one short Put role), each with relative quantity 1, in that seed order after Long Stock, with stable product keys. Shapes are immutable. The Cash-Secured Put's description says the application does not verify cash coverage (Reference Catalog, "Strategy shapes and canonical seeds"). Retirement stays a D23 capability. |
| A102 | **Option Executions:** on the Plan's exact contract, serving its single Planned Leg, in one Trade; other contracts return `VariantNotInstalled` until D10's Planned-Leg Terms. Whole contracts only (`ContractQuantityNotWhole`). Price is the premium per share, positive (D2 A18); the fee is required (0 or more). For a long role a Buy opens and a Sell closes; for the short role a Sell opens and a Buy closes. One action per Position Change (D6 A76). An Execution's New York date must be on or before the contract's expiration date (`AfterExpiration`). |
| A103 | **Position paths for both roles (extends D6 P22):** replaying the candidate in Fact Order, the signed open quantity may never cross zero to the opposite sign (`ExceedsOpenQuantity`, naming the quantity open at that point) and may reach zero only at the last fact (`FlatBeforeLaterFacts`). A Position Change on a Closed Trade returns `TradeClosed`. So a Buy to close may not exceed the short quantity, and a Cash-Secured Put can never become long. |
| A104 | **Lots for the short role (extends D6 A78–A80):** a Sell to open creates a short Lot with its premium as basis and its fee as unconsumed opening fee. A Buy to close consumes short Lots FIFO. A short Lot Match realizes `q × 100 × (open premium − close premium) − allocated opening fee − allocated disposal fee`; a long one `q × 100 × (close premium − open premium) − fees`. A match is still identified by (opening fact, disposing fact, FIFO), where the disposing fact may be an Execution or an Expiration. |
| A105 | **Entry Quality for options (extends D2 A24 under P24):** with `sE` and `tE` the Stop's and Target's derived values at expiration (A100), a long leg's actual initial risk is `Σ n × 100 × (p − sE)` floored at 0, plus window fees, and reward `Σ n × 100 × (tE − p)` floored at 0, minus window fees; the short leg's are `Σ n × 100 × (sE − p)` and `Σ n × 100 × (p − tE)`. Slippage is signed so that positive is worse: `(avg − entry) × n × 100` for long, `(entry − avg) × n × 100` for short. Risk in Plan R, size ratio, and the two ratios follow A24. |
| A106 | **Expiration member:** a settlement fact identity with a single-version list (decision 11), naming the option Instrument, the quantity, and the settlement time (P26). It has no price and no fee, and is never stored or derived as a zero-price Execution. In D7 a Position Change holds either Executions of one action or exactly one Expiration member; a mix returns `VariantNotInstalled`. The quantity must equal the whole open quantity of that contract at the settlement time (`ExpirationMustSettleAllOpen`); D20 relaxes this when Assignment or Exercise members share the Position Change. The settlement time's New York date must be on or before the expiration date and after every Execution on the contract (`SettlementTimeInvalid`), and not in the future. An Expiration on a stock Instrument returns `NotAnOption`. It disposes Lots FIFO; an expired long Lot realizes `−q × 100 × basis − allocated opening fee`, a short Lot `+q × 100 × basis − allocated opening fee`. |
| A107 | **No agency at Expiration (extends D6 A77, A86):** an Expiration carries no trader agency, so a terminal Expiration needs no Close Reason, and one supplied returns `CloseReasonNotApplicable`. The Position Change still has one Position Change Reflection outcome (Source Position Change), and a terminal one still has a Close Review obligation `['CloseReview', tradeId]` with Source Trade Close and origin the Expiration's Position Change; its Debt's due anchor is the settlement time under `OneSessionGrace`. Close Reason and Close Review stay separate from Terminal Disposition. |
| A108 | **Terminal Disposition and Option Disposition Timing (extends D6 A84):** Terminal Disposition lists each mechanism with its quantity, for example "Closed via sale of 1 contract and expiration of 1 contract". Option Disposition Timing, for a Closed Trade with option exposure, compares the opened contract quantity with the quantities disposed by Executions (at any time, including on the expiration date) and by settlement: `FullyDisposedPreExpiration` when settlement disposed none, `FullyHeldToExpirationSettlement` when Executions disposed none, otherwise `Mixed`, with both quantities returned. Open and stock-only Trades get `NotApplicable`. Neither is stored. |
| A109 | **`evaluate` for options (extends D4 A41 under P24):** with remaining contracts `n`, option Mark `m`, basis cost `C`, unconsumed fees `F`, the derived values `sE` and `tE` (A100), and strike `K`. Long marked P&L is `n × 100 × m − C − F`; short is `C − n × 100 × m − F`. Ongoing Risk to Stop is `n × 100 × (m − sE)` for long (`(sE − m)` for short) while positive and while the Underlying condition is not crossed; otherwise 0, with Stop Overrun `n × 100 × max(0, sE − m)` for long (`max(0, m − sE)` for short) and the Underlying's distance beyond the trigger. Incremental Reward to Target and Target Overrun mirror this with `tE`. Worst-Case Ongoing Risk is the structural distance to expiration's worst case: `n × 100 × m` for a long option, `n × 100 × (K − m)` for the short Put. Maximum Incremental Reward is `Unbounded(Above)` for a Long Call, `n × 100 × (K − m)` for a Long Put, and `n × 100 × m` for the short Put. Whether a condition is crossed uses the Underlying's exact Mark, with D4 A42's contact rule. Plan-R conversions and realized-to-date follow A41 and A92. |
| A110 | **Observation requirements for options:** for a frame date on or before the expiration date, an option Trade with open quantity requires the contract's exact Mark (valuation, Worst-Case, Maximum reward) and the Underlying's exact Mark (condition status, Risk to Stop, Reward to Target), each with its own availability. For a later frame date it requires neither, and every current figure is `Unavailable(SettlementDue)` (P25). An Underlying held as stock in another Trade shares one Mark task (AC-REV-002). The Underlying's Mark also supplies the value at expiration at the latest close (A122). The dated last-close and at-entry lines (decision 26) use the same formulas with `sE` and `tE`: at entry, risk `Σ n × 100 × (p − sE)` and reward `Σ n × 100 × (tE − p)` for long, mirrored for short. |
| A111 | **Settlement Due derivation (P25):** `evaluate` returns, for each option Instrument with open quantity at the frame's cutoff, its expiration date and `Due` when that date is on or before the frame date, otherwise `NotYetDue` with the date. Daily Review and Trade Views add, for each distinct due expiration date, one `ResolveFrames` `Historical(expirationDate)` request to Market Data, whose frame carries that session's close (D4 A53); that close is the item's settlement time. If the entered expiration date is not a session (for example a pre-2015 Saturday expiration), Market Data's `NotASession` result now carries the latest session before it with its close, which is used instead (extends A53). |
| A112 | **Settlement family in the Review:** the order is Marks, settlement, the Trade walk, then the owed-reflection group (decision 29, D6 P20). Each item names the Trade, contract, open quantity and direction, expiration date, and settlement time, with **Record expiration** and the text "Use this only if the contract expired without exercise or assignment." For the Cash-Secured Put it adds "If it was assigned, this release can't record the assignment yet, so this Review stays incomplete until a later release can" (decision 10); a long option says the same of exercise. Items are ordered by expiration date, then Trade identity. A due settlement is a completion blocker, and its Trade goes in the attention band "factual or management blocker" with reason `SettlementDue`. The family is built from the eligible Trades; a Trade first opened after the Review Date's cutoff, such as a SPY contract bought at 16:10 on its expiration date, is flagged on Trade Detail at once and in the next Review. A Mark task needed only by Trades whose settlement is due reads "Needed only while settlement is due; recording the expiration removes this task". |
| A113 | **Expiration form and routes:** Trade Detail shows a Settlement Due panel with Record expiration; the Review's settlement item and walked card offer the same, opening the form in context. The form shows the contract, the quantity and settlement time (read-only, from the item), the Position Change Reflection disposition with Reflect now selected (D5 A70), and, because a single-leg Expiration is always terminal, a **Closing the Trade** section with the Close Review disposition (Reflect now selected, D6 P21) and the note "No Close Reason is needed, because the contract expired rather than being closed by your decision." Saving renders the committed Expiration, lifecycle, Terminal Disposition, Option Disposition Timing, and both reflection outcomes from the result. From the Review it then offers Refresh Review (D6 A94). |
| A114 | **Payoff view:** a hand-drawn SVG per view (Planned, Current), x from 0 to 1.5 × the largest breakpoint (strike or zero crossing), with an arrow and the text "continues rising" or "stays at" for the last segment's ray. Zero crossings, touches, and zero ranges, and each extremum's attainment set, are marked and labelled. Beneath each chart is its textual equivalent, a table with one row per segment (range, value at its start, change per $1 of the Underlying), the zero set, the Payoff Maximum and Minimum with where they are attained, and, for Current, the realized offset included. The SVG has `role="img"` and is labelled by the table's caption. Displayed values are rounded to cents and Underlying prices to at most 4 decimals; read models stay exact. Planned and Current are separate sections, and both are separate from Mark-to-Market figures (ADR 0007). |
| A115 | **Option Marks in the Review:** the Marks family lists contract keys by their label and, for every Instrument, accepts 0 (P27) with a note that 0 means it closed with no value. Market Data rejects an option key dated after its expiration date (`AfterExpiration`) and a negative price (`PriceNegative`), and still accepts any well-formed key on a completed covered session otherwise (D4 P10). |
| A116 | **Option Plan form:** the Strategy selector offers Long Stock, Long Call, Long Put, and Cash-Secured Put. Choosing an option Strategy shows the contract fields (Underlying, expiration date, strike; the right is fixed by the Strategy and shown read-only), contracts, intended entry premium with the cash amount shown as "= $400.00 for 2 contracts", the Stop and Target as Underlying triggers with the note "Risk and reward are measured by the option's value at expiration at these prices" (P24; the Plan Baseline appears after confirmation, as D1 A2 requires), and, for long options, a checkbox "I plan to exercise this option if it is in the money" whose unchecked state submits `NotAuthorized` explicitly. Values entered under one Strategy stay in view state when the trader switches, and only the selected Strategy's fields are submitted. |
| A117 | **Option Execution form (extends D2 A33, D6 A93):** Record entry and Record exit name the action by role ("Buy to open", "Sell to close" for long; "Sell to open", "Buy to close" for the Cash-Secured Put), take contracts and premium per share, and show each row's cash amount. The Closing the Trade section appears when the entered contracts total the open quantity, as in D6. |
| A118 | **Storage (schema version 6), extending A87:** Planned Leg and Execution Instruments become a tagged value (`Stock { symbol }` or `Option { symbol, expiration, strike, right, multiplier }`), and the `v5→v6` transform rewrites every existing Instrument as `Stock` with multiplier 1. Plans gain `exerciseIntent` (absent for stock and the Cash-Secured Put). Position Changes gain the Expiration member kind. No new store or index: settlement status is derived from the Trades the Review and views already load, and the closed-by-Expiration Trade uses D6's `terminalTime` and `byLifecycleTerminal`. Observation keys are unchanged (A99). |
| A119 | **Lists and Detail for options:** rows and headers show the contract label and "Long Call", "Long Put", or "Cash-Secured Put". Closed rows show the derived Terminal Disposition ("Closed via expiration", or "via sale and expiration") and Option Disposition Timing. Trade Detail adds Exercise Intent ("Not authorized in advance" or "Authorized in advance"), the contract with its expiration date, the Settlement Due panel or "Expires Fri 20 Nov 2026" before then, the Planned and Current payoff views, and, for Closed option Trades, Option Disposition Timing with both quantities. A Long Stock Detail shows "Expiration payoff: not applicable, because this Trade has no option" for both views (AC-CALC-004). |
| A120 | **Previous release:** the harness builds the D6 release from the tag `claude-opus-5.5-d6`, exported with `git archive` and never as a worktree (D2 A34). |
| A121 | **Fixture views across schemas (extends A98):** a Workspace migrated from schema 1 to 5 has no option Trade. Its Instruments read as Stock with multiplier 1, both payoff views of every Trade are `NotApplicable(NoOptionExpirationAnchor)`, the settlement family is empty, and every earlier field equals the fixture's snapshot. |
| A122 | **Value at expiration at the latest close (P24):** `evaluate` returns, for an Open option Trade, its Current Expiration Payoff read at the Underlying's exact Mark for the frame date, as its own Calculation Result labelled `ExpirationValueAtUnderlyingClose` with the Underlying price used. It is `Unavailable(MarkMissing)` when that Mark is Missing or acknowledged (never a Stale price), `Unavailable(SettlementDue)` after the expiration date, and `NotApplicable` when flat or stock-only. It includes realized-to-date and unconsumed fees, like the Current payoff. Trade Detail and the Review card show it as "If XYZ is at 52.00 at expiration: −$401.30", next to the payoff view and apart from Mark-to-Market figures, and the payoff chart marks that point. It is never called a valuation, P&L, or current value (ADR 0007). |

### 1.4 Benchmark dataset at D7

The generator version is bumped. The mature profile's counts are unchanged ([D1 section 1.3](D01-start-a-workspace-and-confirm-a-long-stock-plan.md#13-mature-dataset-profile-agreed-with-p1)); D7 changes their mix.

| Record kind | Count at D6 | Count at D7 | Mature profile |
|---|---|---|---|
| Trades | 25,000 (24,700 Closed, 200 Open, 100 Planned), all Long Stock | 25,000 in the same lifecycles; 30% single-leg options (Long Call 12%, Long Put 8%, Cash-Secured Put 10%) | 25,000 |
| Executions and settlement facts | about 200,000 Executions | about 200,000, of which about 3,000 Expirations (40% of Closed option Trades end by expiring, 30% of those after a partial exit) | 200,000 |
| Option Plans with Exercise Intent | — | 5,000 long-option Plans, 10% Authorized | — |
| Marks | as at D6 | about 190,000: the Open book of 200 Trades has 60 option Trades, and distinct Instruments per session stay about 150 because most option Underlyings are also held as stock | 190,000 |
| Close Review outcomes | 24,700 | 24,700, including the expired Trades, split as D5 section 1.4 | 24,700 |

At the as-of instant, which the generator moves to Friday 2026-11-20 17:00, four Open option Trades are Settlement Due, so the as-of Review includes the settlement family. Every count, the as-of instant, and the identities of the as-of Review's settlement family, walk, and owed-reflection group are recorded in `bench/dataset.json`.

---

## 2. Implementation boundaries added or extended in D7

| Canonical boundary | Code location | D7 operations |
|---|---|---|
| Instruments (pure) | `src/domain/instruments/` (new) | option contract validation, Instrument key, label, multiplier |
| Trade Analysis (pure) | `src/domain/trade-analysis/` | `assessPlan` for Long Call, Long Put, and Cash-Secured Put; `expirationPayoff` (Planned and Current); `derive` with the multiplier, short Lots, Expiration members, Terminal Disposition mechanisms, Option Disposition Timing, option Entry Quality; `evaluate` for options with the values at expiration at each trigger, option and Underlying requirements, the value at expiration at the latest close, and Settlement Due |
| Trade Record | `src/modules/trade-record/` | option Plan facts, Exercise Intent, option Executions, Expiration settlement facts; section validator extended |
| Reference Catalog | `src/modules/reference-catalog/` | seed manifest v3 (three option Strategies); section validator extended |
| Market Data | `src/modules/market-data/` | option keys; Marks of 0; `AfterExpiration`; `NotASession` with the latest earlier session; section validator extended |
| Trade Workflows | `src/coordinators/trade-workflows/` | `confirmPlan` for option Plans; `recordPositionChange` with option Executions in both roles and an Expiration member |
| Daily Review | `src/coordinators/daily-review/` | `open` with the settlement family and option requirements; `getTrade` with Settlement Due and payoff |
| Trade Views and Reporting | `src/coordinators/trade-views/` | `browseTrades` and `getTradeDetail` for option Trades, Settlement Due, payoff views, Option Disposition Timing |
| Workspace | `src/coordinators/workspace/` | migration to schema 6; Catalog manifest v3; Installed Capability Manifest v6 |
| Persistence/Transaction (internal) | `src/persistence/` | schema v6 layout |
| Migrations | `src/persistence/migrations/` | `v5→v6` and the `v1→…→v6` chain |
| UI | `src/ui/` | option Plan form, option Execution form, expiration form, payoff view, option lists and Detail, Review settlement family and option Marks |

---

## 3. Task graph

Kind: **B** = behavioral (TDD, red→green per case), **S** = structural (exact verification).

| Task | Title | Layer | Kind | Blocked by | Public seam under test |
|---|---|---|---|---|---|
| T7.1 | Option Instruments and keys | domain | B | D1 T1.5 | `src/domain/instruments` exports |
| T7.2 | Trade Analysis: `assessPlan` for single-leg options | domain | B | T7.1, D1 T1.13 | `TradeAnalysis.assessPlan` |
| T7.3 | Trade Analysis: `expirationPayoff` | domain | B | T7.2, D6 T6.1 | `TradeAnalysis.expirationPayoff`, `assessPlan` |
| T7.4 | Trade Analysis: option Executions, short Lots, Entry Quality, position paths | domain | B | T7.2, D6 T6.3 | `TradeAnalysis.derive` |
| T7.5 | Trade Analysis: Expiration, Terminal Disposition, Option Disposition Timing | domain | B | T7.4 | `TradeAnalysis.derive` |
| T7.6 | Trade Analysis: `evaluate` for options and Settlement Due | domain | B | T7.5, D6 T6.4 | `TradeAnalysis.evaluate` |
| T7.7 | Persistence: schema v6 and the `v5→v6` transform | persistence | B | D6 T6.5 | internal `Persistence` interface, migration transform |
| T7.8 | Market Data: option keys and Marks | domain/persistence | B | T7.1, T7.7 | `MarketData.save`, `query` |
| T7.9 | Reference Catalog: option Strategies | domain/persistence | B | T7.7 | `ReferenceCatalog.seedDefaults`, `query` |
| T7.10 | Trade Record: option facts and Expiration | domain/persistence | B | T7.5, T7.7 | `TradeRecord` |
| T7.11 | Section validators: Trade Record, Catalog, Market Data | domain | B | T7.8–T7.10 | `validateSection` |
| T7.12 | Trade Workflows: `confirmPlan` for options | application | B | T7.3, T7.9, T7.10 | `TradeWorkflows.confirmPlan` |
| T7.13 | Trade Workflows: `recordPositionChange` for options and Expiration | application | B | T7.6, T7.10 | `TradeWorkflows.recordPositionChange` |
| T7.14 | Daily Review: `open` with the settlement family | application | B | T7.6, T7.8, T7.10 | `DailyReview.open` |
| T7.15 | Daily Review: `getTrade` with Settlement Due and payoff | application | B | T7.14 | `DailyReview.getTrade` |
| T7.16 | Trade Views: option lists and Detail | application | B | T7.3, T7.6, T7.8, T7.10 | `TradeViewsAndReporting` |
| T7.17 | Workspace: migration to schema 6 | application | B | T7.7, T7.9, T7.11 | `Workspace.initialize` |
| T7.18 | Installed Capability Manifest and composition root for D7 | application | S | T7.12–T7.17 | `verify:capabilities` |
| T7.19 | UI: option Plan form | UI | B | T7.18 | `PlanForm` |
| T7.20 | UI: option Execution form | UI | B | T7.18 | `PositionChangeForm` |
| T7.21 | UI: expiration form | UI | B | T7.18 | `ExpirationForm` |
| T7.22 | UI: payoff view | UI | B | T7.18 | `PayoffView` |
| T7.23 | UI: option lists and Trade Detail | UI | B | T7.21, T7.22 | `TradeList`, `TradeDetail` |
| T7.24 | UI: Review settlement family and option Marks | UI | B | T7.21 | `ReviewView`, `MarkEntry`, `ReviewTrade` |
| T7.25 | Release harness: previous release from the `claude-opus-5.5-d6` tag | test | S | D6 T6.21 | `build:releases`, `verify:releases` |
| T7.26 | Capacity basis recomputed for schema 6 | test/infrastructure | S | T7.18 | `measure:capacity`, `verify:capacity` |
| T7.27 | Freeze the schema-v6 fixture; migrate the v1–v5 fixtures | test | S | T7.17, T7.18 | `fixtures:freeze`, `verify:fixtures` |
| T7.28 | Benchmark generator: option Trades and Expirations | test | S | T7.18, D6 T6.24 | `build:bench`, `bench:generate` |
| T7.29 | Latency harness and query-count proof, extended | test | S | T7.28 | `bench:run`, `test:integration -- d7/query-count` |
| T7.30 | Node mock-free integration suite | test | S | T7.18 | `test:integration` |
| T7.31 | Browser integration suite (Chromium) | test | S | T7.19–T7.27 | `test:e2e` |
| T7.32 | Independent browser-critic gate | test | S | all | fresh critic report |

**Parallel tracks.** Once the option Plan facts, the Expiration member, the payoff read model, and the Settlement Due item are fixed in T7.18's type module, four tracks proceed in parallel:
- **Trade Analysis** (T7.1–T7.6), with payoff arithmetic (T7.3) independent of the Lot work (T7.4–T7.5) once T7.2 lands.
- **Persistence, Market Data, Catalog, and Trade Record** (T7.7–T7.11, T7.17).
- **Coordinators** (T7.12–T7.16), joining the first two as their tasks land.
- **UI** (T7.19–T7.24), against the facade test double.

---

## 4. Behavioral tasks

Every case runs **red → green** individually, as the kickoff prompt requires. A case that passes on its first run, or fails for a syntax, configuration, fixture, or unrelated reason, is not valid red evidence; it must be fixed and rerun to a genuine red, never logged and skipped. Cases are ordered so that each one targets behavior the previous cases did not need. Properties that would pass for free are folded into the case that creates them or proven only by an integration case, and each such fold is named below.

All dates are 2026, New York time. Every contract expires Friday **2026-11-20**, a regular session closing at 16:00, unless stated.

**O-C, Long Call** on XYZ: contract XYZ 20 Nov 2026 55 Call. Plan Monday 10-12 09:00 for 2 contracts at intended entry 2.00; Stop "XYZ at or below 48.00" (value at expiration 0); Target "XYZ at or above 60.00" (value 5.00); Exercise Intent NotAuthorized. 1R = 2 × 100 × (2.00 − 0) = **$400**; Original Planned Reward 2 × 100 × (5.00 − 2.00) = $600; ratio 3/2; breakeven 57.00.
- **PC1** Monday 10:00, Buy 1 @ 2.10, fee 0.65; **PC2** Monday 11:00, Buy 1 @ 1.90, fee 0.65.
- **X1** Tuesday 10-13 10:00, Sell 1 @ 3.00, fee 0.65 (Lot Match PC1 ← X1, realized 90.00 − 0.65 − 0.65 = **88.70**).
- **E1** Expiration of 1 contract, settlement time Friday 11-20 16:00 (Lot Match PC2 ← E1, realized −190.00 − 0.65 = **−190.65**). Total realized **−101.95**, Realized R −2039/8000.
- **X1′** (payoff variant): X1 at 4.0195 instead of 3.00, realizing 191.95 − 1.30 = 190.65, which exactly offsets the remaining Lot.

**O-P, Long Put** on ABC: ABC 20 Nov 2026 50 Put. Plan 1 contract at 1.50; Stop "ABC at or above 55.00" (value 0); Target "ABC at or below 45.00" (value 5.00); Exercise Intent Authorized. 1R **$150**, reward $350, ratio 7/3. **P1** Monday 10:00, Buy 1 @ 1.50, fee 0.65; **Q1** Friday 11-20 11:00, Sell 1 @ 2.20, fee 0.65 (realized 68.70, Realized R 229/500).

**O-S, Cash-Secured Put** on MNO: MNO 20 Nov 2026 45 Put, short. Plan −2 contracts at 1.20 credit; Stop "MNO at or below 42.00" (value 3.00); Target "MNO at or above 50.00" (value 0); breakeven 43.80. 1R = 2 × 100 × (3.00 − 1.20) = **$360**, reward 2 × 100 × 1.20 = $240, ratio 2/3. **S1** Monday 10:00, Sell 2 @ 1.25, fee 1.30. **B1** Tuesday 10:00, Buy 1 @ 0.60, fee 0.65 (Lot Match S1 ← B1, realized 65.00 − 0.65 − 0.65 = 63.70). **E-S** Expiration of 2 contracts at Friday 16:00 after S1 alone (realized 250.00 − 1.30 = **248.70**, Realized R 829/1200).

**T-A**, D6's Long Stock reference Trade, is the stock-only comparison.

### T7.1 Option Instruments and keys

Seam: `src/domain/instruments` exports (pure).

```text
describe("option contract (A99)")
  it should normalize XYZ, 2026-11-20, strike 55.00, Call to key OPT:XYZ:2026-11-20:C:55, multiplier 100, and label "XYZ 20 Nov 2026 55 Call", and parse that key back to the same contract
  it should reject a malformed symbol, a non-ISO date, a strike that is zero, negative, or has 7 fractional digits, and a right other than Call or Put, returning every issue at once
  it should classify a bare symbol such as BRK.B as a Stock key with multiplier 1
```

### T7.2 Trade Analysis: `assessPlan` for single-leg options

Seam: `TradeAnalysis.assessPlan` (pure).

```text
describe("assessPlan: Long Call (P24, A100)")
  it should accept O-C with Original Planned Risk $400, Original Planned Reward $600, ratio 3/2, 1R $400, Exercise Intent NotAuthorized, and per-condition basis naming each Underlying trigger and its value at expiration (0 and 5.00) as the measurement basis, labelled underlying-price, not structure-value
  it should reject a Stop at 58.00 (value 3.00, not below the entry) with NoPositiveRisk and a Target at 56.00 (value 1.00, below the breakeven 57.00) with TargetNotBeyondEntry naming the breakeven
  it should reject an Underlying Stop at or above the Underlying Target with StopTargetOrder

describe("assessPlan: Long Put and Cash-Secured Put")
  it should accept O-P (1R $150, reward $350, ratio 7/3) with its Stop above its Target, and O-S as a short leg of −2 (1R $360, reward $240, ratio 2/3), whose risk comes from its Stop's value at expiration (3.00) above the credit, and reject an O-S Stop at 44.00, above the breakeven 43.80, with NoPositiveRisk
  it should reject Exercise Intent on the Cash-Secured Put with ExerciseIntentNotApplicable, and a long option without it with ExerciseIntentRequired

describe("assessPlan: option shape and contract")
  it should reject a Put leg on Long Call, a long leg on Cash-Secured Put, 1.5 contracts, and an expiration date before the Plan's New York date with StrategyShapeMismatch, ContractQuantityNotWhole, and ContractAlreadyExpired, all at once
```

Folded: exact rational arithmetic is asserted inside the first case's Plan-R ratio; D1's cases already prove it for stock.

### T7.3 Trade Analysis: `expirationPayoff`

Seam: `TradeAnalysis.expirationPayoff` (pure), and `assessPlan` for the last case.

```text
describe("Planned view")
  it should return O-C's Planned curve as two normalized segments ([0, 55] at −400 with slope 0; [55, ∞) from −400 with slope 200), zero set {Crossing 57}, Payoff Maximum Unbounded Above, and Payoff Minimum −400 attained on [0, 55]
  it should return O-P's curve with Maximum 4,850 attained at {0}, Minimum −150 attained on the ray [50, ∞), and {Crossing 48.5}, and O-S's with Maximum 240 on [45, ∞), Minimum −8,760 at {0}, and {Crossing 43.8}
  it should report a Touch at 0, Maximum 0 attained at {0}, and no Crossing for the Plan facts of a Long Put DEF 5 Put at 5.00 (a curve that assessPlan would reject, used here only because a single leg reaches a Touch no other way)

describe("Current view")
  it should return O-C after PC2 with realized offset 0 and unconsumed fees 1.30 as {Crossing 57.0065} and Minimum −401.30 on [0, 55], and after X1 with realized offset 88.70 as {Crossing 56.0195} and Minimum −101.95, while the Planned view stays the one above
  it should give short Lots a falling segment: O-S after S1 has Maximum 248.70 on [45, ∞), Minimum −8,751.30 at {0}, and {Crossing 43.7565}
  it should return Zero Range [0, 55] and no Crossing when X1′ makes the flat segment exactly zero
  it should return Current NotApplicable(NoRemainingPosition) when flat, and both views NotApplicable(NoOptionExpirationAnchor) for T-A

describe("Planned payoff at confirmation")
  it should return from assessPlan, with an accepted option Plan, the same Planned view as expirationPayoff for those Plan facts
```

Folded: "no theoretical price" is a property of the input type, which accepts no Marks or dates; it is asserted in the first case's input. Multiple expirations (`Unavailable`) cannot arise with one Planned Leg and arrive with D10.

### T7.4 Trade Analysis: option Executions, short Lots, Entry Quality, position paths

Seam: `TradeAnalysis.derive` (pure).

```text
describe("option Lots and FIFO with the multiplier (A102, A104)")
  it should derive O-C after X1 as Position 1 contract, Lot Match PC1 ← X1 realizing 88.70, and the remaining Lot PC2 1 @ 1.90 with fee 0.65
  it should derive O-S's short Lot −2 @ 1.25 with fee 1.30 and, after B1, Lot Match S1 ← B1 realizing 63.70, with the remaining short Lot of 1 keeping fee 0.65

describe("Entry Quality for options (A105)")
  it should resolve O-C at PC2 with risk $401.30, reward $598.70, slippage $0.00, size ratio 1, and risk 4013/4000 R, and O-S at S1 with risk $351.30, reward $248.70, and slippage −$10.00

describe("position paths for both roles (A103)")
  it should return ExceedsOpenQuantity(2) for a Buy 3 after S1 and ExceedsOpenQuantity(0) for a Buy dated Monday 09:45 before S1, and FlatBeforeLaterFacts for a Buy 2 dated Monday 10:30 when a Sell 1 is dated Monday 11:00
  it should return AfterExpiration for an Execution dated 2026-11-23 and ContractQuantityNotWhole for 1.5 contracts
```

Proven only by integration, because they pass for free once these and D6's cases are green: the Entry window cut by an option exit with its Entry Size shortfall, and FIFO re-running after an earlier-dated option exit (I7.4).

### T7.5 Trade Analysis: Expiration, Terminal Disposition, Option Disposition Timing

Seam: `TradeAnalysis.derive` (pure).

```text
describe("Expiration member (A106, P26)")
  it should consume O-C's remaining Lot with E1 as Lot Match PC2 ← E1 realizing −190.65, with no price or fee on the settlement fact, and expect Closed with terminal time Friday 16:00, realized −101.95, and Realized R −2039/8000
  it should report the close requirement TerminalWithoutAgency for E1, where X2 in D6 is TerminalWithAgency (A107)
  it should return ExpirationMustSettleAllOpen for 1 of O-S's 2 contracts, SettlementTimeInvalid for a settlement time dated 2026-11-23 or before an Execution on the contract, and NotAnOption for an Expiration on XYZ stock

describe("Terminal Disposition and Option Disposition Timing (A108)")
  it should derive O-C as [Executions: 1 contract; Expiration: 1 contract] and Mixed (1 and 1), O-S after E-S as [Expiration: 2 contracts] and FullyHeldToExpirationSettlement with Realized R 829/1200, and O-P after Q1 on the expiration date as FullyDisposedPreExpiration, with Open option Trades and T-A NotApplicable
```

### T7.6 Trade Analysis: `evaluate` for options and Settlement Due

Seam: `TradeAnalysis.evaluate` (pure). Frames are built in the test; each frame carries its date and close.

```text
describe("option valuation (A109)")
  it should value O-C after PC2 at a call Mark of 2.40 as market value $480.00, remaining-open marked P&L $78.70 (787/4000 R), and incurred fees $1.30, and O-S after S1 at a put Mark of 0.80 as $88.70 with the short sign

describe("risk and reward against the values at expiration (P24, A109)")
  it should return for O-C at 2.40 with XYZ 52.00 Risk to Stop $480.00 (6/5 R), Worst-Case $480.00, Reward to Target $520.00 (13/10 R), Maximum Unbounded(Above), and both conditions not crossed with Underlying distances 4.00 and 8.00
  it should return for O-S at 0.80 with MNO 47.00 Risk to Stop $440.00 (11/9 R), Worst-Case $8,840.00, Reward to Target $160.00, and Maximum $160.00, and for O-P at 1.80 with ABC 49.00 Maximum $4,820.00
  it should report O-C's Stop Breached at XYZ 47.50 with the call at 0.90 (Risk to Stop $0.00, Stop Overrun $0.00, Underlying 0.50 beyond), and O-S's Stop Breached at MNO 41.50 with the put at 3.80 (Risk to Stop $0.00, Stop Overrun $160.00 or 4/9 R)

describe("evidence requirements and availability (A110, P27)")
  it should require both the call's and XYZ's exact Marks for frame 2026-11-20, and with XYZ Missing return condition status, Risk to Stop, and Reward to Target as Unavailable(MarkMissing XYZ) while valuation, Worst-Case, and Maximum stay Values
  it should evaluate a call Mark of exactly 0 as marked P&L −$401.30, Worst-Case $0.00, and Risk to Stop $0.00

describe("Settlement Due (P25, A111)")
  it should return O-S as Due (2 contracts short, 2026-11-20) for frames 2026-11-20 and 2026-11-23, with normal figures on 2026-11-20 and, on 2026-11-23, no requirement and every current figure Unavailable(SettlementDue); NotYetDue for 2026-11-19; and nothing after E-S

describe("at-entry line for options (A110, decision 26)")
  it should return at-entry risk $190.00 and reward $310.00 for PC2 dated Tuesday 10:00 under Monday's frame

describe("value at expiration at the latest close (P24, A122)")
  it should return O-C's Current payoff read at XYZ's frame Mark as −$401.30 at 52.00, Unavailable(MarkMissing XYZ) without it, and NotApplicable for T-A and for a flat Trade
```

Proven only by integration: the dated last-close line for an option Trade (I7.15), which reuses D4's mechanism unchanged once this task's formulas are green.

### T7.7 Persistence: schema v6

Seam: the internal `Persistence` interface and the `v5→v6` transform, against `fake-indexeddb`.

```text
describe("schema v6 layout")
  it should create a fresh Workspace at schema version 6 with the same stores and indexes as schema 5

describe("v5 → v6 transform (A118)")
  it should rewrite every Planned Leg and Execution Instrument as Stock with multiplier 1, change nothing else in any store, and migrate a v1 Workspace through every step to v6 inside one candidate
```

### T7.8 Market Data: option keys and Marks

Seam: `MarketData.save` and `query`, against `fake-indexeddb`.

```text
describe("option Marks (P27, A115)")
  it should record initial Manual Marks of 0 for OPT:XYZ:2026-11-20:C:55 and for XYZ stock on 2026-11-20 and resolve both Available, and reject −0.01 with PriceNegative
  it should reject a Mark for that contract dated 2026-11-23 with AfterExpiration

describe("frames for a non-session date (A111)")
  it should return NotASession for Historical(2015-01-17), a Saturday, carrying Friday 2015-01-16 and its close
```

### T7.9 Reference Catalog: option Strategies

Seam: `ReferenceCatalog.seedDefaults` and `query`, against `fake-indexeddb`.

```text
describe("seedDefaults: manifest v3 (A101)")
  it should add Long Call (one long Call role), Long Put (one long Put role), and Cash-Secured Put (one short Put role), with relative quantity 1, after Long Stock in that order, and nothing else, to a v2-seeded Catalog, and add nothing when run again
  it should list the four selectable Strategies in seed order with their immutable shapes
```

### T7.10 Trade Record: option facts and Expiration

Seam: `TradeRecord`, against `fake-indexeddb`.

```text
describe("prepareChange: ConfirmPlan for an option")
  it should build a candidate with the option Planned Leg, signed contracts, conditions holding only their Underlying triggers, and the Exercise Intent fact

describe("prepareChange and applyPreparedChange: Expiration")
  it should build a candidate Position Change with one Expiration settlement fact identity holding the Instrument, quantity, and settlement time and no price or fee, and on apply move the Trade from Open to Closed with terminalTime equal to the settlement time, storing no Lot-Match record

describe("getRecord")
  it should return the option facts and the Expiration member in AnalysisInput
```

Folded: option Executions add no Trade Record behavior beyond the Instrument value, which the transform (T7.7) and the first case already exercise.

### T7.11 Section validators

Seam: `validateSection(snapshot)` exported by Trade Record, Reference Catalog, and Market Data.

```text
describe("Trade Record section, options")
  it should accept option Trades with Executions and an Expiration, and report Exercise Intent on a Cash-Secured Put, a Close Reason on a Position Change whose terminal member is an Expiration, an Expiration with a price, and an option Execution of a fractional quantity

describe("Catalog section, option Strategies")
  it should report a seeded option Strategy whose shape differs from its product key's shape

describe("Market Data section, options")
  it should accept option and stock Marks of 0 and report a negative price and an option observation dated after its expiration date
```

### T7.12 Trade Workflows: `confirmPlan` for options

Seam: `TradeWorkflows.confirmPlan`.

```text
describe("confirmPlan: option Plans (AC-PLAN-001)")
  it should commit O-C with its exact contract, frozen conditions, Exercise Intent, Planned lifecycle, and the Plan Reflection in one semantic commit, returning 1R $400 and the Planned payoff view with the post-commit Trade
  it should aggregate assessPlan's option issues with Catalog and Journal issues into one rejection and leave every content revision unchanged
```

### T7.13 Trade Workflows: `recordPositionChange` for options and Expiration

Seam: `TradeWorkflows.recordPositionChange`.

```text
describe("option Executions")
  it should commit S1 as a Sell to open and B1 as a Buy to close on O-S, returning the derived short Lot and Lot Match equal to a fresh derivation of the stored Trade (AC-RESP-001)
  it should require a Close Reason when a Buy to close makes O-S flat, as for any terminal exit with agency

describe("Expiration (AC-POS-004, A107)")
  it should commit E1 with no Close Reason, the Open-to-Closed move, the terminal time, the reflection outcome, and the Close Review outcome for each disposition (Complete, Decline, Defer) in one semantic commit, returning the Terminal Disposition, Option Disposition Timing, Realized R, and both Journal projections
  it should reject a Close Reason on E1 with CloseReasonNotApplicable, and an Expiration mixed with an Execution in one Position Change with VariantNotInstalled
  it should return the analysis's ExpirationMustSettleAllOpen and SettlementTimeInvalid issues, and reject a settlement time in the future with EconomicTimeInFuture, writing nothing
```

Proven only by integration (generic once these are green): the write gate for Expirations (I7.12), a repeated Expiration returning Conflict (I7.11), and `TradeClosed` after an Expiration (I7.8).

### T7.14 Daily Review: `open` with the settlement family

Seam: `DailyReview.open`, against `fake-indexeddb`.

**Settlement Review fixture** (Review at Friday 11-20 17:00, Review Date 2026-11-20, cutoff 16:00; and Monday 11-23 17:00):

| Trade | Facts | Friday Marks given | Expected on Friday |
|---|---|---|---|
| T-1 | O-C through X1 (1 contract left) | the call 0.05 | settlement item; walked, blocker band (`SettlementDue`) |
| T-2 | Long Stock XYZ, 100 shares since Monday 10-12 | none (XYZ Missing) | walked; XYZ's Mark task names T-1 and T-2 |
| T-3 | O-S after S1 (2 short) | the put 0.00, MNO 46.00 | settlement item with the assignment explanation; walked, blocker band |
| T-4 | Long Put ABC 18 Dec 2026 50 Put, 1 contract since 11-16 | the put, ABC | walked; no settlement |
| T-5 | Long Stock KLM since 11-16; reflection on a Thursday 11-19 10:00 add deferred | KLM | walked; its card's reflection Due |

```text
describe("task families (AC-REV-002, decision 29, A112)")
  it should return, in order, the Marks family (XYZ naming T-1 and T-2), the settlement family (T-1 then T-3, each with contract, quantity, expiration date, and settlement time Friday 16:00), the walk with T-1 and T-3 in the blocker band, and an empty owed-reflection group
  it should name among the completion blockers XYZ's Mark, both settlements, every missing Action, and T-5's reflection

describe("after the expiration session (P25, A110)")
  it should, at Monday 17:00 with nothing recorded, keep T-1 and T-3 Settlement Due and walked with settlement time Friday 16:00, and list no Mark task for either contract or for MNO, while XYZ's task names T-1 and T-2
```

Proven only by integration: T-1 leaving the walk and its Close Review joining the owed group after E1 is recorded (I7.7), which follows from D6's eligibility rule once the Expiration's terminal time is at the cutoff.

### T7.15 Daily Review: `getTrade` with Settlement Due and payoff

Seam: `DailyReview.getTrade`, with the Settlement Review fixture at Friday 17:00.

```text
describe("settlement and payoff in the card")
  it should return T-3's card with its Settlement Due item, the Record expiration route with the settlement time, the assignment explanation, its Review-date evaluation, its Current payoff summary (zero set and extrema), and its value at expiration at MNO's close (A122), and T-4's with payoff and value at expiration and no settlement item
```

### T7.16 Trade Views: option lists and Detail

Seam: `TradeViewsAndReporting.browseTrades` and `getTradeDetail`.

```text
describe("getTradeDetail: option Trades (AC-SET-003, A119)")
  it should return O-S at Friday 17:00 with stored lifecycle Open, no Expiration fact, a Settlement Due item with settlement time Friday 16:00, and both payoff views, and at Thursday 17:00 the same Trade with "expires 2026-11-20", no item, and its value at expiration at MNO's Thursday close
  it should return O-C after E1 as Closed with Terminal Disposition and Option Disposition Timing Mixed with both quantities, no Close Reason, Exercise Intent NotAuthorized, the Planned payoff, Current NotApplicable(NoRemainingPosition), and no Mark requirement

describe("browseTrades: option rows")
  it should return Open, Planned, and Closed rows with the contract label and Strategy, and Closed rows with "via expiration" or "via sale and expiration" and Option Disposition Timing, reading Market Data only for Open rows
```

Proven only by integration: T-A's Detail showing both payoff views Not Applicable (I7.10), which passes for free once T7.3 is green.

### T7.17 Workspace: migration to schema 6

Seam: `Workspace.initialize` and `getStatus`.

```text
describe("migration to schema 6")
  it should migrate v1 through v5 Workspaces to schema 6 and return Opened with a receipt naming the from and to versions, per-store counts, and the seed additions (Long Call, Long Put, Cash-Secured Put)
```

### T7.19 UI: option Plan form

Seam: `PlanForm` with a facade test double.

```text
describe("option Strategies (A116)")
  it should offer Long Stock, Long Call, Long Put, and Cash-Secured Put, and for Long Call show Underlying, expiration date, strike, the right "Call" read-only, contracts, entry premium with its cash amount, the Stop and Target as Underlying triggers with the note that risk and reward are measured by the option's value at expiration at those prices, and the exercise checkbox unchecked
  it should hide the exercise checkbox for Cash-Secured Put
  it should submit NotAuthorized when the checkbox is unchecked, and only the selected Strategy's fields, keeping values from another Strategy in view state
  it should show StopTargetOrder and TargetNotBeyondEntry, with its breakeven, beside the trigger fields, and render the confirmed Plan's 1R and Planned payoff from the result
```

### T7.20 UI: option Execution form

Seam: `PositionChangeForm` with a facade test double.

```text
describe("option Executions (A117)")
  it should label the action "Buy to open" and "Sell to close" on a Long Call and "Sell to open" and "Buy to close" on a Cash-Secured Put, take contracts and premium, and show each row's cash amount
  it should show Closing the Trade when the entered contracts total the open quantity, and "Only 2 contracts are open" for a Buy 3 to close
```

### T7.21 UI: expiration form

Seam: `ExpirationForm` with a facade test double.

```text
describe("rendering (A113)")
  it should show the contract, quantity, and settlement time read-only, the reflection disposition and the Close Review disposition each with Reflect now selected, no Close Reason, and the note explaining why none is needed

describe("submission")
  it should submit one Expiration member with the item's quantity and settlement time and both dispositions, and render the Closed Trade, Terminal Disposition, Option Disposition Timing, and both reflection outcomes from the result alone
```

### T7.22 UI: payoff view

Seam: `PayoffView` with fixed payoff read models.

```text
describe("chart and textual equivalent (A114, AC-UI-002)")
  it should render O-C's Planned view as an SVG with role img labelled by a table listing both segments, "Breakeven 57.00", "Max loss $400.00 for XYZ from 0 to 55.00", and "Max profit: unlimited"
  it should render a Zero Range as a labelled range and a Touch as a labelled point, and Current with its realized offset stated in the caption
  it should mark the value at expiration at the latest close on the Current chart and state it as "If XYZ is at 52.00 at expiration: −$401.30", and render NotApplicable views as text naming the reason, with no chart
```

### T7.23 UI: option lists and Trade Detail

Seam: `TradeList` and `TradeDetail` with a facade test double.

```text
describe("option Trade Detail (A119)")
  it should show the contract label, Exercise Intent, Planned and Current payoff sections and the value at expiration at the latest close, all separate from current figures, and, when due, a Settlement Due panel with Record expiration only while Writable
  it should show a Closed option Trade's "Closed via sale of 1 contract and expiration of 1 contract", Option Disposition Timing "Mixed: 1 before expiration, 1 at expiration", and no Close Reason field

describe("option rows")
  it should show the contract label and Strategy on Open, Planned, and Closed rows, and "Settlement due" as text on an Open row that needs it
```

### T7.24 UI: Review settlement family and option Marks

Seam: `ReviewView`, `MarkEntry`, and `ReviewTrade` with a facade test double.

```text
describe("settlement family (A112)")
  it should show the settlement family between Marks and the walk, each item with its contract, quantity, settlement time, Record expiration, and the assignment or exercise explanation as text
  it should open the expiration form in context and after Save show the recorded Expiration from the result with Refresh Review

describe("option Marks (A115)")
  it should accept 0 for a contract with its explanatory note, and show "Needed only while settlement is due" on a task needed only by Settlement Due Trades
```

---

## 5. Structural tasks

| Task | Verification (exact) | Expected result | Behavior that depends on it |
|---|---|---|---|
| T7.18 Capability manifest and composition | `npm run verify:capabilities` | The manifest adds `assessPlan` and `confirmPlan` for Long Call, Long Put, and Cash-Secured Put; `recordPositionChange` with option Executions in both roles and the Expiration member; `expirationPayoff` (Planned and Current, single expiration) in `getTradeDetail` and `DailyReview.getTrade`; the settlement family in `DailyReview.open`; option Instruments in `MarketData.save` and `query`; the three Strategies; and schema version 6. Assignment, Exercise, cash settlement, multi-leg Strategies, and structure-value conditions stay absent. Every new operation is reachable from the Plan form, the Execution and expiration forms, Trade Detail, or the Review, and nothing beyond D7 is. | AC-CAP-001. |
| T7.25 Previous-release harness | `npm run build:releases && npm run verify:releases` | `dist-releases/d6` is built from tag `claude-opus-5.5-d6` (A120), alongside the existing folders and a current `d7`. `verify:releases` confirms `d6` reports schema 5 and its own release identity. | B7.7, C7.8. |
| T7.26 Capacity basis | `npm run measure:capacity`, then `npm run verify:capacity` | The measurement confirms 600 option Plans and 400 Expirations through the facade with section 1.4's mix, and replaces the settlement-fact allowance with measured bytes. `capacity-basis.json` carries schema version 6, and `verify:capacity` fails if it still names schema 5. | Capacity readiness check (decision 18). |
| T7.27 Schema fixtures | `npm run fixtures:freeze -- --schema 6`, then `npm run verify:fixtures` | The v6 dump adds to D6's fixture content, as of Friday 11-20 17:00: O-C through X1 with Settlement Due, O-S expired with a deferred Close Review, O-P closed by Q1, and a Planned Long Call with Exercise Intent Authorized. `verify:fixtures` migrates the v1–v5 dumps and checks their views per A121, then checks that the v6 dump opens Ready and that its lists, Details, payoff views, and Review equal its own snapshot. | Migration from every earlier version; D8 onward. |
| T7.28 Benchmark generator | `npm run build:bench && npm run bench:generate` | The generator produces the section 1.4 mix through the production facade, records its counts, generator version, and as-of instant in `bench/dataset.json`, and caches the profile. | T7.29. |
| T7.29 Latency harness and query count | `npm run bench:run`; `npm run test:integration -- d7/query-count` | As D6's T6.25; results go to `evidence/D07/bench.md`. Before and after the runs, the harness compares every Open row (including option figures) and the first Closed page with the generator's expected values, and the as-of Review's settlement family, walk, and owed group with the expected identities. The Node test shows that a Review `open` adds to D6's counts exactly one `Historical` frame request per distinct due expiration date and nothing per Trade, and that Trade Detail adds at most one. | AC-PERF-001. |
| T7.30 Node integration suite | `npm run test:integration` | Every case in sections 6.1 of D1, D2, D4, D5, D6, and D7 passes. | Cumulative regression. |
| T7.31 Browser integration suite | `npm run test:e2e` (Chromium) | Every case in sections 6.2 of D1, D2, D4, D5, D6, and D7 passes. | Cumulative regression. |
| T7.32 Browser critic | Fresh critic agent per section 7 | A structured report with every flow passing. | Deliverable gate. |

---

## 6. Mock-free integration tests

### 6.0 Disclosed test substitutes

D1's, D2's, D4's, D5's, and D6's substitutes still apply (`fake-indexeddb`, `NodeTestHost`, fixed clock and identities, release harness, faults build with the clock pin, Chromium as the routine engine, read-only probe, in-process lifecycle lock, integrity fixture writer, migration fault stages, request-counting wrapper, bench build, Playwright clock in the generator and benchmark, definition-revision fixture writer, test session policy). D7 adds none.

### 6.1 Node application-stack suite (`tests/integration/d7/`)

Conventions are as in earlier deliverables. Clocks are fixed per case.

| Case | Given / When | Then (visible result and durable-state proof) |
|---|---|---|
| I7.1 Migrate earlier fixtures | Load `workspace-v1/` through `workspace-v5/` separately; `initialize`; restart; `getStatus`. | Opened with a receipt naming the three Strategy additions. After restart: Ready at schema 6; views follow A121; the Plan form's Strategy query lists four Strategies; the pointer names a new database and no candidate is listed. |
| I7.2 Migration failure and retry | `workspace-v5/` with one Close Reason fact naming an unknown Catalog identity; `initialize`; restore it; Retry. | MigrationBlocked naming the issue; old stores equal the fixture apart from the IndexedDB version; no candidate; never Ready. After Retry: Opened, and Ready after restart (AC-REST-004, re-proven). |
| I7.3 Long Call lifecycle (AC-PLAN-001, AC-POS-004, AC-CALC-004) | Confirm O-C; record PC1, PC2, X1, and, at Friday 11-20 17:00, E1 with both reflections completed; restart; `getTradeDetail`; `browseTrades` Closed. | Confirmation returns 1R $400 and the Planned view; the Entry snapshots the definition shown. Lifecycle Planned, Open, Open, Open, Closed with agreement at each revision; each result equals the stored Trade (AC-RESP-001). Dump: an Expiration settlement fact with no price or fee, no Close Reason fact, no Lot-Match record. Detail: Lot Matches PC1 ← X1 and PC2 ← E1, realized −101.95, Realized R −0.25R, "Closed via sale of 1 contract and expiration of 1 contract", Option Disposition Timing Mixed, Close Review in the narrative. |
| I7.4 Cash-Secured Put lifecycle | Workspace A: confirm O-S; S1; B1; then B2 Buy 1 to close Wednesday with Close Reason Target Reached. Workspace B: S1; then a Buy 1 dated Monday 10:30 recorded after B1. Workspace C: S1; E-S. Restart each. | A: short Lot, S1 ← B1 realizing 63.70, Closed with a Close Reason, FullyDisposedPreExpiration. B: the receipt discloses the changed Lot Matches and Entry window. C: realized 248.70, Realized R 829/1200, FullyHeldToExpirationSettlement, no Close Reason. |
| I7.5 Expiration Close Review dispositions (AC-POS-004) | Three expiring Long Calls; record each Expiration with Close Review Complete, Decline, and Defer; one more with a Close Reason supplied; restart; `open` at Friday 17:00 and Monday 17:00. | Three Closed with no Close Reason; outcomes an Entry, a decline, and an Outstanding Debt with due anchor Friday 16:00. The fourth returns `CloseReasonNotApplicable` and the dump is unchanged. Friday's owed group shows the deferred one as "Due in the next Review"; Monday's as Due, Incomplete until answered. |
| I7.6 Settlement Due is never inferred (AC-SET-003) | O-S after S1. `getTradeDetail` and `open` at Thursday 17:00, Friday 17:00, and Monday 17:00; restart between them; then record E-S at Monday 17:05 and `open` Monday again. | Thursday: "expires 2026-11-20", no item. Friday and Monday: Settlement Due on Detail and in the Review, Incomplete, lifecycle Open; the dump has no Expiration fact and no lifecycle change at any point. After E-S: Closed, terminal time Friday 16:00, and Monday's Review neither walks O-S nor lists its settlement; the deferred or completed Close Review follows A107. |
| I7.7 Review end to end with settlement (AC-REV-002, P28) | The Settlement Review fixture at Friday 17:00. `open`; save XYZ's Mark once; record E1 for T-1 from its item with Close Review deferred; `open`; save Actions for T-2 to T-5 and answer T-5's reflection; stop the application; clock Saturday 11-21 10:00; restart; `open`. | First open as T7.14. After E1: T-1 is out of the walk and the settlement family, its contract's Mark task is gone, XYZ's task names only T-2 and is resolved for both by one Mark, and T-1 is in the owed group with its Close Review "Due in the next Review". After the restart: the same Friday Review, resumed from facts, Incomplete naming only T-3's settlement with the assignment explanation (decision 10); no Review-session record, flag, or placeholder in any store. |
| I7.8 Rejections write nothing | Option Plans with each `assessPlan` issue; a Buy 3 to close on O-S; an Execution dated 2026-11-23; an Expiration of 1 of 2; a settlement time on 2026-11-23; an Expiration on XYZ stock; an Expiration and an Execution in one Position Change; a Buy after E1. | Each typed rejection, including `TradeClosed` after E1. Every store dump is unchanged. |
| I7.9 Marks of 0 (P27) | Save 0 for the XYZ call on 2026-11-20, 0 for XYZ stock, −0.01 for ABC, and a Mark for the call on 2026-11-23; read T-1 and T-2. | Both 0 Marks are Available; T-1 evaluates with the call at 0 and XYZ at 0 (its Stop Breached), and T-2 shows Current Marked Trade P&L equal to minus its open cost and fees, Worst-Case $0.00, and its Stop Breached; `PriceNegative` and `AfterExpiration` write nothing. |
| I7.10 Payoff is not valuation (AC-CALC-004) | O-C after PC2 with the call at 2.40; after X1; with X1′ instead; after E1; T-A. `getTradeDetail` each. | Planned identical throughout; Current as T7.3's cases, including the Zero Range [0, 55]; Current NotApplicable after E1; both NotApplicable for T-A. With XYZ 52.00, "If XYZ is at 52.00 at expiration" reads −$401.30 after PC2; it changes only when XYZ's Mark or the facts change, never with the call's Mark. Mark-to-Market figures come from the call's Mark and change when it changes, while the payoff views do not; no theoretical option value appears anywhere in the view. |
| I7.11 Retries (AC-JOUR-005) | Submit E1 twice; answer its deferred Close Review twice with one expected revision. | The second Expiration returns Conflict, with one settlement fact and one Close Review outcome; the second answer returns Conflict carrying the Entry. |
| I7.12 Write gate | Host fails the inventory check; call `confirmPlan` for O-C, `recordPositionChange` for E1, and `Persistence.commit` directly. | `RuntimeNotWritable` at every boundary; dumps unchanged; Detail, payoff views, and the Review still readable (AC-DEL-004, AC-DEL-006). |
| I7.13 Rebuild equivalence | After I7.3, I7.4, and I7.7: capture lists, Details, payoff views, and the Review; run `rebuildPrivateState`; capture again. | Normalized views equal; every private index rebuilt with identical contents (AC-REBUILD-001). |
| I7.14 Fresh initialization at schema 6 | Empty factory; `initialize(zone)`. | Schema 6 created directly; Catalog manifest v3 with four Strategies in seed order and exact shapes (AC-REF-001, partial); no migration. |
| I7.15 Underlying Mark Missing and dated line (AC-CALC-002, partial) | O-C after PC2; clock Tuesday 10-13 17:00 with the call's Tuesday Mark and no XYZ Mark; then with neither Tuesday Mark but both Monday Marks. | First: valuation $78.70 at the call's Mark is a Value; condition status, Risk to Stop, and Reward to Target are `Unavailable(MarkMissing)` naming XYZ and 2026-10-13. Second: current figures Missing for the call, with a dated "At Mon Oct 12 close" line from Monday's two Marks. |

### 6.2 Browser suite (`e2e/d7/`, Playwright against the built app on `localhost:5175`)

Chromium only (decision 19). Dates are set with Playwright's clock on the production build. Durable state is proven by reload or full browser restart plus D1's read-only probe. RC later repeats B7.7–B7.9 in all three engines.

| Case | Procedure | Expected observable result and durable-state proof |
|---|---|---|
| B7.1 Plan and open a Long Call | Clock Monday 10-12 09:00: New Plan, Long Call, O-C's terms, reflection; confirm. Clock 11:05: Record entry 1 @ 2.10 and 1 @ 1.90. Relaunch; open Detail. | 1R $400.00 and the Planned payoff with "Breakeven 57.00" after confirmation; after the entries, Open with 2 contracts, Entry Quality risk $401.30, and the Current payoff "Breakeven 57.0065" rounded as "57.01". The probe shows the option Instrument, conditions holding only their triggers, and Exercise Intent NotAuthorized. |
| B7.2 Cash-Secured Put | Plan O-S; Sell to open 2 @ 1.25; Buy to close 3. Then Buy to close 1 @ 0.60. | "Only 2 contracts are open" and nothing saved; then Open with 1 short contract and realized $63.70. |
| B7.3 Expiration from the Review | Settlement Review fixture created through the UI. Clock Friday 17:00: open the Review; enter XYZ's Mark; Record expiration on T-1 with Close Review Reflect later; Refresh Review. | Marks, then the settlement family, then the walk. After refresh: T-1 under "Trades with owed reflections", T-3's item still showing the assignment explanation, and the Review Incomplete. The probe shows one Expiration fact and one Debt. |
| B7.4 Settlement Due on Detail | O-S after S1. Clock Friday 17:00: open Detail. Relaunch at Monday 17:00; open Detail; then Record expiration. | Friday and Monday: "Settlement due" panel, lifecycle "Open"; Monday shows no current dollar figures, with the reason. After recording: "Closed via expiration of 2 contracts", "Fully held to expiration". |
| B7.5 Plan validation | Long Call with Stop exit 2.50 above entry 2.00 and Stop 61 above Target 60; Save. | Both errors beside their fields with focus on the summary; values kept; nothing saved after reload. |
| B7.6 Marks of 0 | In the Review enter 0 for the MNO put, then 0 for KLM stock, then −1 for ABC. | Both 0 Marks save with the note; ABC shows "A price can't be negative"; the probe shows two revisions. |
| B7.7 Update from D6 with data | Harness serves `d6`; create an Open Long Stock Trade with a deferred reflection; switch to `d7`; Reload from the update notice; plan and open a Long Put. | "Updating your journal" shows; earlier data intact; the Long Put saves; About shows schema 6. The probe shows the new pointer target and no old database. |
| B7.8 Kill after commit | SIGKILL right after an Expiration's result renders; relaunch. | Closed lifecycle, the Expiration, and both reflection outcomes are present. |
| B7.9 Offline cold restart | Close; relaunch offline; confirm an option Plan, record an entry, and record an Expiration. | Writable offline; all three survive another offline restart (AC-DEL-001). |
| B7.10 Recovery Only (*faults build*) | Existing option Trades; relaunch with `?faults=control`. | Lists, Detail, payoff views, and the Review readable; no Record expiration, Record entry, or Plan confirmation; probe unchanged. |
| B7.11 Mid-session failure (*faults build*) | Fill an expiration form; `__tjFaults.set(["inventory"])`; Save. | `RuntimeNotWritable` explained; values kept; no Position Change (AC-DEL-006). |
| B7.12 Nothing saved without Save | Fill an option Plan form and an expiration form; resize; navigate away; restart. | No Trade, fact, Entry, decline, or Debt; no entered value in Web Storage (AC-JOUR-001). |
| B7.13 Responsive and accessible | Half-fill an option Plan form at 1280 px; resize to 390 px and back; run axe on the option Plan form, the Execution and expiration forms, both payoff views in every state, option Detail with and without Settlement Due, and the Review's settlement family; record an Expiration using the keyboard only. | Values survive; layout switches at 960 px; no WCAG 2.1 AA violations; every payoff chart has its table equivalent; Settlement Due and Not Applicable are text, not colour alone (AC-UI-001, AC-UI-002). |

---

## 7. Browser-critic flows

The critic receives the frozen `specs/`, the plan index, the D1, D2, D4, D5, D6, and D7 breakdowns, and the list of future capabilities that must not be treated as defects. Those are everything after D7, including:
- Assignment, Exercise, and cash settlement, with Settlement Due on an assigned or exercised contract staying open (decision 10);
- multi-leg Strategies, option-price (structure-value) conditions, multiple expirations, and Not Entered;
- backup and Restore;
- opening an exact past Review date;
- correcting or Voiding a fact;
- provider prices, Daily Bars, and Stop Discipline;
- reports.

It runs `npm run build && npm run preview` (port 5175) itself, plus `npm run serve:releases` for C7.8 and `npm run preview:faults` for C7.5 and C7.9. It does not edit code.

| Flow | Actions | Pass condition |
|---|---|---|
| C7.1 Plan a Long Call | Plan 2 contracts of a 55 Call at 2.00, Stop on the Underlying at 48, Target at 60; confirm. | 1R $400.00 (the whole premium, because the Call is worth nothing at expiration at 48); reward $600.00; the Planned payoff shows breakeven 57.00, maximum loss $400.00 from 0 to 55, and unlimited maximum profit, as a chart and a table. |
| C7.2 Trade a Long Put | Plan, buy, then sell before expiration. | Realized P&L and R shown; "Closed via sale"; Option Disposition Timing "Fully disposed before expiration"; a Close Reason was required. |
| C7.3 Cash-Secured Put | Plan a short Put; sell to open; try to buy back more than is open; buy back part. | Clear over-close error; then a partial close with realized P&L; the Trade can never show as long. |
| C7.4 Payoff views | On an Open Long Call, compare Planned and Current after a partial exit. | Current includes the realized amount and differs from Planned; neither changes when a Mark is entered; current figures are shown separately. |
| C7.5 Settlement Due | Faults build with a pinned clock on and after the expiration date: open the Trade and the Review. | Settlement due on both, the Trade still Open, the Review Incomplete; nothing marked expired until recorded. |
| C7.6 Record an Expiration | From the Review's settlement family, record the expiration with Close Review deferred; refresh. | No Close Reason asked; Closed via expiration; the Trade leaves the walk and appears under owed reflections; the Review completes once everything else is done (or names the assigned Put as the remaining blocker). |
| C7.7 Marks of 0 | Enter 0 for an option and for a stock, then a negative price. | Both 0 Marks save with the note and their Trades evaluate with them; the negative price is refused. |
| C7.8 Update with migration | Harness serves `d6`; create Trades; switch to `d7`; reload from the notice; plan an option. | Migration message; earlier data intact; the option Plan saves; About shows schema 6. |
| C7.9 Recovery Only | Faults build: relaunch with `?faults=inventory`. | Option Detail, payoff, and the Review readable; no mutating controls. |
| C7.10 Offline, responsive, keyboard, About | Stop the server and reload, then record an Expiration; resize with a half-filled option Plan; plan an option by keyboard; open About. | Offline works; values survive resizing; visible focus; the payoff tables are readable by keyboard and screen reader; About lists only D1, D2, D4, D5, D6, and D7 capabilities. |

---

## 8. Acceptance matrix rows

Status values: `planned`, `covered`, `intentionally not advertised`. All rows are `planned`. AC-DEL rows cite Chromium and faults-build evidence; Firefox, WebKit, and real-state evidence are **pending RC** (decision 19).

| Scenario | Deliverable | Tasks | TDD / structural | Integration case and fixture | Critic flow | Command or procedure | Expected result and durable-state proof | Failure / nonmutation / restart evidence | Status |
|---|---|---|---|---|---|---|---|---|---|
| AC-SET-003 (full) | D7 | T7.6, T7.14, T7.16, T7.21, T7.23, T7.24 | T7.6 Settlement Due group; T7.14 groups; T7.16 Detail group | I7.6, I7.7; B7.3, B7.4 | C7.5, C7.6 | `npm run test:integration -- d7/settlement` | Settlement Due on Detail and in the Review, Review Incomplete; no Expiration fact or Closed lifecycle until the explicit Expiration Position Change | Dumps unchanged across reads and restarts | planned |
| AC-POS-004 (full) | D7 | T7.5, T7.13, T7.21 | T7.5 close requirement; T7.13 Expiration group | I7.3, I7.5; B7.3 | C7.2, C7.6 | `npm run test:integration -- d7/close-review` | One Close Reason for a trader-directed exit (D6); none manufactured or accepted for an Expiration; Terminal Disposition from actual mechanisms; Close Review dispositions never block closure | `CloseReasonNotApplicable` writes nothing | planned |
| AC-REV-002 (full, read per P28) | D7 | T7.14, T7.24 | T7.14 task-family group | I7.7; B7.3 | C7.6 | `npm run test:integration -- d7/review` | Marks, settlement, Trade walk, owed group (decision 29, D6 P20); one shared XYZ Mark for two Trades; resumed from facts after a full stop | No Review-session record after restart | planned |
| AC-CALC-004 (partial: single expiration; stock-only Not Applicable) | D7 | T7.3, T7.16, T7.22 | T7.3 groups | I7.10 | C7.4 | `npm run test:integration -- d7/payoff` | Independent Planned and Current curves with exact zero sets, signed extrema, and attainment sets; realized offset; flat and stock-only Not Applicable; valuation separately sourced | — | planned (multiple expirations in D10) |
| AC-PLAN-001 (partial: exact option contracts) | D7 | T7.2, T7.12, T7.19 | T7.12 accepted case | I7.3; B7.1 | C7.1 | `npm run test:integration -- d7/lifecycle` | One Trade, frozen Plan, contract, conditions, Exercise Intent, Planned lifecycle, positive 1R, completed Plan Reflection, in one commit | Restart | planned (objective criteria in D10) |
| AC-CALC-003 (partial: underlying-price option conditions) | D7 | T7.6 | T7.6 risk group | I7.15 | C7.4 | as AC-CALC-004 | Independent condition status from the Underlying; headline distances from the values at expiration at each trigger; Overrun disclosed; no Deviation | — | planned (structure-value in D10, revision in D17) |
| AC-CALC-002 (partial: option Trade with the Underlying Mark Missing) | D7 | T7.6 | T7.6 availability case | I7.15 | — | `npm run test:integration -- d7/missing-mark` | Valuation a Value; condition-dependent figures Unavailable naming XYZ and the date | — | planned (multi-Instrument in D10) |
| AC-REF-001 (partial: option Strategy seeds) | D7 | T7.9, T7.17 | T7.9 seed group | I7.1, I7.14 | — | `npm run test:integration -- d7/seed` | Four Strategies in D7's Catalog: Long Stock, Long Call, Long Put, Cash-Secured Put, with exact shapes | Second launch adds nothing | planned (full in D22) |
| AC-JOUR-005 (partial: Expiration retries) | D7 | T7.13 | — | I7.11 | — | `npm run test:integration -- d7/retries` | One settlement fact and one Close Review outcome | Conflicts write nothing | planned |
| AC-JOUR-001 (re-proven for the option forms) | D7 | T7.19, T7.21 | — | B7.12 | C7.10 | `npx playwright test e2e/d7/no-save.spec.ts` | Nothing stored without Save | Restart | planned |
| AC-REST-004 (partial: schema 6) | D7 | T7.7, T7.17 | T7.17 case | I7.1, I7.2 | C7.8 | `npm run test:integration -- d7/migration` | Old stores unchanged on failure; never Ready; Retry activates with receipt | Restart | planned ("exportable" in D8) |
| AC-RESP-001 (cumulative) | D7 | T7.12, T7.13, T7.21 | "equal to a fresh derivation"; "from the result alone" | I7.3 | C7.6 | `npm run test:integration -- d7/responses` | Option confirmation, Executions, and Expiration results equal durable state; the UI continues from them | — | planned |
| AC-CAP-001 (cumulative) | D7 | T7.18 | `verify:capabilities` | — | C7.10 | `npm run verify:capabilities` | Manifest equals reachable operations; Assignment, Exercise, multi-leg absent | — | planned |
| AC-DEL-001 (cumulative) | D7 | T7.19–T7.21 | — | B7.9 | C7.10 | `npx playwright test e2e/d7/offline.spec.ts` | Option Plan, entry, and Expiration offline after full stop | Second offline restart | planned; other engines **pending RC** |
| AC-DEL-004, AC-DEL-006 (cumulative) | D7 | T7.12, T7.13 | — | I7.12; B7.10, B7.11 | C7.9 | `npx playwright test e2e/d7/runtime-failure.spec.ts` | Option writes rejected at UI and persistence | Dumps unchanged | planned; real-state **pending RC** |
| AC-DEL-003 (cumulative) | D7 | T7.25 | `verify:releases` | B7.7 | C7.8 | as B7.7 | Tab launch Writable after a schema-changing update | — | planned; Firefox and WebKit **pending RC**; production HTTPS **pending** |
| AC-UI-001, AC-UI-002 (cumulative) | D7 | T7.19–T7.24 | view-state and chart groups | B7.13 | C7.10 | `npx playwright test e2e/d7/responsive-a11y.spec.ts` | State kept across resize; axe clean; charts with textual equivalents | — | planned |
| AC-REBUILD-001 (cumulative) | D7 | T7.7 | — | I7.13 | — | `npm run test:integration -- d7/rebuild` | Equal normalized views; rebuilt indexes identical | — | planned |
| AC-PERF-001 (cumulative) | D7 | T7.28, T7.29 | structural | Benchmark dataset (section 1.4); query-count test | — | `npm run bench:run` | Budgets met with 30% option Trades and a settlement family at the as-of Review | Open rows, Closed page, and Review groups equal expected before and after the runs | planned |

---

## 9. Clause-level acceptance check

| Scenario | Clause | Covered by | Finding |
|---|---|---|---|
| AC-SET-003 | an option whose expiration date has passed, with no outcome | I7.6 (Friday and Monday) | covered; "passed" is read as the expiration session having completed (P25) |
| | Trade Detail and Daily Review opened | T7.14, T7.16, I7.6, B7.4 | covered, resolving review-queue "Deferred to task breakdown" item 5 |
| | no Expiration fact or Closed lifecycle inferred | I7.6 dumps | covered |
| | Settlement Due shown and Review incomplete | T7.14, I7.6, I7.7 | covered |
| | only an explicit settlement Position Change changes the facts | T7.13, I7.6 | covered for Expiration; Assignment, Exercise, and cash settlement are D20 (decision 10) |
| AC-POS-004 | one Close Reason required for a trader-directed exit | D6 (I6.5), I7.4 (option Buy to close) | covered |
| | none manufactured for a non-agency settlement | A107, T7.5, T7.13, I7.3, I7.5 | covered; this completes the scenario |
| | both derive Terminal Disposition from actual mechanisms | A108, T7.5, I7.3 | covered, including the mixed sale and expiration |
| | Close Review completion, decline, or deferral never blocks closure | T7.13, I7.5 | covered for Expiration (D6 for exits) |
| AC-REV-002 | a missed Review | P28 | **Read as agreed (P28):** an unfinished latest Review, reopened while still latest (decision 27) |
| | shared current Missing Marks | I7.7 (XYZ for T-1's conditions and T-2's shares) | covered |
| | global due Debt | I7.7 (T-5's due reflection in its card; T-1's Close Review in the owed group) | covered under decision 29 and D6 P20 |
| | Settlement Due | I7.7 | covered |
| | order Mark, Debt, settlement, Trade | T7.14 | **Reopened by decision 29:** Marks, settlement, walk with reflections in cards, then the owed group |
| | shared Mark resolves once for all affected Trades | I7.7 | covered |
| | saved outcomes resume from facts after the application stops | I7.7 | covered |
| | no Review Session, finish flag, or placeholder | I7.7 dumps | covered; this completes the scenario |
| AC-CALC-004 | planned option Trade, then remaining current exposure with realized offset | T7.3, I7.10 | covered |
| | independent curves with all zero crossings, touches, and ranges | T7.3 | covered: Crossing (O-C), Touch (DEF), Zero Range (X1′) |
| | signed extrema and attainment sets | T7.3 | covered: a point, a closed interval, and a ray |
| | no theoretical option price | T7.3 input type, I7.10 | covered |
| | flat Current Not Applicable; stock-only Not Applicable | T7.3, I7.10 | covered |
| | multiple expirations Unavailable | — | D10 |
| AC-PLAN-001 | exact contracts | T7.12, I7.3 | covered; objective criteria in D10 |
| | Entry snapshots the definition shown and shares Thesis and Invalidation | D1, I7.3 | re-proven for an option Plan |
| AC-SET-004 | a long-option Plan with and without Exercise Intent | A100, T7.2, T7.12 | **Finding:** D7 captures Exercise Intent before any exercise can occur, as the delivery contract requires of facts needed later; the scenario's settlement behavior is D20 |
| AC-CALC-003 | underlying-price conditions keep independent status | T7.6 | covered for options under P24 (partial claim, section 1.2) |
| AC-REF-001 | the eleven Strategy seeds | T7.9 | four now; multi-leg seeds in D10; full in D22 |
| AC-JOUR-005 | one current outcome per key under retries | I7.11 | covered for Expiration's reflection and Close Review |
| AC-RESP-001 | option mutations return usable post-commit state | T7.12, T7.13, I7.3 | covered |
| AC-DEL-004, AC-DEL-006 | the new writes return `RuntimeNotWritable` at both boundaries | I7.12, B7.10, B7.11 | covered |
| AC-PERF-001 | 25,000 Trades, about 200,000 facts | T7.28, T7.29 | covered at the mature mix with option Trades |

**Review-queue items for D7, and where they are resolved:**

- *AC-REV-002 becomes full, with settlement between Marks and the walk (D5 item 2, D6 item 1):* T7.14, I7.7.
- *The "missed Review" reading (D4 item 2):* P28.
- *An Expiration that closes a Trade still owes a Close Review, with no Close Reason; P22 and derived FIFO on option Lots (D6 item 1):* A103, A104, A107, T7.5, T7.13, I7.5.
- *Settlement Due on Trade Detail (deferred item 5):* T7.16, I7.6, B7.4.
- *Mark of exactly 0 (D4 A37):* P27, with the D4 amendment in section 1.2; T7.8, I7.9.
- *Assigned or exercised contracts before D20 (decision 10):* A112, I7.7.
- *Missing-Mark dated and at-entry lines for options (decision 26):* A110, T7.6, I7.15.

---

## 10. Evidence recording

As in earlier deliverables, under `evidence/D07/`: `tdd-log.md` (red and green per case), `structural.md`, `provenance.md` (engine and OS versions, never an allowlist), `bench.md` (raw timings, percentile method, dataset provenance including the pinned as-of instant, environment), and `critic-<n>.md`, with each critic defect first reproduced by a failing test.
